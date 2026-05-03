CREATE OR REPLACE FUNCTION public.record_courier_checkin(p_courier_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_shift       RECORD;
  v_settings    RECORD;
  v_shift_start TIMESTAMPTZ;
  v_late_minutes INT := 0;
  v_already_exists BOOLEAN;
BEGIN
  -- Cek sudah check-in hari ini belum
  SELECT EXISTS(
    SELECT 1 FROM public.shift_attendance
    WHERE courier_id = p_courier_id
    AND date = CURRENT_DATE
  ) INTO v_already_exists;

  IF v_already_exists THEN
    RETURN jsonb_build_object('status', 'already_checked_in');
  END IF;

  -- Ambil shift kurir
  SELECT s.* INTO v_shift
  FROM public.shifts s
  JOIN public.profiles p ON p.shift_id = s.id
  WHERE p.id = p_courier_id;

  IF v_shift IS NULL THEN
    RETURN jsonb_build_object('status', 'no_shift_assigned');
  END IF;

  -- Hitung jam mulai shift hari ini
  v_shift_start := CURRENT_DATE + v_shift.start_time;
  IF v_shift.is_overnight AND NOW() < (v_shift_start - INTERVAL '6 hours') THEN
    v_shift_start := v_shift_start - INTERVAL '1 day';
  END IF;

  -- Hitung keterlambatan (negatif = lebih awal, kita floor ke 0)
  v_late_minutes := GREATEST(0,
    EXTRACT(EPOCH FROM (NOW() - v_shift_start)) / 60
  );

  -- Ambil settings denda
  SELECT * INTO v_settings FROM public.settings WHERE id = 'global';

  -- Catat kehadiran dengan status awal
  -- Status hanya 'on_time' atau 'late' — admin yang tentukan denda
  INSERT INTO public.shift_attendance (
    courier_id, shift_id, date,
    first_online_at, late_minutes,
    status,
    fine_type,
    fine_per_order,
    flat_fine
  ) VALUES (
    p_courier_id, v_shift.id, CURRENT_DATE,
    NOW(), v_late_minutes,
    CASE WHEN v_late_minutes = 0 THEN 'on_time' ELSE 'late' END,
    NULL,  -- admin yang tentukan
    0,     -- admin yang tentukan
    0      -- admin yang tentukan
  );

  RETURN jsonb_build_object(
    'status', 'checked_in',
    'late_minutes', v_late_minutes,
    'needs_admin_review', v_late_minutes > 0
  );
END;
$$;;
