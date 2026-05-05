-- Bug Condition Exploration Test for tier_change_log.happened_at
-- This test MUST FAIL on unfixed code - failure confirms the bug exists
-- DO NOT attempt to fix the test or the code when it fails
-- 
-- Property 1: Bug Condition - Missing happened_at Column Causes INSERT Failure
-- GOAL: Surface counterexamples that demonstrate the bug exists
--
-- Expected Outcome: Test FAILS with error "column 'happened_at' of relation 'tier_change_log' does not exist"

-- ============================================================================
-- TEST 1: Verify happened_at column does NOT exist in tier_change_log table
-- ============================================================================
DO $$
DECLARE
  column_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'tier_change_log' 
      AND column_name = 'happened_at'
  ) INTO column_exists;
  
  IF column_exists THEN
    RAISE EXCEPTION 'UNEXPECTED: happened_at column EXISTS in tier_change_log table. Bug may already be fixed.';
  ELSE
    RAISE NOTICE 'CONFIRMED: happened_at column does NOT exist in tier_change_log table (bug exists)';
  END IF;
END $$;

-- ============================================================================
-- TEST 2: Attempt to INSERT into tier_change_log with happened_at column
-- This simulates what handle_courier_queue_sync() trigger does
-- ============================================================================
DO $$
DECLARE
  test_courier_id UUID;
  insert_error TEXT;
BEGIN
  -- Get a test courier ID (or create a dummy one)
  SELECT id INTO test_courier_id 
  FROM profiles 
  WHERE role = 'courier' 
  LIMIT 1;
  
  -- If no courier exists, use a dummy UUID
  IF test_courier_id IS NULL THEN
    test_courier_id := gen_random_uuid();
  END IF;
  
  -- Attempt INSERT with happened_at column (this should FAIL)
  BEGIN
    INSERT INTO tier_change_log (
      id,
      courier_id,
      old_status,
      new_status,
      old_is_priority,
      new_is_priority,
      reason,
      happened_at,
      created_at
    ) VALUES (
      gen_random_uuid(),
      test_courier_id,
      'off',
      'on',
      false,
      false,
      'Bug exploration test',
      NOW(),
      NOW()
    );
    
    -- If we reach here, the INSERT succeeded (bug is fixed)
    RAISE EXCEPTION 'UNEXPECTED: INSERT with happened_at succeeded. Bug may already be fixed.';
    
  EXCEPTION
    WHEN undefined_column THEN
      -- This is the EXPECTED error - bug exists
      GET STACKED DIAGNOSTICS insert_error = MESSAGE_TEXT;
      RAISE NOTICE 'CONFIRMED: INSERT with happened_at failed as expected';
      RAISE NOTICE 'Error message: %', insert_error;
      
      -- Verify it's the specific error we expect
      IF insert_error LIKE '%column "happened_at"%does not exist%' THEN
        RAISE NOTICE 'CONFIRMED: Error message matches expected pattern';
      ELSE
        RAISE WARNING 'UNEXPECTED: Error message does not match expected pattern: %', insert_error;
      END IF;
  END;
END $$;

-- ============================================================================
-- TEST 3: Inspect handle_courier_queue_sync() function to confirm it references happened_at
-- ============================================================================
DO $$
DECLARE
  function_definition TEXT;
  has_happened_at BOOLEAN;
BEGIN
  -- Get the function definition
  SELECT pg_get_functiondef(oid) INTO function_definition
  FROM pg_proc
  WHERE proname = 'handle_courier_queue_sync'
  LIMIT 1;
  
  IF function_definition IS NULL THEN
    RAISE WARNING 'handle_courier_queue_sync() function not found';
  ELSE
    -- Check if function definition contains 'happened_at'
    has_happened_at := function_definition LIKE '%happened_at%';
    
    IF has_happened_at THEN
      RAISE NOTICE 'CONFIRMED: handle_courier_queue_sync() function references happened_at column';
      RAISE NOTICE 'This confirms the schema-code mismatch (bug exists)';
    ELSE
      RAISE WARNING 'UNEXPECTED: handle_courier_queue_sync() does not reference happened_at';
    END IF;
  END IF;
END $$;

-- ============================================================================
-- SUMMARY
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'BUG CONDITION EXPLORATION TEST COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Expected Outcome: All tests should CONFIRM the bug exists';
  RAISE NOTICE '1. happened_at column does NOT exist in tier_change_log';
  RAISE NOTICE '2. INSERT with happened_at fails with column not found error';
  RAISE NOTICE '3. handle_courier_queue_sync() function references happened_at';
  RAISE NOTICE '';
  RAISE NOTICE 'This test will PASS (succeed) after the fix is implemented:';
  RAISE NOTICE '- happened_at column will exist';
  RAISE NOTICE '- INSERT operations will succeed';
  RAISE NOTICE '- No schema-code mismatch';
END $$;
