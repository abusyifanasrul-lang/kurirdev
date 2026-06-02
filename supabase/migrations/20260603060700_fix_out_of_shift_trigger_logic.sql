-- Migration: Fix out_of_shift trigger logic to not interfere with RPC validation
-- Date: 2026-06-03
-- Purpose: Prevent trigger from recalculating out_of_shift when courier goes ON
--          Let record_courier_checkin() RPC be the source of truth for shift validation

CREATE OR REPLACE FUNCTION public.handle_courier_queue_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_status TEXT;
  v_new_status TEXT;
  v_reset_needed BOOLEAN := false;
BEGIN
  IF NEW.role != 'courier' THEN
    NEW.queue_joined_at := NULL;
    NEW.is_online := false;
    NEW.out_of_shift := false;
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

  -- 2. Calculate out_of_shift ONLY when going OFFLINE or STAY
  --    When going ON, let record_courier_checkin() RPC set it (or leave as-is for private mode)
  IF NEW.is_online = false THEN
    NEW.out_of_shift := false;  -- Reset when offline
  ELSIF v_new_status = 'stay' THEN
    -- STAY couriers are never out_of_shift (they're at basecamp)
    NEW.out_of_shift := false;
  -- ELSE: Don't recalculate for 'on' status - let RPC or frontend value stand
  END IF;

  -- 3. Queue timestamp — hanya transisi spesifik yang reset
  IF NEW.is_online = false THEN
    NEW.queue_joined_at := NULL;

  ELSIF (TG_OP = 'INSERT' AND NEW.is_online = true) THEN
    v_reset_needed := true;

  ELSIF (TG_OP = 'UPDATE') THEN
    -- off/null → on/stay
    IF (v_old_status IN ('off', '') OR v_old_status IS NULL) AND 
       (v_new_status IN ('on', 'stay')) THEN
      v_reset_needed := true;
    -- on ↔ stay transitions
    ELSIF (v_old_status = 'on' AND v_new_status = 'stay') OR
          (v_old_status = 'stay' AND v_new_status = 'on') THEN
      v_reset_needed := true;
    -- unsuspend
    ELSIF (OLD.is_active = false AND NEW.is_active = true AND NEW.is_online = true) THEN
      v_reset_needed := true;
    -- recovery state
    ELSIF (NEW.queue_joined_at IS NULL AND NEW.is_online = true) THEN
      v_reset_needed := true;
    END IF;
  END IF;

  IF v_reset_needed THEN
    NEW.queue_joined_at := clock_timestamp();
  END IF;

  -- 4. Suspend: paksa keluar antrian
  IF NEW.is_active = false AND OLD.is_active = true THEN
    NEW.courier_status       := 'off';
    NEW.is_online            := false;
    NEW.queue_joined_at      := NULL;
    NEW.is_priority_recovery := false;
    NEW.out_of_shift         := false;
  END IF;

  -- 5. Audit trail
  IF (TG_OP = 'UPDATE') AND
     (v_old_status != v_new_status OR
      OLD.is_priority_recovery IS DISTINCT FROM NEW.is_priority_recovery OR
      OLD.out_of_shift IS DISTINCT FROM NEW.out_of_shift) THEN

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
        'out_of_shift', NEW.out_of_shift,
        'shift_id', NEW.shift_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_courier_queue_sync IS 
  'Manages courier queue sync. Does NOT recalculate out_of_shift for ON status - lets RPC/frontend control it.';

DO $$
BEGIN
  RAISE NOTICE 'Migration 20260603060700 completed successfully';
  RAISE NOTICE 'Fixed trigger: Does NOT recalculate out_of_shift when courier goes ON';
  RAISE NOTICE 'Lets record_courier_checkin() RPC be source of truth for shift validation';
  RAISE NOTICE 'Prevents race conditions between trigger and RPC validation';
END $$;
