-- Migration: Add Lettre de Cadrage URL column to repreneurs table
-- Purpose: Store the URL to uploaded LDC documents in Supabase Storage

ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS ldc_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.repreneurs.ldc_url IS 'URL to Lettre de Cadrage document stored in Supabase Storage (cvs bucket)';
