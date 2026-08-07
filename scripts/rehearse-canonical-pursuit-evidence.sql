-- Disposable PG17 proof for W-090/W-091. It creates only TEST fixtures and
-- runs them in action-sized transactions on a disposable cluster.
\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
CREATE TYPE public.app_user_role AS ENUM ('staff','repreneur');
CREATE TYPE public.opportunity_status AS ENUM ('draft','active','paused','closed','archived');
CREATE TYPE public.opportunity_match_status AS ENUM ('shortlisted','proposed','interested','declined','active_pursuit','dropped');
CREATE TYPE public.opportunity_document_type AS ENUM ('teaser','deal_book','nda','external_analysis','other');
CREATE TYPE public.opportunity_document_visibility AS ENUM ('staff_only','approved_for_repreneur');
CREATE TYPE public.opportunity_closure_reason AS ENUM ('stale','sold','signed_repreneur','paused_cabinet','withdrawn_seller','no_viable_match','dd_disqualified','duplicate');
CREATE TABLE public.app_user_roles (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id TEXT UNIQUE, email TEXT NOT NULL UNIQUE, role public.app_user_role NOT NULL);
CREATE TABLE public.ma_firms (id UUID PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL);
CREATE TABLE public.ma_offices (id UUID PRIMARY KEY, firm_id UUID NOT NULL REFERENCES public.ma_firms(id), name TEXT NOT NULL, status TEXT NOT NULL);
CREATE TABLE public.ma_contacts (id UUID PRIMARY KEY, email TEXT);
CREATE TABLE public.ma_contact_office_affiliations (id UUID PRIMARY KEY, contact_id UUID NOT NULL REFERENCES public.ma_contacts(id), office_id UUID NOT NULL REFERENCES public.ma_offices(id));
CREATE TABLE public.opportunities (id UUID PRIMARY KEY, reference TEXT NOT NULL UNIQUE, status public.opportunity_status NOT NULL, source_office_id UUID REFERENCES public.ma_offices(id), public_title TEXT, sector TEXT, location TEXT, teaser_summary TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_by TEXT);
CREATE TABLE public.repreneurs (id UUID PRIMARY KEY, email TEXT NOT NULL, first_name TEXT);
CREATE TABLE public.opportunity_documents (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), opportunity_id UUID NOT NULL REFERENCES public.opportunities(id), title TEXT NOT NULL, document_type public.opportunity_document_type NOT NULL DEFAULT 'other', visibility public.opportunity_document_visibility NOT NULL DEFAULT 'staff_only', storage_bucket TEXT NOT NULL DEFAULT 'opportunity-documents', storage_path TEXT, external_url TEXT, file_name TEXT, mime_type TEXT, size_bytes BIGINT, uploaded_by TEXT, uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CHECK (storage_path IS NOT NULL OR external_url IS NOT NULL));
CREATE TABLE public.opportunity_matches (id UUID PRIMARY KEY, opportunity_id UUID NOT NULL REFERENCES public.opportunities(id), repreneur_id UUID NOT NULL REFERENCES public.repreneurs(id), status public.opportunity_match_status NOT NULL, nda_status TEXT, nda_document_id UUID REFERENCES public.opportunity_documents(id), pursuit_stage TEXT, pursuit_stage_notes TEXT, pursuit_stage_updated_by TEXT, pursuit_stage_updated_at TIMESTAMPTZ, reviewed_by TEXT, reviewed_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(opportunity_id, repreneur_id));
CREATE TABLE public.opportunity_ma_contacts (id UUID PRIMARY KEY, opportunity_id UUID NOT NULL REFERENCES public.opportunities(id), affiliation_id UUID NOT NULL REFERENCES public.ma_contact_office_affiliations(id), contact_name_snapshot TEXT NOT NULL, contact_email_snapshot TEXT, is_primary BOOLEAN NOT NULL DEFAULT FALSE, is_active BOOLEAN NOT NULL DEFAULT TRUE, linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE public.opportunity_memo_notifications (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), match_id UUID NOT NULL UNIQUE, opportunity_id UUID NOT NULL, repreneur_id UUID NOT NULL, recipient_email TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', sent_at TIMESTAMPTZ, attempt_count INTEGER NOT NULL DEFAULT 0, last_attempt_at TIMESTAMPTZ, failed_at TIMESTAMPTZ, last_error TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE public.opportunity_closure_history (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), opportunity_id UUID NOT NULL REFERENCES public.opportunities(id), reason public.opportunity_closure_reason NOT NULL, closed_by TEXT NOT NULL, closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

INSERT INTO public.app_user_roles(user_id,email,role) VALUES ('test-staff','staff@test.invalid','staff');
INSERT INTO public.ma_firms VALUES ('10000000-0000-4000-8000-000000000001','TEST Source','active');
INSERT INTO public.ma_offices VALUES ('11000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','TEST Office','active');
INSERT INTO public.ma_contacts VALUES ('12000000-0000-4000-8000-000000000001','source@test.invalid');
INSERT INTO public.ma_contact_office_affiliations VALUES ('13000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001');
INSERT INTO public.opportunities VALUES ('20000000-0000-4000-8000-000000000001','TEST-W090','active','11000000-0000-4000-8000-000000000001','TEST opportunity','industry','Paris','TEST teaser');
INSERT INTO public.repreneurs VALUES ('30000000-0000-4000-8000-000000000001','buyer@test.invalid','Buyer');
INSERT INTO public.repreneurs VALUES ('30000000-0000-4000-8000-000000000002','legacy@test.invalid','Legacy');
INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status) VALUES ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','interested');
INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,pursuit_stage) VALUES ('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','active_pursuit','info_memo_received');
INSERT INTO public.opportunity_ma_contacts(id,opportunity_id,affiliation_id,contact_name_snapshot,contact_email_snapshot,is_primary) VALUES ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','13000000-0000-4000-8000-000000000001','TEST source contact','source@test.invalid',TRUE);
INSERT INTO public.opportunity_documents(id,opportunity_id,title,document_type,visibility,storage_path,file_name,mime_type,size_bytes,uploaded_by) VALUES ('60000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','TEST IM','deal_book','staff_only','20000000-0000-4000-8000-000000000001/im/test.pdf','test.pdf','application/pdf',1,'staff@test.invalid');

\ir 082_opportunity_nda_artifact_foundation.sql
\ir 088_canonical_pursuit_evidence_and_confidentiality.sql
UPDATE public.wave_journey_settings SET enabled=TRUE, updated_by='staff@test.invalid';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.opportunity_pursuit_evidence WHERE match_id='40000000-0000-4000-8000-000000000002')<>1
    OR NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_evidence WHERE match_id='40000000-0000-4000-8000-000000000002' AND event_type='mutual_interest_validated') THEN RAISE EXCEPTION 'Backfill did not retain start-only evidence'; END IF;
END $$;
UPDATE public.opportunity_matches SET status='dropped' WHERE id='40000000-0000-4000-8000-000000000002';

CREATE OR REPLACE FUNCTION public.test_assert_raises(p_statement TEXT,p_message TEXT) RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN
  BEGIN EXECUTE p_statement; EXCEPTION WHEN OTHERS THEN IF POSITION(p_message IN SQLERRM)=0 THEN RAISE EXCEPTION 'Expected %, got %',p_message,SQLERRM; END IF; RETURN; END;
  RAISE EXCEPTION 'Expected failure containing %',p_message;
END $$;

SELECT public.test_assert_raises($$SELECT public.journey_record_evidence('40000000-0000-4000-8000-000000000001','manual_package_dispatched','staff@test.invalid','test:too-early')$$,'An active pursuit is required');
SELECT public.journey_start_pursuit('40000000-0000-4000-8000-000000000001','staff@test.invalid','test:start');
SELECT public.journey_record_evidence('40000000-0000-4000-8000-000000000001','qualification_requested','staff@test.invalid','test:request');
SELECT public.journey_record_evidence('40000000-0000-4000-8000-000000000001','intermediary_qualified','staff@test.invalid','test:qualified');
SELECT * FROM public.register_opportunity_nda_artifact('20000000-0000-4000-8000-000000000001',NULL,'blank_template','TEST blank','20000000-0000-4000-8000-000000000001/nda-artifacts/blank_template/test.pdf','test.pdf',1,repeat('a',64),'staff@test.invalid');
SELECT public.journey_record_evidence('40000000-0000-4000-8000-000000000001','template_validated','staff@test.invalid','test:template',(SELECT id FROM public.opportunity_nda_artifacts WHERE artifact_role='blank_template'));
SELECT * FROM public.register_opportunity_nda_artifact('20000000-0000-4000-8000-000000000001',NULL,'blank_template','TEST blank replacement','20000000-0000-4000-8000-000000000001/nda-artifacts/blank_template/test-v2.pdf','test-v2.pdf',1,repeat('e',64),'staff@test.invalid');
SELECT public.test_assert_raises($$SELECT public.journey_record_evidence('40000000-0000-4000-8000-000000000001','gate_1_passed','staff@test.invalid','test:stale-gate1')$$,'exact current-template validation');
SELECT public.journey_record_evidence('40000000-0000-4000-8000-000000000001','template_validated','staff@test.invalid','test:template-v2',(SELECT id FROM public.opportunity_nda_artifacts WHERE artifact_role='blank_template' ORDER BY version_number DESC LIMIT 1));
SELECT public.journey_record_evidence('40000000-0000-4000-8000-000000000001','gate_1_passed','staff@test.invalid','test:gate1');
SELECT * FROM public.register_opportunity_nda_artifact('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','renew_signed_copy','TEST Re-New','20000000-0000-4000-8000-000000000001/nda-artifacts/renew_signed_copy/test.pdf','test.pdf',1,repeat('b',64),'staff@test.invalid');
SELECT * FROM public.journey_submit_repreneur_signed_copy_v2('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','buyer@test.invalid','TEST buyer','20000000-0000-4000-8000-000000000001/nda-artifacts/repreneur_signed_copy/test.pdf','test.pdf',1,repeat('c',64));
DO $$ DECLARE v_reused BOOLEAN; BEGIN SELECT reused_existing INTO v_reused FROM public.journey_submit_repreneur_signed_copy_v2('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','buyer@test.invalid','TEST buyer duplicate','20000000-0000-4000-8000-000000000001/nda-artifacts/repreneur_signed_copy/duplicate.pdf','duplicate.pdf',1,repeat('c',64)); IF v_reused IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'Duplicate portal upload did not reuse the retained artifact'; END IF; END $$;
SELECT public.journey_record_evidence('40000000-0000-4000-8000-000000000001','renew_signed_copy_validated','staff@test.invalid','test:renew',(SELECT id FROM public.opportunity_nda_artifacts WHERE artifact_role='renew_signed_copy'));
SELECT public.journey_record_evidence('40000000-0000-4000-8000-000000000001','repreneur_signed_copy_validated','staff@test.invalid','test:buyer',(SELECT id FROM public.opportunity_nda_artifacts WHERE artifact_role='repreneur_signed_copy'));
SELECT public.journey_record_evidence('40000000-0000-4000-8000-000000000001','gate_2_passed','staff@test.invalid','test:gate2');
SELECT * FROM public.register_opportunity_nda_artifact('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','renew_signed_copy','TEST Re-New replacement','20000000-0000-4000-8000-000000000001/nda-artifacts/renew_signed_copy/test-v2.pdf','test-v2.pdf',1,repeat('f',64),'staff@test.invalid');
DO $$ BEGIN IF public.journey_current_gate_2_event('40000000-0000-4000-8000-000000000001') IS NOT NULL OR public.journey_current_dispatch_event('40000000-0000-4000-8000-000000000001') IS NOT NULL THEN RAISE EXCEPTION 'Signed-copy supersession retained Gate 2 or dispatch'; END IF; END $$;
SELECT public.journey_record_evidence('40000000-0000-4000-8000-000000000001','renew_signed_copy_validated','staff@test.invalid','test:renew-v2',(SELECT id FROM public.opportunity_nda_artifacts WHERE artifact_role='renew_signed_copy' ORDER BY version_number DESC LIMIT 1));
SELECT public.journey_record_evidence('40000000-0000-4000-8000-000000000001','gate_2_passed','staff@test.invalid','test:gate2-v2');
DO $$ DECLARE v_claim RECORD; BEGIN SELECT * INTO v_claim FROM public.claim_opportunity_memo_notification('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',clock_timestamp()); IF v_claim.match_id IS NOT NULL THEN RAISE EXCEPTION 'Legacy gate state claimed a memo notification before canonical grant'; END IF; END $$;
SELECT public.test_assert_raises($$SELECT public.journey_grant_confidential_access('40000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','staff@test.invalid','test:too-early-grant',NOW()+INTERVAL '1 day')$$,'manual dispatch');
SELECT public.journey_record_evidence('40000000-0000-4000-8000-000000000001','manual_package_dispatched','staff@test.invalid','test:dispatch');
SELECT public.journey_grant_confidential_access('40000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','staff@test.invalid','test:grant',NOW()+INTERVAL '1 day');
SELECT public.journey_grant_confidential_access('40000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','staff@test.invalid','test:grant',NOW()+INTERVAL '1 day');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.opportunity_pursuit_evidence WHERE match_id='40000000-0000-4000-8000-000000000001' AND event_type='confidential_access_granted')<>1 THEN RAISE EXCEPTION 'Grant wrote more than one immutable event'; END IF;
  IF NOT public.journey_repreneur_can_access_confidential('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Exact canonical grant did not permit access'; END IF;
  IF public.journey_repreneur_can_access_confidential('40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000009','60000000-0000-4000-8000-000000000001') OR public.journey_repreneur_can_access_confidential('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000009') THEN RAISE EXCEPTION 'Wrong owner or document was granted confidential access'; END IF;
END $$;
DO $$ DECLARE v_claim RECORD; BEGIN SELECT * INTO v_claim FROM public.claim_opportunity_memo_notification('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',clock_timestamp()) LIMIT 1; IF v_claim.match_id IS DISTINCT FROM '40000000-0000-4000-8000-000000000001'::UUID THEN RAISE EXCEPTION 'Exact canonical grant did not claim its notification'; END IF; END $$;
SELECT public.test_assert_raises($$SELECT public.journey_grant_confidential_access('40000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','staff@test.invalid','test:duplicate-grant',NOW()+INTERVAL '2 days')$$,'already live');
SELECT public.test_assert_raises($$SELECT * FROM public.register_opportunity_nda_artifact('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','repreneur_signed_copy','staff bypass','20000000-0000-4000-8000-000000000001/nda-artifacts/repreneur_signed_copy/bypass.pdf','bypass.pdf',1,repeat('d',64),'staff@test.invalid')$$,'only by the active repreneur');
SELECT public.journey_revoke_confidential_access('40000000-0000-4000-8000-000000000001','staff@test.invalid','TEST revoke','test:revoke');
DO $$ BEGIN
  IF public.journey_repreneur_can_access_confidential('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Revoked grant still permitted access'; END IF;
END $$;
SELECT public.journey_grant_confidential_access('40000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','staff@test.invalid','test:regrant',NOW()+INTERVAL '2 days');
DO $$ BEGIN IF (SELECT count(*) FROM public.opportunity_pursuit_evidence WHERE match_id='40000000-0000-4000-8000-000000000001' AND event_type='confidential_access_granted')<>2 THEN RAISE EXCEPTION 'Regrant did not retain exactly one new disclosure event'; END IF; END $$;
UPDATE public.opportunity_pursuit_confidential_grants SET nda_expires_at=clock_timestamp()-INTERVAL '1 second' WHERE match_id='40000000-0000-4000-8000-000000000001';
DO $$ BEGIN IF public.journey_repreneur_can_access_confidential('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Expired NDA still permitted access'; END IF; END $$;
UPDATE public.opportunity_pursuit_confidential_grants SET nda_expires_at=clock_timestamp()+INTERVAL '1 day' WHERE match_id='40000000-0000-4000-8000-000000000001';
SELECT public.test_assert_raises($$UPDATE public.opportunities SET status='closed' WHERE id='20000000-0000-4000-8000-000000000001'$$,'Active pursuit must be dropped or completed');
UPDATE public.opportunities SET status='paused' WHERE id='20000000-0000-4000-8000-000000000001';
UPDATE public.opportunities SET status='active' WHERE id='20000000-0000-4000-8000-000000000001';
DO $$ BEGIN IF public.journey_repreneur_can_access_confidential('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Pause/resume restored confidential access'; END IF; END $$;
SELECT public.journey_transition_terminal('40000000-0000-4000-8000-000000000001','drop','staff@test.invalid','test:drop');
SELECT public.journey_transition_terminal('40000000-0000-4000-8000-000000000001','reopen','staff@test.invalid','test:reopen');
DO $$ BEGIN
  IF public.journey_current_gate_1_event('40000000-0000-4000-8000-000000000001') IS NOT NULL OR public.journey_current_gate_2_event('40000000-0000-4000-8000-000000000001') IS NOT NULL THEN RAISE EXCEPTION 'Reopen inherited old gate evidence'; END IF;
END $$;
SELECT public.journey_start_pursuit('40000000-0000-4000-8000-000000000001','staff@test.invalid','test:second-cycle');
SELECT public.test_assert_raises($$SELECT public.journey_record_evidence('40000000-0000-4000-8000-000000000001','intermediary_qualified','staff@test.invalid','test:second-cycle-skip')$$,'qualification request');
-- The shell runner destroys the disposable cluster after this script exits.
