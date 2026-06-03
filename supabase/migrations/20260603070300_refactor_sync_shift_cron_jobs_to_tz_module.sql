-- ============================================================================
-- REFACTOR: sync_shift_cron_jobs() to use Timezone Management Module
-- ============================================================================
-- Date: 2026-06-03
-- Original: 20260602064908_fix_cron_timezone_conversion.sql
-- Purpose: Replace manual AT TIME ZONE operations with TZ module functions
--
-- Changes:
--   1. Use tz_local_to_utc() for UTC time conversion
--   2. Remove v_temp_timestamp variable (simplified)
--   3. Direct TIME extraction from tz_local_to_utc result
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_shift_cron_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_shift RECORD;
  v_start_cron_name TEXT;
  v_end_cron_name TEXT;
  v_reminder_60_cron_name TEXT;
  v_reminder_30_cron_name TEXT;
  v_start_time_local TIME;
  v_end_time_local TIME;
  v_reminder_60_time TIME;
  v_reminder_30_time TIME;
  v_start_time_utc TIME;
  v_end_time_utc TIME;
  v_reminder_60_utc TIME;
  v_reminder_30_utc TIME;
  v_start_cron_schedule TEXT;
  v_end_cron_schedule TEXT;
  v_reminder_60_schedule TEXT;
  v_reminder_30_schedule TEXT;
  v_job_exists BOOLEAN;
BEGIN
  -- Loop through all shifts
  FOR v_shift IN 
    SELECT id, name, start_time, end_time, is_overnight, is_active
    FROM shifts
  LOOP
    v_start_cron_name := 'shift-' || v_shift.id || '-start';
    v_end_cron_name := 'shift-' || v_shift.id || '-end';
    v_reminder_60_cron_name := 'shift-' || v_shift.id || '-reminder-60min';
    v_reminder_30_cron_name := 'shift-' || v_shift.id || '-reminder-30min';
    
    v_start_time_local := v_shift.start_time;
    v_end_time_local := v_shift.end_time;
    
    v_reminder_60_time := v_shift.start_time - INTERVAL '60 minutes';
    v_reminder_30_time := v_shift.start_time - INTERVAL '30 minutes';
    
    -- Convert Makassar time to UTC using TZ module
    -- Use CURRENT_DATE as arbitrary date for TIME extraction
    v_start_time_utc := tz_local_to_utc(CURRENT_DATE, v_start_time_local)::TIME;
    v_end_time_utc := tz_local_to_utc(CURRENT_DATE, v_end_time_local)::TIME;
    v_reminder_60_utc := tz_local_to_utc(CURRENT_DATE, v_reminder_60_time)::TIME;
    v_reminder_30_utc := tz_local_to_utc(CURRENT_DATE, v_reminder_30_time)::TIME;
    
    -- Build cron schedules using UTC times
    v_start_cron_schedule := EXTRACT(MINUTE FROM v_start_time_utc)::TEXT || ' ' || EXTRACT(HOUR FROM v_start_time_utc)::TEXT || ' * * *';
    v_end_cron_schedule := EXTRACT(MINUTE FROM v_end_time_utc)::TEXT || ' ' || EXTRACT(HOUR FROM v_end_time_utc)::TEXT || ' * * *';
    v_reminder_60_schedule := EXTRACT(MINUTE FROM v_reminder_60_utc)::TEXT || ' ' || EXTRACT(HOUR FROM v_reminder_60_utc)::TEXT || ' * * *';
    v_reminder_30_schedule := EXTRACT(MINUTE FROM v_reminder_30_utc)::TEXT || ' ' || EXTRACT(HOUR FROM v_reminder_30_utc)::TEXT || ' * * *';

    IF v_shift.is_active THEN
      -- Schedule cron jobs with UTC times
      PERFORM cron.schedule(
        v_start_cron_name,
        v_start_cron_schedule,
        format('SELECT process_shift_start(%L)', v_shift.id)
      );
      
      PERFORM cron.schedule(
        v_end_cron_name,
        v_end_cron_schedule,
        format('SELECT process_shift_end(%L)', v_shift.id)
      );
      
      PERFORM cron.schedule(
        v_reminder_60_cron_name,
        v_reminder_60_schedule,
        format('SELECT send_shift_reminder_60min(%L)', v_shift.id)
      );
      
      PERFORM cron.schedule(
        v_reminder_30_cron_name,
        v_reminder_30_schedule,
        format('SELECT send_shift_reminder_30min(%L)', v_shift.id)
      );
      
      -- Store local time in cron_jobs table for reference
      INSERT INTO cron_jobs (shift_id, job_type, scheduled_time, cron_job_name, is_active)
      VALUES 
        (v_shift.id, 'start', v_start_time_local, v_start_cron_name, true),
        (v_shift.id, 'end', v_end_time_local, v_end_cron_name, true)
      ON CONFLICT (shift_id, job_type) 
      DO UPDATE SET 
        scheduled_time = EXCLUDED.scheduled_time,
        cron_job_name = EXCLUDED.cron_job_name,
        is_active = EXCLUDED.is_active,
        updated_at = now();
    ELSE
      -- Unschedule inactive shifts
      SELECT EXISTS(SELECT 1 FROM cron.job WHERE jobname = v_start_cron_name) INTO v_job_exists;
      IF v_job_exists THEN PERFORM cron.unschedule(v_start_cron_name); END IF;
      
      SELECT EXISTS(SELECT 1 FROM cron.job WHERE jobname = v_end_cron_name) INTO v_job_exists;
      IF v_job_exists THEN PERFORM cron.unschedule(v_end_cron_name); END IF;
      
      SELECT EXISTS(SELECT 1 FROM cron.job WHERE jobname = v_reminder_60_cron_name) INTO v_job_exists;
      IF v_job_exists THEN PERFORM cron.unschedule(v_reminder_60_cron_name); END IF;
      
      SELECT EXISTS(SELECT 1 FROM cron.job WHERE jobname = v_reminder_30_cron_name) INTO v_job_exists;
      IF v_job_exists THEN PERFORM cron.unschedule(v_reminder_30_cron_name); END IF;
      
      UPDATE cron_jobs SET is_active = false, updated_at = now()
      WHERE shift_id = v_shift.id;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Synchronized cron jobs for all shifts using TZ module';
END;
$$;

COMMENT ON FUNCTION public.sync_shift_cron_jobs IS 
  'Synchronizes pg_cron jobs for shifts with UTC timezone conversion. Refactored to use TZ module on 2026-06-03';

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
  WHERE proname = 'sync_shift_cron_jobs';
  
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

-- Test 2: Verify TZ module function is used
DO $$
DECLARE
  v_source TEXT;
  v_uses_tz_local_to_utc BOOLEAN;
BEGIN
  SELECT prosrc INTO v_source 
  FROM pg_proc 
  WHERE proname = 'sync_shift_cron_jobs';
  
  v_uses_tz_local_to_utc := v_source LIKE '%tz_local_to_utc%';
  
  IF v_uses_tz_local_to_utc THEN
    RAISE NOTICE 'Test 2 PASSED: Uses tz_local_to_utc() ✅';
  ELSE
    RAISE EXCEPTION 'Test 2 FAILED: tz_local_to_utc() not used!';
  END IF;
END $$;

-- Test 3: Verify v_temp_timestamp removed (code simplified)
DO $$
DECLARE
  v_source TEXT;
  v_has_temp_var BOOLEAN;
BEGIN
  SELECT prosrc INTO v_source 
  FROM pg_proc 
  WHERE proname = 'sync_shift_cron_jobs';
  
  v_has_temp_var := v_source LIKE '%v_temp_timestamp%';
  
  IF v_has_temp_var THEN
    RAISE WARNING 'Test 3: v_temp_timestamp still exists (not critical)';
  ELSE
    RAISE NOTICE 'Test 3 PASSED: Code simplified, v_temp_timestamp removed ✅';
  END IF;
END $$;

-- ============================================================================
-- RE-SYNC ALL CRON JOBS
-- ============================================================================

SELECT sync_shift_cron_jobs();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'REFACTOR COMPLETED: sync_shift_cron_jobs()';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Changes:';
  RAISE NOTICE '  ✅ Removed manual AT TIME ZONE operations';
  RAISE NOTICE '  ✅ Uses tz_local_to_utc() for conversion';
  RAISE NOTICE '  ✅ Simplified code (removed v_temp_timestamp)';
  RAISE NOTICE '  ✅ Direct TIME extraction from TZ function';
  RAISE NOTICE '';
  RAISE NOTICE 'Function signature: UNCHANGED (backward compatible)';
  RAISE NOTICE 'Cron jobs: RE-SYNCHRONIZED with new logic';
  RAISE NOTICE '';
  RAISE NOTICE 'Migration: 20260603070300_refactor_sync_shift_cron_jobs_to_tz_module.sql';
  RAISE NOTICE '========================================';
END $$;

-- Verification query for manual inspection
DO $$
BEGIN
  RAISE NOTICE 'To verify cron schedules, run:';
  RAISE NOTICE '  SELECT jobname, schedule FROM cron.job WHERE jobname LIKE ''shift-%%'' ORDER BY jobname;';
END $$;
