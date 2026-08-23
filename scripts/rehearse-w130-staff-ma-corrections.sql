-- Isolated W-130 migration rehearsal. This minimal production-shaped fixture
-- proves the correction boundaries without contacting Supabase or production.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE ROLE service_role;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA IF NOT EXISTS public;
GRANT ALL ON SCHEMA public TO service_role;
CREATE TABLE public.ma_firms (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', category TEXT, network_label TEXT, website_url TEXT, internal_notes TEXT, updated_by TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp());
CREATE TABLE public.ma_offices (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), firm_id UUID NOT NULL REFERENCES public.ma_firms(id), name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', city TEXT, address TEXT, coverage_note TEXT, website_url TEXT, general_email TEXT, general_phone TEXT, internal_notes TEXT, updated_by TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp());
CREATE TABLE public.ma_contacts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), first_name TEXT, last_name TEXT, display_name TEXT, email TEXT, phone TEXT, linkedin_url TEXT, internal_notes TEXT, updated_by TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp());
CREATE TABLE public.ma_contact_office_affiliations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), contact_id UUID NOT NULL REFERENCES public.ma_contacts(id), office_id UUID NOT NULL REFERENCES public.ma_offices(id), job_title TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp());
CREATE TABLE public.opportunities (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), status TEXT NOT NULL);
CREATE TABLE public.opportunity_ma_contacts (opportunity_id UUID NOT NULL REFERENCES public.opportunities(id), affiliation_id UUID NOT NULL REFERENCES public.ma_contact_office_affiliations(id), is_active BOOLEAN NOT NULL DEFAULT TRUE, is_primary BOOLEAN NOT NULL DEFAULT FALSE);
\ir 113_staff_ma_relationship_corrections.sql

DO $$
DECLARE firm UUID; office UUID; other_office UUID; contact UUID; affiliation UUID; active_opportunity UUID;
BEGIN
  INSERT INTO public.ma_firms(name) VALUES ('W130 Atlas') RETURNING id INTO firm;
  INSERT INTO public.ma_offices(firm_id,name) VALUES (firm,'Paris') RETURNING id INTO office;
  INSERT INTO public.ma_offices(firm_id,name) VALUES (firm,'Lyon') RETURNING id INTO other_office;
  INSERT INTO public.ma_contacts(first_name,last_name,display_name,email) VALUES ('Ada','Lovelace','Ada Lovelace','ada@example.test') RETURNING id INTO contact;
  INSERT INTO public.ma_contact_office_affiliations(contact_id,office_id,job_title) VALUES(contact,office,'Partner') RETURNING id INTO affiliation;
  INSERT INTO public.opportunities(status) VALUES ('active') RETURNING id INTO active_opportunity;
  INSERT INTO public.opportunity_ma_contacts(opportunity_id,affiliation_id,is_primary) VALUES(active_opportunity,affiliation,TRUE);
  PERFORM * FROM public.update_ma_firm_correction(firm,'W130 Atlas corrected','M&A','Network','https://atlas.test','Private','qa');
  PERFORM * FROM public.update_ma_office_correction(office,'Paris corrected','Paris','1 Rue Test','France','https://paris.test','office@example.test','123','Private','qa');
  PERFORM * FROM public.update_ma_contact_correction(contact,affiliation,'Ada','Byron','ada@example.test','123','https://linkedin.com/in/ada','Private','Managing partner','qa');
  IF NOT EXISTS (SELECT 1 FROM public.ma_contacts WHERE id=contact AND display_name='Ada Byron' AND updated_by='qa') THEN RAISE EXCEPTION 'w130_contact_audit_or_update_failed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ma_contact_office_affiliations WHERE id=affiliation AND job_title='Managing partner') THEN RAISE EXCEPTION 'w130_affiliation_title_failed'; END IF;
  BEGIN PERFORM * FROM public.update_ma_office_correction(other_office,' paris corrected ',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'qa'); RAISE EXCEPTION 'w130_office_duplicate_allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%ma_office_name_already_exists%' THEN RAISE; END IF; END;
  BEGIN PERFORM * FROM public.update_ma_contact_correction(contact,affiliation,'Ada','Byron',NULL,NULL,NULL,NULL,NULL,'qa'); RAISE EXCEPTION 'w130_primary_email_removed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%ma_primary_contact_email_required%' THEN RAISE; END IF; END;
END $$;
