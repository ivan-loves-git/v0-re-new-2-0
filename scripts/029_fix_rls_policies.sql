-- Historical migration: keep CRM access behind server-side service-role clients.
-- Run scripts/063_security_hardening_authorization.sql after this migration on
-- databases that already applied the original permissive policy version.

-- Drop existing restrictive policies if any
DROP POLICY IF EXISTS "Allow authenticated users to read repreneurs" ON repreneurs;
DROP POLICY IF EXISTS "Users can view own repreneurs" ON repreneurs;

ALTER TABLE repreneurs ENABLE ROW LEVEL SECURITY;
