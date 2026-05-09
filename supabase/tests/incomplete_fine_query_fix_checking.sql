-- Fix Checking Test: Incomplete Fine Query Bug
-- **Validates: Bug 1 is FIXED**
-- 
-- Property 3: Fix Checking - Bug Condition No Longer Occurs
-- 
-- IMPORTANT: This test should FAIL on unfixed code (bug exists)
-- After implementing get_courier_fines_complete, this test should PASS (bug fixed)
-- 
-- Test Objective:
--   Verify that get_courier_fines_complete returns BOTH flat fines AND per-order fines
--   Previously, get_courier_fines only returned flat fines (missing per-order fines)
--
-- Test Scenario:
--   1. Create a courier with BOTH flat fine and per-order fine
--   2. Query using get_courier_fines_complete
--   3. Verify BOTH types of fines are returned
--   4. Verify totals are calculated correctly

-- ========================================
-- SETUP: Create test scenario with both fine types
-- ========================================

DO $$
DECLARE
  v_courier_id UUID;
  v_shift_id UUID;
  v_attendance_id UUID;
  v_order_id UUID;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SETUP: Creating test data';
  RAISE NOTICE '========================================';
  
  -- Get a courier
  SELECT id INTO v_courier_id 
  FROM profiles 
  WHERE role = 'courier' 
  LIMIT 1;
  
  IF v_courier_id IS NULL THEN
    RAISE EXCEPTION 'No courier found in database';
  END IF;
  
  -- Get a shift
  SELECT id INTO v_shift_id FROM shifts LIMIT 1;
  
  IF v_shift_id IS NULL THEN
    RAISE EXCEPTION 'No shift found in database';
  END IF;
  
  -- Clean up existing test data
  DELETE FROM orders WHERE order_number = 'FIX-CHECK-001';
  DELETE FROM shift_attendance 
  WHERE courier_id = v_courier_id 
    AND date = CURRENT_DATE - INTERVAL '1 day';
  
  -- Create a flat fine (Rp 30,000)
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
    v_courier_id,
    v_shift_id,
    CURRENT_DATE - INTERVAL '1 day',
    (CURRENT_DATE - INTERVAL '1 day') + TIME '06:05:00',
    65,
    'late_major',
    'flat_major',
    30000,
    'active'
  ) RETURNING id INTO v_attendance_id;
  
  RAISE NOTICE 'Created flat fine: Rp 30,000';
  
  -- Create an order with per-order fine (Rp 3,000)
  INSERT INTO orders (
    order_number,
    courier_id,
    status,
    payment_status,
    total_fee,
    fine_deducted,
    actual_delivery_time,
    customer_name,
    customer_phone,
    customer_address
  ) VALUES (
    'FIX-CHECK-001',
    v_courier_id,
    'delivered',
    'unpaid',
    50000,
    3000,
    (CURRENT_DATE - INTERVAL '1 day') + TIME '14:30:00',
    'Test Customer',
    '081234567890',
    'Test Address'
  ) RETURNING id INTO v_order_id;
  
  RAISE NOTICE 'Created per-order fine: Rp 3,000';
  RAISE NOTICE '';
  RAISE NOTICE 'Test courier: %', v_courier_id;
  RAISE NOTICE 'Test date: %', CURRENT_DATE - INTERVAL '1 day';
  RAISE NOTICE '';
END $$;

-- ========================================
-- FIX CHECKING TEST: Verify both fine types are returned
-- ========================================

DO $$
DECLARE
  v_courier_id UUID;
  v_result JSONB;
  v_flat_fines_count INT;
  v_per_order_fines_count INT;
  v_total_flat_fines INT;
  v_total_per_order_fines INT;
  v_grand_total INT;
BEGIN
  -- Get test courier
  SELECT id INTO v_courier_id 
  FROM profiles 
  WHERE role = 'courier' 
  LIMIT 1;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FIX CHECKING TEST: Incomplete Fine Query Bug';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
  -- Query using get_courier_fines_complete
  SELECT * INTO v_result
  FROM get_courier_fines_complete(
    v_courier_id,
    CURRENT_DATE - INTERVAL '1 day',
    CURRENT_DATE
  );
  
  -- Extract data from result
  v_flat_fines_count := jsonb_array_length(v_result->'flat_fines');
  v_per_order_fines_count := jsonb_array_length(v_result->'per_order_fines');
  v_total_flat_fines := (v_result->>'total_flat_fines')::INT;
  v_total_per_order_fines := (v_result->>'total_per_order_fines')::INT;
  v_grand_total := (v_result->>'grand_total')::INT;
  
  RAISE NOTICE 'Query Results:';
  RAISE NOTICE '  - Flat fines count: %', v_flat_fines_count;
  RAISE NOTICE '  - Per-order fines count: %', v_per_order_fines_count;
  RAISE NOTICE '  - Total flat fines: Rp %', v_total_flat_fines;
  RAISE NOTICE '  - Total per-order fines: Rp %', v_total_per_order_fines;
  RAISE NOTICE '  - Grand total: Rp %', v_grand_total;
  RAISE NOTICE '';
  
  -- Assertions
  IF v_flat_fines_count = 0 THEN
    RAISE EXCEPTION 'FAIL: No flat fines returned (expected 1)';
  END IF;
  
  IF v_per_order_fines_count = 0 THEN
    RAISE EXCEPTION 'FAIL: No per-order fines returned (expected 1) - BUG STILL EXISTS!';
  END IF;
  
  IF v_total_flat_fines != 30000 THEN
    RAISE EXCEPTION 'FAIL: Total flat fines incorrect (expected Rp 30,000, got Rp %)', v_total_flat_fines;
  END IF;
  
  IF v_total_per_order_fines != 3000 THEN
    RAISE EXCEPTION 'FAIL: Total per-order fines incorrect (expected Rp 3,000, got Rp %)', v_total_per_order_fines;
  END IF;
  
  IF v_grand_total != 33000 THEN
    RAISE EXCEPTION 'FAIL: Grand total incorrect (expected Rp 33,000, got Rp %)', v_grand_total;
  END IF;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PASS: Bug is FIXED!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Verification:';
  RAISE NOTICE '  ✅ Flat fines are returned correctly';
  RAISE NOTICE '  ✅ Per-order fines are returned correctly';
  RAISE NOTICE '  ✅ Total flat fines calculated correctly';
  RAISE NOTICE '  ✅ Total per-order fines calculated correctly';
  RAISE NOTICE '  ✅ Grand total calculated correctly';
  RAISE NOTICE '';
  RAISE NOTICE 'The incomplete fine query bug has been successfully fixed!';
  RAISE NOTICE 'get_courier_fines_complete now returns BOTH flat fines AND per-order fines.';
  RAISE NOTICE '';
END $$;

-- ========================================
-- CLEANUP: Remove test data
-- ========================================

DO $$
DECLARE
  v_courier_id UUID;
BEGIN
  SELECT id INTO v_courier_id 
  FROM profiles 
  WHERE role = 'courier' 
  LIMIT 1;
  
  DELETE FROM orders WHERE order_number = 'FIX-CHECK-001';
  DELETE FROM shift_attendance 
  WHERE courier_id = v_courier_id 
    AND date = CURRENT_DATE - INTERVAL '1 day';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Test data cleaned up';
  RAISE NOTICE '========================================';
END $$;
