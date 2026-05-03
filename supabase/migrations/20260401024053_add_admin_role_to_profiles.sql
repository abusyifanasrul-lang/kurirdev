ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('owner', 'admin', 'admin_kurir', 'finance', 'courier'));

-- Promote the primary user to admin (Super Admin)
UPDATE public.profiles SET role = 'admin' WHERE id = '2b3cb9f5-924f-4627-9877-1f7e1e16a401';;
