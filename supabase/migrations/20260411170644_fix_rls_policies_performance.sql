-- =========================================
-- FIX RLS POLICIES — Subquery Optimization
-- Terapkan di Supabase SQL Editor
-- Kunci: (select auth.uid()) bukan auth.uid()
-- Ini mencegah evaluasi fungsi per-baris (N calls → 1 call per query)
-- =========================================

-- ============== PROFILES ==============
DROP POLICY IF EXISTS "Public profiles are viewable by everyone logged in" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile, Owners/Admins can update anyone" ON profiles;

CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING ((select auth.role()) = 'authenticated');

CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (
    (select auth.uid()) = id
    OR (select public.get_auth_user_role()) IN ('owner', 'admin_kurir')
  );

-- ============== ORDERS ==============
DROP POLICY IF EXISTS "Admins, Owners, and Finance can read all orders" ON orders;
DROP POLICY IF EXISTS "Admins and Owners can insert orders" ON orders;
DROP POLICY IF EXISTS "Admins, Owners update anywhere, Couriers update own orders" ON orders;

CREATE POLICY "orders_select" ON orders
  FOR SELECT USING (
    (select public.get_auth_user_role()) IN ('owner', 'admin_kurir', 'finance')
    OR courier_id = (select auth.uid())
  );

CREATE POLICY "orders_insert" ON orders
  FOR INSERT WITH CHECK (
    (select public.get_auth_user_role()) IN ('owner', 'admin_kurir')
  );

CREATE POLICY "orders_update" ON orders
  FOR UPDATE USING (
    (select public.get_auth_user_role()) IN ('owner', 'admin_kurir')
    OR (
      (select public.get_auth_user_role()) = 'finance'
      AND payment_status = 'unpaid'
    )
    OR (
      courier_id = (select auth.uid())
      AND status IN ('assigned', 'picked_up', 'in_transit')
    )
  );

-- ============== CUSTOMERS ==============
DROP POLICY IF EXISTS "Admins and Owners manage customers, Couriers read" ON customers;

CREATE POLICY "customers_all" ON customers
  FOR ALL USING ((select auth.role()) = 'authenticated');

-- ============== SETTINGS ==============
DROP POLICY IF EXISTS "Anyone logged in can read settings" ON settings;
DROP POLICY IF EXISTS "Only Owners can update settings" ON settings;

CREATE POLICY "settings_select" ON settings
  FOR SELECT USING ((select auth.role()) = 'authenticated');

CREATE POLICY "settings_update" ON settings
  FOR UPDATE USING ((select public.get_auth_user_role()) = 'owner');

-- ============== TRACKING LOGS ==============
DROP POLICY IF EXISTS "Logs are readable by auth users" ON tracking_logs;
DROP POLICY IF EXISTS "System inserts logs" ON tracking_logs;

CREATE POLICY "tracking_logs_select" ON tracking_logs
  FOR SELECT USING ((select auth.role()) = 'authenticated');

CREATE POLICY "tracking_logs_insert" ON tracking_logs
  FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');

-- ============== NOTIFICATIONS ==============
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
DROP POLICY IF EXISTS "System and Admins can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;

CREATE POLICY "notifications_select" ON notifications
  FOR SELECT USING (
    user_id = (select auth.uid())
    OR (select public.get_auth_user_role()) IN ('owner', 'admin_kurir')
  );

CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');

CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE USING (user_id = (select auth.uid()));

-- ============== CUSTOMER CHANGE REQUESTS ==============
DROP POLICY IF EXISTS "Anyone logged in can read customer_change_requests" ON customer_change_requests;
DROP POLICY IF EXISTS "Couriers can insert requests" ON customer_change_requests;
DROP POLICY IF EXISTS "Admins and Owners can update requests" ON customer_change_requests;

CREATE POLICY "ccr_select" ON customer_change_requests
  FOR SELECT USING ((select auth.role()) = 'authenticated');

CREATE POLICY "ccr_insert" ON customer_change_requests
  FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');

CREATE POLICY "ccr_update" ON customer_change_requests
  FOR UPDATE USING (
    (select public.get_auth_user_role()) IN ('owner', 'admin_kurir')
  );

-- ============== INDEX RECOMMENDATIONS ==============
CREATE INDEX IF NOT EXISTS idx_orders_courier_id ON orders(courier_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notifications(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
;
