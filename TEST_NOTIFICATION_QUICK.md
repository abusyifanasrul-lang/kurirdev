# 🧪 Quick Test: Courier Notification Fix

## ⚡ 5-Minute Test

### Step 1: Verify Trigger (30 seconds)
Open Supabase SQL Editor, run:
```sql
SELECT COUNT(*) as trigger_exists 
FROM pg_trigger 
WHERE tgname = 'trigger_handle_order_notification';
```
✅ **Expected**: `1`

---

### Step 2: Assign Order (2 minutes)
1. Login as **Admin**
2. Go to **Orders** page
3. Find **pending order**
4. Click order → **Assign to courier**
5. Select **online courier**
6. Click **Assign**

---

### Step 3: Check Notification (1 minute)
Run in SQL Editor:
```sql
SELECT 
    title,
    fcm_status,
    sent_at,
    data->>'order_number' as order_number
FROM notifications
WHERE type = 'order_assigned'
ORDER BY sent_at DESC
LIMIT 1;
```

✅ **Expected**:
- New record with recent `sent_at`
- `fcm_status = 'sent'` or `'pending'`
- Matching `order_number`

---

### Step 4: Check Courier Device (1 minute)
**On courier's phone/browser:**
- ✅ Push notification received
- ✅ Notification in app list
- ✅ Title: "🛵 Order Baru — [NUMBER]"

---

## 🚨 If Test Fails

### No notification record created?
```sql
-- Check trigger enabled
SELECT tgenabled FROM pg_trigger 
WHERE tgname = 'trigger_handle_order_notification';
```
Should return `'O'` (enabled)

### Notification created but fcm_status = 'skipped'?
```sql
-- Check courier has token
SELECT fcm_token IS NOT NULL as has_token 
FROM profiles 
WHERE id = 'COURIER_ID';
```
If `false`, courier needs to login again.

### Notification created but fcm_status = 'failed'?
```sql
-- Check error
SELECT fcm_error 
FROM notifications 
WHERE type = 'order_assigned' 
ORDER BY sent_at DESC 
LIMIT 1;
```
Check Edge Function logs in Supabase Dashboard.

---

## ✅ Success = All Green
- ✅ Trigger exists
- ✅ Notification created
- ✅ FCM status = 'sent'
- ✅ Courier received push
- ✅ Notification in app

---

**Quick Reference**: See `NOTIFICATION_FIX_APPLIED.md` for detailed testing
