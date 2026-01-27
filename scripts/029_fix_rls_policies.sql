-- Fix RLS policies to allow authenticated users to read repreneurs
-- Run this in Supabase SQL Editor

-- Drop existing restrictive policies if any
DROP POLICY IF EXISTS "Allow authenticated users to read repreneurs" ON repreneurs;
DROP POLICY IF EXISTS "Users can view own repreneurs" ON repreneurs;

-- Create policy allowing all authenticated users to read all repreneurs
CREATE POLICY "Allow authenticated users to read repreneurs"
ON repreneurs FOR SELECT
TO authenticated
USING (true);

-- Ensure RLS is enabled but with permissive read policy
ALTER TABLE repreneurs ENABLE ROW LEVEL SECURITY;

-- Also add policies for UPDATE and INSERT if needed
DROP POLICY IF EXISTS "Allow authenticated users to update repreneurs" ON repreneurs;
CREATE POLICY "Allow authenticated users to update repreneurs"
ON repreneurs FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to insert repreneurs" ON repreneurs;
CREATE POLICY "Allow authenticated users to insert repreneurs"
ON repreneurs FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow public to insert (for intake form)
DROP POLICY IF EXISTS "Allow public to insert repreneurs" ON repreneurs;
CREATE POLICY "Allow public to insert repreneurs"
ON repreneurs FOR INSERT
TO anon
WITH CHECK (true);
