-- 1. CLEANUP OVERLOADED complete_order FUNCTIONS
-- We saw 4 versions. Let's drop them to be sure.
DROP FUNCTION IF EXISTS public.complete_order(uuid, uuid, text, integer, integer, text, text);
DROP FUNCTION IF EXISTS public.complete_order(uuid, uuid, text, text, integer, integer, text);

-- 2. RECREATE AUTHORITATIVE complete_order
-- Matches frontend call: p_order_id, p_user_id, p_user_name, p_notes, p_commission_rate, p_commission_threshold, p_commission_type
CREATE OR REPLACE FUNCTION public.complete_order(
  p_order_id uuid,
  p_user_id uuid,
  p_user_name text,
  p_notes text,
  p_commission_rate integer,
  p_commission_threshold integer,
  p_commission_type text DEFAULT 'percentage'
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_order RECORD;
  v_admin_fee BIGINT;
  v_courier_earning BIGINT;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order tidak ditemukan';
  END IF;

  IF v_order.status = 'delivered' THEN
    RAISE EXCEPTION 'Order sudah diselesaikan sebelumnya';
  END IF;

  -- Hitung Potongan Admin
  IF p_commission_type = 'flat' THEN
    IF v_order.total_fee > p_commission_threshold THEN
      v_admin_fee := GREATEST(1000, FLOOR(v_order.total_fee / 10000) * 1000);
    ELSE
      v_admin_fee := 0;
    END IF;
  ELSE
    v_admin_fee := v_order.total_fee * (1 - (p_commission_rate::DECIMAL / 100));
    IF (v_order.total_fee <= p_commission_threshold) THEN
      v_admin_fee := 0;
    END IF;
  END IF;

  v_courier_earning := v_order.total_fee - v_admin_fee;

  IF v_order.total_biaya_titik + v_order.total_biaya_beban > 0 THEN
      v_courier_earning := v_courier_earning + v_order.total_biaya_titik + v_order.total_biaya_beban;
  END IF;

  UPDATE public.orders 
  SET status = 'delivered', 
      is_waiting = false,
      actual_delivery_time = NOW(),
      applied_commission_rate = p_commission_rate,
      applied_commission_threshold = p_commission_threshold,
      applied_commission_type = p_commission_type,
      applied_admin_fee = v_admin_fee
  WHERE id = p_order_id;

  INSERT INTO public.tracking_logs (order_id, status, changed_by, changed_by_name, notes, changed_at)
  VALUES (p_order_id, 'delivered', p_user_id, p_user_name, p_notes, NOW());

  IF v_order.courier_id IS NOT NULL THEN
    UPDATE public.profiles
    SET total_deliveries_alltime = COALESCE(total_deliveries_alltime, 0) + 1,
        total_earnings_alltime = COALESCE(total_earnings_alltime, 0) + v_courier_earning,
        unpaid_count = COALESCE(unpaid_count, 0) + 1,
        unpaid_amount = COALESCE(unpaid_amount, 0) + v_courier_earning,
        cancel_count = 0, -- Reset cancel count upon successful delivery
        is_priority_recovery = false -- Reset priority recovery
    WHERE id = v_order.courier_id;
  END IF;
END;
$$;

-- 3. NORMALIZE rotate_courier_queue
DROP FUNCTION IF EXISTS public.rotate_courier_queue(uuid); -- Drop old version with target_user_id name
CREATE OR REPLACE FUNCTION public.rotate_courier_queue(p_courier_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.profiles
  SET queue_joined_at = NOW()
  WHERE id = p_courier_id;
END;
$$;

-- 4. REFACTOR tier_change_log TABLE
ALTER TABLE public.tier_change_log 
ADD COLUMN IF NOT EXISTS tier_before INT,
ADD COLUMN IF NOT EXISTS tier_after INT,
ADD COLUMN IF NOT EXISTS queue_joined_at_before TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS queue_joined_at_after TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS trigger_source TEXT,
ADD COLUMN IF NOT EXISTS source_id UUID,
ADD COLUMN IF NOT EXISTS context JSONB;

-- 5. REFINE handle_courier_queue_sync TRIGGER
CREATE OR REPLACE FUNCTION public.handle_courier_queue_sync()
RETURNS trigger AS $$
DECLARE
  v_old_status TEXT;
  v_new_status TEXT;
  v_reset_needed BOOLEAN := false;
BEGIN
  -- Safety check: skip if not a courier
  IF NEW.role != 'courier' THEN
    NEW.queue_joined_at := NULL;
    NEW.is_online := false;
    RETURN NEW;
  END IF;

  v_old_status := COALESCE(OLD.courier_status, 'off');
  v_new_status := COALESCE(NEW.courier_status, 'off');

  -- 1. Automatic Status Mirroring
  IF (NEW.is_active = true) AND (v_new_status IN ('on', 'stay')) THEN
    NEW.is_online := true;
  ELSE
    NEW.is_online := false;
  END IF;

  -- 2. Queue Timestamp Management (STRICT TRANSITIONS)
  IF NEW.is_online = false THEN
    NEW.queue_joined_at := NULL;
  ELSIF (TG_OP = 'INSERT' AND NEW.is_online = true) THEN
    v_reset_needed := true;
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Reset ONLY on specific transitions
    IF (OLD.is_online = false AND NEW.is_online = true) OR -- off -> on/stay
       (v_old_status != v_new_status AND v_new_status IN ('on', 'stay')) OR -- on <-> stay
       (OLD.is_active = false AND NEW.is_active = true) OR -- inactive -> active
       (NEW.queue_joined_at IS NULL AND NEW.is_online = true) THEN -- recovery
       
       v_reset_needed := true;
    END IF;
  END IF;

  IF v_reset_needed THEN
    NEW.queue_joined_at := NOW();
  END IF;

  -- 3. Detailed Audit Tier Changes
  IF (TG_OP = 'UPDATE') AND 
     (v_old_status != v_new_status OR 
      OLD.is_priority_recovery IS DISTINCT FROM NEW.is_priority_recovery OR
      OLD.is_online IS DISTINCT FROM NEW.is_online) THEN
     
    INSERT INTO public.tier_change_log (
        courier_id, 
        old_status, 
        new_status, 
        old_is_priority, 
        new_is_priority, 
        tier_before,
        tier_after,
        queue_joined_at_before,
        queue_joined_at_after,
        trigger_source,
        reason
    ) VALUES (
        NEW.id, 
        v_old_status, 
        v_new_status,
        COALESCE(OLD.is_priority_recovery, false), 
        COALESCE(NEW.is_priority_recovery, false),
        CASE 
          WHEN OLD.is_priority_recovery THEN 1 
          WHEN v_old_status = 'stay' THEN 2 
          ELSE 3 
        END,
        CASE 
          WHEN NEW.is_priority_recovery THEN 1 
          WHEN v_new_status = 'stay' THEN 2 
          ELSE 3 
        END,
        OLD.queue_joined_at,
        NEW.queue_joined_at,
        'TRIGGER_PROFILE_UPDATE',
        'Status/Priority change'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
;
