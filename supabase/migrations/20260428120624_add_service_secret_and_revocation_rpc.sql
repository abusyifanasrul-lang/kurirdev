-- Tambah kolom service secret di settings
ALTER TABLE settings 
  ADD COLUMN IF NOT EXISTS service_secret TEXT DEFAULT gen_random_uuid()::text;

-- Pastikan record global punya secret (jika kolom baru dibuat dan default belum diaplikasikan ke baris eksis)
UPDATE settings SET service_secret = gen_random_uuid()::text WHERE service_secret IS NULL;

-- RPC revoke_stay_by_service
CREATE OR REPLACE FUNCTION revoke_stay_by_service(
  p_courier_id UUID,
  p_secret     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret TEXT;
BEGIN
  SELECT service_secret INTO v_secret
  FROM settings
  WHERE id = 'global';

  IF p_secret IS DISTINCT FROM v_secret THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  UPDATE profiles
  SET courier_status      = 'on',
      stay_basecamp_id    = NULL,
      gps_consecutive_out = 0
  WHERE id = p_courier_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Pastikan anon bisa memanggil RPC ini (SECURITY DEFINER yang protect adalah secret-nya)
GRANT EXECUTE ON FUNCTION revoke_stay_by_service(UUID, TEXT) TO anon, authenticated;;
