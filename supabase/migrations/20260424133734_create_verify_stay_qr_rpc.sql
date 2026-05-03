
CREATE OR REPLACE FUNCTION public.verify_stay_qr(
    p_token TEXT,
    p_courier_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token_record RECORD;
    v_courier_name TEXT;
BEGIN
    -- 1. Find valid, unused, non-expired token (row lock to prevent race condition)
    SELECT * INTO v_token_record
    FROM stay_qr_tokens
    WHERE token = p_token
      AND is_used = false
      AND expires_at > now()
    FOR UPDATE;

    -- 2. Token not found or expired
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'QR Code tidak valid atau sudah kedaluwarsa. Minta admin generate QR baru.'
        );
    END IF;

    -- 3. Verify the user is an active courier
    SELECT name INTO v_courier_name
    FROM profiles
    WHERE id = p_courier_id
      AND role = 'courier'
      AND is_active = true;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Akun kurir tidak valid atau tidak aktif.'
        );
    END IF;

    -- 4. Mark token as used (atomic)
    UPDATE stay_qr_tokens
    SET is_used = true,
        used_by = p_courier_id,
        used_at = now()
    WHERE id = v_token_record.id;

    -- 5. Update courier status to 'stay'
    UPDATE profiles
    SET courier_status = 'stay',
        is_online = true,
        off_reason = ''
    WHERE id = p_courier_id;

    -- 6. Insert attendance log
    INSERT INTO stay_attendance_logs (courier_id, courier_name, token_id, verified_at)
    VALUES (p_courier_id, v_courier_name, v_token_record.id, now());

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Verifikasi berhasil! Status STAY aktif.',
        'courier_name', v_courier_name
    );
END;
$$;
;
