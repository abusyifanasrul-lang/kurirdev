-- Fix cron job timezone conversion
-- Bug: Cron jobs scheduled using Makassar time directly, causing 8-hour delay
-- Fix: Convert Makassar time to UTC time for pg_cron scheduling

-- ============================================================================
-- Fix: Update sync_shift_cron_jobs to convert shift time to UTC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_shift_cron_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_shift RECORD;
  v_operational_tz TEXT;
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
  v_temp_timestamp TIMESTAMPTZ;
BEGIN
  -- Get operational timezone
  SELECT operational_timezone INTO v_operational_tz FROM settings LIMIT 1;
  IF v_operational_tz IS NULL THEN
    v_operational_tz := 'Asia/Makassar';
  END IF;

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
    
    -- Convert Makassar time to UTC time for pg_cron scheduling
    -- pg_cron uses UTC timezone, so we need to convert shift times
    
    -- Convert start_time: create a timestamp in operational timezone, then extract UTC time
    v_temp_timestamp := (CURRENT_DATE || ' ' || v_start_time_local)::TIMESTAMP AT TIME ZONE v_operational_tz;
    v_start_time_utc := v_temp_timestamp::TIME;
    
    -- Convert end_time
    v_temp_timestamp := (CURRENT_DATE || ' ' || v_end_time_local)::TIMESTAMP AT TIME ZONE v_operational_tz;
    v_end_time_utc := v_temp_timestamp::TIME;
    
    -- Convert reminder times
    v_temp_timestamp := (CURRENT_DATE || ' ' || v_reminder_60_time)::TIMESTAMP AT TIME ZONE v_operational_tz;
    v_reminder_60_utc := v_temp_timestamp::TIME;
    
    v_temp_timestamp := (CURRENT_DATE || ' ' || v_reminder_30_time)::TIMESTAMP AT TIME ZONE v_operational_tz;
    v_reminder_30_utc := v_temp_timestamp::TIME;
    
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
  
  RAISE NOTICE 'Synchronized cron jobs for all shifts with UTC timezone conversion';
END;
$$;

-- ============================================================================
-- Re-sync all cron jobs with correct UTC times
-- ============================================================================

SELECT sync_shift_cron_jobs();

-- ============================================================================
-- Verification queries (commented out - for manual testing)
-- ============================================================================

-- Test 1: Check pg_cron jobs
-- SELECT jobid, jobname, schedule, command 
-- FROM cron.job 
-- WHERE jobname LIKE 'shift-%'
-- ORDER BY jobname;

-- Test 2: Check shift coba222 schedule
-- SELECT 
--   s.name,
--   s.start_time as makassar_start,
--   s.end_time as makassar_end,
--   cj.schedule as cron_schedule,
--   cj.jobname
-- FROM cron.job cj
-- JOIN shifts s ON cj.jobname LIKE 'shift-' || s.id || '-%'
-- WHERE s.name = 'coba222';

-- Test 3: Verify timezone conversion
-- For shift at 20:00 Makassar (UTC+8), cron should be scheduled at 12:00 UTC
-- SELECT 
--   ('2026-06-02 20:00:00'::TIMESTAMP AT TIME ZONE 'Asia/Makassar')::TIME as utc_time;
-- Expected result: 12:00:00
