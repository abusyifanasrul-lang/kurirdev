CREATE OR REPLACE FUNCTION public.process_shift_end(
  p_shift_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_shift RECORD;
  v_current_date DATE;
  v_current_time TIMESTAMPTZ;
  v_operational_tz TEXT;
  v_records_updated INTEGER := 0;
  v_shift_duration_minutes INTEGER;
  v_start_time TIMESTAMPTZ;
BEGIN
  v_start_time := clock_timestamp();
  
  -- Get operational timezone
  SELECT operational_timezone INTO v_operational_tz FROM settings LIMIT 1;
  IF v_operational_tz IS NULL THEN v_operational_tz := 'Asia/Makassar'; END IF;
  
  v_current_time := now() AT TIME ZONE v_operational_tz;
  v_current_date := (v_current_time AT TIME ZONE v_operational_tz)::DATE;
  
  -- Get shift details
  SELECT * INTO v_shift FROM shifts WHERE id = p_shift_id;
  
  -- Calculate shift duration in minutes
  IF v_shift.is_overnight THEN
    v_shift_duration_minutes := EXTRACT(EPOCH FROM (
      ((v_current_date + 1) || ' ' || v_shift.end_time)::TIMESTAMPTZ -
      (v_current_date || ' ' || v_shift.start_time)::TIMESTAMPTZ
    )) / 60;
  ELSE
    v_shift_duration_minutes := EXTRACT(EPOCH FROM (
      (v_current_date || ' ' || v_shift.end_time)::TIMESTAMPTZ -
      (v_current_date || ' ' || v_shift.start_time)::TIMESTAMPTZ
    )) / 60;
  END IF;
  
  -- Update late records to alpha status (removed updated_at)
  UPDATE shift_attendance
  SET 
    status = 'alpha',
    late_minutes = v_shift_duration_minutes
  WHERE shift_id = p_shift_id
    AND date = v_current_date
    AND status = 'late'
    AND first_online_at IS NULL;
  
  GET DIAGNOSTICS v_records_updated = ROW_COUNT;
  
  -- Reset late_fine_active for couriers whose shift ended
  UPDATE profiles p
  SET late_fine_active = false
  WHERE p.role = 'courier'
    AND p.shift_id = p_shift_id
    AND p.late_fine_active = true;
  
  -- Log execution
  INSERT INTO cron_execution_logs (
    job_type, shift_id, status, records_affected, 
    execution_time_ms
  ) VALUES (
    'shift_end', p_shift_id, 'success', v_records_updated,
    EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER
  );
  
EXCEPTION WHEN OTHERS THEN
  INSERT INTO cron_execution_logs (
    job_type, shift_id, status, records_affected, error_message
  ) VALUES (
    'shift_end', p_shift_id, 'failed', 0, SQLERRM
  );
  RAISE;
END;
$$;

COMMENT ON FUNCTION public.process_shift_end IS 
  'Cron function to auto-detect alpha status at shift end';;
