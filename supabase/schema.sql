-- =========================================
-- KURIRDEV SUPABASE SCHEMA & POLICIES (v1)
-- =========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Profiles Table (Linked to auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  role VARCHAR(50) NOT NULL DEFAULT 'courier' CHECK (role IN ('owner', 'admin_kurir', 'finance', 'courier')),
  is_online BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
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
CREATE TABLE public.customers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  addresses JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Settings Table (Global Configs)
CREATE TABLE public.settings (
  id VARCHAR(50) PRIMARY KEY DEFAULT 'global',
  commission_rate INT NOT NULL DEFAULT 80,
  commission_threshold INT NOT NULL DEFAULT 5000,
  courier_instructions JSONB DEFAULT '[]'::JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create Orders Table
CREATE TABLE public.orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50) NOT NULL,
  customer_address TEXT NOT NULL,
  items JSONB DEFAULT '[]'::JSONB,
  titik INT DEFAULT 1,
  total_biaya_titik INT DEFAULT 0,
  beban JSONB DEFAULT '[]'::JSONB,
  total_biaya_beban INT DEFAULT 0,
  total_fee INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled')),
  payment_status VARCHAR(50) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid')),
  courier_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_waiting BOOLEAN DEFAULT false,
  notes TEXT,
  applied_commission_rate INT,
  applied_commission_threshold INT,
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
CREATE TABLE public.tracking_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
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
    -- If not delivered, we don't have applied commissions yet, but paying early means we just set status to paid.
    -- Usually not the case, but let's handle if it happens (courier didn't gain unpaid yet).
    -- Wait, courier only gets unpaid_amount when DELIVERED.
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
CREATE POLICY "Public profiles are viewable by everyone logged in" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile, Owners/Admins can update anyone" ON profiles
  FOR UPDATE USING (
    auth.uid() = id OR public.get_auth_user_role() IN ('owner', 'admin_kurir')
  );

-- 2. ORDERS POLICIES
CREATE POLICY "Admins, Owners, and Finance can read all orders" ON orders
  FOR SELECT USING (
    public.get_auth_user_role() IN ('owner', 'admin_kurir', 'finance') OR 
    courier_id = auth.uid()
  );

CREATE POLICY "Admins and Owners can insert orders" ON orders
  FOR INSERT WITH CHECK (
    public.get_auth_user_role() IN ('owner', 'admin_kurir')
  );

CREATE POLICY "Admins, Owners update anywhere, Couriers update own orders" ON orders
  FOR UPDATE USING (
    public.get_auth_user_role() IN ('owner', 'admin_kurir') OR
    (public.get_auth_user_role() = 'finance' AND payment_status = 'unpaid') OR
    (courier_id = auth.uid() AND status IN ('assigned', 'picked_up', 'in_transit'))
  );

-- 3. CUSTOMERS POLICIES
CREATE POLICY "Admins and Owners manage customers, Couriers read" ON customers
  FOR ALL USING (auth.role() = 'authenticated'); -- Simplified for quick search

-- 4. SETTINGS POLICIES
CREATE POLICY "Anyone logged in can read settings" ON settings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Only Owners can update settings" ON settings
  FOR UPDATE USING (public.get_auth_user_role() = 'owner');

-- 5. TRACKING LOGS
CREATE POLICY "Logs are readable by auth users" ON tracking_logs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "System inserts logs" ON tracking_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 6. Create Notifications Table
CREATE TABLE public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'info',
  data JSONB DEFAULT '{}'::JSONB,
  is_read BOOLEAN DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid() OR public.get_auth_user_role() IN ('owner', 'admin_kurir'));

CREATE POLICY "System and Admins can insert notifications" ON notifications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());


-- Initial Insert for Settings
INSERT INTO public.settings (id, commission_rate, commission_threshold, courier_instructions) 
VALUES (
  'global', 80, 5000, 
  '[{"id": "1", "icon": "✅", "label": "Barang sudah siap, langsung ambil", "instruction": "Barang sudah siap, langsung ambil!"}, {"id": "2", "icon": "🔍", "label": "Cek dulu ke penjual sebelum ambil", "instruction": "Cek dulu ke penjual sebelum ambil"}, {"id": "3", "icon": "🛒", "label": "Kurir yang pesan di tempat", "instruction": "Kamu yang pesan di tempat"}, {"id": "4", "icon": "📍", "label": "Minta kurir update posisi", "instruction": "Admin minta update posisimu"}, {"id": "5", "icon": "🔍", "label": "Cek kondisi barang saat diterima", "instruction": "Cek kondisi barang saat diterima"}]'::JSONB
) 
ON CONFLICT DO NOTHING;
