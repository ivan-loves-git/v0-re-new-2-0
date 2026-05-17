-- Migration: Opportunity pursuit NDA and document access
-- Purpose: Track pursuit-level NDA status and gate repreneur document downloads.

DO $$ BEGIN
  CREATE TYPE opportunity_nda_status AS ENUM (
    'not_required',
    'required',
    'sent',
    'signed',
    'waived'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.opportunity_matches
  ADD COLUMN IF NOT EXISTS nda_status opportunity_nda_status NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS nda_document_id UUID REFERENCES public.opportunity_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nda_notes TEXT,
  ADD COLUMN IF NOT EXISTS nda_updated_by TEXT,
  ADD COLUMN IF NOT EXISTS nda_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.opportunity_matches.nda_status IS
  'Pursuit-level NDA gate for document access. Repreneur downloads are allowed only when not_required, signed, or waived.';
COMMENT ON COLUMN public.opportunity_matches.nda_document_id IS
  'Optional uploaded NDA document associated with this opportunity-repreneur pursuit.';
COMMENT ON COLUMN public.opportunity_matches.nda_notes IS
  'Internal staff note for NDA status; not exposed to repreneurs.';

CREATE INDEX IF NOT EXISTS idx_opportunity_matches_nda_status
  ON public.opportunity_matches(nda_status);
CREATE INDEX IF NOT EXISTS idx_opportunity_matches_nda_document_id
  ON public.opportunity_matches(nda_document_id);

GRANT USAGE ON TYPE public.opportunity_nda_status TO authenticated, service_role;
