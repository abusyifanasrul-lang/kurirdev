-- Fix basecamps.stay_radius_meters → radius_m
-- The previous migration (20260503134902) was marked as applied but the column rename didn't take effect
-- This migration ensures the column name matches what the code expects

ALTER TABLE public.basecamps 
RENAME COLUMN stay_radius_meters TO radius_m;

COMMENT ON COLUMN public.basecamps.radius_m IS 'STAY zone radius in meters (5-100m range)';;
