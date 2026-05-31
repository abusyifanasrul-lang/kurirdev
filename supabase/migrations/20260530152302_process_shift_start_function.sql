-- Migration: Attendance System Overhaul - process_shift_start Function
-- Date: 2026-05-30
-- Description: Create process_shift_start() cron function
-- Task: Wave 2 - Task 6
-- Requirement: 8 (Shift Start Cron Job)

-- ============================================================================
-- Function: process_shift_start
-- Purpose: Create attendance records at shift start time
-- Features: Holiday check, day_off check, online status detection
-- ============================================================================

CREATE OR REPLACE FUNCTION public.process_shift_start(
  p_shift_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_courier RECORD;
  v_current_date DATE;
  v_current_time TIMESTAMPTZ;
  v_operational_tz TEXT;
  v_records_created INTEGER := 0;
  v_start_time TIMESTAMPTZ;
BEGIN
  v_start_time := clock_timestamp();
  
  -- Get operational timezone
  SELECT operational_timezone INTO v_operational_tz FROM settings LIMIT 1;
  IF v_operational_tz IS NULL THEN v_operational_tz := 'Asia/Makassar'; END IF;
  
  v_current_time := now() AT TIME ZONE v_operational_tz;
  v_current_date := (v_current_time AT TIME ZONE v_operational_tz)::DATE;
  
  -- Check if today is a holiday
  IF EXISTS (SELECT 1 FROM holidays WHERE date = v_current_date AND is_active = true) THEN
    INSERT INTO cron_execution_logs (job_type, shift_id, status, records_affected, error_message)
    VALUES ('shift_start', p_shift_id, 'success', 0, 'Skipped: Holiday');
    RETURN;
  END IF;
  
  -- Loop through all couriers assigned to this shift
  FOR v_courier IN
    SELECT p.id, p.is_online, p.day_off, p.name
    FROM profiles p
    LEFT JOIN shift_overrides so ON so.date = v_current_date 
      AND so.replacement_courier_id = p.id
    WHERE (p.shift_id = p_shift_id OR so.original_shift_id = p_shift_id)
      AND p.is_active = true
      AND p.role = 'courier'
  LOOP
    -- Skip if today is courier's day off
    IF v_courier.day_off = to_char(v_current_time, 'Day') THEN
      CONTINUE;
    END IF;

    -- Check if attendance record already exists
    IF NOT EXISTS (
      SELECT 1 FROM shift_attendance 
      WHERE courier_id = v_courier.id 
        AND date = v_current_date 
        AND shift_id = p_shift_id
    ) THEN
      -- Create attendance record
      IF v_courier.is_online THEN
        -- Courier already online: mark as on_time
        INSERT INTO shift_attendance (
          courier_id, shift_id, date,
          first_online_at, status, late_minutes
        ) VALUES (
          v_courier.id, p_shift_id, v_current_date,
          v_current_time, 'on_time', 0
        );
      ELSE
        -- Courier not online: mark as late
        INSERT INTO shift_attendance (
          courier_id, shift_id, date,
          first_online_at, status, late_minutes
        ) VALUES (
          v_courier.id, p_shift_id, v_current_date,
          NULL, 'late', 0
        );
        
        -- Set late_fine_active flag
        UPDATE profiles SET late_fine_active = true WHERE id = v_courier.id;
      END IF;
      
      v_records_created := v_records_created + 1;
    END IF;
  END LOOP;
  
  -- Log execution
  INSERT INTO cron_execution_logs (
    job_type, shift_id, status, records_affected, 
    execution_time_ms
  ) VALUES (
    'shift_start', p_shift_id, 'success', v_records_created,
    EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER
  );
  
EXCEPTION WHEN OTHERS THEN
  INSERT INTO cron_execution_logs (
    job_type, shift_id, status, records_affected, error_message
  ) VALUES (
    'shift_start', p_shift_id, 'failed', 0, SQLERRM
  );
  RAISE;
END;
$$;

COMMENT ON FUNCTION public.process_shift_start IS 
  'Cron function to create attendance records at shift start time';

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 20260530152302 completed successfully';
  RAISE NOTICE 'Created function: process_shift_start()';
  RAISE NOTICE 'Task 6 (Shift Start Cron) - COMPLETE';
END $$;
