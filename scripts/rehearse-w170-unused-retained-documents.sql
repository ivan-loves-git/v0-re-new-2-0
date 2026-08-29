-- Disposable W-170 migration rehearsal. Run only against an isolated database:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f rehearse-w170-unused-retained-documents.sql
BEGIN;

CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;

CREATE TYPE public.opportunity_document_type AS ENUM ('source_teaser', 'teaser', 'deal_book', 'nda', 'other');
CREATE TABLE public.opportunities (id UUID PRIMARY KEY);
CREATE TABLE public.opportunity_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), opportunity_id UUID NOT NULL REFERENCES public.opportunities(id),
  title TEXT NOT NULL, document_type public.opportunity_document_type NOT NULL, visibility TEXT NOT NULL DEFAULT 'staff_only',
  storage_bucket TEXT NOT NULL DEFAULT 'opportunity-documents', storage_path TEXT, external_url TEXT
);
CREATE TYPE public.opportunity_nda_artifact_role AS ENUM ('blank_template', 'renew_signed_copy', 'repreneur_signed_copy');
CREATE TABLE public.opportunity_nda_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), opportunity_id UUID NOT NULL REFERENCES public.opportunities(id),
  match_id UUID, document_id UUID NOT NULL UNIQUE REFERENCES public.opportunity_documents(id),
  artifact_role public.opportunity_nda_artifact_role NOT NULL, version_number INTEGER NOT NULL,
  supersedes_artifact_id UUID UNIQUE REFERENCES public.opportunity_nda_artifacts(id)
);
CREATE TABLE public.opportunity_matches (id UUID PRIMARY KEY, nda_document_id UUID REFERENCES public.opportunity_documents(id));
CREATE TABLE public.opportunity_pursuit_confidential_grants (information_memo_document_id UUID NOT NULL REFERENCES public.opportunity_documents(id));
CREATE TABLE public.opportunity_pursuit_evidence (document_id UUID REFERENCES public.opportunity_documents(id), nda_artifact_id UUID REFERENCES public.opportunity_nda_artifacts(id));

\ir 117_remove_unused_retained_opportunity_documents.sql

CREATE TRIGGER opportunity_documents_retain_source_and_im BEFORE DELETE ON public.opportunity_documents
  FOR EACH ROW EXECUTE FUNCTION public.prevent_retained_opportunity_document_delete();
CREATE TRIGGER opportunity_nda_artifacts_immutable BEFORE DELETE ON public.opportunity_nda_artifacts
  FOR EACH ROW EXECUTE FUNCTION public.reject_opportunity_nda_artifact_mutation();
CREATE TRIGGER opportunity_documents_protect_nda_artifacts BEFORE DELETE ON public.opportunity_documents
  FOR EACH ROW EXECUTE FUNCTION public.reject_linked_nda_document_mutation();

INSERT INTO public.opportunities VALUES
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002');
INSERT INTO public.opportunity_documents (id, opportunity_id, title, document_type, storage_path) VALUES
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Unused IM', 'deal_book', 'one/unused-im.pdf'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Used IM', 'deal_book', 'one/used-im.pdf'),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'Original source teaser', 'source_teaser', 'one/source.pdf'),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 'NDA v1', 'nda', 'one/nda-v1.pdf'),
  ('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', 'NDA v2', 'nda', 'one/nda-v2.pdf');
INSERT INTO public.opportunity_nda_artifacts (id, opportunity_id, document_id, artifact_role, version_number, supersedes_artifact_id) VALUES
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'blank_template', 1, NULL),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'blank_template', 2, '20000000-0000-4000-8000-000000000001');
INSERT INTO public.opportunity_pursuit_confidential_grants VALUES ('10000000-0000-4000-8000-000000000002');

DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.remove_unused_retained_opportunity_document('00000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'Expected cross-opportunity rejection';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Expected cross-opportunity rejection' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM * FROM public.remove_unused_retained_opportunity_document('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003');
    RAISE EXCEPTION 'Expected source teaser rejection';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Expected source teaser rejection' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM * FROM public.remove_unused_retained_opportunity_document('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002');
    RAISE EXCEPTION 'Expected used IM rejection';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Expected used IM rejection' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM * FROM public.remove_unused_retained_opportunity_document('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004');
    RAISE EXCEPTION 'Expected superseded rejection';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Expected superseded rejection' THEN RAISE; END IF;
  END;
END;
$$;

SELECT * FROM public.remove_unused_retained_opportunity_document('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001');
SELECT * FROM public.remove_unused_retained_opportunity_document('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.opportunity_documents WHERE id IN ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005')) THEN
    RAISE EXCEPTION 'Eligible metadata remained live after removal';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.opportunity_nda_artifacts WHERE id = '20000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Removing the latest version did not restore the prior retained version as current';
  END IF;
  IF (SELECT count(*) FROM public.opportunity_document_storage_cleanup_receipts) <> 2 THEN
    RAISE EXCEPTION 'Expected one private cleanup receipt per metadata removal';
  END IF;
END;
$$;

ROLLBACK;
