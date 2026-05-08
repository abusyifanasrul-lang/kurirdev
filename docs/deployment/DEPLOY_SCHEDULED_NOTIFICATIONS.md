# 🚀 Deploy Scheduled Notifications System

## Langkah 1: Deploy Migration Files

### 1.1 Create Table (jika belum)
Buka **Supabase Dashboard** → **SQL Editor** → **New Query**

Copy dan jalankan file: `supabase/migrations/20260503_create_scheduled_notifications.sql`

**Expected Result:** 
```
✅ Table 'scheduled_notifications' created
✅ Indexes created
✅ RLS policies created
✅ Trigger for updated_at created
```

---

### 1.2 Setup Trigger & pg_net
Buka **Supabase Dashboard** → **SQL Editor** → **New Query**

Copy dan jalankan file: `supabase/migrations/20260503_setup_scheduled_notifications_trigger.sql`

**Expected Result:**
```
✅ pg_net extension enabled
✅ Function 'schedule_notification_processing' created
✅ Trigger 'trigger_schedule_notification_processing' created
✅ Function 'process_due_scheduled_notifications' created
```

---

## Langkah 2: Deploy Edge Function

### Option A: Via Supabase CLI (jika sudah setup)
```bash
cd supabase/functions
supabase functions deploy process-scheduled-notifications
```

### Option B: Manual via Dashboard
1. Buka **Supabase Dashboard** → **Edge Functions**
2. Click **Create Function**
3. Name: `process-scheduled-notifications`
4. Copy paste isi file: `supabase/functions/process-scheduled-notifications/index.ts`
5. Click **Deploy**

---

## Langkah 3: Verify Vault Secrets

Buka **Supabase Dashboard** → **SQL Editor** → **New Query**

```sql
-- Check if secrets exist
SELECT 
  name,
  description,
  CASE 
    WHEN decrypted_secret IS NOT NULL THEN '✅ Secret exists'
    ELSE '❌ Secret missing'
  END as status
FROM vault.decrypted_secrets
WHERE name IN ('supabase_url', 'supabase_anon_key');
```

**Expected Result:**
```
| name              | description                    | status            |
|-------------------|--------------------------------|-------------------|
| supabase_url      | URL proyek Supabase            | ✅ Secret exists  |
| supabase_anon_key | Kunci anonim untuk akses API   | ✅ Secret exists  |
```

---

## Langkah 4: Run Test Script

Buka **Supabase Dashboard** → **SQL Editor** → **New Query**

Copy dan jalankan file: `test-scheduled-notifications.sql`

**Expected Results:**
- ✅ Table exists
- ✅ Trigger exists
- ✅ Vault secrets exist
- ✅ Test notification created (scheduled 2 minutes from now)

---

## Langkah 5: Wait & Verify

### After 2-3 minutes, check if notification was sent:

```sql
-- Check if notification was sent to notifications table
SELECT * 
FROM notifications 
WHERE type = 'shift_swap_reminder' 
  AND title LIKE '%TEST%'
ORDER BY created_at DESC;

-- Check if scheduled notification is marked as sent
SELECT 
  id,
  scheduled_at,
  sent,
  sent_at,
  title
FROM scheduled_notifications 
WHERE type = 'shift_swap_reminder' 
  AND title LIKE '%TEST%'
ORDER BY created_at DESC;
```

**Expected Result:**
- ✅ Notification appears in `notifications` table
- ✅ `scheduled_notifications.sent = true`
- ✅ `scheduled_notifications.sent_at` has timestamp

---

## Langkah 6: Test with Real Shift Swap

1. Buka aplikasi admin
2. Go to **Shifts** page
3. Click **Tukar Shift** button
4. Create a shift swap for tomorrow
5. Check database:

```sql
-- Should see 2 scheduled notifications (one for each courier)
SELECT 
  id,
  user_id,
  scheduled_at,
  title,
  message,
  sent
FROM scheduled_notifications
WHERE type = 'shift_swap_reminder'
  AND sent = false
ORDER BY created_at DESC;
```

---

## Troubleshooting

### If notification doesn't arrive:

1. **Check pg_net queue:**
```sql
SELECT * FROM net._http_response ORDER BY created_at DESC LIMIT 10;
```

2. **Manually trigger safety net:**
```sql
SELECT public.process_due_scheduled_notifications();
```

3. **Check Edge Function logs:**
   - Go to **Supabase Dashboard** → **Edge Functions** → `process-scheduled-notifications` → **Logs**

4. **Check trigger logs:**
```sql
-- Enable logging
SET client_min_messages TO NOTICE;

-- Insert test notification and watch logs
INSERT INTO scheduled_notifications (
  user_id,
  scheduled_at,
  title,
  message,
  type
) VALUES (
  (SELECT id FROM profiles WHERE role = 'courier' LIMIT 1),
  NOW() + INTERVAL '2 minutes',
  'Debug Test',
  'Testing trigger',
  'test'
);
```

---

## Cleanup Test Data

```sql
-- Remove test notifications
DELETE FROM scheduled_notifications WHERE title LIKE '%TEST%';
DELETE FROM notifications WHERE title LIKE '%TEST%';
```

---

## ✅ Success Criteria

- [ ] Table `scheduled_notifications` exists
- [ ] Trigger `trigger_schedule_notification_processing` exists
- [ ] Vault secrets configured
- [ ] Edge Function deployed
- [ ] Test notification sent successfully
- [ ] Real shift swap creates 2 scheduled notifications
- [ ] Notifications arrive 1 hour before shift time

---

## 📊 Monitoring

### Check scheduled notifications status:
```sql
SELECT 
  COUNT(*) FILTER (WHERE sent = false) as pending,
  COUNT(*) FILTER (WHERE sent = true) as sent,
  COUNT(*) as total
FROM scheduled_notifications;
```

### Check upcoming notifications:
```sql
SELECT 
  id,
  user_id,
  scheduled_at,
  title,
  EXTRACT(EPOCH FROM (scheduled_at - NOW())) / 3600 as hours_until_send
FROM scheduled_notifications
WHERE sent = false
  AND scheduled_at > NOW()
ORDER BY scheduled_at ASC;
```

---

## 🔧 Manual Trigger (for testing)

If you want to test immediately without waiting:

```sql
-- Call Edge Function directly
SELECT net.http_post(
  url := 'https://bunycotovavltxmutier.supabase.co/functions/v1/process-scheduled-notifications',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1bnljb3RvdmF2bHR4bXV0aWVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MTQ2NTMsImV4cCI6MjA4NjQ5MDY1M30.dq_QQCQ5ub8RCc5u-Udn3ekVXvSMX59KIBMpT_BzXzw'
  ),
  body := '{}'::jsonb
);
```
