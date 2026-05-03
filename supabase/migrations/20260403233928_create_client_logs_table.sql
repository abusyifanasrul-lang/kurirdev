CREATE TABLE IF NOT EXISTS client_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  level TEXT NOT NULL, -- 'error', 'warn', 'info'
  message TEXT NOT NULL,
  stack_trace TEXT,
  context JSONB,
  user_id UUID REFERENCES auth.users(id),
  url TEXT
);

-- Basic RLS: Anyone can insert, only admins can read.
ALTER TABLE client_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable insert for all" ON client_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable read for admins" ON client_logs FOR SELECT USING (
  auth.jwt() ->> 'role' = 'admin'
);
;
