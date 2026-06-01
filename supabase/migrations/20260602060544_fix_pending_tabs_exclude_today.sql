-- Fix attendance tab filtering logic
-- Bug: Record ALPHA/LATE hari ini muncul di tab "Pending Alpha"/"Pending Review"
-- Fix: Pending tabs hanya menampilkan record dari 7 hari LALU (tidak termasuk hari ini)
-- Tab "Hari Ini" menampilkan SEMUA record hari ini tanpa filter status

-- ============================================================================
-- Fix 1: Update get_pending_alpha_attendance - exclude today, only show past 7 days
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_pending_alpha_attendance();

CREATE OR REPLACE FUNCTION public.get_pending_alpha_attendance()
RETURNS TABLE (
  id UUID,
  courier_id UUID,
  courier_name TEXT,
  shift_id UUID,
  shift_name TEXT,
  date DATE,
  shift_start_time TIME,
  shift_end_time TIME,
  total_absent_minutes INTEGER,
  first_online_at TIMESTAMPTZ,
  last_online_at TIMESTAMPTZ,
  status TEXT,
  late_minutes INTEGER,
  fine_type TEXT,
  fine_per_order INTEGER,
  flat_fine INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_operational_tz TEXT;
  v_current_date DATE;
BEGIN
  -- Check authorization (use qualified column name to avoid ambiguity)
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin_kurir', 'owner')) THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;
  
  -- Get operational timezone and current date
  SELECT operational_timezone INTO v_operational_tz FROM settings LIMIT 1;
  IF v_operational_tz IS NULL THEN
    v_operational_tz := 'Asia/Makassar';
  END IF;
  
  v_current_date := (NOW() AT TIME ZONE v_operational_tz)::DATE;
  
  -- Return pending alpha records from PAST 7 days (NOT including today)
  RETURN QUERY
  SELECT 
    sa.id,
    sa.courier_id,
    p.name AS courier_name,
    sa.shift_id,
    s.name AS shift_name,
    sa.date,
    s.start_time AS shift_start_time,
    s.end_time AS shift_end_time,
    sa.late_minutes AS total_absent_minutes,
    sa.first_online_at,
    sa.last_online_at,
    sa.status,
    sa.late_minutes,
    sa.fine_type,
    sa.fine_per_order,
    sa.flat_fine
  FROM shift_attendance sa
  JOIN profiles p ON p.id = sa.courier_id
  JOIN shifts s ON s.id = sa.shift_id
  WHERE sa.status = 'alpha' 
    AND sa.resolved_by IS NULL
    AND sa.date < v_current_date  -- Exclude today
    AND sa.date >= v_current_date - INTERVAL '7 days'  -- Last 7 days
  ORDER BY sa.date DESC, sa.late_minutes DESC;
END;
$$;

-- ============================================================================
-- Fix 2: Update get_pending_review_attendance - exclude today, only show past 7 days
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_pending_review_attendance();

CREATE OR REPLACE FUNCTION public.get_pending_review_attendance()
RETURNS TABLE (
  id UUID,
  courier_id UUID,
  courier_name TEXT,
  shift_id UUID,
  shift_name TEXT,
  date DATE,
  late_minutes INTEGER,
  shift_start_time TIME,
  first_online_at TIMESTAMPTZ,
  last_online_at TIMESTAMPTZ,
  status TEXT,
  fine_type TEXT,
  fine_per_order INTEGER,
  flat_fine INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_operational_tz TEXT;
  v_current_date DATE;
BEGIN
  -- Check authorization (use qualified column name to avoid ambiguity)
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin_kurir', 'owner')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;
  
  -- Get operational timezone and current date
  SELECT operational_timezone INTO v_operational_tz FROM settings LIMIT 1;
  IF v_operational_tz IS NULL THEN
    v_operational_tz := 'Asia/Makassar';
  END IF;
  
  v_current_date := (NOW() AT TIME ZONE v_operational_tz)::DATE;
  
  -- Return pending review records from PAST 7 days (NOT including today)
  RETURN QUERY
  SELECT 
    sa.id,
    sa.courier_id,
    p.name AS courier_name,
    sa.shift_id,
    s.name AS shift_name,
    sa.date,
    sa.late_minutes,
    s.start_time AS shift_start_time,
    sa.first_online_at,
    sa.last_online_at,
    sa.status,
    sa.fine_type,
    sa.fine_per_order,
    sa.flat_fine
  FROM shift_attendance sa
  JOIN profiles p ON p.id = sa.courier_id
  JOIN shifts s ON s.id = sa.shift_id
  WHERE sa.status = 'late'
    AND sa.fine_type IS NULL
    AND sa.date < v_current_date  -- Exclude today
    AND sa.date >= v_current_date - INTERVAL '7 days'  -- Last 7 days
  ORDER BY sa.date DESC, sa.late_minutes DESC;
END;
$$;

-- ============================================================================
-- Verification queries (commented out - for manual testing)
-- ============================================================================

-- Test 1: Check pending alpha records (should NOT include today)
-- SELECT date, courier_name, status, resolved_by
-- FROM get_pending_alpha_attendance()
-- ORDER BY date DESC;

-- Test 2: Check pending review records (should NOT include today)
-- SELECT date, courier_name, status, fine_type
-- FROM get_pending_review_attendance()
-- ORDER BY date DESC;

-- Test 3: Verify today's records are excluded from pending tabs
-- SELECT 
--   (NOW() AT TIME ZONE 'Asia/Makassar')::DATE as today,
--   COUNT(*) FILTER (WHERE date = (NOW() AT TIME ZONE 'Asia/Makassar')::DATE) as today_count,
--   COUNT(*) FILTER (WHERE date < (NOW() AT TIME ZONE 'Asia/Makassar')::DATE) as past_count
-- FROM shift_attendance
-- WHERE status = 'alpha' AND resolved_by IS NULL;

-- Test 4: Tab "Hari Ini" should show ALL records for today (no status filter)
-- SELECT sa.id, p.name, sa.status, sa.resolved_by, sa.fine_type
-- FROM shift_attendance sa
-- JOIN profiles p ON p.id = sa.courier_id
-- WHERE sa.date = (NOW() AT TIME ZONE 'Asia/Makassar')::DATE
-- ORDER BY sa.first_online_at DESC;
