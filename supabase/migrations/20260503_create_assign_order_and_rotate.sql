-- Migration: Create assign_order_and_rotate RPC function
-- Purpose: Assigns order to courier and rotates queue in one atomic transaction
-- Used in: Order assignment workflow

CREATE OR REPLACE FUNCTION assign_order_and_rotate(
  p_order_id uuid,
  p_courier_id uuid,
  p_assigned_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_queue_position integer;
BEGIN
  -- Start transaction (implicit in function)
  
  -- 1. Assign the order to the courier
  UPDATE orders
  SET 
    courier_id = p_courier_id,
    assigned_by = p_assigned_by,
    assigned_at = NOW(),
    status = 'assigned',
    updated_at = NOW()
  WHERE id = p_order_id;
  
  -- Check if order was updated
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;
  
  -- 2. Get current queue position before rotation
  SELECT queue_position INTO v_queue_position
  FROM courier_queue
  WHERE courier_id = p_courier_id;
  
  -- 3. Rotate the courier queue (move assigned courier to end)
  -- This is done by calling the existing rotate_courier_queue function
  PERFORM rotate_courier_queue(p_courier_id);
  
  -- 4. Log to courier_queue_history
  INSERT INTO courier_queue_history (
    courier_id,
    action,
    old_position,
    new_position,
    order_id,
    created_at
  )
  VALUES (
    p_courier_id,
    'assigned_and_rotated',
    v_queue_position,
    (SELECT queue_position FROM courier_queue WHERE courier_id = p_courier_id),
    p_order_id,
    NOW()
  );
  
  -- 5. Return success result
  v_result := jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'courier_id', p_courier_id,
    'old_position', v_queue_position,
    'new_position', (SELECT queue_position FROM courier_queue WHERE courier_id = p_courier_id)
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Return error result
    v_result := jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
    RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION assign_order_and_rotate(uuid, uuid, uuid) TO authenticated;

-- Add comment
COMMENT ON FUNCTION assign_order_and_rotate IS 'Assigns order to courier and rotates queue in one atomic transaction';
