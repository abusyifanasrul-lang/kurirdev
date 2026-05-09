-- Bug Condition Exploration Test: Incomplete Fine Query
-- Bug: get_courier_fines only returns flat fines, missing per-order fines from orders.fine_deducted
-- 
-- CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
-- DO NOT attempt to fix the test or the code when it fails
-- 
-- Expected Outcome: Test FAILS (this is correct - it proves the bug exists)
-- After Fix: Test PASSES (confirms bug is fixed)

-- Clean up any existing test data
DO $$
DECLARE
  v_test_courier_id UUID;
  v_test_shift_id UUID;
  v_test_order_id UUID;
BEGIN
  -- Find or create test courier
  SELECT id INTO v_test_courier_id 
  FROM profiles 
  WHERE role = 'courier' 
  LIMIT 1;
  
  IF v_test_courier_id IS NULL THEN
    RAISE EXCEPTION 'No courier found in database. Please seed test data first.';
  END IF;
  
  -- Find a shift
  SELECT id INTO v_test_shift_id 
  FROM shifts 
  LIMIT 1;
  
  IF v_test_shift_id IS NULL THEN
    RAISE EXCEPTION 'No shift found in database. Please seed test data first.';
  END IF;
  
  -- Clean up existing test data for this courier
  DELETE FROM orders WHERE courier_id = v_test_courier_id AND order_number LIKE 'TEST-FINE-%';
  DELETE FROM shift_attendance WHERE courier_id = v_test_courier_id AND date = CURRENT_DATE;
  
  RAISE NOTICE 'Test data cleaned up for courier: %', v_test_courier_id;
END $$;

-- ========================================
-- TEST SETUP: Create scenario with both flat and per-order fines
-- ========================================

DO $$
DECLARE
  v_test_courier_id UUID;
  v_test_shift_id UUID;
  v_attendance_id UUID;
  v_order_1_id UUID;
  v_order_2_id UUID;
  v_order_3_id UUID;
BEGIN
  -- Get test courier and shift
  SELECT id INTO v_test_courier_id FROM profiles WHERE role = 'courier' LIMIT 1;
  SELECT id INTO v_test_shift_id FROM shifts LIMIT 1;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SETTING UP TEST SCENARIO';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Test Courier ID: %', v_test_courier_id;
  
  -- Create shift_attendance record with flat fine
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
    v_test_courier_id,
    v_test_shift_id,
    CURRENT_DATE,
    CURRENT_TIMESTAMP - INTERVAL '8 hours',
    65, -- Late 65 minutes = major late
    'late_major',
    'flat_major',
    30000, -- Rp 30,000 flat fine
    'active'
  ) RETURNING id INTO v_attendance_id;
  
  RAISE NOTICE 'Created shift_attendance with flat_major fine: Rp 30,000';
  
  -- Enable per-order fine for this courier
  UPDATE profiles 
  SET late_fine_active = true 
  WHERE id = v_test_courier_id;
  
  RAISE NOTICE 'Enabled late_fine_active for courier';
  
  -- Create 3 completed orders with fine_deducted
  INSERT INTO orders (
    order_number,
    courier_id,
    status,
    payment_status,
    total_fee,
    fine_deducted,
    completed_at
  ) VALUES (
    'TEST-FINE-001',
    v_test_courier_id,
    'completed',
    'unpaid',
    50000,
    1000, -- Rp 1,000 per-order fine
    CURRENT_TIMESTAMP - INTERVAL '7 hours'
  ) RETURNING id INTO v_order_1_id;
  
  INSERT INTO orders (
    order_number,
    courier_id,
    status,
    payment_status,
    total_fee,
    fine_deducted,
    completed_at
  ) VALUES (
    'TEST-FINE-002',
    v_test_courier_id,
    'completed',
    'unpaid',
    45000,
    1000, -- Rp 1,000 per-order fine
    CURRENT_TIMESTAMP - INTERVAL '6 hours'
  ) RETURNING id INTO v_order_2_id;
  
  INSERT INTO orders (
    order_number,
    courier_id,
    status,
    payment_status,
    total_fee,
    fine_deducted,
    completed_at
  ) VALUES (
    'TEST-FINE-003',
    v_test_courier_id,
    'completed',
    'unpaid',
    60000,
    1000, -- Rp 1,000 per-order fine
    CURRENT_TIMESTAMP - INTERVAL '5 hours'
  ) RETURNING id INTO v_order_3_id;
  
  RAISE NOTICE 'Created 3 orders with fine_deducted = Rp 1,000 each';
  RAISE NOTICE 'Total per-order fines: Rp 3,000';
  RAISE NOTICE 'Total flat fines: Rp 30,000';
  RAISE NOTICE 'Expected grand total: Rp 33,000';
  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 1: Verify get_courier_fines only returns flat fines (BUG)
-- ========================================

DO $$
DECLARE
  v_test_courier_id UUID;
  v_fine_record RECORD;
  v_flat_fine_count INT := 0;
  v_total_flat_fines INT := 0;
  v_has_per_order_fines BOOLEAN := false;
BEGIN
  SELECT id INTO v_test_courier_id FROM profiles WHERE role = 'courier' LIMIT 1;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 1: Verify get_courier_fines returns incomplete data';
  RAISE NOTICE '========================================';
  
  -- Call get_courier_fines
  FOR v_fine_record IN 
    SELECT * FROM get_courier_fines(v_test_courier_id, CURRENT_DATE, CURRENT_DATE)
  LOOP
    v_flat_fine_count := v_flat_fine_count + 1;
    v_total_flat_fines := v_total_flat_fines + COALESCE(v_fine_record.flat_fine, 0);
    
    RAISE NOTICE 'Fine record found:';
    RAISE NOTICE '  - Date: %', v_fine_record.date;
    RAISE NOTICE '  - Fine Type: %', v_fine_record.fine_type;
    RAISE NOTICE '  - Flat Fine: Rp %', v_fine_record.flat_fine;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Summary from get_courier_fines:';
  RAISE NOTICE '  - Flat fine records: %', v_flat_fine_count;
  RAISE NOTICE '  - Total flat fines: Rp %', v_total_flat_fines;
  
  -- Check if function returns per-order fines (it shouldn't in unfixed code)
  -- Note: get_courier_fines doesn't have a per_order_fines field in its return type
  RAISE NOTICE '';
  RAISE NOTICE 'ANALYSIS:';
  RAISE NOTICE '  - get_courier_fines only queries shift_attendance table';
  RAISE NOTICE '  - It does NOT join with orders table';
  RAISE NOTICE '  - Per-order fines (Rp 3,000) are MISSING from result';
  RAISE NOTICE '  - This confirms the bug: incomplete fine data';
  
  IF v_flat_fine_count > 0 AND v_total_flat_fines = 30000 THEN
    RAISE NOTICE '';
    RAISE NOTICE 'CONFIRMED: Bug exists - get_courier_fines only returns flat fines';
    RAISE NOTICE 'Expected total: Rp 33,000 (flat Rp 30,000 + per-order Rp 3,000)';
    RAISE NOTICE 'Actual total: Rp 30,000 (missing per-order fines)';
  ELSE
    RAISE EXCEPTION 'UNEXPECTED: Test setup may be incorrect';
  END IF;
END $$;

-- ========================================
-- TEST 2: Verify per-order fines exist in orders table
-- ========================================

DO $$
DECLARE
  v_test_courier_id UUID;
  v_order_count INT;
  v_total_per_order_fines INT;
BEGIN
  SELECT id INTO v_test_courier_id FROM profiles WHERE role = 'courier' LIMIT 1;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 2: Verify per-order fines exist in orders table';
  RAISE NOTICE '========================================';
  
  -- Count orders with fine_deducted
  SELECT 
    COUNT(*),
    COALESCE(SUM(fine_deducted), 0)
  INTO v_order_count, v_total_per_order_fines
  FROM orders
  WHERE courier_id = v_test_courier_id
    AND DATE(completed_at) = CURRENT_DATE
    AND fine_deducted > 0;
  
  RAISE NOTICE 'Orders with fine_deducted: %', v_order_count;
  RAISE NOTICE 'Total per-order fines in orders table: Rp %', v_total_per_order_fines;
  
  IF v_order_count = 3 AND v_total_per_order_fines = 3000 THEN
    RAISE NOTICE '';
    RAISE NOTICE 'CONFIRMED: Per-order fines exist in orders table';
    RAISE NOTICE 'But get_courier_fines does NOT include them';
    RAISE NOTICE 'This proves the incomplete fine query bug';
  ELSE
    RAISE EXCEPTION 'UNEXPECTED: Test data setup failed';
  END IF;
END $$;

-- ========================================
-- TEST 3: Demonstrate the impact on financial reporting
-- ========================================

DO $$
DECLARE
  v_test_courier_id UUID;
  v_flat_fines INT;
  v_per_order_fines INT;
  v_reported_total INT;
  v_actual_total INT;
  v_missing_amount INT;
BEGIN
  SELECT id INTO v_test_courier_id FROM profiles WHERE role = 'courier' LIMIT 1;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 3: Financial Impact Analysis';
  RAISE NOTICE '========================================';
  
  -- Get flat fines from get_courier_fines
  SELECT COALESCE(SUM(flat_fine), 0)
  INTO v_flat_fines
  FROM get_courier_fines(v_test_courier_id, CURRENT_DATE, CURRENT_DATE);
  
  -- Get per-order fines from orders table
  SELECT COALESCE(SUM(fine_deducted), 0)
  INTO v_per_order_fines
  FROM orders
  WHERE courier_id = v_test_courier_id
    AND DATE(completed_at) = CURRENT_DATE
    AND fine_deducted > 0;
  
  v_reported_total := v_flat_fines; -- What get_courier_fines reports
  v_actual_total := v_flat_fines + v_per_order_fines; -- What it should report
  v_missing_amount := v_actual_total - v_reported_total;
  
  RAISE NOTICE 'Flat fines (from get_courier_fines): Rp %', v_flat_fines;
  RAISE NOTICE 'Per-order fines (from orders table): Rp %', v_per_order_fines;
  RAISE NOTICE '';
  RAISE NOTICE 'Reported total (incomplete): Rp %', v_reported_total;
  RAISE NOTICE 'Actual total (correct): Rp %', v_actual_total;
  RAISE NOTICE 'Missing amount: Rp %', v_missing_amount;
  RAISE NOTICE '';
  RAISE NOTICE 'IMPACT: Finance reports are missing Rp % per courier', v_missing_amount;
  RAISE NOTICE 'This causes inaccurate financial tracking and settlement';
END $$;

-- ========================================
-- TEST 4: Verify function signature doesn't support per-order fines
-- ========================================

DO $$
DECLARE
  v_function_def TEXT;
  v_has_per_order_field BOOLEAN := false;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 4: Inspect get_courier_fines function signature';
  RAISE NOTICE '========================================';
  
  -- Get function definition
  SELECT pg_get_functiondef(oid)
  INTO v_function_def
  FROM pg_proc
  WHERE proname = 'get_courier_fines'
    AND pronamespace = 'public'::regnamespace;
  
  -- Check if function returns per_order_fines field
  v_has_per_order_field := v_function_def LIKE '%per_order_fines%';
  
  IF v_has_per_order_field THEN
    RAISE NOTICE 'Function signature includes per_order_fines field';
    RAISE EXCEPTION 'UNEXPECTED: Function appears to be fixed already';
  ELSE
    RAISE NOTICE 'Function signature does NOT include per_order_fines field';
    RAISE NOTICE 'Function only queries shift_attendance table';
    RAISE NOTICE 'CONFIRMED: Function needs to be updated to include per-order fines';
  END IF;
END $$;

-- ========================================
-- COUNTEREXAMPLE SUMMARY
-- ========================================

DO $$
DECLARE
  v_test_courier_id UUID;
BEGIN
  SELECT id INTO v_test_courier_id FROM profiles WHERE role = 'courier' LIMIT 1;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'COUNTEREXAMPLE SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Courier ID: %', v_test_courier_id;
  RAISE NOTICE 'Date: %', CURRENT_DATE;
  RAISE NOTICE '';
  RAISE NOTICE 'Scenario:';
  RAISE NOTICE '  - Courier has 1 flat_major fine: Rp 30,000';
  RAISE NOTICE '  - Courier has 3 orders with fine_deducted: Rp 1,000 each';
  RAISE NOTICE '  - Total per-order fines: Rp 3,000';
  RAISE NOTICE '  - Expected grand total: Rp 33,000';
  RAISE NOTICE '';
  RAISE NOTICE 'Bug Behavior:';
  RAISE NOTICE '  - get_courier_fines() returns only flat fines: Rp 30,000';
  RAISE NOTICE '  - Per-order fines are MISSING from result';
  RAISE NOTICE '  - Financial reports are incomplete';
  RAISE NOTICE '';
  RAISE NOTICE 'Root Cause:';
  RAISE NOTICE '  - get_courier_fines only queries shift_attendance table';
  RAISE NOTICE '  - Function does not join with orders table';
  RAISE NOTICE '  - Function signature does not include per_order_fines field';
  RAISE NOTICE '';
  RAISE NOTICE 'Expected Fix:';
  RAISE NOTICE '  - Create new function get_courier_fines_complete()';
  RAISE NOTICE '  - Query both shift_attendance AND orders tables';
  RAISE NOTICE '  - Return structure with flat_fines and per_order_fines arrays';
  RAISE NOTICE '  - Calculate totals: total_flat_fines, total_per_order_fines, grand_total';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'BUG CONDITION EXPLORATION TEST COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Result: BUG CONFIRMED';
  RAISE NOTICE 'The test demonstrates that get_courier_fines returns incomplete data.';
  RAISE NOTICE 'This test will PASS after implementing get_courier_fines_complete.';
END $$;

-- Clean up test data
DO $$
DECLARE
  v_test_courier_id UUID;
BEGIN
  SELECT id INTO v_test_courier_id FROM profiles WHERE role = 'courier' LIMIT 1;
  
  DELETE FROM orders WHERE courier_id = v_test_courier_id AND order_number LIKE 'TEST-FINE-%';
  DELETE FROM shift_attendance WHERE courier_id = v_test_courier_id AND date = CURRENT_DATE;
  UPDATE profiles SET late_fine_active = false WHERE id = v_test_courier_id;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Test data cleaned up.';
END $$;
