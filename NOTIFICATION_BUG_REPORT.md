# Bug Report: Courier Notification Failure on Order Assignment

## 🐛 Bug Summary
Kurir tidak menerima notifikasi otomatis saat admin assign order, tetapi notifikasi manual dari admin panel berhasil.

## 🔍 Root Cause Analysis

### Temuan
Database trigger `trigger_handle_order_notification` **TIDAK ADA** di production database.

### Timeline Masalah
1. **Migration `20260402083247`** (2026-04-02)
   - ✅ Created trigger `trigger_handle_order_notification`
   - ✅ Created function `handle_order_notification()`
   - Status: **WORKING**

2. **Migration `20260405134641`** (2026-04-05)
   - ❌ **DROPPED trigger** `trigger_handle_order_notification`
   - ❌ **TIDAK recreate** trigger
   - Filename: `drop_redundant_order_notification_trigger_retry.sql`
   - Status: **BROKEN**

3. **Migration `20260405134649`** (2026-04-05)
   - ✅ Updated function `handle_order_notification()` (improved message)
   - ❌ Trigger sudah tidak ada, jadi function tidak pernah dipanggil
   - Status: **STILL BROKEN**

### Why Manual Notifications Work
Manual notifications dari admin panel langsung INSERT ke table `notifications`, yang memicu trigger `trigger_notify_courier_on_insert` → Edge Function → FCM.

Auto notifications bergantung pada trigger `trigger_handle_order_notification` yang sudah tidak ada.

## 🎯 Impact

### Affected Flow
```
Admin Assign Order
       ↓
assign_order_and_rotate() RPC
       ↓
UPDATE orders SET status='assigned'
       ↓
❌ trigger_handle_order_notification (MISSING!)
       ↓
❌ No INSERT to notifications table
       ↓
❌ Courier never receives notification
```

### Working Flow (Manual)
```
Admin Send Manual Notification
       ↓
Direct INSERT to notifications table
       ↓
✅ trigger_notify_courier_on_insert
       ↓
✅ Edge Function called
       ↓
✅ FCM delivery successful
```

## ✅ Solution

### Immediate Fix (Hotfix)
Run SQL script: `HOTFIX_NOTIFICATION_TRIGGER.sql`

```sql
CREATE TRIGGER trigger_handle_order_notification
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION handle_order_notification();
```

### Permanent Fix (Migration)
Apply migration: `supabase/migrations/20260523_recreate_order_notification_trigger.sql`

This migration:
1. Ensures function exists
2. Recreates trigger
3. Verifies trigger creation
4. Adds documentation comment

## 🧪 Testing Steps

### 1. Verify Trigger Exists
```sql
SELECT 
    tgname as trigger_name,
    tgenabled as is_enabled,
    tgrelid::regclass as table_name
FROM pg_trigger
WHERE tgname = 'trigger_handle_order_notification';
```

**Expected**: 1 row with `is_enabled = true`

### 2. Test Order Assignment
1. Login as admin
2. Assign pending order to online courier
3. Wait 5 seconds

### 3. Verify Notification Created
```sql
SELECT 
    id,
    title,
    message,
    type,
    fcm_status,
    sent_at,
    data->>'order_number' as order_number
FROM notifications
WHERE type = 'order_assigned'
ORDER BY sent_at DESC
LIMIT 5;
```

**Expected**: New notification with `type = 'order_assigned'` and `fcm_status = 'sent'`

### 4. Verify Courier Received Notification
1. Check courier device/browser
2. Should see push notification
3. Should see notification in app notification list

## 📊 Verification Queries

### Check Trigger Status
```sql
SELECT 
    COUNT(*) as trigger_count,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ Trigger exists'
        ELSE '❌ Trigger missing'
    END as status
FROM pg_trigger
WHERE tgname = 'trigger_handle_order_notification'
    AND tgrelid = 'public.orders'::regclass;
```

### Check Recent Auto Notifications
```sql
SELECT 
    DATE(sent_at) as date,
    COUNT(*) as notification_count,
    COUNT(*) FILTER (WHERE fcm_status = 'sent') as sent_count,
    COUNT(*) FILTER (WHERE fcm_status = 'failed') as failed_count,
    COUNT(*) FILTER (WHERE fcm_status = 'skipped') as skipped_count
FROM notifications
WHERE type = 'order_assigned'
    AND sent_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(sent_at)
ORDER BY date DESC;
```

## 🚨 Prevention

### Recommendation
1. **Never drop triggers without recreating** in same migration
2. **Add verification step** after trigger creation
3. **Add integration test** for auto notifications
4. **Monitor notification delivery rate** in production

### Proposed Monitoring
Create daily health check:
```sql
-- Alert if no auto notifications in last 24h
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'ALERT: No auto notifications in 24h'
        ELSE 'OK'
    END as health_status
FROM notifications
WHERE type = 'order_assigned'
    AND sent_at > NOW() - INTERVAL '24 hours';
```

## 📝 Lessons Learned

1. **Migration naming matters**: File named "drop_redundant" implied it was safe to drop
2. **Always verify in production**: Trigger might exist in dev but missing in prod
3. **Test both paths**: Manual AND automated notification flows
4. **Add health checks**: Proactive monitoring prevents silent failures

## 🔗 Related Files

- `supabase/migrations/20260402083247_20260402_notifications_triggers.sql` - Original trigger creation
- `supabase/migrations/20260405134641_drop_redundant_order_notification_trigger_retry.sql` - **Problematic migration**
- `supabase/migrations/20260405134649_update_handle_order_notification_function_v2.sql` - Function update
- `supabase/migrations/20260523_recreate_order_notification_trigger.sql` - **Fix migration**
- `HOTFIX_NOTIFICATION_TRIGGER.sql` - **Quick fix script**

## ✅ Resolution Status

- [x] Root cause identified
- [x] Hotfix script created
- [x] Migration created
- [ ] Applied to production
- [ ] Tested in production
- [ ] Monitoring added
- [ ] Documentation updated

---

**Reported**: 2026-05-23  
**Severity**: High (Critical feature broken)  
**Priority**: P0 (Immediate fix required)  
**Status**: Fix Ready, Awaiting Deployment
