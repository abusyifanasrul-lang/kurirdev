-- Migration: Add out_of_shift flag for private order mode
-- Date: 2026-06-02
-- Purpose: Implement "Out of Shift" feature from technical documentation
--          Kurir yang ON di luar shift window tidak masuk antrian normal

-- ============================================================================
-- 1. Add out_of_shift column to profiles
-- ============================================================================

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS out_of_shift BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.profiles.out_of_shift IS 
  'Flag untuk kurir yang ON di luar jam shift (private order mode). Tidak masuk antrian normal, hanya bisa di-assign manual oleh admin.';

-- ============================================================================
-- 2. Create index for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_out_of_shift 
  ON public.profiles(out_of_shift) 
  WHERE out_of_shift = true;

COMMENT ON INDEX idx_profiles_out_of_shift IS 
  'Partial index untuk query kurir dalam private order mode';

-- ============================================================================
-- 3. Update handle_courier_queue_sync trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_courier_queue_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_status TEXT;
  v_new_status TEXT;
  v_reset_needed BOOLEAN := false;
BEGIN
  IF NEW.role != 'courier' THEN
    NEW.queue_joined_at := NULL;
    NEW.is_online := false;
    NEW.out_of_shift := false;  -- Reset for non-couriers
    RETURN NEW;
  END IF;

  v_old_status := COALESCE(OLD.courier_status, 'off');
  v_new_status := COALESCE(NEW.courier_status, 'off');

  -- 1. Mirror is_online dari courier_status
  IF (NEW.is_active = true) AND (v_new_status IN ('on', 'stay')) THEN
    NEW.is_online := true;
  ELSE
    NEW.is_online := false;
  END IF;

  -- 2. Queue timestamp — hanya transisi spesifik yang reset
  -- FIX: Check courier_status changes, NOT is_online changes
  IF NEW.is_online = false THEN
    NEW.queue_joined_at := NULL;
    NEW.out_of_shift := false;  -- Reset flag saat OFF

  ELSIF (TG_OP = 'INSERT' AND NEW.is_online = true) THEN
    v_reset_needed := true;

  ELSIF (TG_OP = 'UPDATE') THEN
    -- FIX: Check courier_status transition, not is_online
    -- off/null → on/stay
    IF (v_old_status IN ('off', '') OR v_old_status IS NULL) AND 
       (v_new_status IN ('on', 'stay')) THEN
      v_reset_needed := true;
    -- on ↔ stay transitions
    ELSIF (v_old_status = 'on' AND v_new_status = 'stay') OR
          (v_old_status = 'stay' AND v_new_status = 'on') THEN
      v_reset_needed := true;
    -- unsuspend
    ELSIF (OLD.is_active = false AND NEW.is_active = true AND NEW.is_online = true) THEN
      v_reset_needed := true;
    -- recovery state
    ELSIF (NEW.queue_joined_at IS NULL AND NEW.is_online = true) THEN
      v_reset_needed := true;
    END IF;
  END IF;

  IF v_reset_needed THEN
    -- FIX: Use clock_timestamp() for microsecond precision
    NEW.queue_joined_at := clock_timestamp();
  END IF;

  -- 3. Suspend: paksa keluar antrian
  IF NEW.is_active = false AND OLD.is_active = true THEN
    NEW.courier_status       := 'off';
    NEW.is_online            := false;
    NEW.queue_joined_at      := NULL;
    NEW.is_priority_recovery := false;
    NEW.out_of_shift         := false;  -- Reset flag saat suspend
  END IF;

  -- 4. Audit trail
  IF (TG_OP = 'UPDATE') AND
     (v_old_status != v_new_status OR
      OLD.is_priority_recovery IS DISTINCT FROM NEW.is_priority_recovery OR
      OLD.out_of_shift IS DISTINCT FROM NEW.out_of_shift) THEN

    INSERT INTO public.tier_change_log (
      courier_id, trigger_source,
      queue_joined_at_before, queue_joined_at_after,
      context
    ) VALUES (
      NEW.id,
      'status_' || v_old_status || '_to_' || v_new_status,
      OLD.queue_joined_at, NEW.queue_joined_at,
      jsonb_build_object(
        'old_status', v_old_status,
        'new_status', v_new_status,
        'is_priority_recovery', NEW.is_priority_recovery,
        'out_of_shift', NEW.out_of_shift
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_courier_queue_sync IS 
  'Manages courier queue sync with race condition fix, microsecond precision, and out_of_shift flag handling';

-- ============================================================================
-- 4. Update record_courier_checkin RPC
-- ============================================================================

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
          out_of_shift = false,  -- NEW: Within shift, not private mode
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
      'current_time', v_current_time,
      'can_go_online_private', true  -- NEW: Allow private mode
    );
  END IF;
  
  -- Create or update shift_attendance
  IF v_existing_attendance.id IS NOT NULL THEN
    -- Update existing late record (created by cron at shift start)
    UPDATE shift_attendance
    SET 
      first_online_at = v_current_time,
      status = CASE 
        WHEN v_current_time <= (v_current_date || ' ' || v_shift.start_time)::TIMESTAMPTZ AT TIME ZONE v_operational_tz
        THEN 'on_time'
        ELSE 'late'
      END,
      late_minutes = CASE
        WHEN v_current_time <= (v_current_date || ' ' || v_shift.start_time)::TIMESTAMPTZ AT TIME ZONE v_operational_tz
        THEN 0
        ELSE EXTRACT(EPOCH FROM (v_current_time - (v_current_date || ' ' || v_shift.start_time)::TIMESTAMPTZ AT TIME ZONE v_operational_tz)) / 60
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
        WHEN v_current_time <= (v_current_date || ' ' || v_shift.start_time)::TIMESTAMPTZ AT TIME ZONE v_operational_tz
        THEN 'on_time'
        ELSE 'late'
      END,
      CASE
        WHEN v_current_time <= (v_current_date || ' ' || v_shift.start_time)::TIMESTAMPTZ AT TIME ZONE v_operational_tz
        THEN 0
        ELSE EXTRACT(EPOCH FROM (v_current_time - (v_current_date || ' ' || v_shift.start_time)::TIMESTAMPTZ AT TIME ZONE v_operational_tz)) / 60
      END
    );
  END IF;
  
  -- Update courier status to 'on' and set out_of_shift = false
  UPDATE profiles
  SET courier_status = 'on', 
      out_of_shift = false,  -- NEW: Within shift window
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
  'Records courier check-in with shift window validation. Sets out_of_shift=false for normal shift mode. Set p_skip_duplicate_check=true to allow resume online after already checked-in.';

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 20260602120000 completed successfully';
  RAISE NOTICE 'Added column: profiles.out_of_shift (BOOLEAN DEFAULT false)';
  RAISE NOTICE 'Created index: idx_profiles_out_of_shift';
  RAISE NOTICE 'Updated function: handle_courier_queue_sync() - Reset out_of_shift on OFF';
  RAISE NOTICE 'Updated function: record_courier_checkin() - Set out_of_shift=false within shift';
  RAISE NOTICE 'Feature: Out of shift couriers do not enter normal queue';
END $$;
