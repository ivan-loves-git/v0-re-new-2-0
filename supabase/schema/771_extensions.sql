-- Release-build 771 extension dependencies for a fresh Supabase branch.
-- Supabase-managed branches normally provide these already; IF NOT EXISTS keeps
-- reconstruction deterministic without changing their configuration.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
