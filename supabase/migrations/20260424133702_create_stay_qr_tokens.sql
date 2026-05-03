
-- Table for QR tokens used in Stay verification
CREATE TABLE public.stay_qr_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token       TEXT NOT NULL UNIQUE,
    created_by  UUID REFERENCES public.profiles(id),
    created_at  TIMESTAMPTZ DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL,
    is_used     BOOLEAN DEFAULT false,
    used_by     UUID REFERENCES public.profiles(id),
    used_at     TIMESTAMPTZ
);

-- Index for fast active-token lookup
CREATE INDEX idx_stay_qr_active ON public.stay_qr_tokens (token) WHERE is_used = false;

-- RLS
ALTER TABLE public.stay_qr_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage stay tokens"
    ON public.stay_qr_tokens
    FOR ALL
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('admin', 'admin_kurir', 'owner')
    )
    WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('admin', 'admin_kurir', 'owner')
    );

CREATE POLICY "Couriers can read stay tokens"
    ON public.stay_qr_tokens
    FOR SELECT
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'courier'
    );
;
