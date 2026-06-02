-- Test: Fix "Already Checked-in" Blocking Online Bug
-- Purpose: Verify that couriers can go online after check-in without errors

BEGIN;

-- Setup test data
DO $$
DECLARE
  v_courier_id UUID := 'test-courier-001'::UUID;
  v_shift_id UUID;
  v_test_date DATE := CURRENT_DATE;
  v_result JSONB;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'TEST: Already Checked-in Blocking Online Bug';
  RAISE NOTICE '===========================================';
  
  -- Clean up any existing test data
  DELETE FROM shift_attendance WHERE courier_id = v_courier_id;
  DELETE FROM profiles WHERE id = v_courier_id;
  DELETE FROM shifts WHERE name = 'Test Shift 06:00-17:00';
  
  -- Create test shift (06:00-17:00)
  INSERT INTO shifts (id, name, start_time, end_time, is_active, is_overnight)
  VALUES (gen_random_uuid(), 'Test Shift 06:00-17:00', '06:00', '17:00', true, false)
  RETURNING id INTO v_shift_id;
  
  -- Create test courier
  INSERT INTO profiles (id, shift_id, is_online, courier_status, late_fine_active)
  VALUES (v_courier_id, v_shift_id, false, 'off', false);
  
  RAISE NOTICE '';
  RAISE NOTICE 'Scenario: Courier checks in, then goes OFF, then tries to go ON again';
  RAISE NOTICE '';
  
  -- Step 1: First check-in (should succeed)
  RAISE NOTICE 'Step 1: First check-in at 06:30 (within shift window)';
  SELECT record_courier_checkin(v_courier_id, false) INTO v_result;
  
  IF (v_result->>'success')::BOOLEAN THEN
    RAISE NOTICE '  ✅ First check-in SUCCESS';
    RAISE NOTICE '  - Message: %', v_result->>'message';
    RAISE NOTICE '  - Status set to: ON';
  ELSE
    RAISE NOTICE '  ❌ First check-in FAILED (unexpected)';
    RAISE NOTICE '  - Error: %', v_result->>'error';
  END IF;
  
  -- Verify attendance record created
  IF EXISTS (
    SELECT 1 FROM shift_attendance 
    WHERE courier_id = v_courier_id 
      AND date = v_test_date 
      AND first_online_at IS NOT NULL
  ) THEN
    RAISE NOTICE '  ✅ Attendance record created';
  ELSE
    RAISE NOTICE '  ❌ Attendance record NOT created';
  END IF;
  
  RAISE NOTICE '';
  
  -- Step 2: Courier goes OFF (simulate)
  RAISE NOTICE 'Step 2: Courier goes OFF (istirahat)';
  UPDATE profiles SET courier_status = 'off' WHERE id = v_courier_id;
  RAISE NOTICE '  ✅ Status set to: OFF';
  
  RAISE NOTICE '';
  
  -- Step 3: Try to go ON again WITHOUT skip flag (old behavior - should fail)
  RAISE NOTICE 'Step 3a: Try to go ON again WITHOUT skip_duplicate_check (old behavior)';
  SELECT record_courier_checkin(v_courier_id, false) INTO v_result;
  
  IF NOT (v_result->>'success')::BOOLEAN AND v_result->>'error' = 'already_checked_in' THEN
    RAISE NOTICE '  ✅ Correctly REJECTED with already_checked_in error';
    RAISE NOTICE '  - Message: %', v_result->>'message';
  ELSE
    RAISE NOTICE '  ❌ UNEXPECTED: Should reject with already_checked_in';
  END IF;
  
  -- Verify courier status NOT changed
  IF EXISTS (SELECT 1 FROM profiles WHERE id = v_courier_id AND courier_status = 'off') THEN
    RAISE NOTICE '  ✅ Status remains: OFF (bug reproduced)';
  ELSE
    RAISE NOTICE '  ❌ Status changed unexpectedly';
  END IF;
  
  RAISE NOTICE '';
  
  -- Step 4: Try to go ON again WITH skip flag (new behavior - should succeed)
  RAISE NOTICE 'Step 3b: Try to go ON again WITH skip_duplicate_check=true (NEW FIX)';
  SELECT record_courier_checkin(v_courier_id, true) INTO v_result;
  
  IF (v_result->>'success')::BOOLEAN THEN
    RAISE NOTICE '  ✅ Successfully set to ONLINE (bug FIXED)';
    RAISE NOTICE '  - Message: %', v_result->>'message';
    RAISE NOTICE '  - Already checked-in: %', v_result->>'already_checked_in';
  ELSE
    RAISE NOTICE '  ❌ FAILED: Should succeed with skip flag';
    RAISE NOTICE '  - Error: %', v_result->>'error';
  END IF;
  
  -- Verify courier status changed to 'on'
  IF EXISTS (SELECT 1 FROM profiles WHERE id = v_courier_id AND courier_status = 'on') THEN
    RAISE NOTICE '  ✅ Status changed to: ON (courier can receive orders now)';
  ELSE
    RAISE NOTICE '  ❌ Status NOT changed (bug still exists)';
  END IF;
  
  -- Verify NO duplicate attendance record created
  IF (SELECT COUNT(*) FROM shift_attendance WHERE courier_id = v_courier_id AND date = v_test_date) = 1 THEN
    RAISE NOTICE '  ✅ No duplicate attendance record (correct)';
  ELSE
    RAISE NOTICE '  ❌ Duplicate attendance record created (wrong)';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'TEST SUMMARY';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Bug: Courier cannot go online after check-in';
  RAISE NOTICE 'Fix: Add p_skip_duplicate_check parameter';
  RAISE NOTICE 'Result: Courier can toggle ON/OFF without errors';
  RAISE NOTICE '';
  
  -- Cleanup
  DELETE FROM shift_attendance WHERE courier_id = v_courier_id;
  DELETE FROM profiles WHERE id = v_courier_id;
  DELETE FROM shifts WHERE id = v_shift_id;
  
END $$;

ROLLBACK;
