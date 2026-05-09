# Automatic Shift End System

## Overview

Sistem otomatis yang mengakhiri shift kurir tanpa memerlukan action manual. Shift berakhir otomatis saat waktu shift selesai dan kurir tidak memiliki order aktif.

## How It Works

### 🎯 Core Concept

**Kurir TIDAK perlu klik "Selesai Shift"**. Sistem otomatis mendeteksi dan mengakhiri shift berdasarkan kondisi:

1. ✅ Waktu shift sudah berakhir
2. ✅ Kurir tidak memiliki order aktif
3. ✅ Auto set `is_online = false`

---

## 🔄 Dual Mechanism

### 1. **Cron Job** (Saat Shift Berakhir)

**Runs**: Every minute (`* * * * *`)

**Logic**:
```typescript
1. Get current time (e.g., 14:00)
2. Find shifts that ended in last 1 minute (e.g., end_time = 14:00)
3. If no shifts ended → SKIP (0 processing)
4. If shift ended → Get couriers in that shift
5. For each courier:
   - Check: Has active orders?
   - If NO → Auto shift end + set offline
   - If YES → Skip (wait for orders to complete)
```

**Example**:
- **13:59**: No shifts ended → Skip
- **14:00**: Shift A ended → Process only Shift A couriers (5-10 kurir)
- **14:01-14:59**: No shifts ended → Skip (59 minutes idle)
- **15:00**: Shift B ended → Process only Shift B couriers

**Efficiency**:
- NOT processing all couriers every minute
- ONLY process when shift ends
- ~6 shifts per day × 10 couriers = 60 queries/day (not 144,000!)

---

### 2. **Database Trigger** (Saat Order Selesai)

**Triggers**: When order status changes to `delivered` or `cancelled`

**Logic**:
```sql
1. Order completed (delivered/cancelled)
2. Check: Has courier's shift ended?
3. If NO → Skip
4. If YES:
   - Check: Any other active orders?
   - If NO → Auto shift end + set offline
   - If YES → Skip (wait for other orders)
```

**Example**:
- Kurir B has 2 active orders when shift ends at 14:00
- Cron job skips Kurir B (has active orders)
- 14:15: Order #1 delivered → Trigger checks → Still has Order #2 → Skip
- 14:30: Order #2 delivered → Trigger checks → No more orders → **Auto shift end**

---

## 📊 Complete Flow Example

### Scenario: Shift A (06:00-14:00), 5 Couriers

**14:00** - Shift A berakhir:

| Courier | Active Orders | Action | Result |
|---------|---------------|--------|--------|
| Kurir A | 0 | ✅ Auto shift end | Offline |
| Kurir B | 2 | ⏳ Skip | Wait for orders |
| Kurir C | 0 | ✅ Auto shift end | Offline |
| Kurir D | 1 | ⏳ Skip | Wait for order |
| Kurir E | 0 | ✅ Auto shift end | Offline |

**14:15** - Kurir B's Order #1 delivered:
- Trigger fires
- Check: Still has Order #2
- ⏳ Skip (wait)

**14:30** - Kurir B's Order #2 delivered:
- Trigger fires
- Check: No more active orders
- ✅ **Auto shift end** + set offline

**14:45** - Kurir D's order delivered:
- Trigger fires
- Check: No more active orders
- ✅ **Auto shift end** + set offline

**Final Result**: All 5 couriers automatically offline, no manual action needed!

---

## 🛠️ Technical Implementation

### Database Function

```sql
-- Function: auto_shift_end_if_ready(courier_id)
-- Returns: JSONB with success status

Checks:
1. Courier has shift assigned?
2. Shift has ended?
3. Attendance record exists for today?
4. Shift not already ended (last_online_at IS NULL)?
5. No active orders?

If all conditions met:
  - Call record_shift_end(courier_id)
  - Set is_online = false
  - Return success
```

### Database Trigger

```sql
-- Trigger: on_order_complete_auto_shift_end
-- Fires: AFTER UPDATE OF status ON orders
-- When: status IN ('delivered', 'cancelled')

Action:
  - Call auto_shift_end_if_ready(courier_id)
  - Auto shift end if conditions met
```

### Edge Function

```typescript
// Function: process-auto-shift-end
// Runs: Every minute via cron

Logic:
1. Get current time
2. Find shifts that just ended (±1 minute)
3. For each ended shift:
   - Get couriers in that shift
   - Call auto_shift_end_if_ready() for each
4. Return stats (processed, success, skipped)
```

### Cron Job

```sql
-- Job: auto-shift-end-every-minute
-- Schedule: * * * * * (every minute)
-- Action: Invoke process-auto-shift-end Edge Function
```

---

## 🎯 Benefits

### ✅ **Automatic**
- No manual "Selesai Shift" button needed
- Kurir tidak perlu ingat untuk klik
- Sistem handle semuanya

### ✅ **Smart**
- Tunggu sampai order selesai
- Tidak force offline saat masih ada order
- Otomatis offline saat order terakhir selesai

### ✅ **Efficient**
- Hanya process saat shift berakhir
- Tidak query semua kurir setiap menit
- Minimal database load

### ✅ **Reliable**
- Dual mechanism (cron + trigger)
- Tidak tergantung user action
- Jalan di server 24/7

### ✅ **Scalable**
- Handle 100+ couriers
- Efficient query pattern
- No performance issues

---

## 🧪 Testing

### Manual Test: Trigger Cron Job

```sql
-- Manually invoke the Edge Function
SELECT public.invoke_process_auto_shift_end();
```

### Manual Test: Auto Shift End for Specific Courier

```sql
-- Test auto shift end for a courier
SELECT public.auto_shift_end_if_ready('courier-uuid-here');

-- Expected responses:
-- Success: {"success": true, "courier_id": "...", "shift_ended_at": "..."}
-- Skip: {"success": false, "reason": "Courier has active orders", "active_orders": 2}
-- Skip: {"success": false, "reason": "Shift has not ended yet"}
-- Skip: {"success": false, "reason": "Shift already ended"}
```

### Check Cron Job Status

```sql
-- View cron jobs
SELECT * FROM cron.job WHERE jobname LIKE '%shift-end%';

-- View cron job run history
SELECT * 
FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-shift-end-every-minute')
ORDER BY start_time DESC 
LIMIT 10;
```

### Check Edge Function Logs

Go to Supabase Dashboard → Edge Functions → process-auto-shift-end → Logs

Look for:
- `[Auto Shift End] Processing at HH:MM:SS`
- `[Auto Shift End] Shift X ended at HH:MM:SS`
- `✅ Auto shift end: Courier Name`
- `⏭️ Skipped Courier Name: reason`

---

## 🔍 Troubleshooting

### Shift not ending automatically?

1. **Check cron job is running**:
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'auto-shift-end-every-minute';
   -- active should be true
   ```

2. **Check cron job execution**:
   ```sql
   SELECT * FROM cron.job_run_details 
   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-shift-end-every-minute')
   ORDER BY start_time DESC LIMIT 5;
   ```

3. **Manually test function**:
   ```sql
   SELECT public.auto_shift_end_if_ready('courier-uuid');
   -- Check the reason if success = false
   ```

4. **Check Edge Function logs** in Supabase Dashboard

### Courier still online after shift ended?

**Possible reasons**:
- Courier has active orders → Wait for orders to complete
- Shift not actually ended yet → Check shift end_time
- Attendance record missing → Check shift_attendance table
- Cron job not running → Check cron.job table

**Debug**:
```sql
-- Check courier's active orders
SELECT * FROM orders 
WHERE courier_id = 'courier-uuid' 
  AND status NOT IN ('delivered', 'cancelled');

-- Check courier's attendance today
SELECT * FROM shift_attendance 
WHERE courier_id = 'courier-uuid' 
  AND date = CURRENT_DATE;

-- Check courier's shift
SELECT s.* FROM profiles p
JOIN shifts s ON s.id = p.shift_id
WHERE p.id = 'courier-uuid';
```

---

## 📝 Database Schema Changes

### New Functions

1. `auto_shift_end_if_ready(p_courier_id UUID)` → JSONB
2. `trigger_auto_shift_end_on_order_complete()` → TRIGGER
3. `invoke_process_auto_shift_end()` → VOID

### New Trigger

- `on_order_complete_auto_shift_end` on `orders` table

### New Cron Job

- `auto-shift-end-every-minute` (runs every minute)

### New Edge Function

- `process-auto-shift-end` (invoked by cron job)

---

## 🚀 Deployment

All components deployed:
- ✅ Database functions
- ✅ Database trigger
- ✅ Edge Function
- ✅ Cron job

**Status**: ACTIVE and running

---

## 📈 Performance Metrics

### Expected Load

**Per Day**:
- Cron executions: 1,440 (every minute)
- Actual processing: ~6-8 times (only when shifts end)
- Couriers processed: ~60-80 per day
- Database queries: ~100-150 per day

**Per Minute**:
- Most minutes: 0 queries (no shifts ending)
- When shift ends: 10-20 queries (process that shift's couriers)

**Scalability**:
- 100 couriers: No problem
- 500 couriers: Still efficient
- 1000+ couriers: May need optimization (batch processing)

---

## 🔮 Future Enhancements

- [ ] Notification to courier when shift auto-ended
- [ ] Admin dashboard to see auto shift end history
- [ ] Analytics: Average shift duration, overtime tracking
- [ ] Grace period: Allow 5-10 minutes after shift end before auto-offline
- [ ] Manual override: Admin can force shift end even with active orders

---

## ⚠️ Important Notes

1. **Courier TIDAK perlu klik "Selesai Shift"** - Sistem otomatis
2. **Kurir dengan order aktif** - Shift end otomatis saat order terakhir selesai
3. **Tidak ada manual button** - UI tidak perlu tombol "Selesai Shift"
4. **Dual mechanism** - Cron job + trigger untuk reliability
5. **Efficient** - Hanya process saat shift berakhir, bukan setiap menit untuk semua kurir

---

## 📞 Support

Jika ada masalah:
1. Check cron job status
2. Check Edge Function logs
3. Test manual dengan `auto_shift_end_if_ready()`
4. Check database trigger
5. Verify shift end_time configuration
