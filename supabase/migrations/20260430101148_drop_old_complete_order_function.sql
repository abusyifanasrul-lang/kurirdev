-- Drop the old function that doesn't have timezone parameters
-- The old function signature (without v_timezone and v_today in DECLARE)
DROP FUNCTION IF EXISTS complete_order(UUID, UUID, TEXT, TEXT, DECIMAL, BIGINT, TEXT);

-- Ensure only the new function exists - recreate it
CREATE OR REPLACE FUNCTION complete_order(
  p_order_id UUID,
  p_user_id UUID,
  p_user_name TEXT,
  p_notes TEXT,
  p_commission_rate DECIMAL,
  p_commission_threshold BIGINT,
  p_commission_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_admin_fee BIGINT;
  v_courier_earning BIGINT;
  v_fine_deducted BIGINT := 0;
  v_timezone TEXT;
  v_today DATE;
BEGIN
  -- Ambil timezone lokal untuk validasi tanggal denda
  SELECT COALESCE(operational_timezone, 'Asia/Makassar') INTO v_timezone
  FROM settings WHERE id = 'global';
  v_today := (NOW() AT TIME ZONE v_timezone)::DATE;

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

  -- ✅ FIX: Cek late_fine_active DAN validasi relevan untuk hari ini
  IF v_order.courier_id IS NOT NULL
    AND (SELECT late_fine_active FROM public.profiles WHERE id = v_order.courier_id)
    AND EXISTS (
      SELECT 1 FROM shift_attendance
      WHERE courier_id = v_order.courier_id
        AND date = v_today
        AND fine_type = 'per_order'
    )
  THEN
    v_fine_deducted := (
      SELECT COALESCE(fine_late_minor_amount, 1000)
      FROM public.settings WHERE id = 'global'
    );
    v_courier_earning := GREATEST(0, v_courier_earning - v_fine_deducted);
  END IF;

  -- Tambahkan biaya titik/beban
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
      applied_admin_fee = v_admin_fee,
      fine_deducted = v_fine_deducted
  WHERE id = p_order_id;

  INSERT INTO public.tracking_logs (order_id, status, changed_by, changed_by_name, notes, changed_at)
  VALUES (p_order_id, 'delivered', p_user_id, p_user_name, p_notes, NOW());

  IF v_order.courier_id IS NOT NULL THEN
    UPDATE public.profiles
    SET total_deliveries_alltime = COALESCE(total_deliveries_alltime, 0) + 1,
        total_earnings_alltime   = COALESCE(total_earnings_alltime, 0) + v_courier_earning,
        unpaid_count             = COALESCE(unpaid_count, 0) + 1,
        unpaid_amount            = COALESCE(unpaid_amount, 0) + v_courier_earning,
        cancel_count             = 0,
        is_priority_recovery     = false
    WHERE id = v_order.courier_id;
  END IF;
END;
$$;;
