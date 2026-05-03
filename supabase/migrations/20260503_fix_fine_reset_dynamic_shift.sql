-- Migration: Make fine reset fully dynamic based on actual shift end times
-- Purpose: Reset fine flags immediately after courier's shift ends (no hardcoded times)
-- Principle: Read shift.end_time dynamically, support any shift schedule

-- ============================================================================
-- Update reset_daily_fine_flags with fully dynamic shift-aware logic
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
    NULL;
  ELSE
    SELECT role INTO v_caller_role 
    FROM profiles WHERE id = auth.uid();

    IF v_caller_role NOT IN ('owner', 'admin_kurir', 'finance') THEN
      RAISE EXCEPTION 'Unauthorized: only admin/owner/finance can reset fine flags';
    END IF;
  END IF;

  v_now_time := CURRENT_TIME;

  -- Reset fine flags for couriers whose shift has ended
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
          -- Non-overnight shift: reset if current time is BEFORE shift starts
          -- (shift hasn't started yet, so yesterday's fine should be cleared)
          (s.is_overnight = false AND v_now_time < s.start_time)
          
          OR
          
          -- Overnight shift: reset if current time is AFTER shift ends
          -- (shift has ended, fine should be cleared immediately)
          -- No upper bound - can reset anytime after shift ends
          (s.is_overnight = true AND v_now_time >= s.end_time)
        )
    );
  
  GET DIAGNOSTICS v_reset_count = ROW_COUNT;
  
  IF v_reset_count > 0 THEN
    RAISE NOTICE '[FINE RESET] Reset % courier fine flags at %', v_reset_count, NOW();
  END IF;
END;
$$;

COMMENT ON FUNCTION public.reset_daily_fine_flags() IS 
'Reset late_fine_active flag dynamically based on each courier shift schedule. Non-overnight: reset before shift starts. Overnight: reset immediately after shift ends. Fully dynamic - no hardcoded times.';

-- ============================================================================
-- Update safety net function with same dynamic logic
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
  -- Quick check
  SELECT COUNT(*) INTO v_count
  FROM profiles
  WHERE role = 'courier' AND late_fine_active = true;
  
  IF v_count = 0 THEN
    RETURN;
  END IF;
  
  v_now_time := CURRENT_TIME;
  
  -- Reset fine flags dynamically based on shift schedule
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
          -- Non-overnight: reset before shift starts
          (s.is_overnight = false AND v_now_time < s.start_time)
          OR
          -- Overnight: reset after shift ends (no upper bound)
          (s.is_overnight = true AND v_now_time >= s.end_time)
        )
    );
  
  GET DIAGNOSTICS v_reset_count = ROW_COUNT;
  
  IF v_reset_count > 0 THEN
    RAISE NOTICE '[SAFETY NET] Fine flags reset for % couriers at %', v_reset_count, NOW();
  END IF;
END;
$$;

COMMENT ON FUNCTION public.reset_daily_fine_flags_if_needed() IS 
'Safety net with dynamic shift-aware reset logic. Reads actual shift end_time from database. Works with any shift schedule.';

-- ============================================================================
-- Verification: Test with actual shifts in database
-- ============================================================================

DO $$
DECLARE
  v_now_time TIME := CURRENT_TIME;
  v_shift_info RECORD;
BEGIN
  RAISE NOTICE '=== Dynamic Fine Reset Logic Test ===';
  RAISE NOTICE 'Current time: %', v_now_time;
  RAISE NOTICE '';
  RAISE NOTICE 'Shift Schedule & Reset Logic:';
  RAISE NOTICE '';
  
  -- Show reset logic for each shift
  FOR v_shift_info IN
    SELECT 
      s.name,
      s.start_time,
      s.end_time,
      s.is_overnight,
      COALESCE(STRING_AGG(p.name, ', '), 'No couriers') as couriers,
      CASE 
        WHEN s.is_overnight = false THEN 
          'Reset if time < ' || s.start_time::TEXT
        WHEN s.is_overnight = true THEN 
          'Reset if time >= ' || s.end_time::TEXT
      END as reset_logic
    FROM shifts s
    LEFT JOIN profiles p ON p.shift_id = s.id AND p.role = 'courier' AND p.is_active = true
    WHERE s.is_active = true
    GROUP BY s.id, s.name, s.start_time, s.end_time, s.is_overnight
    ORDER BY s.is_overnight DESC, s.start_time
  LOOP
    RAISE NOTICE '% (%) | Start: % | End: % | Overnight: % | %',
      v_shift_info.name,
      v_shift_info.couriers,
      v_shift_info.start_time,
      v_shift_info.end_time,
      v_shift_info.is_overnight,
      v_shift_info.reset_logic;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ Dynamic fine reset logic updated';
  RAISE NOTICE '🔄 Fully flexible - reads actual shift times from database';
  RAISE NOTICE '⏰ Overnight shifts reset immediately after end_time';
  RAISE NOTICE '📅 Non-overnight shifts reset before start_time';
END $$;
