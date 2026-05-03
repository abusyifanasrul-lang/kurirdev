-- =========================================
-- KURIRDEV SUPABASE SCHEMA & POLICIES (v1)
-- =========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Profiles Table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  role VARCHAR(50) NOT NULL DEFAULT 'courier' CHECK (role IN ('admin', 'owner', 'admin_kurir', 'finance', 'courier')),
  is_online BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  courier_status VARCHAR(50) CHECK (courier_status IN ('on', 'stay', 'off')),
  off_reason TEXT,
  vehicle_type VARCHAR(50) CHECK (vehicle_type IN ('motorcycle', 'car', 'bicycle', 'van')),
  plate_number VARCHAR(50),
  queue_position BIGINT,
  fcm_token VARCHAR(255),
  fcm_token_updated_at TIMESTAMP WITH TIME ZONE,
  total_deliveries_alltime INT DEFAULT 0,
  total_earnings_alltime BIGINT DEFAULT 0,
  unpaid_count INT DEFAULT 0,
  unpaid_amount BIGINT DEFAULT 0,
  platform VARCHAR(50),
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  addresses JSONB DEFAULT '[]'::JSONB,
  order_count INT DEFAULT 0,
  last_order_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Settings Table (Global Configs)
CREATE TABLE IF NOT EXISTS public.settings (
  id VARCHAR(50) PRIMARY KEY DEFAULT 'global',
  commission_rate INT NOT NULL DEFAULT 80,
  commission_threshold INT NOT NULL DEFAULT 5000,
  courier_instructions JSONB DEFAULT '[]'::JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50) NOT NULL,
  customer_address TEXT NOT NULL,
  customer_address_id TEXT,
  items JSONB DEFAULT '[]'::JSONB,
  titik INT DEFAULT 1,
  total_biaya_titik INT DEFAULT 0,
  beban JSONB DEFAULT '[]'::JSONB,
  total_biaya_beban INT DEFAULT 0,
  total_fee INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled')),
  payment_status VARCHAR(50) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid')),
  courier_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_waiting BOOLEAN DEFAULT false,
  notes TEXT,
  applied_commission_rate INT,
  applied_commission_threshold INT,
  estimated_delivery_time TIMESTAMP WITH TIME ZONE,
  actual_pickup_time TIMESTAMP WITH TIME ZONE,
  actual_delivery_time TIMESTAMP WITH TIME ZONE,
  assigned_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  cancel_reason_type VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create Tracking Logs Table
CREATE TABLE IF NOT EXISTS public.tracking_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_by_name VARCHAR(255),
  notes TEXT,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- =========================================
-- DATABASE FUNCTIONS & TRIGGERS
-- =========================================

-- Trigger to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_modtime BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_modtime BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_modtime BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_modtime BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to securely fetch user role without recursive RLS locks
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- ATOMIC RPC for Completing an Order (Delivered)
-- Cleanup for both VARCHAR and TEXT versions to prevent overloading
DROP FUNCTION IF EXISTS public.complete_order(uuid, uuid, character varying, text, integer, integer);
DROP FUNCTION IF EXISTS public.complete_order(uuid, uuid, text, text, integer, integer);

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
$$;


-- =========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_logs ENABLE ROW LEVEL SECURITY;

-- 1. PROFILES POLICIES
DROP POLICY IF EXISTS "Public profiles are viewable by everyone logged in" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone logged in" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile, Owners/Admins can update anyone" ON profiles;
CREATE POLICY "Users can update own profile, Owners/Admins can update anyone" ON profiles
  FOR UPDATE USING (
    auth.uid() = id OR public.get_auth_user_role() IN ('owner', 'admin_kurir')
  );

-- 2. ORDERS POLICIES
DROP POLICY IF EXISTS "Admins, Owners, and Finance can read all orders" ON orders;
CREATE POLICY "Admins, Owners, and Finance can read all orders" ON orders
  FOR SELECT USING (
    public.get_auth_user_role() IN ('owner', 'admin_kurir', 'finance') OR 
    courier_id = auth.uid()
  );

DROP POLICY IF EXISTS "Admins and Owners can insert orders" ON orders;
CREATE POLICY "Admins and Owners can insert orders" ON orders
  FOR INSERT WITH CHECK (
    public.get_auth_user_role() IN ('owner', 'admin_kurir')
  );

DROP POLICY IF EXISTS "Admins, Owners update anywhere, Couriers update own orders" ON orders;
CREATE POLICY "Admins, Owners update anywhere, Couriers update own orders" ON orders
  FOR UPDATE USING (
    public.get_auth_user_role() IN ('owner', 'admin_kurir') OR
    (public.get_auth_user_role() = 'finance' AND payment_status = 'unpaid') OR
    (courier_id = auth.uid() AND status IN ('assigned', 'picked_up', 'in_transit'))
  );

-- 3. CUSTOMERS POLICIES
DROP POLICY IF EXISTS "Admins and Owners manage customers, Couriers read" ON customers;
CREATE POLICY "Admins and Owners manage customers, Couriers read" ON customers
  FOR ALL USING (auth.role() = 'authenticated');

-- 4. SETTINGS POLICIES
DROP POLICY IF EXISTS "Anyone logged in can read settings" ON settings;
CREATE POLICY "Anyone logged in can read settings" ON settings
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Only Owners can update settings" ON settings;
CREATE POLICY "Only Owners can update settings" ON settings
  FOR UPDATE USING (public.get_auth_user_role() = 'owner');

-- 5. TRACKING LOGS
DROP POLICY IF EXISTS "Logs are readable by auth users" ON tracking_logs;
CREATE POLICY "Logs are readable by auth users" ON tracking_logs
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "System inserts logs" ON tracking_logs;
CREATE POLICY "System inserts logs" ON tracking_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 6. Create Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'info',
  data JSONB DEFAULT '{}'::JSONB,
  is_read BOOLEAN DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid() OR public.get_auth_user_role() IN ('owner', 'admin_kurir'));

DROP POLICY IF EXISTS "System and Admins can insert notifications" ON notifications;
CREATE POLICY "System and Admins can insert notifications" ON notifications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- 7. Create Customer Change Requests Table
CREATE TABLE IF NOT EXISTS public.customer_change_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  customer_name VARCHAR(255),
  requester_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  requester_name VARCHAR(255),
  change_type VARCHAR(50),
  old_data JSONB DEFAULT '{}'::JSONB,
  requested_data JSONB DEFAULT '{}'::JSONB,
  new_address JSONB,
  affected_address_id TEXT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_notes TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.customer_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone logged in can read customer_change_requests" ON customer_change_requests;
CREATE POLICY "Anyone logged in can read customer_change_requests" ON customer_change_requests
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Couriers can insert requests" ON customer_change_requests;
CREATE POLICY "Couriers can insert requests" ON customer_change_requests
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins and Owners can update requests" ON customer_change_requests;
CREATE POLICY "Admins and Owners can update requests" ON customer_change_requests
  FOR UPDATE USING (public.get_auth_user_role() IN ('owner', 'admin_kurir'));

-- Initial Insert for Settings
INSERT INTO public.settings (id, commission_rate, commission_threshold, courier_instructions) 
VALUES (
  'global', 80, 5000, 
  '[{"id": "1", "icon": "✅", "label": "Barang sudah siap, langsung ambil", "instruction": "Barang sudah siap, langsung ambil!"}, {"id": "2", "icon": "🔍", "label": "Cek dulu ke penjual sebelum ambil", "instruction": "Cek dulu ke penjual sebelum ambil"}, {"id": "3", "icon": "🛒", "label": "Kurir yang pesan di tempat", "instruction": "Kamu yang pesan di tempat"}, {"id": "4", "icon": "📍", "label": "Minta kurir update posisi", "instruction": "Admin minta update posisimu"}, {"id": "5", "icon": "🔍", "label": "Cek kondisi barang saat diterima", "instruction": "Cek kondisi barang saat diterima"}]'::JSONB
) 
ON CONFLICT DO NOTHING;

-- Grant necessary permissions to service_role to ensure Edge Functions can operate
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
