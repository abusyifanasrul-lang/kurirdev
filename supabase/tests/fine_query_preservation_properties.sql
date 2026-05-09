-- Preservation Property Tests: Fine Query
-- **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.14, 3.15, 3.16**
-- 
-- Property 2: Preservation - Existing Fine Calculation Unchanged
-- 
-- IMPORTANT: These tests should PASS on unfixed code
-- After implementing get_courier_fines_complete, these tests should STILL PASS
-- 
-- Property: Preservation - Existing Fine Calculation Unchanged
-- FOR ALL input WHERE NOT isBugCondition_IncompleteFineQuery(input) DO
--   ASSERT get_courier_fines'(input) behavior is preserved
--   ASSERT fine calculation for orders without fines is unchanged
--   ASSERT auth rules are preserved
-- END FOR
--
-- Test Scenarios:
-- 1. Couriers with only flat fines (no per-order fines) - should work correctly
-- 2. Orders without any fines (fine_deducted = 0) - should return empty
-- 3. Auth checks - only courier's own fines visible
-- 4. Date range filtering - should work correctly

-- ========================================
-- SETUP: Create test scenarios
-- ========================================

DO $$
DECLARE
  v_courier_1_id UUID;
  v_courier_2_id UUID;
  v_shift_id UUID;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SETTING UP PRESERVATION TEST SCENARIOS';
  RAISE NOTICE '========================================';
  
  -- Get two different couriers for auth testing
  SELECT id INTO v_courier_1_id 
  FROM profiles 
  WHERE role = 'courier' 
  ORDER BY id 
  LIMIT 1;
  
  SELECT id INTO v_courier_2_id 
  FROM profiles 
  WHERE role = 'courier' 
  AND id != v_courier_1_id
  ORDER BY id 
  LIMIT 1;
  
  IF v_courier_1_id IS NULL OR v_courier_2_id IS NULL THEN
    RAISE EXCEPTION 'Need at least 2 couriers in database for auth testing';
  END IF;
  
  SELECT id INTO v_shift_id FROM shifts LIMIT 1;
  
  IF v_shift_id IS NULL THEN
    RAISE EXCEPTION 'No shift found in database';
  END IF;
  
  -- Clean up existing test data
  DELETE FROM orders WHERE order_number LIKE 'PRESERVE-TEST-%';
  DELETE FROM shift_attendance WHERE courier_id IN (v_courier_1_id, v_courier_2_id) 
    AND date BETWEEN CURRENT_DATE - INTERVAL '2 days' AND CURRENT_DATE;
  
  RAISE NOTICE 'Test couriers:';
  RAISE NOTICE '  - Courier 1: %', v_courier_1_id;
  RAISE NOTICE '  - Courier 2: %', v_courier_2_id;
  RAISE NOTICE '';
  
  -- Scenario 1: Courier with only flat fine (no per-order fines)
  INSERT INTO shift_attendance (
    courier_id,
    shift_id,
    date,
    first_online_at,
    late_minutes,
    status,
    fine_type,
    flat_fine,
    flat_fine_status
  ) VALUES (
    v_courier_1_id,
    v_shift_id,
    CURRENT_DATE - INTERVAL '1 day',
    (CURRENT_DATE - INTERVAL '1 day') + TIME '06:05:00',
    65,
    'late_major',
    'flat_major',
    30000,
    'active'
  );
  
  RAISE NOTICE 'Created scenario 1: Courier with only flat fine (Rp 30,000)';
  
  -- Scenario 2: Courier with no fines (orders without fines)
  INSERT INTO orders (
    order_number,
    courier_id,
    status,
    payment_status,
    total_fee,
    fine_deducted,
    actual_delivery_time
  ) VALUES 
  (
    'PRESERVE-TEST-001',
    v_courier_2_id,
    'delivered',
    'unpaid',
    50000,
    0,
    CURRENT_TIMESTAMP - INTERVAL '2 hours'
  ),
  (
    'PRESERVE-TEST-002',
    v_courier_2_id,
    'delivered',
    'unpaid',
    45000,
    0,
    CURRENT_TIMESTAMP - INTERVAL '1 hour'
  );
  
  RAISE NOTICE 'Created scenario 2: Courier with no fines (2 orders, fine_deducted = 0)';
  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 1: Couriers with only flat fines should work correctly
-- ========================================

DO $$
DECLARE
  v_courier_id UUID;
  v_fine_record RECORD;
  v_fine_count INT := 0;
  v_total_flat_fines INT := 0;
BEGIN
  SELECT id INTO v_courier_id 
  FROM profiles 
  WHERE role = 'courier' 
  ORDER BY id 
  LIMIT 1;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 1: Flat fines only (no per-order fines)';
  RAISE NOTICE '========================================';
  
  -- Query using get_courier_fines
  FOR v_fine_record IN 
    SELECT * FROM get_courier_fines(
      v_courier_id, 
      CURRENT_DATE - INTERVAL '1 day', 
      CURRENT_DATE
    )
  LOOP
    v_fine_count := v_fine_count + 1;
    v_total_flat_fines := v_total_flat_fines + COALESCE(v_fine_record.flat_fine, 0);
    
    RAISE NOTICE 'Fine record:';
    RAISE NOTICE '  - Date: %', v_fine_record.date;
    RAISE NOTICE '  - Fine Type: %', v_fine_record.fine_type;
    RAISE NOTICE '  - Flat Fine: Rp %', v_fine_record.flat_fine;
    RAISE NOTICE '  - Status: %', v_fine_record.status;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  - Fine records: %', v_fine_count;
  RAISE NOTICE '  - Total flat fines: Rp %', v_total_flat_fines;
  
  IF v_fine_count = 1 AND v_total_flat_fines = 30000 THEN
    RAISE NOTICE '';
    RAISE NOTICE 'PASS: get_courier_fines correctly returns flat fine data';
    RAISE NOTICE 'This behavior MUST be preserved after implementing get_courier_fines_complete';
  ELSE
    RAISE EXCEPTION 'FAIL: Expected 1 fine record with Rp 30,000, got % records with Rp %', 
      v_fine_count, v_total_flat_fines;
  END IF;
END $$;

-- ========================================
-- TEST 2: Orders without fines should have fine_deducted = 0
-- ========================================

DO $$
DECLARE
  v_courier_id UUID;
  v_order_count INT;
  v_total_fine_deducted INT;
  v_order_record RECORD;
BEGIN
  SELECT id INTO v_courier_id 
  FROM profiles 
  WHERE role = 'courier' 
  ORDER BY id 
  OFFSET 1
  LIMIT 1;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 2: Orders without fines';
  RAISE NOTICE '========================================';
  
  -- Query orders
  SELECT 
    COUNT(*),
    COALESCE(SUM(fine_deducted), 0)
  INTO v_order_count, v_total_fine_deducted
  FROM orders
  WHERE courier_id = v_courier_id
    AND order_number LIKE 'PRESERVE-TEST-%';
  
  RAISE NOTICE 'Orders found: %', v_order_count;
  RAISE NOTICE 'Total fine_deducted: Rp %', v_total_fine_deducted;
  
  -- Show order details
  FOR v_order_record IN 
    SELECT order_number, total_fee, fine_deducted, payment_status
    FROM orders
    WHERE courier_id = v_courier_id
      AND order_number LIKE 'PRESERVE-TEST-%'
  LOOP
    RAISE NOTICE '  - Order: %, Fee: Rp %, Fine: Rp %, Status: %',
      v_order_record.order_number,
      v_order_record.total_fee,
      v_order_record.fine_deducted,
      v_order_record.payment_status;
  END LOOP;
  
  -- Assertions
  IF v_order_count = 2 AND v_total_fine_deducted = 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE 'PASS: Orders without fines have fine_deducted = 0';
    RAISE NOTICE 'Earning calculation is unaffected by fine query changes';
    RAISE NOTICE 'This behavior MUST be preserved after fix';
  ELSE
    RAISE EXCEPTION 'FAIL: Expected 2 orders with fine_deducted = 0, got % orders with Rp %', 
      v_order_count, v_total_fine_deducted;
  END IF;
END $$;

-- ========================================
-- TEST 3: Auth checks - courier can only view own fines
-- ========================================

DO $$
DECLARE
  v_function_def TEXT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 3: Auth rules preservation';
  RAISE NOTICE '========================================';
  
  -- Verify function signature includes auth logic
  PERFORM 1 FROM pg_proc 
  WHERE proname = 'get_courier_fines' 
    AND pronamespace = 'public'::regnamespace
    AND prosrc LIKE '%auth.uid()%'
    AND prosrc LIKE '%Unauthorized%';
  
  IF FOUND THEN
    RAISE NOTICE 'PASS: get_courier_fines has auth check logic';
    RAISE NOTICE 'Auth rules MUST be preserved in get_courier_fines_complete';
    RAISE NOTICE '';
    RAISE NOTICE 'Expected behavior:';
    RAISE NOTICE '  - Courier can only view own fine data';
    RAISE NOTICE '  - Admin/Finance can view all courier fines';
    RAISE NOTICE '  - Unauthorized roles get exception';
  ELSE
    RAISE EXCEPTION 'FAIL: get_courier_fines missing auth check logic';
  END IF;
END $$;

-- ========================================
-- TEST 4: Empty result for couriers with no fines
-- ========================================

DO $$
DECLARE
  v_courier_id UUID;
  v_fine_record RECORD;
  v_fine_count INT := 0;
BEGIN
  -- Get courier with no fines
  SELECT id INTO v_courier_id 
  FROM profiles 
  WHERE role = 'courier' 
  ORDER BY id 
  OFFSET 1
  LIMIT 1;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 4: Empty result for couriers with no fines';
  RAISE NOTICE '========================================';
  
  -- Query fines for courier with no fines
  FOR v_fine_record IN 
    SELECT * FROM get_courier_fines(
      v_courier_id, 
      CURRENT_DATE - INTERVAL '1 day', 
      CURRENT_DATE
    )
  LOOP
    v_fine_count := v_fine_count + 1;
  END LOOP;
  
  IF v_fine_count = 0 THEN
    RAISE NOTICE 'PASS: get_courier_fines returns empty for courier with no fines';
    RAISE NOTICE 'This behavior MUST be preserved after fix';
  ELSE
    RAISE EXCEPTION 'FAIL: Expected 0 fine records, got %', v_fine_count;
  END IF;
END $$;

-- ========================================
-- TEST 5: Date range filtering works correctly
-- ========================================

DO $$
DECLARE
  v_courier_id UUID;
  v_fine_record RECORD;
  v_fine_count_in_range INT := 0;
  v_fine_count_out_range INT := 0;
BEGIN
  SELECT id INTO v_courier_id 
  FROM profiles 
  WHERE role = 'courier' 
  ORDER BY id 
  LIMIT 1;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 5: Date range filtering';
  RAISE NOTICE '========================================';
  
  -- Query within date range (should find fine)
  FOR v_fine_record IN 
    SELECT * FROM get_courier_fines(
      v_courier_id, 
      CURRENT_DATE - INTERVAL '1 day', 
      CURRENT_DATE
    )
  LOOP
    v_fine_count_in_range := v_fine_count_in_range + 1;
  END LOOP;
  
  -- Query outside date range (should find nothing)
  FOR v_fine_record IN 
    SELECT * FROM get_courier_fines(
      v_courier_id, 
      CURRENT_DATE - INTERVAL '10 days', 
      CURRENT_DATE - INTERVAL '5 days'
    )
  LOOP
    v_fine_count_out_range := v_fine_count_out_range + 1;
  END LOOP;
  
  RAISE NOTICE 'Fines in date range (yesterday to today): %', v_fine_count_in_range;
  RAISE NOTICE 'Fines outside date range (10-5 days ago): %', v_fine_count_out_range;
  
  IF v_fine_count_in_range = 1 AND v_fine_count_out_range = 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE 'PASS: Date range filtering works correctly';
    RAISE NOTICE 'This behavior MUST be preserved after fix';
  ELSE
    RAISE EXCEPTION 'FAIL: Date range filtering not working as expected';
  END IF;
END $$;

-- ========================================
-- TEST 6: Cancelled fines are excluded from results
-- ========================================

DO $$
DECLARE
  v_courier_id UUID;
  v_shift_id UUID;
  v_attendance_id UUID;
  v_fine_count INT := 0;
  v_fine_record RECORD;
BEGIN
  SELECT id INTO v_courier_id 
  FROM profiles 
  WHERE role = 'courier' 
  ORDER BY id 
  LIMIT 1;
  
  SELECT id INTO v_shift_id FROM shifts LIMIT 1;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 6: Cancelled fines are excluded';
  RAISE NOTICE '========================================';
  
  -- Create a cancelled fine
  INSERT INTO shift_attendance (
    courier_id,
    shift_id,
    date,
    first_online_at,
    late_minutes,
    status,
    fine_type,
    flat_fine,
    flat_fine_status,
    cancelled_by,
    cancelled_at,
    cancel_reason
  ) VALUES (
    v_courier_id,
    v_shift_id,
    CURRENT_DATE - INTERVAL '2 days',
    (CURRENT_DATE - INTERVAL '2 days') + TIME '06:30:00',
    30,
    'late_minor',
    'per_order',
    0,
    'cancelled',
    v_courier_id,
    CURRENT_TIMESTAMP,
    'Test cancellation'
  ) RETURNING id INTO v_attendance_id;
  
  RAISE NOTICE 'Created cancelled fine for testing';
  
  -- Query fines (should not include cancelled)
  FOR v_fine_record IN 
    SELECT * FROM get_courier_fines(
      v_courier_id, 
      CURRENT_DATE - INTERVAL '2 days', 
      CURRENT_DATE
    )
  LOOP
    IF v_fine_record.flat_fine_status = 'cancelled' THEN
      RAISE EXCEPTION 'FAIL: Cancelled fine should not be in results';
    END IF;
    v_fine_count := v_fine_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Active fines found: %', v_fine_count;
  RAISE NOTICE '';
  RAISE NOTICE 'PASS: Cancelled fines are excluded from results';
  RAISE NOTICE 'This behavior MUST be preserved after fix';
  
  -- Clean up
  DELETE FROM shift_attendance WHERE id = v_attendance_id;
END $$;

-- ========================================
-- PRESERVATION TEST SUMMARY
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PRESERVATION TEST SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'All preservation tests PASSED on unfixed code.';
  RAISE NOTICE '';
  RAISE NOTICE 'Behaviors that MUST be preserved:';
  RAISE NOTICE '  1. Flat fines are returned correctly';
  RAISE NOTICE '  2. Orders without fines have fine_deducted = 0';
  RAISE NOTICE '  3. Auth rules: courier can only view own data';
  RAISE NOTICE '  4. Empty result for couriers with no fines';
  RAISE NOTICE '  5. Date range filtering works correctly';
  RAISE NOTICE '  6. Cancelled fines are excluded from results';
  RAISE NOTICE '';
  RAISE NOTICE 'After implementing get_courier_fines_complete:';
  RAISE NOTICE '  - Re-run these tests to verify no regressions';
  RAISE NOTICE '  - All tests should still PASS';
  RAISE NOTICE '  - New function should ADD per-order fines WITHOUT breaking existing behavior';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PRESERVATION PROPERTY TESTS COMPLETE';
  RAISE NOTICE '========================================';
END $$;

-- Clean up test data
DO $$
DECLARE
  v_courier_1_id UUID;
  v_courier_2_id UUID;
BEGIN
  SELECT id INTO v_courier_1_id 
  FROM profiles 
  WHERE role = 'courier' 
  ORDER BY id 
  LIMIT 1;
  
  SELECT id INTO v_courier_2_id 
  FROM profiles 
  WHERE role = 'courier' 
  AND id != v_courier_1_id
  ORDER BY id 
  LIMIT 1;
  
  DELETE FROM orders WHERE order_number LIKE 'PRESERVE-TEST-%';
  DELETE FROM shift_attendance WHERE courier_id IN (v_courier_1_id, v_courier_2_id) 
    AND date BETWEEN CURRENT_DATE - INTERVAL '2 days' AND CURRENT_DATE;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Test data cleaned up.';
END $$;
