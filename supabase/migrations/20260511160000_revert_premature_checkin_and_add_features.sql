-- Migration: Revert premature check-in fix + Add minor threshold + Auto-alpha detection
-- 1. Revert get_missing_couriers to correct logic (remove premature check-in detection)
-- 2. Add fine_late_minor_minutes column to settings
-- 3. Create function to auto-detect alpha status when shift ends

-- ============================================================================
-- PART 1: Revert get_missing_couriers to correct logic
-- ============================================================================

CREATE OR REPLACE FUNCTION get_missing_couriers(p_date DATE)
RETURNS TABLE (
  courier_id UUID,
  courier_name TEXT,
  shift_id UUID,
  shift_name TEXT,
  shift_start_time TIME,
  minutes_late INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_timezone  TEXT;
  v_now_local TIMESTAMPTZ;
BEGIN
  SELECT operational_timezone INTO v_timezone FROM settings WHERE id = 'global';
  v_timezone  := COALESCE(v_timezone, 'Asia/Makassar');
  v_now_local := NOW() AT TIME ZONE v_timezone;

  RETURN QUERY

  -- Kurir dengan shift PERMANEN yang belum hadir
  SELECT
    p.id,
    p.name::TEXT,
    s.id,
    s.name::TEXT,
    s.start_time,
    GREATEST(0, EXTRACT(EPOCH FROM (
      v_now_local - (p_date + s.start_time)::TIMESTAMPTZ
    )) / 60)::INT
  FROM profiles p
  JOIN shifts s ON s.id = p.shift_id
  LEFT JOIN shift_attendance sa ON sa.courier_id = p.id AND sa.date = p_date
  WHERE p.role = 'courier'
    AND p.is_active = true
    AND s.is_active = true
    AND v_now_local > (p_date + s.start_time)::TIMESTAMPTZ
    -- Show if: no record exists OR record exists but no check-in
    AND (sa.id IS NULL OR sa.first_online_at IS NULL)
    AND COALESCE(p.day_off, '') != TRIM(TO_CHAR(p_date, 'Day'))
    AND NOT EXISTS (
      SELECT 1 FROM shift_overrides so
      WHERE so.original_courier_id = p.id
        AND so.date = p_date
    )

  UNION ALL

  -- Kurir PENGGANTI (replacement) yang belum hadir di shift override-nya
  SELECT
    p.id,
    p.name::TEXT,
    s.id,
    s.name::TEXT,
    s.start_time,
    GREATEST(0, EXTRACT(EPOCH FROM (
      v_now_local - (p_date + s.start_time)::TIMESTAMPTZ
    )) / 60)::INT
  FROM shift_overrides so
  JOIN profiles p ON p.id = so.replacement_courier_id
  JOIN shifts s ON s.id = so.original_shift_id
  LEFT JOIN shift_attendance sa ON sa.courier_id = p.id AND sa.date = p_date
  WHERE so.date = p_date
    AND p.is_active = true
    AND s.is_active = true
    AND v_now_local > (p_date + s.start_time)::TIMESTAMPTZ
    -- Show if: no record exists OR record exists but no check-in
    AND (sa.id IS NULL OR sa.first_online_at IS NULL);
END;
$$;

COMMENT ON FUNCTION get_missing_couriers(DATE) IS 
'Returns couriers who are late for their shift (no attendance record or no check-in).
Reverted from premature check-in detection - couriers who click ON before shift start are valid.';

-- ============================================================================
-- PART 2: Add fine_late_minor_minutes to settings
-- ============================================================================

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS fine_late_minor_minutes INT DEFAULT 1;

-- Set default value for existing record
UPDATE settings 
SET fine_late_minor_minutes = 1
WHERE id = 'global' AND fine_late_minor_minutes IS NULL;

COMMENT ON COLUMN settings.fine_late_minor_minutes IS 
'Minimum late minutes threshold for minor fine (per-order deduction). Default: 1 minute.';

-- ============================================================================
-- PART 3: Auto-detect alpha status when shift ends
-- ============================================================================

CREATE OR REPLACE FUNCTION process_shift_end_alpha_detection()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_timezone TEXT;
  v_now_local TIMESTAMPTZ;
  v_today DATE;
  v_current_time TIME;
  v_shift RECORD;
  v_shift_end TIMESTAMPTZ;
  v_alpha_count INT := 0;
BEGIN
  -- Get timezone
  SELECT operational_timezone INTO v_timezone FROM settings WHERE id = 'global';
  v_timezone := COALESCE(v_timezone, 'Asia/Makassar');
  v_now_local := NOW() AT TIME ZONE v_timezone;
  v_today := v_now_local::DATE;
  v_current_time := v_now_local::TIME;

  -- Loop through all active shifts
  FOR v_shift IN 
    SELECT * FROM shifts WHERE is_active = true
  LOOP
    -- Calculate shift end time
    v_shift_end := v_today + v_shift.end_time;
    
    -- Handle overnight shifts
    IF v_shift.is_overnight THEN
      v_shift_end := v_shift_end + INTERVAL '1 day';
    END IF;

    -- Check if shift just ended (within 1 minute window)
    IF ABS(EXTRACT(EPOCH FROM (v_now_local - v_shift_end)) / 60) <= 1 THEN
      
      RAISE NOTICE 'Shift % ended at %. Processing alpha detection...', v_shift.name, v_shift.end_time;

      -- Find couriers who never checked in (still in warning panel)
      -- These are couriers with attendance record but first_online_at IS NULL
      UPDATE shift_attendance sa
      SET 
        status = 'alpha',
        late_minutes = EXTRACT(EPOCH FROM (v_shift_end - (v_today + v_shift.start_time))) / 60
      WHERE sa.date = v_today
        AND sa.shift_id = v_shift.id
        AND sa.first_online_at IS NULL
        AND sa.status = 'late';

      GET DIAGNOSTICS v_alpha_count = ROW_COUNT;
      
      RAISE NOTICE 'Marked % couriers as alpha for shift %', v_alpha_count, v_shift.name;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Alpha detection completed',
    'timestamp', v_now_local,
    'alpha_count', v_alpha_count
  );
END;
$$;

COMMENT ON FUNCTION process_shift_end_alpha_detection() IS 
'Automatically marks couriers as "alpha" when shift ends if they never checked in (first_online_at IS NULL).
Should be called every minute by edge function or cron job.';

