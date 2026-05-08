CREATE OR REPLACE FUNCTION public.revoke_stay_by_service(p_courier_id uuid, p_secret text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_secret TEXT;
BEGIN
  -- Verify service secret
  SELECT service_secret INTO v_secret
  FROM public.settings
  WHERE id = 'global';

  IF p_secret IS DISTINCT FROM v_secret THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Revoke STAY status and reset GPS counter
  -- FIXED: current_basecamp_id → stay_basecamp_id
  -- FIXED: stay_zone_counter → gps_consecutive_out
  UPDATE public.profiles
  SET courier_status      = 'on',
      stay_basecamp_id    = NULL,
      gps_consecutive_out = 0,
      stay_activated_via_qr = false
  WHERE id = p_courier_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;;
