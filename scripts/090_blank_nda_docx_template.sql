-- W-089 extension: a reusable opportunity-level blank NDA may be a PDF or DOCX.
-- Signed copies and every other controlled journey artifact remain PDF-only.

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
      'Canonical NDA artifact documents require one retained private file.';
  END IF;

  IF linked_document_storage_path NOT LIKE
    NEW.opportunity_id::TEXT || '/nda-artifacts/' || NEW.artifact_role::TEXT || '/%'
    OR linked_document_file_name IS NULL
    OR linked_document_size_bytes IS NULL
    OR linked_document_size_bytes <= 0
  THEN
    RAISE EXCEPTION
      'Canonical stored NDA artifacts must be positive-size files in their role folder.';
  END IF;

  IF NEW.artifact_role = 'blank_template' THEN
    IF NOT (
      (LOWER(linked_document_file_name) LIKE '%.pdf' AND linked_document_mime_type = 'application/pdf')
      OR (
        LOWER(linked_document_file_name) LIKE '%.docx'
        AND linked_document_mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
    ) THEN
      RAISE EXCEPTION 'Stored blank NDA templates must be PDF or DOCX files.';
    END IF;
  ELSIF LOWER(linked_document_file_name) NOT LIKE '%.pdf'
    OR linked_document_mime_type <> 'application/pdf'
  THEN
    RAISE EXCEPTION 'Signed NDA artifacts must be PDFs.';
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

CREATE OR REPLACE FUNCTION public.register_opportunity_nda_artifact(
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
RETURNS TABLE (artifact_id UUID, document_id UUID, version_number INTEGER)
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
  normalized_mime_type TEXT;
  match_opportunity_id UUID;
  prior_artifact_id UUID;
  next_version INTEGER;
  new_document_id UUID;
  new_artifact_id UUID;
  staff_role_count INTEGER;
BEGIN
  IF p_artifact_role IS NULL OR p_artifact_role NOT IN ('blank_template', 'renew_signed_copy', 'repreneur_signed_copy') THEN
    RAISE EXCEPTION 'Unsupported NDA artifact role.';
  END IF;
  normalized_role := p_artifact_role::public.opportunity_nda_artifact_role;

  IF normalized_title IS NULL THEN RAISE EXCEPTION 'Artifact title is required.'; END IF;
  IF normalized_actor IS NULL THEN RAISE EXCEPTION 'A staff actor is required.'; END IF;

  SELECT COUNT(*) INTO staff_role_count
  FROM public.app_user_roles
  WHERE LOWER(email) = LOWER(normalized_actor) AND role = 'staff';
  IF staff_role_count <> 1 THEN RAISE EXCEPTION 'Artifact registration requires one active staff identity.'; END IF;

  PERFORM 1 FROM public.opportunities WHERE id = p_opportunity_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opportunity not found.'; END IF;

  IF normalized_role = 'blank_template' THEN
    IF p_match_id IS NOT NULL THEN RAISE EXCEPTION 'A blank NDA template belongs to the opportunity, not a pursuit.'; END IF;
  ELSE
    IF p_match_id IS NULL THEN RAISE EXCEPTION 'A signed NDA copy requires a pursuit.'; END IF;
    SELECT opportunity_id INTO match_opportunity_id FROM public.opportunity_matches WHERE id = p_match_id;
    IF match_opportunity_id IS NULL THEN RAISE EXCEPTION 'Pursuit not found.'; END IF;
    IF match_opportunity_id <> p_opportunity_id THEN RAISE EXCEPTION 'Pursuit does not belong to the selected opportunity.'; END IF;
  END IF;

  IF normalized_path IS NULL THEN RAISE EXCEPTION 'Upload one retained NDA file.'; END IF;
  IF normalized_path NOT LIKE p_opportunity_id::TEXT || '/nda-artifacts/' || normalized_role::TEXT || '/%' THEN
    RAISE EXCEPTION 'Stored NDA artifact path is outside its canonical role folder.';
  END IF;
  IF normalized_file_name IS NULL THEN RAISE EXCEPTION 'Stored NDA artifacts require a file name.'; END IF;
  IF normalized_role = 'blank_template' AND LOWER(normalized_file_name) LIKE '%.docx' THEN
    normalized_mime_type := 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  ELSIF LOWER(normalized_file_name) LIKE '%.pdf' THEN
    normalized_mime_type := 'application/pdf';
  ELSIF normalized_role = 'blank_template' THEN
    RAISE EXCEPTION 'Stored blank NDA templates must be PDF or DOCX files.';
  ELSE
    RAISE EXCEPTION 'Signed NDA artifacts must be PDFs.';
  END IF;
  IF normalized_role <> 'blank_template' AND normalized_mime_type <> 'application/pdf' THEN
    RAISE EXCEPTION 'Signed NDA artifacts must be PDFs.';
  END IF;
  IF p_file_size IS NULL OR p_file_size <= 0 THEN RAISE EXCEPTION 'Stored NDA artifact file size must be positive.'; END IF;
  IF normalized_content_sha256 IS NULL OR normalized_content_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Stored NDA artifacts require a SHA-256 content digest.';
  END IF;

  SELECT artifact.id, artifact.version_number + 1 INTO prior_artifact_id, next_version
  FROM public.opportunity_nda_artifacts AS artifact
  WHERE artifact.opportunity_id = p_opportunity_id
    AND artifact.match_id IS NOT DISTINCT FROM p_match_id
    AND artifact.artifact_role = normalized_role
  ORDER BY artifact.version_number DESC LIMIT 1;
  IF next_version IS NULL THEN next_version := 1; END IF;

  INSERT INTO public.opportunity_documents (opportunity_id, title, document_type, visibility, storage_bucket, storage_path, external_url, file_name, size_bytes, mime_type, uploaded_by)
  VALUES (p_opportunity_id, normalized_title, 'nda', 'staff_only', 'opportunity-documents', normalized_path, NULL, normalized_file_name, p_file_size, normalized_mime_type, normalized_actor)
  RETURNING id INTO new_document_id;

  INSERT INTO public.opportunity_nda_artifacts (opportunity_id, match_id, document_id, artifact_role, version_number, content_sha256, supersedes_artifact_id, recorded_by)
  VALUES (p_opportunity_id, p_match_id, new_document_id, normalized_role, next_version, normalized_content_sha256, prior_artifact_id, normalized_actor)
  RETURNING id INTO new_artifact_id;

  RETURN QUERY SELECT new_artifact_id, new_document_id, next_version;
END;
$$;

CREATE OR REPLACE FUNCTION public.journey_repreneur_authorized_template(
  p_match_id UUID,
  p_repreneur_id UUID
)
RETURNS TABLE(document_id UUID, storage_bucket TEXT, storage_path TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT d.id, d.storage_bucket, d.storage_path
  FROM public.wave_journey_settings settings
  JOIN public.opportunity_matches match ON match.id=p_match_id
  JOIN public.opportunities opportunity ON opportunity.id=match.opportunity_id
  JOIN public.opportunity_nda_artifacts artifact ON artifact.id=public.journey_current_template_id(match.id)
  JOIN public.opportunity_documents d ON d.id=artifact.document_id
  WHERE settings.singleton=TRUE AND settings.enabled=TRUE
    AND match.repreneur_id=p_repreneur_id AND match.status='active_pursuit' AND opportunity.status='active'
    AND public.journey_current_gate_1_event(match.id) IS NOT NULL
    AND artifact.opportunity_id=match.opportunity_id AND artifact.match_id IS NULL AND artifact.artifact_role='blank_template'
    AND d.opportunity_id=match.opportunity_id AND d.document_type='nda' AND d.visibility='staff_only'
    AND d.external_url IS NULL AND d.storage_bucket='opportunity-documents'
    AND d.storage_path LIKE match.opportunity_id::TEXT||'/nda-artifacts/blank_template/%'
    AND (
      (LOWER(COALESCE(d.file_name,'')) LIKE '%.pdf' AND LOWER(COALESCE(d.mime_type,''))='application/pdf')
      OR (
        LOWER(COALESCE(d.file_name,'')) LIKE '%.docx'
        AND LOWER(COALESCE(d.mime_type,''))='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
    )
    AND COALESCE(d.size_bytes,0)>0
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.journey_repreneur_authorized_template(UUID,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.journey_repreneur_authorized_template(UUID,UUID) TO service_role;

COMMENT ON FUNCTION public.register_opportunity_nda_artifact(UUID,UUID,TEXT,TEXT,TEXT,TEXT,BIGINT,TEXT,TEXT) IS
  'Registers immutable NDA evidence: blank opportunity templates may be PDF or DOCX; signed copies remain PDF-only.';
