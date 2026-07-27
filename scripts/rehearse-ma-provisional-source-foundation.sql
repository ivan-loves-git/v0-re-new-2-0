-- Disposable prerequisite fixture for scripts/079_provisional_acme_source_foundation.sql.
-- It is synthetic-only: no project database URL, workbook, real opportunity or
-- production credential is accepted or referenced by this rehearsal.

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
    CREATE ROLE service_role NOLOGIN;
  END IF;
END;
$$;

CREATE TYPE public.opportunity_status AS ENUM (
  'draft', 'active', 'paused', 'closed', 'archived'
);

CREATE TABLE public.app_user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  email TEXT NOT NULL,
  role TEXT NOT NULL
);

CREATE TABLE public.ma_firms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'prospect',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.ma_offices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES public.ma_firms(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  city TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.ma_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  email TEXT,
  phone TEXT
);

CREATE TABLE public.ma_contact_office_affiliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.ma_contacts(id),
  office_id UUID NOT NULL REFERENCES public.ma_offices(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT
);

CREATE TABLE public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE,
  status public.opportunity_status NOT NULL DEFAULT 'draft',
  source_office_id UUID REFERENCES public.ma_offices(id),
  description TEXT,
  updated_by TEXT
);

CREATE TABLE public.opportunity_ma_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id),
  affiliation_id UUID NOT NULL REFERENCES public.ma_contact_office_affiliations(id),
  contact_name_snapshot TEXT,
  contact_email_snapshot TEXT,
  contact_phone_snapshot TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE public.ma_cutover_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'open'
);

CREATE OR REPLACE FUNCTION public.save_opportunity_office_context(
  p_opportunity_id UUID,
  p_source_office_id UUID,
  p_affiliation_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_primary_affiliation_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_target_status public.opportunity_status DEFAULT NULL,
  p_actor TEXT DEFAULT NULL,
  p_opportunity_fields JSONB DEFAULT '{}'::JSONB
)
RETURNS public.opportunities
LANGUAGE plpgsql
AS $$
DECLARE
  opportunity_row public.opportunities%ROWTYPE;
  saved_opportunity public.opportunities%ROWTYPE;
BEGIN
  SELECT * INTO opportunity_row
  FROM public.opportunities
  WHERE id = p_opportunity_id
  FOR UPDATE;

  IF opportunity_row.id IS NULL OR NULLIF(BTRIM(p_actor), '') IS NULL THEN
    RAISE EXCEPTION 'fixture_requires_known_opportunity_and_actor';
  END IF;
  IF p_target_status NOT IN ('draft', 'active', 'paused') THEN
    RAISE EXCEPTION 'fixture_supports_open_opportunity_states_only';
  END IF;
  IF p_source_office_id IS NULL OR p_primary_affiliation_id IS NULL
    OR NOT (p_primary_affiliation_id = ANY(p_affiliation_ids)) THEN
    RAISE EXCEPTION 'fixture_requires_source_and_primary_affiliation';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(p_affiliation_ids) affiliation_id
    LEFT JOIN public.ma_contact_office_affiliations affiliation ON affiliation.id = affiliation_id
    WHERE affiliation.id IS NULL
      OR NOT affiliation.is_active
      OR affiliation.office_id <> p_source_office_id
  ) THEN
    RAISE EXCEPTION 'fixture_affiliation_must_belong_to_source_office';
  END IF;

  UPDATE public.opportunity_ma_contacts
  SET is_active = FALSE, is_primary = FALSE
  WHERE opportunity_id = opportunity_row.id
    AND is_active;

  INSERT INTO public.opportunity_ma_contacts (
    opportunity_id,
    affiliation_id,
    contact_name_snapshot,
    contact_email_snapshot,
    contact_phone_snapshot,
    is_primary,
    is_active
  )
  SELECT
    opportunity_row.id,
    affiliation.id,
    contact.display_name,
    contact.email,
    contact.phone,
    affiliation.id = p_primary_affiliation_id,
    TRUE
  FROM unnest(p_affiliation_ids) requested(affiliation_id)
  JOIN public.ma_contact_office_affiliations affiliation ON affiliation.id = requested.affiliation_id
  JOIN public.ma_contacts contact ON contact.id = affiliation.contact_id;

  UPDATE public.opportunities
  SET
    source_office_id = p_source_office_id,
    status = p_target_status,
    description = COALESCE(NULLIF(BTRIM(p_description), ''), description),
    updated_by = p_actor
  WHERE id = opportunity_row.id
  RETURNING * INTO saved_opportunity;

  RETURN saved_opportunity;
END;
$$;

INSERT INTO public.app_user_roles (user_id, email, role)
VALUES ('fixture-bertrand', 'bertrand.galas@edu.escp.eu', 'staff');

INSERT INTO public.ma_contacts (display_name, status, email)
VALUES ('Bertrand Galas', 'active', 'bertrand.galas@edu.escp.eu');

WITH firm AS (
  INSERT INTO public.ma_firms (name, status) VALUES ('Verified Intermediary', 'active') RETURNING id
), office AS (
  INSERT INTO public.ma_offices (firm_id, name, status, is_default, city)
  SELECT id, 'Verified Paris', 'active', FALSE, 'Paris' FROM firm
  RETURNING id
), contact AS (
  INSERT INTO public.ma_contacts (display_name, status, email)
  VALUES ('Source Contact', 'active', 'source.contact@example.test')
  RETURNING id
), affiliation AS (
  INSERT INTO public.ma_contact_office_affiliations (contact_id, office_id, is_active)
  SELECT contact.id, office.id, TRUE FROM contact CROSS JOIN office
  RETURNING id
), opportunity AS (
  INSERT INTO public.opportunities (reference, status, source_office_id, description)
  SELECT 'W064-REHEARSAL-1', 'active', office.id, 'Synthetic runtime rehearsal opportunity'
  FROM office
  RETURNING id
)
INSERT INTO public.opportunity_ma_contacts (
  opportunity_id,
  affiliation_id,
  contact_name_snapshot,
  contact_email_snapshot,
  is_primary,
  is_active
)
SELECT
  opportunity.id,
  affiliation.id,
  'Source Contact',
  'source.contact@example.test',
  TRUE,
  TRUE
FROM opportunity CROSS JOIN affiliation;

\ir 079_provisional_acme_source_foundation.sql

DO $$
DECLARE
  v_opportunity_id UUID;
  replacement_office_id UUID;
  replacement_affiliation_id UUID;
  acme_office_id UUID;
  assigned_event_id UUID;
  current_status public.opportunity_status;
BEGIN
  SELECT id INTO v_opportunity_id
  FROM public.opportunities
  WHERE reference = 'W064-REHEARSAL-1';
  SELECT office_id INTO acme_office_id
  FROM public.ma_provisional_source_contexts
  WHERE context_key = 'acme_co_paris';
  SELECT id INTO replacement_office_id
  FROM public.ma_offices
  WHERE name = 'Verified Paris';
  SELECT affiliation.id INTO replacement_affiliation_id
  FROM public.ma_contact_office_affiliations affiliation
  WHERE affiliation.office_id = replacement_office_id;

  IF (SELECT COUNT(*) FROM public.ma_provisional_source_contexts) <> 1
    OR (SELECT COUNT(*) FROM public.ma_firms WHERE name = 'Acme Co.') <> 1
    OR (SELECT COUNT(*) FROM public.ma_offices WHERE name = 'Acme Paris' AND city = 'Paris' AND NOT is_default) <> 1
    OR (SELECT COUNT(*) FROM public.ma_contact_office_affiliations WHERE office_id = acme_office_id AND is_active) <> 1 THEN
    RAISE EXCEPTION 'w064_fixture_provisioning_assertion_failed';
  END IF;

  SET LOCAL ROLE service_role;
  PERFORM public.assign_acme_provisional_source(
    v_opportunity_id,
    'fixture-staff',
    'Source identity is pending reconciliation.'
  );
  RESET ROLE;

  IF NOT public.ma_opportunity_source_review_required(v_opportunity_id)
    OR (SELECT source_office_id FROM public.opportunities WHERE id = v_opportunity_id) <> acme_office_id
    OR (SELECT COUNT(*) FROM public.ma_provisional_source_review_events event WHERE event.opportunity_id = v_opportunity_id AND event.event_kind = 'assigned') <> 1 THEN
    RAISE EXCEPTION 'w064_fixture_assignment_assertion_failed';
  END IF;

  SELECT id INTO assigned_event_id
  FROM public.ma_provisional_source_review_events
  WHERE opportunity_id = v_opportunity_id
    AND event_kind = 'assigned';

  BEGIN
    UPDATE public.opportunities
    SET status = 'closed'
    WHERE id = v_opportunity_id;
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'w064_fixture_close_should_have_failed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ma_provisional_source_review_blocks_opportunity_lifecycle_exit' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    UPDATE public.opportunities
    SET source_office_id = replacement_office_id
    WHERE id = v_opportunity_id;
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'w064_fixture_direct_resolution_should_have_failed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ma_provisional_source_resolution_requires_immutable_evidence' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    UPDATE public.ma_provisional_source_review_events
    SET reason = 'tampered'
    WHERE id = assigned_event_id;
    RAISE EXCEPTION 'w064_fixture_mutation_should_have_failed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ma_provisional_source_review_events_are_immutable' THEN
      RAISE;
    END IF;
  END;

  SET LOCAL ROLE service_role;
  PERFORM public.resolve_acme_provisional_source(
    v_opportunity_id,
    replacement_office_id,
    ARRAY[replacement_affiliation_id],
    replacement_affiliation_id,
    'fixture-staff',
    'Verified source office and contact are now available.'
  );
  RESET ROLE;

  SELECT status INTO current_status
  FROM public.opportunities
  WHERE id = v_opportunity_id;
  IF public.ma_opportunity_source_review_required(v_opportunity_id)
    OR current_status <> 'active'
    OR (SELECT COUNT(*) FROM public.ma_provisional_source_review_events event WHERE event.opportunity_id = v_opportunity_id AND event.event_kind = 'resolved') <> 1 THEN
    RAISE EXCEPTION 'w064_fixture_resolution_assertion_failed';
  END IF;
END;
$$;

DO $$
DECLARE
  second_opportunity_id UUID;
  run_id UUID;
BEGIN
  INSERT INTO public.opportunities (reference, status, description)
  VALUES ('W064-REHEARSAL-2', 'draft', 'Synthetic cutover-block rehearsal')
  RETURNING id INTO second_opportunity_id;
  PERFORM public.assign_acme_provisional_source(
    second_opportunity_id,
    'fixture-staff',
    'Cutover guard rehearsal.'
  );
  INSERT INTO public.ma_cutover_runs (status) VALUES ('open') RETURNING id INTO run_id;

  BEGIN
    UPDATE public.ma_cutover_runs SET status = 'approved' WHERE id = run_id;
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'w064_fixture_cutover_should_have_failed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ma_provisional_source_review_blocks_cutover_treatment' THEN
      RAISE;
    END IF;
  END;
END;
$$;

DO $$
BEGIN
  IF has_table_privilege('anon', 'public.ma_provisional_source_contexts', 'SELECT')
    OR has_table_privilege('authenticated', 'public.ma_provisional_source_review_events', 'SELECT')
    OR has_table_privilege('service_role', 'public.ma_provisional_source_review_events', 'INSERT')
    OR NOT has_table_privilege('service_role', 'public.ma_provisional_source_review_events', 'SELECT')
    OR has_function_privilege('anon', 'public.assign_acme_provisional_source(uuid,text,text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.resolve_acme_provisional_source(uuid,uuid,uuid[],uuid,text,text)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.assign_acme_provisional_source(uuid,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'w064_fixture_privilege_assertion_failed';
  END IF;
END;
$$;

SELECT 'W-064 disposable rehearsal passed' AS result;
