-- Add payment tracking to shift_attendance
ALTER TABLE shift_attendance 
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid')),
ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payment_confirmed_by UUID REFERENCES profiles(id);

-- Rename columns to match frontend expectations if necessary, or add aliases
-- Let's keep it as is but add a comment
COMMENT ON COLUMN shift_attendance.first_online_at IS 'Equivalent to check_in time';
COMMENT ON COLUMN shift_attendance.flat_fine IS 'The flat penalty amount for being late';

-- Add a column for check_out if we want to track shift completion
ALTER TABLE shift_attendance ADD COLUMN IF NOT EXISTS last_online_at TIMESTAMPTZ;

-- Ensure RLS is enabled and set up correctly
ALTER TABLE shift_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow couriers to view their own attendance" 
ON shift_attendance FOR SELECT 
USING (auth.uid() = courier_id);

CREATE POLICY "Allow admins to manage all attendance" 
ON shift_attendance FOR ALL 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'admin_kurir', 'finance')));;
