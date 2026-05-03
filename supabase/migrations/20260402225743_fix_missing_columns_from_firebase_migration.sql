-- Fix missing columns from Firebase migration

-- 1. Alter Profiles Table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS courier_status VARCHAR(50) CHECK (courier_status IN ('on', 'stay', 'off'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS off_reason TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(50) CHECK (vehicle_type IN ('motorcycle', 'car', 'bicycle', 'van'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plate_number VARCHAR(50);

-- 2. Alter Orders Table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS estimated_delivery_time TIMESTAMP WITH TIME ZONE;

-- 3. Alter Customers Table
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS order_count INT DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS last_order_at TIMESTAMP WITH TIME ZONE;

-- 4. Alter Notifications Table
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_name VARCHAR(255);
-- Rename message to body to match Firebase if necessary, or just add body as an alias
-- Since the frontend code already uses 'message' in types/index.ts (wait, let me check types again)
-- Actually types/index.ts has 'message' (line 182).
-- I will add 'body' as a column that mirrors 'message' or just leave 'message' if that's what the code uses.
-- Let's check types/index.ts line 182 again.
-- 181:   title: string;
-- 182:   message: string;
-- So the code uses 'message'. Firebase used 'body'.
-- I'll stick with 'message' but add 'user_name'.
;
