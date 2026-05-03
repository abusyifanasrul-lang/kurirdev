DROP FUNCTION IF EXISTS public.verify_stay_qr(uuid,text,numeric,numeric);

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
    v_global_radius INTEGER;
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

    -- 3. Get global radius if needed
    SELECT (value->>'global_stay_radius_meters')::int INTO v_global_radius
    FROM public.settings WHERE id = 'global' LIMIT 1;

    v_bc_radius := COALESCE(v_bc_radius, v_global_radius, 100);

    -- 4. Calculate distance (Haversine)
    v_distance := (6371000 * acos(least(1.0, cos(radians(v_bc_lat)) * cos(radians(p_courier_lat)) * cos(radians(p_courier_lng) - radians(v_bc_lng)) + sin(radians(v_bc_lat)) * sin(radians(p_courier_lat)))));

    IF v_distance > v_bc_radius THEN
        RETURN jsonb_build_object('success', false, 'message', 'Anda terlalu jauh dari basecamp (' || round(v_distance::numeric, 1) || 'm > ' || v_bc_radius || 'm)');
    END IF;

    -- 5. Update profile
    UPDATE public.profiles 
    SET 
        courier_status = 'stay',
        current_basecamp_id = v_basecamp_id,
        stay_zone_counter = 0,
        last_stay_check = now()
    WHERE id = p_courier_id;

    -- 6. Record attendance log
    INSERT INTO public.stay_attendance_logs (courier_id, courier_name, basecamp_id, verified_at)
    SELECT p_courier_id, name, v_basecamp_id, now()
    FROM public.profiles WHERE id = p_courier_id;

    RETURN jsonb_build_object('success', true, 'basecamp_id', v_basecamp_id);
END;
$function$;;
