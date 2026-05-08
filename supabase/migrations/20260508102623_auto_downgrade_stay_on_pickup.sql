-- Auto-downgrade STAY to ON when order is picked up
CREATE OR REPLACE FUNCTION auto_downgrade_stay_on_pickup()
RETURNS TRIGGER AS $$
BEGIN
  -- When order status changes to picked_up or in_transit
  IF NEW.status IN ('picked_up', 'in_transit') AND 
     OLD.status NOT IN ('picked_up', 'in_transit') AND
     NEW.courier_id IS NOT NULL THEN
    
    -- Check if courier is currently STAY
    UPDATE profiles
    SET courier_status = 'on'
    WHERE id = NEW.courier_id
      AND courier_status = 'stay'
      AND role = 'courier';
    
    -- Log the auto-downgrade for audit
    IF FOUND THEN
      RAISE NOTICE 'Auto-downgraded courier % from STAY to ON (order % picked up)', NEW.courier_id, NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_auto_downgrade_stay_on_pickup ON orders;

-- Create trigger
CREATE TRIGGER trigger_auto_downgrade_stay_on_pickup
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.status IN ('picked_up', 'in_transit') AND OLD.status NOT IN ('picked_up', 'in_transit'))
  EXECUTE FUNCTION auto_downgrade_stay_on_pickup();;
