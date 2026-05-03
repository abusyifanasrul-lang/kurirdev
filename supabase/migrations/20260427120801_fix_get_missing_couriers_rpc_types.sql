CREATE OR REPLACE FUNCTION public.get_missing_couriers(p_date DATE DEFAULT CURRENT_DATE)
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
    p.name::TEXT,
    s.id,
    s.name::TEXT,
    s.start_time,
    GREATEST(0, EXTRACT(EPOCH FROM (
      NOW() - (p_date + s.start_time)::TIMESTAMPTZ
    )) / 60)::INT
  FROM profiles p
  JOIN shifts s ON s.id = p.shift_id
  WHERE p.role = 'courier'
    AND p.is_active = true
    AND s.is_active = true
    -- Shift sudah mulai (lewat jam mulai shift)
    AND NOW() > (p_date + s.start_time)::TIMESTAMPTZ
    -- Belum ada attendance hari ini
    AND NOT EXISTS (
      SELECT 1 FROM shift_attendance sa
      WHERE sa.courier_id = p.id
        AND sa.date = p_date
    )
    -- Bukan hari libur
    AND NOT EXISTS (
      SELECT 1 FROM holidays h
      WHERE h.date = p_date AND h.is_active = true
    )
  ORDER BY s.start_time, p.name;
END;
$$;;
