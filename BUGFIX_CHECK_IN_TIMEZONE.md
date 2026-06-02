# FIXED: Check-in Button Timezone Bug

**Date:** June 3, 2026, 06:15 Makassar  
**Status:** ✅ RESOLVED  
**Commit:** `2db0834c`  
**Migration:** `20260603063000_fix_shift_window_timezone_calculation.sql`

---

## PROBLEM

User reported that courier with **Shift A (06:05-07:05)** at **06:10 Makassar** could not click ON button.

**Error message:**
```
Check-in hanya diperbolehkan 1 jam sebelum shift dimulai hingga shift berakhir
```

**Expected:** Should be able to check in (within window: 05:05-07:05)  
**Actual:** Check-in rejected ❌

---

## ROOT CAUSE

The `record_courier_checkin()` RPC function had a **timezone calculation bug**.

### Technical Details

**Buggy code:**
```sql
v_shift_window_start := (v_current_date || ' ' || v_shift.start_time)::TIMESTAMPTZ 
  AT TIME ZONE v_operational_tz - (v_check_in_window_minutes || ' minutes')::INTERVAL;
```

**What happened:**
1. String `'2026-06-03 06:05:00'` cast to `TIMESTAMPTZ` → PostgreSQL assumes UTC → `2026-06-03 06:05:00+00`
2. Then `AT TIME ZONE 'Asia/Makassar'` converts UTC to Makassar → `2026-06-03 14:05:00` (adds +8 hours)
3. Subtract 60 minutes → Window start: `13:05`
4. Window end: `15:05`

**Result:** Shift 06:05-07:05 was calculated as 13:05-15:05 (8 hours ahead!)

### Verification

**Before fix:**
```
Current time: 06:12 Makassar (22:12 UTC)
Calculated window: 13:05 - 15:05
v_current_time < v_shift_window_start → TRUE (22:12 < next day 13:05)
Check-in: REJECTED ❌
```

**After fix:**
```
Current time: 06:12 Makassar (22:12 UTC)
Calculated window: 21:05 - 23:05 UTC (= 05:05 - 07:05 Makassar)
now() >= v_shift_window_start → TRUE (22:12 >= 21:05)
now() <= v_shift_window_end → TRUE (22:12 <= 23:05)
Check-in: ALLOWED ✅
```

---

## THE FIX

**Changed:**
```sql
-- BEFORE (WRONG):
::TIMESTAMPTZ AT TIME ZONE 'Asia/Makassar'

-- AFTER (CORRECT):
::TIMESTAMP AT TIME ZONE 'Asia/Makassar'
```

**Why this works:**

1. `::TIMESTAMP` creates a timestamp **without timezone** → `2026-06-03 06:05:00` (no offset)
2. `AT TIME ZONE 'Asia/Makassar'` interprets this as **local Makassar time** and converts to UTC
3. Result: `2026-06-02 22:05:00+00` (correctly subtracts 8 hours)

### Applied to 3 places:

1. ✅ `v_shift_window_start` calculation
2. ✅ `v_shift_window_end` calculation (normal and overnight shifts)
3. ✅ `late_minutes` calculation (on-time vs late status)

---

## TEST VERIFICATION

**Query test result:**
```sql
Current time (UTC):      2026-06-02 22:13:05+00
Current time (Makassar): 2026-06-03 06:13:05

Shift A window:
  Start (UTC): 2026-06-02 21:05:00+00 (= 05:05 Makassar) ✅
  End (UTC):   2026-06-02 23:05:00+00 (= 07:05 Makassar) ✅

Validation:
  now() >= window_start: TRUE ✅
  now() <= window_end:   TRUE ✅
  
Can check in: YES ✅
```

---

## DEPLOYMENT

**Deployed:** Yes, migration applied via Supabase MCP Power  
**Pushed:** Yes, commit `2db0834c` pushed to GitHub main  
**Vercel:** Auto-deployment triggered  

**Migration file:** `supabase/migrations/20260603063000_fix_shift_window_timezone_calculation.sql`

---

## NEXT STEPS

### For User:
1. ✅ Wait for Vercel deployment to complete (~2 minutes)
2. ✅ Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
3. ✅ Try clicking ON button again
4. ✅ Should now work immediately! 🎉

### Expected Behavior:
- **Within shift window (05:05-07:05 Makassar):** "Check-in Shift" button enabled, ON status = **Shift Aktif** ✅
- **Outside shift window:** "Ambil Private" button enabled, ON status = **Private Order** ✅
- **Error message:** Should no longer appear ✅

---

## INVESTIGATION SUMMARY

This bug was the 6th fix attempt in the FIFO queue implementation saga:

| Fix | Issue | Solution |
|-----|-------|----------|
| #1 | `queue_joined_at` not updating | Made atomic single-transaction update |
| #2 | Wrong couriers marked `out_of_shift` | Manual reset for couriers with `shift_id` |
| #3 | Business logic misunderstood | Created `is_courier_out_of_shift()` function |
| #4 | Timestamps not updating on OFF-ON | Added `courier_status` to trigger watch list |
| #5 | UI order wrong (Ahmad in wrong position) | Added `out_of_shift` to `mapProfileToUser()` |
| **#6** | **Check-in rejected within window** | **Fixed timezone calculation (TIMESTAMPTZ → TIMESTAMP)** ✅ |

---

## RELATED COMMITS

- `dcfb23f7` - Initial out_of_shift flag implementation
- `1ac32d10` - FIFO sorting for private mode
- `a87fd0ab` - Centralized tier logic refactor
- `9f7461a8` - Fix queue_joined_at atomic update
- `5c1cda25` - Proper out_of_shift logic with function
- `5404c59a` - Fix trigger to watch courier_status
- `eb7f7a76` - Fix mapProfileToUser missing out_of_shift
- `325ab9eb` - Fix trigger to not interfere with RPC
- **`2db0834c`** - **Fix timezone calculation (THIS FIX)** ✅

---

## TECHNICAL NOTES

### PostgreSQL Timezone Operators

**Key learning:** Order matters when combining `::TYPE` and `AT TIME ZONE`

```sql
-- Method 1: WRONG (double conversion)
'2026-06-03 06:05:00'::TIMESTAMPTZ AT TIME ZONE 'Asia/Makassar'
→ Assumes string is UTC, then converts TO Makassar (+8 hours)
→ Result: 14:05 ❌

-- Method 2: CORRECT (interpret as local)
'2026-06-03 06:05:00'::TIMESTAMP AT TIME ZONE 'Asia/Makassar'
→ Interprets string as Makassar time, converts TO UTC (-8 hours)
→ Result: 22:05 (previous day) ✅
```

### Why Database Uses UTC

- Database stores all timestamps in UTC (`TIMESTAMPTZ` type)
- Application timezone (`Asia/Makassar`) only for display and input
- Comparisons always done in UTC for consistency
- Window calculation must convert local time → UTC for comparison with `now()`

---

**END OF REPORT**
