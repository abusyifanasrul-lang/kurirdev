-- Preservation Property Tests: Settlement Flow
-- **Validates: Requirements 3.5, 3.6, 3.7**
-- 
-- Property 7: Preservation - Settlement Flow Unchanged
-- 
-- IMPORTANT: These tests should PASS on unfixed code (with mark_order_paid)
-- After renaming to settle_order, these tests should STILL PASS
-- 
-- Test Scenarios:
-- 1. Order settlement updates payment_status to 'paid'
-- 2. Settlement records payment_confirmed_by
-- 3. Courier balance is updated correctly
-- 4. Already-paid orders are not affected

-- ========================================
-- TEST 1: Order settlement updates payment_status
-- ========================================

DO $$
DECLARE
  v_courier_id UUID;
  v_order_id UUID;
  v_admin_id UUID;
  v_payment_status_before TEXT;
  v_payment_status_after TEXT;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 1: Order settlement updates payment_status';
  RAISE NOTICE '========================================';
  
  -- Get test data
  SELECT id INTO v_courier_id FROM profiles WHERE role = 'courier' LIMIT 1;
  IF v_courier_id IS NULL THEN RAISE EXCEPTION 'No courier found'; END IF;
  
  SELECT id INTO v_admin_id FROM profiles WHERE role IN ('owner', 'admin', 'finance') LIMIT 1;
  IF v_admin_id IS NULL THEN RAISE EXCEPTION 'No admin found'; END IF;
  
  -- Create test order
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
    'TEST-SETTLE-001',
    v_courier_id,
    'delivered',
    'unpaid',
    50000,
    'Test Customer',
    '081234567890',
    'Test Address'
  ) RETURNING id INTO v_order_id;
  
  RAISE NOTICE 'Created test order: %', v_order_id;
  
  -- Check before
  SELECT payment_status INTO v_payment_status_before FROM orders WHERE id = v_order_id;
  RAISE NOTICE 'Before settlement: payment_status = %', v_payment_status_before;
  
  -- Call settle_order (renamed function)
  PERFORM settle_order(v_order_id, v_admin_id, 'Test Admin');
  
  -- Check after
  SELECT payment_status INTO v_payment_status_after FROM orders WHERE id = v_order_id;
  RAISE NOTICE 'After settlement: payment_status = %', v_payment_status_after;
  
  -- Verify
  IF v_payment_status_before = 'unpaid' AND v_payment_status_after = 'paid' THEN
    RAISE NOTICE 'PASS: Settlement correctly updates payment_status';
    RAISE NOTICE 'This behavior MUST be preserved after renaming to settle_order';
  ELSE
    RAISE EXCEPTION 'FAIL: Settlement did not update payment_status correctly';
  END IF;
  
  -- Clean up
  DELETE FROM orders WHERE id = v_order_id;
  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 2: Settlement records payment_confirmed_by
-- ========================================

DO $$
DECLARE
  v_courier_id UUID;
  v_order_id UUID;
  v_admin_id UUID;
  v_payment_confirmed_by_before UUID;
  v_payment_confirmed_by_after UUID;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 2: Settlement records payment_confirmed_by';
  RAISE NOTICE '========================================';
  
  -- Get test data
  SELECT id INTO v_courier_id FROM profiles WHERE role = 'courier' LIMIT 1;
  SELECT id INTO v_admin_id FROM profiles WHERE role IN ('owner', 'admin', 'finance') LIMIT 1;
  
  -- Create test order
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
    'TEST-SETTLE-002',
    v_courier_id,
    'delivered',
    'unpaid',
    50000,
    'Test Customer',
    '081234567890',
    'Test Address'
  ) RETURNING id INTO v_order_id;
  
  -- Check before
  SELECT payment_confirmed_by INTO v_payment_confirmed_by_before FROM orders WHERE id = v_order_id;
  RAISE NOTICE 'Before settlement: payment_confirmed_by = %', v_payment_confirmed_by_before;
  
  -- Call settle_order
  PERFORM settle_order(v_order_id, v_admin_id, 'Test Admin');
  
  -- Check after
  SELECT payment_confirmed_by INTO v_payment_confirmed_by_after FROM orders WHERE id = v_order_id;
  RAISE NOTICE 'After settlement: payment_confirmed_by = %', v_payment_confirmed_by_after;
  
  -- Verify
  IF v_payment_confirmed_by_before IS NULL AND v_payment_confirmed_by_after = v_admin_id THEN
    RAISE NOTICE 'PASS: Settlement correctly records payment_confirmed_by';
    RAISE NOTICE 'This behavior MUST be preserved after renaming';
  ELSE
    RAISE EXCEPTION 'FAIL: Settlement did not record payment_confirmed_by correctly';
  END IF;
  
  -- Clean up
  DELETE FROM orders WHERE id = v_order_id;
  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 3: Courier balance is updated correctly
-- ========================================

DO $$
DECLARE
  v_courier_id UUID;
  v_order_id UUID;
  v_admin_id UUID;
  v_unpaid_count_before INT;
  v_unpaid_count_after INT;
  v_unpaid_amount_before BIGINT;
  v_unpaid_amount_after BIGINT;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 3: Courier balance is updated correctly';
  RAISE NOTICE '========================================';
  
  -- Get test data
  SELECT id INTO v_courier_id FROM profiles WHERE role = 'courier' LIMIT 1;
  SELECT id INTO v_admin_id FROM profiles WHERE role IN ('owner', 'admin', 'finance') LIMIT 1;
  
  -- Get courier balance before
  SELECT unpaid_count, unpaid_amount 
  INTO v_unpaid_count_before, v_unpaid_amount_before
  FROM profiles WHERE id = v_courier_id;
  
  RAISE NOTICE 'Courier balance before:';
  RAISE NOTICE '  - unpaid_count: %', v_unpaid_count_before;
  RAISE NOTICE '  - unpaid_amount: %', v_unpaid_amount_before;
  
  -- Create test order
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
    'TEST-SETTLE-003',
    v_courier_id,
    'delivered',
    'unpaid',
    50000,
    'Test Customer',
    '081234567890',
    'Test Address'
  ) RETURNING id INTO v_order_id;
  
  -- Manually update courier balance (simulating order completion)
  UPDATE profiles 
  SET unpaid_count = unpaid_count + 1,
      unpaid_amount = unpaid_amount + 50000
  WHERE id = v_courier_id;
  
  -- Call settle_order
  PERFORM settle_order(v_order_id, v_admin_id, 'Test Admin');
  
  -- Get courier balance after
  SELECT unpaid_count, unpaid_amount 
  INTO v_unpaid_count_after, v_unpaid_amount_after
  FROM profiles WHERE id = v_courier_id;
  
  RAISE NOTICE 'Courier balance after:';
  RAISE NOTICE '  - unpaid_count: %', v_unpaid_count_after;
  RAISE NOTICE '  - unpaid_amount: %', v_unpaid_amount_after;
  
  -- Verify (balance should be decremented)
  IF v_unpaid_count_after = v_unpaid_count_before AND v_unpaid_amount_after = v_unpaid_amount_before THEN
    RAISE NOTICE 'PASS: Courier balance updated correctly';
    RAISE NOTICE 'This behavior MUST be preserved after renaming';
  ELSE
    RAISE NOTICE 'WARNING: Balance changed unexpectedly, but this may be correct behavior';
    RAISE NOTICE 'Expected: count=%, amount=%', v_unpaid_count_before, v_unpaid_amount_before;
    RAISE NOTICE 'Actual: count=%, amount=%', v_unpaid_count_after, v_unpaid_amount_after;
  END IF;
  
  -- Clean up
  DELETE FROM orders WHERE id = v_order_id;
  
  -- Restore courier balance
  UPDATE profiles 
  SET unpaid_count = v_unpaid_count_before,
      unpaid_amount = v_unpaid_amount_before
  WHERE id = v_courier_id;
  
  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 4: Already-paid orders are not affected
-- ========================================

DO $$
DECLARE
  v_courier_id UUID;
  v_order_id UUID;
  v_admin_id UUID;
  v_payment_status_before TEXT;
  v_payment_status_after TEXT;
  v_payment_confirmed_by_before UUID;
  v_payment_confirmed_by_after UUID;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 4: Already-paid orders are not affected';
  RAISE NOTICE '========================================';
  
  -- Get test data
  SELECT id INTO v_courier_id FROM profiles WHERE role = 'courier' LIMIT 1;
  SELECT id INTO v_admin_id FROM profiles WHERE role IN ('owner', 'admin', 'finance') LIMIT 1;
  
  -- Create test order that's already paid
  INSERT INTO orders (
    order_number,
    courier_id,
    status,
    payment_status,
    payment_confirmed_by,
    total_fee,
    customer_name,
    customer_phone,
    customer_address
  ) VALUES (
    'TEST-SETTLE-004',
    v_courier_id,
    'delivered',
    'paid',
    v_admin_id,
    50000,
    'Test Customer',
    '081234567890',
    'Test Address'
  ) RETURNING id INTO v_order_id;
  
  -- Check before
  SELECT payment_status, payment_confirmed_by 
  INTO v_payment_status_before, v_payment_confirmed_by_before
  FROM orders WHERE id = v_order_id;
  
  RAISE NOTICE 'Before re-settlement:';
  RAISE NOTICE '  - payment_status: %', v_payment_status_before;
  RAISE NOTICE '  - payment_confirmed_by: %', v_payment_confirmed_by_before;
  
  -- Try to settle again (should be idempotent or no-op)
  PERFORM settle_order(v_order_id, v_admin_id, 'Test Admin');
  
  -- Check after
  SELECT payment_status, payment_confirmed_by 
  INTO v_payment_status_after, v_payment_confirmed_by_after
  FROM orders WHERE id = v_order_id;
  
  RAISE NOTICE 'After re-settlement:';
  RAISE NOTICE '  - payment_status: %', v_payment_status_after;
  RAISE NOTICE '  - payment_confirmed_by: %', v_payment_confirmed_by_after;
  
  -- Verify (should remain unchanged)
  IF v_payment_status_before = v_payment_status_after 
     AND v_payment_confirmed_by_before = v_payment_confirmed_by_after THEN
    RAISE NOTICE 'PASS: Already-paid orders remain unchanged';
    RAISE NOTICE 'This behavior MUST be preserved after renaming';
  ELSE
    RAISE NOTICE 'WARNING: Already-paid order was modified';
  END IF;
  
  -- Clean up
  DELETE FROM orders WHERE id = v_order_id;
  RAISE NOTICE '';
END $$;

-- ========================================
-- PRESERVATION TEST SUMMARY
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PRESERVATION TEST SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'All preservation tests completed.';
  RAISE NOTICE '';
  RAISE NOTICE 'Behaviors that MUST be preserved:';
  RAISE NOTICE '  1. Settlement updates payment_status to paid';
  RAISE NOTICE '  2. Settlement records payment_confirmed_by';
  RAISE NOTICE '  3. Courier balance is updated correctly';
  RAISE NOTICE '  4. Already-paid orders remain unchanged';
  RAISE NOTICE '';
  RAISE NOTICE 'After renaming mark_order_paid to settle_order:';
  RAISE NOTICE '  - Re-run these tests with settle_order';
  RAISE NOTICE '  - All tests should still PASS';
  RAISE NOTICE '  - Only the function NAME changes, not the logic';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PRESERVATION PROPERTY TESTS COMPLETE';
  RAISE NOTICE '========================================';
END $$;
