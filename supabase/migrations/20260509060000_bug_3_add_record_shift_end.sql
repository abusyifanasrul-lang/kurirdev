-- Migration: Add record_shift_end function
-- Bug 3: Missing Shift End Recording
-- 
-- This migration creates the record_shift_end function to allow couriers
-- to explicitly record when they finish their normal shift.
-- 
-- IMPORTANT: This function does NOT prevent courier from going ON again
-- for private orders (out-of-shift work).

-- ========================================
-- Function: record_shift_end
-- ========================================

CREATE OR REPLACE FUNCTION record_shift_end(
  p_courier_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_attendance_record RECORD;
  v_shift_record RECORD;
  v_duration_minutes INT;
  v_scheduled_duration_minutes INT;
  v_warning_message TEXT := NULL;
  v_status TEXT := 'normal';
  v_result JSONB;
BEGIN
  -- Get today's date in local timezone
  DECLARE
    v_today DATE := CURRENT_DATE;
  BEGIN
    -- Find shift_attendance record for courier and today
    SELECT * INTO v_attendance_record
    FROM shift_attendance
    WHERE courier_id = p_courier_id
    AND date = v_today;
    
    -- Validate: courier must have checked in
    IF v_attendance_record.id IS NULL THEN
      RAISE EXCEPTION 'Courier has not checked in today';
    END IF;
    
    IF v_attendance_record.first_online_at IS NULL THEN
      RAISE EXCEPTION 'Courier check-in time not recorded';
    END IF;
    
    -- Validate: not already recorded shift end
    IF v_attendance_record.last_online_at IS NOT NULL THEN
      RAISE EXCEPTION 'Shift end time already recorded at %', v_attendance_record.last_online_at;
    END IF;
    
    -- Update last_online_at
    UPDATE shift_attendance
    SET last_online_at = NOW()
    WHERE id = v_attendance_record.id
    RETURNING * INTO v_attendance_record;
    
    -- Calculate duration in minutes
    v_duration_minutes := EXTRACT(EPOCH FROM (v_attendance_record.last_online_at - v_attendance_record.first_online_at)) / 60;
    
    -- Get scheduled shift duration
    SELECT * INTO v_shift_record
    FROM shifts
    WHERE id = v_attendance_record.shift_id;
    
    IF v_shift_record.id IS NOT NULL THEN
      -- Calculate scheduled duration from start_time to end_time
      v_scheduled_duration_minutes := EXTRACT(EPOCH FROM (v_shift_record.end_time - v_shift_record.start_time)) / 60;
      
      -- Compare actual vs scheduled duration
      IF v_duration_minutes < (v_scheduled_duration_minutes * 0.8) THEN
        -- Finished more than 20% early
        v_status := 'early_finish';
        v_warning_message := format(
          'Anda selesai shift %s menit lebih awal dari jadwal. Pastikan semua order sudah selesai.',
          ROUND((v_scheduled_duration_minutes - v_duration_minutes)::NUMERIC, 0)
        );
      ELSIF v_duration_minutes > (v_scheduled_duration_minutes * 1.2) THEN
        -- Worked more than 20% overtime
        v_status := 'overtime';
        v_warning_message := format(
          'Anda bekerja %s menit overtime. Terima kasih atas dedikasi Anda!',
          ROUND((v_duration_minutes - v_scheduled_duration_minutes)::NUMERIC, 0)
        );
      ELSE
        -- Normal duration
        v_status := 'normal';
        v_warning_message := 'Shift selesai tepat waktu. Terima kasih!';
      END IF;
    ELSE
      -- No shift record found (shouldn't happen, but handle gracefully)
      v_status := 'unknown';
      v_warning_message := 'Shift selesai. Durasi shift tidak dapat dihitung.';
    END IF;
    
    -- Build result JSON
    v_result := jsonb_build_object(
      'success', true,
      'attendance_id', v_attendance_record.id,
      'first_online_at', v_attendance_record.first_online_at,
      'last_online_at', v_attendance_record.last_online_at,
      'duration_minutes', v_duration_minutes,
      'scheduled_duration_minutes', v_scheduled_duration_minutes,
      'status', v_status,
      'warning_message', v_warning_message,
      'can_go_on_again', true,  -- IMPORTANT: Courier can still ON for private orders
      'message', 'Shift end time recorded successfully'
    );
    
    RETURN v_result;
  END;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION record_shift_end(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION record_shift_end(UUID) IS 
'Records the shift end time (last_online_at) for a courier. 
This function does NOT prevent the courier from going ON again for private orders (out-of-shift work).
It only records when the normal scheduled shift ended.

Parameters:
- p_courier_id: UUID of the courier

Returns:
- JSONB object with:
  - success: boolean
  - attendance_id: UUID
  - first_online_at: timestamp
  - last_online_at: timestamp
  - duration_minutes: integer
  - scheduled_duration_minutes: integer
  - status: text (normal, early_finish, overtime, unknown)
  - warning_message: text
  - can_go_on_again: boolean (always true)
  - message: text

Raises:
- Exception if courier has not checked in today
- Exception if shift end time already recorded';
