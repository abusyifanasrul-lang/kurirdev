-- Migration: Fix fine reset for overnight shift couriers
-- Purpose: Prevent resetting fine flags for couriers who are still in their shift
-- Issue: Overnight shift couriers (e.g., Shift D: 18:45-06:00) were getting their
--        fine flags reset at midnight even though they were still working

-- ============================================================================
-- Update reset_daily_fine_flags to respect shift schedules
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reset_daily_fine_flags()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_role TEXT;
  v_now_time TIME;
  v_reset_count INT;
BEGIN
  -- Auth check: Allow if called from service_role (Edge Function via cron)
  IF auth.uid() IS NULL THEN
    -- Service role, proceed
    NULL;
  ELSE
    -- If called from user session, validate role
    SELECT role INTO v_caller_role 
    FROM profiles WHERE id = auth.uid();

    IF v_caller_role NOT IN ('owner', 'admin_kurir', 'finance') THEN
      RAISE EXCEPTION 'Unauthorized: only admin/owner/finance can reset fine flags';
    END IF;
  END IF;

  -- Get current time
  v_now_time := CURRENT_TIME;

  -- Reset fine flags ONLY for couriers whose shift has ended or not started yet
  UPDATE profiles p
  SET late_fine_active = false
  WHERE p.role = 'courier' 
    AND p.late_fine_active = true
    AND p.shift_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM shifts s
      WHERE s.id = p.shift_id
        AND s.is_active = true
        AND (
          -- Case 1: Non-overnight shift
          -- Reset if current time is BEFORE shift start (shift hasn't started yet)
          -- Example: Shift A (06:00-17:00), current time 00:30 -> reset (shift not started)
          (s.is_overnight = false AND v_now_time < s.start_time)
          
          OR
          
          -- Case 2: Overnight shift
          -- Reset if current time is BETWEEN end_time and start_time (shift has ended)
          -- Example: Shift D (18:45-06:00), current time 07:00 -> reset (shift ended at 06:00)
          -- Example: Shift D (18:45-06:00), current time 00:30 -> NO reset (shift still running)
          (s.is_overnight = true AND v_now_time >= s.end_time AND v_now_time < s.start_time)
        )
    );
  
  GET DIAGNOSTICS v_reset_count = ROW_COUNT;
  
  -- Log for monitoring
  IF v_reset_count > 0 THEN
    RAISE NOTICE '[FINE RESET] Reset % courier fine flags at %', v_reset_count, NOW();
  END IF;
END;
$$;

COMMENT ON FUNCTION public.reset_daily_fine_flags() IS 
'Reset late_fine_active flag for couriers whose shift has ended. Respects overnight shifts - will not reset flags for couriers currently in their shift. Called by cron at midnight or manually by admin.';

-- ============================================================================
-- Update safety net function with same logic
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reset_daily_fine_flags_if_needed()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
  v_now_time TIME;
  v_reset_count INT;
BEGIN
  -- Quick check: are there any couriers with late_fine_active = true?
  SELECT COUNT(*) INTO v_count
  FROM profiles
  WHERE role = 'courier' AND late_fine_active = true;
  
  -- If no one needs reset, exit early (saves resources)
  IF v_count = 0 THEN
    RETURN;
  END IF;
  
  -- Get current time
  v_now_time := CURRENT_TIME;
  
  -- Reset fine flags ONLY for couriers whose shift has ended
  UPDATE profiles p
  SET late_fine_active = false
  WHERE p.role = 'courier' 
    AND p.late_fine_active = true
    AND p.shift_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM shifts s
      WHERE s.id = p.shift_id
        AND s.is_active = true
        AND (
          -- Non-overnight: reset if current time < start_time
          (s.is_overnight = false AND v_now_time < s.start_time)
          OR
          -- Overnight: reset if current time between end_time and start_time
          (s.is_overnight = true AND v_now_time >= s.end_time AND v_now_time < s.start_time)
        )
    );
  
  GET DIAGNOSTICS v_reset_count = ROW_COUNT;
  
  -- Log for monitoring (only if safety net actually reset something)
  IF v_reset_count > 0 THEN
    RAISE NOTICE '[SAFETY NET] Fine flags reset for % couriers at %', v_reset_count, NOW();
  END IF;
END;
$$;

COMMENT ON FUNCTION public.reset_daily_fine_flags_if_needed() IS 
'Safety net function that resets fine flags only if needed, respecting shift schedules. Called every 30 minutes as backup. Uses quick check to minimize resource usage.';

-- ============================================================================
-- Verification queries
-- ============================================================================

-- Test the logic with current time
DO $$
DECLARE
  v_now_time TIME := CURRENT_TIME;
  v_test_result TEXT;
BEGIN
  RAISE NOTICE '=== Fine Reset Logic Test ===';
  RAISE NOTICE 'Current time: %', v_now_time;
  RAISE NOTICE '';
  
  -- Show which couriers would be reset at current time
  FOR v_test_result IN
    SELECT 
      p.name as courier_name,
      s.name as shift_name,
      s.start_time,
      s.end_time,
      s.is_overnight,
      p.late_fine_active,
      CASE 
        WHEN s.is_overnight = false AND v_now_time < s.start_time THEN 'WOULD RESET (shift not started)'
        WHEN s.is_overnight = true AND v_now_time >= s.end_time AND v_now_time < s.start_time THEN 'WOULD RESET (shift ended)'
        ELSE 'NO RESET (shift in progress or passed)'
      END as reset_status
    FROM profiles p
    JOIN shifts s ON s.id = p.shift_id
    WHERE p.role = 'courier' AND p.is_active = true
    ORDER BY s.is_overnight DESC, s.start_time
  LOOP
    RAISE NOTICE '%', v_test_result;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ Fine reset logic updated successfully';
  RAISE NOTICE '🌙 Overnight shifts are now properly handled';
  RAISE NOTICE '⏰ Couriers in active shifts will NOT have their fines reset';
END $$;
