-- Migration: Create generate_order_number RPC function
-- Purpose: Generates unique order numbers in format ORD-YYYYMMDD-XXXX
-- Used in: src/stores/useOrderStore.ts (addOrder method)

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_date_part text;
  v_sequence_part text;
  v_order_number text;
  v_count integer;
  v_max_attempts integer := 10;
  v_attempt integer := 0;
BEGIN
  -- Get date part in YYYYMMDD format
  v_date_part := TO_CHAR(NOW(), 'YYYYMMDD');
  
  -- Loop to find unique order number
  LOOP
    v_attempt := v_attempt + 1;
    
    -- Count existing orders for today
    SELECT COUNT(*) INTO v_count
    FROM orders
    WHERE order_number LIKE 'ORD-' || v_date_part || '-%';
    
    -- Generate sequence part (4 digits, zero-padded)
    v_sequence_part := LPAD((v_count + 1)::text, 4, '0');
    
    -- Construct full order number
    v_order_number := 'ORD-' || v_date_part || '-' || v_sequence_part;
    
    -- Check if this number already exists
    SELECT COUNT(*) INTO v_count
    FROM orders
    WHERE order_number = v_order_number;
    
    -- If unique, return it
    IF v_count = 0 THEN
      RETURN v_order_number;
    END IF;
    
    -- Safety check to prevent infinite loop
    IF v_attempt >= v_max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique order number after % attempts', v_max_attempts;
    END IF;
  END LOOP;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION generate_order_number() TO authenticated;

-- Add comment
COMMENT ON FUNCTION generate_order_number IS 'Generates unique order numbers in format ORD-YYYYMMDD-XXXX';
