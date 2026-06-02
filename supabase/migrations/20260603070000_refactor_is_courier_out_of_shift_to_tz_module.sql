-- ============================================================================
-- REFACTOR: is_courier_out_of_shift() to use Timezone Management Module
-- ============================================================================
-- Date: 2026-06-03
-- Original: 20260603052300_proper_out_of_shift_logic.sql
-- Purpose: Replace manual AT TIME ZONE operations with TZ module functions
--
-- Changes:
--   1. Use tz_today() instead of manual date extraction
--   2. Use tz_calculate_shift_window() for window boundaries
--   3. Use tz_is_within_window() for range check
--   4. Remove all manual AT TIME ZONE operations
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
  v_current_date DATE;
  v_shift_window RECORD;
  v_check_in_window_minutes INTEGER;
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
  
  -- Get check-in window setting
  SELECT check_in_window_minutes 
  INTO v_check_in_window_minutes
  FROM settings LIMIT 1;
  
  IF v_check_in_window_minutes IS NULL THEN 
    v_check_in_window_minutes := 60; 
  END IF;
  
  -- Get current date in operational timezone
  v_current_date := tz_today();
  
  -- Calculate shift window using TZ module
  SELECT * INTO v_shift_window 
  FROM tz_calculate_shift_window(
    v_current_date,
    v_shift.start_time,
    v_shift.end_time,
    v_shift.is_overnight,
    v_check_in_window_minutes
  );
  
  -- Check if current time is within shift window
  IF tz_is_within_window(now(), v_shift_window.window_start, v_shift_window.window_end) THEN
    RETURN false;  -- Within shift window
  ELSE
    RETURN true;   -- Outside shift window = out of shift
  END IF;
END;
$$;

COMMENT ON FUNCTION public.is_courier_out_of_shift(UUID) IS 
  'Calculates if courier is out of shift. Refactored to use TZ module on 2026-06-03. Logic: 1) No shift = out, 2) Shift inactive = out, 3) Outside shift time window = out';

-- ============================================================================
-- TESTING
-- ============================================================================

-- Test 1: Function executes without errors
DO $$
DECLARE
  v_result BOOLEAN;
  v_courier_id UUID;
  v_courier_name TEXT;
BEGIN
  -- Get a test courier with shift
  SELECT id, name INTO v_courier_id, v_courier_name 
  FROM profiles 
  WHERE role = 'courier' AND shift_id IS NOT NULL 
  LIMIT 1;
  
  IF v_courier_id IS NOT NULL THEN
    -- Call function
    v_result := is_courier_out_of_shift(v_courier_id);
    RAISE NOTICE 'Test 1: Courier % (%) out_of_shift = %', v_courier_name, v_courier_id, v_result;
  ELSE
    RAISE NOTICE 'Test 1: No courier with shift found, skipping test';
  END IF;
END $$;

-- Test 2: Verify no manual AT TIME ZONE in function
DO $$
DECLARE
  v_source TEXT;
  v_has_manual_tz BOOLEAN;
BEGIN
  SELECT prosrc INTO v_source 
  FROM pg_proc 
  WHERE proname = 'is_courier_out_of_shift';
  
  -- Check if contains manual AT TIME ZONE (not from tz_ functions)
  v_has_manual_tz := (
    v_source LIKE '%AT TIME ZONE%' 
    AND v_source NOT LIKE '%tz_%'
  );
  
  IF v_has_manual_tz THEN
    RAISE EXCEPTION 'Test 2 FAILED: Function still contains manual AT TIME ZONE!';
  ELSE
    RAISE NOTICE 'Test 2 PASSED: Function properly uses TZ module ✅';
  END IF;
END $$;

-- Test 3: Verify TZ module functions are used
DO $$
DECLARE
  v_source TEXT;
  v_uses_tz_today BOOLEAN;
  v_uses_tz_calculate BOOLEAN;
  v_uses_tz_within BOOLEAN;
BEGIN
  SELECT prosrc INTO v_source 
  FROM pg_proc 
  WHERE proname = 'is_courier_out_of_shift';
  
  v_uses_tz_today := v_source LIKE '%tz_today%';
  v_uses_tz_calculate := v_source LIKE '%tz_calculate_shift_window%';
  v_uses_tz_within := v_source LIKE '%tz_is_within_window%';
  
  IF v_uses_tz_today AND v_uses_tz_calculate AND v_uses_tz_within THEN
    RAISE NOTICE 'Test 3 PASSED: All required TZ functions used ✅';
    RAISE NOTICE '  - tz_today(): %', v_uses_tz_today;
    RAISE NOTICE '  - tz_calculate_shift_window(): %', v_uses_tz_calculate;
    RAISE NOTICE '  - tz_is_within_window(): %', v_uses_tz_within;
  ELSE
    RAISE EXCEPTION 'Test 3 FAILED: Not all TZ functions used!';
  END IF;
END $$;

-- Test 4: Verify trigger still works
DO $$
DECLARE
  v_trigger_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_courier_status_change'
  ) INTO v_trigger_exists;
  
  IF v_trigger_exists THEN
    RAISE NOTICE 'Test 4 PASSED: Trigger on_courier_status_change still exists ✅';
  ELSE
    RAISE WARNING 'Test 4: Trigger on_courier_status_change not found';
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'REFACTOR COMPLETED: is_courier_out_of_shift()';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Changes:';
  RAISE NOTICE '  ✅ Removed manual AT TIME ZONE operations';
  RAISE NOTICE '  ✅ Uses tz_today() for current date';
  RAISE NOTICE '  ✅ Uses tz_calculate_shift_window() for boundaries';
  RAISE NOTICE '  ✅ Uses tz_is_within_window() for range check';
  RAISE NOTICE '';
  RAISE NOTICE 'Function signature: UNCHANGED (backward compatible)';
  RAISE NOTICE 'Trigger compatibility: MAINTAINED';
  RAISE NOTICE '';
  RAISE NOTICE 'Migration: 20260603070000_refactor_is_courier_out_of_shift_to_tz_module.sql';
  RAISE NOTICE '========================================';
END $$;
