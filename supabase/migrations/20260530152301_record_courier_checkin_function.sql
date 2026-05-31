-- Migration: Attendance System Overhaul - record_courier_checkin Function
-- Date: 2026-05-30
-- Description: Create record_courier_checkin() RPC with shift window validation
-- Task: Wave 2 - Task 5
-- Requirement: 2 (Check-In Time Window Validation), 11 (Overnight Shift Support)

-- ============================================================================
-- Function: record_courier_checkin
-- Purpose: Validate and record courier check-in with shift window enforcement
-- Features: 1-hour window, duplicate prevention, overnight shift support
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_courier_checkin(
  p_courier_id UUID
)
RETURNS JSONB
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
  v_existing_attendance RECORD;
  v_is_holiday BOOLEAN;
BEGIN
  -- Get settings
  SELECT operational_timezone, check_in_window_minutes 
  INTO v_operational_tz, v_check_in_window_minutes
  FROM settings LIMIT 1;
  
  IF v_operational_tz IS NULL THEN v_operational_tz := 'Asia/Makassar'; END IF;
  IF v_check_in_window_minutes IS NULL THEN v_check_in_window_minutes := 60; END IF;
  
  -- Get current time in operational timezone
  v_current_time := now() AT TIME ZONE v_operational_tz;
  v_current_date := (v_current_time AT TIME ZONE v_operational_tz)::DATE;
  
  -- Check if today is a holiday
  SELECT EXISTS (
    SELECT 1 FROM holidays 
    WHERE date = v_current_date AND is_active = true
  ) INTO v_is_holiday;
  
  IF v_is_holiday THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'holiday',
      'message', 'Hari ini adalah hari libur'
    );
  END IF;
  
  -- Get courier's shift (check for override first)
  SELECT s.* INTO v_shift
  FROM shifts s
  LEFT JOIN shift_overrides so ON so.date = v_current_date 
    AND so.replacement_courier_id = p_courier_id
  LEFT JOIN profiles p ON p.id = p_courier_id
  WHERE s.id = COALESCE(so.original_shift_id, p.shift_id)
    AND s.is_active = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'no_shift_assigned',
      'message', 'Anda tidak memiliki shift yang aktif'
    );
  END IF;
  
  -- Check if already checked in today
  SELECT * INTO v_existing_attendance
  FROM shift_attendance
  WHERE courier_id = p_courier_id 
    AND date = v_current_date
    AND shift_id = v_shift.id;
  
  IF FOUND AND v_existing_attendance.first_online_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'already_checked_in',
      'message', 'Anda sudah check-in hari ini',
      'checked_in_at', v_existing_attendance.first_online_at
    );
  END IF;

  -- Calculate shift window
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
  
  -- Validate check-in window
  IF v_current_time < v_shift_window_start OR v_current_time > v_shift_window_end THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'outside_shift_window',
      'message', 'Check-in hanya diperbolehkan 1 jam sebelum shift dimulai hingga shift berakhir',
      'shift_window_start', v_shift_window_start,
      'shift_window_end', v_shift_window_end,
      'current_time', v_current_time
    );
  END IF;
  
  -- Create or update shift_attendance
  IF v_existing_attendance.id IS NOT NULL THEN
    -- Update existing late record
    UPDATE shift_attendance
    SET 
      first_online_at = v_current_time,
      status = 'on_time',
      late_minutes = 0,
      updated_at = now()
    WHERE id = v_existing_attendance.id;
  ELSE
    -- Create new attendance record
    INSERT INTO shift_attendance (
      courier_id, shift_id, date, 
      first_online_at, status, late_minutes
    ) VALUES (
      p_courier_id, v_shift.id, v_current_date,
      v_current_time, 'on_time', 0
    );
  END IF;
  
  -- Update courier status to 'on'
  UPDATE profiles
  SET courier_status = 'on', updated_at = now()
  WHERE id = p_courier_id;
  
  -- Reset late_fine_active if was active
  UPDATE profiles
  SET late_fine_active = false
  WHERE id = p_courier_id AND late_fine_active = true;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Check-in berhasil',
    'checked_in_at', v_current_time,
    'shift_name', v_shift.name
  );
END;
$$;

COMMENT ON FUNCTION public.record_courier_checkin IS 
  'Records courier check-in with shift window validation (1 hour before to shift end)';

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 20260530152301 completed successfully';
  RAISE NOTICE 'Created function: record_courier_checkin()';
  RAISE NOTICE 'Task 5 (Check-in Validation) - COMPLETE';
END $$;
