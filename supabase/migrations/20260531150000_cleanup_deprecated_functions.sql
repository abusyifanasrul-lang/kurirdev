-- Migration: Cleanup Deprecated Functions and Fix update_late_minutes
-- Date: 2026-05-31
-- Description: Remove deprecated functions and create new update_late_minutes function

-- ============================================================================
-- Drop Deprecated Functions
-- ============================================================================

-- These functions are no longer used and have been replaced by new implementations
DROP FUNCTION IF EXISTS public.invoke_process_auto_shift_end();
DROP FUNCTION IF EXISTS public.invoke_process_shift_attendance();
DROP FUNCTION IF EXISTS public.process_shift_end_alpha_detection();
DROP FUNCTION IF EXISTS public.process_shift_alpha();
DROP FUNCTION IF EXISTS public.check_alpha_attendance();

-- ============================================================================
-- Create update_late_minutes Function
-- Purpose: Update late_minutes in real-time for late couriers
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_late_minutes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_operational_tz TEXT;
  v_current_time TIMESTAMPTZ;
  v_current_date DATE;
  v_attendance RECORD;
  v_shift_start_time TIMESTAMPTZ;
  v_late_minutes INTEGER;
BEGIN
  -- Get operational timezone
  SELECT operational_timezone INTO v_operational_tz FROM settings LIMIT 1;
  IF v_operational_tz IS NULL THEN v_operational_tz := 'Asia/Makassar'; END IF;
  
  -- Get current time
  v_current_time := now();
  v_current_date := (v_current_time AT TIME ZONE v_operational_tz)::DATE;
  
  -- Update late_minutes for all late records today that haven't checked in yet
  FOR v_attendance IN
    SELECT 
      sa.id,
      sa.courier_id,
      sa.shift_id,
      sa.date,
      s.start_time,
      s.is_overnight
    FROM shift_attendance sa
    JOIN shifts s ON s.id = sa.shift_id
    WHERE sa.date = v_current_date
      AND sa.status = 'late'
      AND sa.first_online_at IS NULL  -- Haven't checked in yet
  LOOP
    -- Calculate shift start time as TIMESTAMPTZ
    v_shift_start_time := (v_attendance.date::TEXT || ' ' || v_attendance.start_time::TEXT)::TIMESTAMP AT TIME ZONE v_operational_tz;
    
    -- Calculate late minutes (current time - shift start time)
    v_late_minutes := EXTRACT(EPOCH FROM (v_current_time - v_shift_start_time)) / 60;
    
    -- Only update if late_minutes is positive (shift has started)
    IF v_late_minutes > 0 THEN
      UPDATE shift_attendance
      SET late_minutes = v_late_minutes::INTEGER
      WHERE id = v_attendance.id;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.update_late_minutes IS 
  'Updates late_minutes in real-time for all late couriers who have not checked in yet';

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 20260531150000 completed successfully';
  RAISE NOTICE 'Dropped 5 deprecated functions';
  RAISE NOTICE 'Created function: update_late_minutes()';
  RAISE NOTICE 'Cleanup complete';
END $$;
