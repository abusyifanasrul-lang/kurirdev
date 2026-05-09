# Bug Condition Exploration Test Results: Incomplete Fine Query

## Test Information

- **Test File**: `incomplete_fine_query_bug_exploration.sql`
- **Task**: 1.1 Write bug condition exploration test for incomplete fine query
- **Date Created**: 2026-05-09
- **Status**: Test written and ready to run

## Test Purpose

This test demonstrates that the `get_courier_fines` function only returns flat fines from the `shift_attendance` table, missing per-order fines stored in `orders.fine_deducted`.

## Test Scenario

The test creates a scenario where a courier has:
- **1 flat_major fine**: Rp 30,000 (in `shift_attendance`)
- **3 orders with fine_deducted**: Rp 1,000 each (in `orders`)
- **Expected grand total**: Rp 33,000
- **Actual returned total**: Rp 30,000 (missing Rp 3,000)

## Test Structure

The test consists of 4 main verification steps:

### Test 1: Verify get_courier_fines returns incomplete data
- Calls `get_courier_fines(courier_id, date_from, date_to)`
- Verifies it only returns flat fines from `shift_attendance`
- Confirms per-order fines are missing from the result

### Test 2: Verify per-order fines exist in orders table
- Queries `orders` table directly for `fine_deducted` amounts
- Confirms per-order fines exist but are not included by `get_courier_fines`
- Proves the data exists but the function doesn't retrieve it

### Test 3: Financial Impact Analysis
- Calculates the missing amount (difference between reported and actual)
- Demonstrates the impact on financial reporting
- Shows Finance reports are incomplete

### Test 4: Inspect function signature
- Examines the `get_courier_fines` function definition
- Verifies the function doesn't support per-order fines in return type
- Confirms the function only queries `shift_attendance` table

## Expected Counterexample

**Scenario**: Courier with both flat fines and per-order fines

**Input**:
```sql
-- Courier has:
-- - 1 flat_major fine: Rp 30,000 (in shift_attendance)
-- - 3 orders with fine_deducted: Rp 1,000 each (in orders)

SELECT * FROM get_courier_fines(courier_id, '2026-05-09', '2026-05-09');
```

**Current Behavior (Bug)**:
```
Result:
- Flat fine records: 1
- Total flat fines: Rp 30,000
- Per-order fines: NOT INCLUDED
- Missing amount: Rp 3,000
```

**Expected Behavior (After Fix)**:
```json
{
  "flat_fines": [
    {
      "attendance_id": "uuid",
      "date": "2026-05-09",
      "fine_type": "flat_major",
      "amount": 30000,
      "status": "unpaid"
    }
  ],
  "per_order_fines": [
    {
      "order_id": "uuid",
      "order_number": "TEST-FINE-001",
      "date": "2026-05-09",
      "amount": 1000,
      "payment_status": "unpaid"
    },
    {
      "order_id": "uuid",
      "order_number": "TEST-FINE-002",
      "date": "2026-05-09",
      "amount": 1000,
      "payment_status": "unpaid"
    },
    {
      "order_id": "uuid",
      "order_number": "TEST-FINE-003",
      "date": "2026-05-09",
      "amount": 1000,
      "payment_status": "unpaid"
    }
  ],
  "total_flat_fines": 30000,
  "total_per_order_fines": 3000,
  "grand_total": 33000
}
```

## Root Cause Analysis

The test confirms the following root causes:

1. **Incomplete Query**: `get_courier_fines` only queries the `shift_attendance` table
2. **Missing Join**: Function does not join with `orders` table to retrieve per-order fines
3. **Limited Return Type**: Function signature doesn't include fields for per-order fines
4. **Data Exists**: Per-order fines are stored in `orders.fine_deducted` but not retrieved

## How to Run This Test

### Prerequisites
1. Ensure Supabase database is running (local or remote)
2. Database must have at least one courier user
3. Database must have at least one shift

### Running the Test

**Option 1: Local Supabase**
```bash
# Start Supabase if not running
supabase start

# Run the test
Get-Content supabase/tests/incomplete_fine_query_bug_exploration.sql | supabase db query
```

**Option 2: Remote Supabase**
```bash
Get-Content supabase/tests/incomplete_fine_query_bug_exploration.sql | supabase db query --db-url "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"
```

**Option 3: Supabase Dashboard**
1. Go to SQL Editor
2. Copy and paste the test file contents
3. Click "Run"

## Test Status

✅ **Test Written**: Bug exploration test created successfully  
⏳ **Test Execution**: Ready to run when database is available  
📝 **Documentation**: Test README and results template created  

## Next Steps

1. **Run the test** on unfixed code to confirm bug exists
2. **Document actual output** from test execution
3. **Proceed to Task 1.2**: Write preservation property tests
4. **Implement fix** (Task 1.3): Create `get_courier_fines_complete` function
5. **Re-run test** to verify fix works

## Notes

- This is a **bug exploration test** - it's EXPECTED TO FAIL on unfixed code
- Test failure confirms the bug exists (this is the correct outcome)
- Test will PASS after implementing `get_courier_fines_complete` function
- Test is non-destructive and cleans up all test data automatically
- Test can be run multiple times safely

## Related Files

- **Test File**: `supabase/tests/incomplete_fine_query_bug_exploration.sql`
- **Test README**: `supabase/tests/incomplete_fine_query_README.md`
- **Bugfix Requirements**: `.kiro/specs/courier-shift-settlement-fix/bugfix.md`
- **Design Document**: `.kiro/specs/courier-shift-settlement-fix/design.md`
- **Tasks**: `.kiro/specs/courier-shift-settlement-fix/tasks.md`

---

**Document Version**: 1.0  
**Created**: 2026-05-09  
**Status**: Test Ready - Awaiting Execution
