-- ATOMIC RPC for Completing an Order (Delivered)
CREATE OR REPLACE FUNCTION public.complete_order(
  p_order_id UUID, 
  p_user_id UUID, 
  p_user_name TEXT, 
  p_notes TEXT,
  p_commission_rate INT, 
  p_commission_threshold INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_earning BIGINT;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order tidak ditemukan';
  END IF;

  IF v_order.status = 'delivered' THEN
    RAISE EXCEPTION 'Order sudah diselesaikan sebelumnya';
  END IF;

  -- Calculate Courier Earning
  v_earning := v_order.total_fee * (p_commission_rate::DECIMAL / 100);
  IF (v_earning > p_commission_threshold) THEN
      v_earning := p_commission_threshold;
  END IF;

  IF v_order.total_biaya_titik + v_order.total_biaya_beban > 0 THEN
      v_earning := v_earning + v_order.total_biaya_titik + v_order.total_biaya_beban;
  END IF;

  -- Update Order Status
  UPDATE public.orders 
  SET status = 'delivered', 
      is_waiting = false,
      actual_delivery_time = NOW(),
      applied_commission_rate = p_commission_rate,
      applied_commission_threshold = p_commission_threshold
  WHERE id = p_order_id;

  -- Log tracking history
  INSERT INTO public.tracking_logs (order_id, status, changed_by, changed_by_name, notes, changed_at)
  VALUES (p_order_id, 'delivered', p_user_id, p_user_name, p_notes, NOW());

  -- Update Courier Balances Safely
  IF v_order.courier_id IS NOT NULL THEN
    UPDATE public.profiles
    SET total_deliveries_alltime = COALESCE(total_deliveries_alltime, 0) + 1,
        total_earnings_alltime = COALESCE(total_earnings_alltime, 0) + v_earning,
        unpaid_count = COALESCE(unpaid_count, 0) + 1,
        unpaid_amount = COALESCE(unpaid_amount, 0) + v_earning
    WHERE id = v_order.courier_id;
  END IF;

END;
$$;

-- ATOMIC RPC for Marking Order as Paid
CREATE OR REPLACE FUNCTION public.mark_order_paid(
  p_order_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_earning BIGINT;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order tidak ditemukan';
  END IF;

  IF v_order.payment_status = 'paid' THEN
    RAISE EXCEPTION 'Order sudah lunas';
  END IF;

  IF v_order.status != 'delivered' THEN
    UPDATE public.orders SET payment_status = 'paid', updated_at = NOW() WHERE id = p_order_id;
    RETURN;
  END IF;

  -- Calculate exactly what was given to the courier during complete_order
  v_earning := v_order.total_fee * (COALESCE(v_order.applied_commission_rate, 10)::DECIMAL / 100);
  IF (v_earning > COALESCE(v_order.applied_commission_threshold, 5000)) THEN
      v_earning := COALESCE(v_order.applied_commission_threshold, 5000);
  END IF;

  IF v_order.total_biaya_titik + v_order.total_biaya_beban > 0 THEN
      v_earning := v_earning + v_order.total_biaya_titik + v_order.total_biaya_beban;
  END IF;

  -- Deduct unpaid balances safely
  IF v_order.courier_id IS NOT NULL THEN
    UPDATE public.profiles
    SET unpaid_count = GREATEST(COALESCE(unpaid_count, 0) - 1, 0),
        unpaid_amount = GREATEST(COALESCE(unpaid_amount, 0) - v_earning, 0)
    WHERE id = v_order.courier_id;
  END IF;

  -- Update order
  UPDATE public.orders SET payment_status = 'paid', updated_at = NOW() WHERE id = p_order_id;

END;
$$;;
