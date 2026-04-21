-- Migration: New Deduction Logic Support
-- Date: 2026-04-21

-- 1. Update Settings Table
ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS commission_type VARCHAR(50) DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'flat'));

-- 2. Update Orders Table for audit/financial consistency
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS applied_commission_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS applied_admin_fee BIGINT;

-- 3. Update complete_order RPC
-- Explicitly drop old signatures to prevent overloading conflicts
DROP FUNCTION IF EXISTS public.complete_order(uuid, uuid, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.complete_order(uuid, uuid, text, text, integer, integer, text);

-- We replace the function to handle different calculation models
CREATE OR REPLACE FUNCTION public.complete_order(
  p_order_id UUID, 
  p_user_id UUID, 
  p_user_name TEXT, 
  p_notes TEXT,
  p_commission_rate INT, 
  p_commission_threshold INT,
  p_commission_type TEXT DEFAULT 'percentage'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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

  -- 1. Calculate Admin Fee based on type
  IF p_commission_type = 'flat' THEN
    -- Model Nominal Flat: Angka puluhan diikuti (minimal 1rb jika di atas threshold)
    IF v_order.total_fee > p_commission_threshold THEN
      v_admin_fee := GREATEST(1000, FLOOR(v_order.total_fee / 10000) * 1000);
    ELSE
      v_admin_fee := 0;
    END IF;
  ELSE
    -- Model Persentase (Standard 20% model)
    -- Earning settings usually define courier share (e.g. 80%), so admin gets 1-rate
    -- Wait, the old RPC used p_commission_rate as courier share.
    -- v_earning := v_order.total_fee * (p_commission_rate / 100);
    v_admin_fee := v_order.total_fee * (1 - (p_commission_rate::DECIMAL / 100));
    
    -- Threshold check (if total_fee <= threshold, admin gets 0)
    IF (v_order.total_fee <= p_commission_threshold) THEN
      v_admin_fee := 0;
    END IF;
  END IF;

  -- 2. Calculate Courier Net Earning
  v_courier_earning := v_order.total_fee - v_admin_fee;

  -- Add extra components (titik, beban) which always go to courier
  IF v_order.total_biaya_titik + v_order.total_biaya_beban > 0 THEN
      v_courier_earning := v_courier_earning + v_order.total_biaya_titik + v_order.total_biaya_beban;
  END IF;

  -- 3. Update Order Status & Financial Audit
  UPDATE public.orders 
  SET status = 'delivered', 
      is_waiting = false,
      actual_delivery_time = NOW(),
      applied_commission_rate = p_commission_rate,
      applied_commission_threshold = p_commission_threshold,
      applied_commission_type = p_commission_type,
      applied_admin_fee = v_admin_fee
  WHERE id = p_order_id;

  -- 4. Log tracking history
  INSERT INTO public.tracking_logs (order_id, status, changed_by, changed_by_name, notes, changed_at)
  VALUES (p_order_id, 'delivered', p_user_id, p_user_name, p_notes, NOW());

  -- 5. Update Courier Balances Safely
  IF v_order.courier_id IS NOT NULL THEN
    UPDATE public.profiles
    SET total_deliveries_alltime = COALESCE(total_deliveries_alltime, 0) + 1,
        total_earnings_alltime = COALESCE(total_earnings_alltime, 0) + v_courier_earning,
        unpaid_count = COALESCE(unpaid_count, 0) + 1,
        unpaid_amount = COALESCE(unpaid_amount, 0) + v_courier_earning
    WHERE id = v_order.courier_id;
  END IF;

END;
$$;

-- 4. Update mark_order_paid RPC
-- Now uses applied_admin_fee for consistent deduction
CREATE OR REPLACE FUNCTION public.mark_order_paid(
  p_order_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
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
    UPDATE public.orders SET payment_status = 'paid', updated_at = NOW() WHERE id = p_order_id;
    RETURN;
  END IF;

  -- Calculate exactly what the courier earned (Total Fee - Admin Fee + Addons)
  -- Use stored values to prevent inconsistencies if settings changed
  IF v_order.applied_admin_fee IS NOT NULL THEN
    v_courier_payout := (v_order.total_fee - v_order.applied_admin_fee) + COALESCE(v_order.total_biaya_titik, 0) + COALESCE(v_order.total_biaya_beban, 0);
  ELSE
    -- Fallback for legacy orders (Percentage model)
    v_courier_payout := v_order.total_fee * (COALESCE(v_order.applied_commission_rate, 80)::DECIMAL / 100);
    IF (v_courier_payout > COALESCE(v_order.applied_commission_threshold, 5000)) THEN
        v_courier_payout := COALESCE(v_order.applied_commission_threshold, 5000);
    END IF;
    v_courier_payout := v_courier_payout + COALESCE(v_order.total_biaya_titik, 0) + COALESCE(v_order.total_biaya_beban, 0);
  END IF;

  -- Deduct unpaid balances safely
  IF v_order.courier_id IS NOT NULL THEN
    UPDATE public.profiles
    SET unpaid_count = GREATEST(COALESCE(unpaid_count, 0) - 1, 0),
        unpaid_amount = GREATEST(COALESCE(unpaid_amount, 0) - v_courier_payout, 0)
    WHERE id = v_order.courier_id;
  END IF;

  -- Update order
  UPDATE public.orders SET payment_status = 'paid', updated_at = NOW() WHERE id = p_order_id;

END;
$$;
