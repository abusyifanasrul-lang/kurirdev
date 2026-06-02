-- Migration: Fix timezone calculation bug in record_courier_checkin
-- Date: 2026-06-03
-- Bug: Used ::TIMESTAMPTZ AT TIME ZONE which double-converts (string→UTC→TZ)
-- Fix: Use ::TIMESTAMP AT TIME ZONE which correctly interprets local time

CREATE OR REPLACE FUNCTION public.record_courier_checkin(
  p_courier_id UUID,
  p_skip_duplicate_check BOOLEAN DEFAULT FALSE
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
  v_current_date := v_current_time::DATE;
  
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
  
  -- Handle already checked-in case
  IF FOUND AND v_existing_attendance.first_online_at IS NOT NULL THEN
    IF p_skip_duplicate_check THEN
      -- Just set courier online without creating duplicate attendance record
      UPDATE profiles
      SET courier_status = 'on', 
          out_of_shift = false,
          updated_at = now()
      WHERE id = p_courier_id;
      
      RETURN jsonb_build_object(
        'success', true,
        'message', 'Status online diaktifkan',
        'already_checked_in', true,
        'checked_in_at', v_existing_attendance.first_online_at,
        'shift_name', v_shift.name,
        'mode', 'shift'
      );
    ELSE
      -- Original behavior: Reject duplicate check-in
      RETURN jsonb_build_object(
        'success', false,
        'error', 'already_checked_in',
        'message', 'Anda sudah check-in hari ini',
        'checked_in_at', v_existing_attendance.first_online_at
      );
    END IF;
  END IF;

  -- FIX: Calculate shift window with correct timezone handling
  -- Use ::TIMESTAMP (not ::TIMESTAMPTZ) before AT TIME ZONE to interpret as local time
  v_shift_window_start := (v_current_date || ' ' || v_shift.start_time)::TIMESTAMP 
    AT TIME ZONE v_operational_tz - (v_check_in_window_minutes || ' minutes')::INTERVAL;
  
  IF v_shift.is_overnight THEN
    -- For overnight shifts, end time is on next day
    v_shift_window_end := ((v_current_date + 1) || ' ' || v_shift.end_time)::TIMESTAMP 
      AT TIME ZONE v_operational_tz;
  ELSE
    v_shift_window_end := (v_current_date || ' ' || v_shift.end_time)::TIMESTAMP 
      AT TIME ZONE v_operational_tz;
  END IF;
  
  -- Validate check-in window (compare in UTC)
  IF now() < v_shift_window_start OR now() > v_shift_window_end THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'outside_shift_window',
      'message', 'Check-in hanya diperbolehkan 1 jam sebelum shift dimulai hingga shift berakhir',
      'shift_window_start', v_shift_window_start,
      'shift_window_end', v_shift_window_end,
      'current_time', now(),
      'can_go_online_private', true
    );
  END IF;
  
  -- Create or update shift_attendance
  IF v_existing_attendance.id IS NOT NULL THEN
    -- Update existing late record (created by cron at shift start)
    UPDATE shift_attendance
    SET 
      first_online_at = v_current_time,
      status = CASE 
        WHEN v_current_time <= (v_current_date || ' ' || v_shift.start_time)::TIMESTAMP AT TIME ZONE v_operational_tz
        THEN 'on_time'
        ELSE 'late'
      END,
      late_minutes = CASE
        WHEN v_current_time <= (v_current_date || ' ' || v_shift.start_time)::TIMESTAMP AT TIME ZONE v_operational_tz
        THEN 0
        ELSE EXTRACT(EPOCH FROM (v_current_time - (v_current_date || ' ' || v_shift.start_time)::TIMESTAMP AT TIME ZONE v_operational_tz)) / 60
      END,
      updated_at = now()
    WHERE id = v_existing_attendance.id;
  ELSE
    -- Create new attendance record
    INSERT INTO shift_attendance (
      courier_id, shift_id, date, 
      first_online_at, status, late_minutes
    ) VALUES (
      p_courier_id, v_shift.id, v_current_date,
      v_current_time, 
      CASE 
        WHEN v_current_time <= (v_current_date || ' ' || v_shift.start_time)::TIMESTAMP AT TIME ZONE v_operational_tz
        THEN 'on_time'
        ELSE 'late'
      END,
      CASE
        WHEN v_current_time <= (v_current_date || ' ' || v_shift.start_time)::TIMESTAMP AT TIME ZONE v_operational_tz
        THEN 0
        ELSE EXTRACT(EPOCH FROM (v_current_time - (v_current_date || ' ' || v_shift.start_time)::TIMESTAMP AT TIME ZONE v_operational_tz)) / 60
      END
    );
  END IF;
  
  -- Update courier status to 'on' and set out_of_shift = false
  UPDATE profiles
  SET courier_status = 'on', 
      out_of_shift = false,
      updated_at = now()
  WHERE id = p_courier_id;
  
  -- Reset late_fine_active if was active
  UPDATE profiles
  SET late_fine_active = false
  WHERE id = p_courier_id AND late_fine_active = true;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Check-in berhasil',
    'checked_in_at', v_current_time,
    'shift_name', v_shift.name,
    'already_checked_in', false,
    'mode', 'shift'
  );
END;
$$;

COMMENT ON FUNCTION public.record_courier_checkin(UUID, BOOLEAN) IS 
  'Records courier check-in with shift window validation. FIXED: Timezone calculation now correctly interprets shift times as local time. Sets out_of_shift=false for normal shift mode.';

-- Verification
DO $$
BEGIN
  RAISE NOTICE 'Migration 20260603063000 completed successfully';
  RAISE NOTICE 'FIXED: Timezone calculation in record_courier_checkin()';
  RAISE NOTICE 'Changed ::TIMESTAMPTZ to ::TIMESTAMP before AT TIME ZONE';
  RAISE NOTICE 'This correctly interprets shift times as local Makassar time';
END $$;
