-- 7. Create Customer Change Requests Table
CREATE TABLE IF NOT EXISTS public.customer_change_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  requester_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  old_data JSONB NOT NULL,
  requested_data JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.customer_change_requests ENABLE ROW LEVEL SECURITY;

-- Change Request Policies
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Everyone can read requests" ON public.customer_change_requests;
    CREATE POLICY "Everyone can read requests" ON public.customer_change_requests
      FOR SELECT USING (auth.role() = 'authenticated');

    DROP POLICY IF EXISTS "Couriers can insert requests" ON public.customer_change_requests;
    CREATE POLICY "Couriers can insert requests" ON public.customer_change_requests
      FOR INSERT WITH CHECK (auth.role() = 'authenticated');

    DROP POLICY IF EXISTS "Only admins can update requests" ON public.customer_change_requests;
    CREATE POLICY "Only admins can update requests" ON public.customer_change_requests
      FOR UPDATE USING (public.get_auth_user_role() IN ('owner', 'admin_kurir', 'admin'));
END $$;

-- Update Customers RLS (Harden it)
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Admins and Owners manage customers, Couriers read" ON public.customers;
    DROP POLICY IF EXISTS "Everyone can read customers" ON public.customers;
    DROP POLICY IF EXISTS "Only admins/owners can insert/update/delete customers" ON public.customers;

    CREATE POLICY "Everyone can read customers" ON public.customers
      FOR SELECT USING (auth.role() = 'authenticated');

    CREATE POLICY "Only admins/owners can insert/update/delete customers" ON public.customers
      FOR ALL USING (public.get_auth_user_role() IN ('owner', 'admin_kurir', 'admin'));
END $$;

-- Trigger for customer_change_requests updated_at
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_customer_change_requests_modtime') THEN
        CREATE TRIGGER update_customer_change_requests_modtime 
        BEFORE UPDATE ON public.customer_change_requests 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
;
