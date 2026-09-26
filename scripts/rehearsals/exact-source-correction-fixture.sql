-- Synthetic seam for #191. The runner installs the actual 076/080/089
-- integrity functions and migration 125 after this minimal parent schema.
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE ROLE postgres NOLOGIN;
CREATE TYPE public.opportunity_nda_artifact_role AS ENUM
  ('blank_template','renew_signed_copy','repreneur_signed_copy');
CREATE TYPE public.opportunity_pursuit_evidence_type AS ENUM
  ('mutual_interest_validated','qualification_requested','intermediary_qualified',
   'template_validated','gate_1_passed','renew_signed_copy_validated',
   'repreneur_signed_copy_validated','gate_2_passed','manual_package_dispatched',
   'confidential_access_granted','access_revoked','continued','dropped','reopened','completed');

CREATE TABLE public."user" (id TEXT PRIMARY KEY, email TEXT NOT NULL);
CREATE TABLE public.app_user_roles (user_id TEXT, email TEXT, role TEXT NOT NULL);
CREATE TABLE public.ma_firms (id UUID PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE public.ma_offices (id UUID PRIMARY KEY, firm_id UUID NOT NULL REFERENCES public.ma_firms(id), name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', is_default BOOLEAN NOT NULL DEFAULT FALSE, updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE public.ma_contacts (id UUID PRIMARY KEY, first_name TEXT, last_name TEXT, display_name TEXT NOT NULL,
  email TEXT, phone TEXT, status TEXT NOT NULL DEFAULT 'active', updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE public.ma_contact_office_affiliations (id UUID PRIMARY KEY, contact_id UUID NOT NULL REFERENCES public.ma_contacts(id),
  office_id UUID NOT NULL REFERENCES public.ma_offices(id), is_active BOOLEAN NOT NULL DEFAULT TRUE, ended_at DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE public.opportunities (id UUID PRIMARY KEY, reference TEXT NOT NULL UNIQUE, status TEXT NOT NULL,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE, source_identity_to_verify BOOLEAN NOT NULL DEFAULT TRUE,
  source_office_id UUID REFERENCES public.ma_offices(id), source_id UUID, source_label TEXT,
  description TEXT NOT NULL, updated_by TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE public.opportunity_ma_contacts (id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id), affiliation_id UUID NOT NULL REFERENCES public.ma_contact_office_affiliations(id),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE, is_active BOOLEAN NOT NULL DEFAULT TRUE, linked_by TEXT, linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_by TEXT, removed_at TIMESTAMPTZ, contact_name_snapshot TEXT, contact_email_snapshot TEXT, contact_phone_snapshot TEXT,
  UNIQUE(opportunity_id,affiliation_id));
CREATE UNIQUE INDEX one_current_primary ON public.opportunity_ma_contacts(opportunity_id) WHERE is_active AND is_primary;

CREATE TABLE public.repreneurs (id UUID PRIMARY KEY, is_demo BOOLEAN NOT NULL DEFAULT FALSE);
CREATE TABLE public.opportunity_matches (id UUID PRIMARY KEY, opportunity_id UUID NOT NULL REFERENCES public.opportunities(id),
  repreneur_id UUID NOT NULL REFERENCES public.repreneurs(id), status TEXT NOT NULL,
  nda_status TEXT, nda_document_id UUID);
CREATE TABLE public.opportunity_pursuit_events (id UUID PRIMARY KEY, opportunity_id UUID NOT NULL REFERENCES public.opportunities(id));
CREATE TABLE public.opportunity_pursuit_evidence (id UUID PRIMARY KEY, opportunity_id UUID NOT NULL REFERENCES public.opportunities(id),
  match_id UUID REFERENCES public.opportunity_matches(id), event_type public.opportunity_pursuit_evidence_type NOT NULL,
  nda_artifact_id UUID, recorded_at TIMESTAMPTZ NOT NULL, metadata JSONB NOT NULL DEFAULT '{}'::JSONB);
CREATE TABLE public.wave_journey_settings (singleton BOOLEAN PRIMARY KEY, enabled BOOLEAN NOT NULL);
CREATE TABLE public.opportunity_pursuit_confidential_grants (id UUID PRIMARY KEY, opportunity_id UUID NOT NULL REFERENCES public.opportunities(id),
  match_id UUID NOT NULL REFERENCES public.opportunity_matches(id), information_memo_document_id UUID,
  cycle_started_evidence_id UUID, gate_2_evidence_id UUID, dispatch_evidence_id UUID,
  nda_expires_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ);
CREATE TABLE public.opportunity_pursuit_handoff_deliveries (id UUID PRIMARY KEY, match_id UUID NOT NULL REFERENCES public.opportunity_matches(id));
CREATE TABLE public.opportunity_documents (id UUID PRIMARY KEY, opportunity_id UUID NOT NULL REFERENCES public.opportunities(id), title TEXT,
  document_type TEXT NOT NULL DEFAULT 'other', recipient_match_id UUID, recipient_repreneur_id UUID,
  visibility TEXT NOT NULL DEFAULT 'staff_only', external_url TEXT, storage_bucket TEXT, storage_path TEXT,
  file_name TEXT, mime_type TEXT, size_bytes BIGINT);
CREATE TABLE public.opportunity_nda_artifacts (id UUID PRIMARY KEY, opportunity_id UUID NOT NULL REFERENCES public.opportunities(id),
  match_id UUID REFERENCES public.opportunity_matches(id), artifact_role public.opportunity_nda_artifact_role NOT NULL,
  version_number INTEGER NOT NULL, document_id UUID REFERENCES public.opportunity_documents(id));
CREATE TABLE public.ma_source_email_send_reservations (opportunity_id UUID PRIMARY KEY REFERENCES public.opportunities(id),
  reservation_token UUID NOT NULL, expires_at TIMESTAMPTZ NOT NULL);
CREATE TABLE public.staff_email_reviews (id UUID PRIMARY KEY, opportunity_id UUID NOT NULL REFERENCES public.opportunities(id), state TEXT NOT NULL);
CREATE TABLE public.staff_email_review_events (id UUID PRIMARY KEY, review_id UUID NOT NULL REFERENCES public.staff_email_reviews(id));
CREATE TABLE public.opportunity_source_contacts (opportunity_id UUID NOT NULL REFERENCES public.opportunities(id),
  source_id UUID NOT NULL, contact_id UUID NOT NULL, PRIMARY KEY(opportunity_id,source_id,contact_id));
CREATE TABLE public.ma_source_interactions (id UUID PRIMARY KEY, opportunity_id UUID NOT NULL REFERENCES public.opportunities(id), status TEXT NOT NULL DEFAULT 'sent');
CREATE TABLE public.opportunity_memo_notifications (id UUID PRIMARY KEY, opportunity_id UUID NOT NULL REFERENCES public.opportunities(id));
CREATE TABLE public.recipient_im_cleanup (document_id UUID PRIMARY KEY, opportunity_id UUID NOT NULL REFERENCES public.opportunities(id));

INSERT INTO public."user" VALUES ('staff-191','staff-191@example.test'),('other-191','other-191@example.test'),('rep-191','rep-191@example.test');
INSERT INTO public.app_user_roles VALUES ('staff-191','staff-191@example.test','staff'),('other-191','other-191@example.test','staff'),('rep-191','rep-191@example.test','repreneur');
INSERT INTO public.ma_firms VALUES
  ('19100000-0000-4000-8000-000000000001','Synthetic original','active',NOW()),
  ('19100000-0000-4000-8000-000000000002','Synthetic target A','active',NOW()),
  ('19100000-0000-4000-8000-000000000003','Synthetic target B','active',NOW());
INSERT INTO public.ma_offices VALUES
  ('19100000-0000-4000-8000-000000000011','19100000-0000-4000-8000-000000000001','Original office','active',FALSE,NOW()),
  ('19100000-0000-4000-8000-000000000012','19100000-0000-4000-8000-000000000002','Target office A','active',FALSE,NOW()),
  ('19100000-0000-4000-8000-000000000013','19100000-0000-4000-8000-000000000003','Target office B','active',FALSE,NOW());
INSERT INTO public.ma_contacts VALUES
  ('19100000-0000-4000-8000-000000000021','Original','Contact','Original Contact','original@example.test',NULL,'active',NOW()),
  ('19100000-0000-4000-8000-000000000022','Target','Contact A','Target Contact A','target-a@example.test',NULL,'active',NOW()),
  ('19100000-0000-4000-8000-000000000023','Target','Contact B','Target Contact B','target-b@example.test',NULL,'active',NOW()),
  ('19100000-0000-4000-8000-000000000024','Original','Secondary','Original Secondary','secondary@example.test',NULL,'active',NOW());
INSERT INTO public.ma_contact_office_affiliations VALUES
  ('19100000-0000-4000-8000-000000000031','19100000-0000-4000-8000-000000000021','19100000-0000-4000-8000-000000000011',TRUE,NULL,NOW()),
  ('19100000-0000-4000-8000-000000000032','19100000-0000-4000-8000-000000000022','19100000-0000-4000-8000-000000000012',TRUE,NULL,NOW()),
  ('19100000-0000-4000-8000-000000000033','19100000-0000-4000-8000-000000000023','19100000-0000-4000-8000-000000000013',TRUE,NULL,NOW()),
  ('19100000-0000-4000-8000-000000000034','19100000-0000-4000-8000-000000000024','19100000-0000-4000-8000-000000000011',TRUE,NULL,NOW());
INSERT INTO public.opportunities VALUES
  ('19100000-0000-4000-8000-000000000041','SYN-191-A','paused',FALSE,TRUE,'19100000-0000-4000-8000-000000000011',NULL,'legacy-A','Synthetic A','staff-191',NOW()),
  ('19100000-0000-4000-8000-000000000042','SYN-191-B','paused',FALSE,TRUE,'19100000-0000-4000-8000-000000000011',NULL,'legacy-B','Synthetic B','staff-191',NOW()),
  ('19100000-0000-4000-8000-000000000043','SYN-191-C','paused',FALSE,TRUE,'19100000-0000-4000-8000-000000000011',NULL,'legacy-C','Synthetic C','staff-191',NOW());
INSERT INTO public.opportunity_ma_contacts(id,opportunity_id,affiliation_id,is_primary,linked_by) VALUES
  ('19100000-0000-4000-8000-000000000051','19100000-0000-4000-8000-000000000041','19100000-0000-4000-8000-000000000031',TRUE,'staff-191'),
  ('19100000-0000-4000-8000-000000000052','19100000-0000-4000-8000-000000000042','19100000-0000-4000-8000-000000000031',TRUE,'staff-191'),
  ('19100000-0000-4000-8000-000000000053','19100000-0000-4000-8000-000000000043','19100000-0000-4000-8000-000000000031',TRUE,'staff-191'),
  ('19100000-0000-4000-8000-000000000054','19100000-0000-4000-8000-000000000041','19100000-0000-4000-8000-000000000034',FALSE,'staff-191');
INSERT INTO public.repreneurs VALUES ('19100000-0000-4000-8000-000000000081',FALSE);
INSERT INTO public.wave_journey_settings VALUES (TRUE,TRUE);
INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,nda_status,nda_document_id)
VALUES ('19100000-0000-4000-8000-000000000061','19100000-0000-4000-8000-000000000042',
  '19100000-0000-4000-8000-000000000081','active_pursuit','signed','19100000-0000-4000-8000-000000000071');
-- The old generic qualification predates the current pursuit cycle. Legacy
-- match NDA fields and a retained document do not turn it into current gates.
INSERT INTO public.opportunity_pursuit_evidence(id,opportunity_id,match_id,event_type,recorded_at) VALUES
  ('19100000-0000-4000-8000-000000000062','19100000-0000-4000-8000-000000000042',
   '19100000-0000-4000-8000-000000000061','qualification_requested','2026-09-01T12:00:00Z'),
  ('19100000-0000-4000-8000-000000000063','19100000-0000-4000-8000-000000000042',
   '19100000-0000-4000-8000-000000000061','mutual_interest_validated','2026-09-02T12:00:00Z');
INSERT INTO public.opportunity_documents(id,opportunity_id,title,document_type) VALUES
  ('19100000-0000-4000-8000-000000000071','19100000-0000-4000-8000-000000000042','Retained document','deal_book');
INSERT INTO public.opportunity_documents(id,opportunity_id,title,document_type,visibility,storage_bucket,
  storage_path,file_name,mime_type,size_bytes) VALUES
  ('19100000-0000-4000-8000-000000000072','19100000-0000-4000-8000-000000000042',
   'Retained blank NDA','nda','staff_only','opportunity-documents',
   '19100000-0000-4000-8000-000000000042/nda-artifacts/blank_template/synthetic.pdf',
   'synthetic.pdf','application/pdf',128);
INSERT INTO public.opportunity_nda_artifacts(id,opportunity_id,match_id,artifact_role,version_number,document_id)
VALUES ('19100000-0000-4000-8000-000000000073','19100000-0000-4000-8000-000000000042',
  NULL,'blank_template',1,'19100000-0000-4000-8000-000000000072');
