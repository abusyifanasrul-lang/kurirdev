-- Fix get_missing_couriers to detect couriers who checked in BEFORE their shift started
-- This fixes the issue where warning panel doesn't show couriers who checked in prematurely

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

  -- Kurir dengan shift PERMANEN yang belum hadir ATAU check-in terlalu awal (sebelum shift mulai)
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
    -- FIX: Show if:
    -- 1. No record exists (sa.id IS NULL)
    -- 2. Record exists but no check-in (sa.first_online_at IS NULL)
    -- 3. Record exists but check-in was BEFORE shift started (premature check-in)
    AND (
      sa.id IS NULL 
      OR sa.first_online_at IS NULL 
      OR sa.first_online_at < (p_date + s.start_time)::TIMESTAMPTZ
    )
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
    -- FIX: Same logic for replacement couriers
    AND (
      sa.id IS NULL 
      OR sa.first_online_at IS NULL 
      OR sa.first_online_at < (p_date + s.start_time)::TIMESTAMPTZ
    );
END;
$$;

-- Add comment explaining the fix
COMMENT ON FUNCTION get_missing_couriers(DATE) IS 
'Returns couriers who are late for their shift. 
Includes couriers who checked in BEFORE their shift started (premature check-in).
This ensures the warning panel shows all couriers who need to check in again after shift starts.';
