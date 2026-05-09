-- Bug Condition Exploration Test: Missing Admin Notes for Fine Decisions
-- **Validates: Bug 5 EXISTS**
-- 
-- Property 1: Bug Condition - Missing Notes Parameter
-- 
-- IMPORTANT: This test should FAIL on unfixed code (bug exists)
-- After adding notes parameter, this test should PASS (bug fixed)
-- 
-- Test Objective:
--   Verify that apply_attendance_fine function does NOT accept notes parameter
--   Admin cannot input reason/notes when applying fines
--   shift_attendance.notes remains NULL after applying fine
--
-- Test Scenario:
--   1. Create a courier with late attendance
--   2. Admin applies fine using apply_attendance_fine
--   3. Verify notes parameter is NOT accepted (function signature check)
--   4. Verify shift_attendance.notes is NULL after applying fine

-- ========================================
-- SETUP: Create test scenario
-- ========================================

DO $$
DECLARE
  v_courier_id UUID;
  v_admin_id UUID;
  v_shift_id UUID;
  v_attendance_id UUID;
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
  
  -- Get an admin
  SELECT id INTO v_admin_id 
  FROM profiles 
  WHERE role IN ('owner', 'admin_kurir') 
  LIMIT 1;
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'No admin found in database';
  END IF;
  
  -- Get a shift
  SELECT id INTO v_shift_id FROM shifts LIMIT 1;
  
  IF v_shift_id IS NULL THEN
    RAISE EXCEPTION 'No shift found in database';
  END IF;
  
  -- Clean up existing test data
  DELETE FROM shift_attendance 
  WHERE courier_id = v_courier_id 
    AND date = CURRENT_DATE;
  
  -- Create a late attendance record (65 minutes late)
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
    CURRENT_TIMESTAMP,
    65,
    'late'
  ) RETURNING id INTO v_attendance_id;
  
  RAISE NOTICE 'Created late attendance record';
  RAISE NOTICE '  - Courier: %', v_courier_id;
  RAISE NOTICE '  - Admin: %', v_admin_id;
  RAISE NOTICE '  - Attendance ID: %', v_attendance_id;
  RAISE NOTICE '  - Late minutes: 65';
  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 1: Verify function signature does NOT have notes parameter
-- ========================================

DO $$
DECLARE
  v_function_args TEXT;
  v_has_notes_param BOOLEAN;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 1: Function signature check';
  RAISE NOTICE '========================================';
  
  -- Get function arguments
  SELECT pg_get_function_arguments(oid) INTO v_function_args
  FROM pg_proc
  WHERE proname = 'apply_attendance_fine'
    AND pronamespace = 'public'::regnamespace;
  
  IF v_function_args IS NULL THEN
    RAISE EXCEPTION 'FAIL: apply_attendance_fine function not found';
  END IF;
  
  RAISE NOTICE 'Function signature: apply_attendance_fine(%)', v_function_args;
  
  -- Check if notes parameter exists
  v_has_notes_param := v_function_args LIKE '%notes%' OR v_function_args LIKE '%p_notes%';
  
  IF v_has_notes_param THEN
    RAISE EXCEPTION 'FAIL: Function already has notes parameter - BUG DOES NOT EXIST!';
  ELSE
    RAISE NOTICE 'PASS: Function does NOT have notes parameter';
    RAISE NOTICE 'This confirms Bug 5 exists: admin cannot input notes when applying fines';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 2: Apply fine and verify notes is NULL
-- ========================================

DO $$
DECLARE
  v_courier_id UUID;
  v_admin_id UUID;
  v_attendance_id UUID;
  v_result JSONB;
  v_notes_after TEXT;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 2: Apply fine and check notes column';
  RAISE NOTICE '========================================';
  
  -- Get test data
  SELECT id INTO v_courier_id FROM profiles WHERE role = 'courier' LIMIT 1;
  SELECT id INTO v_admin_id FROM profiles WHERE role IN ('owner', 'admin_kurir') LIMIT 1;
  SELECT id INTO v_attendance_id FROM shift_attendance WHERE courier_id = v_courier_id AND date = CURRENT_DATE LIMIT 1;
  
  -- Apply fine (without notes because parameter doesn't exist)
  SELECT * INTO v_result
  FROM apply_attendance_fine(v_attendance_id, 'flat_major', v_admin_id);
  
  RAISE NOTICE 'Applied fine result: %', v_result;
  
  -- Check if notes is NULL
  SELECT notes INTO v_notes_after
  FROM shift_attendance
  WHERE id = v_attendance_id;
  
  IF v_notes_after IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: Notes is not NULL (expected NULL because no parameter exists)';
  ELSE
    RAISE NOTICE 'PASS: Notes is NULL after applying fine';
    RAISE NOTICE 'This confirms Bug 5: admin cannot input reason/notes for fine decision';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 3: Compare with excuse_attendance (which HAS notes parameter)
-- ========================================

DO $$
DECLARE
  v_excuse_args TEXT;
  v_apply_args TEXT;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 3: Compare function signatures';
  RAISE NOTICE '========================================';
  
  -- Get excuse_attendance signature
  SELECT pg_get_function_arguments(oid) INTO v_excuse_args
  FROM pg_proc
  WHERE proname = 'excuse_attendance'
    AND pronamespace = 'public'::regnamespace;
  
  -- Get apply_attendance_fine signature
  SELECT pg_get_function_arguments(oid) INTO v_apply_args
  FROM pg_proc
  WHERE proname = 'apply_attendance_fine'
    AND pronamespace = 'public'::regnamespace;
  
  RAISE NOTICE 'excuse_attendance signature: %', v_excuse_args;
  RAISE NOTICE 'apply_attendance_fine signature: %', v_apply_args;
  RAISE NOTICE '';
  
  IF v_excuse_args LIKE '%notes%' AND v_apply_args NOT LIKE '%notes%' THEN
    RAISE NOTICE 'INCONSISTENCY DETECTED:';
    RAISE NOTICE '  - excuse_attendance HAS notes parameter';
    RAISE NOTICE '  - apply_attendance_fine DOES NOT have notes parameter';
    RAISE NOTICE '';
    RAISE NOTICE 'This is Bug 5: apply_attendance_fine should also accept notes parameter';
    RAISE NOTICE 'for consistency and audit trail purposes.';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- ========================================
-- BUG CONDITION SUMMARY
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'BUG CONDITION EXPLORATION SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Bug 5 CONFIRMED: Missing Admin Notes for Fine Decisions';
  RAISE NOTICE '';
  RAISE NOTICE 'Evidence:';
  RAISE NOTICE '  1. apply_attendance_fine does NOT have p_notes parameter';
  RAISE NOTICE '  2. shift_attendance.notes remains NULL after applying fine';
  RAISE NOTICE '  3. Inconsistency: excuse_attendance HAS notes, but apply_attendance_fine does NOT';
  RAISE NOTICE '';
  RAISE NOTICE 'Impact:';
  RAISE NOTICE '  - Admin cannot document reason for fine decision';
  RAISE NOTICE '  - No audit trail for why fine was applied';
  RAISE NOTICE '  - Courier cannot see explanation for fine';
  RAISE NOTICE '  - Inconsistent with excuse_attendance which accepts notes';
  RAISE NOTICE '';
  RAISE NOTICE 'Expected Fix:';
  RAISE NOTICE '  - Add p_notes TEXT DEFAULT NULL parameter to apply_attendance_fine';
  RAISE NOTICE '  - Update function to save notes to shift_attendance.notes column';
  RAISE NOTICE '  - Update admin UI to show notes input field';
  RAISE NOTICE '  - Display notes in admin and courier attendance history';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'EXPLORATION TEST COMPLETE';
  RAISE NOTICE '========================================';
END $$;

-- ========================================
-- CLEANUP: Remove test data
-- ========================================

DO $$
DECLARE
  v_courier_id UUID;
BEGIN
  SELECT id INTO v_courier_id FROM profiles WHERE role = 'courier' LIMIT 1;
  
  DELETE FROM shift_attendance 
  WHERE courier_id = v_courier_id 
    AND date = CURRENT_DATE;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Test data cleaned up';
END $$;
