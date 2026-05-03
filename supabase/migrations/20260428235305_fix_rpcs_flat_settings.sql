-- Fix revoke_stay_by_service
CREATE OR REPLACE FUNCTION public.revoke_stay_by_service(p_courier_id uuid, p_secret text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_secret TEXT;
BEGIN
  SELECT service_secret INTO v_secret
  FROM public.settings
  WHERE id = 'global';

  IF p_secret IS DISTINCT FROM v_secret THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  UPDATE public.profiles
  SET courier_status      = 'on',
      current_basecamp_id = NULL,
      stay_zone_counter   = 0
  WHERE id = p_courier_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- Fix verify_stay_qr
CREATE OR REPLACE FUNCTION public.verify_stay_qr(
    p_courier_id uuid,
    p_qr_token text,
    p_courier_lat numeric,
    p_courier_lng numeric
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_basecamp_id UUID;
    v_bc_lat DECIMAL;
    v_bc_lng DECIMAL;
    v_bc_radius INTEGER;
    v_distance FLOAT;
BEGIN
    -- 1. Verify token & get basecamp
    SELECT basecamp_id INTO v_basecamp_id 
    FROM public.stay_qr_tokens 
    WHERE token = p_qr_token AND (expires_at IS NULL OR expires_at > now());

    IF v_basecamp_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Token tidak valid atau kadaluarsa');
    END IF;

    -- 2. Get basecamp location
    SELECT latitude, longitude, radius_meters INTO v_bc_lat, v_bc_lng, v_bc_radius
    FROM public.basecamps WHERE id = v_basecamp_id;

    v_bc_radius := COALESCE(v_bc_radius, 100);

    -- 3. Calculate distance (Haversine)
    v_distance := (6371000 * acos(least(1.0, cos(radians(v_bc_lat)) * cos(radians(p_courier_lat)) * cos(radians(p_courier_lng) - radians(v_bc_lng)) + sin(radians(v_bc_lat)) * sin(radians(p_courier_lat)))));

    IF v_distance > v_bc_radius THEN
        RETURN jsonb_build_object('success', false, 'message', 'Anda terlalu jauh dari basecamp (' || round(v_distance::numeric, 1) || 'm > ' || v_bc_radius || 'm)');
    END IF;

    -- 4. Update profile
    UPDATE public.profiles 
    SET 
        courier_status = 'stay',
        current_basecamp_id = v_basecamp_id,
        stay_zone_counter = 0,
        last_stay_check = now()
    WHERE id = p_courier_id;

    -- 5. Record attendance log
    INSERT INTO public.stay_attendance_logs (courier_id, courier_name, basecamp_id, verified_at)
    SELECT p_courier_id, name, v_basecamp_id, now()
    FROM public.profiles WHERE id = p_courier_id;

    RETURN jsonb_build_object('success', true, 'basecamp_id', v_basecamp_id);
END;
$function$;;
