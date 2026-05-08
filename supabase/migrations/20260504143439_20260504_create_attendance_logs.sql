-- Create table
CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_attendance_logs_courier 
  ON attendance_logs(courier_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_logs_event_type
  ON attendance_logs(event_type, created_at DESC);

-- Enable RLS
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view all attendance logs" 
  ON attendance_logs 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('owner', 'admin', 'admin_kurir')
    )
  );

CREATE POLICY "System can insert attendance logs" 
  ON attendance_logs 
  FOR INSERT 
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE attendance_logs IS 'Logs for GPS events and courier attendance activities';
COMMENT ON COLUMN attendance_logs.event_type IS 'Event type: stay_auto_revoked, gps_out_of_zone, etc';
COMMENT ON COLUMN attendance_logs.metadata IS 'Additional event data (distance, reason, etc)';;
