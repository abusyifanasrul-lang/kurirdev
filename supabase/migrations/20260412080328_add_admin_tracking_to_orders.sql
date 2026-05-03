ALTER TABLE public.orders 
ADD COLUMN assigned_by UUID REFERENCES public.profiles(id),
ADD COLUMN payment_confirmed_by UUID REFERENCES public.profiles(id),
ADD COLUMN cancelled_by UUID REFERENCES public.profiles(id);

COMMENT ON COLUMN public.orders.assigned_by IS 'The admin/staff who assigned the courier to this order.';
COMMENT ON COLUMN public.orders.payment_confirmed_by IS 'The finance staff who confirmed the deposit/payment for this order.';
COMMENT ON COLUMN public.orders.cancelled_by IS 'The staff who cancelled this order.';;
