# Shift Reminder Timing Update

## 📋 Change Summary

**Updated shift reminder notification timing from 90min/60min to 60min/30min**

---

## ⏰ Previous Timing

- ❌ **90 minutes (1.5 hours) before shift** - "Shift kamu akan dimulai dalam 1.5 jam. Jangan lupa klik tombol ON!"
- ✅ **60 minutes (1 hour) before shift** - "Shift kamu akan dimulai dalam 1 jam. Pastikan kamu sudah siap!"

---

## ⏰ New Timing

- ✅ **60 minutes (1 hour) before shift** - "Shift kamu akan dimulai dalam 1 jam. Jangan lupa klik tombol ON!"
- ✅ **30 minutes before shift** - "Shift kamu akan dimulai dalam 30 menit. Pastikan kamu sudah siap!"

---

## 🎯 Rationale

**Why 60min & 30min instead of 90min & 60min?**

1. **More Relevant Timing**: 30 minutes is closer to shift start, giving courier final reminder
2. **Better Preparation**: 60min gives enough time to prepare, 30min is final call
3. **Reduced Early Notifications**: 90min might be too early, courier might forget
4. **Industry Standard**: Most shift-based apps use 60min & 30min pattern

---

## 🔧 Technical Changes

### Database Function Updated

**Function**: `public.schedule_shift_reminders()`

**Changes**:
```sql
-- OLD
v_reminder_90min := v_shift_start_tomorrow - INTERVAL '90 minutes';
v_reminder_60min := v_shift_start_tomorrow - INTERVAL '60 minutes';

-- NEW
v_reminder_60min := v_shift_start_tomorrow - INTERVAL '60 minutes';
v_reminder_30min := v_shift_start_tomorrow - INTERVAL '30 minutes';
```

**Messages Updated**:
- 60min: "Shift kamu akan dimulai dalam 1 jam. Jangan lupa klik tombol ON!"
- 30min: "Shift kamu akan dimulai dalam 30 menit. Pastikan kamu sudah siap!"

---

## 📊 Example Schedule

### Shift A: 06:00 - 14:00

**Reminder Schedule**:
- **05:00** (60min before) → "Shift A kamu akan dimulai dalam 1 jam. Jangan lupa klik tombol ON!"
- **05:30** (30min before) → "Shift A kamu akan dimulai dalam 30 menit. Pastikan kamu sudah siap!"
- **06:00** → Shift starts, attendance system creates records

### Shift B: 14:00 - 22:00

**Reminder Schedule**:
- **13:00** (60min before) → "Shift B kamu akan dimulai dalam 1 jam. Jangan lupa klik tombol ON!"
- **13:30** (30min before) → "Shift B kamu akan dimulai dalam 30 menit. Pastikan kamu sudah siap!"
- **14:00** → Shift starts, attendance system creates records

---

## 🧪 Testing

### Manual Test: Verify New Timing

1. **Check scheduled notifications**:
   ```sql
   SELECT user_id, message, scheduled_at, 
          data->>'reminder_type' as reminder_type 
   FROM scheduled_notifications 
   WHERE sent = false AND type = 'shift_reminder' 
   ORDER BY scheduled_at;
   ```

2. **Expected Results**:
   - Each courier should have 2 notifications
   - One with `reminder_type = '60min'`
   - One with `reminder_type = '30min'`
   - Scheduled times should be 60min and 30min before shift start

3. **Verify Messages**:
   - 60min: Contains "1 jam. Jangan lupa klik tombol ON!"
   - 30min: Contains "30 menit. Pastikan kamu sudah siap!"

---

## 🔄 Migration Steps Performed

### Step 1: Update Function
```sql
CREATE OR REPLACE FUNCTION public.schedule_shift_reminders()
-- Updated to use 60min and 30min intervals
```

### Step 2: Clean Old Notifications
```sql
DELETE FROM scheduled_notifications 
WHERE sent = false AND type = 'shift_reminder';
```

### Step 3: Recreate Notifications
```sql
SELECT public.schedule_shift_reminders();
```

### Step 4: Verify
```sql
SELECT COUNT(*) as total,
       COUNT(CASE WHEN data->>'reminder_type' = '60min' THEN 1 END) as count_60min,
       COUNT(CASE WHEN data->>'reminder_type' = '30min' THEN 1 END) as count_30min
FROM scheduled_notifications 
WHERE sent = false AND type = 'shift_reminder';
```

**Expected**: `count_60min` = `count_30min` (equal number of both types)

---

## 📅 Cron Job Schedule

**No changes needed to cron jobs**:

- ✅ `schedule-shift-reminders-daily` - Still runs daily at 18:00
- ✅ `process-due-notifications-every-5min` - Still runs every 5 minutes

The function automatically uses the new timing when creating notifications.

---

## 🎯 Benefits

### ✅ **More Timely Reminders**
- 60min: Enough time to prepare and travel
- 30min: Final reminder, more urgent

### ✅ **Better User Experience**
- Less "too early" notifications
- More actionable timing
- Clearer urgency progression

### ✅ **Improved Attendance**
- 30min reminder is harder to ignore
- Closer to shift start = better recall
- Two reminders = redundancy

### ✅ **Industry Standard**
- Matches common shift reminder patterns
- Familiar to users from other apps
- Proven effective timing

---

## 📊 Expected Impact

### Before (90min & 60min)
- Some couriers might forget after 90min reminder
- 60min reminder might feel redundant
- Gap between last reminder and shift start: 60 minutes

### After (60min & 30min)
- 60min gives preparation time
- 30min is final urgent reminder
- Gap between last reminder and shift start: **30 minutes** (reduced by 50%)
- Better attendance rates expected

---

## 🔮 Future Enhancements

- [ ] **Configurable Timing**: Allow admin to customize reminder times
- [ ] **Smart Timing**: Adjust based on courier's distance from work location
- [ ] **Escalating Urgency**: Different notification sounds/priority for 30min reminder
- [ ] **Attendance Prediction**: ML model to predict who needs extra reminders
- [ ] **Custom Messages**: Personalized messages based on courier's history

---

## 📁 Files Modified

**Database**:
- ✅ Function `public.schedule_shift_reminders()` - Updated timing logic

**No frontend changes needed** - notifications are handled by backend

---

## ✅ Completion Status

- ✅ Function updated (60min & 30min)
- ✅ Old notifications cleaned
- ✅ New notifications created
- ✅ Timing verified
- ✅ Messages verified
- ✅ Documentation complete

**Status**: ✅ **LIVE**

---

## 📞 Support

If reminders are not received at correct times:

1. **Check function**:
   ```sql
   SELECT routine_definition 
   FROM information_schema.routines 
   WHERE routine_name = 'schedule_shift_reminders';
   ```
   - Should contain `INTERVAL '60 minutes'` and `INTERVAL '30 minutes'`

2. **Check scheduled notifications**:
   ```sql
   SELECT * FROM scheduled_notifications 
   WHERE sent = false AND type = 'shift_reminder' 
   ORDER BY scheduled_at;
   ```
   - Should have both 60min and 30min reminders

3. **Check cron job**:
   ```sql
   SELECT * FROM cron.job 
   WHERE jobname = 'schedule-shift-reminders-daily';
   ```
   - Should be `active = true`

4. **Manual trigger**:
   ```sql
   SELECT public.schedule_shift_reminders();
   ```
   - Should return `success = true` with `scheduled_count > 0`

---

**Date**: 2026-05-09  
**Status**: ✅ **DEPLOYED**
