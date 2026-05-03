
-- Table for stay attendance audit trail
CREATE TABLE public.stay_attendance_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    courier_id  UUID NOT NULL REFERENCES public.profiles(id),
    courier_name TEXT,
    token_id    UUID NOT NULL REFERENCES public.stay_qr_tokens(id),
    verified_at TIMESTAMPTZ DEFAULT now(),
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Index for daily queries
CREATE INDEX idx_stay_attendance_date ON public.stay_attendance_logs (courier_id, verified_at);
CREATE INDEX idx_stay_attendance_day ON public.stay_attendance_logs (verified_at);

-- RLS
ALTER TABLE public.stay_attendance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read all stay logs"
    ON public.stay_attendance_logs
    FOR SELECT
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('admin', 'admin_kurir', 'owner', 'finance')
    );

CREATE POLICY "Courier can read own stay logs"
    ON public.stay_attendance_logs
    FOR SELECT
    TO authenticated
    USING (courier_id = auth.uid());

CREATE POLICY "System can insert stay logs"
    ON public.stay_attendance_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
;
