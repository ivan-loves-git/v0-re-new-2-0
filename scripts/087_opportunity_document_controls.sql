-- W-089: document-control invariants for retained source material and IMs.
-- This is additive. Existing records are not reclassified or silently granted
-- repreneur access; the application continues to fail closed for access.

ALTER TYPE public.opportunity_document_type
  ADD VALUE IF NOT EXISTS 'source_teaser';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'opportunity_documents_retained_staff_only'
      AND conrelid = 'public.opportunity_documents'::regclass
  ) THEN
    ALTER TABLE public.opportunity_documents
      ADD CONSTRAINT opportunity_documents_retained_staff_only
      CHECK (
        document_type::TEXT NOT IN ('source_teaser', 'deal_book')
        OR visibility = 'staff_only'
      ) NOT VALID;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_retained_opportunity_document_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.document_type::TEXT IN ('source_teaser', 'deal_book') THEN
    RAISE EXCEPTION
      'Retained % documents cannot be deleted; upload a corrected version instead.',
      OLD.document_type;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS opportunity_documents_retain_source_and_im
  ON public.opportunity_documents;
CREATE TRIGGER opportunity_documents_retain_source_and_im
  BEFORE DELETE ON public.opportunity_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_retained_opportunity_document_delete();

COMMENT ON CONSTRAINT opportunity_documents_retained_staff_only
  ON public.opportunity_documents IS
  'Source teasers and Information Memoranda are permanent staff-only evidence; pursuit grants are separate.';
COMMENT ON FUNCTION public.prevent_retained_opportunity_document_delete() IS
  'Source teasers and Information Memoranda are retained. Corrections create new document rows.';
