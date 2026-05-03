CREATE OR REPLACE FUNCTION public.complete_order(
    p_order_id UUID,
    p_user_id UUID,
    p_user_name TEXT,
    p_commission_rate INTEGER,
    p_commission_threshold INTEGER,
    p_commission_type TEXT DEFAULT 'percent',
    p_notes TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_order RECORD;
  v_admin_fee BIGINT;
  v_courier_earning BIGINT;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order tidak ditemukan';
  END IF;

  IF v_order.status = 'delivered' THEN
    RAISE EXCEPTION 'Order sudah diselesaikan sebelumnya';
  END IF;

  -- Hitung Potongan Admin
  IF p_commission_type = 'flat' THEN
    IF v_order.total_fee > p_commission_threshold THEN
      v_admin_fee := GREATEST(1000, FLOOR(v_order.total_fee / 10000) * 1000);
    ELSE
      v_admin_fee := 0;
    END IF;
  ELSE
    v_admin_fee := v_order.total_fee * (1 - (p_commission_rate::DECIMAL / 100));
    IF (v_order.total_fee <= p_commission_threshold) THEN
      v_admin_fee := 0;
    END IF;
  END IF;

  v_courier_earning := v_order.total_fee - v_admin_fee;

  IF v_order.total_biaya_titik + v_order.total_biaya_beban > 0 THEN
      v_courier_earning := v_courier_earning + v_order.total_biaya_titik + v_order.total_biaya_beban;
  END IF;

  UPDATE public.orders 
  SET status = 'delivered', 
      is_waiting = false,
      actual_delivery_time = NOW(),
      applied_commission_rate = p_commission_rate,
      applied_commission_threshold = p_commission_threshold,
      applied_commission_type = p_commission_type,
      applied_admin_fee = v_admin_fee
  WHERE id = p_order_id;

  INSERT INTO public.tracking_logs (order_id, status, changed_by, changed_by_name, notes, changed_at)
  VALUES (p_order_id, 'delivered', p_user_id, p_user_name, p_notes, NOW());

  IF v_order.courier_id IS NOT NULL THEN
    UPDATE public.profiles
    SET total_deliveries_alltime = COALESCE(total_deliveries_alltime, 0) + 1,
        total_earnings_alltime = COALESCE(total_earnings_alltime, 0) + v_courier_earning,
        unpaid_count = COALESCE(unpaid_count, 0) + 1,
        unpaid_amount = COALESCE(unpaid_amount, 0) + v_courier_earning,
        cancel_count = 0, -- Reset cancel count upon successful delivery
        is_priority_recovery = false -- Also reset priority recovery if they had it
    WHERE id = v_order.courier_id;
  END IF;
END;
$$ LANGUAGE plpgsql;;
