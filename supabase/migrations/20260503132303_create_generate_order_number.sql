-- RPC: Generate unique order number
-- Format: ORD-YYYYMMDD-XXXX (e.g., ORD-20260503-0001)
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_date_prefix TEXT;
  v_sequence INT;
  v_order_number TEXT;
  v_max_attempts INT := 10;
  v_attempt INT := 0;
BEGIN
  -- Get today's date prefix (YYYYMMDD)
  v_date_prefix := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD');

  -- Loop to find next available number
  LOOP
    v_attempt := v_attempt + 1;
    IF v_attempt > v_max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique order number after % attempts', v_max_attempts;
    END IF;

    -- Get count of orders today + 1
    SELECT COUNT(*) + 1 INTO v_sequence
    FROM orders
    WHERE order_number LIKE v_date_prefix || '%';

    -- Format: ORD-YYYYMMDD-XXXX
    v_order_number := v_date_prefix || '-' || LPAD(v_sequence::TEXT, 4, '0');

    -- Check if this number already exists
    IF NOT EXISTS (SELECT 1 FROM orders WHERE order_number = v_order_number) THEN
      RETURN v_order_number;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.generate_order_number() IS 
  'Generate unique order number with format ORD-YYYYMMDD-XXXX';;
