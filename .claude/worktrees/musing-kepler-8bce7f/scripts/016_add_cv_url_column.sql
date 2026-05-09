-- Migration: Add CV URL column to repreneurs table
-- Purpose: Store the URL to uploaded CV documents in Supabase Storage

ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS cv_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.repreneurs.cv_url IS 'URL to CV document stored in Supabase Storage (cvs bucket)';
