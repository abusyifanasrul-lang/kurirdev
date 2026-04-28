-- ============================================================================
-- CLEAN SLATE: Drop all STAY monitoring objects
-- ============================================================================
DROP FUNCTION IF EXISTS public.verify_stay_qr(UUID, TEXT, DECIMAL, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS public.update_stay_counter(UUID, BOOLEAN, FLOAT, FLOAT) CASCADE;
DROP TABLE IF EXISTS public.stay_qr_tokens CASCADE;
DROP TABLE IF EXISTS public.basecamps CASCADE;

-- ============================================================================
-- 1. CREATE TABLE: basecamps
-- ============================================================================
CREATE TABLE public.basecamps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  lat DECIMAL(10,8) NOT NULL,
  lng DECIMAL(11,8) NOT NULL,
  stay_radius_meters INT NOT NULL DEFAULT 15 CHECK (stay_radius_meters BETWEEN 5 AND 100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX idx_basecamps_active ON public.basecamps(is_active) WHERE is_active = true;

-- ============================================================================
-- 2. CREATE TABLE: stay_qr_tokens (CORRECTED SCHEMA)
-- ============================================================================
CREATE TABLE public.stay_qr_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  basecamp_id UUID NOT NULL REFERENCES public.basecamps(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN DEFAULT false,
  used_by_courier_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  CONSTRAINT chk_expires_after_created CHECK (expires_at > created_at)
);
CREATE INDEX idx_stay_qr_tokens_token ON public.stay_qr_tokens(token);
CREATE INDEX idx_stay_qr_tokens_expires ON public.stay_qr_tokens(expires_at) WHERE is_used = false;

-- ============================================================================
-- 3. ALTER TABLE: profiles — add stay monitoring fields
-- ============================================================================
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS stay_zone_counter INT DEFAULT 0 CHECK (stay_zone_counter BETWEEN 0 AND 5),
ADD COLUMN IF NOT EXISTS last_stay_check TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS stay_activated_via_qr BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS current_basecamp_id UUID REFERENCES public.basecamps(id) ON DELETE SET NULL;

-- ============================================================================
-- 4. CREATE RPC: verify_stay_qr
-- ============================================================================
CREATE OR REPLACE FUNCTION public.verify_stay_qr(
  p_courier_id UUID,
  p_qr_token TEXT,
  p_courier_lat DECIMAL(10,8),
  p_courier_lng DECIMAL(11,8)
) RETURNS TABLE(success BOOLEAN, message TEXT, basecamp_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_token_record RECORD;
  v_basecamp RECORD;
  v_distance FLOAT;
  v_radius INT;
  v_courier_role TEXT;
BEGIN
  -- Validate caller is authenticated courier
  IF auth.uid() IS NULL OR auth.uid() != p_courier_id THEN
    RETURN QUERY SELECT false, 'Unauthorized', NULL::UUID;
    RETURN;
  END IF;

  -- Get courier role
  SELECT role INTO v_courier_role FROM public.profiles WHERE id = p_courier_id;
  IF v_courier_role != 'courier' THEN
    RETURN QUERY SELECT false, 'Invalid role', NULL::UUID;
    RETURN;
  END IF;

  -- Lock and fetch token (prevents double-use)
  SELECT * INTO v_token_record
  FROM public.stay_qr_tokens
  WHERE token = p_qr_token
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Token QR tidak ditemukan atau sudah dipakai', NULL::UUID;
    RETURN;
  END IF;

  -- Validate token expiry + usage
  IF v_token_record.is_used OR NOW() > v_token_record.expires_at THEN
    RETURN QUERY SELECT false, 'QR Code kedaluwarsa atau sudah dipakai', NULL::UUID;
    RETURN;
  END IF;

  -- Fetch basecamp config
  SELECT * INTO v_basecamp
  FROM public.basecamps
  WHERE id = v_token_record.basecamp_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Basecamp tidak aktif', NULL::UUID;
    RETURN;
  END IF;

  -- Calculate distance (Haversine formula, meters)
  v_distance := 6371000 * acos(
    cos(radians(p_courier_lat)) * cos(radians(v_basecamp.lat)) *
    cos(radians(v_basecamp.lng) - radians(p_courier_lng)) +
    sin(radians(p_courier_lat)) * sin(radians(v_basecamp.lat))
  );

  -- Validate GPS proximity
  v_radius := v_basecamp.stay_radius_meters;
  IF v_distance > v_radius THEN
    RETURN QUERY SELECT false, 'Anda harus berada dalam radius ' || v_radius || 'm dari basecamp', NULL::UUID;
    RETURN;
  END IF;

  -- Mark token used + update courier profile (atomic)
  UPDATE public.stay_qr_tokens
  SET is_used = true, used_by_courier_id = p_courier_id, used_at = NOW()
  WHERE id = v_token_record.id;

  UPDATE public.profiles
  SET courier_status = 'stay',
      stay_activated_via_qr = true,
      stay_zone_counter = 0,
      last_stay_check = NOW(),
      current_basecamp_id = v_basecamp.id
  WHERE id = p_courier_id;

  -- Return success
  RETURN QUERY SELECT true, 'Status STAY aktif', v_basecamp.id;
END;
$$;

-- ============================================================================
-- 5. CREATE RPC: update_stay_counter
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_stay_counter(
  p_courier_id UUID,
  p_in_zone BOOLEAN,
  p_distance FLOAT,
  p_accuracy FLOAT DEFAULT NULL
) RETURNS TABLE(status_changed BOOLEAN, new_status TEXT, counter INT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_current_status TEXT;
  v_out_count INT;
  v_basecamp_id UUID;
  v_radius INT;
BEGIN
  -- Validate caller
  IF auth.uid() IS NULL OR auth.uid() != p_courier_id THEN
    RETURN QUERY SELECT false, 'stay', 0;
    RETURN;
  END IF;

  -- Fetch current status + basecamp
  SELECT courier_status, current_basecamp_id INTO v_current_status, v_basecamp_id
  FROM public.profiles WHERE id = p_courier_id;

  IF v_current_status != 'stay' THEN
    RETURN QUERY SELECT false, COALESCE(v_current_status, 'off'), 0;
    RETURN;
  END IF;

  -- Get radius from basecamp or fallback
  SELECT COALESCE(b.stay_radius_meters, s.global_stay_radius_meters, 15)
  INTO v_radius
  FROM public.basecamps b
  CROSS JOIN public.settings s
  WHERE b.id = v_basecamp_id;

  -- Accuracy gate: ignore poor GPS readings
  IF p_accuracy IS NOT NULL AND p_accuracy > 15 THEN
    RETURN QUERY SELECT false, 'stay', 0;
    RETURN;
  END IF;

  -- Zone logic
  IF p_in_zone THEN
    UPDATE public.profiles SET stay_zone_counter = 0 WHERE id = p_courier_id;
    RETURN QUERY SELECT false, 'stay', 0;
  ELSE
    UPDATE public.profiles
    SET stay_zone_counter = LEAST(stay_zone_counter + 1, 5),
        last_stay_check = NOW()
    WHERE id = p_courier_id
    RETURNING stay_zone_counter INTO v_out_count;

    IF v_out_count >= 5 THEN
      UPDATE public.profiles
      SET courier_status = 'on',
          stay_zone_counter = 0,
          stay_activated_via_qr = false
      WHERE id = p_courier_id;

      INSERT INTO public.attendance_logs (
        courier_id, event_type, metadata, created_at
      ) VALUES (
        p_courier_id, 'stay_auto_revoked',
        jsonb_build_object('reason', 'left_basecamp', 'distance', p_distance),
        NOW()
      );

      RETURN QUERY SELECT true, 'on', v_out_count;
    ELSE
      RETURN QUERY SELECT false, 'stay', v_out_count;
    END IF;
  END IF;
END;
$$;

-- ============================================================================
-- 6. SEED: Default basecamp
-- ============================================================================
INSERT INTO public.basecamps (id, name, description, lat, lng, stay_radius_meters, is_active)
VALUES (
  gen_random_uuid(),
  'Basecamp Utama - Sengkang',
  'Pangkalan operasional utama KurirDev',
  -4.0667,
  120.0333,
  15,
  true
);

-- ============================================================================
-- 7. RLS POLICIES
-- ============================================================================
ALTER TABLE public.basecamps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "basecamps_select_auth" ON public.basecamps;
CREATE POLICY "basecamps_select_auth" ON public.basecamps FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "basecamps_write_admin" ON public.basecamps;
CREATE POLICY "basecamps_write_admin" ON public.basecamps FOR ALL USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('owner', 'admin_kurir'))
);

ALTER TABLE public.stay_qr_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "qr_tokens_select_auth" ON public.stay_qr_tokens;
CREATE POLICY "qr_tokens_select_auth" ON public.stay_qr_tokens FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "qr_tokens_insert_admin" ON public.stay_qr_tokens;
CREATE POLICY "qr_tokens_insert_admin" ON public.stay_qr_tokens FOR INSERT WITH CHECK (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('owner', 'admin_kurir'))
);
