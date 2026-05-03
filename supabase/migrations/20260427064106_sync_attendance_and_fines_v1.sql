-- 1. Update complete_order with fine logic and bugfix
CREATE OR REPLACE FUNCTION public.complete_order(
  p_order_id uuid, p_user_id uuid, p_user_name text, p_notes text, 
  p_commission_rate integer, p_commission_threshold integer, 
  p_commission_type text DEFAULT 'percentage'::text
)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_order RECORD;
  v_admin_fee BIGINT;
  v_courier_earning BIGINT;
  v_fine_deducted BIGINT := 0; 
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

  -- Cek apakah kurir punya denda per-order aktif hari ini (Prioritas 2)
  IF v_order.courier_id IS NOT NULL AND (SELECT late_fine_active FROM public.profiles WHERE id = v_order.courier_id) THEN
    v_fine_deducted := (
      SELECT COALESCE(fine_late_minor_amount, 1000) 
      FROM public.settings WHERE id = 'global'
    );
    -- FIX: Gunakan GREATEST(0, ...) untuk mencegah nilai negatif
    v_courier_earning := GREATEST(0, v_courier_earning - v_fine_deducted);
  END IF;

  -- Tambahkan biaya titik/beban (jika ada)
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
      applied_admin_fee = v_admin_fee,
      fine_deducted = v_fine_deducted
  WHERE id = p_order_id;

  INSERT INTO public.tracking_logs (order_id, status, changed_by, changed_by_name, notes, changed_at)
  VALUES (p_order_id, 'delivered', p_user_id, p_user_name, p_notes, NOW());

  IF v_order.courier_id IS NOT NULL THEN
    UPDATE public.profiles
    SET total_deliveries_alltime = COALESCE(total_deliveries_alltime, 0) + 1,
        total_earnings_alltime = COALESCE(total_earnings_alltime, 0) + v_courier_earning,
        unpaid_count = COALESCE(unpaid_count, 0) + 1,
        unpaid_amount = COALESCE(unpaid_amount, 0) + v_courier_earning,
        cancel_count = 0, 
        is_priority_recovery = false 
    WHERE id = v_order.courier_id;
  END IF;
END;
$function$;

-- 2. Update handle_courier_queue_sync with Attendance logic
CREATE OR REPLACE FUNCTION public.handle_courier_queue_sync()
RETURNS trigger AS $$
DECLARE
  v_old_status TEXT;
  v_new_status TEXT;
  v_reset_needed BOOLEAN := false;
  v_shift RECORD;
  v_late_minutes INTEGER := 0;
  v_settings RECORD;
  v_today_start TIMESTAMPTZ;
  v_shift_start TIMESTAMPTZ;
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
    
    -- Attendance Check-out
    UPDATE public.attendance_logs 
    SET check_out = NOW()
    WHERE courier_id = NEW.id 
    AND check_out IS NULL;
    
  ELSIF (TG_OP = 'INSERT' AND NEW.is_online = true) THEN
    v_reset_needed := true;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.is_online = false AND NEW.is_online = true) OR
       (v_old_status != v_new_status AND v_new_status IN ('on', 'stay')) OR
       (OLD.is_active = false AND NEW.is_active = true AND NEW.is_online = true) OR
       (NEW.queue_joined_at IS NULL AND NEW.is_online = true) THEN
       
       v_reset_needed := true;
    END IF;
  END IF;

  IF v_reset_needed THEN
    NEW.queue_joined_at := NOW();
    
    -- 2.1 Attendance Check-in Logic
    IF (OLD.is_online = false AND NEW.is_online = true) THEN
      SELECT * INTO v_shift FROM public.shifts WHERE id = NEW.shift_id;
      
      IF v_shift IS NOT NULL THEN
        v_today_start := DATE_TRUNC('day', NOW());
        v_shift_start := v_today_start + v_shift.start_time;
        
        -- Jika shift malam, mungkin v_shift_start harus dikurangi 1 hari jika sekarang dini hari?
        -- Logic: Jika sekarang jam 01:00 dan shift mulai 18:45, berarti shift start-nya kemaren.
        IF v_shift.is_overnight AND NOW() < v_shift_start - INTERVAL '6 hours' THEN
           v_shift_start := v_shift_start - INTERVAL '1 day';
        END IF;

        v_late_minutes := EXTRACT(EPOCH FROM (NOW() - v_shift_start)) / 60;
        
        IF NOT EXISTS (
          SELECT 1 FROM public.attendance_logs 
          WHERE courier_id = NEW.id 
          AND created_at >= (NOW() - INTERVAL '12 hours') -- Tolerance for overnight
          AND check_out IS NULL
        ) THEN
          SELECT * INTO v_settings FROM public.settings WHERE id = 'global';
          
          INSERT INTO public.attendance_logs (
            courier_id, shift_id, check_in, status, late_minutes, fine_amount
          ) VALUES (
            NEW.id, NEW.shift_id, NOW(),
            CASE WHEN v_late_minutes > 0 THEN 'late' ELSE 'on_time' END,
            GREATEST(0, v_late_minutes),
            CASE 
              WHEN v_late_minutes > COALESCE(v_settings.fine_late_major_minutes, 60) 
              THEN COALESCE(v_settings.fine_late_major_amount, 30000) 
              ELSE 0 
            END
          );
          
          IF v_late_minutes > 0 THEN
            NEW.late_fine_active := true;
          ELSE
            NEW.late_fine_active := false;
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  -- 3. Audit Trail
  IF (TG_OP = 'UPDATE') AND 
     (v_old_status != v_new_status OR 
      OLD.is_priority_recovery IS DISTINCT FROM NEW.is_priority_recovery OR
      OLD.is_online IS DISTINCT FROM NEW.is_online) THEN
     
    INSERT INTO public.tier_change_log (
        courier_id, old_status, new_status, 
        old_is_priority, new_is_priority, 
        tier_before, tier_after,
        queue_joined_at_before, queue_joined_at_after,
        trigger_source, reason
    ) VALUES (
        NEW.id, v_old_status, v_new_status,
        COALESCE(OLD.is_priority_recovery, false), 
        COALESCE(NEW.is_priority_recovery, false),
        CASE WHEN OLD.is_priority_recovery THEN 1 WHEN v_old_status = 'stay' THEN 2 ELSE 3 END,
        CASE WHEN NEW.is_priority_recovery THEN 1 WHEN v_new_status = 'stay' THEN 2 ELSE 3 END,
        OLD.queue_joined_at, NEW.queue_joined_at,
        'TRIGGER_PROFILE_UPDATE', 'Status/Attendance sync'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
;
