-- Disposable PostgreSQL prerequisites for migrations 121 and 129. Never real data.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE TYPE public.ma_contact_email_purpose AS ENUM ('campaign','general_relationship','opportunity_general','opportunity_nda_request');
CREATE TABLE public.ma_firms(id uuid PRIMARY KEY, name text, status text);
CREATE TABLE public.ma_offices(id uuid PRIMARY KEY, firm_id uuid, name text, status text);
CREATE TABLE public.ma_contacts(id uuid PRIMARY KEY, display_name text, email text, status text, campaign_email_suppressed boolean DEFAULT false);
CREATE TABLE public.ma_contact_office_affiliations(id uuid PRIMARY KEY, office_id uuid, contact_id uuid, is_active boolean DEFAULT true, ended_at date);
CREATE TABLE public.opportunities(id uuid PRIMARY KEY, reference text, public_title text, sector text,
  source_office_id uuid, status text, is_demo boolean, date_added date, date_added_precision text,
  source_identity_to_verify boolean DEFAULT false);
CREATE TABLE public.opportunity_ma_contacts(id uuid PRIMARY KEY, opportunity_id uuid, affiliation_id uuid,
  is_primary boolean DEFAULT true, is_active boolean DEFAULT true, removed_at timestamptz);
CREATE TABLE public.repreneurs(id uuid PRIMARY KEY, is_demo boolean DEFAULT false);
CREATE TABLE public.opportunity_matches(id uuid PRIMARY KEY, opportunity_id uuid, repreneur_id uuid, status text);
CREATE TABLE public.opportunity_pursuit_evidence(id uuid PRIMARY KEY, match_id uuid);
CREATE TABLE public.ma_source_email_send_reservations(opportunity_id uuid PRIMARY KEY, expires_at timestamptz);
CREATE TABLE public.ma_provisional_source_contexts(context_key text PRIMARY KEY, office_id uuid);
CREATE TABLE public.ma_provisional_source_review_events(id uuid PRIMARY KEY, opportunity_id uuid,
  provisional_office_id uuid, event_kind text, related_assignment_id uuid);
CREATE FUNCTION public.assert_ma_provisional_source_context_integrity() RETURNS void LANGUAGE plpgsql AS $$ BEGIN END $$;
CREATE TABLE public.ma_interactions(id uuid PRIMARY KEY, opportunity_id uuid, channel text, direction text,
  delivery_status text, occurred_at timestamptz, client_operation_key uuid, template_key text,
  recipient_email_snapshot text, title text, body_markdown text, provider_message_id text,
  provider_request_fingerprint text);
CREATE TABLE public.opportunity_pursuit_handoff_deliveries(id uuid PRIMARY KEY, upstream_evidence_id uuid,
  match_id uuid, handoff_type text, delivery_status text, provider_message_id text, evidence_id uuid,
  attachment_snapshot jsonb, ma_interaction_id uuid, operation_key uuid, request_fingerprint text);
CREATE TABLE public."user"(id text PRIMARY KEY,email text);
CREATE TABLE public.app_user_roles(user_id text,email text,role text);
CREATE TABLE public.email_templates(template_key text PRIMARY KEY,is_active boolean,subject text,body_markdown text,body_editable boolean DEFAULT true);
-- The actual source-review helper is loaded from migration 079 by the
-- rehearsal runner. It never inspects source_identity_to_verify.
CREATE FUNCTION public.ma_contact_email_is_allowed(uuid,uuid,public.ma_contact_email_purpose)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM public.ma_contacts WHERE id=$1 AND status='active' AND NOT campaign_email_suppressed)
$$;
CREATE FUNCTION public.ma_contact_email_address_is_suppressed(text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM public.ma_contacts WHERE lower(email)=lower($1) AND campaign_email_suppressed)
$$;
INSERT INTO public."user" VALUES ('staff-1','staff@example.test'),('rep-1','rep@example.test');
INSERT INTO public.app_user_roles VALUES ('staff-1','staff@example.test','staff'),('rep-1','rep@example.test','repreneur');
INSERT INTO public.ma_firms VALUES ('18700000-0000-4000-8000-000000000001','Atlas','active');
INSERT INTO public.ma_offices VALUES ('18700000-0000-4000-8000-000000000002','18700000-0000-4000-8000-000000000001','Paris','active');
INSERT INTO public.ma_contacts VALUES
  ('18700000-0000-4000-8000-000000000003','Marie Source','source@example.test','active',false),
  ('18700000-0000-4000-8000-000000000004','Other Identity','source@example.test','active',false);
INSERT INTO public.repreneurs VALUES
  ('18700000-0000-4000-8000-0000000000f0',false),
  ('18700000-0000-4000-8000-0000000000f1',true);
INSERT INTO public.ma_contact_office_affiliations VALUES
  ('18700000-0000-4000-8000-000000000005','18700000-0000-4000-8000-000000000002','18700000-0000-4000-8000-000000000003',true,NULL),
  ('18700000-0000-4000-8000-000000000006','18700000-0000-4000-8000-000000000002','18700000-0000-4000-8000-000000000004',true,NULL);
INSERT INTO public.opportunities VALUES
  ('18700000-0000-4000-8000-000000000007','A-01','Alpine',NULL,'18700000-0000-4000-8000-000000000002','active',false,current_date-45,'day',false),
  ('18700000-0000-4000-8000-000000000008','B-02','Bay',NULL,'18700000-0000-4000-8000-000000000002','active',false,current_date-180,NULL,false),
  ('18700000-0000-4000-8000-000000000009','C-03','Cove',NULL,'18700000-0000-4000-8000-000000000002','active',false,current_date-45,'day',false),
  ('18700000-0000-4000-8000-00000000000a','D-04','Recent',NULL,'18700000-0000-4000-8000-000000000002','active',false,current_date-44,'day',false);
INSERT INTO public.opportunity_ma_contacts VALUES
  ('18700000-0000-4000-8000-00000000000b','18700000-0000-4000-8000-000000000007','18700000-0000-4000-8000-000000000005',true,true,NULL),
  ('18700000-0000-4000-8000-00000000000c','18700000-0000-4000-8000-000000000008','18700000-0000-4000-8000-000000000005',true,true,NULL),
  ('18700000-0000-4000-8000-00000000000d','18700000-0000-4000-8000-000000000009','18700000-0000-4000-8000-000000000006',true,true,NULL),
  ('18700000-0000-4000-8000-00000000000e','18700000-0000-4000-8000-00000000000a','18700000-0000-4000-8000-000000000005',true,true,NULL);
INSERT INTO public.email_templates VALUES('ma_opportunity_validity_check',true,'Subject','Body',true);
