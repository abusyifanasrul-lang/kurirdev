# Fix: Missing Couriers Realtime Alert

## Problem
Admin tidak bisa melihat kurir yang terlambat check-in secara realtime di `/admin/attendance`. Warning section tidak muncul meskipun kurir sudah lewat waktu shift-nya.

## Root Cause
Function `get_missing_couriers` memiliki 2 bug kritis:

1. **Type Mismatch**: Function mengembalikan `TEXT` tapi kolom `profiles.name` dan `shifts.name` adalah `VARCHAR(255)`, menyebabkan error "structure of query does not match function result type"

2. **NULL Handling Bug**: Kondisi `NOT (p.day_off = TRIM(TO_CHAR(p_date, 'Day')))` menghasilkan `NULL` (bukan `TRUE`) ketika `day_off` adalah `NULL`, karena SQL three-valued logic. Ini menyebabkan kurir dengan `day_off = NULL` tidak pernah muncul di hasil query.

## Solution

### 1. Fixed Type Casting (Migration: `20260511120000_fix_get_missing_couriers_type_mismatch.sql`)
```sql
SELECT
  p.id,
  p.name::TEXT,  -- ✅ Cast VARCHAR to TEXT
  s.id,
  s.name::TEXT,  -- ✅ Cast VARCHAR to TEXT
  s.start_time,
  ...
```

### 2. Fixed NULL Handling (Migration: `20260511120100_fix_get_missing_couriers_null_day_off.sql`)
```sql
-- ❌ WRONG: Returns NULL when day_off is NULL
AND NOT (p.day_off = TRIM(TO_CHAR(p_date, 'Day')))

-- ✅ CORRECT: Returns TRUE when day_off is NULL
AND COALESCE(p.day_off, '') != TRIM(TO_CHAR(p_date, 'Day'))
```

### 3. Increased Refresh Rate
Changed polling interval from 60 seconds to 10 seconds for better realtime experience:
```typescript
// Before: 60_000 (1 minute)
// After: 10_000 (10 seconds)
const interval = setInterval(() => {
  fetchMissingCouriers();
}, 10_000);
```

## How It Works Now

1. **Database Function** (`get_missing_couriers`):
   - Finds couriers whose shift has started but haven't checked in yet
   - Calculates minutes late based on shift start time
   - Handles NULL `day_off` values correctly
   - Excludes couriers with shift overrides

2. **Frontend Display** (`AttendanceMonitoring.tsx`):
   - **Critical Alert** (RED): Couriers ≥60 minutes late
   - **Warning Alert** (AMBER): Couriers 1-59 minutes late
   - Shows courier name, shift info, and minutes late
   - Updates every 10 seconds via polling
   - Also subscribes to realtime changes on `shift_attendance` table

3. **Realtime Updates**:
   - Polling: Every 10 seconds to update minutes_late counter
   - Subscription: Instant update when courier checks in (creates `shift_attendance` record)

## Testing

```sql
-- Test the function
SELECT * FROM get_missing_couriers('2026-05-11');

-- Expected result: Shows couriers who:
-- 1. Have an active shift today
-- 2. Current time > shift start time
-- 3. Haven't checked in yet (no shift_attendance record)
-- 4. Not on their day off
-- 5. Not in shift_overrides as original_courier_id
```

## Files Changed
- `supabase/migrations/20260511120000_fix_get_missing_couriers_type_mismatch.sql`
- `supabase/migrations/20260511120100_fix_get_missing_couriers_null_day_off.sql`
- `src/stores/useAdminAttendanceStore.ts` (updated interface comment)
- `src/pages/admin/AttendanceMonitoring.tsx` (10s refresh interval)

## Verification
✅ Function now returns correct results
✅ Warning section displays in UI when couriers are late
✅ Minutes late counter updates every 10 seconds
✅ Realtime subscription triggers when courier checks in
