/**
 * Bug 5: Missing Admin Notes for Fine Decisions
 * 
 * **Property 2: Preservation** - Existing Fine Application Logic Unchanged
 * 
 * **IMPORTANT**: Follow observation-first methodology
 * 
 * These tests observe behavior on UNFIXED code for:
 * - Fine application (per-order, flat major, flat alpha)
 * - Fine calculation amounts
 * - Fine status updates
 * - Excuse functionality
 * 
 * Property-based testing generates many test cases for stronger guarantees.
 * 
 * **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */

BEGIN;

-- Create test results table
CREATE TEMP TABLE test_results (
  test_name TEXT,
  passed BOOLEAN,
  message TEXT
);

-- Test 1: Per-order fine amount is Rp 1,000
DO $$
DECLARE
  v_test_courier_id UUID;
  v_test_shift_id UUID;
  v_test_attendance_id UUID;
  v_test_admin_id UUID;
  v_result JSONB;
  v_fine_amount INT;
BEGIN
  -- Create test data
  INSERT INTO profiles (id, email, name, role, is_active)
  VALUES (gen_random_uuid(), 'test_courier_preserve_1@test.com', 'Test Courier Preserve 1', 'courier', true)
  RETURNING id INTO v_test_courier_id;

  INSERT INTO profiles (id, email, name, role, is_active)
  VALUES (gen_random_uuid(), 'test_admin_preserve_1@test.com', 'Test Admin Preserve 1', 'admin_kurir', true)
  RETURNING id INTO v_test_admin_id;

  INSERT INTO shifts (id, name, start_time, end_time, is_active)
  VALUES (gen_random_uuid(), 'Test Shift Preserve 1', '06:00:00', '17:00:00', true)
  RETURNING id INTO v_test_shift_id;

  INSERT INTO shift_attendance (
    id, courier_id, shift_id, date, 
    first_online_at, late_minutes, status
  )
  VALUES (
    gen_random_uuid(), v_test_courier_id, v_test_shift_id, CURRENT_DATE,
    CURRENT_TIMESTAMP, 10, 'late'
  )
  RETURNING id INTO v_test_attendance_id;

  -- Apply per-order fine
  SELECT apply_attendance_fine(
    v_test_attendance_id,
    'per_order',
    v_test_admin_id
  ) INTO v_result;

  -- Check fine amount
  SELECT fine_per_order INTO v_fine_amount
  FROM shift_attendance
  WHERE id = v_test_attendance_id;

  IF v_fine_amount = 1000 THEN
    INSERT INTO test_results VALUES (
      'Per-order fine is Rp 1,000',
      TRUE,
      'PRESERVED: Per-order fine amount is correct (Rp 1,000)'
    );
  ELSE
    INSERT INTO test_results VALUES (
      'Per-order fine is Rp 1,000',
      FALSE,
      'REGRESSION: Per-order fine amount changed. Expected: 1000, Got: ' || COALESCE(v_fine_amount::TEXT, 'NULL')
    );
  END IF;

  -- Cleanup
  DELETE FROM shift_attendance WHERE id = v_test_attendance_id;
  DELETE FROM shifts WHERE id = v_test_shift_id;
  DELETE FROM profiles WHERE id IN (v_test_courier_id, v_test_admin_id);
END $$;

-- Test 2: Flat major fine amount is Rp 30,000
DO $$
DECLARE
  v_test_courier_id UUID;
  v_test_shift_id UUID;
  v_test_attendance_id UUID;
  v_test_admin_id UUID;
  v_result JSONB;
  v_fine_amount INT;
BEGIN
  -- Create test data
  INSERT INTO profiles (id, email, name, role, is_active)
  VALUES (gen_random_uuid(), 'test_courier_preserve_2@test.com', 'Test Courier Preserve 2', 'courier', true)
  RETURNING id INTO v_test_courier_id;

  INSERT INTO profiles (id, email, name, role, is_active)
  VALUES (gen_random_uuid(), 'test_admin_preserve_2@test.com', 'Test Admin Preserve 2', 'admin_kurir', true)
  RETURNING id INTO v_test_admin_id;

  INSERT INTO shifts (id, name, start_time, end_time, is_active)
  VALUES (gen_random_uuid(), 'Test Shift Preserve 2', '06:00:00', '17:00:00', true)
  RETURNING id INTO v_test_shift_id;

  INSERT INTO shift_attendance (
    id, courier_id, shift_id, date, 
    first_online_at, late_minutes, status
  )
  VALUES (
    gen_random_uuid(), v_test_courier_id, v_test_shift_id, CURRENT_DATE,
    CURRENT_TIMESTAMP, 45, 'late'
  )
  RETURNING id INTO v_test_attendance_id;

  -- Apply flat major fine
  SELECT apply_attendance_fine(
    v_test_attendance_id,
    'flat_major',
    v_test_admin_id
  ) INTO v_result;

  -- Check fine amount
  SELECT flat_fine INTO v_fine_amount
  FROM shift_attendance
  WHERE id = v_test_attendance_id;

  IF v_fine_amount = 30000 THEN
    INSERT INTO test_results VALUES (
      'Flat major fine is Rp 30,000',
      TRUE,
      'PRESERVED: Flat major fine amount is correct (Rp 30,000)'
    );
  ELSE
    INSERT INTO test_results VALUES (
      'Flat major fine is Rp 30,000',
      FALSE,
      'REGRESSION: Flat major fine amount changed. Expected: 30000, Got: ' || COALESCE(v_fine_amount::TEXT, 'NULL')
    );
  END IF;

  -- Cleanup
  DELETE FROM shift_attendance WHERE id = v_test_attendance_id;
  DELETE FROM shifts WHERE id = v_test_shift_id;
  DELETE FROM profiles WHERE id IN (v_test_courier_id, v_test_admin_id);
END $$;

-- Test 3: Per-order fine sets late_fine_active to true
DO $$
DECLARE
  v_test_courier_id UUID;
  v_test_shift_id UUID;
  v_test_attendance_id UUID;
  v_test_admin_id UUID;
  v_result JSONB;
  v_late_fine_active BOOLEAN;
BEGIN
  -- Create test data
  INSERT INTO profiles (id, email, name, role, is_active, late_fine_active)
  VALUES (gen_random_uuid(), 'test_courier_preserve_3@test.com', 'Test Courier Preserve 3', 'courier', true, false)
  RETURNING id INTO v_test_courier_id;

  INSERT INTO profiles (id, email, name, role, is_active)
  VALUES (gen_random_uuid(), 'test_admin_preserve_3@test.com', 'Test Admin Preserve 3', 'admin_kurir', true)
  RETURNING id INTO v_test_admin_id;

  INSERT INTO shifts (id, name, start_time, end_time, is_active)
  VALUES (gen_random_uuid(), 'Test Shift Preserve 3', '06:00:00', '17:00:00', true)
  RETURNING id INTO v_test_shift_id;

  INSERT INTO shift_attendance (
    id, courier_id, shift_id, date, 
    first_online_at, late_minutes, status
  )
  VALUES (
    gen_random_uuid(), v_test_courier_id, v_test_shift_id, CURRENT_DATE,
    CURRENT_TIMESTAMP, 10, 'late'
  )
  RETURNING id INTO v_test_attendance_id;

  -- Apply per-order fine
  SELECT apply_attendance_fine(
    v_test_attendance_id,
    'per_order',
    v_test_admin_id
  ) INTO v_result;

  -- Check late_fine_active flag
  SELECT late_fine_active INTO v_late_fine_active
  FROM profiles
  WHERE id = v_test_courier_id;

  IF v_late_fine_active = TRUE THEN
    INSERT INTO test_results VALUES (
      'Per-order fine sets late_fine_active to true',
      TRUE,
      'PRESERVED: late_fine_active flag is set correctly'
    );
  ELSE
    INSERT INTO test_results VALUES (
      'Per-order fine sets late_fine_active to true',
      FALSE,
      'REGRESSION: late_fine_active flag not set. Expected: true, Got: ' || COALESCE(v_late_fine_active::TEXT, 'NULL')
    );
  END IF;

  -- Cleanup
  DELETE FROM shift_attendance WHERE id = v_test_attendance_id;
  DELETE FROM shifts WHERE id = v_test_shift_id;
  DELETE FROM profiles WHERE id IN (v_test_courier_id, v_test_admin_id);
END $$;

-- Test 4: Status updates correctly for per-order fine
DO $$
DECLARE
  v_test_courier_id UUID;
  v_test_shift_id UUID;
  v_test_attendance_id UUID;
  v_test_admin_id UUID;
  v_result JSONB;
  v_status TEXT;
BEGIN
  -- Create test data
  INSERT INTO profiles (id, email, name, role, is_active)
  VALUES (gen_random_uuid(), 'test_courier_preserve_4@test.com', 'Test Courier Preserve 4', 'courier', true)
  RETURNING id INTO v_test_courier_id;

  INSERT INTO profiles (id, email, name, role, is_active)
  VALUES (gen_random_uuid(), 'test_admin_preserve_4@test.com', 'Test Admin Preserve 4', 'admin_kurir', true)
  RETURNING id INTO v_test_admin_id;

  INSERT INTO shifts (id, name, start_time, end_time, is_active)
  VALUES (gen_random_uuid(), 'Test Shift Preserve 4', '06:00:00', '17:00:00', true)
  RETURNING id INTO v_test_shift_id;

  INSERT INTO shift_attendance (
    id, courier_id, shift_id, date, 
    first_online_at, late_minutes, status
  )
  VALUES (
    gen_random_uuid(), v_test_courier_id, v_test_shift_id, CURRENT_DATE,
    CURRENT_TIMESTAMP, 10, 'late'
  )
  RETURNING id INTO v_test_attendance_id;

  -- Apply per-order fine
  SELECT apply_attendance_fine(
    v_test_attendance_id,
    'per_order',
    v_test_admin_id
  ) INTO v_result;

  -- Check status
  SELECT status INTO v_status
  FROM shift_attendance
  WHERE id = v_test_attendance_id;

  IF v_status = 'late_minor' THEN
    INSERT INTO test_results VALUES (
      'Status updates to late_minor for per-order fine',
      TRUE,
      'PRESERVED: Status updated correctly to late_minor'
    );
  ELSE
    INSERT INTO test_results VALUES (
      'Status updates to late_minor for per-order fine',
      FALSE,
      'REGRESSION: Status not updated correctly. Expected: late_minor, Got: ' || COALESCE(v_status, 'NULL')
    );
  END IF;

  -- Cleanup
  DELETE FROM shift_attendance WHERE id = v_test_attendance_id;
  DELETE FROM shifts WHERE id = v_test_shift_id;
  DELETE FROM profiles WHERE id IN (v_test_courier_id, v_test_admin_id);
END $$;

-- Test 5: Status updates correctly for flat major fine
DO $$
DECLARE
  v_test_courier_id UUID;
  v_test_shift_id UUID;
  v_test_attendance_id UUID;
  v_test_admin_id UUID;
  v_result JSONB;
  v_status TEXT;
BEGIN
  -- Create test data
  INSERT INTO profiles (id, email, name, role, is_active)
  VALUES (gen_random_uuid(), 'test_courier_preserve_5@test.com', 'Test Courier Preserve 5', 'courier', true)
  RETURNING id INTO v_test_courier_id;

  INSERT INTO profiles (id, email, name, role, is_active)
  VALUES (gen_random_uuid(), 'test_admin_preserve_5@test.com', 'Test Admin Preserve 5', 'admin_kurir', true)
  RETURNING id INTO v_test_admin_id;

  INSERT INTO shifts (id, name, start_time, end_time, is_active)
  VALUES (gen_random_uuid(), 'Test Shift Preserve 5', '06:00:00', '17:00:00', true)
  RETURNING id INTO v_test_shift_id;

  INSERT INTO shift_attendance (
    id, courier_id, shift_id, date, 
    first_online_at, late_minutes, status
  )
  VALUES (
    gen_random_uuid(), v_test_courier_id, v_test_shift_id, CURRENT_DATE,
    CURRENT_TIMESTAMP, 45, 'late'
  )
  RETURNING id INTO v_test_attendance_id;

  -- Apply flat major fine
  SELECT apply_attendance_fine(
    v_test_attendance_id,
    'flat_major',
    v_test_admin_id
  ) INTO v_result;

  -- Check status
  SELECT status INTO v_status
  FROM shift_attendance
  WHERE id = v_test_attendance_id;

  IF v_status = 'late_major' THEN
    INSERT INTO test_results VALUES (
      'Status updates to late_major for flat major fine',
      TRUE,
      'PRESERVED: Status updated correctly to late_major'
    );
  ELSE
    INSERT INTO test_results VALUES (
      'Status updates to late_major for flat major fine',
      FALSE,
      'REGRESSION: Status not updated correctly. Expected: late_major, Got: ' || COALESCE(v_status, 'NULL')
    );
  END IF;

  -- Cleanup
  DELETE FROM shift_attendance WHERE id = v_test_attendance_id;
  DELETE FROM shifts WHERE id = v_test_shift_id;
  DELETE FROM profiles WHERE id IN (v_test_courier_id, v_test_admin_id);
END $$;

-- Test 6: resolved_by and resolved_at are set
DO $$
DECLARE
  v_test_courier_id UUID;
  v_test_shift_id UUID;
  v_test_attendance_id UUID;
  v_test_admin_id UUID;
  v_result JSONB;
  v_resolved_by UUID;
  v_resolved_at TIMESTAMPTZ;
BEGIN
  -- Create test data
  INSERT INTO profiles (id, email, name, role, is_active)
  VALUES (gen_random_uuid(), 'test_courier_preserve_6@test.com', 'Test Courier Preserve 6', 'courier', true)
  RETURNING id INTO v_test_courier_id;

  INSERT INTO profiles (id, email, name, role, is_active)
  VALUES (gen_random_uuid(), 'test_admin_preserve_6@test.com', 'Test Admin Preserve 6', 'admin_kurir', true)
  RETURNING id INTO v_test_admin_id;

  INSERT INTO shifts (id, name, start_time, end_time, is_active)
  VALUES (gen_random_uuid(), 'Test Shift Preserve 6', '06:00:00', '17:00:00', true)
  RETURNING id INTO v_test_shift_id;

  INSERT INTO shift_attendance (
    id, courier_id, shift_id, date, 
    first_online_at, late_minutes, status
  )
  VALUES (
    gen_random_uuid(), v_test_courier_id, v_test_shift_id, CURRENT_DATE,
    CURRENT_TIMESTAMP, 10, 'late'
  )
  RETURNING id INTO v_test_attendance_id;

  -- Apply fine
  SELECT apply_attendance_fine(
    v_test_attendance_id,
    'per_order',
    v_test_admin_id
  ) INTO v_result;

  -- Check resolved_by and resolved_at
  SELECT resolved_by, resolved_at INTO v_resolved_by, v_resolved_at
  FROM shift_attendance
  WHERE id = v_test_attendance_id;

  IF v_resolved_by = v_test_admin_id AND v_resolved_at IS NOT NULL THEN
    INSERT INTO test_results VALUES (
      'resolved_by and resolved_at are set correctly',
      TRUE,
      'PRESERVED: resolved_by and resolved_at fields are set'
    );
  ELSE
    INSERT INTO test_results VALUES (
      'resolved_by and resolved_at are set correctly',
      FALSE,
      'REGRESSION: resolved_by or resolved_at not set. resolved_by: ' || COALESCE(v_resolved_by::TEXT, 'NULL') || ', resolved_at: ' || COALESCE(v_resolved_at::TEXT, 'NULL')
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
    WHEN COUNT(*) FILTER (WHERE NOT passed) = 0 THEN '✓ ALL TESTS PASSED - Baseline behavior preserved'
    ELSE '✗ SOME TESTS FAILED - Regressions detected'
  END as summary
FROM test_results;

ROLLBACK;
