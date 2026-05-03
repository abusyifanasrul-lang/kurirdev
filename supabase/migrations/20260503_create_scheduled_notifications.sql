-- Create scheduled_notifications table for reminder system
-- This table stores notifications that need to be sent at a specific time

CREATE TABLE IF NOT EXISTS public.scheduled_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'reminder',
  data JSONB,
  sent BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_scheduled_at 
  ON public.scheduled_notifications(scheduled_at) 
  WHERE sent = false;

CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_user_id 
  ON public.scheduled_notifications(user_id);

-- RLS Policies
ALTER TABLE public.scheduled_notifications ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "Admin can manage scheduled notifications"
  ON public.scheduled_notifications
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('owner', 'admin_kurir')
    )
  );

-- Users can view their own scheduled notifications
CREATE POLICY "Users can view own scheduled notifications"
  ON public.scheduled_notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Service role can do everything (for Edge Functions)
CREATE POLICY "Service role full access"
  ON public.scheduled_notifications
  FOR ALL
  TO service_role
  USING (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_scheduled_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_scheduled_notifications_updated_at
  BEFORE UPDATE ON public.scheduled_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_notifications_updated_at();

COMMENT ON TABLE public.scheduled_notifications IS 'Stores notifications that need to be sent at a specific time (e.g., shift swap reminders)';
COMMENT ON COLUMN public.scheduled_notifications.scheduled_at IS 'When the notification should be sent';
COMMENT ON COLUMN public.scheduled_notifications.sent IS 'Whether the notification has been sent';
COMMENT ON COLUMN public.scheduled_notifications.type IS 'Type of notification (e.g., shift_swap_reminder, shift_start_reminder)';
