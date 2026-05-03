ALTER TABLE public.customer_change_requests 
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS requester_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS change_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS new_address JSONB,
ADD COLUMN IF NOT EXISTS affected_address_id TEXT,
ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.profiles(id);;
