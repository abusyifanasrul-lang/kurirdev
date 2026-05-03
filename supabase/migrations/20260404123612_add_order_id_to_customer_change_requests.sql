-- Add order_id to customer_change_requests for context
ALTER TABLE public.customer_change_requests 
ADD COLUMN order_id UUID REFERENCES public.orders(id);

-- Update the RLS policy if needed, though the existing select policy for admin handles it.
COMMENT ON COLUMN public.customer_change_requests.order_id IS 'The order associated with this data change request.';
;
