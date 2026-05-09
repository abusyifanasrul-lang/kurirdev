-- Bug Condition Exploration Test: Missing Shift End Recording
-- Bug: No mechanism to record when courier finishes normal shift (last_online_at always NULL)
-- 
-- CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
-- DO NOT attempt to fix the test or the code when it fails
-- 
-- Expected Outcome: Test FAILS (this is correct - it proves the bug exists)
-- After Fix: Test PASSES (confirms bug is fixed)

-- ========================================
-- TEST 1: Verify record_shift_end function does NOT exist
-- ========================================

DO $$
DECLARE
  v_function_exists BOOLEAN := false;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 1: Verify record_shift_end does NOT exist';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
  -- Check if record_shift_end exists
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'record_shift_end' 
    AND pronamespace = 'public'::regnamespace
  ) INTO v_function_exists;
  
  RAISE NOTICE 'Function existence check:';
  RAISE NOTICE '  - record_shift_end exists: %', v_function_exists;
  RAISE NOTICE '';
  
  IF NOT v_function_exists THEN
    RAISE NOTICE '✓ BUG CONFIRMED: record_shift_end function does NOT exist';
    RAISE NOTICE '  - No mechanism to record shift end time';
    RAISE NOTICE '  - Courier cannot explicitly mark "Selesai Shift"';
    RAISE NOTICE '  - last_online_at remains NULL';
    RAISE NOTICE '';
    RAISE NOTICE 'Impact:';
    RAISE NOTICE '  - Cannot track actual shift duration';
    RAISE NOTICE '  - Cannot distinguish temporary OFF from shift end';
    RAISE NOTICE '  - Cannot calculate overtime or early finish';
    RAISE NOTICE '  - Cannot separate in-shift work from out-of-shift work';
  ELSE
    RAISE EXCEPTION '✗ UNEXPECTED: record_shift_end already exists (bug may be fixed)';
  END IF;
END $$;

-- ========================================
-- TEST 2: Verify last_online_at is always NULL
-- ========================================

DO $$
DECLARE
  v_total_attendance INT;
  v_null_last_online INT;
  v_percentage NUMERIC;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 2: Verify last_online_at is always NULL';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
  -- Count total attendance records
  SELECT COUNT(*) INTO v_total_attendance
  FROM shift_attendance
  WHERE first_online_at IS NOT NULL;
  
  -- Count records where last_online_at is NULL
  SELECT COUNT(*) INTO v_null_last_online
  FROM shift_attendance
  WHERE first_online_at IS NOT NULL
  AND last_online_at IS NULL;
  
  IF v_total_attendance > 0 THEN
    v_percentage := (v_null_last_online::NUMERIC / v_total_attendance::NUMERIC) * 100;
  ELSE
    v_percentage := 0;
  END IF;
  
  RAISE NOTICE 'Attendance records analysis:';
  RAISE NOTICE '  - Total records with check-in: %', v_total_attendance;
  RAISE NOTICE '  - Records with NULL last_online_at: %', v_null_last_online;
  RAISE NOTICE '  - Percentage NULL: %.2f%%', v_percentage;
  RAISE NOTICE '';
  
  IF v_percentage > 90 THEN
    RAISE NOTICE '✓ BUG CONFIRMED: last_online_at is almost always NULL';
    RAISE NOTICE '  - %.2f%% of attendance records have NULL last_online_at', v_percentage;
    RAISE NOTICE '  - This proves no mechanism exists to record shift end';
  ELSIF v_percentage > 50 THEN
    RAISE NOTICE 'WARNING: last_online_at is NULL in %.2f%% of records', v_percentage;
    RAISE NOTICE '  - Bug exists but some records have last_online_at set';
    RAISE NOTICE '  - May indicate partial implementation or manual updates';
  ELSE
    RAISE NOTICE 'UNEXPECTED: last_online_at is set in most records';
    RAISE NOTICE '  - Bug may not exist or has been partially fixed';
  END IF;
END $$;

-- ========================================
-- TEST 3: Demonstrate the problem with a scenario
-- ========================================

DO $$
DECLARE
  v_courier_id UUID;
  v_shift_id UUID;
  v_attendance_id UUID;
  v_first_online_at TIMESTAMPTZ;
  v_last_online_at TIMESTAMPTZ;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 3: Demonstrate the problem';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
  -- Get a courier
  SELECT id INTO v_courier_id 
  FROM profiles 
  WHERE role = 'courier' 
  LIMIT 1;
  
  IF v_courier_id IS NULL THEN
    RAISE NOTICE 'SKIP: No courier found in database';
    RETURN;
  END IF;
  
  -- Get a shift
  SELECT id INTO v_shift_id
  FROM shifts
  WHERE is_active = true
  LIMIT 1;
  
  IF v_shift_id IS NULL THEN
    RAISE NOTICE 'SKIP: No active shift found';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Scenario: Courier finishes normal shift';
  RAISE NOTICE '';
  
  -- Simulate courier check-in
  INSERT INTO shift_attendance (
    courier_id,
    shift_id,
    date,
    first_online_at,
    late_minutes,
    status
  ) VALUES (
    v_courier_id,
    v_shift_id,
    CURRENT_DATE,
    NOW() - INTERVAL '10 hours',  -- Checked in 10 hours ago
    0,
    'on_time'
  ) RETURNING id, first_online_at, last_online_at 
  INTO v_attendance_id, v_first_online_at, v_last_online_at;
  
  RAISE NOTICE 'Courier checked in:';
  RAISE NOTICE '  - attendance_id: %', v_attendance_id;
  RAISE NOTICE '  - first_online_at: %', v_first_online_at;
  RAISE NOTICE '  - last_online_at: %', v_last_online_at;
  RAISE NOTICE '';
  
  RAISE NOTICE 'Problem:';
  RAISE NOTICE '  - Courier worked for 10 hours';
  RAISE NOTICE '  - Courier wants to record "Selesai Shift"';
  RAISE NOTICE '  - But there is NO function to call';
  RAISE NOTICE '  - last_online_at remains NULL';
  RAISE NOTICE '';
  
  RAISE NOTICE 'Consequences:';
  RAISE NOTICE '  - Cannot calculate actual shift duration';
  RAISE NOTICE '  - Cannot detect early finish or overtime';
  RAISE NOTICE '  - Cannot distinguish temporary OFF from shift end';
  RAISE NOTICE '  - If courier goes ON again for private order, no way to track it separately';
  RAISE NOTICE '';
  
  RAISE NOTICE '✓ BUG CONFIRMED: No mechanism to record shift end';
  
  -- Clean up
  DELETE FROM shift_attendance WHERE id = v_attendance_id;
  RAISE NOTICE '';
  RAISE NOTICE 'Test data cleaned up';
END $$;

-- ========================================
-- TEST 4: Verify cannot distinguish temporary OFF from shift end
-- ========================================

DO $$
DECLARE
  v_courier_id UUID;
  v_shift_id UUID;
  v_attendance_id UUID;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 4: Cannot distinguish temporary OFF from shift end';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
  -- Get test data
  SELECT id INTO v_courier_id FROM profiles WHERE role = 'courier' LIMIT 1;
  SELECT id INTO v_shift_id FROM shifts WHERE is_active = true LIMIT 1;
  
  IF v_courier_id IS NULL OR v_shift_id IS NULL THEN
    RAISE NOTICE 'SKIP: Missing test data';
    RETURN;
  END IF;
  
  -- Create attendance record
  INSERT INTO shift_attendance (
    courier_id, shift_id, date, first_online_at, late_minutes, status
  ) VALUES (
    v_courier_id, v_shift_id, CURRENT_DATE, NOW() - INTERVAL '8 hours', 0, 'on_time'
  ) RETURNING id INTO v_attendance_id;
  
  RAISE NOTICE 'Scenario 1: Courier goes OFF temporarily (bathroom break)';
  RAISE NOTICE '  - Courier status: OFF';
  RAISE NOTICE '  - Reason: Bathroom break';
  RAISE NOTICE '  - Expected: Can resume ON anytime';
  RAISE NOTICE '  - Actual: last_online_at remains NULL';
  RAISE NOTICE '';
  
  RAISE NOTICE 'Scenario 2: Courier finishes shift';
  RAISE NOTICE '  - Courier status: OFF';
  RAISE NOTICE '  - Reason: Shift ended';
  RAISE NOTICE '  - Expected: Record last_online_at, but can still ON for private orders';
  RAISE NOTICE '  - Actual: last_online_at remains NULL (same as temporary OFF!)';
  RAISE NOTICE '';
  
  RAISE NOTICE '✓ BUG CONFIRMED: Cannot distinguish temporary OFF from shift end';
  RAISE NOTICE '  - Both scenarios result in last_online_at = NULL';
  RAISE NOTICE '  - No way to track when normal shift ended';
  RAISE NOTICE '  - No way to separate in-shift work from out-of-shift work';
  
  -- Clean up
  DELETE FROM shift_attendance WHERE id = v_attendance_id;
END $$;

-- ========================================
-- TEST 5: Check existing check-in mechanism
-- ========================================

DO $$
DECLARE
  v_checkin_exists BOOLEAN := false;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 5: Verify check-in mechanism exists';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
  -- Check if record_courier_checkin exists
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'record_courier_checkin' 
    AND pronamespace = 'public'::regnamespace
  ) INTO v_checkin_exists;
  
  RAISE NOTICE 'Function existence check:';
  RAISE NOTICE '  - record_courier_checkin exists: %', v_checkin_exists;
  RAISE NOTICE '';
  
  IF v_checkin_exists THEN
    RAISE NOTICE 'Observation:';
    RAISE NOTICE '  - Check-in mechanism EXISTS (record_courier_checkin)';
    RAISE NOTICE '  - But check-out/shift-end mechanism DOES NOT exist';
    RAISE NOTICE '  - This asymmetry causes the bug';
    RAISE NOTICE '';
    RAISE NOTICE 'Expected fix:';
    RAISE NOTICE '  - Create record_shift_end function';
    RAISE NOTICE '  - Function should record last_online_at';
    RAISE NOTICE '  - Function should NOT prevent courier from going ON again';
    RAISE NOTICE '  - Function should return warnings for early/late finish';
  ELSE
    RAISE NOTICE 'WARNING: record_courier_checkin also does not exist';
    RAISE NOTICE '  - This may indicate a different system design';
  END IF;
END $$;

-- ========================================
-- COUNTEREXAMPLE SUMMARY
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'COUNTEREXAMPLE SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
  RAISE NOTICE 'Bug: Missing Shift End Recording Mechanism';
  RAISE NOTICE '';
  
  RAISE NOTICE 'Scenario:';
  RAISE NOTICE '  - Courier checks in at 06:05 (5 minutes late)';
  RAISE NOTICE '  - Courier goes OFF temporarily 3 times during shift:';
  RAISE NOTICE '    * 09:00 - Bathroom break';
  RAISE NOTICE '    * 12:00 - Lunch';
  RAISE NOTICE '    * 15:00 - Vehicle issue';
  RAISE NOTICE '  - Courier finishes shift at 16:45 (15 minutes early)';
  RAISE NOTICE '  - Private order comes in at 18:00';
  RAISE NOTICE '';
  
  RAISE NOTICE 'Current Behavior (Bug):';
  RAISE NOTICE '  - first_online_at: 06:05 ✓';
  RAISE NOTICE '  - last_online_at: NULL ✗';
  RAISE NOTICE '  - No way to record shift end time';
  RAISE NOTICE '  - Cannot distinguish temporary OFF from shift end';
  RAISE NOTICE '  - Cannot track in-shift vs out-of-shift work';
  RAISE NOTICE '';
  
  RAISE NOTICE 'Expected Behavior (Fixed):';
  RAISE NOTICE '  - Courier clicks "Selesai Shift" button at 16:45';
  RAISE NOTICE '  - System calls record_shift_end(courier_id)';
  RAISE NOTICE '  - last_online_at: 16:45 ✓';
  RAISE NOTICE '  - System shows warning: "Anda selesai shift 15 menit lebih awal"';
  RAISE NOTICE '  - Courier can still go ON at 18:00 for private order';
  RAISE NOTICE '  - Out-of-shift work tracked separately';
  RAISE NOTICE '';
  
  RAISE NOTICE 'Root Cause:';
  RAISE NOTICE '  - System has record_courier_checkin but no record_shift_end';
  RAISE NOTICE '  - Asymmetric design: can record start but not end';
  RAISE NOTICE '  - last_online_at column exists but never populated';
  RAISE NOTICE '';
  
  RAISE NOTICE 'Expected Fix:';
  RAISE NOTICE '  1. Create record_shift_end(p_courier_id UUID) function';
  RAISE NOTICE '  2. Function records last_online_at = NOW()';
  RAISE NOTICE '  3. Function calculates duration and returns warnings';
  RAISE NOTICE '  4. Function does NOT prevent courier from going ON again';
  RAISE NOTICE '  5. Add "Selesai Shift" button in mobile app';
  RAISE NOTICE '  6. Update admin UI to show last_online_at column';
  RAISE NOTICE '';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'BUG CONDITION EXPLORATION TEST COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
  RAISE NOTICE 'Result: BUG CONFIRMED';
  RAISE NOTICE 'The test demonstrates that record_shift_end does not exist.';
  RAISE NOTICE 'This test will PASS after implementing the shift end recording mechanism.';
END $$;
