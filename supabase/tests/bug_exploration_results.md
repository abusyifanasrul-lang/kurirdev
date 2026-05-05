# Bug Condition Exploration Test Results

**Date:** 2026-05-05
**Test:** tier_change_log.happened_at missing column bug
**Status:** ✅ BUG CONFIRMED

## Test Results Summary

All three tests confirmed that the bug exists:

### Test 1: Schema Verification
**Query:**
```sql
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns 
  WHERE table_schema = 'public' 
    AND table_name = 'tier_change_log' 
    AND column_name = 'happened_at'
) AS column_exists;
```

**Result:** `column_exists: false`

**Conclusion:** ✅ CONFIRMED - The `happened_at` column does NOT exist in the `tier_change_log` table.

---

### Test 2: INSERT Operation Test
**Test:** Attempted to INSERT into `tier_change_log` with `happened_at` column

**Query:**
```sql
INSERT INTO tier_change_log (
  id, courier_id, old_status, new_status, 
  old_is_priority, new_is_priority, reason, 
  happened_at, created_at
) VALUES (
  gen_random_uuid(), test_courier_id, 
  'off', 'on', false, false, 
  'Bug exploration test', NOW(), NOW()
);
```

**Result:** INSERT operation FAILED (caught by exception handler)

**Error:** `undefined_column` - column "happened_at" of relation "tier_change_log" does not exist

**Conclusion:** ✅ CONFIRMED - INSERT operations with `happened_at` column fail as expected.

---

### Test 3: Function Inspection
**Query:**
```sql
SELECT pg_get_functiondef(oid) AS function_definition 
FROM pg_proc 
WHERE proname = 'handle_courier_queue_sync' 
LIMIT 1;
```

**Result:** Function definition retrieved successfully

**Key Finding:** The `handle_courier_queue_sync()` function contains this INSERT statement:

```sql
INSERT INTO public.tier_change_log (
  courier_id, trigger_source,
  queue_joined_at_before, queue_joined_at_after,
  context, happened_at
) VALUES (
  NEW.id,
  'status_' || v_old_status || '_to_' || v_new_status,
  OLD.queue_joined_at, NEW.queue_joined_at,
  jsonb_build_object(
    'old_status', v_old_status,
    'new_status', v_new_status,
    'is_priority_recovery', NEW.is_priority_recovery
  ),
  NOW()
);
```

**Conclusion:** ✅ CONFIRMED - The function explicitly references the `happened_at` column in its INSERT statement.

---

## Root Cause Analysis

The bug is caused by a **schema-code mismatch**:

1. **Schema State:** The `tier_change_log` table was created without the `happened_at` column
2. **Code State:** The `handle_courier_queue_sync()` trigger function attempts to INSERT with the `happened_at` column
3. **Impact:** When the trigger fires (e.g., during QR code scan for STAY status), the INSERT fails with "column does not exist" error

## Bug Flow

```
User scans QR code at basecamp
    ↓
verify_stay_qr() validates token & GPS
    ↓
Updates courier status to 'stay'
    ↓
handle_courier_queue_sync() trigger fires
    ↓
Attempts INSERT into tier_change_log with happened_at
    ↓
❌ ERROR: column "happened_at" does not exist
    ↓
QR verification fails - user sees "GAGAL VERIFIKASI"
```

## Counterexamples Documented

1. **Schema Query:** Returns `column_exists: false`
2. **INSERT Operation:** Fails with `undefined_column` error
3. **Function Definition:** Shows INSERT statement includes `happened_at` column

## Next Steps

1. ✅ Task 1 Complete: Bug condition exploration test written and executed
2. ⏭️ Task 2: Write preservation property tests (before implementing fix)
3. ⏭️ Task 3: Implement fix (add `happened_at TIMESTAMPTZ` column)
4. ⏭️ Task 4: Verify fix works and no regressions

## Expected Behavior After Fix

After adding the `happened_at TIMESTAMPTZ` column to `tier_change_log`:

- Test 1: Will return `column_exists: true`
- Test 2: INSERT operation will succeed
- Test 3: Function will continue to work correctly with the column present
- QR code scan will complete successfully
- Audit log entries will be created with `happened_at` timestamps
