# Attendance Timezone Bug Fix

## Problem

**Issue:** Attendance system menunjukkan `late_minutes` yang salah (1438 menit = ~24 jam) karena timezone mismatch.

**Example:**
- Dimas terlambat 12 menit (shift start 07:40, online 07:52)
- System menunjukkan "Terlambat 1438 Menit"
- Widget tidak muncul di dashboard kurir

## Root Cause

Edge Function `process-shift-attendance` menggunakan **UTC time** untuk menghitung `late_minutes`, bukan **operational timezone** (Asia/Jakarta).

**Bug Flow:**
1. `currentDate` = `2026-05-09` (UTC date, kemarin)
2. `shift.start_time` = `07:40:00`
3. `shiftStartDateTime` = `2026-05-09T07:40:00` (kemarin jam 07:40)
4. `now` = `2026-05-10 06:58` (sekarang di WIB)
5. `lateMinutes` = (sekarang - kemarin jam 07:40) = **~23 jam = 1438 menit** ❌

## Solution

Changed Edge Function to use **operational timezone** for all date/time calculations:

### Before:
```typescript
const now = new Date()
const currentTime = now.toTimeString().slice(0, 8) // UTC time
const currentDate = now.toISOString().split('T')[0] // UTC date
```

### After:
```typescript
// Get current time in operational timezone using PostgreSQL
const { data: timeData } = await supabase.rpc('execute_sql', {
  query: `
    SELECT 
      (NOW() AT TIME ZONE '${timezone}')::date as current_date,
      (NOW() AT TIME ZONE '${timezone}')::time as current_time,
      NOW() AT TIME ZONE '${timezone}' as current_timestamp,
      TRIM(TO_CHAR(NOW() AT TIME ZONE '${timezone}', 'Day')) as day_name
  `
})

const currentDate = timeData[0].current_date // YYYY-MM-DD in operational timezone
const currentTime = timeData[0].current_time.slice(0, 8) // HH:MM:SS in operational timezone
const currentTimestamp = new Date(timeData[0].current_timestamp) // Full timestamp in operational timezone
```

## Changes Made

1. **Edge Function:** `supabase/functions/process-shift-attendance/index.ts`
   - Use PostgreSQL `NOW() AT TIME ZONE` to get current time in operational timezone
   - All date/time calculations now use timezone-aware timestamps
   - Fixed `late_minutes` calculation to use correct date

2. **Database:** Deleted stale attendance record for Dimas with wrong `late_minutes`

## Testing

After fix:
- ✅ `late_minutes` calculated correctly based on operational timezone
- ✅ Widget shows correct late time for couriers
- ✅ Admin dashboard shows accurate attendance data
- ✅ No more 1438-minute bugs

## Deployment

```bash
npx supabase functions deploy process-shift-attendance --project-ref bunycotovavltxmutier --no-verify-jwt
```

---

**Date:** 2026-05-10  
**Fixed by:** Kiro AI
