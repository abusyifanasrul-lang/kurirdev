-- Migration: Proper out_of_shift logic with shift active status and time window
-- Date: 2026-06-03
-- Purpose: Calculate out_of_shift based on:
--   1. Shift is_active status (inactive shifts = out_of_shift)
--   2. Current time vs shift window in operational timezone
--   3. Couriers without shift_id default to out_of_shift=true

-- ============================================================================
-- 1. Create function to calculate if courier is out of shift
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_courier_out_of_shift(
  p_courier_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_shift RECORD;
  v_current_time TIMESTAMPTZ;
  v_current_date DATE;
  v_shift_window_start TIMESTAMPTZ;
  v_shift_window_end TIMESTAMPTZ;
  v_check_in_window_minutes INTEGER;
  v_operational_tz TEXT;
  v_shift_id UUID;
BEGIN
  -- Get courier's shift_id
  SELECT shift_id INTO v_shift_id
  FROM profiles
  WHERE id = p_courier_id AND role = 'courier';
  
  -- No shift assigned = out of shift
  IF v_shift_id IS NULL THEN
    RETURN true;
  END IF;
  
  -- Get shift details
  SELECT * INTO v_shift
  FROM shifts
  WHERE id = v_shift_id;
  
  -- Shift not found or inactive = out of shift
  IF NOT FOUND OR v_shift.is_active = false THEN
    RETURN true;
  END IF;
  
  -- Get timezone settings
  SELECT operational_timezone, check_in_window_minutes 
  INTO v_operational_tz, v_check_in_window_minutes
  FROM settings LIMIT 1;
  
  IF v_operational_tz IS NULL THEN v_operational_tz := 'Asia/Makassar'; END IF;
  IF v_check_in_window_minutes IS NULL THEN v_check_in_window_minutes := 60; END IF;
  
  -- Get current time in operational timezone
  v_current_time := now() AT TIME ZONE v_operational_tz;
  v_current_date := v_current_time::DATE;
  
  -- Calculate shift window (allow check-in X minutes before shift start)
  v_shift_window_start := (v_current_date || ' ' || v_shift.start_time)::TIMESTAMPTZ 
    AT TIME ZONE v_operational_tz - (v_check_in_window_minutes || ' minutes')::INTERVAL;
  
  IF v_shift.is_overnight THEN
    -- For overnight shifts, end time is on next day
    v_shift_window_end := ((v_current_date + 1) || ' ' || v_shift.end_time)::TIMESTAMPTZ 
      AT TIME ZONE v_operational_tz;
  ELSE
    v_shift_window_end := (v_current_date || ' ' || v_shift.end_time)::TIMESTAMPTZ 
      AT TIME ZONE v_operational_tz;
  END IF;
  
  -- Check if current time is within shift window
  IF v_current_time >= v_shift_window_start AND v_current_time <= v_shift_window_end THEN
    RETURN false;  -- Within shift window
  ELSE
    RETURN true;   -- Outside shift window
  END IF;
END;
$$;

COMMENT ON FUNCTION public.is_courier_out_of_shift(UUID) IS 
  'Calculates if courier is out of shift based on: 1) No shift assigned, 2) Shift inactive, 3) Outside shift time window in operational timezone';

-- ============================================================================
-- 2. Update trigger to use the new function
-- ============================================================================

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

  -- 2. Calculate out_of_shift using proper logic
  IF NEW.is_online = true THEN
    NEW.out_of_shift := is_courier_out_of_shift(NEW.id);
  ELSE
    NEW.out_of_shift := false;  -- Reset when offline
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
  'Manages courier queue sync with proper out_of_shift calculation based on shift active status and time window';

-- ============================================================================
-- 3. Backfill existing data - recalculate out_of_shift for all online couriers
-- ============================================================================

UPDATE profiles
SET 
  out_of_shift = is_courier_out_of_shift(id),
  updated_at = now()
WHERE role = 'courier' 
  AND is_online = true;

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 20260603052300 completed successfully';
  RAISE NOTICE 'Created function: is_courier_out_of_shift(UUID)';
  RAISE NOTICE 'Updated trigger: handle_courier_queue_sync() to use proper out_of_shift logic';
  RAISE NOTICE 'Backfilled out_of_shift for all online couriers';
  RAISE NOTICE 'Logic: out_of_shift=true if: 1) No shift, 2) Shift inactive, 3) Outside shift time window';
  RAISE NOTICE 'Timezone: Uses operational_timezone from settings (Asia/Makassar)';
END $$;
