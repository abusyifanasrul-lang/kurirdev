-- Fix get_missing_couriers: add shift_overrides support
-- Perubahan:
-- 1. Exclude couriers who are replaced (original_courier_id in shift_overrides)
-- 2. Add UNION ALL for replacement couriers based on original_shift_id

CREATE OR REPLACE FUNCTION get_missing_couriers(p_date DATE)
RETURNS TABLE (
  courier_id   UUID,
  courier_name TEXT,
  shift_id     UUID,
  shift_name   TEXT,
  shift_start  TIME,
  late_minutes INT
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
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
    p.name,
    s.id,
    s.name,
    s.start_time,
    GREATEST(0, EXTRACT(EPOCH FROM (
      v_now_local - (p_date + s.start_time)::TIMESTAMPTZ
    )) / 60)::INT
  FROM profiles p
  JOIN shifts s ON s.id = p.shift_id
  WHERE p.role = 'courier'
    AND p.is_active = true
    AND s.is_active = true
    AND v_now_local > (p_date + s.start_time)::TIMESTAMPTZ
    AND NOT EXISTS (
      SELECT 1 FROM shift_attendance sa
      WHERE sa.courier_id = p.id
        AND sa.date = p_date
    )
    AND NOT (p.day_off = TRIM(TO_CHAR(p_date, 'Day')))
    AND NOT EXISTS (
      SELECT 1 FROM shift_overrides so
      WHERE so.original_courier_id = p.id
        AND so.date = p_date
    )

  UNION ALL

  -- Kurir PENGGANTI (replacement) yang belum hadir
  SELECT
    p.id,
    p.name,
    s.id,
    s.name,
    s.start_time,
    GREATEST(0, EXTRACT(EPOCH FROM (
      v_now_local - (p_date + s.start_time)::TIMESTAMPTZ
    )) / 60)::INT
  FROM shift_overrides so
  JOIN profiles p ON p.id = so.replacement_courier_id
  JOIN shifts s ON s.id = so.original_shift_id
  WHERE so.date = p_date
    AND p.is_active = true
    AND s.is_active = true
    AND v_now_local > (p_date + s.start_time)::TIMESTAMPTZ
    AND NOT EXISTS (
      SELECT 1 FROM shift_attendance sa
      WHERE sa.courier_id = p.id
        AND sa.date = p_date
    );
END;
$$;
