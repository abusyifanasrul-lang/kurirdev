CREATE OR REPLACE FUNCTION process_shift_alpha()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift        RECORD;
  v_courier      RECORD;
  v_shift_end    TIMESTAMPTZ;
  v_shift_date   DATE;        -- tanggal MULAI shift (referensi attendance)
  v_settings     RECORD;
  v_alpha_count  INT := 0;
  v_timezone     TEXT;
  v_now_local    TIMESTAMPTZ;
  v_today        DATE;
BEGIN
  SELECT * INTO v_settings FROM settings WHERE id = 'global';
  v_timezone  := COALESCE(v_settings.operational_timezone, 'Asia/Makassar');
  v_now_local := NOW() AT TIME ZONE v_timezone;
  v_today     := v_now_local::DATE;

  FOR v_shift IN
    SELECT * FROM shifts WHERE is_active = true
  LOOP
    IF v_shift.is_overnight THEN
      IF v_now_local::TIME < v_shift.start_time THEN
        -- Sudah lewat tengah malam, shift dimulai KEMARIN
        v_shift_date := v_today - INTERVAL '1 day';
        v_shift_end  := v_today::DATE + v_shift.end_time;
      ELSE
        -- Shift baru mulai hari ini, selesai besok
        v_shift_date := v_today;
        v_shift_end  := (v_today + INTERVAL '1 day')::DATE + v_shift.end_time;
      END IF;
    ELSE
      v_shift_date := v_today;
      v_shift_end  := v_today::DATE + v_shift.end_time;
    END IF;

    -- Skip jika shift belum selesai
    IF v_now_local < v_shift_end THEN
      CONTINUE;
    END IF;

    -- Cek hari libur berdasarkan tanggal shift (bukan hari ini)
    IF EXISTS (
      SELECT 1 FROM holidays
      WHERE date = v_shift_date AND is_active = true
    ) THEN
      CONTINUE;
    END IF;

    -- Cari kurir di shift ini yang tidak punya attendance di tanggal shift
    FOR v_courier IN
      SELECT p.id
      FROM profiles p
      WHERE p.role = 'courier'
        AND p.is_active = true
        AND p.shift_id = v_shift.id
        AND NOT EXISTS (
          SELECT 1 FROM shift_attendance sa
          WHERE sa.courier_id = p.id
            AND sa.date = v_shift_date   -- ✅ tanggal mulai shift
        )
    LOOP
      INSERT INTO shift_attendance (
        courier_id, shift_id, date,
        first_online_at, status,
        fine_type, flat_fine,
        flat_fine_status
      ) VALUES (
        v_courier.id, v_shift.id, v_shift_date,  -- ✅ tanggal mulai shift
        NULL, 'alpha',
        'flat_alpha',
        COALESCE(v_settings.fine_alpha_amount, 50000),
        'active'
      )
      ON CONFLICT (courier_id, date) DO NOTHING;

      v_alpha_count := v_alpha_count + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'alpha_count', v_alpha_count,
    'processed_at', NOW()
  );
END;
$$;;
