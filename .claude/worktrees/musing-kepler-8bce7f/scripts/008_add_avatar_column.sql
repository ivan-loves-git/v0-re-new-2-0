-- Add avatar_url column to repreneurs table
-- Stores URL to custom uploaded avatar, NULL means use default

ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN public.repreneurs.avatar_url IS 'URL to custom avatar image in Supabase Storage. NULL = use default avatar based on ID.';
