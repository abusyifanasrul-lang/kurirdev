-- RPC: Admin apply denda ke kurir yang terlambat
CREATE OR REPLACE FUNCTION public.apply_attendance_fine(
  p_attendance_id UUID,
  p_fine_type     TEXT,  -- 'per_order' atau 'flat_major'
  p_admin_id      UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_attendance RECORD;
  v_settings   RECORD;
  v_fine_amount INT;
BEGIN
  SELECT * INTO v_attendance 
  FROM shift_attendance WHERE id = p_attendance_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Record tidak ditemukan');
  END IF;

  SELECT * INTO v_settings FROM settings WHERE id = 'global';

  IF p_fine_type = 'per_order' THEN
    v_fine_amount := COALESCE(v_settings.fine_late_minor_amount, 1000);
    
    UPDATE shift_attendance SET
      fine_type      = 'per_order',
      fine_per_order = v_fine_amount,
      status         = 'late_minor',
      resolved_by    = p_admin_id,
      resolved_at    = NOW()
    WHERE id = p_attendance_id;

    -- Aktifkan flag denda di profil kurir
    UPDATE profiles SET late_fine_active = true 
    WHERE id = v_attendance.courier_id;

  ELSIF p_fine_type = 'flat_major' THEN
    v_fine_amount := COALESCE(v_settings.fine_late_major_amount, 30000);

    UPDATE shift_attendance SET
      fine_type   = 'flat_major',
      flat_fine   = v_fine_amount,
      status      = 'late_major',
      resolved_by = p_admin_id,
      resolved_at = NOW()
    WHERE id = p_attendance_id;

    -- Denda flat tidak pakai late_fine_active
    -- (tidak dipotong per order, langsung ke settlement)
  END IF;

  RETURN jsonb_build_object('success', true, 'fine_amount', v_fine_amount);
END;
$$;

-- RPC: Admin maafkan keterlambatan (excused)
CREATE OR REPLACE FUNCTION public.excuse_attendance(
  p_attendance_id UUID,
  p_admin_id      UUID,
  p_notes         TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE shift_attendance SET
    status      = 'excused',
    fine_type   = NULL,
    fine_per_order = 0,
    flat_fine   = 0,
    resolved_by = p_admin_id,
    resolved_at = NOW(),
    notes       = p_notes
  WHERE id = p_attendance_id;

  -- Pastikan flag denda tidak aktif
  UPDATE profiles SET late_fine_active = false
  WHERE id = (SELECT courier_id FROM shift_attendance WHERE id = p_attendance_id);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- RPC: Reset late_fine_active semua kurir (dipanggil awal hari / awal shift)
CREATE OR REPLACE FUNCTION public.reset_daily_fine_flags()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles SET late_fine_active = false
  WHERE role = 'courier' AND late_fine_active = true;
END;
$$;;
