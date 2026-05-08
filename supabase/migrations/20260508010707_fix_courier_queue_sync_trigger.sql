CREATE OR REPLACE FUNCTION public.handle_courier_queue_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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

  -- 1. Mirror is_online dari courier_status
  IF (NEW.is_active = true) AND (v_new_status IN ('on', 'stay')) THEN
    NEW.is_online := true;
  ELSE
    NEW.is_online := false;
  END IF;

  -- 2. Queue timestamp management
  IF NEW.is_online = false THEN
    -- Offline: clear timestamp
    NEW.queue_joined_at := NULL;

  ELSIF (TG_OP = 'INSERT' AND NEW.is_online = true) THEN
    -- New courier going online
    v_reset_needed := true;

  ELSIF (TG_OP = 'UPDATE') THEN
    -- Check various transition conditions
    IF (OLD.is_online = false AND NEW.is_online = true) THEN
      -- Transition: offline → online
      v_reset_needed := true;
      
    ELSIF (v_old_status = 'off' AND v_new_status IN ('on', 'stay')) THEN
      -- Transition: off → on/stay (even if is_online was already true)
      v_reset_needed := true;
      
    ELSIF (v_old_status = 'on' AND v_new_status = 'stay') OR
          (v_old_status = 'stay' AND v_new_status = 'on') THEN
      -- Transition: on ↔ stay (keep existing timestamp, don't reset)
      -- This preserves FIFO order when switching between on/stay
      v_reset_needed := false;
      
    ELSIF (OLD.is_active = false AND NEW.is_active = true AND NEW.is_online = true) THEN
      -- Unsuspend: reactivate courier
      v_reset_needed := true;
      
    ELSIF (NEW.queue_joined_at IS NULL AND NEW.is_online = true) THEN
      -- Recovery: NULL timestamp but online (edge case fix)
      v_reset_needed := true;
    END IF;
  END IF;

  -- Apply timestamp reset if needed
  IF v_reset_needed THEN
    NEW.queue_joined_at := clock_timestamp();  -- Use clock_timestamp() for microsecond precision
  END IF;

  -- 3. Suspend: force offline
  IF NEW.is_active = false AND OLD.is_active = true THEN
    NEW.courier_status       := 'off';
    NEW.is_online            := false;
    NEW.queue_joined_at      := NULL;
    NEW.is_priority_recovery := false;
  END IF;

  -- 4. Audit trail
  IF (TG_OP = 'UPDATE') AND
     (v_old_status != v_new_status OR
      OLD.is_priority_recovery IS DISTINCT FROM NEW.is_priority_recovery) THEN

    INSERT INTO public.tier_change_log (
      courier_id, trigger_source,
      queue_joined_at_before, queue_joined_at_after,
      context
    ) VALUES (
      NEW.id,
      'status_' || v_old_status || '_to_' || v_new_status,
      OLD.queue_joined_at, NEW.queue_joined_at,
      jsonb_build_object(
        'old_status', v_old_status,
        'new_status', v_new_status,
        'is_priority_recovery', NEW.is_priority_recovery,
        'reset_needed', v_reset_needed,
        'old_is_online', OLD.is_online,
        'new_is_online', NEW.is_online
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;;
