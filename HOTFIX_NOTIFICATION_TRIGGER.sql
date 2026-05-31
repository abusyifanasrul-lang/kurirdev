-- ============================================
-- HOTFIX: Recreate Missing Order Notification Trigger
-- ============================================
-- Issue: Trigger was dropped but never recreated
-- Impact: Auto notifications fail when orders assigned
-- Solution: Recreate the trigger
-- ============================================

-- Step 1: Verify current trigger status
SELECT 
    'BEFORE FIX' as status,
    COUNT(*) as trigger_exists
FROM pg_trigger
WHERE tgname = 'trigger_handle_order_notification'
    AND tgrelid = 'public.orders'::regclass;

-- Step 2: Recreate the trigger
DROP TRIGGER IF EXISTS trigger_handle_order_notification ON public.orders;

CREATE TRIGGER trigger_handle_order_notification
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION handle_order_notification();

-- Step 3: Verify trigger was created successfully
SELECT 
    'AFTER FIX' as status,
    COUNT(*) as trigger_exists,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ TRIGGER CREATED SUCCESSFULLY'
        ELSE '❌ TRIGGER CREATION FAILED'
    END as result
FROM pg_trigger
WHERE tgname = 'trigger_handle_order_notification'
    AND tgrelid = 'public.orders'::regclass;

-- Step 4: Show trigger details
SELECT 
    tgname as trigger_name,
    tgenabled as is_enabled,
    tgrelid::regclass as table_name,
    pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger
WHERE tgname = 'trigger_handle_order_notification';

-- ============================================
-- TESTING (Optional)
-- ============================================
-- After running this fix, test by:
-- 1. Assign an order to a courier from admin panel
-- 2. Check if notification was created:
--
-- SELECT * FROM notifications 
-- WHERE type = 'order_assigned' 
-- ORDER BY sent_at DESC 
-- LIMIT 5;
--
-- 3. Check FCM delivery status:
--
-- SELECT 
--     title, 
--     fcm_status, 
--     fcm_error, 
--     sent_at 
-- FROM notifications 
-- WHERE type = 'order_assigned' 
-- ORDER BY sent_at DESC 
-- LIMIT 5;
-- ============================================
