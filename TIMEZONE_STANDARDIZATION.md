# Timezone Standardization

## Overview

Sistem sekarang menggunakan **single source of truth** untuk timezone handling yang konsisten antara frontend dan backend. Ketika admin mengubah `operational_timezone` di settings, **semua mekanisme waktu** di aplikasi akan otomatis menyesuaikan.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Settings Table (DB)                       │
│                operational_timezone: 'Asia/Makassar'         │
└──────────────────────┬──────────────────────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         │                           │
    ┌────▼────┐                 ┌────▼────┐
    │ Backend │                 │Frontend │
    │   SQL   │                 │ date.ts │
    └────┬────┘                 └────┬────┘
         │                           │
         │ AT TIME ZONE              │ Intl.DateTimeFormat
         │ v_timezone                │ + getTimezone()
         │                           │
    ┌────▼────────────────────────────▼────┐
    │   Consistent Date Handling            │
    │   YYYY-MM-DD in local timezone        │
    └───────────────────────────────────────┘
```

## Implementation

### Backend (SQL)

**File**: `supabase/migrations/20260511130000_fix_record_courier_checkin_timezone_date.sql`

```sql
DECLARE
  v_timezone TEXT;
  v_now_local TIMESTAMPTZ;
  v_today DATE;
BEGIN
  -- Get timezone from settings
  SELECT operational_timezone INTO v_timezone FROM settings WHERE id = 'global';
  v_timezone := COALESCE(v_timezone, 'Asia/Makassar');
  
  -- Convert NOW() to local timezone
  v_now_local := NOW() AT TIME ZONE v_timezone;
  
  -- Extract date in local timezone (NOT UTC)
  v_today := (v_now_local AT TIME ZONE v_timezone)::DATE;
  
  -- Use v_today for all date comparisons
  INSERT INTO shift_attendance (date, ...) VALUES (v_today, ...);
END;
```

**Key Points**:
- ✅ Uses `AT TIME ZONE` twice for explicit timezone conversion
- ✅ `v_today` is always in local timezone, not UTC
- ✅ Reads `operational_timezone` from settings table

### Frontend (TypeScript)

**File**: `src/utils/date.ts`

```typescript
/**
 * Get timezone from settings store (single source of truth)
 */
export function getTimezone(): string {
  return useSettingsStore?.getState()?.operational_timezone || 'Asia/Jakarta';
}

/**
 * Get current time in local timezone
 * Uses Intl.DateTimeFormat (same approach as backend AT TIME ZONE)
 */
export function getLocalNow(): Date {
  const now = new Date();
  const tz = getTimezone();
  
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

/**
 * Format Date to YYYY-MM-DD in local timezone
 * Matches backend: (v_now_local AT TIME ZONE v_timezone)::DATE
 */
export function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date as YYYY-MM-DD string
 */
export function getTodayLocal(): string {
  return formatDateLocal(getLocalNow());
}
```

**Key Points**:
- ✅ Uses `Intl.DateTimeFormat` with `timeZone` option (same concept as SQL `AT TIME ZONE`)
- ✅ Reads `operational_timezone` from settings store
- ✅ `getTodayLocal()` returns same format as backend `v_today`

## Usage Examples

### ✅ CORRECT: Use Standardized Utilities

```typescript
import { getTodayLocal, getLocalNow, formatDateLocal } from '@/utils/date';

// Get today's date for database queries
const today = getTodayLocal(); // "2026-05-11"
const { data } = await supabase
  .from('shift_attendance')
  .eq('date', today);

// Get current local time
const now = getLocalNow();
console.log('Current time:', now);

// Format any date to YYYY-MM-DD
const someDate = new Date('2026-05-15T10:30:00Z');
const formatted = formatDateLocal(someDate); // "2026-05-15" (in local TZ)
```

### ❌ WRONG: Manual Date Formatting

```typescript
// ❌ DON'T DO THIS - Uses UTC date
const today = new Date().toISOString().split('T')[0];

// ❌ DON'T DO THIS - Inconsistent with backend
const { start } = getLocalTodayRange();
const today = `${start.getFullYear()}-${start.getMonth()+1}-${start.getDate()}`;

// ❌ DON'T DO THIS - May have precision issues
const localStr = new Date().toLocaleString('en-US', { timeZone: tz });
const today = new Date(localStr);
```

## When Timezone Changes

**Scenario**: Admin changes `operational_timezone` from `'Asia/Makassar'` to `'Asia/Jakarta'` in settings.

**What Happens**:

1. **Settings Store Updates**:
   ```typescript
   useSettingsStore.setState({ operational_timezone: 'Asia/Jakarta' });
   ```

2. **Backend Immediately Uses New Timezone**:
   - Next `record_courier_checkin` call uses `'Asia/Jakarta'`
   - All RPC functions read from settings table

3. **Frontend Immediately Uses New Timezone**:
   - `getTimezone()` returns `'Asia/Jakarta'`
   - `getLocalNow()` uses new timezone
   - `getTodayLocal()` returns date in new timezone

4. **No Code Changes Needed**:
   - All date utilities automatically use new timezone
   - All database queries use new timezone
   - Realtime subscriptions continue working

## Testing

### Test 1: Verify Timezone Consistency

```sql
-- Backend
SELECT 
  operational_timezone,
  NOW() AT TIME ZONE operational_timezone as now_local,
  (NOW() AT TIME ZONE operational_timezone)::DATE as today_local
FROM settings WHERE id = 'global';
```

```typescript
// Frontend
import { getTimezone, getLocalNow, getTodayLocal } from '@/utils/date';

console.log('Timezone:', getTimezone());
console.log('Now Local:', getLocalNow());
console.log('Today Local:', getTodayLocal());
```

**Expected**: Both should show same timezone and date.

### Test 2: Change Timezone

1. Go to `/admin/settings`
2. Change `operational_timezone` to different timezone
3. Refresh page
4. Check console logs - should use new timezone
5. Create new attendance record - should use new timezone date

### Test 3: Realtime Subscription

1. Open `/admin/attendance` with console
2. Ask courier to check in
3. Verify console shows:
   ```
   [AdminAttendance] Realtime event received: {...}
   [AdminAttendance] Record date: 2026-05-11, Expected: 2026-05-11
   [AdminAttendance] Date matches - refreshing data
   ```

## Migration Guide

If you have existing code that manually formats dates:

### Before
```typescript
const { start } = getLocalTodayRange();
const year = start.getFullYear();
const month = String(start.getMonth() + 1).padStart(2, '0');
const day = String(start.getDate()).padStart(2, '0');
const today = `${year}-${month}-${day}`;
```

### After
```typescript
import { getTodayLocal } from '@/utils/date';
const today = getTodayLocal();
```

## Files Modified

- ✅ `src/utils/date.ts` - Added `getTodayLocal()`, `formatDateLocal()`, updated `getLocalNow()`
- ✅ `src/stores/useAdminAttendanceStore.ts` - Uses `getTodayLocal()` everywhere
- ✅ `supabase/migrations/20260511130000_fix_record_courier_checkin_timezone_date.sql` - Backend fix

## Related Documentation

- `TIMEZONE_CONSISTENCY_ISSUE.md` - Problem analysis
- `MISSING_COURIERS_FIX.md` - Missing couriers feature fix
