-- Add missing item fields to orders table to match Firebase source
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS item_name TEXT,
ADD COLUMN IF NOT EXISTS item_price INTEGER;

-- Comment for documentation
COMMENT ON COLUMN orders.item_name IS 'Legacy field for single item name compatibility';
COMMENT ON COLUMN orders.item_price IS 'Legacy field for single item price compatibility';
;
