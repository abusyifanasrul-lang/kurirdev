-- Admin RPC Functions for attendance review workflows

CREATE OR REPLACE FUNCTION public.get_pending_review_attendance()
RETURNS TABLE (
  id UUID,
  courier_id UUID,
  courier_name TEXT,
  shift_id UUID,
  shift_name TEXT,
  date DATE,
  late_minutes INTEGER,
  shift_start_time TIME,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin_kurir', 'owner')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;

  RETURN QUERY
  SELECT 
    sa.id,
    sa.courier_id,
    p.name AS courier_name,
    sa.shift_id,
    s.name AS shift_name,
    sa.date,
    sa.late_minutes,
    s.start_time AS shift_start_time,
    sa.created_at
  FROM shift_attendance sa
  JOIN profiles p ON p.id = sa.courier_id
  JOIN shifts s ON s.id = sa.shift_id
  WHERE sa.status = 'late'
    AND sa.fine_type IS NULL
  ORDER BY sa.date DESC, sa.late_minutes DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_pending_alpha_attendance()
RETURNS TABLE (
  id UUID,
  courier_id UUID,
  courier_name TEXT,
  shift_id UUID,
  shift_name TEXT,
  date DATE,
  shift_start_time TIME,
  shift_end_time TIME,
  total_absent_minutes INTEGER,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin_kurir', 'owner')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;

  RETURN QUERY
  SELECT 
    sa.id,
    sa.courier_id,
    p.name AS courier_name,
    sa.shift_id,
    s.name AS shift_name,
    sa.date,
    s.start_time AS shift_start_time,
    s.end_time AS shift_end_time,
    sa.late_minutes AS total_absent_minutes,
    sa.created_at
  FROM shift_attendance sa
  JOIN profiles p ON p.id = sa.courier_id
  JOIN shifts s ON s.id = sa.shift_id
  WHERE sa.status = 'alpha'
    AND sa.resolved_by IS NULL
  ORDER BY sa.date DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_late_fine(
  p_attendance_id UUID,
  p_fine_type TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_attendance RECORD;
  v_fine_per_order INTEGER;
  v_flat_fine INTEGER;
  v_fine_late_minor_amount INTEGER;
  v_fine_late_major_amount INTEGER;
  v_fine_late_major_minutes INTEGER;
BEGIN
  SELECT id INTO v_admin_id FROM profiles 
  WHERE id = auth.uid() AND role IN ('admin_kurir', 'owner');
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;

  SELECT * INTO v_attendance FROM shift_attendance WHERE id = p_attendance_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'attendance_not_found');
  END IF;
  
  SELECT 
    fine_late_minor_amount, 
    fine_late_major_amount,
    fine_late_major_minutes
  INTO 
    v_fine_late_minor_amount,
    v_fine_late_major_amount,
    v_fine_late_major_minutes
  FROM settings LIMIT 1;
  
  IF p_fine_type = 'per_order' THEN
    v_fine_per_order := v_fine_late_minor_amount;
    v_flat_fine := NULL;
  ELSIF p_fine_type = 'flat_major' THEN
    v_fine_per_order := NULL;
    v_flat_fine := v_fine_late_major_amount;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'invalid_fine_type');
  END IF;
  
  UPDATE shift_attendance
  SET 
    fine_type = p_fine_type,
    fine_per_order = v_fine_per_order,
    flat_fine = v_flat_fine,
    resolved_by = v_admin_id,
    resolved_at = now(),
    notes = p_notes,
    updated_at = now()
  WHERE id = p_attendance_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'fine_type', p_fine_type,
    'fine_per_order', v_fine_per_order,
    'flat_fine', v_flat_fine
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.excuse_late_attendance(
  p_attendance_id UUID,
  p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  SELECT id INTO v_admin_id FROM profiles 
  WHERE id = auth.uid() AND role IN ('admin_kurir', 'owner');
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;

  UPDATE shift_attendance
  SET 
    status = 'excused',
    resolved_by = v_admin_id,
    resolved_at = now(),
    notes = p_notes,
    updated_at = now()
  WHERE id = p_attendance_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'attendance_not_found');
  END IF;
  
  RETURN jsonb_build_object('success', true, 'status', 'excused');
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_alpha_attendance(
  p_attendance_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  SELECT id INTO v_admin_id FROM profiles 
  WHERE id = auth.uid() AND role IN ('admin_kurir', 'owner');
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;

  UPDATE shift_attendance
  SET 
    resolved_by = v_admin_id,
    resolved_at = now(),
    notes = p_notes,
    updated_at = now()
  WHERE id = p_attendance_id AND status = 'alpha';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'attendance_not_found');
  END IF;
  
  RETURN jsonb_build_object('success', true, 'status', 'verified');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_missing_couriers(
  p_date DATE DEFAULT NULL
)
RETURNS TABLE (
  courier_id UUID,
  courier_name TEXT,
  shift_id UUID,
  shift_name TEXT,
  shift_start_time TIME,
  minutes_late INTEGER,
  severity TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_target_date DATE;
  v_current_time TIMESTAMPTZ;
  v_operational_tz TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin_kurir', 'owner')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;

  SELECT operational_timezone INTO v_operational_tz FROM settings LIMIT 1;
  IF v_operational_tz IS NULL THEN v_operational_tz := 'Asia/Makassar'; END IF;
  
  v_current_time := now() AT TIME ZONE v_operational_tz;
  v_target_date := COALESCE(p_date, (v_current_time AT TIME ZONE v_operational_tz)::DATE);

  RETURN QUERY
  SELECT 
    p.id AS courier_id,
    p.name AS courier_name,
    s.id AS shift_id,
    s.name AS shift_name,
    s.start_time AS shift_start_time,
    EXTRACT(EPOCH FROM (
      v_current_time - 
      (v_target_date || ' ' || s.start_time)::TIMESTAMPTZ AT TIME ZONE v_operational_tz
    ))::INTEGER / 60 AS minutes_late,
    CASE 
      WHEN EXTRACT(EPOCH FROM (
        v_current_time - 
        (v_target_date || ' ' || s.start_time)::TIMESTAMPTZ AT TIME ZONE v_operational_tz
      ))::INTEGER / 60 >= 60 THEN 'critical'
      ELSE 'warning'
    END AS severity
  FROM profiles p
  JOIN shifts s ON s.id = p.shift_id
  LEFT JOIN shift_attendance sa ON sa.courier_id = p.id 
    AND sa.date = v_target_date
  WHERE p.role = 'courier'
    AND p.is_active = true
    AND s.is_active = true
    AND (sa.id IS NULL OR (sa.status = 'late' AND sa.first_online_at IS NULL))
    AND (v_target_date || ' ' || s.start_time)::TIMESTAMPTZ AT TIME ZONE v_operational_tz < v_current_time
  ORDER BY minutes_late DESC;
END;
$$;;
