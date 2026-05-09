# Automatic Attendance System

## Overview

Sistem kehadiran otomatis yang membuat dan memantau attendance records secara real-time tanpa memerlukan check-in manual dari kurir.

## Cara Kerja

### 1. **Automatic Record Creation (Saat Shift Dimulai)**

Ketika waktu shift dimulai (misalnya 06:00), sistem otomatis:

- ✅ Membaca semua kurir yang di-assign ke shift tersebut
- ✅ Mengecek status `is_online` setiap kurir
- ✅ Membuat record `shift_attendance`:
  - **ON TIME**: Jika kurir sudah klik ON (`is_online = true`)
  - **LATE**: Jika kurir belum klik ON (`is_online = false`)

**Edge Function**: `process-shift-attendance`
- Runs: **Setiap menit** (cron: `* * * * *`)
- Checks: Apakah ada shift yang mulai dalam 1 menit window
- Creates: Attendance records untuk semua kurir di shift tersebut

### 2. **Real-time Late Minutes Tracking**

Setiap menit, sistem:

- ✅ Update `late_minutes` untuk kurir yang statusnya `late`
- ✅ Hitung selisih waktu dari shift start time
- ✅ Display di `/admin/attendance` secara real-time

**Contoh**:
- Shift A mulai: 06:00
- Kurir belum ON: Status `late`, `late_minutes = 0`
- Jam 06:15: `late_minutes = 15`
- Jam 07:00: `late_minutes = 60` → Admin bisa apply denda

### 3. **Check-in When Courier Clicks ON**

Ketika kurir klik tombol ON:

- ✅ Trigger `on_courier_check_in` aktif
- ✅ Update `first_online_at` di attendance record
- ✅ Status tetap `late` jika terlambat, atau `on_time` jika tepat waktu

**Database Trigger**: `handle_courier_check_in()`
- Triggers: Saat `is_online` berubah dari `false` → `true`
- Updates: `shift_attendance.first_online_at` dan `status`

### 4. **Shift Reminder Notifications**

Sistem mengirim notifikasi reminder ke kurir:

- ⏰ **90 menit sebelum shift**: "Shift kamu akan dimulai dalam 1.5 jam"
- ⏰ **60 menit sebelum shift**: "Shift kamu akan dimulai dalam 1 jam"

**Scheduling**:
- Function: `schedule_shift_reminders()`
- Runs: **Setiap hari jam 18:00** (cron: `0 18 * * *`)
- Creates: Records di `scheduled_notifications` untuk besok

**Processing**:
- Function: `process_due_scheduled_notifications()`
- Runs: **Setiap 5 menit** (cron: `*/5 * * * *`)
- Sends: Notifikasi yang sudah waktunya via FCM

## Database Schema

### Table: `scheduled_notifications`

```sql
CREATE TABLE scheduled_notifications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  data JSONB DEFAULT '{}',
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Updated: `shift_attendance`

Kolom yang digunakan:
- `first_online_at`: Waktu kurir klik ON (check-in)
- `late_minutes`: Menit keterlambatan (auto-update setiap menit)
- `status`: `on_time`, `late`, `late_minor`, `late_major`, `alpha`, `excused`

## Cron Jobs

### 1. `process-shift-attendance-every-minute`
```
Schedule: * * * * * (every minute)
Function: invoke_process_shift_attendance()
Purpose: Create attendance records & update late_minutes
```

### 2. `schedule-shift-reminders-daily`
```
Schedule: 0 18 * * * (daily at 6 PM)
Function: schedule_shift_reminders()
Purpose: Schedule shift reminders for tomorrow
```

### 3. `process-due-notifications-every-5min`
```
Schedule: */5 * * * * (every 5 minutes)
Function: process_due_scheduled_notifications()
Purpose: Send scheduled notifications via FCM
```

## Edge Functions

### `process-shift-attendance`

**URL**: `/functions/v1/process-shift-attendance`

**Authentication**: Service Role Key (JWT required)

**Logic**:
1. Get current time and date
2. Check if today is holiday → skip if yes
3. Loop through all active shifts
4. For each shift starting now (±1 minute):
   - Get all couriers in that shift
   - Skip if courier's day_off matches today
   - Create attendance record:
     - `on_time` if `is_online = true`
     - `late` if `is_online = false`
5. Update `late_minutes` for existing late records

**Response**:
```json
{
  "success": true,
  "message": "Attendance processing completed",
  "timestamp": "2026-05-09T06:00:00Z",
  "timezone": "Asia/Makassar",
  "records_created": 5,
  "records_updated": 2
}
```

## Admin Dashboard

### `/admin/attendance`

**Features**:
- ✅ Real-time monitoring kehadiran hari ini
- ✅ Summary cards: Total Online, Tepat Waktu, Menunggu Review, Denda Aktif
- ✅ Warning section untuk kurir yang belum check-in:
  - 🔴 **Critical**: Terlambat ≥60 menit
  - 🟡 **Warning**: Terlambat 1-59 menit
- ✅ Table dengan detail:
  - Nama kurir, shift, check-in time, late minutes
  - Status badge (ON TIME, WAITING REVIEW, DENDA AKTIF, etc.)
  - Action buttons: APPLY DENDA, MAAFKAN

**Real-time Updates**:
- Subscription ke `shift_attendance` table
- Auto-refresh setiap 60 detik untuk update `late_minutes`

## Courier Dashboard

### Attendance Widget

**Visibility**: Hanya tampil jika kurir terlambat

**Display**: 
```
⚠️ Shift B • Terlambat 71 menit
```

**Click Action**: Navigate ke `/courier/profile` tab "Kehadiran"

### Profile Page - Tab Kehadiran

**Features**:
- ✅ Riwayat kehadiran lengkap
- ✅ Status badge untuk setiap hari
- ✅ Detail denda (jika ada)
- ✅ Notes dari admin

## Special Cases

### 1. **Holiday**
- System checks `holidays` table
- If today is holiday (`is_active = true`), skip attendance processing
- No records created, no reminders sent

### 2. **Day Off**
- Each courier has `day_off` field (e.g., "Monday", "Tuesday")
- System skips courier if today matches their day_off
- No attendance record created

### 3. **Late Check-in**
- Courier clicks ON after shift started
- Trigger updates `first_online_at` with current time
- Status remains `late`, `late_minutes` calculated from shift start

### 4. **Overnight Shifts**
- Shifts with `is_overnight = true` (e.g., 22:00 - 06:00)
- System handles date transition correctly
- Attendance record created on shift start date

## Testing

### Manual Test: Create Attendance Record

```sql
-- Simulate shift starting now
SELECT public.invoke_process_shift_attendance();
```

### Manual Test: Schedule Reminders

```sql
-- Schedule reminders for tomorrow
SELECT public.schedule_shift_reminders();
```

### Manual Test: Process Notifications

```sql
-- Send due notifications
SELECT public.process_due_scheduled_notifications();
```

### Check Cron Jobs Status

```sql
-- View all cron jobs
SELECT * FROM cron.job ORDER BY jobname;

-- View cron job run history
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;
```

## Troubleshooting

### Attendance records not created?

1. Check if shift is active: `SELECT * FROM shifts WHERE is_active = true;`
2. Check if couriers assigned: `SELECT * FROM profiles WHERE shift_id = '<shift_id>';`
3. Check cron job status: `SELECT * FROM cron.job WHERE jobname = 'process-shift-attendance-every-minute';`
4. Check Edge Function logs in Supabase Dashboard

### Notifications not sent?

1. Check scheduled notifications: `SELECT * FROM scheduled_notifications WHERE sent = false;`
2. Check cron job: `SELECT * FROM cron.job WHERE jobname LIKE '%notification%';`
3. Verify FCM tokens: `SELECT fcm_token FROM profiles WHERE role = 'courier';`

### Late minutes not updating?

1. Check if cron job running: `SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-shift-attendance-every-minute') ORDER BY start_time DESC LIMIT 5;`
2. Manually trigger: `SELECT public.invoke_process_shift_attendance();`
3. Check Edge Function response in logs

## Configuration

### Timezone

Default: `Asia/Makassar`

Change in settings:
```sql
UPDATE settings 
SET operational_timezone = 'Asia/Jakarta' 
WHERE id = 'global';
```

### Reminder Times

Currently: 90 minutes and 60 minutes before shift

To change, edit `schedule_shift_reminders()` function:
```sql
v_reminder_90min := v_shift_start_tomorrow - INTERVAL '90 minutes';
v_reminder_60min := v_shift_start_tomorrow - INTERVAL '60 minutes';
```

### Cron Schedule

To change frequency, update cron job:
```sql
-- Change to every 2 minutes
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'process-shift-attendance-every-minute'),
  schedule := '*/2 * * * *'
);
```

## Benefits

✅ **No Manual Check-in Required**: System creates records automatically
✅ **Real-time Monitoring**: Admin sees late couriers immediately
✅ **Proactive Reminders**: Couriers notified before shift starts
✅ **Accurate Tracking**: Late minutes calculated every minute
✅ **Fair System**: Records created at exact shift start time
✅ **Scalable**: Handles multiple shifts and hundreds of couriers
✅ **Reliable**: Cron jobs ensure consistent execution

## Future Enhancements

- [ ] SMS reminders for couriers without FCM token
- [ ] Auto-apply denda after certain late threshold
- [ ] Weekly attendance summary report
- [ ] Attendance analytics dashboard
- [ ] Integration with payroll system
