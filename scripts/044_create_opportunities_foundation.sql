-- Migration: Opportunity foundation for Re-New V2
-- Purpose: Store Bertrand's deal-flow opportunity records with explicit staff-only
-- and repreneur-visible boundaries.
-- Out of scope for V2: automatic PDF teaser parsing, hidden AI matching, and a
-- full M&A firm CRM with activity history or firm portals.

DO $$ BEGIN
  CREATE TYPE opportunity_status AS ENUM ('draft', 'active', 'paused', 'archived', 'closed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE opportunity_visibility AS ENUM ('staff_only', 'anonymized', 'repreneur_visible');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE ma_source_type AS ENUM ('ma_firm', 'broker', 'direct', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE opportunity_document_type AS ENUM ('teaser', 'deal_book', 'nda', 'external_analysis', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE opportunity_document_visibility AS ENUM ('staff_only', 'approved_for_repreneur');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.ma_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_name TEXT NOT NULL,
  source_type ma_source_type NOT NULL DEFAULT 'ma_firm',
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.ma_sources IS
  'Minimal staff-only M&A source/contact data for V2 opportunities. Not a full CRM.';
COMMENT ON COLUMN public.ma_sources.notes IS
  'Staff-only source context. Do not expose to repreneurs.';

CREATE TABLE IF NOT EXISTS public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE,
  status opportunity_status NOT NULL DEFAULT 'draft',
  source_id UUID REFERENCES public.ma_sources(id) ON DELETE SET NULL,
  source_label TEXT,
  source_visibility opportunity_visibility NOT NULL DEFAULT 'staff_only',

  sector TEXT,
  activity TEXT,
  location TEXT,
  description TEXT,
  revenue_meur NUMERIC(12, 2),
  ebitda_keur NUMERIC(12, 2),
  headcount INTEGER,
  date_added DATE,

  repreneur_visibility opportunity_visibility NOT NULL DEFAULT 'anonymized',
  public_title TEXT,
  anonymized_description TEXT,
  staff_notes TEXT,
  imported_from TEXT,
  imported_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.opportunities IS
  'Staff-managed opportunity records for V2 deal-flow validation.';
COMMENT ON COLUMN public.opportunities.source_visibility IS
  'Source data is staff_only by default. Repreneur exposure must be explicit.';
COMMENT ON COLUMN public.opportunities.repreneur_visibility IS
  'Controls whether the opportunity can be shown to repreneurs and at what disclosure level.';
COMMENT ON COLUMN public.opportunities.staff_notes IS
  'Internal staff-only notes. Never included in repreneur-visible summaries.';
COMMENT ON COLUMN public.opportunities.anonymized_description IS
  'Optional redacted description for repreneur-facing matching. No PDF parsing or AI inference in V2.';

CREATE TABLE IF NOT EXISTS public.opportunity_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  document_type opportunity_document_type NOT NULL DEFAULT 'other',
  visibility opportunity_document_visibility NOT NULL DEFAULT 'staff_only',
  storage_bucket TEXT NOT NULL DEFAULT 'opportunity-documents',
  storage_path TEXT,
  external_url TEXT,
  file_name TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (storage_path IS NOT NULL OR external_url IS NOT NULL)
);

COMMENT ON TABLE public.opportunity_documents IS
  'Document metadata linked to opportunities. Storage remains staff-only unless visibility is explicitly changed.';
COMMENT ON COLUMN public.opportunity_documents.visibility IS
  'staff_only is the default. approved_for_repreneur is metadata only; no public access is implied.';

CREATE INDEX IF NOT EXISTS idx_opportunities_status ON public.opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_date_added ON public.opportunities(date_added);
CREATE INDEX IF NOT EXISTS idx_opportunities_sector ON public.opportunities(sector);
CREATE INDEX IF NOT EXISTS idx_opportunities_location ON public.opportunities(location);
CREATE INDEX IF NOT EXISTS idx_opportunities_source_id ON public.opportunities(source_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_repreneur_visibility ON public.opportunities(repreneur_visibility);
CREATE INDEX IF NOT EXISTS idx_ma_sources_firm_name ON public.ma_sources(firm_name);
CREATE INDEX IF NOT EXISTS idx_opportunity_documents_opportunity_id ON public.opportunity_documents(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_documents_visibility ON public.opportunity_documents(visibility);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_ma_sources_updated_at ON public.ma_sources;
CREATE TRIGGER update_ma_sources_updated_at
  BEFORE UPDATE ON public.ma_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_opportunities_updated_at ON public.opportunities;
CREATE TRIGGER update_opportunities_updated_at
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_opportunity_documents_updated_at ON public.opportunity_documents;
CREATE TRIGGER update_opportunity_documents_updated_at
  BEFORE UPDATE ON public.opportunity_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ma_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view ma sources" ON public.ma_sources;
CREATE POLICY "Authenticated users can view ma sources"
  ON public.ma_sources FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert ma sources" ON public.ma_sources;
CREATE POLICY "Authenticated users can insert ma sources"
  ON public.ma_sources FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update ma sources" ON public.ma_sources;
CREATE POLICY "Authenticated users can update ma sources"
  ON public.ma_sources FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete ma sources" ON public.ma_sources;
CREATE POLICY "Authenticated users can delete ma sources"
  ON public.ma_sources FOR DELETE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can view opportunities" ON public.opportunities;
CREATE POLICY "Authenticated users can view opportunities"
  ON public.opportunities FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert opportunities" ON public.opportunities;
CREATE POLICY "Authenticated users can insert opportunities"
  ON public.opportunities FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update opportunities" ON public.opportunities;
CREATE POLICY "Authenticated users can update opportunities"
  ON public.opportunities FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete opportunities" ON public.opportunities;
CREATE POLICY "Authenticated users can delete opportunities"
  ON public.opportunities FOR DELETE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can view opportunity documents" ON public.opportunity_documents;
CREATE POLICY "Authenticated users can view opportunity documents"
  ON public.opportunity_documents FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert opportunity documents" ON public.opportunity_documents;
CREATE POLICY "Authenticated users can insert opportunity documents"
  ON public.opportunity_documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update opportunity documents" ON public.opportunity_documents;
CREATE POLICY "Authenticated users can update opportunity documents"
  ON public.opportunity_documents FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete opportunity documents" ON public.opportunity_documents;
CREATE POLICY "Authenticated users can delete opportunity documents"
  ON public.opportunity_documents FOR DELETE
  TO authenticated
  USING (true);
