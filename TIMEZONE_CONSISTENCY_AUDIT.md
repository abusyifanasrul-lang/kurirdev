# Timezone Consistency Audit & Action Plan

## Problem Statement

**CRITICAL ISSUE:** Timezone tidak konsisten across codebase. Beberapa bagian menggunakan UTC, beberapa menggunakan operational timezone dari settings. Ini menyebabkan:

1. ❌ `late_minutes` calculation salah (1438 menit instead of 12 menit)
2. ❌ Widget tidak muncul karena date mismatch
3. ❌ Admin dashboard menunjukkan data yang salah
4. ❌ Potential bugs di semua fitur yang bergantung pada date/time

## Root Cause

**Inconsistent timezone usage:**
- ✅ Frontend: Sudah ada `src/utils/date.ts` dengan `getLocalNow()`, `getLocalTodayRange()`, dll
- ❌ Edge Functions: Masih menggunakan `new Date()` (UTC) tanpa timezone conversion
- ❌ Some stores: Menggunakan `new Date().toISOString().split('T')[0]` (UTC date)

## Solution

**ENFORCE SINGLE SOURCE OF TRUTH:** `operational_timezone` dari `settings` table.

### 1. Edge Functions (Backend)

**Created:** `supabase/functions/_shared/timezone.ts`

**Helper Functions:**
- `getCurrentTime(supabase)` - Get current time in operational timezone
- `toOperationalTimezone(supabase, dateStr)` - Convert any date to operational timezone
- `getTodayRange(supabase)` - Get start/end of today in operational timezone

**Usage:**
```typescript
import { getCurrentTime } from '../_shared/timezone.ts'

const timeData = await getCurrentTime(supabase)
console.log(timeData.current_date)      // "2026-05-10"
console.log(timeData.current_time)      // "14:30:45"
console.log(timeData.current_timestamp) // Date object in operational timezone
console.log(timeData.day_name)          // "Friday"
console.log(timeData.timezone)          // "Asia/Jakarta"
```

### 2. Frontend (Stores & Components)

**Existing Utilities:** `src/utils/date.ts`

**Helper Functions:**
- `getLocalNow()` - Get current time in operational timezone
- `getLocalTodayRange()` - Get start/end of today
- `formatLocal(date, format)` - Format date in operational timezone
- `isLocalToday(date)` - Check if date is today

**Usage:**
```typescript
import { getLocalNow, getLocalTodayRange } from '@/utils/date'

// ❌ WRONG
const today = new Date().toISOString().split('T')[0]

// ✅ CORRECT
const { start, end } = getLocalTodayRange()
const today = start.toISOString().split('T')[0]
```

## Files That Need Update

### Edge Functions (HIGH PRIORITY)

1. ✅ **process-shift-attendance** - FIXED (uses getCurrentTime)
2. ❌ **process-auto-shift-end** - Uses `new Date()` for currentTime
3. ❌ **process-scheduled-notifications** - Uses `new Date().toISOString()`
4. ❌ **create-staff-user** - Uses `new Date().toISOString()` for updated_at

### Frontend Stores (MEDIUM PRIORITY)

1. ❌ **useAdminAttendanceStore.ts**
   - Line 48: `new Date().toISOString().split('T')[0]` for today
   - Line 55: `new Date().toISOString().split('T')[0]` for today
   - Line 90: `new Date().toISOString().split('T')[0]` for today
   - Line 117: `new Date().toISOString().split('T')[0]` for today

2. ❌ **useAttendanceStore.ts**
   - Line 36: `new Date().toISOString().split('T')[0]` for today

3. ❌ **useOrderStore.ts**
   - Line 95: `new Date(new Date().setHours(0, 0, 0, 0) - 7 * 24 * 60 * 60 * 1000)` for sevenDaysAgo
   - Line 319-320: Date calculations for weekly sync
   - Multiple `new Date().toISOString()` for timestamps

4. ❌ **useNotificationStore.ts**
   - Line 401: `new Date().toISOString()` for sent_at

5. ❌ **useCustomerStore.ts**
   - Multiple `new Date().toISOString()` for updated_at

6. ❌ **useCourierStore.ts**
   - Multiple `new Date().toISOString()` for timestamps

### Frontend Components (LOW PRIORITY)

Most components use `date-fns` with `formatLocal()` from `src/utils/date.ts`, so they're already timezone-aware for display. Only need to check:

1. ❌ **AttendanceWidget.tsx** - Check if uses correct timezone for shift time comparison
2. ❌ **ShiftScheduleWidget.tsx** - Check if uses correct timezone for countdown

## Action Plan

### Phase 1: Edge Functions (CRITICAL - Do First)

1. ✅ Create `supabase/functions/_shared/timezone.ts`
2. ✅ Update `process-shift-attendance` to use `getCurrentTime()`
3. ⏳ Update `process-auto-shift-end` to use `getCurrentTime()`
4. ⏳ Update `process-scheduled-notifications` to use `getCurrentTime()`
5. ⏳ Update `create-staff-user` to use `getCurrentTime()`

### Phase 2: Frontend Stores (IMPORTANT - Do Second)

1. ⏳ Update `useAdminAttendanceStore.ts` to use `getLocalTodayRange()`
2. ⏳ Update `useAttendanceStore.ts` to use `getLocalTodayRange()`
3. ⏳ Update `useOrderStore.ts` to use `getLocalNow()` and `getLocalTodayRange()`
4. ⏳ Update `useNotificationStore.ts` to use `getLocalNow()`
5. ⏳ Update `useCustomerStore.ts` to use `getLocalNow()`
6. ⏳ Update `useCourierStore.ts` to use `getLocalNow()`

### Phase 3: Frontend Components (OPTIONAL - Do Last)

1. ⏳ Audit `AttendanceWidget.tsx`
2. ⏳ Audit `ShiftScheduleWidget.tsx`
3. ⏳ Audit other components that use date/time

## Testing Checklist

After all updates:

- [ ] Attendance `late_minutes` calculation correct
- [ ] Widget shows correct late time
- [ ] Admin dashboard shows correct attendance data
- [ ] Shift start/end triggers at correct time
- [ ] Notifications sent at correct time
- [ ] Order timestamps correct
- [ ] Customer update timestamps correct
- [ ] All date displays show correct timezone

## Rules Going Forward

### ❌ NEVER DO THIS:

```typescript
// Edge Functions
const now = new Date()
const today = now.toISOString().split('T')[0]

// Frontend
const today = new Date().toISOString().split('T')[0]
const now = new Date()
```

### ✅ ALWAYS DO THIS:

```typescript
// Edge Functions
import { getCurrentTime } from '../_shared/timezone.ts'
const timeData = await getCurrentTime(supabase)
const today = timeData.current_date

// Frontend
import { getLocalNow, getLocalTodayRange } from '@/utils/date'
const now = getLocalNow()
const { start, end } = getLocalTodayRange()
const today = start.toISOString().split('T')[0]
```

## Notes

- **Timestamps for database:** Always use `.toISOString()` when saving to database (Supabase stores as UTC)
- **Display to user:** Always use `formatLocal()` from `src/utils/date.ts`
- **Business logic:** Always use timezone-aware functions (`getCurrentTime`, `getLocalNow`, etc.)
- **Comparisons:** Always convert both dates to same timezone before comparing

---

**Status:** Phase 1 partially complete (1/4 Edge Functions updated)  
**Priority:** HIGH - Complete Phase 1 ASAP to prevent data corruption  
**Owner:** Development Team  
**Last Updated:** 2026-05-10
