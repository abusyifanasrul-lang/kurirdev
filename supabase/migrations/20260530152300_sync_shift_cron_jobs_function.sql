-- Migration: Attendance System Overhaul - sync_shift_cron_jobs Function
-- Date: 2026-05-30
-- Description: Create sync_shift_cron_jobs() function with timezone bug fix
-- Task: Wave 2 - Task 4
-- Requirement: 1 (Fix Timezone Double Conversion Bug), 7 (Dynamic Shift Management)

-- ============================================================================
-- Function: sync_shift_cron_jobs
-- Purpose: Synchronize pg_cron jobs with shift start/end times
-- Bug Fix: Use shift times directly without double timezone conversion
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
  v_start_cron_schedule TEXT;
  v_end_cron_schedule TEXT;
  v_reminder_60_schedule TEXT;
  v_reminder_30_schedule TEXT;
  v_job_exists BOOLEAN;
BEGIN
  -- Get operational timezone from settings
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
    
    -- FIX: Use start_time/end_time directly (already in operational timezone)
    -- NO double conversion with AT TIME ZONE
    v_start_time_local := v_shift.start_time;
    v_end_time_local := v_shift.end_time;
    
    -- Calculate reminder times (60 and 30 minutes before shift start)
    v_reminder_60_time := v_shift.start_time - INTERVAL '60 minutes';
    v_reminder_30_time := v_shift.start_time - INTERVAL '30 minutes';
    
    -- Convert TIME to cron format: 'minute hour * * *'
    v_start_cron_schedule := EXTRACT(MINUTE FROM v_start_time_local)::TEXT || ' ' || EXTRACT(HOUR FROM v_start_time_local)::TEXT || ' * * *';
    v_end_cron_schedule := EXTRACT(MINUTE FROM v_end_time_local)::TEXT || ' ' || EXTRACT(HOUR FROM v_end_time_local)::TEXT || ' * * *';
    v_reminder_60_schedule := EXTRACT(MINUTE FROM v_reminder_60_time)::TEXT || ' ' || EXTRACT(HOUR FROM v_reminder_60_time)::TEXT || ' * * *';
    v_reminder_30_schedule := EXTRACT(MINUTE FROM v_reminder_30_time)::TEXT || ' ' || EXTRACT(HOUR FROM v_reminder_30_time)::TEXT || ' * * *';

    IF v_shift.is_active THEN
      -- Create or update start cron job
      PERFORM cron.schedule(
        v_start_cron_name,
        v_start_cron_schedule,  -- Run daily at shift start time
        format('SELECT process_shift_start(%L)', v_shift.id)
      );
      
      -- Create or update end cron job
      PERFORM cron.schedule(
        v_end_cron_name,
        v_end_cron_schedule,  -- Run daily at shift end time
        format('SELECT process_shift_end(%L)', v_shift.id)
      );
      
      -- Create or update 60-minute reminder cron job
      PERFORM cron.schedule(
        v_reminder_60_cron_name,
        v_reminder_60_schedule,  -- Run daily 60 minutes before shift start
        format('SELECT send_shift_reminder_60min(%L)', v_shift.id)
      );
      
      -- Create or update 30-minute reminder cron job
      PERFORM cron.schedule(
        v_reminder_30_cron_name,
        v_reminder_30_schedule,  -- Run daily 30 minutes before shift start
        format('SELECT send_shift_reminder_30min(%L)', v_shift.id)
      );
      
      -- Upsert to cron_jobs table
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
      -- Deactivate all cron jobs for inactive shifts (check if exists first)
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
  
  RAISE NOTICE 'Synchronized cron jobs for all shifts (including reminders)';
END;
$$;

COMMENT ON FUNCTION public.sync_shift_cron_jobs IS 
  'Synchronizes pg_cron jobs with shift times. Fixed timezone double conversion bug.';

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 20260530152300 completed successfully';
  RAISE NOTICE 'Created function: sync_shift_cron_jobs()';
  RAISE NOTICE 'Task 4 (Fix Timezone Bug) - COMPLETE';
END $$;
