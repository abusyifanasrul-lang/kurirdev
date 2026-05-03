-- RPC: Deteksi Alpha otomatis di akhir shift
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
BEGIN
  SELECT * INTO v_settings FROM settings WHERE id = 'global';

  -- Loop setiap shift yang jam-nya sudah selesai hari ini
  FOR v_shift IN
    SELECT * FROM shifts WHERE is_active = true
  LOOP
    -- Hitung kapan shift ini selesai hari ini
    v_shift_end := CURRENT_DATE + v_shift.end_time;
    
    -- Handle overnight shift (selesai di hari berikutnya)
    IF v_shift.is_overnight THEN
      IF NOW()::time < v_shift.start_time THEN
        -- Kita masih di hari yang sama dengan saat shift selesai
        v_shift_end := CURRENT_DATE + v_shift.end_time;
      ELSE
        -- Shift dimulai hari ini, selesai besok
        v_shift_end := (CURRENT_DATE + INTERVAL '1 day')::date + v_shift.end_time;
      END IF;
    END IF;

    -- Skip jika shift belum selesai
    IF NOW() < v_shift_end THEN
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
$$;

-- RPC: Ambil ringkasan denda per kurir per periode
CREATE OR REPLACE FUNCTION public.get_courier_fines(
  p_courier_id UUID,
  p_date_from  DATE,
  p_date_to    DATE
)
RETURNS TABLE (
  attendance_id UUID,
  date          DATE,
  status        TEXT,
  fine_type     TEXT,
  flat_fine     INT,
  fine_per_order INT,
  flat_fine_status TEXT,
  cancelled_by  UUID,
  cancel_reason TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sa.id,
    sa.date,
    sa.status,
    sa.fine_type,
    sa.flat_fine,
    sa.fine_per_order,
    sa.flat_fine_status,
    sa.cancelled_by,
    sa.cancel_reason
  FROM shift_attendance sa
  WHERE sa.courier_id = p_courier_id
    AND sa.date BETWEEN p_date_from AND p_date_to
    AND sa.fine_type IS NOT NULL
    AND sa.flat_fine_status != 'cancelled'
  ORDER BY sa.date DESC;
END;
$$;

-- RPC: Admin cancel/reverse denda di shift_attendance
CREATE OR REPLACE FUNCTION public.cancel_attendance_fine(
  p_attendance_id UUID,
  p_admin_id      UUID,
  p_reason        TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_courier_id UUID;
BEGIN
  SELECT courier_id INTO v_courier_id
  FROM shift_attendance WHERE id = p_attendance_id;

  UPDATE shift_attendance SET
    flat_fine_status = 'cancelled',
    cancelled_by     = p_admin_id,
    cancelled_at     = NOW(),
    cancel_reason    = p_reason
  WHERE id = p_attendance_id;

  -- Jika ini denda per_order, matikan flag juga
  UPDATE profiles SET late_fine_active = false
  WHERE id = v_courier_id
    AND (SELECT fine_type FROM shift_attendance WHERE id = p_attendance_id) = 'per_order';

  RETURN jsonb_build_object('success', true);
END;
$$;;
