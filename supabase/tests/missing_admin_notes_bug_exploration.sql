/**
 * Bug 5: Missing Admin Notes for Fine Decisions
 * 
 * **Property 1: Bug Condition** - Missing Notes Parameter
 * 
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * **DO NOT attempt to fix the test or the code when it fails**
 * **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
 * 
 * **GOAL**: Surface counterexamples that demonstrate admin cannot input notes when applying fines
 * 
 * **Scoped PBT Approach**: Scope the property to fine application scenarios
 * 
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
 */

BEGIN;

-- Create test data
CREATE TEMP TABLE test_results (
  test_name TEXT,
  passed BOOLEAN,
  message TEXT
);

-- Test 1: Verify apply_attendance_fine function accepts p_notes parameter
DO $$
DECLARE
  v_function_exists BOOLEAN;
  v_has_notes_param BOOLEAN;
  v_param_count INT;
BEGIN
  -- Check if function exists
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'apply_attendance_fine'
  ) INTO v_function_exists;

  IF NOT v_function_exists THEN
    INSERT INTO test_results VALUES (
      'Function apply_attendance_fine exists',
      FALSE,
      'COUNTEREXAMPLE: Function apply_attendance_fine does not exist'
    );
    RETURN;
  END IF;

  -- Check if function has p_notes parameter
  SELECT 
    COUNT(*) FILTER (WHERE param_name = 'p_notes') > 0,
    COUNT(*)
  INTO v_has_notes_param, v_param_count
  FROM (
    SELECT unnest(proargnames) as param_name
    FROM pg_proc
    WHERE proname = 'apply_attendance_fine'
  ) params;

  IF v_has_notes_param THEN
    INSERT INTO test_results VALUES (
      'Function accepts p_notes parameter',
      TRUE,
      'VERIFICATION PASSED: apply_attendance_fine accepts p_notes parameter (parameter count: ' || v_param_count || ')'
    );
  ELSE
    INSERT INTO test_results VALUES (
      'Function accepts p_notes parameter',
      FALSE,
      'COUNTEREXAMPLE: apply_attendance_fine does NOT accept p_notes parameter (current parameters: ' || v_param_count || ')'
    );
  END IF;
END $$;

-- Test 2: Verify shift_attendance.notes column exists
DO $$
DECLARE
  v_column_exists BOOLEAN;
  v_column_type TEXT;
BEGIN
  SELECT 
    EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'shift_attendance' 
      AND column_name = 'notes'
    ),
    data_type
  INTO v_column_exists, v_column_type
  FROM information_schema.columns 
  WHERE table_name = 'shift_attendance' 
  AND column_name = 'notes';

  IF v_column_exists THEN
    INSERT INTO test_results VALUES (
      'shift_attendance.notes column exists',
      TRUE,
      'VERIFICATION PASSED: shift_attendance.notes column exists (type: ' || COALESCE(v_column_type, 'unknown') || ')'
    );
  ELSE
    INSERT INTO test_results VALUES (
      'shift_attendance.notes column exists',
      FALSE,
      'COUNTEREXAMPLE: shift_attendance.notes column does NOT exist'
    );
  END IF;
END $$;

-- Test 3: Verify function saves notes to shift_attendance.notes
DO $$
DECLARE
  v_test_courier_id UUID;
  v_test_shift_id UUID;
  v_test_attendance_id UUID;
  v_test_admin_id UUID;
  v_result JSONB;
  v_saved_notes TEXT;
BEGIN
  -- Create test courier
  INSERT INTO profiles (id, email, name, role, is_active)
  VALUES (gen_random_uuid(), 'test_courier_bug5@test.com', 'Test Courier Bug 5', 'courier', true)
  RETURNING id INTO v_test_courier_id;

  -- Create test admin
  INSERT INTO profiles (id, email, name, role, is_active)
  VALUES (gen_random_uuid(), 'test_admin_bug5@test.com', 'Test Admin Bug 5', 'admin_kurir', true)
  RETURNING id INTO v_test_admin_id;

  -- Create test shift
  INSERT INTO shifts (id, name, start_time, end_time, is_active)
  VALUES (gen_random_uuid(), 'Test Shift Bug 5', '06:00:00', '17:00:00', true)
  RETURNING id INTO v_test_shift_id;

  -- Create test attendance record
  INSERT INTO shift_attendance (
    id, courier_id, shift_id, date, 
    first_online_at, late_minutes, status
  )
  VALUES (
    gen_random_uuid(), v_test_courier_id, v_test_shift_id, CURRENT_DATE,
    CURRENT_TIMESTAMP, 45, 'late'
  )
  RETURNING id INTO v_test_attendance_id;

  -- Apply fine with notes
  SELECT apply_attendance_fine(
    v_test_attendance_id,
    'flat_major',
    v_test_admin_id,
    'Terlambat 45 menit tanpa pemberitahuan sebelumnya'
  ) INTO v_result;

  -- Check if notes were saved
  SELECT notes INTO v_saved_notes
  FROM shift_attendance
  WHERE id = v_test_attendance_id;

  IF v_saved_notes IS NOT NULL AND v_saved_notes = 'Terlambat 45 menit tanpa pemberitahuan sebelumnya' THEN
    INSERT INTO test_results VALUES (
      'Function saves notes to shift_attendance.notes',
      TRUE,
      'VERIFICATION PASSED: Notes saved correctly: "' || v_saved_notes || '"'
    );
  ELSIF v_saved_notes IS NULL THEN
    INSERT INTO test_results VALUES (
      'Function saves notes to shift_attendance.notes',
      FALSE,
      'COUNTEREXAMPLE: Notes were NOT saved (notes column is NULL)'
    );
  ELSE
    INSERT INTO test_results VALUES (
      'Function saves notes to shift_attendance.notes',
      FALSE,
      'COUNTEREXAMPLE: Notes saved incorrectly. Expected: "Terlambat 45 menit tanpa pemberitahuan sebelumnya", Got: "' || v_saved_notes || '"'
    );
  END IF;

  -- Cleanup
  DELETE FROM shift_attendance WHERE id = v_test_attendance_id;
  DELETE FROM shifts WHERE id = v_test_shift_id;
  DELETE FROM profiles WHERE id IN (v_test_courier_id, v_test_admin_id);
END $$;

-- Test 4: Verify function works without notes (optional parameter)
DO $$
DECLARE
  v_test_courier_id UUID;
  v_test_shift_id UUID;
  v_test_attendance_id UUID;
  v_test_admin_id UUID;
  v_result JSONB;
  v_saved_notes TEXT;
BEGIN
  -- Create test courier
  INSERT INTO profiles (id, email, name, role, is_active)
  VALUES (gen_random_uuid(), 'test_courier_bug5_2@test.com', 'Test Courier Bug 5-2', 'courier', true)
  RETURNING id INTO v_test_courier_id;

  -- Create test admin
  INSERT INTO profiles (id, email, name, role, is_active)
  VALUES (gen_random_uuid(), 'test_admin_bug5_2@test.com', 'Test Admin Bug 5-2', 'admin_kurir', true)
  RETURNING id INTO v_test_admin_id;

  -- Create test shift
  INSERT INTO shifts (id, name, start_time, end_time, is_active)
  VALUES (gen_random_uuid(), 'Test Shift Bug 5-2', '06:00:00', '17:00:00', true)
  RETURNING id INTO v_test_shift_id;

  -- Create test attendance record
  INSERT INTO shift_attendance (
    id, courier_id, shift_id, date, 
    first_online_at, late_minutes, status
  )
  VALUES (
    gen_random_uuid(), v_test_courier_id, v_test_shift_id, CURRENT_DATE,
    CURRENT_TIMESTAMP, 10, 'late'
  )
  RETURNING id INTO v_test_attendance_id;

  -- Apply fine WITHOUT notes (test optional parameter)
  SELECT apply_attendance_fine(
    v_test_attendance_id,
    'per_order',
    v_test_admin_id
  ) INTO v_result;

  -- Check if function succeeded
  IF (v_result->>'success')::BOOLEAN = TRUE THEN
    INSERT INTO test_results VALUES (
      'Function works without notes parameter',
      TRUE,
      'VERIFICATION PASSED: Function works when notes parameter is omitted (optional parameter)'
    );
  ELSE
    INSERT INTO test_results VALUES (
      'Function works without notes parameter',
      FALSE,
      'COUNTEREXAMPLE: Function FAILED when notes parameter is omitted. Error: ' || (v_result->>'error')
    );
  END IF;

  -- Cleanup
  DELETE FROM shift_attendance WHERE id = v_test_attendance_id;
  DELETE FROM shifts WHERE id = v_test_shift_id;
  DELETE FROM profiles WHERE id IN (v_test_courier_id, v_test_admin_id);
END $$;

-- Display results
SELECT 
  test_name,
  CASE 
    WHEN passed THEN '✓ PASS'
    ELSE '✗ FAIL'
  END as result,
  message
FROM test_results
ORDER BY test_name;

-- Summary
SELECT 
  COUNT(*) as total_tests,
  COUNT(*) FILTER (WHERE passed) as passed,
  COUNT(*) FILTER (WHERE NOT passed) as failed,
  CASE 
    WHEN COUNT(*) FILTER (WHERE NOT passed) = 0 THEN '✓ ALL TESTS PASSED - Bug is FIXED'
    ELSE '✗ SOME TESTS FAILED - Bug EXISTS'
  END as summary
FROM test_results;

ROLLBACK;
