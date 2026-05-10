# Timezone Consistency Issue & Solution

## Problem Summary

Ada **inkonsistensi timezone handling** antara frontend dan backend yang menyebabkan:
1. Record attendance dibuat dengan tanggal UTC instead of local date
2. Realtime subscription tidak trigger karena filter date mismatch
3. Warning "BELUM CHECK-IN" tidak hilang meskipun kurir sudah AKTIF

## Root Causes

### 1. Backend: `record_courier_checkin` Bug
**File**: `supabase/migrations/20260430110155_fix_record_courier_checkin.sql`

**Bug**:
```sql
v_now_local := NOW() AT TIME ZONE v_timezone;
v_today := v_now_local::DATE;  -- ❌ WRONG: ::DATE uses UTC, not local timezone
```

**Impact**:
- Record created with `date = '2026-05-10'` (UTC) instead of `'2026-05-11'` (local)
- `get_missing_couriers` uses local date → doesn't find the record
- Warning persists even after check-in

**Fix** (Migration `20260511130000_fix_record_courier_checkin_timezone_date.sql`):
```sql
v_now_local := NOW() AT TIME ZONE v_timezone;
v_today := (v_now_local AT TIME ZONE v_timezone)::DATE;  -- ✅ CORRECT: Explicit timezone
```

### 2. Frontend: Inconsistent Date Formatting
**File**: `src/utils/date.ts`

**Current Approach**:
```typescript
export function getLocalNow(): Date {
  const now = new Date();
  const tz = getTimezone();
  const localStr = now.toLocaleString('en-US', { timeZone: tz });
  return new Date(localStr);  // ⚠️ Potential precision loss
}

export function getLocalTodayRange() {
  const localNow = getLocalNow();
  const start = new Date(localNow);
  start.setHours(0, 0, 0, 0);
  // ...
}
```

**Issue**:
- `toLocaleString` returns string like `"5/11/2026, 6:33:00 AM"`
- Parsing this back to Date can have precision issues
- Different browsers may format differently

**Used in**:
- `useAdminAttendanceStore.ts` → `fetchTodayLogs()`, `fetchMissingCouriers()`, `subscribeToday()`
- Manual date formatting: `${year}-${month}-${day}`

### 3. Realtime Subscription Filter Mismatch
**File**: `src/stores/useAdminAttendanceStore.ts`

**Current**:
```typescript
const { start } = getLocalTodayRange();
const year = start.getFullYear();
const month = String(start.getMonth() + 1).padStart(2, '0');
const day = String(start.getDate()).padStart(2, '0');
const today = `${year}-${month}-${day}`;

const channel = supabase
  .channel('attendance-today')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'shift_attendance',
    filter: `date=eq.${today}`,  // ⚠️ May not match if backend uses different date
  }, ...)
```

**Issue**:
- If backend saves `date = '2026-05-10'` (UTC) but frontend filters `date=eq.2026-05-11` (local)
- Subscription won't trigger for new records
- Warning doesn't disappear automatically

## Solution Applied

### ✅ Backend Fix (DONE)
Migration `20260511130000_fix_record_courier_checkin_timezone_date.sql` applied:
- Uses explicit `AT TIME ZONE` for date extraction
- Ensures `date` column always uses local timezone date

### ⚠️ Frontend Consistency (NEEDS REVIEW)

**Current State**:
- `getLocalNow()` uses `toLocaleString` approach
- Works but has potential edge cases
- Manual date formatting is consistent across codebase

**Recommendation**:
Keep current approach BUT ensure:
1. All date formatting uses the same pattern: `${year}-${month}-${day}`
2. Always use `getLocalTodayRange()` for "today" calculations
3. Never use `new Date().toISOString().split('T')[0]` (this uses UTC)

**Alternative Approach** (if issues persist):
```typescript
export function getLocalNow(): Date {
  const now = new Date();
  const tz = getTimezone();
  
  // Use Intl.DateTimeFormat for more reliable parsing
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(now);
  const map: Record<string, string> = {};
  parts.forEach(p => (map[p.type] = p.value));
  
  return new Date(
    parseInt(map.year),
    parseInt(map.month) - 1,
    parseInt(map.day),
    parseInt(map.hour),
    parseInt(map.minute),
    parseInt(map.second)
  );
}
```

## Testing Checklist

- [x] Backend: `record_courier_checkin` creates record with local date
- [x] Backend: `get_missing_couriers` finds couriers with local date
- [x] Frontend: `fetchTodayLogs` queries with local date
- [x] Frontend: `fetchMissingCouriers` queries with local date
- [ ] Frontend: Realtime subscription triggers when record created
- [ ] Frontend: Warning disappears automatically after check-in
- [ ] Frontend: Table updates automatically after check-in

## Debug Steps

1. **Check Console Logs** (after applying debug commits):
   ```
   [AdminAttendance] Setting up realtime subscription for date: 2026-05-11
   [AdminAttendance] Fetching logs for date: 2026-05-11
   [AdminAttendance] Fetched logs: 1 records
   [AdminAttendance] Fetching missing couriers for date: 2026-05-11
   [AdminAttendance] Missing couriers: 0
   [AdminAttendance] Realtime event received: {...}  ← Should appear after check-in
   ```

2. **Verify Database**:
   ```sql
   -- Check if date matches local date
   SELECT 
     date,
     first_online_at,
     NOW() AT TIME ZONE 'Asia/Makassar' as now_local,
     (NOW() AT TIME ZONE 'Asia/Makassar')::DATE as today_local
   FROM shift_attendance
   WHERE courier_id = '<courier_id>'
   ORDER BY date DESC LIMIT 1;
   ```

3. **Test Realtime Subscription**:
   - Open `/admin/attendance` with console open
   - Ask courier to click OFF then AKTIF
   - Check console for "Realtime event received"
   - Verify warning disappears within 1-10 seconds

## Files Modified

- `supabase/migrations/20260511130000_fix_record_courier_checkin_timezone_date.sql` (backend fix)
- `src/stores/useAdminAttendanceStore.ts` (added debug logs)
- `src/stores/useCourierStore.ts` (added debug logs to setCourierOnline)

## Related Issues

- Missing Couriers Fix: `MISSING_COURIERS_FIX.md`
- PWA Auto-Update Fix: `5_BUGS_FIXED.md`
