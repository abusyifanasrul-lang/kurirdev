# Database Tests for tier_change_log Bug Fix

## Bug Condition Exploration Test

File: `tier_change_log_bug_exploration.sql`

### Purpose
This test verifies that the `happened_at` column is missing from the `tier_change_log` table, causing INSERT operations to fail. This test MUST FAIL on unfixed code to confirm the bug exists.

### How to Run

#### Option 1: Using Supabase CLI (Local Database)
```bash
# Start local Supabase
supabase start

# Run the test
cat supabase/tests/tier_change_log_bug_exploration.sql | supabase db query
```

#### Option 2: Using Supabase CLI (Remote Database)
```bash
# Get your database password from Supabase dashboard
# Then run:
cat supabase/tests/tier_change_log_bug_exploration.sql | supabase db query --db-url "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"
```

#### Option 3: Using psql
```bash
psql -h [HOST] -U postgres -d postgres -f supabase/tests/tier_change_log_bug_exploration.sql
```

#### Option 4: Using Supabase Dashboard
1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `tier_change_log_bug_exploration.sql`
3. Click "Run"

### Expected Output (On Unfixed Code)

The test should output:
```
NOTICE:  CONFIRMED: happened_at column does NOT exist in tier_change_log table (bug exists)
NOTICE:  CONFIRMED: INSERT with happened_at failed as expected
NOTICE:  Error message: column "happened_at" of relation "tier_change_log" does not exist
NOTICE:  CONFIRMED: Error message matches expected pattern
NOTICE:  CONFIRMED: handle_courier_queue_sync() function references happened_at column
NOTICE:  This confirms the schema-code mismatch (bug exists)
NOTICE:  ========================================
NOTICE:  BUG CONDITION EXPLORATION TEST COMPLETE
NOTICE:  ========================================
```

### Expected Output (After Fix)

After implementing the fix (adding the `happened_at` column), the test behavior will change:
- Test 1: Will report that the column EXISTS (bug is fixed)
- Test 2: INSERT will succeed (no error)
- Test 3: Function still references happened_at (correct)

The test will raise an EXCEPTION saying "UNEXPECTED: happened_at column EXISTS" or "UNEXPECTED: INSERT with happened_at succeeded", which confirms the fix is working.

## What This Test Validates

1. **Schema Verification**: Confirms `happened_at` column is missing from `tier_change_log` table
2. **INSERT Failure**: Demonstrates that INSERT operations with `happened_at` fail with the expected error
3. **Function Inspection**: Confirms that `handle_courier_queue_sync()` function references the missing column
4. **Root Cause**: Proves the schema-code mismatch that causes the bug

## Next Steps

After running this test and confirming the bug exists:
1. Document the counterexamples found (test output)
2. Proceed to Task 2: Write preservation property tests
3. Implement the fix (Task 3)
4. Re-run this test to verify the fix works
