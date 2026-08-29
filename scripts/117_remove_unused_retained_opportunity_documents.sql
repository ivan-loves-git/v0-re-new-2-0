-- W-170: narrowly correct an accidental, unused retained IM or canonical NDA.
-- PostgreSQL owns eligibility and metadata deletion. Storage cleanup is retried
-- separately from the server using the private receipt returned here.

CREATE TABLE IF NOT EXISTS public.opportunity_document_storage_cleanup_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL UNIQUE,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  storage_bucket TEXT NOT NULL CHECK (NULLIF(BTRIM(storage_bucket), '') IS NOT NULL),
  storage_path TEXT NOT NULL CHECK (NULLIF(BTRIM(storage_path), '') IS NOT NULL),
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.opportunity_document_storage_cleanup_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_document_storage_cleanup_receipts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.opportunity_document_storage_cleanup_receipts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.opportunity_document_storage_cleanup_receipts TO service_role;

CREATE OR REPLACE FUNCTION public.prevent_retained_opportunity_document_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.document_type::TEXT = 'source_teaser' THEN
    RAISE EXCEPTION 'Source teasers are permanently retained and cannot be deleted.';
  END IF;
  IF OLD.document_type::TEXT = 'deal_book'
    AND current_setting('app.allow_unused_retained_document_removal', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Retained Information Memoranda cannot be deleted; upload a corrected version instead.';
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_opportunity_nda_artifact_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE'
    AND current_setting('app.allow_unused_retained_document_removal', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Canonical NDA artifact evidence is immutable; register a new version instead.';
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_linked_nda_document_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.opportunity_nda_artifacts AS artifact WHERE artifact.document_id = OLD.id
  ) AND current_setting('app.allow_unused_retained_document_removal', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'This document is retained canonical NDA evidence; register a new version instead.';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_unused_retained_opportunity_document(
  p_opportunity_id UUID,
  p_document_id UUID
)
RETURNS TABLE (
  cleanup_id UUID,
  storage_bucket TEXT,
  storage_path TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_document public.opportunity_documents%ROWTYPE;
  v_artifact public.opportunity_nda_artifacts%ROWTYPE;
  v_receipt public.opportunity_document_storage_cleanup_receipts%ROWTYPE;
BEGIN
  IF p_opportunity_id IS NULL OR p_document_id IS NULL THEN
    RAISE EXCEPTION 'Opportunity and document are required.';
  END IF;

  SELECT * INTO v_document
  FROM public.opportunity_documents
  WHERE id = p_document_id
  FOR UPDATE;

  IF v_document.id IS NULL THEN
    SELECT * INTO v_receipt
    FROM public.opportunity_document_storage_cleanup_receipts
    WHERE document_id = p_document_id AND opportunity_id = p_opportunity_id
    FOR UPDATE;
    IF v_receipt.id IS NULL THEN
      RAISE EXCEPTION 'Retained document not found.';
    END IF;
    RETURN QUERY SELECT v_receipt.id, v_receipt.storage_bucket, v_receipt.storage_path;
    RETURN;
  END IF;

  IF v_document.opportunity_id <> p_opportunity_id THEN
    RAISE EXCEPTION 'Document does not belong to the selected opportunity.';
  END IF;
  IF v_document.document_type = 'source_teaser' THEN
    RAISE EXCEPTION 'Source teasers are permanently retained and cannot be deleted.';
  END IF;

  SELECT * INTO v_artifact
  FROM public.opportunity_nda_artifacts
  WHERE document_id = v_document.id
  FOR UPDATE;

  IF v_document.document_type = 'deal_book' THEN
    IF v_artifact.id IS NOT NULL THEN
      RAISE EXCEPTION 'Only an unused Information Memorandum or canonical NDA version can be removed.';
    END IF;
  ELSIF v_artifact.id IS NULL OR v_document.document_type <> 'nda' THEN
    RAISE EXCEPTION 'Only an unused Information Memorandum or canonical NDA version can be removed.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.opportunity_pursuit_confidential_grants
    WHERE information_memo_document_id = v_document.id
  ) OR EXISTS (
    SELECT 1 FROM public.opportunity_pursuit_evidence
    WHERE document_id = v_document.id OR nda_artifact_id = v_artifact.id
  ) OR EXISTS (
    SELECT 1 FROM public.opportunity_matches
    WHERE nda_document_id = v_document.id
  ) THEN
    RAISE EXCEPTION 'This retained version has been used and cannot be deleted.';
  END IF;

  IF v_artifact.id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.opportunity_nda_artifacts newer
    WHERE newer.supersedes_artifact_id = v_artifact.id
       OR (
         newer.opportunity_id = v_artifact.opportunity_id
         AND newer.match_id IS NOT DISTINCT FROM v_artifact.match_id
         AND newer.artifact_role = v_artifact.artifact_role
         AND newer.version_number > v_artifact.version_number
       )
  ) THEN
    RAISE EXCEPTION 'A superseded version or later retained version cannot be deleted.';
  END IF;

  IF NULLIF(BTRIM(v_document.storage_bucket), '') IS NULL
    OR NULLIF(BTRIM(v_document.storage_path), '') IS NULL THEN
    RAISE EXCEPTION 'Retained private storage metadata is required for this correction.';
  END IF;

  INSERT INTO public.opportunity_document_storage_cleanup_receipts (
    document_id, opportunity_id, storage_bucket, storage_path
  ) VALUES (
    v_document.id, v_document.opportunity_id, v_document.storage_bucket, v_document.storage_path
  ) RETURNING * INTO v_receipt;

  PERFORM set_config('app.allow_unused_retained_document_removal', 'on', true);
  IF v_artifact.id IS NOT NULL THEN
    DELETE FROM public.opportunity_nda_artifacts WHERE id = v_artifact.id;
  END IF;
  DELETE FROM public.opportunity_documents WHERE id = v_document.id;

  RETURN QUERY SELECT v_receipt.id, v_receipt.storage_bucket, v_receipt.storage_path;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_unused_retained_opportunity_document_cleanup(
  p_cleanup_id UUID,
  p_opportunity_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.opportunity_document_storage_cleanup_receipts
  WHERE id = p_cleanup_id AND opportunity_id = p_opportunity_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Private cleanup receipt not found.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_unused_retained_opportunity_document(UUID, UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.complete_unused_retained_opportunity_document_cleanup(UUID, UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_unused_retained_opportunity_document(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_unused_retained_opportunity_document_cleanup(UUID, UUID) TO service_role;

COMMENT ON TABLE public.opportunity_document_storage_cleanup_receipts IS
  'Server-only private Storage cleanup receipts after W-170 metadata removal; retries leave no broken live document reference.';
COMMENT ON FUNCTION public.remove_unused_retained_opportunity_document(UUID, UUID) IS
  'Removes exactly one unused retained IM or latest canonical NDA version and returns its private cleanup receipt.';
