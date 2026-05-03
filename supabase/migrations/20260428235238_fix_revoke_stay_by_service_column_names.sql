CREATE OR REPLACE FUNCTION public.revoke_stay_by_service(p_courier_id uuid, p_secret text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_secret TEXT;
BEGIN
  SELECT (value->>'service_secret') INTO v_secret
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
$function$;;
