ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS creator_name TEXT,
ADD COLUMN IF NOT EXISTS assigner_name TEXT,
ADD COLUMN IF NOT EXISTS courier_name TEXT,
ADD COLUMN IF NOT EXISTS canceller_name TEXT,
ADD COLUMN IF NOT EXISTS payment_confirmed_by_name TEXT;;
