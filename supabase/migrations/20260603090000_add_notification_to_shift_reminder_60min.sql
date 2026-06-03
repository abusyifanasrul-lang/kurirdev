-- Migration: Add notification logic to send_shift_reminder_60min
-- Date: 2026-06-03 09:00:00
-- Purpose: Send notifications to couriers 60 minutes before shift starts
--
-- PROBLEM:
--   send_shift_reminder_60min() forces couriers to OFF status
--   but does NOT send any notification to inform them
--   Couriers don't receive "shift starting in 60 minutes" reminder
--
-- ROOT CAUSE:
--   Function only updates courier status and logs execution
--   Missing INSERT INTO notifications for each courier
--
-- FIX:
--   Add notification loop to insert notification for each courier
--   Notification includes shift name, start time, and reminder to check-in
--
-- EXPECTED BEHAVIOR:
--   1. Force all couriers in shift to OFF status (existing behavior)
--   2. Send notification to each courier: "Shift X dimulai dalam 60 menit"
--   3. Log execution to cron_execution_logs (existing behavior)

CREATE OR REPLACE FUNCTION public.send_shift_reminder_60min(p_shift_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_shift RECORD;
  v_courier RECORD;
  v_couriers_count INTEGER := 0;
  v_forced_off_count INTEGER := 0;
  v_notifications_sent INTEGER := 0;
  v_current_date DATE;
  v_current_time TIMESTAMPTZ;
BEGIN
  -- Get current date/time in operational timezone
  v_current_date := tz_today();
  v_current_time := tz_now();
  
  -- Get shift details
  SELECT * INTO v_shift FROM shifts WHERE id = p_shift_id;
  IF NOT FOUND THEN
    RAISE WARNING 'Shift % not found', p_shift_id;
    RETURN;
  END IF;
  
  -- Force all couriers in this shift to OFF status
  UPDATE profiles 
  SET 
    courier_status = 'off',
    is_online = false,
    queue_joined_at = NULL,
    updated_at = now()
  WHERE role = 'courier' 
    AND is_active = true 
    AND shift_id = p_shift_id 
    AND courier_status IN ('on', 'stay');
  
  GET DIAGNOSTICS v_forced_off_count = ROW_COUNT;
  
  -- Count total active couriers in this shift
  SELECT COUNT(*) INTO v_couriers_count 
  FROM profiles
  WHERE role = 'courier' 
    AND is_active = true 
    AND shift_id = p_shift_id;
  
  -- Send notification to each courier in this shift
  FOR v_courier IN 
    SELECT id, name, fcm_token 
    FROM profiles
    WHERE role = 'courier' 
      AND is_active = true 
      AND shift_id = p_shift_id
  LOOP
    -- Insert notification record
    INSERT INTO notifications (
      id,
      user_id,
      user_name,
      type,
      title,
      message,
      data,
      is_read,
      sent_at,
      fcm_status
    ) VALUES (
      gen_random_uuid(),
      v_courier.id,
      v_courier.name,
      'shift_reminder',
      '⏰ Pengingat Shift',
      format('Shift %s dimulai dalam 60 menit (jam %s). Jangan lupa check-in tepat waktu!', 
        v_shift.name, 
        v_shift.start_time::TEXT
      ),
      jsonb_build_object(
        'shift_id', v_shift.id,
        'shift_name', v_shift.name,
        'shift_start_time', v_shift.start_time,
        'minutes_before', 60
      ),
      false,
      now(),
      CASE WHEN v_courier.fcm_token IS NOT NULL THEN 'pending' ELSE 'no_token' END
    );
    
    v_notifications_sent := v_notifications_sent + 1;
  END LOOP;
  
  -- Log execution
  INSERT INTO cron_execution_logs (
    job_type, 
    shift_id, 
    status, 
    records_affected, 
    error_message
  ) VALUES (
    'shift_reminder_60min',
    p_shift_id,
    'success',
    v_couriers_count,
    format('Sent to %s couriers, forced %s to OFF, %s notifications sent', 
      v_couriers_count, v_forced_off_count, v_notifications_sent
    )
  );
  
  RAISE NOTICE 'Shift % reminder: % couriers, % forced OFF, % notifications sent', 
    v_shift.name, v_couriers_count, v_forced_off_count, v_notifications_sent;
    
EXCEPTION WHEN OTHERS THEN
  INSERT INTO cron_execution_logs (
    job_type, 
    shift_id, 
    status, 
    records_affected, 
    error_message
  ) VALUES (
    'shift_reminder_60min',
    p_shift_id,
    'failed',
    0,
    SQLERRM
  );
  RAISE;
END;
$$;

-- ========================================
-- FUNCTION METADATA
-- ========================================
COMMENT ON FUNCTION public.send_shift_reminder_60min IS 
'Send shift reminder notification 60 minutes before shift starts.
1. Forces all couriers in shift to OFF status (discipline enforcement)
2. Sends notification to each courier reminding them to check-in on time
3. Logs execution to cron_execution_logs
Called by cron job daily at (shift_start_time - 60 minutes) in UTC.';

-- ========================================
-- UPDATE send_shift_reminder_30min TOO
-- ========================================
-- For consistency, also add notification to 30-minute reminder

CREATE OR REPLACE FUNCTION public.send_shift_reminder_30min(p_shift_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_shift RECORD;
  v_courier RECORD;
  v_couriers_count INTEGER := 0;
  v_notifications_sent INTEGER := 0;
  v_current_date DATE;
  v_current_time TIMESTAMPTZ;
BEGIN
  -- Get current date/time in operational timezone
  v_current_date := tz_today();
  v_current_time := tz_now();
  
  -- Get shift details
  SELECT * INTO v_shift FROM shifts WHERE id = p_shift_id;
  IF NOT FOUND THEN
    RAISE WARNING 'Shift % not found', p_shift_id;
    RETURN;
  END IF;
  
  -- Count total active couriers in this shift
  SELECT COUNT(*) INTO v_couriers_count 
  FROM profiles
  WHERE role = 'courier' 
    AND is_active = true 
    AND shift_id = p_shift_id;
  
  -- Send notification to each courier in this shift
  FOR v_courier IN 
    SELECT id, name, fcm_token 
    FROM profiles
    WHERE role = 'courier' 
      AND is_active = true 
      AND shift_id = p_shift_id
  LOOP
    -- Insert notification record
    INSERT INTO notifications (
      id,
      user_id,
      user_name,
      type,
      title,
      message,
      data,
      is_read,
      sent_at,
      fcm_status
    ) VALUES (
      gen_random_uuid(),
      v_courier.id,
      v_courier.name,
      'shift_reminder',
      '🔔 Pengingat Shift',
      format('Shift %s dimulai dalam 30 menit (jam %s). Segera check-in!', 
        v_shift.name, 
        v_shift.start_time::TEXT
      ),
      jsonb_build_object(
        'shift_id', v_shift.id,
        'shift_name', v_shift.name,
        'shift_start_time', v_shift.start_time,
        'minutes_before', 30
      ),
      false,
      now(),
      CASE WHEN v_courier.fcm_token IS NOT NULL THEN 'pending' ELSE 'no_token' END
    );
    
    v_notifications_sent := v_notifications_sent + 1;
  END LOOP;
  
  -- Log execution
  INSERT INTO cron_execution_logs (
    job_type, 
    shift_id, 
    status, 
    records_affected, 
    error_message
  ) VALUES (
    'shift_reminder_30min',
    p_shift_id,
    'success',
    v_couriers_count,
    format('Sent to %s couriers, %s notifications sent', 
      v_couriers_count, v_notifications_sent
    )
  );
  
  RAISE NOTICE 'Shift % 30-min reminder: % couriers, % notifications sent', 
    v_shift.name, v_couriers_count, v_notifications_sent;
    
EXCEPTION WHEN OTHERS THEN
  INSERT INTO cron_execution_logs (
    job_type, 
    shift_id, 
    status, 
    records_affected, 
    error_message
  ) VALUES (
    'shift_reminder_30min',
    p_shift_id,
    'failed',
    0,
    SQLERRM
  );
  RAISE;
END;
$$;

COMMENT ON FUNCTION public.send_shift_reminder_30min IS 
'Send shift reminder notification 30 minutes before shift starts.
Sends notification to each courier reminding them to check-in immediately.
Called by cron job daily at (shift_start_time - 30 minutes) in UTC.';

-- ========================================
-- VERIFICATION
-- ========================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 20260603090000 completed successfully';
  RAISE NOTICE '📱 Added notification logic to send_shift_reminder_60min()';
  RAISE NOTICE '📱 Added notification logic to send_shift_reminder_30min()';
  RAISE NOTICE '🎯 Couriers will now receive notifications before shift starts';
  RAISE NOTICE '⏰ 60-min: "Shift X dimulai dalam 60 menit" + force OFF';
  RAISE NOTICE '🔔 30-min: "Shift X dimulai dalam 30 menit"';
END $$;
