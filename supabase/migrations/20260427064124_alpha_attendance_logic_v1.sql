-- Function to detect and record Alpha attendance
CREATE OR REPLACE FUNCTION public.check_alpha_attendance()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_shift RECORD;
  v_courier RECORD;
  v_settings RECORD;
  v_shift_start_threshold TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_settings FROM public.settings WHERE id = 'global';
  
  FOR v_shift IN SELECT * FROM public.shifts WHERE is_active = true LOOP
    -- Threshold alfa: 2 jam setelah shift mulai
    v_shift_start_threshold := DATE_TRUNC('day', NOW()) + v_shift.start_time + INTERVAL '2 hours';
    
    -- Handle overnight shift start threshold (if started yesterday)
    IF v_shift.is_overnight AND NOW() < v_shift_start_threshold - INTERVAL '12 hours' THEN
        v_shift_start_threshold := v_shift_start_threshold - INTERVAL '1 day';
    END IF;

    IF NOW() > v_shift_start_threshold THEN
      FOR v_courier IN 
        SELECT p.id, p.shift_id 
        FROM public.profiles p
        WHERE p.role = 'courier' 
        AND p.shift_id = v_shift.id
        AND p.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM public.attendance_logs al 
          WHERE al.courier_id = p.id 
          AND al.created_at >= (v_shift_start_threshold - INTERVAL '2 hours')
        )
      LOOP
        INSERT INTO public.attendance_logs (
          courier_id, shift_id, check_in, status, fine_amount
        ) VALUES (
          v_courier.id, v_courier.shift_id, v_shift_start_threshold, 'alpha', 
          COALESCE(v_settings.fine_alpha_amount, 50000)
        );
        
        INSERT INTO public.courier_warnings (courier_id, warning_type, message)
        VALUES (v_courier.id, 'alpha', 'Anda tercatat Alpha (Tidak Masuk) hari ini. Denda Rp 50.000 telah dikenakan.');
      END LOOP;
    END IF;
  END LOOP;
END;
$$;
;
