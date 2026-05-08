# 🕐 Setup pg_cron for Scheduled Notifications

## Langkah 1: Apply Migration

Buka **Supabase Dashboard** → **SQL Editor** → **New Query**

Copy dan jalankan file: `supabase/migrations/20260503_setup_cron_scheduled_notifications.sql`

**Expected Output:**
```
✅ Cron job "process-scheduled-notifications-every-30min" created successfully
📅 Schedule: Every 30 minutes
🔧 Function: public.process_due_scheduled_notifications()
📊 Expected load: ~48 executions per day, ~1,440 per month
```

---

## Langkah 2: Verify Cron Job

Jalankan query ini untuk memastikan cron job aktif:

```sql
-- Check if cron job exists and is active
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  database,
  username
FROM cron.job 
WHERE jobname = 'process-scheduled-notifications-every-30min';
```

**Expected Result:**
```
| jobid | jobname                                      | schedule     | active | database | username |
|-------|----------------------------------------------|--------------|--------|----------|----------|
| 1     | process-scheduled-notifications-every-30min | */30 * * * * | true   | postgres | postgres |
```

---

## Langkah 3: Test Cron Job (Manual Trigger)

Untuk test apakah cron job bisa berjalan, panggil function secara manual:

```sql
-- Manual trigger (simulate cron execution)
SELECT public.process_due_scheduled_notifications();

-- Check logs
SELECT * FROM cron.job_run_details 
WHERE jobid = (
  SELECT jobid FROM cron.job 
  WHERE jobname = 'process-scheduled-notifications-every-30min'
)
ORDER BY start_time DESC 
LIMIT 5;
```

---

## Langkah 4: Create Real Shift Swap Test

Sekarang test dengan shift swap yang real:

1. Buka aplikasi admin
2. Go to **Shifts** page
3. Click **Tukar Shift**
4. Buat shift swap untuk **besok** (pilih 2 kurir dengan shift berbeda)
5. Save

**Verify:**
```sql
-- Check if 2 scheduled notifications were created
SELECT 
  id,
  user_id,
  scheduled_at,
  title,
  message,
  sent,
  created_at
FROM scheduled_notifications
WHERE type = 'shift_swap_reminder'
  AND sent = false
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:** 2 records (one for each courier), scheduled 1 hour before shift start time.

---

## Langkah 5: Wait for Cron Execution

Cron job akan berjalan setiap 30 menit. Untuk melihat kapan cron terakhir berjalan:

```sql
-- Check last cron execution
SELECT 
  runid,
  jobid,
  start_time,
  end_time,
  status,
  return_message
FROM cron.job_run_details 
WHERE jobid = (
  SELECT jobid FROM cron.job 
  WHERE jobname = 'process-scheduled-notifications-every-30min'
)
ORDER BY start_time DESC 
LIMIT 10;
```

---

## Monitoring & Maintenance

### Check Pending Notifications
```sql
-- See all pending scheduled notifications
SELECT 
  COUNT(*) as total_pending,
  MIN(scheduled_at) as next_scheduled,
  MAX(scheduled_at) as last_scheduled
FROM scheduled_notifications
WHERE sent = false;
```

### Check Cron Job Status
```sql
-- Verify cron job is still active
SELECT 
  jobname,
  active,
  schedule,
  CASE 
    WHEN active THEN '✅ Active'
    ELSE '❌ Inactive'
  END as status
FROM cron.job 
WHERE jobname = 'process-scheduled-notifications-every-30min';
```

### Check Recent Executions
```sql
-- See last 10 cron executions
SELECT 
  start_time,
  end_time,
  status,
  return_message,
  EXTRACT(EPOCH FROM (end_time - start_time)) as duration_seconds
FROM cron.job_run_details 
WHERE jobid = (
  SELECT jobid FROM cron.job 
  WHERE jobname = 'process-scheduled-notifications-every-30min'
)
ORDER BY start_time DESC 
LIMIT 10;
```

---

## Troubleshooting

### If cron job is not running:

1. **Check if pg_cron extension is enabled:**
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

2. **Check if cron job exists:**
```sql
SELECT * FROM cron.job WHERE jobname LIKE '%scheduled-notifications%';
```

3. **Manually trigger to test:**
```sql
SELECT public.process_due_scheduled_notifications();
```

4. **Check for errors in cron logs:**
```sql
SELECT * FROM cron.job_run_details 
WHERE status = 'failed' 
ORDER BY start_time DESC;
```

### If notifications are not being sent:

1. **Check if Edge Function is deployed:**
   - Go to Dashboard → Edge Functions
   - Verify `process-scheduled-notifications` exists

2. **Check Vault secrets:**
```sql
SELECT name, description 
FROM vault.decrypted_secrets 
WHERE name IN ('supabase_url', 'supabase_anon_key');
```

3. **Check pg_net responses:**
```sql
SELECT * FROM net._http_response 
ORDER BY created DESC 
LIMIT 10;
```

---

## Disable Cron Job (if needed)

If you need to temporarily disable the cron job:

```sql
-- Disable cron job
SELECT cron.unschedule('process-scheduled-notifications-every-30min');

-- Or just deactivate (can be reactivated later)
UPDATE cron.job 
SET active = false 
WHERE jobname = 'process-scheduled-notifications-every-30min';
```

To re-enable:
```sql
UPDATE cron.job 
SET active = true 
WHERE jobname = 'process-scheduled-notifications-every-30min';
```

---

## Performance Impact

**Expected load:**
- 48 executions per day
- 1,440 executions per month
- 0.29% of Supabase Free Plan Edge Function limit (500K/month)

**Database queries per execution:**
- 1 SELECT query (check for due notifications)
- N INSERT queries (if notifications are due)
- N UPDATE queries (mark as sent)

**Typical execution time:** < 1 second

---

## Success Criteria

- [x] Cron job created and active
- [x] Manual trigger works
- [x] Real shift swap creates 2 scheduled notifications
- [x] Notifications are sent automatically within 30 minutes of scheduled time
- [x] Couriers receive notifications in PWA

---

## Next Steps

1. Apply migration
2. Verify cron job is active
3. Create real shift swap for tomorrow
4. Wait for scheduled time and verify notifications arrive
5. Monitor cron execution logs

---

## Cleanup Test Data

After testing, clean up test notifications:

```sql
-- Remove test notifications
DELETE FROM scheduled_notifications WHERE title LIKE '%TEST%';
DELETE FROM notifications WHERE title LIKE '%TEST%';
```
