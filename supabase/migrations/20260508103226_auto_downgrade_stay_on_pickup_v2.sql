-- Migration: Auto-downgrade STAY to ON when courier picks up order (v2)
-- Date: 2026-05-08
-- Purpose: Prevent illogical state of STAY + running order

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS trigger_auto_downgrade_stay_on_pickup ON orders;
DROP FUNCTION IF EXISTS auto_downgrade_stay_on_pickup();

-- Function: Auto-downgrade STAY → ON when order is picked up
CREATE OR REPLACE FUNCTION auto_downgrade_stay_on_pickup()
RETURNS TRIGGER AS $$
BEGIN
  -- Jika order baru di-pick up atau in_transit
  IF NEW.status IN ('picked_up', 'in_transit') 
     AND OLD.status NOT IN ('picked_up', 'in_transit') THEN
    
    -- Cek apakah kurir sedang STAY
    UPDATE profiles
    SET courier_status = 'on'
    WHERE id = NEW.courier_id
      AND courier_status = 'stay';
    
    -- Log untuk audit (jika ada perubahan)
    IF FOUND THEN
      INSERT INTO tier_change_log (
        courier_id,
        trigger_source,
        queue_joined_at_before,
        queue_joined_at_after,
        context,
        happened_at
      )
      SELECT 
        NEW.courier_id,
        'auto_downgrade_stay_on_pickup',
        queue_joined_at,
        queue_joined_at,
        jsonb_build_object(
          'order_id', NEW.id,
          'order_status', NEW.status,
          'reason', 'STAY courier picked up order - auto downgrade to ON'
        ),
        NOW()
      FROM profiles
      WHERE id = NEW.courier_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Execute after order status update
CREATE TRIGGER trigger_auto_downgrade_stay_on_pickup
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.status IN ('picked_up', 'in_transit') 
        AND OLD.status NOT IN ('picked_up', 'in_transit'))
  EXECUTE FUNCTION auto_downgrade_stay_on_pickup();

-- Add documentation comment
COMMENT ON FUNCTION auto_downgrade_stay_on_pickup() IS 
  'Defense Layer 2: Auto-downgrade courier status from STAY to ON when they pick up an order. '
  'This prevents the illogical state of STAY + running order. '
  'Part of the 3-layer defense-in-depth strategy for STAY validation.';;
