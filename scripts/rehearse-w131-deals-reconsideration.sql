-- Disposable W-131/W-136 runtime proof for migration 113. All identities and
-- records below are synthetic fixtures with no production connection.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE TYPE public.opportunity_status AS ENUM ('draft','active','paused','archived','closed');
CREATE TYPE public.opportunity_visibility AS ENUM ('staff_only','anonymized','repreneur_visible');
CREATE TYPE public.opportunity_match_status AS ENUM ('draft','shortlisted','proposed','interested','declined','active_pursuit','dropped');
CREATE TYPE public.opportunity_pursuit_stage AS ENUM ('interest','dropped');
CREATE TYPE public.opportunity_nda_status AS ENUM ('not_required','required','sent','signed','waived');
CREATE TABLE public.opportunities (id UUID PRIMARY KEY, reference TEXT NOT NULL, status public.opportunity_status NOT NULL, repreneur_exposure public.opportunity_visibility NOT NULL, is_demo BOOLEAN NOT NULL DEFAULT FALSE);
CREATE TABLE public.repreneurs (id UUID PRIMARY KEY, email TEXT NOT NULL);
CREATE TABLE public.opportunity_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), opportunity_id UUID NOT NULL REFERENCES public.opportunities(id), repreneur_id UUID NOT NULL REFERENCES public.repreneurs(id), status public.opportunity_match_status NOT NULL,
  decline_reason_categories TEXT[] NOT NULL DEFAULT '{}', decline_reason_text TEXT, pursuit_stage public.opportunity_pursuit_stage, pursuit_stage_notes TEXT, pursuit_stage_updated_by TEXT, pursuit_stage_updated_at TIMESTAMPTZ, reviewed_by TEXT, reviewed_at TIMESTAMPTZ, created_by TEXT, nda_status public.opportunity_nda_status NOT NULL DEFAULT 'not_required', nda_signed_at TIMESTAMPTZ, nda_waived_at TIMESTAMPTZ, nda_waived_by TEXT, interest_expressed_at TIMESTAMPTZ, interest_notification_sent_at TIMESTAMPTZ,
  UNIQUE(opportunity_id,repreneur_id)
);
CREATE UNIQUE INDEX one_active_pursuit ON public.opportunity_matches(opportunity_id) WHERE status='active_pursuit';
CREATE TABLE public.opportunity_pursuit_evidence (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), match_id UUID NOT NULL REFERENCES public.opportunity_matches(id), event_type TEXT NOT NULL);

INSERT INTO public.repreneurs VALUES ('10000000-0000-4000-8000-000000000001','owner@example.test');
INSERT INTO public.opportunities VALUES
  ('20000000-0000-4000-8000-000000000001','DROP','active','staff_only',FALSE),
  ('20000000-0000-4000-8000-000000000002','DECLINE','active','anonymized',FALSE),
  ('20000000-0000-4000-8000-000000000003','ACTIVE','active','anonymized',FALSE);
INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,pursuit_stage,decline_reason_categories,decline_reason_text,created_by) VALUES
  ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','dropped','dropped','{}',NULL,'fixture'),
  ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','declined',NULL,ARRAY['sector'],'fixture decline','fixture'),
  ('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','active_pursuit','interest','{}',NULL,'fixture');
INSERT INTO public.opportunity_pursuit_evidence(match_id,event_type) VALUES ('30000000-0000-4000-8000-000000000001','dropped');

\ir 113_deals_reconsideration.sql

DO $$
BEGIN
  IF has_function_privilege('anon','public.express_opportunity_interest(uuid,uuid,text,timestamptz)','EXECUTE') OR has_function_privilege('authenticated','public.express_opportunity_interest(uuid,uuid,text,timestamptz)','EXECUTE') OR NOT has_function_privilege('service_role','public.express_opportunity_interest(uuid,uuid,text,timestamptz)','EXECUTE') THEN RAISE EXCEPTION 'w131_service_role_privilege_failed'; END IF;
END $$;

SET ROLE service_role;
SELECT * FROM public.express_opportunity_interest('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','fixture-actor');
SELECT * FROM public.express_opportunity_interest('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','fixture-actor');
-- A repeat of the reconsideration is the existing idempotent interest result.
SELECT * FROM public.express_opportunity_interest('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','fixture-actor');
RESET ROLE;

DO $$
DECLARE before_evidence INTEGER := 1;
BEGIN
  IF (SELECT status FROM public.opportunity_matches WHERE id='30000000-0000-4000-8000-000000000001') <> 'interested' OR (SELECT status FROM public.opportunity_matches WHERE id='30000000-0000-4000-8000-000000000002') <> 'interested' THEN RAISE EXCEPTION 'w131_reconsideration_status_failed'; END IF;
  IF EXISTS (SELECT 1 FROM public.opportunity_matches WHERE status='active_pursuit' AND id IN ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002')) THEN RAISE EXCEPTION 'w131_reconsideration_reopened_pursuit'; END IF;
  IF (SELECT count(*) FROM public.opportunity_pursuit_evidence) <> before_evidence THEN RAISE EXCEPTION 'w131_reconsideration_created_evidence'; END IF;
  IF (SELECT count(*) FROM public.opportunity_matches WHERE opportunity_id='20000000-0000-4000-8000-000000000001' AND repreneur_id='10000000-0000-4000-8000-000000000001') <> 1 THEN RAISE EXCEPTION 'w131_reconsideration_not_idempotent'; END IF;
END $$;

SELECT 'W-131/W-136 reconsideration rehearsal passed' AS result;
