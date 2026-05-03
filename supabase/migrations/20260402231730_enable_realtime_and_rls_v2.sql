-- 1. Enable Realtime Replication for critical tables
-- Check if the publication 'supabase_realtime' exists, then add tables to it.
-- We use DO block for safe re-execution.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Add tables to the publication (ignore if already added)
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE customers;
ALTER PUBLICATION supabase_realtime ADD TABLE settings;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- 2. Configure Tracking Logs Security
ALTER TABLE tracking_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to be safe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tracking_logs' AND policyname = 'Tracking logs viewable by admins') THEN
    DROP POLICY "Tracking logs viewable by admins" ON tracking_logs;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tracking_logs' AND policyname = 'Tracking logs viewable by assigned courier') THEN
    DROP POLICY "Tracking logs viewable by assigned courier" ON tracking_logs;
  END IF;
END $$;

-- Create Policies for Tracking Logs
CREATE POLICY "Tracking logs viewable by admins" ON tracking_logs
  FOR SELECT USING (
    get_auth_user_role() = ANY (ARRAY['admin', 'owner', 'admin_kurir', 'finance'])
  );

CREATE POLICY "Tracking logs viewable by assigned courier" ON tracking_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = tracking_logs.order_id 
      AND orders.courier_id = auth.uid()
    )
  );

-- 3. Verify/Strengthen Order Policies
-- Ensure couriers can see "pending" orders (to see they are in the queue or for matching)
-- and "assigned" orders they own.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Couriers can view pending or assigned orders') THEN
    DROP POLICY "Couriers can view pending or assigned orders" ON orders;
  END IF;
END $$;

CREATE POLICY "Couriers can view pending or assigned orders" ON orders
  FOR SELECT USING (
    status = 'pending' 
    OR courier_id = auth.uid()
  );

-- Ensure couriers can update orders assigned to them
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Couriers can update their assigned orders') THEN
    DROP POLICY "Couriers can update their assigned orders" ON orders;
  END IF;
END $$;

CREATE POLICY "Couriers can update their assigned orders" ON orders
  FOR UPDATE USING (
    courier_id = auth.uid()
  ) WITH CHECK (
    courier_id = auth.uid()
  );
;
