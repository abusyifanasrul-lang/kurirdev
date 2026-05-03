-- Add RLS policies for holidays table
-- Allow authenticated users to perform CRUD operations

-- Enable RLS if not already enabled
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

-- Policy untuk SELECT (read)
CREATE POLICY "Allow authenticated users to read holidays"
ON holidays
FOR SELECT
TO authenticated
USING (true);

-- Policy untuk INSERT (create)
CREATE POLICY "Allow authenticated users to insert holidays"
ON holidays
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy untuk UPDATE (edit)
CREATE POLICY "Allow authenticated users to update holidays"
ON holidays
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy untuk DELETE (hapus)
CREATE POLICY "Allow authenticated users to delete holidays"
ON holidays
FOR DELETE
TO authenticated
USING (true);;
