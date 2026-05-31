-- Migration: Attendance System Overhaul - update_late_minutes Function
-- Date: 2026-05-30
-- Description: Create update_late_minutes() cron function for real-time tracking
-- Task: Wave 2 - Task 8
-- Requirement: 9 (Late Minutes Update Cron Job)

-- ============================================================================
-- Function: update_late_minutes
-- Purpose: Update late minutes in real-time every minute
-- Features: Calculates elapsed time since shift start for all active late records
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_late_minutes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_attendance RECORD;
  v_current_time TIMESTAMPTZ;
  v_operational_tz TEXT;
  v_shift_start_time TIMESTAMPTZ;
  v_late_minutes INTEGER;
  v_records_updated INTEGER := 0;
BEGIN
  -- Get operational timezone
  SELECT operational_timezone INTO v_operational_tz FROM settings LIMIT 1;
  IF v_operational_tz IS NULL THEN v_operational_tz := 'Asia/Makassar'; END IF;
  
  v_current_time := now() AT TIME ZONE v_operational_tz;
  
  -- Update late minutes for all active late records
  FOR v_attendance IN
    SELECT sa.id, sa.date, sa.courier_id, s.start_time, s.is_overnight
    FROM shift_attendance sa
    JOIN shifts s ON s.id = sa.shift_id
    WHERE sa.status = 'late'
      AND sa.first_online_at IS NULL
      AND sa.date = (v_current_time AT TIME ZONE v_operational_tz)::DATE
  LOOP
    -- Calculate shift start time
    v_shift_start_time := (v_attendance.date || ' ' || v_attendance.start_time)::TIMESTAMPTZ 
      AT TIME ZONE v_operational_tz;
    
    -- Calculate late minutes
    v_late_minutes := EXTRACT(EPOCH FROM (v_current_time - v_shift_start_time)) / 60;
    
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
  'Cron function to update late minutes every minute for active late records';

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 20260530152304 completed successfully';
  RAISE NOTICE 'Created function: update_late_minutes()';
  RAISE NOTICE 'Task 8 (Real-time Late Tracking) - COMPLETE';
END $$;
