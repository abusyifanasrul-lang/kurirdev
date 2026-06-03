# ALPHA Status Fix Summary

**Date:** 2026-06-03  
**Issue:** When applying fine to ALPHA status courier, badge changed to "MAJOR LATE" instead of staying "ALPHA"

---

## Problem

User reported that when applying fine (`APPLY DENDA`) to Bayu (ALPHA status - never checked in), the status badge changed from gray "ALPHA" to red "MAJOR LATE" with "Terlambat 120 Menit" text.

**Expected:** Gray "ALPHA" badge should remain after applying fine  
**Actual:** Badge changed to red "MAJOR LATE" badge

---

## Root Cause

The `apply_attendance_fine()` RPC function **unconditionally** updated the status field:

```sql
-- OLD LOGIC (BROKEN):
IF p_fine_type = 'per_order' THEN
  UPDATE shift_attendance SET
    status = 'late_minor',  -- ❌ Always changes status
    ...
ELSIF p_fine_type = 'flat_major' THEN
  UPDATE shift_attendance SET
    status = 'late_major',  -- ❌ Always changes status
    ...
```

This caused:
- ALPHA courier → Apply fine → Status changed from `'alpha'` to `'late_major'`
- Badge rendering used `log.status` field directly
- Gray "ALPHA" badge became red "MAJOR LATE" badge

---

## Solution

Modified `apply_attendance_fine()` to **preserve original status** when it's `'alpha'`:

```sql
-- NEW LOGIC (FIXED):
-- Determine new status: preserve 'alpha', update 'late' → 'late_minor'/'late_major'
IF v_attendance.status = 'alpha' THEN
  v_new_status := 'alpha';  -- ✅ Keep ALPHA status unchanged
ELSIF p_fine_type = 'per_order' THEN
  v_new_status := 'late_minor';  -- Change LATE → LATE_MINOR
ELSIF p_fine_type = 'flat_major' THEN
  v_new_status := 'late_major';  -- Change LATE → LATE_MAJOR
ELSE
  v_new_status := v_attendance.status;  -- Fallback: keep original
END IF;

-- Then use v_new_status in UPDATE
UPDATE shift_attendance SET
  status = v_new_status,  -- ✅ Uses calculated status
  ...
```

---

## Expected Behavior

| Original Status | Fine Type | New Status | Badge Display |
|---|---|---|---|
| `alpha` | `per_order` | `alpha` | Gray "ALPHA" |
| `alpha` | `flat_major` | `alpha` | Gray "ALPHA" |
| `late` | `per_order` | `late_minor` | Red "DENDA AKTIF" |
| `late` | `flat_major` | `late_major` | Red "MAJOR LATE" |

**Key Point:** ALPHA status **stays ALPHA** even after applying fine. Fine amount still applied correctly.

---

## Implementation

### Migration Applied
- **File:** `supabase/migrations/20260603080000_fix_apply_attendance_fine_preserve_alpha_status.sql`
- **Function Updated:** `public.apply_attendance_fine()`
- **Status:** ✅ Deployed to Supabase (project: `bunycotovavltxmutier`)

### Manual Fix Applied
- **Courier:** Bayu (ID: `d4260dfc-4ade-4c23-aeb5-cb31b8e00113`)
- **Attendance Record:** `8f462cd7-2c52-4222-abe0-fd28499da648`
- **Action:** Manually changed status from `'late_major'` back to `'alpha'`
- **Result:** Badge now displays gray "ALPHA" as expected

---

## Verification Steps

1. ✅ Created migration to fix RPC function logic
2. ✅ Applied migration via Supabase MCP
3. ✅ Verified function definition in database
4. ✅ Manually fixed Bayu's status (affected by old bug)
5. ✅ Committed and pushed to GitHub (commit: `33aae081`)

---

## Testing Recommendations

### Test Case 1: ALPHA courier + Apply Fine
1. Find courier with ALPHA status (no check-in today)
2. Apply fine (APPLY DENDA) - choose either per_order or flat_major
3. ✅ Verify badge stays gray "ALPHA" (not red "MAJOR LATE")
4. ✅ Verify fine amount is applied correctly

### Test Case 2: LATE courier + Apply Fine
1. Find courier with LATE status (checked in late)
2. Apply per_order fine
3. ✅ Verify badge changes to "DENDA AKTIF"
4. ✅ Verify status becomes `late_minor`

### Test Case 3: LATE courier + Apply Flat Fine
1. Find courier with LATE status
2. Apply flat_major fine
3. ✅ Verify badge changes to "MAJOR LATE"
4. ✅ Verify status becomes `late_major`

---

## Notes

### Why late_minutes shows 120?
The `late_minutes` for ALPHA status is calculated as **full shift duration** (from shift start to shift end), not actual lateness. This is by design:
- ALPHA = Never checked in during entire shift
- System treats this as "late for the entire shift duration"
- If shift is 2 hours (120 minutes), `late_minutes = 120`

This is **correct behavior** and should NOT be changed. The badge correctly shows "ALPHA" to distinguish from actual late check-ins.

### Frontend Rendering
The badge is rendered in `AttendanceMonitoring.tsx`:
```tsx
const getStatusBadge = (status: string) => {
  switch (status) {
    case 'alpha':
      return <Badge className="bg-gray-100 text-gray-500 border-gray-200 font-black">ALPHA</Badge>;
    case 'late_major':
      return <Badge className="bg-red-600 text-white border-red-700 font-black">MAJOR LATE</Badge>;
    // ...
  }
}
```

Badge display is **purely based on status field** — no late_minutes threshold logic involved.

---

## Related Files

- **Migration:** `supabase/migrations/20260603080000_fix_apply_attendance_fine_preserve_alpha_status.sql`
- **Frontend:** `src/pages/admin/AttendanceMonitoring.tsx` (badge rendering)
- **Store:** `src/stores/useAdminAttendanceStore.ts` (applyFine action)
- **RPC:** `public.apply_attendance_fine()` (database function)

---

## Status

✅ **RESOLVED**

- [x] Root cause identified
- [x] Migration created and applied
- [x] Manual fix applied to affected record (Bayu)
- [x] Committed and pushed to GitHub
- [x] Documentation created

**User should now see gray "ALPHA" badge remain after applying fine to ALPHA status couriers.**
