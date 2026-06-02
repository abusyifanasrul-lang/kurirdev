-- ============================================================================
-- TIMEZONE MANAGEMENT MODULE
-- ============================================================================
-- Purpose: Single source of truth for all timezone operations in the system
-- Date: 2026-06-03
-- 
-- This module provides centralized timezone handling functions to prevent
-- timezone calculation bugs that have plagued this project for weeks.
--
-- ALL future code should use these functions instead of manual AT TIME ZONE
-- ============================================================================

-- ============================================================================
-- 1. GET OPERATIONAL TIMEZONE
-- ============================================================================
CREATE OR REPLACE FUNCTION tz_get_operational_timezone()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT operational_timezone FROM settings LIMIT 1),
    'Asia/Makassar'
  );
$$;

COMMENT ON FUNCTION tz_get_operational_timezone IS
  'Returns the operational timezone from settings, defaults to Asia/Makassar';

-- ============================================================================
-- 2. GET CURRENT TIME IN OPERATIONAL TIMEZONE
-- ============================================================================
CREATE OR REPLACE FUNCTION tz_now()
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
AS $$
  SELECT now() AT TIME ZONE tz_get_operational_timezone();
$$;

COMMENT ON FUNCTION tz_now IS
  'Returns current time converted to operational timezone (without TZ indicator)';

-- ============================================================================
-- 3. GET CURRENT DATE IN OPERATIONAL TIMEZONE
-- ============================================================================
CREATE OR REPLACE FUNCTION tz_today()
RETURNS DATE
LANGUAGE sql
STABLE
AS $$
  SELECT (now() AT TIME ZONE tz_get_operational_timezone())::DATE;
$$;

COMMENT ON FUNCTION tz_today IS
  'Returns current date in operational timezone';

-- ============================================================================
-- 4. CONVERT LOCAL TIME TO UTC (FOR COMPARISONS)
-- ============================================================================
CREATE OR REPLACE FUNCTION tz_local_to_utc(
  p_local_date DATE,
  p_local_time TIME
)
RETURNS TIMESTAMPTZ
LANGUAGE sql
IMMUTABLE
AS $$
  -- CRITICAL: Use ::TIMESTAMP (not ::TIMESTAMPTZ) to interpret as local time
  SELECT (p_local_date || ' ' || p_local_time)::TIMESTAMP 
    AT TIME ZONE tz_get_operational_timezone();
$$;

COMMENT ON FUNCTION tz_local_to_utc(DATE, TIME) IS
  'Converts local date+time to UTC timestamptz. Use this for shift window calculations.
  
  Example:
    tz_local_to_utc(''2026-06-03'', ''06:05:00'')
    → 2026-06-02 22:05:00+00 (if operational_timezone = Asia/Makassar)
  
  This correctly interprets 06:05 as Makassar time and converts to UTC.';

-- ============================================================================
-- 5. CONVERT UTC TO LOCAL TIME (FOR DISPLAY)
-- ============================================================================
CREATE OR REPLACE FUNCTION tz_utc_to_local(
  p_utc_time TIMESTAMPTZ
)
RETURNS TIMESTAMP
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_utc_time AT TIME ZONE tz_get_operational_timezone();
$$;

COMMENT ON FUNCTION tz_utc_to_local(TIMESTAMPTZ) IS
  'Converts UTC timestamptz to local timestamp (without TZ). Use for display purposes.
  
  Example:
    tz_utc_to_local(''2026-06-02 22:05:00+00'')
    → 2026-06-03 06:05:00 (if operational_timezone = Asia/Makassar)';

-- ============================================================================
-- 6. CHECK IF TIME IS WITHIN WINDOW
-- ============================================================================
CREATE OR REPLACE FUNCTION tz_is_within_window(
  p_check_time TIMESTAMPTZ,
  p_window_start TIMESTAMPTZ,
  p_window_end TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_check_time >= p_window_start AND p_check_time <= p_window_end;
$$;

COMMENT ON FUNCTION tz_is_within_window(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) IS
  'Checks if a time falls within a window. All times must be in UTC (TIMESTAMPTZ).
  
  Example:
    tz_is_within_window(
      now(),
      tz_local_to_utc(''2026-06-03'', ''05:05:00''),
      tz_local_to_utc(''2026-06-03'', ''07:05:00'')
    )';

-- ============================================================================
-- 7. CALCULATE SHIFT WINDOW (START AND END)
-- ============================================================================
CREATE OR REPLACE FUNCTION tz_calculate_shift_window(
  p_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_is_overnight BOOLEAN DEFAULT FALSE,
  p_check_in_window_minutes INTEGER DEFAULT 60
)
RETURNS TABLE(
  window_start TIMESTAMPTZ,
  window_end TIMESTAMPTZ,
  shift_start TIMESTAMPTZ,
  shift_end TIMESTAMPTZ
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Calculate shift start (in UTC)
  shift_start := tz_local_to_utc(p_date, p_start_time);
  
  -- Calculate shift end (in UTC)
  IF p_is_overnight THEN
    -- Overnight shift: end time is next day
    shift_end := tz_local_to_utc(p_date + 1, p_end_time);
  ELSE
    shift_end := tz_local_to_utc(p_date, p_end_time);
  END IF;
  
  -- Calculate check-in window start (X minutes before shift start)
  window_start := shift_start - (p_check_in_window_minutes || ' minutes')::INTERVAL;
  
  -- Check-in window ends at shift end
  window_end := shift_end;
  
  RETURN QUERY SELECT window_start, window_end, shift_start, shift_end;
END;
$$;

COMMENT ON FUNCTION tz_calculate_shift_window(DATE, TIME, TIME, BOOLEAN, INTEGER) IS
  'Calculates shift window boundaries for check-in validation.
  
  Returns:
    - window_start: Check-in allowed from this time
    - window_end: Check-in allowed until this time
    - shift_start: Actual shift start time
    - shift_end: Actual shift end time
  
  All returned times are in UTC (TIMESTAMPTZ) for comparison with now().
  
  Example:
    SELECT * FROM tz_calculate_shift_window(
      ''2026-06-03''::DATE,
      ''06:05:00''::TIME,
      ''07:05:00''::TIME,
      FALSE,
      60
    );
    
    Returns (for Asia/Makassar):
      window_start: 2026-06-02 21:05:00+00 (05:05 Makassar)
      window_end:   2026-06-02 23:05:00+00 (07:05 Makassar)
      shift_start:  2026-06-02 22:05:00+00 (06:05 Makassar)
      shift_end:    2026-06-02 23:05:00+00 (07:05 Makassar)';

-- ============================================================================
-- 8. CALCULATE LATE MINUTES
-- ============================================================================
CREATE OR REPLACE FUNCTION tz_calculate_late_minutes(
  p_actual_time TIMESTAMPTZ,
  p_expected_time TIMESTAMPTZ
)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(
    0,
    EXTRACT(EPOCH FROM (p_actual_time - p_expected_time))::INTEGER / 60
  );
$$;

COMMENT ON FUNCTION tz_calculate_late_minutes(TIMESTAMPTZ, TIMESTAMPTZ) IS
  'Calculates how many minutes late. Returns 0 if on time or early.
  
  Example:
    tz_calculate_late_minutes(
      ''2026-06-03 06:10:00+08''::TIMESTAMPTZ,  -- Actual check-in
      ''2026-06-03 06:05:00+08''::TIMESTAMPTZ   -- Expected shift start
    )
    → 5 (5 minutes late)';

-- ============================================================================
-- USAGE EXAMPLES & TESTING
-- ============================================================================

-- Test 1: Get current operational time
DO $$
BEGIN
  RAISE NOTICE 'Operational timezone: %', tz_get_operational_timezone();
  RAISE NOTICE 'Current UTC time: %', now();
  RAISE NOTICE 'Current operational time: %', tz_now();
  RAISE NOTICE 'Current operational date: %', tz_today();
END $$;

-- Test 2: Convert local time to UTC
DO $$
DECLARE
  v_utc TIMESTAMPTZ;
BEGIN
  v_utc := tz_local_to_utc('2026-06-03'::DATE, '06:05:00'::TIME);
  RAISE NOTICE 'Local 2026-06-03 06:05:00 Makassar → UTC %', v_utc;
END $$;

-- Test 3: Calculate shift window
DO $$
DECLARE
  v_window RECORD;
BEGIN
  SELECT * INTO v_window FROM tz_calculate_shift_window(
    '2026-06-03'::DATE,
    '06:05:00'::TIME,
    '07:05:00'::TIME,
    FALSE,
    60
  );
  
  RAISE NOTICE 'Shift window for 06:05-07:05 on 2026-06-03:';
  RAISE NOTICE '  Check-in allowed from: % (UTC)', v_window.window_start;
  RAISE NOTICE '  Check-in allowed until: % (UTC)', v_window.window_end;
  RAISE NOTICE '  Shift starts at: % (UTC)', v_window.shift_start;
  RAISE NOTICE '  Shift ends at: % (UTC)', v_window.shift_end;
  
  RAISE NOTICE 'Can check in now? %', tz_is_within_window(
    now(),
    v_window.window_start,
    v_window.window_end
  );
END $$;

-- ============================================================================
-- MIGRATION VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TIMEZONE MANAGEMENT MODULE INSTALLED';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Created 8 functions:';
  RAISE NOTICE '  1. tz_get_operational_timezone() → Get timezone setting';
  RAISE NOTICE '  2. tz_now() → Current time in operational TZ';
  RAISE NOTICE '  3. tz_today() → Current date in operational TZ';
  RAISE NOTICE '  4. tz_local_to_utc(date, time) → Convert local to UTC';
  RAISE NOTICE '  5. tz_utc_to_local(timestamptz) → Convert UTC to local';
  RAISE NOTICE '  6. tz_is_within_window(time, start, end) → Check window';
  RAISE NOTICE '  7. tz_calculate_shift_window(...) → Calculate shift boundaries';
  RAISE NOTICE '  8. tz_calculate_late_minutes(...) → Calculate lateness';
  RAISE NOTICE '';
  RAISE NOTICE 'ALL FUTURE CODE MUST USE THESE FUNCTIONS!';
  RAISE NOTICE 'NO MORE MANUAL AT TIME ZONE OPERATIONS!';
  RAISE NOTICE '========================================';
END $$;
