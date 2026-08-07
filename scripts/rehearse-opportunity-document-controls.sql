-- Disposable preflight for migration 087. Run with psql from scripts/:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f rehearse-opportunity-document-controls.sql
-- It intentionally creates the legacy enum without source_teaser, then runs
-- migration 087 inside the same transaction to catch enum ordering mistakes.

BEGIN;

CREATE TYPE public.opportunity_document_type AS ENUM (
  'teaser', 'deal_book', 'nda', 'external_analysis', 'other'
);
CREATE TYPE public.opportunity_document_visibility AS ENUM (
  'staff_only', 'approved_for_repreneur'
);
CREATE TABLE public.opportunity_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL,
  title TEXT NOT NULL,
  document_type public.opportunity_document_type NOT NULL,
  visibility public.opportunity_document_visibility NOT NULL DEFAULT 'staff_only'
);

\ir 087_opportunity_document_controls.sql

INSERT INTO public.opportunity_documents (
  opportunity_id, title, document_type, visibility
) VALUES (
  '00000000-0000-0000-0000-000000000001', 'Original IM', 'deal_book', 'staff_only'
);

DO $$
BEGIN
  BEGIN
    INSERT INTO public.opportunity_documents (
      opportunity_id, title, document_type, visibility
    ) VALUES (
      '00000000-0000-0000-0000-000000000001', 'Invalid IM', 'deal_book', 'approved_for_repreneur'
    );
    RAISE EXCEPTION 'Expected retained-document visibility check to fail';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END;
$$;

DO $$
DECLARE
  retained_id UUID;
BEGIN
  SELECT id INTO retained_id
  FROM public.opportunity_documents
  WHERE document_type::TEXT = 'deal_book';

  BEGIN
    DELETE FROM public.opportunity_documents WHERE id = retained_id;
    RAISE EXCEPTION 'Expected retained-document deletion to fail';
  EXCEPTION WHEN raise_exception THEN
    NULL;
  END;
END;
$$;

ROLLBACK;
