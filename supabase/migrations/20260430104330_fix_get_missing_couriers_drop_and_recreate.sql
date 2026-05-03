-- Drop existing function first
DROP FUNCTION IF EXISTS get_missing_couriers(DATE);

-- Recreate with new signature including shift_overrides logic
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
    -- ✅ Exclude kurir yang di-override (diganti/diliburkan) di tanggal ini
    AND NOT EXISTS (
      SELECT 1 FROM shift_overrides so
      WHERE so.original_courier_id = p.id
        AND so.date = p_date
    )

  UNION ALL

  -- Kurir PENGGANTI (replacement) yang belum hadir di shift override-nya
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
$$;;
