-- 1. Tambahkan kolom tracking identitas ke tabel orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS payment_confirmed_by UUID REFERENCES auth.users(id);

-- 2. Fungsi RPC atomik untuk menyelesaikan order dan mencatat log tracking
CREATE OR REPLACE FUNCTION complete_order(
  p_order_id UUID,
  p_user_id UUID,
  p_user_name TEXT,
  p_notes TEXT,
  p_commission_rate NUMERIC,
  p_commission_threshold NUMERIC
) RETURNS VOID AS $$
BEGIN
  -- Update order status
  UPDATE orders SET 
    status = 'delivered',
    is_waiting = false,
    applied_commission_rate = p_commission_rate,
    applied_commission_threshold = p_commission_threshold,
    actual_delivery_time = NOW(),
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Insert tracking log
  INSERT INTO tracking_logs (order_id, status, changed_by, changed_by_name, notes)
  VALUES (p_order_id, 'delivered', p_user_id, p_user_name, p_notes);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;;
