-- Migration: Fix global_stay_radius_meters reference
-- Date: 2026-04-29
-- Purpose: Add missing column and fix function reference

-- Step 1: Add stay_radius_meters column to settings table
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS stay_radius_meters INT DEFAULT 15 CHECK (stay_radius_meters BETWEEN 5 AND 100);

COMMENT ON COLUMN public.settings.stay_radius_meters IS 
  'Global default radius (in meters) for stay monitoring. Used as fallback when basecamp.stay_radius_meters is not set.';

-- Step 2: Fix update_stay_counter() function (Function 2 - returns TABLE)
-- Note: There are 2 overloaded functions with name update_stay_counter
-- Function 1 (returns jsonb) does NOT reference global_stay_radius_meters - no fix needed
-- Function 2 (returns TABLE) references s.global_stay_radius_meters - FIXED below

DROP FUNCTION IF EXISTS public.update_stay_counter(UUID, BOOLEAN, DOUBLE PRECISION, DOUBLE PRECISION);

CREATE OR REPLACE FUNCTION public.update_stay_counter(
  p_courier_id UUID,
  p_in_zone BOOLEAN,
  p_distance DOUBLE PRECISION,
  p_accuracy DOUBLE PRECISION
)
RETURNS TABLE(should_exit BOOLEAN, new_status TEXT, counter INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status TEXT;
  v_out_count INT;
  v_basecamp_id UUID;
  v_radius INT;
BEGIN
  -- Validate caller
  IF auth.uid() IS NULL OR auth.uid() != p_courier_id THEN
    RETURN QUERY SELECT false, 'stay'::TEXT, 0;
    RETURN;
  END IF;

  -- Fetch current status + basecamp
  SELECT courier_status, stay_basecamp_id INTO v_current_status, v_basecamp_id
  FROM public.profiles WHERE id = p_courier_id;

  IF v_current_status != 'stay' THEN
    RETURN QUERY SELECT false, COALESCE(v_current_status, 'off')::TEXT, 0;
    RETURN;
  END IF;

  -- Get radius from basecamp or fallback (FIXED: use s.stay_radius_meters)
  SELECT COALESCE(b.stay_radius_meters, s.stay_radius_meters, 15)
  INTO v_radius
  FROM public.basecamps b
  CROSS JOIN public.settings s
  WHERE b.id = v_basecamp_id;

  -- Accuracy gate: ignore poor GPS readings
  IF p_accuracy IS NOT NULL AND p_accuracy > 15 THEN
    RETURN QUERY SELECT false, 'stay'::TEXT, 0;
    RETURN;
  END IF;

  -- Zone logic
  IF p_in_zone THEN
    UPDATE public.profiles SET stay_zone_counter = 0 WHERE id = p_courier_id;
    RETURN QUERY SELECT false, 'stay'::TEXT, 0;
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

      RETURN QUERY SELECT true, 'on'::TEXT, v_out_count;
    ELSE
      RETURN QUERY SELECT false, 'stay'::TEXT, v_out_count;
    END IF;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.update_stay_counter(UUID, BOOLEAN, DOUBLE PRECISION, DOUBLE PRECISION) IS 
  'Monitors courier stay zone. Fixed to reference settings.stay_radius_meters instead of non-existent global_stay_radius_meters.';
