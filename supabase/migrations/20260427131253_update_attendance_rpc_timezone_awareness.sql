-- 1. Update get_missing_couriers
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
DECLARE
  v_timezone TEXT;
  v_now_local TIMESTAMPTZ;
BEGIN
  SELECT operational_timezone INTO v_timezone FROM settings WHERE id = 'global';
  v_timezone := COALESCE(v_timezone, 'Asia/Makassar');
  v_now_local := NOW() AT TIME ZONE v_timezone;

  RETURN QUERY
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
    AND NOT (p.day_off = TRIM(TO_CHAR(p_date, 'Day')));
END;
$$;

-- 2. Update record_courier_checkin
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
  v_timezone    TEXT;
  v_now_local   TIMESTAMPTZ;
BEGIN
  -- Ambil settings denda & timezone
  SELECT * INTO v_settings FROM public.settings WHERE id = 'global';
  v_timezone := COALESCE(v_settings.operational_timezone, 'Asia/Makassar');
  v_now_local := NOW() AT TIME ZONE v_timezone;

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
  IF v_shift.is_overnight AND v_now_local < (v_shift_start - INTERVAL '6 hours') THEN
    v_shift_start := v_shift_start - INTERVAL '1 day';
  END IF;

  -- Hitung keterlambatan
  v_late_minutes := GREATEST(0,
    EXTRACT(EPOCH FROM (v_now_local - v_shift_start)) / 60
  );

  -- Catat kehadiran
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
    NULL, 0, 0
  );

  RETURN jsonb_build_object(
    'status', 'checked_in',
    'late_minutes', v_late_minutes,
    'needs_admin_review', v_late_minutes > 0
  );
END;
$$;

-- 3. Update process_shift_alpha
CREATE OR REPLACE FUNCTION public.process_shift_alpha()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_shift         RECORD;
  v_courier       RECORD;
  v_shift_end     TIMESTAMPTZ;
  v_settings      RECORD;
  v_alpha_count   INT := 0;
  v_timezone      TEXT;
  v_now_local     TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_settings FROM settings WHERE id = 'global';
  v_timezone := COALESCE(v_settings.operational_timezone, 'Asia/Makassar');
  v_now_local := NOW() AT TIME ZONE v_timezone;

  -- Loop setiap shift yang jam-nya sudah selesai hari ini
  FOR v_shift IN
    SELECT * FROM shifts WHERE is_active = true
  LOOP
    -- Hitung kapan shift ini selesai hari ini
    v_shift_end := CURRENT_DATE + v_shift.end_time;
    
    -- Handle overnight shift (selesai di hari berikutnya)
    IF v_shift.is_overnight THEN
      IF v_now_local::time < v_shift.start_time THEN
        -- Kita masih di hari yang sama dengan saat shift selesai
        v_shift_end := CURRENT_DATE + v_shift.end_time;
      ELSE
        -- Shift dimulai hari ini, selesai besok
        v_shift_end := (CURRENT_DATE + INTERVAL '1 day')::date + v_shift.end_time;
      END IF;
    END IF;

    -- Skip jika shift belum selesai
    IF v_now_local < v_shift_end THEN
      CONTINUE;
    END IF;

    -- Cari kurir di shift ini yang tidak punya attendance hari ini
    FOR v_courier IN
      SELECT p.id, p.shift_id
      FROM profiles p
      WHERE p.role = 'courier'
        AND p.is_active = true
        AND p.shift_id = v_shift.id
        AND NOT EXISTS (
          SELECT 1 FROM shift_attendance sa
          WHERE sa.courier_id = p.id
            AND sa.date = CURRENT_DATE
        )
    LOOP
      -- Cek apakah hari ini hari libur
      IF EXISTS (SELECT 1 FROM holidays WHERE date = CURRENT_DATE AND is_active = true) THEN
        CONTINUE;
      END IF;

      -- Insert alpha
      INSERT INTO shift_attendance (
        courier_id, shift_id, date,
        first_online_at, status,
        fine_type, flat_fine,
        flat_fine_status
      ) VALUES (
        v_courier.id, v_shift.id, CURRENT_DATE,
        NULL, 'alpha',
        'flat_alpha',
        COALESCE(v_settings.fine_alpha_amount, 50000),
        'active'
      )
      ON CONFLICT (courier_id, date) DO NOTHING;

      v_alpha_count := v_alpha_count + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('alpha_count', v_alpha_count, 'processed_at', NOW());
END;
$$;;
