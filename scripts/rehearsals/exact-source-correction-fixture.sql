-- Synthetic seam for #191. The runner installs the actual 076/080/089
-- integrity functions and migration 125 after this minimal parent schema.
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE ROLE postgres NOLOGIN;

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

CREATE TABLE public.opportunity_matches (id UUID PRIMARY KEY, opportunity_id UUID NOT NULL REFERENCES public.opportunities(id), status TEXT NOT NULL);
CREATE TABLE public.opportunity_pursuit_events (id UUID PRIMARY KEY, opportunity_id UUID NOT NULL REFERENCES public.opportunities(id));
CREATE TABLE public.opportunity_pursuit_evidence (id UUID PRIMARY KEY, opportunity_id UUID NOT NULL REFERENCES public.opportunities(id),
  match_id UUID REFERENCES public.opportunity_matches(id), event_type TEXT NOT NULL);
CREATE TABLE public.opportunity_pursuit_confidential_grants (id UUID PRIMARY KEY, opportunity_id UUID NOT NULL REFERENCES public.opportunities(id), revoked_at TIMESTAMPTZ);
CREATE TABLE public.opportunity_pursuit_handoff_deliveries (id UUID PRIMARY KEY, match_id UUID NOT NULL REFERENCES public.opportunity_matches(id));
CREATE TABLE public.opportunity_documents (id UUID PRIMARY KEY, opportunity_id UUID NOT NULL REFERENCES public.opportunities(id), title TEXT);
CREATE TABLE public.opportunity_nda_artifacts (id UUID PRIMARY KEY, opportunity_id UUID NOT NULL REFERENCES public.opportunities(id), artifact_role TEXT);
CREATE TABLE public.ma_source_email_send_reservations (opportunity_id UUID PRIMARY KEY REFERENCES public.opportunities(id),
  reservation_token UUID NOT NULL, expires_at TIMESTAMPTZ NOT NULL);
CREATE TABLE public.staff_email_reviews (id UUID PRIMARY KEY, opportunity_id UUID NOT NULL REFERENCES public.opportunities(id), state TEXT NOT NULL);
CREATE TABLE public.staff_email_review_events (id UUID PRIMARY KEY, review_id UUID NOT NULL REFERENCES public.staff_email_reviews(id));
CREATE TABLE public.opportunity_source_contacts (opportunity_id UUID NOT NULL REFERENCES public.opportunities(id),
  source_id UUID NOT NULL, contact_id UUID NOT NULL, PRIMARY KEY(opportunity_id,source_id,contact_id));
CREATE TABLE public.ma_source_interactions (id UUID PRIMARY KEY, opportunity_id UUID NOT NULL REFERENCES public.opportunities(id), status TEXT NOT NULL DEFAULT 'sent');
CREATE TABLE public.opportunity_memo_notifications (id UUID PRIMARY KEY, opportunity_id UUID NOT NULL REFERENCES public.opportunities(id));
CREATE TABLE public.recipient_im_cleanup (document_id UUID PRIMARY KEY, opportunity_id UUID NOT NULL REFERENCES public.opportunities(id));

CREATE FUNCTION public.journey_current_gate_1_event(p_match_id UUID) RETURNS UUID
LANGUAGE sql STABLE AS $$ SELECT id FROM public.opportunity_pursuit_evidence
  WHERE match_id=p_match_id AND event_type='gate_1_passed' ORDER BY id DESC LIMIT 1 $$;
CREATE FUNCTION public.journey_current_gate_2_event(p_match_id UUID) RETURNS UUID
LANGUAGE sql STABLE AS $$ SELECT id FROM public.opportunity_pursuit_evidence
  WHERE match_id=p_match_id AND event_type='gate_2_passed' ORDER BY id DESC LIMIT 1 $$;

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
INSERT INTO public.opportunity_matches VALUES ('19100000-0000-4000-8000-000000000061','19100000-0000-4000-8000-000000000042','active_pursuit');
INSERT INTO public.opportunity_pursuit_evidence VALUES ('19100000-0000-4000-8000-000000000062','19100000-0000-4000-8000-000000000042','19100000-0000-4000-8000-000000000061','qualification_requested');
INSERT INTO public.opportunity_documents VALUES ('19100000-0000-4000-8000-000000000071','19100000-0000-4000-8000-000000000042','Retained document');
