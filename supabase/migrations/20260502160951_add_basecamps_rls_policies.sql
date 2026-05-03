-- Add RLS policies for basecamps table
-- Allow authenticated users to INSERT, UPDATE, DELETE

-- Policy untuk INSERT (create)
CREATE POLICY "Allow authenticated users to insert basecamps"
ON basecamps
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy untuk UPDATE (edit)
CREATE POLICY "Allow authenticated users to update basecamps"
ON basecamps
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy untuk DELETE (hapus)
CREATE POLICY "Allow authenticated users to delete basecamps"
ON basecamps
FOR DELETE
TO authenticated
USING (true);;
