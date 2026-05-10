# Cron Job Timezone Conversion Fix

## Problem

Shift reminder notifications (60min and 30min before shift) were not being sent to couriers because cron jobs were scheduled at wrong times.

### Root Cause

**Cron schedules use UTC time**, but `sync_shift_cron_jobs()` function was extracting hours/minutes from TIME columns (which represent local time) without timezone conversion.

Example for shift coba111 (start 08:40 local / Asia/Makassar):
- **Before fix**: Cron created as `40 08 * * *` (08:40 UTC = 16:40 local) ❌
- **After fix**: Cron created as `40 00 * * *` (00:40 UTC = 08:40 local) ✅

### Impact

- 60min reminder: Should fire at 07:40 local, but was scheduled for 13:00 local (5+ hours late)
- 30min reminder: Should fire at 08:10 local, but was scheduled for 15:40 local (7+ hours late)
- Result: **No reminders were ever sent** because the times were completely wrong

## Solution

Updated `sync_shift_cron_jobs()` function to properly convert local time to UTC:

1. Get `operational_timezone` from `settings` table (single source of truth)
2. Construct TIMESTAMPTZ by combining today's date + shift time in operational timezone
3. Convert to UTC using `AT TIME ZONE` operator
4. Extract hours/minutes from UTC timestamp for cron schedule

### Code Changes

```sql
-- OLD (WRONG): Direct extraction from TIME column
v_start_hour := LPAD(EXTRACT(HOUR FROM v_shift.start_time)::TEXT, 2, '0');
v_start_minute := LPAD(EXTRACT(MINUTE FROM v_shift.start_time)::TEXT, 2, '0');

-- NEW (CORRECT): Convert to UTC first
v_start_utc := (v_today_local + v_shift.start_time) AT TIME ZONE v_operational_tz;
v_start_hour := LPAD(EXTRACT(HOUR FROM v_start_utc)::TEXT, 2, '0');
v_start_minute := LPAD(EXTRACT(MINUTE FROM v_start_utc)::TEXT, 2, '0');
```

## Verification

### Shift coba111 (start 08:40 local)

| Event | Schedule UTC | Waktu Local | Status |
|-------|-------------|-------------|--------|
| 60min reminder | `40 23 * * *` | 07:40 | ✅ |
| 30min reminder | `10 00 * * *` | 08:10 | ✅ |
| Attendance start | `40 00 * * *` | 08:40 | ✅ |
| Auto shift end | `00 02 * * *` | 10:00 | ✅ |

### Shift coba222 (start 07:40 local)

| Event | Schedule UTC | Waktu Local | Status |
|-------|-------------|-------------|--------|
| 60min reminder | `40 22 * * *` | 06:40 | ✅ |
| 30min reminder | `10 23 * * *` | 07:10 | ✅ |
| Attendance start | `40 23 * * *` | 07:40 | ✅ |
| Auto shift end | `00 01 * * *` | 09:00 | ✅ |

## Deployment

Migration applied: `fix_cron_timezone_conversion`

```sql
SELECT public.sync_shift_cron_jobs();
-- Result: {"created": 0, "deleted": 0, "updated": 24, "timezone": "Asia/Makassar"}
```

All 24 cron jobs (6 shifts × 4 jobs each) successfully updated with correct UTC schedules.

## Testing

To verify reminders are working:

1. Wait for next scheduled reminder time (check cron.job table for schedule)
2. Check `scheduled_notifications` table for new entries
3. Check courier's notification history in app
4. Verify FCM push notification received on device

## Related Files

- Database function: `public.sync_shift_cron_jobs()`
- Database trigger: `on_shift_change_sync_cron` (auto-syncs when shifts table changes)
- Cron jobs: `cron.job` table (filter: `jobname LIKE 'shift-%'`)
- Scheduled notifications: `scheduled_notifications` table
- Edge function: `process-scheduled-notifications` (processes and sends notifications)

## Notes

- Cron jobs are automatically synced when shifts are created/updated/deleted via database trigger
- Manual sync can be triggered: `SELECT public.sync_shift_cron_jobs();`
- Timezone is read from `settings.operational_timezone` (default: Asia/Jakarta)
- Frontend timezone utility: `src/utils/date.ts` (single source of truth for frontend)
