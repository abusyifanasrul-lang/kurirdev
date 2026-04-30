-- Fix record_courier_checkin: timezone-aware date and shift_overrides support
-- Perubahan:
-- 1. CURRENT_DATE -> v_today (local date, not UTC)
-- 2. Shift lookup checks shift_overrides first (replacement couriers)

CREATE OR REPLACE FUNCTION record_courier_checkin(p_courier_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift        RECORD;
  v_settings     RECORD;
  v_shift_start  TIMESTAMPTZ;
  v_late_minutes INT := 0;
  v_already_exists BOOLEAN;
  v_timezone     TEXT;
  v_now_local    TIMESTAMPTZ;
  v_today        DATE;
BEGIN
  SELECT * INTO v_settings FROM settings WHERE id = 'global';
  v_timezone  := COALESCE(v_settings.operational_timezone, 'Asia/Makassar');
  v_now_local := NOW() AT TIME ZONE v_timezone;
  v_today     := v_now_local::DATE;

  -- Cek sudah check-in hari ini belum
  SELECT EXISTS(
    SELECT 1 FROM shift_attendance
    WHERE courier_id = p_courier_id
      AND date = v_today
  ) INTO v_already_exists;

  IF v_already_exists THEN
    RETURN jsonb_build_object('status', 'already_checked_in');
  END IF;

  -- Ambil shift kurir (cek override dulu, fallback ke shift permanen)
  SELECT s.* INTO v_shift
  FROM shifts s
  WHERE s.id = COALESCE(
    (SELECT so.original_shift_id FROM shift_overrides so
     WHERE so.replacement_courier_id = p_courier_id
       AND so.date = v_today
     LIMIT 1),
    (SELECT p.shift_id FROM profiles p WHERE p.id = p_courier_id)
  );

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'no_shift_assigned');
  END IF;

  -- Hitung jam mulai shift hari ini
  v_shift_start := v_today + v_shift.start_time;
  IF v_shift.is_overnight AND v_now_local < (v_shift_start - INTERVAL '6 hours') THEN
    v_shift_start := v_shift_start - INTERVAL '1 day';
  END IF;

  -- Hitung keterlambatan
  v_late_minutes := GREATEST(0,
    EXTRACT(EPOCH FROM (v_now_local - v_shift_start)) / 60
  );

  -- Catat kehadiran
  INSERT INTO shift_attendance (
    courier_id, shift_id, date,
    first_online_at, late_minutes,
    status, fine_type, fine_per_order, flat_fine
  ) VALUES (
    p_courier_id, v_shift.id, v_today,
    NOW(), v_late_minutes,
    CASE WHEN v_late_minutes = 0 THEN 'on_time' ELSE 'late' END,
    NULL, 0, 0
  );

  RETURN jsonb_build_object(
    'status', 'checked_in',
    'late_minutes', v_late_minutes,
    'needs_admin_review', v_late_minutes > 0
  );
END;
$$;
