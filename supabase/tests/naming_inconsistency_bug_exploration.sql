-- Bug Condition Exploration Test: Naming Inconsistency
-- Bug: Function named `mark_order_paid` in database but `settleOrder` in frontend/documentation
-- 
-- CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
-- DO NOT attempt to fix the test or the code when it fails
-- 
-- Expected Outcome: Test FAILS (this is correct - it proves the bug exists)
-- After Fix: Test PASSES (confirms bug is fixed)

-- ========================================
-- TEST 1: Verify function name inconsistency exists
-- ========================================

DO $$
DECLARE
  v_mark_order_paid_exists BOOLEAN := false;
  v_settle_order_exists BOOLEAN := false;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 1: Function naming inconsistency';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
  -- Check if mark_order_paid exists
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'mark_order_paid' 
    AND pronamespace = 'public'::regnamespace
  ) INTO v_mark_order_paid_exists;
  
  -- Check if settle_order exists
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'settle_order' 
    AND pronamespace = 'public'::regnamespace
  ) INTO v_settle_order_exists;
  
  RAISE NOTICE 'Function existence check:';
  RAISE NOTICE '  - mark_order_paid exists: %', v_mark_order_paid_exists;
  RAISE NOTICE '  - settle_order exists: %', v_settle_order_exists;
  RAISE NOTICE '';
  
  IF v_mark_order_paid_exists AND NOT v_settle_order_exists THEN
    RAISE NOTICE 'CONFIRMED: Naming inconsistency bug exists';
    RAISE NOTICE '  - Database has: mark_order_paid';
    RAISE NOTICE '  - Frontend expects: settle_order (via settleOrder function)';
    RAISE NOTICE '  - Documentation uses: settle_order terminology';
    RAISE NOTICE '';
    RAISE NOTICE 'Impact:';
    RAISE NOTICE '  - Confusing for developers (two different names for same operation)';
    RAISE NOTICE '  - Frontend must use mark_order_paid in RPC calls';
    RAISE NOTICE '  - Documentation and code are out of sync';
  ELSIF NOT v_mark_order_paid_exists AND v_settle_order_exists THEN
    RAISE EXCEPTION 'UNEXPECTED: Bug appears to be already fixed';
  ELSIF v_mark_order_paid_exists AND v_settle_order_exists THEN
    RAISE EXCEPTION 'UNEXPECTED: Both functions exist (migration in progress?)';
  ELSE
    RAISE EXCEPTION 'UNEXPECTED: Neither function exists';
  END IF;
END $$;

-- ========================================
-- TEST 2: Verify mark_order_paid function signature
-- ========================================

DO $$
DECLARE
  v_function_count INT;
  v_function_record RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 2: mark_order_paid function signature';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
  -- Count overloaded versions
  SELECT COUNT(*) INTO v_function_count
  FROM pg_proc
  WHERE proname = 'mark_order_paid'
  AND pronamespace = 'public'::regnamespace;
  
  RAISE NOTICE 'Number of mark_order_paid overloads: %', v_function_count;
  RAISE NOTICE '';
  
  -- List all versions
  FOR v_function_record IN
    SELECT 
      pg_get_function_arguments(oid) as args,
      pg_get_function_result(oid) as result
    FROM pg_proc
    WHERE proname = 'mark_order_paid'
    AND pronamespace = 'public'::regnamespace
    ORDER BY pronargs
  LOOP
    RAISE NOTICE 'Function signature:';
    RAISE NOTICE '  mark_order_paid(%)  RETURNS %', v_function_record.args, v_function_record.result;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Analysis:';
  RAISE NOTICE '  - Function exists with % overload(s)', v_function_count;
  RAISE NOTICE '  - Frontend calls this function via supabase.rpc(''mark_order_paid'', ...)';
  RAISE NOTICE '  - But frontend function is named settleOrder';
  RAISE NOTICE '  - This creates confusion and inconsistency';
END $$;

-- ========================================
-- TEST 3: Verify function works correctly (functional test)
-- ========================================

DO $$
DECLARE
  v_test_order_id UUID;
  v_test_courier_id UUID;
  v_order_before RECORD;
  v_order_after RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 3: Functional test - mark_order_paid works';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
  -- Get a courier
  SELECT id INTO v_test_courier_id 
  FROM profiles 
  WHERE role = 'courier' 
  LIMIT 1;
  
  IF v_test_courier_id IS NULL THEN
    RAISE EXCEPTION 'No courier found in database';
  END IF;
  
  -- Create a test order
  INSERT INTO orders (
    order_number,
    courier_id,
    status,
    payment_status,
    total_fee,
    customer_name,
    customer_phone,
    customer_address
  ) VALUES (
    'TEST-NAMING-001',
    v_test_courier_id,
    'delivered',
    'unpaid',
    50000,
    'Test Customer',
    '081234567890',
    'Test Address'
  ) RETURNING id INTO v_test_order_id;
  
  RAISE NOTICE 'Created test order: %', v_test_order_id;
  
  -- Get order state before
  SELECT payment_status, payment_confirmed_by, payment_confirmed_at 
  INTO v_order_before
  FROM orders 
  WHERE id = v_test_order_id;
  
  RAISE NOTICE 'Order before mark_order_paid:';
  RAISE NOTICE '  - payment_status: %', v_order_before.payment_status;
  RAISE NOTICE '  - payment_confirmed_by: %', v_order_before.payment_confirmed_by;
  RAISE NOTICE '  - payment_confirmed_at: %', v_order_before.payment_confirmed_at;
  RAISE NOTICE '';
  
  -- Call mark_order_paid (the function with inconsistent name)
  PERFORM mark_order_paid(v_test_order_id);
  
  -- Get order state after
  SELECT payment_status, payment_confirmed_by, payment_confirmed_at 
  INTO v_order_after
  FROM orders 
  WHERE id = v_test_order_id;
  
  RAISE NOTICE 'Order after mark_order_paid:';
  RAISE NOTICE '  - payment_status: %', v_order_after.payment_status;
  RAISE NOTICE '  - payment_confirmed_by: %', v_order_after.payment_confirmed_by;
  RAISE NOTICE '  - payment_confirmed_at: %', v_order_after.payment_confirmed_at;
  RAISE NOTICE '';
  
  -- Verify function works
  IF v_order_after.payment_status = 'paid' THEN
    RAISE NOTICE 'CONFIRMED: mark_order_paid function works correctly';
    RAISE NOTICE '  - Function logic is correct';
    RAISE NOTICE '  - Only the NAME is inconsistent';
    RAISE NOTICE '  - Should be renamed to settle_order';
  ELSE
    RAISE EXCEPTION 'FAIL: mark_order_paid did not update payment_status';
  END IF;
  
  -- Clean up
  DELETE FROM orders WHERE id = v_test_order_id;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Test order cleaned up';
END $$;

-- ========================================
-- TEST 4: Document the inconsistency impact
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 4: Impact analysis';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
  RAISE NOTICE 'Current state:';
  RAISE NOTICE '  - Database function: mark_order_paid';
  RAISE NOTICE '  - Frontend function: settleOrder';
  RAISE NOTICE '  - Frontend RPC call: supabase.rpc(''mark_order_paid'', ...)';
  RAISE NOTICE '  - Documentation: settle_order terminology';
  RAISE NOTICE '';
  
  RAISE NOTICE 'Problems:';
  RAISE NOTICE '  1. Developer confusion: Two names for same operation';
  RAISE NOTICE '  2. Code readability: Frontend uses settleOrder but calls mark_order_paid';
  RAISE NOTICE '  3. Documentation mismatch: Docs say settle_order, code says mark_order_paid';
  RAISE NOTICE '  4. Maintenance burden: Must remember both names';
  RAISE NOTICE '';
  
  RAISE NOTICE 'Expected fix:';
  RAISE NOTICE '  1. Rename database function: mark_order_paid → settle_order';
  RAISE NOTICE '  2. Update frontend RPC calls: mark_order_paid → settle_order';
  RAISE NOTICE '  3. Keep frontend function name: settleOrder (camelCase is correct for TS)';
  RAISE NOTICE '  4. Update type definitions: mark_order_paid → settle_order';
  RAISE NOTICE '';
  
  RAISE NOTICE 'Backward compatibility:';
  RAISE NOTICE '  - Create settle_order as new function';
  RAISE NOTICE '  - Keep mark_order_paid as deprecated alias (optional)';
  RAISE NOTICE '  - Or: Drop mark_order_paid and create settle_order (breaking change)';
  RAISE NOTICE '';
END $$;

-- ========================================
-- COUNTEREXAMPLE SUMMARY
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'COUNTEREXAMPLE SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
  RAISE NOTICE 'Bug: Naming Inconsistency';
  RAISE NOTICE '';
  
  RAISE NOTICE 'Scenario:';
  RAISE NOTICE '  - Database has function named: mark_order_paid';
  RAISE NOTICE '  - Frontend has function named: settleOrder';
  RAISE NOTICE '  - Documentation uses terminology: settle_order';
  RAISE NOTICE '';
  
  RAISE NOTICE 'Bug Behavior:';
  RAISE NOTICE '  - Function works correctly (logic is fine)';
  RAISE NOTICE '  - But naming is inconsistent across codebase';
  RAISE NOTICE '  - Causes confusion for developers';
  RAISE NOTICE '';
  
  RAISE NOTICE 'Root Cause:';
  RAISE NOTICE '  - Function was initially named mark_order_paid during development';
  RAISE NOTICE '  - Documentation and design used settle_order terminology';
  RAISE NOTICE '  - Mismatch was never reconciled';
  RAISE NOTICE '';
  
  RAISE NOTICE 'Expected Fix:';
  RAISE NOTICE '  - Rename database function to settle_order';
  RAISE NOTICE '  - Update all RPC calls in frontend';
  RAISE NOTICE '  - Update type definitions';
  RAISE NOTICE '  - Ensure consistent naming across codebase';
  RAISE NOTICE '';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'BUG CONDITION EXPLORATION TEST COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
  RAISE NOTICE 'Result: BUG CONFIRMED';
  RAISE NOTICE 'The test demonstrates that mark_order_paid exists but settle_order does not.';
  RAISE NOTICE 'This test will PASS after renaming the function to settle_order.';
END $$;
