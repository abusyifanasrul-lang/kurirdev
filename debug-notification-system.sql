-- ============================================
-- DIAGNOSTIC SCRIPT: Courier Notification System
-- ============================================
-- Purpose: Check all layers of notification delivery
-- Usage: Run in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. CHECK DATABASE TRIGGERS STATUS
-- ============================================
SELECT 
    'Database Triggers' as check_category,
    tgname as trigger_name,
    tgenabled as is_enabled,
    tgrelid::regclass as table_name
FROM pg_trigger 
WHERE tgname IN (
    'trigger_handle_order_notification', 
    'trigger_notify_courier_on_insert'
)
ORDER BY tgname;

-- ============================================
-- 2. CHECK PG_NET EXTENSION
-- ============================================
SELECT 
    'pg_net Extension' as check_category,
    extname as extension_name,
    extversion as version
FROM pg_extension 
WHERE extname = 'pg_net';

-- ============================================
-- 3. CHECK RECENT ORDER ASSIGNMENTS
-- ============================================
-- Shows last 10 order assignments with notification status
SELECT 
    'Recent Assignments' as check_category,
    o.order_number,
    o.status,
    o.courier_id,
    o.courier_name,
    o.assigned_at,
    o.updated_at,
    COUNT(n.id) as notification_count,
    MAX(n.sent_at) as last_notification_sent,
    STRING_AGG(DISTINCT n.fcm_status, ', ') as fcm_statuses
FROM public.orders o
LEFT JOIN public.notifications n ON n.data->>'order_id' = o.id::text
WHERE o.status = 'assigned'
    AND o.assigned_at > NOW() - INTERVAL '24 hours'
GROUP BY o.id, o.order_number, o.status, o.courier_id, o.courier_name, o.assigned_at, o.updated_at
ORDER BY o.assigned_at DESC
LIMIT 10;

-- ============================================
-- 4. CHECK COURIER FCM TOKENS
-- ============================================
-- Shows all active couriers and their FCM token status
SELECT 
    'Courier FCM Tokens' as check_category,
    p.id,
    p.name,
    p.role,
    p.is_active,
    p.is_online,
    CASE 
        WHEN p.fcm_token IS NOT NULL THEN 'HAS_TOKEN'
        ELSE 'NO_TOKEN'
    END as token_status,
    p.fcm_token_updated_at,
    p.platform,
    EXTRACT(EPOCH FROM (NOW() - p.fcm_token_updated_at))/3600 as hours_since_token_update
FROM public.profiles p
WHERE p.role = 'courier'
    AND p.is_active = true
ORDER BY p.fcm_token_updated_at DESC NULLS LAST;

-- ============================================
-- 5. CHECK NOTIFICATION DELIVERY STATUS
-- ============================================
-- Shows notification delivery status breakdown
SELECT 
    'Notification Status Summary' as check_category,
    n.type,
    n.fcm_status,
    COUNT(*) as count,
    MAX(n.sent_at) as last_occurrence
FROM public.notifications n
WHERE n.sent_at > NOW() - INTERVAL '24 hours'
GROUP BY n.type, n.fcm_status
ORDER BY n.type, n.fcm_status;

-- ============================================
-- 6. CHECK FAILED NOTIFICATIONS
-- ============================================
-- Shows failed notifications with error details
SELECT 
    'Failed Notifications' as check_category,
    n.id,
    n.title,
    n.message,
    n.user_id,
    p.name as courier_name,
    n.fcm_status,
    n.fcm_error,
    n.sent_at,
    n.data->>'order_id' as order_id,
    n.data->>'order_number' as order_number
FROM public.notifications n
LEFT JOIN public.profiles p ON p.id = n.user_id
WHERE n.fcm_status IN ('failed', 'skipped')
    AND n.sent_at > NOW() - INTERVAL '24 hours'
ORDER BY n.sent_at DESC
LIMIT 20;

-- ============================================
-- 7. CHECK SPECIFIC ORDER NOTIFICATION TRAIL
-- ============================================
-- Replace 'ORDER_NUMBER_HERE' with actual order number
-- Shows complete notification trail for a specific order
/*
SELECT 
    'Order Notification Trail' as check_category,
    o.order_number,
    o.status,
    o.courier_name,
    o.assigned_at,
    n.id as notification_id,
    n.title,
    n.message,
    n.sent_at,
    n.fcm_status,
    n.fcm_error,
    p.fcm_token IS NOT NULL as courier_has_token,
    p.fcm_token_updated_at
FROM public.orders o
LEFT JOIN public.notifications n ON n.data->>'order_id' = o.id::text
LEFT JOIN public.profiles p ON p.id = o.courier_id
WHERE o.order_number = 'ORDER_NUMBER_HERE'
ORDER BY n.sent_at DESC;
*/

-- ============================================
-- 8. CHECK PG_NET QUEUE (if accessible)
-- ============================================
-- Shows pending HTTP requests in pg_net queue
-- Note: This may require elevated permissions
/*
SELECT 
    'pg_net Queue' as check_category,
    id,
    url,
    status,
    created_at,
    updated_at
FROM net._http_response
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 20;
*/

-- ============================================
-- 9. TEST NOTIFICATION CREATION (MANUAL)
-- ============================================
-- Manually insert a test notification to check if triggers fire
-- Replace 'COURIER_ID_HERE' with actual courier UUID
/*
INSERT INTO public.notifications (user_id, title, message, type, data)
VALUES (
    'COURIER_ID_HERE',
    '🧪 Test Notification',
    'This is a manual test notification to verify the system is working.',
    'test',
    jsonb_build_object('test', true, 'timestamp', NOW())
);
*/

-- ============================================
-- 10. CHECK NOTIFICATION FUNCTION DEFINITION
-- ============================================
-- Verify the notification function is correctly defined
SELECT 
    'Function Definition' as check_category,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
WHERE p.proname IN ('handle_order_notification', 'notify_courier_on_insert');
