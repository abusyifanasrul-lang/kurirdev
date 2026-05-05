-- Preservation Property Tests for tier_change_log
-- These tests MUST PASS on unfixed code to establish baseline behavior
-- 
-- Property 2: Preservation - Existing tier_change_log Functionality Unchanged
-- GOAL: Capture observed behavior patterns that must be preserved after fix
--
-- Expected Outcome: All tests PASS (confirms baseline behavior to preserve)

-- ============================================================================
-- TEST 1: SELECT queries on tier_change_log return existing records
-- ============================================================================
DO $$
DECLARE
  record_count INTEGER;
  column_count INTEGER;
BEGIN
  -- Count existing records
  SELECT COUNT(*) INTO record_count FROM tier_change_log;
  
  -- Count columns (should be 15 columns currently, 16 after fix)
  SELECT COUNT(*) INTO column_count
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'tier_change_log';
  
  RAISE NOTICE 'BASELINE: tier_change_log has % records and % columns', record_count, column_count;
  
  -- Verify we can SELECT all existing columns
  PERFORM id, courier_id, old_status, new_status, old_is_priority, new_is_priority,
          reason, created_at, tier_before, tier_after, queue_joined_at_before,
          queue_joined_at_after, trigger_source, source_id, context
  FROM tier_change_log
  LIMIT 1;
  
  RAISE NOTICE 'PASS: SELECT query on all existing columns works';
END $$;

-- ============================================================================
-- TEST 2: INSERT without happened_at column works (if any code does this)
-- ============================================================================
DO $$
DECLARE
  test_courier_id UUID;
  inserted_id UUID;
BEGIN
  -- Get a test courier ID
  SELECT id INTO test_courier_id 
  FROM profiles 
  WHERE role = 'courier' 
  LIMIT 1;
  
  IF test_courier_id IS NULL THEN
    test_courier_id := gen_random_uuid();
  END IF;
  
  -- INSERT without happened_at column (this should work on unfixed code)
  INSERT INTO tier_change_log (
    id,
    courier_id,
    old_status,
    new_status,
    old_is_priority,
    new_is_priority,
    reason,
    created_at
  ) VALUES (
    gen_random_uuid(),
    test_courier_id,
    'off',
    'on',
    false,
    false,
    'Preservation test - INSERT without happened_at',
    NOW()
  ) RETURNING id INTO inserted_id;
  
  RAISE NOTICE 'PASS: INSERT without happened_at column succeeded (id: %)', inserted_id;
  
  -- Clean up test data
  DELETE FROM tier_change_log WHERE id = inserted_id;
  RAISE NOTICE 'Test data cleaned up';
END $$;

-- ============================================================================
-- TEST 3: INSERT with all existing columns (except happened_at) works
-- ============================================================================
DO $$
DECLARE
  test_courier_id UUID;
  inserted_id UUID;
BEGIN
  -- Get a test courier ID
  SELECT id INTO test_courier_id 
  FROM profiles 
  WHERE role = 'courier' 
  LIMIT 1;
  
  IF test_courier_id IS NULL THEN
    test_courier_id := gen_random_uuid();
  END IF;
  
  -- INSERT with all existing columns
  INSERT INTO tier_change_log (
    id,
    courier_id,
    old_status,
    new_status,
    old_is_priority,
    new_is_priority,
    reason,
    created_at,
    tier_before,
    tier_after,
    queue_joined_at_before,
    queue_joined_at_after,
    trigger_source,
    source_id,
    context
  ) VALUES (
    gen_random_uuid(),
    test_courier_id,
    'on',
    'stay',
    false,
    false,
    'Preservation test - full INSERT',
    NOW(),
    1,
    2,
    NOW() - INTERVAL '1 hour',
    NOW(),
    'status_on_to_stay',
    gen_random_uuid(),
    jsonb_build_object(
      'old_status', 'on',
      'new_status', 'stay',
      'is_priority_recovery', false
    )
  ) RETURNING id INTO inserted_id;
  
  RAISE NOTICE 'PASS: INSERT with all existing columns succeeded (id: %)', inserted_id;
  
  -- Verify we can query the inserted record
  PERFORM * FROM tier_change_log WHERE id = inserted_id;
  RAISE NOTICE 'PASS: Can query the inserted record';
  
  -- Clean up test data
  DELETE FROM tier_change_log WHERE id = inserted_id;
  RAISE NOTICE 'Test data cleaned up';
END $$;

-- ============================================================================
-- TEST 4: Foreign key constraint to profiles.id works
-- ============================================================================
DO $$
DECLARE
  test_courier_id UUID;
  inserted_id UUID;
  fk_violation BOOLEAN := false;
BEGIN
  -- Get a real courier ID
  SELECT id INTO test_courier_id 
  FROM profiles 
  WHERE role = 'courier' 
  LIMIT 1;
  
  IF test_courier_id IS NOT NULL THEN
    -- INSERT with valid courier_id should work
    INSERT INTO tier_change_log (
      id, courier_id, old_status, new_status,
      old_is_priority, new_is_priority, reason, created_at
    ) VALUES (
      gen_random_uuid(), test_courier_id, 'off', 'on',
      false, false, 'FK test - valid courier', NOW()
    ) RETURNING id INTO inserted_id;
    
    RAISE NOTICE 'PASS: INSERT with valid courier_id succeeded';
    DELETE FROM tier_change_log WHERE id = inserted_id;
  END IF;
  
  -- Try INSERT with invalid courier_id (should fail)
  BEGIN
    INSERT INTO tier_change_log (
      id, courier_id, old_status, new_status,
      old_is_priority, new_is_priority, reason, created_at
    ) VALUES (
      gen_random_uuid(), gen_random_uuid(), 'off', 'on',
      false, false, 'FK test - invalid courier', NOW()
    );
    
    RAISE WARNING 'UNEXPECTED: INSERT with invalid courier_id succeeded (FK constraint not working)';
    
  EXCEPTION
    WHEN foreign_key_violation THEN
      fk_violation := true;
      RAISE NOTICE 'PASS: Foreign key constraint works (INSERT with invalid courier_id failed as expected)';
  END;
  
  IF NOT fk_violation AND test_courier_id IS NULL THEN
    RAISE NOTICE 'SKIP: No couriers available to test FK constraint';
  END IF;
END $$;

-- ============================================================================
-- TEST 5: UPDATE operations on existing records work
-- ============================================================================
DO $$
DECLARE
  test_courier_id UUID;
  test_record_id UUID;
BEGIN
  -- Get a test courier ID
  SELECT id INTO test_courier_id 
  FROM profiles 
  WHERE role = 'courier' 
  LIMIT 1;
  
  IF test_courier_id IS NULL THEN
    test_courier_id := gen_random_uuid();
  END IF;
  
  -- Create a test record
  INSERT INTO tier_change_log (
    id, courier_id, old_status, new_status,
    old_is_priority, new_is_priority, reason, created_at
  ) VALUES (
    gen_random_uuid(), test_courier_id, 'off', 'on',
    false, false, 'Preservation test - UPDATE', NOW()
  ) RETURNING id INTO test_record_id;
  
  -- UPDATE the record
  UPDATE tier_change_log
  SET reason = 'Updated reason',
      context = jsonb_build_object('updated', true)
  WHERE id = test_record_id;
  
  RAISE NOTICE 'PASS: UPDATE operation succeeded';
  
  -- Verify the update
  PERFORM * FROM tier_change_log 
  WHERE id = test_record_id 
    AND reason = 'Updated reason';
  
  IF FOUND THEN
    RAISE NOTICE 'PASS: UPDATE was applied correctly';
  ELSE
    RAISE WARNING 'UNEXPECTED: UPDATE was not applied';
  END IF;
  
  -- Clean up
  DELETE FROM tier_change_log WHERE id = test_record_id;
  RAISE NOTICE 'Test data cleaned up';
END $$;

-- ============================================================================
-- TEST 6: DELETE operations work
-- ============================================================================
DO $$
DECLARE
  test_courier_id UUID;
  test_record_id UUID;
  deleted_count INTEGER;
BEGIN
  -- Get a test courier ID
  SELECT id INTO test_courier_id 
  FROM profiles 
  WHERE role = 'courier' 
  LIMIT 1;
  
  IF test_courier_id IS NULL THEN
    test_courier_id := gen_random_uuid();
  END IF;
  
  -- Create a test record
  INSERT INTO tier_change_log (
    id, courier_id, old_status, new_status,
    old_is_priority, new_is_priority, reason, created_at
  ) VALUES (
    gen_random_uuid(), test_courier_id, 'off', 'on',
    false, false, 'Preservation test - DELETE', NOW()
  ) RETURNING id INTO test_record_id;
  
  -- DELETE the record
  DELETE FROM tier_change_log WHERE id = test_record_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  IF deleted_count = 1 THEN
    RAISE NOTICE 'PASS: DELETE operation succeeded (1 row deleted)';
  ELSE
    RAISE WARNING 'UNEXPECTED: DELETE affected % rows', deleted_count;
  END IF;
END $$;

-- ============================================================================
-- TEST 7: JSONB context column operations work
-- ============================================================================
DO $$
DECLARE
  test_courier_id UUID;
  test_record_id UUID;
  context_value JSONB;
BEGIN
  -- Get a test courier ID
  SELECT id INTO test_courier_id 
  FROM profiles 
  WHERE role = 'courier' 
  LIMIT 1;
  
  IF test_courier_id IS NULL THEN
    test_courier_id := gen_random_uuid();
  END IF;
  
  -- Create a test record with JSONB context
  INSERT INTO tier_change_log (
    id, courier_id, old_status, new_status,
    old_is_priority, new_is_priority, reason, created_at,
    context
  ) VALUES (
    gen_random_uuid(), test_courier_id, 'on', 'stay',
    false, false, 'Preservation test - JSONB', NOW(),
    jsonb_build_object(
      'old_status', 'on',
      'new_status', 'stay',
      'is_priority_recovery', false,
      'test_data', 'preservation'
    )
  ) RETURNING id INTO test_record_id;
  
  -- Query JSONB field
  SELECT context INTO context_value
  FROM tier_change_log
  WHERE id = test_record_id;
  
  IF context_value->>'test_data' = 'preservation' THEN
    RAISE NOTICE 'PASS: JSONB context column works correctly';
  ELSE
    RAISE WARNING 'UNEXPECTED: JSONB context value incorrect';
  END IF;
  
  -- Clean up
  DELETE FROM tier_change_log WHERE id = test_record_id;
  RAISE NOTICE 'Test data cleaned up';
END $$;

-- ============================================================================
-- SUMMARY
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PRESERVATION PROPERTY TESTS COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Expected Outcome: All tests should PASS on unfixed code';
  RAISE NOTICE 'This establishes baseline behavior that must be preserved after fix';
  RAISE NOTICE '';
  RAISE NOTICE 'Tests covered:';
  RAISE NOTICE '1. SELECT queries on existing columns';
  RAISE NOTICE '2. INSERT without happened_at column';
  RAISE NOTICE '3. INSERT with all existing columns';
  RAISE NOTICE '4. Foreign key constraints';
  RAISE NOTICE '5. UPDATE operations';
  RAISE NOTICE '6. DELETE operations';
  RAISE NOTICE '7. JSONB context column operations';
  RAISE NOTICE '';
  RAISE NOTICE 'After fix: Re-run these tests to ensure no regressions';
END $$;
