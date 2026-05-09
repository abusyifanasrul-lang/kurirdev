# Bug Condition Exploration Test: Incomplete Fine Query

## Overview

**Bug**: The `get_courier_fines` function only returns flat fines from `shift_attendance` table, missing per-order fines stored in `orders.fine_deducted` column.

**Test File**: `incomplete_fine_query_bug_exploration.sql`

**CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists. DO NOT attempt to fix the test or the code when it fails.

## Purpose

This test demonstrates that:
1. `get_courier_fines` only queries the `shift_attendance` table
2. Per-order fines in `orders.fine_deducted` are not included in the result
3. Financial reports are incomplete, missing per-order fine amounts
4. The function signature doesn't support returning per-order fines

## Test Scenario

The test creates a scenario where a courier has:
- **1 flat_major fine**: Rp 30,000 (in `shift_attendance`)
- **3 orders with fine_deducted**: Rp 1,000 each (in `orders`)
- **Expected grand total**: Rp 33,000
- **Actual returned total**: Rp 30,000 (missing Rp 3,000)

## How to Run

### Option 1: Using Supabase CLI (Local Database)

```bash
# Start local Supabase (if not already running)
supabase start

# Run the test
Get-Content supabase/tests/incomplete_fine_query_bug_exploration.sql | supabase db query
```

### Option 2: Using Supabase CLI (Remote Database)

```bash
# Get your database password from Supabase dashboard
# Then run:
Get-Content supabase/tests/incomplete_fine_query_bug_exploration.sql | supabase db query --db-url "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"
```

### Option 3: Using psql

```bash
psql -h [HOST] -U postgres -d postgres -f supabase/tests/incomplete_fine_query_bug_exploration.sql
```

### Option 4: Using Supabase Dashboard

1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `incomplete_fine_query_bug_exploration.sql`
3. Click "Run"

## Expected Output (On Unfixed Code)

The test should output:

```
NOTICE:  ========================================
NOTICE:  SETTING UP TEST SCENARIO
NOTICE:  ========================================
NOTICE:  Test Courier ID: [UUID]
NOTICE:  Created shift_attendance with flat_major fine: Rp 30,000
NOTICE:  Enabled late_fine_active for courier
NOTICE:  Created 3 orders with fine_deducted = Rp 1,000 each
NOTICE:  Total per-order fines: Rp 3,000
NOTICE:  Total flat fines: Rp 30,000
NOTICE:  Expected grand total: Rp 33,000

NOTICE:  ========================================
NOTICE:  TEST 1: Verify get_courier_fines returns incomplete data
NOTICE:  ========================================
NOTICE:  Fine record found:
NOTICE:    - Date: 2026-05-09
NOTICE:    - Fine Type: flat_major
NOTICE:    - Flat Fine: Rp 30000

NOTICE:  Summary from get_courier_fines:
NOTICE:    - Flat fine records: 1
NOTICE:    - Total flat fines: Rp 30000

NOTICE:  ANALYSIS:
NOTICE:    - get_courier_fines only queries shift_attendance table
NOTICE:    - It does NOT join with orders table
NOTICE:    - Per-order fines (Rp 3,000) are MISSING from result
NOTICE:    - This confirms the bug: incomplete fine data

NOTICE:  CONFIRMED: Bug exists - get_courier_fines only returns flat fines
NOTICE:  Expected total: Rp 33,000 (flat Rp 30,000 + per-order Rp 3,000)
NOTICE:  Actual total: Rp 30,000 (missing per-order fines)

NOTICE:  ========================================
NOTICE:  TEST 2: Verify per-order fines exist in orders table
NOTICE:  ========================================
NOTICE:  Orders with fine_deducted: 3
NOTICE:  Total per-order fines in orders table: Rp 3000

NOTICE:  CONFIRMED: Per-order fines exist in orders table
NOTICE:  But get_courier_fines does NOT include them
NOTICE:  This proves the incomplete fine query bug

NOTICE:  ========================================
NOTICE:  TEST 3: Financial Impact Analysis
NOTICE:  ========================================
NOTICE:  Flat fines (from get_courier_fines): Rp 30000
NOTICE:  Per-order fines (from orders table): Rp 3000

NOTICE:  Reported total (incomplete): Rp 30000
NOTICE:  Actual total (correct): Rp 33000
NOTICE:  Missing amount: Rp 3000

NOTICE:  IMPACT: Finance reports are missing Rp 3000 per courier
NOTICE:  This causes inaccurate financial tracking and settlement

NOTICE:  ========================================
NOTICE:  TEST 4: Inspect get_courier_fines function signature
NOTICE:  ========================================
NOTICE:  Function signature does NOT include per_order_fines field
NOTICE:  Function only queries shift_attendance table
NOTICE:  CONFIRMED: Function needs to be updated to include per-order fines

NOTICE:  ========================================
NOTICE:  COUNTEREXAMPLE SUMMARY
NOTICE:  ========================================

NOTICE:  Courier ID: [UUID]
NOTICE:  Date: 2026-05-09

NOTICE:  Scenario:
NOTICE:    - Courier has 1 flat_major fine: Rp 30,000
NOTICE:    - Courier has 3 orders with fine_deducted: Rp 1,000 each
NOTICE:    - Total per-order fines: Rp 3,000
NOTICE:    - Expected grand total: Rp 33,000

NOTICE:  Bug Behavior:
NOTICE:    - get_courier_fines() returns only flat fines: Rp 30,000
NOTICE:    - Per-order fines are MISSING from result
NOTICE:    - Financial reports are incomplete

NOTICE:  Root Cause:
NOTICE:    - get_courier_fines only queries shift_attendance table
NOTICE:    - Function does not join with orders table
NOTICE:    - Function signature does not include per_order_fines field

NOTICE:  Expected Fix:
NOTICE:    - Create new function get_courier_fines_complete()
NOTICE:    - Query both shift_attendance AND orders tables
NOTICE:    - Return structure with flat_fines and per_order_fines arrays
NOTICE:    - Calculate totals: total_flat_fines, total_per_order_fines, grand_total

NOTICE:  ========================================
NOTICE:  BUG CONDITION EXPLORATION TEST COMPLETE
NOTICE:  ========================================

NOTICE:  Result: BUG CONFIRMED
NOTICE:  The test demonstrates that get_courier_fines returns incomplete data.
NOTICE:  This test will PASS after implementing get_courier_fines_complete.

NOTICE:  Test data cleaned up.
```

## What This Test Validates

1. **Incomplete Query**: Confirms `get_courier_fines` only returns flat fines from `shift_attendance`
2. **Missing Data**: Demonstrates per-order fines exist in `orders` table but are not included
3. **Financial Impact**: Shows the missing amount (Rp 3,000 in this example)
4. **Function Signature**: Verifies the function doesn't support per-order fines in its return type
5. **Root Cause**: Proves the function doesn't join with `orders` table

## Counterexample

**Input**: Courier with both flat fines and per-order fines on the same date

**Current Behavior (Bug)**:
```sql
SELECT * FROM get_courier_fines(courier_id, '2026-05-09', '2026-05-09');
-- Returns: Only flat fine (Rp 30,000)
-- Missing: Per-order fines (Rp 3,000)
```

**Expected Behavior (After Fix)**:
```sql
SELECT * FROM get_courier_fines_complete(courier_id, '2026-05-09', '2026-05-09');
-- Returns: 
-- {
--   "flat_fines": [{"amount": 30000, ...}],
--   "per_order_fines": [
--     {"amount": 1000, "order_number": "TEST-FINE-001"},
--     {"amount": 1000, "order_number": "TEST-FINE-002"},
--     {"amount": 1000, "order_number": "TEST-FINE-003"}
--   ],
--   "total_flat_fines": 30000,
--   "total_per_order_fines": 3000,
--   "grand_total": 33000
-- }
```

## Prerequisites

Before running this test, ensure:
1. Database has at least one courier user in `profiles` table
2. Database has at least one shift in `shifts` table
3. You have appropriate database access permissions

## Next Steps

After running this test and confirming the bug exists:

1. ✅ **Task 1.1 Complete**: Bug condition exploration test written and run
2. **Document counterexamples**: Save the test output showing the bug
3. **Proceed to Task 1.2**: Write preservation property tests (BEFORE implementing fix)
4. **Proceed to Task 1.3**: Implement `get_courier_fines_complete` function
5. **Re-run this test**: Verify the fix works (test should pass after fix)

## Test Cleanup

The test automatically cleans up all test data at the end:
- Deletes test orders (order_number LIKE 'TEST-FINE-%')
- Deletes test shift_attendance records for current date
- Resets `late_fine_active` flag for test courier

## Notes

- This test is **non-destructive** - it only creates temporary test data
- Test data is scoped to current date to avoid conflicts
- All test data is cleaned up automatically
- The test can be run multiple times safely

## Related Files

- **Bugfix Requirements**: `.kiro/specs/courier-shift-settlement-fix/bugfix.md`
- **Design Document**: `.kiro/specs/courier-shift-settlement-fix/design.md`
- **Tasks**: `.kiro/specs/courier-shift-settlement-fix/tasks.md`
- **Current Function**: `supabase/migrations/20260503_add_auth_check_get_courier_fines.sql`

---

**Document Version**: 1.0  
**Created**: 2026-05-09  
**Status**: Ready for Testing
