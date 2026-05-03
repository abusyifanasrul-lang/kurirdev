-- Migration: Fix column names and add missing columns
-- Date: 2026-05-03
-- Purpose: Align database schema with technical documentation
-- Reference: temp/Database_Verification_Report.md

-- ============================================================================
-- CRITICAL FIX 1: Rename basecamps.stay_radius_meters → radius_m
-- ============================================================================
-- Section 7.3 & Design Constraint #9: Column MUST be named 'radius_m'
ALTER TABLE basecamps 
RENAME COLUMN stay_radius_meters TO radius_m;

COMMENT ON COLUMN basecamps.radius_m IS 'STAY zone radius in meters (5-100m range)';

-- ============================================================================
-- CRITICAL FIX 2: Rename profiles.current_basecamp_id → stay_basecamp_id
-- ============================================================================
-- Section 2.3 & 8.1: GPS STAY basecamp reference
ALTER TABLE profiles 
RENAME COLUMN current_basecamp_id TO stay_basecamp_id;

COMMENT ON COLUMN profiles.stay_basecamp_id IS 'Current basecamp when courier is in STAY status';

-- ============================================================================
-- CRITICAL FIX 3: Rename profiles.stay_zone_counter → gps_consecutive_out
-- ============================================================================
-- Section 2.3 & 8.1: GPS consecutive out-of-zone counter
ALTER TABLE profiles 
RENAME COLUMN stay_zone_counter TO gps_consecutive_out;

COMMENT ON COLUMN profiles.gps_consecutive_out IS 'Consecutive GPS readings outside STAY zone (0-5, revoke at 5)';

-- ============================================================================
-- CRITICAL FIX 4: Add settings.operational_timezone column
-- ============================================================================
-- Section 4.2 & 8.3: Timezone for all time calculations
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS operational_timezone TEXT DEFAULT 'Asia/Jakarta';

-- Set to Asia/Makassar for this project (Sengkang, Wajo location)
UPDATE settings 
SET operational_timezone = 'Asia/Makassar' 
WHERE id = 'global' AND operational_timezone IS NULL;

COMMENT ON COLUMN settings.operational_timezone IS 'Operational timezone for all time calculations (used by RPC functions)';

-- ============================================================================
-- CRITICAL FIX 5: Add profiles.day_off column
-- ============================================================================
-- Section 8.1: Regular day off for couriers (used by get_missing_couriers)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS day_off TEXT;

COMMENT ON COLUMN profiles.day_off IS 'Regular day off (format: Monday, Tuesday, Wednesday, etc.) - used to exclude from attendance checks';

-- ============================================================================
-- OPTIONAL CLEANUP: Drop old verify_stay_qr function signature
-- ============================================================================
-- Section 7.4: Correct signature is (p_token TEXT, p_courier_id UUID)
-- Old signature with lat/lng parameters is deprecated
DROP FUNCTION IF EXISTS verify_stay_qr(uuid, text, numeric, numeric);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify the migration succeeded:

-- 1. Check basecamps columns
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'basecamps' AND column_name IN ('radius_m', 'stay_radius_meters');

-- 2. Check profiles columns
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'profiles' AND column_name IN ('stay_basecamp_id', 'gps_consecutive_out', 'day_off', 'current_basecamp_id', 'stay_zone_counter');

-- 3. Check settings columns
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'settings' AND column_name = 'operational_timezone';

-- 4. Check verify_stay_qr function signatures
-- SELECT proname, pg_get_function_arguments(oid) as arguments 
-- FROM pg_proc 
-- WHERE proname = 'verify_stay_qr' AND pronamespace = 'public'::regnamespace;
