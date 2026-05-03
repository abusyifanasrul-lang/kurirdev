ALTER TABLE public.orders ADD COLUMN assignment_instruction TEXT;
COMMENT ON COLUMN public.orders.assignment_instruction IS 'Instruksi khusus dari admin saat penugasan kurir.';;
