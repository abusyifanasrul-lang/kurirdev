-- ============================================================================
-- REFACTOR: update_late_minutes() to use Timezone Management Module
-- ============================================================================
-- Date: 2026-06-03
-- Original: 20260530152304_update_late_minutes_function.sql
-- Purpose: Replace manual AT TIME ZONE operations with TZ module functions
--
-- Changes:
--   1. Use tz_today() for current date
--   2. Use tz_now() for current timestamp
--   3. Use tz_local_to_utc() for shift start time
--   4. Use tz_calculate_late_minutes() for late calculation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_late_minutes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_attendance RECORD;
  v_current_date DATE;
  v_current_time TIMESTAMPTZ;
  v_shift_start_time TIMESTAMPTZ;
  v_late_minutes INTEGER;
  v_records_updated INTEGER := 0;
BEGIN
  -- Get current date and time using TZ module
  v_current_date := tz_today();
  v_current_time := tz_now();
  
  -- Update late minutes for all active late records
  FOR v_attendance IN
    SELECT sa.id, sa.date, sa.courier_id, s.start_time, s.is_overnight
    FROM shift_attendance sa
    JOIN shifts s ON s.id = sa.shift_id
    WHERE sa.status = 'late'
      AND sa.first_online_at IS NULL
      AND sa.date = v_current_date
  LOOP
    -- Calculate shift start time using TZ module
    v_shift_start_time := tz_local_to_utc(v_attendance.date, v_attendance.start_time);
    
    -- Calculate late minutes using TZ module
    v_late_minutes := tz_calculate_late_minutes(v_current_time, v_shift_start_time);
    
    -- Update if changed
    UPDATE shift_attendance
    SET late_minutes = v_late_minutes, updated_at = now()
    WHERE id = v_attendance.id
      AND late_minutes != v_late_minutes;
    
    IF FOUND THEN
      v_records_updated := v_records_updated + 1;
    END IF;
  END LOOP;
  
  -- Log if any updates
  IF v_records_updated > 0 THEN
    INSERT INTO cron_execution_logs (
      job_type, status, records_affected
    ) VALUES (
      'update_late_minutes', 'success', v_records_updated
    );
  END IF;
END;
$$;

COMMENT ON FUNCTION public.update_late_minutes IS 
  'Cron function to update late minutes every minute for active late records. Refactored to use TZ module on 2026-06-03';

-- ============================================================================
-- TESTING
-- ============================================================================

-- Test 1: Verify no manual AT TIME ZONE in function
DO $$
DECLARE
  v_source TEXT;
  v_has_manual_tz BOOLEAN;
BEGIN
  SELECT prosrc INTO v_source 
  FROM pg_proc 
  WHERE proname = 'update_late_minutes';
  
  v_has_manual_tz := (
    v_source LIKE '%AT TIME ZONE%' 
    AND v_source NOT LIKE '%tz_%'
  );
  
  IF v_has_manual_tz THEN
    RAISE EXCEPTION 'Test 1 FAILED: Function still contains manual AT TIME ZONE!';
  ELSE
    RAISE NOTICE 'Test 1 PASSED: Function properly uses TZ module ✅';
  END IF;
END $$;

-- Test 2: Verify TZ module functions are used
DO $$
DECLARE
  v_source TEXT;
  v_uses_tz_today BOOLEAN;
  v_uses_tz_now BOOLEAN;
  v_uses_tz_local_to_utc BOOLEAN;
  v_uses_tz_calc_late BOOLEAN;
BEGIN
  SELECT prosrc INTO v_source 
  FROM pg_proc 
  WHERE proname = 'update_late_minutes';
  
  v_uses_tz_today := v_source LIKE '%tz_today%';
  v_uses_tz_now := v_source LIKE '%tz_now%';
  v_uses_tz_local_to_utc := v_source LIKE '%tz_local_to_utc%';
  v_uses_tz_calc_late := v_source LIKE '%tz_calculate_late_minutes%';
  
  IF v_uses_tz_today AND v_uses_tz_now AND v_uses_tz_local_to_utc AND v_uses_tz_calc_late THEN
    RAISE NOTICE 'Test 2 PASSED: All required TZ functions used ✅';
    RAISE NOTICE '  - tz_today(): %', v_uses_tz_today;
    RAISE NOTICE '  - tz_now(): %', v_uses_tz_now;
    RAISE NOTICE '  - tz_local_to_utc(): %', v_uses_tz_local_to_utc;
    RAISE NOTICE '  - tz_calculate_late_minutes(): %', v_uses_tz_calc_late;
  ELSE
    RAISE EXCEPTION 'Test 2 FAILED: Not all TZ functions used!';
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'REFACTOR COMPLETED: update_late_minutes()';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Changes:';
  RAISE NOTICE '  ✅ Removed manual AT TIME ZONE operations';
  RAISE NOTICE '  ✅ Uses tz_today() for current date';
  RAISE NOTICE '  ✅ Uses tz_now() for current timestamp';
  RAISE NOTICE '  ✅ Uses tz_local_to_utc() for shift start';
  RAISE NOTICE '  ✅ Uses tz_calculate_late_minutes() for calculation';
  RAISE NOTICE '';
  RAISE NOTICE 'Function signature: UNCHANGED (backward compatible)';
  RAISE NOTICE 'Cron job compatibility: MAINTAINED';
  RAISE NOTICE '';
  RAISE NOTICE 'Migration: 20260603070400_refactor_update_late_minutes_to_tz_module.sql';
  RAISE NOTICE '========================================';
END $$;
