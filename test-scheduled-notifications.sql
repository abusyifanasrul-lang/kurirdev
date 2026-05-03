-- ============================================
-- TEST SCRIPT: Scheduled Notifications System
-- ============================================
-- This script tests the scheduled notification system for shift swap reminders

-- Step 1: Check if table exists
SELECT 'Step 1: Checking if scheduled_notifications table exists...' as status;
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'scheduled_notifications'
) as table_exists;

-- Step 2: Check if trigger exists
SELECT 'Step 2: Checking if trigger exists...' as status;
SELECT EXISTS (
  SELECT FROM pg_trigger 
  WHERE tgname = 'trigger_schedule_notification_processing'
) as trigger_exists;

-- Step 3: Check if Vault secrets exist
SELECT 'Step 3: Checking Vault secrets...' as status;
SELECT 
  name,
  description,
  CASE 
    WHEN decrypted_secret IS NOT NULL THEN '✅ Secret exists'
    ELSE '❌ Secret missing'
  END as status
FROM vault.decrypted_secrets
WHERE name IN ('supabase_url', 'supabase_anon_key');

-- Step 4: Check current scheduled notifications
SELECT 'Step 4: Current scheduled notifications...' as status;
SELECT 
  id,
  user_id,
  scheduled_at,
  title,
  type,
  sent,
  created_at
FROM public.scheduled_notifications
ORDER BY scheduled_at DESC
LIMIT 10;

-- Step 5: Create a test notification (scheduled 2 minutes from now)
SELECT 'Step 5: Creating test notification (2 minutes from now)...' as status;

-- First, get a test user (courier)
DO $$
DECLARE
  v_test_user_id UUID;
  v_test_scheduled_at TIMESTAMPTZ;
BEGIN
  -- Get first courier user
  SELECT id INTO v_test_user_id
  FROM public.profiles
  WHERE role = 'courier'
  LIMIT 1;
  
  IF v_test_user_id IS NULL THEN
    RAISE NOTICE '❌ No courier found for testing';
    RETURN;
  END IF;
  
  -- Schedule for 2 minutes from now
  v_test_scheduled_at := NOW() + INTERVAL '2 minutes';
  
  -- Insert test notification
  INSERT INTO public.scheduled_notifications (
    user_id,
    scheduled_at,
    title,
    message,
    type,
    data
  ) VALUES (
    v_test_user_id,
    v_test_scheduled_at,
    '🧪 TEST: Pengingat Tukar Shift',
    'Ini adalah notifikasi test untuk sistem scheduled notifications. Jika Anda menerima ini, berarti sistem bekerja dengan baik!',
    'shift_swap_reminder',
    jsonb_build_object(
      'type', 'test',
      'test_time', NOW()
    )
  );
  
  RAISE NOTICE '✅ Test notification created for user % at %', v_test_user_id, v_test_scheduled_at;
END $$;

-- Step 6: Verify test notification was created
SELECT 'Step 6: Verifying test notification...' as status;
SELECT 
  id,
  user_id,
  scheduled_at,
  title,
  sent,
  EXTRACT(EPOCH FROM (scheduled_at - NOW())) as seconds_until_send
FROM public.scheduled_notifications
WHERE type = 'shift_swap_reminder'
  AND title LIKE '%TEST%'
ORDER BY created_at DESC
LIMIT 1;

-- Step 7: Check pg_net queue (to see if HTTP request was scheduled)
SELECT 'Step 7: Checking pg_net queue...' as status;
SELECT 
  id,
  status_code,
  content_type,
  created
FROM net._http_response
ORDER BY created DESC
LIMIT 5;

-- ============================================
-- MANUAL TEST INSTRUCTIONS
-- ============================================
-- 
-- After running this script:
-- 
-- 1. Wait 2 minutes
-- 2. Check if notification appears in the notifications table:
--    SELECT * FROM notifications WHERE type = 'shift_swap_reminder' AND title LIKE '%TEST%';
-- 
-- 3. Check if scheduled notification is marked as sent:
--    SELECT * FROM scheduled_notifications WHERE type = 'shift_swap_reminder' AND title LIKE '%TEST%';
-- 
-- 4. If notification doesn't arrive after 3 minutes, manually trigger the safety net:
--    SELECT public.process_due_scheduled_notifications();
-- 
-- 5. To test with real shift swap, create a shift swap via UI for tomorrow
--    and check if 2 scheduled notifications are created
-- 
-- ============================================
-- CLEANUP (run after test)
-- ============================================
-- 
-- DELETE FROM public.scheduled_notifications WHERE title LIKE '%TEST%';
-- DELETE FROM public.notifications WHERE title LIKE '%TEST%';
-- 
-- ============================================

SELECT '✅ Test script completed. Check results above.' as final_status;
