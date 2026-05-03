-- Drop existing function with default parameter
DROP FUNCTION IF EXISTS public.get_missing_couriers(DATE);

-- Recreate with explicit DATE parameter (no default)
CREATE OR REPLACE FUNCTION public.get_missing_couriers(p_date DATE)
RETURNS TABLE (
  courier_id        UUID,
  courier_name      TEXT,
  shift_id          UUID,
  shift_name        TEXT,
  shift_start_time  TIME,
  minutes_late      INT
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    s.id,
    s.name,
    s.start_time,
    GREATEST(0, EXTRACT(EPOCH FROM (
      NOW() - (p_date + s.start_time)::TIMESTAMPTZ
    )) / 60)::INT
  FROM profiles p
  JOIN shifts s ON s.id = p.shift_id
  WHERE p.role = 'courier'
    AND p.is_active = true
    AND s.is_active = true
    AND NOW() > (p_date + s.start_time)::TIMESTAMPTZ
    AND NOT EXISTS (
      SELECT 1 FROM shift_attendance sa
      WHERE sa.courier_id = p.id
        AND sa.date = p_date
    )
    AND NOT (p.day_off = TRIM(TO_CHAR(p_date, 'Day')));
END;
$$;;
