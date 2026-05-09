-- Bug 2 Fix: Rename mark_order_paid to settle_order for naming consistency
-- 
-- Problem: Function is named mark_order_paid in database but settleOrder in frontend
-- Solution: Rename to settle_order for consistency across codebase
--
-- This migration:
-- 1. Creates settle_order functions with same logic as mark_order_paid
-- 2. Drops old mark_order_paid functions
-- 3. Preserves all existing behavior (settlement logic unchanged)

-- ========================================
-- Create settle_order (single parameter version)
-- ========================================

CREATE OR REPLACE FUNCTION public.settle_order(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

-- ========================================
-- Create settle_order (three parameter version with admin tracking)
-- ========================================

CREATE OR REPLACE FUNCTION public.settle_order(p_order_id uuid, p_admin_id uuid DEFAULT NULL::uuid, p_admin_name text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

-- ========================================
-- Drop old mark_order_paid functions
-- ========================================

DROP FUNCTION IF EXISTS public.mark_order_paid(uuid);
DROP FUNCTION IF EXISTS public.mark_order_paid(uuid, uuid, text);

-- ========================================
-- Verification
-- ========================================

-- Verify settle_order exists
DO $$
DECLARE
  v_function_count INT;
BEGIN
  SELECT COUNT(*) INTO v_function_count
  FROM pg_proc
  WHERE proname = 'settle_order'
  AND pronamespace = 'public'::regnamespace;
  
  IF v_function_count != 2 THEN
    RAISE EXCEPTION 'Expected 2 settle_order functions, found %', v_function_count;
  END IF;
  
  RAISE NOTICE 'Migration successful: settle_order functions created (% overloads)', v_function_count;
END $$;

-- Verify mark_order_paid is gone
DO $$
DECLARE
  v_function_count INT;
BEGIN
  SELECT COUNT(*) INTO v_function_count
  FROM pg_proc
  WHERE proname = 'mark_order_paid'
  AND pronamespace = 'public'::regnamespace;
  
  IF v_function_count != 0 THEN
    RAISE EXCEPTION 'mark_order_paid functions still exist (% found)', v_function_count;
  END IF;
  
  RAISE NOTICE 'Migration successful: mark_order_paid functions removed';
END $$;
