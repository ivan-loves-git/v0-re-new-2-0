-- Synthetic disposable prerequisite and assertions for migration 082.
-- No project environment, production URL or real record is read.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END;
$$;

CREATE TYPE public.app_user_role AS ENUM ('staff', 'repreneur');
CREATE TYPE public.opportunity_document_type AS ENUM (
  'teaser',
  'deal_book',
  'nda',
  'external_analysis',
  'other'
);
CREATE TYPE public.opportunity_document_visibility AS ENUM (
  'staff_only',
  'approved_for_repreneur'
);

CREATE TABLE public.app_user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE,
  email TEXT NOT NULL UNIQUE,
  role public.app_user_role NOT NULL
);

CREATE TABLE public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE
);

CREATE TABLE public.opportunity_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL
    REFERENCES public.opportunities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  document_type public.opportunity_document_type NOT NULL DEFAULT 'other',
  visibility public.opportunity_document_visibility NOT NULL DEFAULT 'staff_only',
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

CREATE TABLE public.opportunity_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL
    REFERENCES public.opportunities(id) ON DELETE CASCADE,
  nda_status TEXT,
  nda_document_id UUID
    REFERENCES public.opportunity_documents(id) ON DELETE SET NULL
);

INSERT INTO public.app_user_roles (user_id, email, role)
VALUES
  ('staff-fixture', 'staff@example.test', 'staff'),
  ('repreneur-fixture', 'repreneur@example.test', 'repreneur');

INSERT INTO public.opportunities (id, reference)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'W043-PRIMARY'),
  ('00000000-0000-4000-8000-000000000002', 'W043-OTHER'),
  ('00000000-0000-4000-8000-000000000003', 'W043-RACE');

INSERT INTO public.opportunity_documents (
  id,
  opportunity_id,
  title,
  document_type,
  visibility,
  external_url,
  uploaded_by
)
VALUES (
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'Legacy NDA link',
  'nda',
  'staff_only',
  'https://example.test/legacy-nda.pdf',
  'legacy-fixture'
);

INSERT INTO public.opportunity_matches (
  id,
  opportunity_id,
  nda_status,
  nda_document_id
)
VALUES
  (
    '20000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'signed',
    '10000000-0000-4000-8000-000000000001'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000002',
    'not_required',
    NULL
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000003',
    'not_required',
    NULL
  );

\ir 082_opportunity_nda_artifact_foundation.sql

-- Applying the migration twice against its own objects must remain clean.
\ir 082_opportunity_nda_artifact_foundation.sql

CREATE OR REPLACE FUNCTION public.w043_assert_raises(
  p_statement TEXT,
  p_expected_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    EXECUTE p_statement;
  EXCEPTION
    WHEN OTHERS THEN
      IF POSITION(p_expected_message IN SQLERRM) = 0 THEN
        RAISE EXCEPTION
          'Expected error containing %, received %',
          p_expected_message,
          SQLERRM;
      END IF;
      RETURN;
  END;

  RAISE EXCEPTION 'Expected statement to fail with %', p_expected_message;
END;
$$;

SET ROLE service_role;

SELECT *
FROM public.register_opportunity_nda_artifact(
  '00000000-0000-4000-8000-000000000001',
  NULL,
  'blank_template',
  'Blank NDA v1',
  '00000000-0000-4000-8000-000000000001/nda-artifacts/blank_template/blank-v1.pdf',
  'blank-v1.pdf',
  1024,
  REPEAT('a', 64),
  'staff@example.test'
);

SELECT *
FROM public.register_opportunity_nda_artifact(
  '00000000-0000-4000-8000-000000000001',
  NULL,
  'blank_template',
  'Blank NDA v2',
  '00000000-0000-4000-8000-000000000001/nda-artifacts/blank_template/blank-v2.pdf',
  'blank-v2.pdf',
  2048,
  REPEAT('b', 64),
  'staff@example.test'
);

SELECT *
FROM public.register_opportunity_nda_artifact(
  '00000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'renew_signed_copy',
  'Re-New signed v1',
  '00000000-0000-4000-8000-000000000001/nda-artifacts/renew_signed_copy/renew-signed-v1.pdf',
  'renew-signed-v1.pdf',
  3072,
  REPEAT('c', 64),
  'staff@example.test'
);

SELECT *
FROM public.register_opportunity_nda_artifact(
  '00000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'repreneur_signed_copy',
  'Repreneur signed v1',
  '00000000-0000-4000-8000-000000000001/nda-artifacts/repreneur_signed_copy/repreneur-signed-v1.pdf',
  'repreneur-signed-v1.pdf',
  4096,
  REPEAT('d', 64),
  'staff@example.test'
);

RESET ROLE;

DO $$
DECLARE
  first_blank public.opportunity_nda_artifacts;
  second_blank public.opportunity_nda_artifacts;
BEGIN
  SELECT *
  INTO first_blank
  FROM public.opportunity_nda_artifacts
  WHERE artifact_role = 'blank_template'
    AND version_number = 1;

  SELECT *
  INTO second_blank
  FROM public.opportunity_nda_artifacts
  WHERE artifact_role = 'blank_template'
    AND version_number = 2;

  IF first_blank.id IS NULL
    OR second_blank.supersedes_artifact_id IS DISTINCT FROM first_blank.id
  THEN
    RAISE EXCEPTION 'W-043 blank version chain was not retained';
  END IF;

  IF (
    SELECT COUNT(*)
    FROM public.opportunity_nda_artifacts
    WHERE match_id = '20000000-0000-4000-8000-000000000001'
      AND artifact_role IN ('renew_signed_copy', 'repreneur_signed_copy')
      AND version_number = 1
  ) <> 2 THEN
    RAISE EXCEPTION 'W-043 signed pursuit roles were not recorded independently';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.opportunity_nda_artifacts artifact
    JOIN public.opportunity_matches match
      ON match.nda_document_id = artifact.document_id
  ) THEN
    RAISE EXCEPTION 'Legacy NDA evidence was promoted into canonical artifacts';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.opportunity_nda_artifacts artifact
    JOIN public.opportunity_documents document
      ON document.id = artifact.document_id
    WHERE document.document_type <> 'nda'
      OR document.visibility <> 'staff_only'
      OR document.opportunity_id <> artifact.opportunity_id
      OR document.storage_path IS NULL
      OR document.external_url IS NOT NULL
      OR document.mime_type <> 'application/pdf'
      OR document.size_bytes IS NULL
      OR document.size_bytes <= 0
  ) THEN
    RAISE EXCEPTION 'Canonical artifact document boundary is invalid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.opportunity_nda_artifacts
    WHERE content_sha256 !~ '^[0-9a-f]{64}$'
  ) THEN
    RAISE EXCEPTION 'Canonical artifact digest evidence is invalid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.opportunity_nda_artifacts artifact
    JOIN public.opportunity_documents document
      ON document.id = artifact.document_id
    GROUP BY document.storage_bucket, document.storage_path
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Canonical artifact storage paths were reused';
  END IF;
END;
$$;

SELECT public.w043_assert_raises(
  $statement$
    SELECT public.register_opportunity_nda_artifact(
      '00000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
      'renew_signed_copy',
      'Wrong opportunity',
      '00000000-0000-4000-8000-000000000001/nda-artifacts/renew_signed_copy/wrong-opportunity.pdf',
      'wrong-opportunity.pdf',
      100,
      REPEAT('e', 64),
      'staff@example.test'
    )
  $statement$,
  'Pursuit does not belong'
);

SELECT public.w043_assert_raises(
  $statement$
    SELECT public.register_opportunity_nda_artifact(
      '00000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      'blank_template',
      'Wrong scope',
      '00000000-0000-4000-8000-000000000001/nda-artifacts/blank_template/wrong-scope.pdf',
      'wrong-scope.pdf',
      100,
      REPEAT('f', 64),
      'staff@example.test'
    )
  $statement$,
  'blank NDA template belongs to the opportunity'
);

SELECT public.w043_assert_raises(
  $statement$
    SELECT public.register_opportunity_nda_artifact(
      '00000000-0000-4000-8000-000000000001',
      NULL,
      'blank_template',
      'Wrong actor',
      '00000000-0000-4000-8000-000000000001/nda-artifacts/blank_template/wrong-actor.pdf',
      'wrong-actor.pdf',
      100,
      REPEAT('1', 64),
      'repreneur@example.test'
    )
  $statement$,
  'requires one active staff identity'
);

SELECT public.w043_assert_raises(
  $statement$
    SELECT public.register_opportunity_nda_artifact(
      '00000000-0000-4000-8000-000000000001',
      NULL,
      'blank_template',
      'Missing digest',
      '00000000-0000-4000-8000-000000000001/nda-artifacts/blank_template/missing-digest.pdf',
      'missing-digest.pdf',
      100,
      NULL,
      'staff@example.test'
    )
  $statement$,
  'require a SHA-256 content digest'
);

SELECT public.w043_assert_raises(
  $statement$
    SELECT public.register_opportunity_nda_artifact(
      '00000000-0000-4000-8000-000000000001',
      NULL,
      'blank_template',
      'Wrong file',
      '00000000-0000-4000-8000-000000000001/nda-artifacts/blank_template/not-a-pdf.txt',
      'not-a-pdf.txt',
      10,
      REPEAT('2', 64),
      'staff@example.test'
    )
  $statement$,
  'must be PDF'
);

SELECT public.w043_assert_raises(
  $statement$
    SELECT public.register_opportunity_nda_artifact(
      '00000000-0000-4000-8000-000000000001',
      NULL,
      'blank_template',
      'Reused object path',
      '00000000-0000-4000-8000-000000000001/nda-artifacts/blank_template/blank-v1.pdf',
      'another-blank.pdf',
      512,
      REPEAT('3', 64),
      'staff@example.test'
    )
  $statement$,
  'storage paths must be unique'
);

SELECT public.w043_assert_raises(
  $statement$
    UPDATE public.opportunity_nda_artifacts
    SET recorded_by = 'other-staff@example.test'
    WHERE artifact_role = 'blank_template'
      AND version_number = 1
  $statement$,
  'immutable'
);

SELECT public.w043_assert_raises(
  $statement$
    DELETE FROM public.opportunity_nda_artifacts
    WHERE artifact_role = 'blank_template'
      AND version_number = 1
  $statement$,
  'immutable'
);

SELECT public.w043_assert_raises(
  $statement$
    UPDATE public.opportunity_documents
    SET visibility = 'approved_for_repreneur'
    WHERE id = (
      SELECT document_id
      FROM public.opportunity_nda_artifacts
      WHERE artifact_role = 'blank_template'
        AND version_number = 1
    )
  $statement$,
  'retained canonical NDA evidence'
);

SELECT public.w043_assert_raises(
  $statement$
    DELETE FROM public.opportunity_documents
    WHERE id = (
      SELECT document_id
      FROM public.opportunity_nda_artifacts
      WHERE artifact_role = 'blank_template'
        AND version_number = 1
    )
  $statement$,
  'retained canonical NDA evidence'
);

INSERT INTO public.opportunity_documents (
  id,
  opportunity_id,
  title,
  document_type,
  visibility,
  storage_bucket,
  storage_path,
  file_name,
  mime_type,
  size_bytes,
  uploaded_by
)
VALUES (
  '10000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  'Wrong chain fixture',
  'nda',
  'staff_only',
  'opportunity-documents',
  '00000000-0000-4000-8000-000000000001/nda-artifacts/blank_template/wrong-chain.pdf',
  'wrong-chain.pdf',
  'application/pdf',
  100,
  'staff@example.test'
);

SELECT public.w043_assert_raises(
  $statement$
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
    SELECT
      '00000000-0000-4000-8000-000000000001',
      NULL,
      '10000000-0000-4000-8000-000000000002',
      'blank_template',
      3,
      REPEAT('4', 64),
      artifact.id,
      'staff@example.test'
    FROM public.opportunity_nda_artifacts artifact
    WHERE artifact.artifact_role = 'renew_signed_copy'
      AND artifact.version_number = 1
  $statement$,
  'immediately previous version in the same scope and role'
);

DO $$
BEGIN
  IF has_table_privilege(
    'anon',
    'public.opportunity_nda_artifacts',
    'SELECT,INSERT,UPDATE,DELETE'
  ) OR has_table_privilege(
    'authenticated',
    'public.opportunity_nda_artifacts',
    'SELECT,INSERT,UPDATE,DELETE'
  ) THEN
    RAISE EXCEPTION 'Browser roles can access canonical NDA artifacts';
  END IF;

  IF NOT has_table_privilege(
    'service_role',
    'public.opportunity_nda_artifacts',
    'SELECT'
  ) OR has_table_privilege(
    'service_role',
    'public.opportunity_nda_artifacts',
    'INSERT,UPDATE,DELETE'
  ) THEN
    RAISE EXCEPTION 'Service-role canonical NDA artifact grants are invalid';
  END IF;

  IF NOT has_function_privilege(
    'service_role',
    'public.register_opportunity_nda_artifact(uuid,uuid,text,text,text,text,bigint,text,text)',
    'EXECUTE'
  ) OR has_function_privilege(
    'anon',
    'public.register_opportunity_nda_artifact(uuid,uuid,text,text,text,text,bigint,text,text)',
    'EXECUTE'
  ) OR has_function_privilege(
    'authenticated',
    'public.register_opportunity_nda_artifact(uuid,uuid,text,text,text,text,bigint,text,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Canonical NDA artifact RPC grants are invalid';
  END IF;
END;
$$;

SELECT 'W-043 synthetic migration and boundary assertions passed' AS result;
