-- Enable FULL replica identity for profiles table
-- This ensures ALL columns (including trigger-modified ones) are sent via Realtime

ALTER TABLE profiles REPLICA IDENTITY FULL;

-- Verify the change
SELECT 
  schemaname,
  tablename,
  CASE relreplident
    WHEN 'd' THEN 'DEFAULT'
    WHEN 'n' THEN 'NOTHING'
    WHEN 'f' THEN 'FULL'
    WHEN 'i' THEN 'INDEX'
  END as replica_identity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_tables t ON t.schemaname = n.nspname AND t.tablename = c.relname
WHERE t.tablename = 'profiles'
  AND t.schemaname = 'public';;
