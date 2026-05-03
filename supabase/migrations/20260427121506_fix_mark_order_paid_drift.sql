-- Update mark_order_paid to include fine_deducted and admin context
CREATE OR REPLACE FUNCTION public.mark_order_paid(
  p_order_id UUID,
  p_admin_id UUID DEFAULT NULL,
  p_admin_name TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_courier_payout BIGINT;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order tidak ditemukan';
  END IF;

  IF v_order.payment_status = 'paid' THEN
    RAISE EXCEPTION 'Order sudah lunas';
  END IF;

  IF v_order.status != 'delivered' THEN
    UPDATE public.orders SET 
      payment_status = 'paid', 
      payment_confirmed_by = p_admin_id,
      payment_confirmed_by_name = p_admin_name,
      updated_at = NOW() 
    WHERE id = p_order_id;
    RETURN;
  END IF;

  -- Calculate exactly what the courier earned (Total Fee - Admin Fee - Fine Deducted + Addons)
  -- This MUST match the logic in complete_order to prevent unpaid_amount drift
  IF v_order.applied_admin_fee IS NOT NULL THEN
    v_courier_payout := (v_order.total_fee - v_order.applied_admin_fee - COALESCE(v_order.fine_deducted, 0)) 
                        + COALESCE(v_order.total_biaya_titik, 0) 
                        + COALESCE(v_order.total_biaya_beban, 0);
  ELSE
    -- Fallback for legacy orders (Percentage model)
    v_courier_payout := v_order.total_fee * (COALESCE(v_order.applied_commission_rate, 80)::DECIMAL / 100);
    IF (v_courier_payout > COALESCE(v_order.applied_commission_threshold, 5000)) THEN
        v_courier_payout := COALESCE(v_order.applied_commission_threshold, 5000);
    END IF;
    -- Note: fine_deducted was not present in legacy, so we ignore it here
    v_courier_payout := v_courier_payout + COALESCE(v_order.total_biaya_titik, 0) + COALESCE(v_order.total_biaya_beban, 0);
  END IF;

  -- Deduct unpaid balances safely
  IF v_order.courier_id IS NOT NULL THEN
    UPDATE public.profiles
    SET unpaid_count = GREATEST(COALESCE(unpaid_count, 0) - 1, 0),
        unpaid_amount = GREATEST(COALESCE(unpaid_amount, 0) - v_courier_payout, 0)
    WHERE id = v_order.courier_id;
  END IF;

  -- Update order with admin context
  UPDATE public.orders SET 
    payment_status = 'paid', 
    payment_confirmed_by = p_admin_id,
    payment_confirmed_by_name = p_admin_name,
    updated_at = NOW() 
  WHERE id = p_order_id;

END;
$$;;
