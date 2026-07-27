-- W-043: canonical, staff-only NDA artifact foundation.
--
-- This migration intentionally does not promote legacy opportunity_matches
-- nda_status / nda_document_id values. Those fields remain compatibility
-- evidence and do not satisfy the canonical artifact model introduced here.

DO $$
BEGIN
  CREATE TYPE public.opportunity_nda_artifact_role AS ENUM (
    'blank_template',
    'renew_signed_copy',
    'repreneur_signed_copy'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS public.opportunity_nda_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL
    REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  match_id UUID
    REFERENCES public.opportunity_matches(id) ON DELETE RESTRICT,
  document_id UUID NOT NULL UNIQUE
    REFERENCES public.opportunity_documents(id) ON DELETE RESTRICT,
  artifact_role public.opportunity_nda_artifact_role NOT NULL,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  content_sha256 TEXT NOT NULL
    CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  supersedes_artifact_id UUID UNIQUE
    REFERENCES public.opportunity_nda_artifacts(id) ON DELETE RESTRICT,
  recorded_by TEXT NOT NULL CHECK (BTRIM(recorded_by) <> ''),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT opportunity_nda_artifacts_scope_check CHECK (
    (artifact_role = 'blank_template' AND match_id IS NULL)
    OR
    (
      artifact_role IN ('renew_signed_copy', 'repreneur_signed_copy')
      AND match_id IS NOT NULL
    )
  ),
  CONSTRAINT opportunity_nda_artifacts_version_chain_check CHECK (
    (version_number = 1 AND supersedes_artifact_id IS NULL)
    OR
    (version_number > 1 AND supersedes_artifact_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS
  opportunity_nda_artifacts_blank_version_unique
ON public.opportunity_nda_artifacts (
  opportunity_id,
  artifact_role,
  version_number
)
WHERE match_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS
  opportunity_nda_artifacts_pursuit_version_unique
ON public.opportunity_nda_artifacts (
  match_id,
  artifact_role,
  version_number
)
WHERE match_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS
  opportunity_nda_artifacts_opportunity_recorded_idx
ON public.opportunity_nda_artifacts (
  opportunity_id,
  recorded_at DESC
);

CREATE INDEX IF NOT EXISTS
  opportunity_nda_artifacts_match_recorded_idx
ON public.opportunity_nda_artifacts (
  match_id,
  recorded_at DESC
)
WHERE match_id IS NOT NULL;

ALTER TABLE public.opportunity_nda_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_nda_artifacts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS opportunity_nda_artifacts_service_role_read
  ON public.opportunity_nda_artifacts;
CREATE POLICY opportunity_nda_artifacts_service_role_read
  ON public.opportunity_nda_artifacts
  FOR SELECT
  TO service_role
  USING (TRUE);

REVOKE ALL ON TABLE public.opportunity_nda_artifacts
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.opportunity_nda_artifacts TO service_role;

REVOKE ALL ON TYPE public.opportunity_nda_artifact_role
  FROM PUBLIC, anon, authenticated;
GRANT USAGE ON TYPE public.opportunity_nda_artifact_role TO service_role;

CREATE OR REPLACE FUNCTION public.assert_opportunity_nda_artifact_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  linked_document_opportunity_id UUID;
  linked_document_type public.opportunity_document_type;
  linked_document_visibility public.opportunity_document_visibility;
  linked_document_storage_path TEXT;
  linked_document_external_url TEXT;
  linked_document_file_name TEXT;
  linked_document_mime_type TEXT;
  linked_document_size_bytes BIGINT;
  linked_match_opportunity_id UUID;
  prior_artifact public.opportunity_nda_artifacts;
BEGIN
  SELECT
    document.opportunity_id,
    document.document_type,
    document.visibility,
    NULLIF(BTRIM(document.storage_path), ''),
    NULLIF(BTRIM(document.external_url), ''),
    NULLIF(BTRIM(document.file_name), ''),
    NULLIF(BTRIM(document.mime_type), ''),
    document.size_bytes
  INTO
    linked_document_opportunity_id,
    linked_document_type,
    linked_document_visibility,
    linked_document_storage_path,
    linked_document_external_url,
    linked_document_file_name,
    linked_document_mime_type,
    linked_document_size_bytes
  FROM public.opportunity_documents document
  WHERE document.id = NEW.document_id;

  IF linked_document_opportunity_id IS NULL
    OR linked_document_opportunity_id <> NEW.opportunity_id
    OR linked_document_type <> 'nda'
    OR linked_document_visibility <> 'staff_only'
  THEN
    RAISE EXCEPTION
      'Canonical NDA artifact documents must be staff-only NDAs for the same opportunity.';
  END IF;

  IF linked_document_storage_path IS NULL
    OR linked_document_external_url IS NOT NULL
  THEN
    RAISE EXCEPTION
      'Canonical NDA artifact documents require one retained private PDF.';
  END IF;

  IF linked_document_storage_path NOT LIKE
    NEW.opportunity_id::TEXT || '/nda-artifacts/' || NEW.artifact_role::TEXT || '/%'
    OR linked_document_file_name IS NULL
    OR LOWER(linked_document_file_name) NOT LIKE '%.pdf'
    OR linked_document_mime_type <> 'application/pdf'
    OR linked_document_size_bytes IS NULL
    OR linked_document_size_bytes <= 0
  THEN
    RAISE EXCEPTION
      'Canonical stored NDA artifacts must be positive-size PDFs in their role folder.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.opportunity_documents other_document
    WHERE other_document.id <> NEW.document_id
      AND other_document.storage_bucket = 'opportunity-documents'
      AND other_document.storage_path = linked_document_storage_path
  ) THEN
    RAISE EXCEPTION
      'Canonical NDA artifact storage paths must be unique and may never be reused.';
  END IF;

  IF NEW.match_id IS NOT NULL THEN
    SELECT match.opportunity_id
    INTO linked_match_opportunity_id
    FROM public.opportunity_matches match
    WHERE match.id = NEW.match_id;

    IF linked_match_opportunity_id IS NULL
      OR linked_match_opportunity_id <> NEW.opportunity_id
    THEN
      RAISE EXCEPTION
        'Canonical NDA artifact pursuits must belong to the same opportunity.';
    END IF;
  END IF;

  IF NEW.version_number > 1 THEN
    SELECT prior.*
    INTO prior_artifact
    FROM public.opportunity_nda_artifacts prior
    WHERE prior.id = NEW.supersedes_artifact_id;

    IF prior_artifact.id IS NULL
      OR prior_artifact.opportunity_id <> NEW.opportunity_id
      OR prior_artifact.match_id IS DISTINCT FROM NEW.match_id
      OR prior_artifact.artifact_role <> NEW.artifact_role
      OR prior_artifact.version_number <> NEW.version_number - 1
    THEN
      RAISE EXCEPTION
        'Canonical NDA artifact versions must supersede the immediately previous version in the same scope and role.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS opportunity_nda_artifacts_validate_integrity
  ON public.opportunity_nda_artifacts;
CREATE TRIGGER opportunity_nda_artifacts_validate_integrity
BEFORE INSERT ON public.opportunity_nda_artifacts
FOR EACH ROW
EXECUTE FUNCTION public.assert_opportunity_nda_artifact_integrity();

CREATE OR REPLACE FUNCTION public.reject_opportunity_nda_artifact_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'Canonical NDA artifact evidence is immutable; register a new version instead.';
END;
$$;

DROP TRIGGER IF EXISTS opportunity_nda_artifacts_immutable
  ON public.opportunity_nda_artifacts;
CREATE TRIGGER opportunity_nda_artifacts_immutable
BEFORE UPDATE OR DELETE ON public.opportunity_nda_artifacts
FOR EACH ROW
EXECUTE FUNCTION public.reject_opportunity_nda_artifact_mutation();

CREATE OR REPLACE FUNCTION public.reject_linked_nda_document_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.opportunity_nda_artifacts AS artifact
    WHERE artifact.document_id = OLD.id
  ) THEN
    RAISE EXCEPTION
      'This document is retained canonical NDA evidence; register a new version instead.';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS opportunity_documents_protect_nda_artifacts
  ON public.opportunity_documents;
CREATE TRIGGER opportunity_documents_protect_nda_artifacts
BEFORE UPDATE OR DELETE ON public.opportunity_documents
FOR EACH ROW
EXECUTE FUNCTION public.reject_linked_nda_document_mutation();

DROP FUNCTION IF EXISTS public.register_opportunity_nda_artifact(
  UUID,
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  BIGINT,
  TEXT,
  TEXT
);

CREATE FUNCTION public.register_opportunity_nda_artifact(
  p_opportunity_id UUID,
  p_match_id UUID,
  p_artifact_role TEXT,
  p_title TEXT,
  p_storage_path TEXT,
  p_file_name TEXT,
  p_file_size BIGINT,
  p_content_sha256 TEXT,
  p_recorded_by TEXT
)
RETURNS TABLE (
  artifact_id UUID,
  document_id UUID,
  version_number INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  normalized_role public.opportunity_nda_artifact_role;
  normalized_title TEXT := NULLIF(BTRIM(p_title), '');
  normalized_path TEXT := NULLIF(BTRIM(p_storage_path), '');
  normalized_file_name TEXT := NULLIF(BTRIM(p_file_name), '');
  normalized_content_sha256 TEXT := LOWER(NULLIF(BTRIM(p_content_sha256), ''));
  normalized_actor TEXT := NULLIF(BTRIM(p_recorded_by), '');
  match_opportunity_id UUID;
  prior_artifact_id UUID;
  next_version INTEGER;
  new_document_id UUID;
  new_artifact_id UUID;
  staff_role_count INTEGER;
BEGIN
  IF p_artifact_role IS NULL OR p_artifact_role NOT IN (
    'blank_template',
    'renew_signed_copy',
    'repreneur_signed_copy'
  ) THEN
    RAISE EXCEPTION 'Unsupported NDA artifact role.';
  END IF;
  normalized_role := p_artifact_role::public.opportunity_nda_artifact_role;

  IF normalized_title IS NULL THEN
    RAISE EXCEPTION 'Artifact title is required.';
  END IF;
  IF normalized_actor IS NULL THEN
    RAISE EXCEPTION 'A staff actor is required.';
  END IF;

  SELECT COUNT(*)
  INTO staff_role_count
  FROM public.app_user_roles
  WHERE LOWER(email) = LOWER(normalized_actor)
    AND role = 'staff';

  IF staff_role_count <> 1 THEN
    RAISE EXCEPTION 'Artifact registration requires one active staff identity.';
  END IF;

  PERFORM 1
  FROM public.opportunities
  WHERE id = p_opportunity_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Opportunity not found.';
  END IF;

  IF normalized_role = 'blank_template' THEN
    IF p_match_id IS NOT NULL THEN
      RAISE EXCEPTION 'A blank NDA template belongs to the opportunity, not a pursuit.';
    END IF;
  ELSE
    IF p_match_id IS NULL THEN
      RAISE EXCEPTION 'A signed NDA copy requires a pursuit.';
    END IF;

    SELECT opportunity_id
    INTO match_opportunity_id
    FROM public.opportunity_matches
    WHERE id = p_match_id;

    IF match_opportunity_id IS NULL THEN
      RAISE EXCEPTION 'Pursuit not found.';
    END IF;
    IF match_opportunity_id <> p_opportunity_id THEN
      RAISE EXCEPTION 'Pursuit does not belong to the selected opportunity.';
    END IF;
  END IF;

  IF normalized_path IS NULL THEN
    RAISE EXCEPTION 'Upload one retained PDF file.';
  END IF;

  IF normalized_path NOT LIKE
    p_opportunity_id::TEXT || '/nda-artifacts/' || normalized_role::TEXT || '/%'
  THEN
    RAISE EXCEPTION 'Stored NDA artifact path is outside its canonical role folder.';
  END IF;
  IF normalized_file_name IS NULL
    OR LOWER(normalized_file_name) NOT LIKE '%.pdf'
  THEN
    RAISE EXCEPTION 'Stored NDA artifacts must be PDF files.';
  END IF;
  IF p_file_size IS NULL OR p_file_size <= 0 THEN
    RAISE EXCEPTION 'Stored NDA artifact file size must be positive.';
  END IF;
  IF normalized_content_sha256 IS NULL
    OR normalized_content_sha256 !~ '^[0-9a-f]{64}$'
  THEN
    RAISE EXCEPTION 'Stored NDA artifacts require a SHA-256 content digest.';
  END IF;

  SELECT artifact.id, artifact.version_number + 1
  INTO prior_artifact_id, next_version
  FROM public.opportunity_nda_artifacts AS artifact
  WHERE artifact.opportunity_id = p_opportunity_id
    AND artifact.match_id IS NOT DISTINCT FROM p_match_id
    AND artifact.artifact_role = normalized_role
  ORDER BY artifact.version_number DESC
  LIMIT 1;

  IF next_version IS NULL THEN
    next_version := 1;
  END IF;

  INSERT INTO public.opportunity_documents (
    opportunity_id,
    title,
    document_type,
    visibility,
    storage_bucket,
    storage_path,
    external_url,
    file_name,
    size_bytes,
    mime_type,
    uploaded_by
  )
  VALUES (
    p_opportunity_id,
    normalized_title,
    'nda',
    'staff_only',
    'opportunity-documents',
    normalized_path,
    NULL,
    normalized_file_name,
    p_file_size,
    CASE WHEN normalized_path IS NOT NULL THEN 'application/pdf' ELSE NULL END,
    normalized_actor
  )
  RETURNING id INTO new_document_id;

  INSERT INTO public.opportunity_nda_artifacts (
    opportunity_id,
    match_id,
    document_id,
    artifact_role,
    version_number,
    content_sha256,
    supersedes_artifact_id,
    recorded_by
  )
  VALUES (
    p_opportunity_id,
    p_match_id,
    new_document_id,
    normalized_role,
    next_version,
    normalized_content_sha256,
    prior_artifact_id,
    normalized_actor
  )
  RETURNING id INTO new_artifact_id;

  RETURN QUERY
  SELECT new_artifact_id, new_document_id, next_version;
END;
$$;

REVOKE ALL ON FUNCTION public.register_opportunity_nda_artifact(
  UUID,
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  BIGINT,
  TEXT,
  TEXT
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.register_opportunity_nda_artifact(
  UUID,
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  BIGINT,
  TEXT,
  TEXT
) TO service_role;

COMMENT ON TABLE public.opportunity_nda_artifacts IS
  'Immutable, versioned staff-only NDA evidence. Legacy match NDA fields are not canonical artifacts.';
COMMENT ON COLUMN public.opportunity_nda_artifacts.artifact_role IS
  'blank_template is opportunity-scoped; signed copies are pursuit-scoped.';
COMMENT ON FUNCTION public.register_opportunity_nda_artifact(
  UUID,
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  BIGINT,
  TEXT,
  TEXT
) IS
  'Registers a new immutable NDA artifact version and its retained staff-only document.';
