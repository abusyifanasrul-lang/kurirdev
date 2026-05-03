CREATE OR REPLACE FUNCTION public.handle_courier_queue_sync()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
    -- Refined explicit transitions
    IF (OLD.is_online = false AND NEW.is_online = true) THEN
      -- off -> on atau off -> stay
      v_reset_needed := true;
    ELSIF (v_old_status = 'on' AND v_new_status = 'stay') OR
          (v_old_status = 'stay' AND v_new_status = 'on') THEN
      -- Perpindahan antar status aktif, sesuai kesepakatan
      v_reset_needed := true;
    ELSIF (OLD.is_active = false AND NEW.is_active = true AND NEW.is_online = true) THEN
      -- Akun di-unsuspend saat status masih on/stay
      v_reset_needed := true;
    ELSIF (NEW.queue_joined_at IS NULL AND NEW.is_online = true) THEN
      -- Recovery state: kurir online tapi timestamp hilang (data inconsistency)
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
$function$;;
