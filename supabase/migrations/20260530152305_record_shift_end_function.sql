-- Migration: Attendance System Overhaul - record_shift_end Function
-- Date: 2026-05-30
-- Description: Create record_shift_end() RPC for couriers to record shift end
-- Task: Wave 2 - Task 9
-- Requirement: 13 (Shift End Recording)

-- ============================================================================
-- Function: record_shift_end
-- Purpose: Record when courier finishes shift with duration calculation
-- Features: Duration status (normal, early_finish, overtime)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_shift_end(
  p_courier_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_attendance RECORD;
  v_shift RECORD;
  v_current_time TIMESTAMPTZ;
  v_operational_tz TEXT;
  v_shift_duration INTEGER;
  v_scheduled_duration INTEGER;
  v_duration_status TEXT;
BEGIN
  -- Get operational timezone
  SELECT operational_timezone INTO v_operational_tz FROM settings LIMIT 1;
  IF v_operational_tz IS NULL THEN v_operational_tz := 'Asia/Makassar'; END IF;
  
  v_current_time := now() AT TIME ZONE v_operational_tz;
  
  -- Get today's attendance
  SELECT sa.*, s.start_time, s.end_time, s.is_overnight
  INTO v_attendance
  FROM shift_attendance sa
  JOIN shifts s ON s.id = sa.shift_id
  WHERE sa.courier_id = p_courier_id
    AND sa.date = (v_current_time AT TIME ZONE v_operational_tz)::DATE
  ORDER BY sa.created_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'no_attendance_record',
      'message', 'Tidak ada record attendance hari ini'
    );
  END IF;
  
  IF v_attendance.first_online_at IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'not_checked_in',
      'message', 'Anda belum check-in hari ini'
    );
  END IF;
  
  -- Calculate shift duration
  v_shift_duration := EXTRACT(EPOCH FROM (v_current_time - v_attendance.first_online_at)) / 60;
  
  -- Calculate scheduled duration
  IF v_attendance.is_overnight THEN
    v_scheduled_duration := EXTRACT(EPOCH FROM (
      ((v_attendance.date + 1) || ' ' || v_attendance.end_time)::TIMESTAMPTZ -
      (v_attendance.date || ' ' || v_attendance.start_time)::TIMESTAMPTZ
    )) / 60;
  ELSE
    v_scheduled_duration := EXTRACT(EPOCH FROM (
      (v_attendance.date || ' ' || v_attendance.end_time)::TIMESTAMPTZ -
      (v_attendance.date || ' ' || v_attendance.start_time)::TIMESTAMPTZ
    )) / 60;
  END IF;
  
  -- Determine duration status
  IF v_shift_duration < (v_scheduled_duration * 0.8) THEN
    v_duration_status := 'early_finish';
  ELSIF v_shift_duration > (v_scheduled_duration * 1.2) THEN
    v_duration_status := 'overtime';
  ELSE
    v_duration_status := 'normal';
  END IF;
  
  -- Update attendance record
  UPDATE shift_attendance
  SET 
    last_online_at = v_current_time,
    shift_duration = v_shift_duration,
    duration_status = v_duration_status,
    updated_at = now()
  WHERE id = v_attendance.id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Shift end recorded successfully',
    'shift_duration', v_shift_duration,
    'duration_status', v_duration_status,
    'scheduled_duration', v_scheduled_duration
  );
END;
$$;

COMMENT ON FUNCTION public.record_shift_end IS 
  'Records courier shift end time with duration calculation';

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 20260530152305 completed successfully';
  RAISE NOTICE 'Created function: record_shift_end()';
  RAISE NOTICE 'Task 9 (Shift End Recording) - COMPLETE';
END $$;
