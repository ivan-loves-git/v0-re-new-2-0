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
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
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
  legacy_source_id UUID UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'prospect'
    CHECK (status IN ('prospect', 'active', 'archived')),
  category TEXT,
  network_label TEXT,
  website_url TEXT,
  internal_notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_by TEXT,
  archived_at TIMESTAMPTZ,
  CHECK (status <> 'archived' OR archived_at IS NOT NULL)
);

CREATE TABLE public.ma_offices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES public.ma_firms(id),
  legacy_source_id UUID UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  city TEXT,
  address TEXT,
  region_codes TEXT[],
  coverage_note TEXT,
  geography_confidence TEXT,
  website_url TEXT,
  general_email TEXT,
  general_phone TEXT,
  internal_notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_by TEXT,
  archived_at TIMESTAMPTZ,
  CHECK (status <> 'archived' OR archived_at IS NOT NULL)
);

CREATE TABLE public.ma_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_source_contact_id UUID UNIQUE,
  first_name TEXT,
  last_name TEXT,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  internal_notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_by TEXT,
  archived_at TIMESTAMPTZ,
  CHECK (
    NULLIF(BTRIM(first_name), '') IS NOT NULL
    OR NULLIF(BTRIM(last_name), '') IS NOT NULL
  ),
  CHECK (status <> 'archived' OR archived_at IS NOT NULL)
);

CREATE TABLE public.ma_contact_office_affiliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.ma_contacts(id),
  office_id UUID NOT NULL REFERENCES public.ma_offices(id),
  legacy_source_contact_id UUID,
  legacy_source_id UUID,
  job_title TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  started_at DATE,
  ended_at DATE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (is_active AND ended_at IS NULL)
    OR (NOT is_active AND ended_at IS NOT NULL)
  )
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
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  linked_by TEXT,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_by TEXT,
  removed_at TIMESTAMPTZ,
  UNIQUE (opportunity_id, affiliation_id),
  CHECK (
    (is_active AND removed_at IS NULL)
    OR (NOT is_active AND removed_at IS NOT NULL)
  )
);

CREATE TABLE public.ma_cutover_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'staged', 'review_required', 'approved',
      'activating', 'activated', 'superseded'
    )),
  source_fingerprint TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  reconciliation_summary JSONB NOT NULL DEFAULT '{}'::JSONB,
  review_decisions JSONB NOT NULL DEFAULT '{}'::JSONB,
  approval_digest TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  activation_actor TEXT,
  activation_started_at TIMESTAMPTZ,
  activated_by TEXT,
  activated_at TIMESTAMPTZ,
  superseded_by TEXT,
  superseded_at TIMESTAMPTZ,
  result_summary JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    status NOT IN ('approved', 'activating', 'activated')
    OR (
      NULLIF(BTRIM(approval_digest), '') IS NOT NULL
      AND NULLIF(BTRIM(approved_by), '') IS NOT NULL
      AND approved_at IS NOT NULL
    )
  ),
  CHECK (
    status <> 'activated'
    OR (
      NULLIF(BTRIM(activated_by), '') IS NOT NULL
      AND activated_at IS NOT NULL
      AND result_summary IS NOT NULL
    )
  )
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
  office_row public.ma_offices%ROWTYPE;
  firm_row public.ma_firms%ROWTYPE;
  saved_opportunity public.opportunities%ROWTYPE;
  requested_affiliation_ids UUID[];
  requested_affiliation_count INTEGER;
  active_affiliation_count INTEGER;
BEGIN
  requested_affiliation_ids := ARRAY(
    SELECT DISTINCT affiliation_id
    FROM UNNEST(COALESCE(p_affiliation_ids, ARRAY[]::UUID[])) requested(affiliation_id)
    ORDER BY affiliation_id
  );
  requested_affiliation_count := CARDINALITY(requested_affiliation_ids);

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
    OR NOT (p_primary_affiliation_id = ANY(requested_affiliation_ids)) THEN
    RAISE EXCEPTION 'fixture_requires_source_and_primary_affiliation';
  END IF;

  SELECT *
  INTO office_row
  FROM public.ma_offices
  WHERE id = p_source_office_id
  FOR KEY SHARE;

  IF office_row.id IS NULL OR office_row.status <> 'active' THEN
    RAISE EXCEPTION 'fixture_requires_active_source_office';
  END IF;

  SELECT *
  INTO firm_row
  FROM public.ma_firms
  WHERE id = office_row.firm_id
  FOR UPDATE;

  IF firm_row.id IS NULL OR firm_row.status = 'archived' THEN
    RAISE EXCEPTION 'fixture_requires_non_archived_source_firm';
  END IF;

  PERFORM 1
  FROM public.ma_contact_office_affiliations affiliation
  WHERE affiliation.id = ANY(requested_affiliation_ids)
  ORDER BY affiliation.id
  FOR KEY SHARE;

  SELECT COUNT(*)
  INTO active_affiliation_count
  FROM public.ma_contact_office_affiliations affiliation
  JOIN public.ma_contacts contact ON contact.id = affiliation.contact_id
  WHERE affiliation.id = ANY(requested_affiliation_ids)
    AND affiliation.office_id = office_row.id
    AND affiliation.is_active
    AND contact.status = 'active';

  IF active_affiliation_count <> requested_affiliation_count THEN
    RAISE EXCEPTION 'fixture_affiliation_must_belong_to_source_office';
  END IF;

  IF p_target_status IN ('active', 'paused')
    AND (
      NULLIF(BTRIM(COALESCE(p_description, opportunity_row.description)), '') IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM public.ma_contact_office_affiliations affiliation
        JOIN public.ma_contacts contact ON contact.id = affiliation.contact_id
        WHERE affiliation.id = p_primary_affiliation_id
          AND NULLIF(BTRIM(contact.email), '') IS NOT NULL
          AND BTRIM(contact.email) ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      )
    ) THEN
    RAISE EXCEPTION 'fixture_active_context_requires_description_and_primary_email';
  END IF;

  PERFORM 1
  FROM public.opportunity_ma_contacts link
  WHERE link.opportunity_id = opportunity_row.id
  ORDER BY link.id
  FOR UPDATE;

  UPDATE public.opportunity_ma_contacts
  SET
    is_active = FALSE,
    is_primary = FALSE,
    removed_by = p_actor,
    removed_at = NOW()
  WHERE opportunity_id = opportunity_row.id
    AND is_active
    AND NOT (affiliation_id = ANY(requested_affiliation_ids));

  UPDATE public.opportunity_ma_contacts
  SET is_primary = FALSE
  WHERE opportunity_id = opportunity_row.id
    AND is_active;

  INSERT INTO public.opportunity_ma_contacts (
    opportunity_id,
    affiliation_id,
    contact_name_snapshot,
    contact_email_snapshot,
    contact_phone_snapshot,
    is_primary,
    is_active,
    linked_by,
    linked_at,
    removed_by,
    removed_at
  )
  SELECT
    opportunity_row.id,
    affiliation.id,
    contact.display_name,
    contact.email,
    contact.phone,
    FALSE,
    TRUE,
    p_actor,
    NOW(),
    NULL,
    NULL
  FROM unnest(requested_affiliation_ids) requested(affiliation_id)
  JOIN public.ma_contact_office_affiliations affiliation ON affiliation.id = requested.affiliation_id
  JOIN public.ma_contacts contact ON contact.id = affiliation.contact_id
  ON CONFLICT (opportunity_id, affiliation_id) DO UPDATE
  SET
    contact_name_snapshot = EXCLUDED.contact_name_snapshot,
    contact_email_snapshot = EXCLUDED.contact_email_snapshot,
    contact_phone_snapshot = EXCLUDED.contact_phone_snapshot,
    is_primary = FALSE,
    is_active = TRUE,
    linked_by = EXCLUDED.linked_by,
    linked_at = EXCLUDED.linked_at,
    removed_by = NULL,
    removed_at = NULL;

  UPDATE public.opportunity_ma_contacts
  SET is_primary = TRUE
  WHERE opportunity_id = opportunity_row.id
    AND affiliation_id = p_primary_affiliation_id
    AND is_active;

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

GRANT SELECT, INSERT, UPDATE ON TABLE
  public.ma_firms,
  public.ma_offices,
  public.ma_contacts,
  public.ma_contact_office_affiliations,
  public.opportunities,
  public.opportunity_ma_contacts,
  public.ma_cutover_runs
TO service_role;
REVOKE DELETE ON TABLE
  public.ma_firms,
  public.ma_offices,
  public.ma_contacts,
  public.ma_contact_office_affiliations,
  public.opportunities,
  public.opportunity_ma_contacts,
  public.ma_cutover_runs
FROM service_role;
GRANT SELECT ON TABLE public.app_user_roles TO service_role;
GRANT EXECUTE ON FUNCTION public.save_opportunity_office_context(
  UUID, UUID, UUID[], UUID, TEXT, public.opportunity_status, TEXT, JSONB
) TO service_role;

INSERT INTO public.app_user_roles (user_id, email, role)
VALUES ('fixture-bertrand', 'bertrand.galas@edu.escp.eu', 'staff');

INSERT INTO public.ma_contacts (first_name, last_name, display_name, status, email)
VALUES ('Bertrand', 'Galas', 'Bertrand Galas', 'active', 'bertrand.galas@edu.escp.eu');

WITH firm AS (
  INSERT INTO public.ma_firms (name, status) VALUES ('Verified Intermediary', 'active') RETURNING id
), office AS (
  INSERT INTO public.ma_offices (firm_id, name, status, is_default, city)
  SELECT id, 'Verified Paris', 'active', FALSE, 'Paris' FROM firm
  RETURNING id
), contact AS (
  INSERT INTO public.ma_contacts (first_name, last_name, display_name, status, email)
  VALUES ('Source', 'Contact', 'Source Contact', 'active', 'source.contact@example.test')
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
  acme_office_id UUID;
BEGIN
  SELECT office_id INTO acme_office_id
  FROM public.ma_provisional_source_contexts
  WHERE context_key = 'acme_co_paris';

  IF (SELECT COUNT(*) FROM public.ma_provisional_source_contexts) <> 1
    OR (SELECT COUNT(*) FROM public.ma_firms WHERE name = 'Acme Co.') <> 1
    OR (SELECT COUNT(*) FROM public.ma_offices WHERE name = 'Acme Paris' AND city = 'Paris' AND NOT is_default) <> 1
    OR (SELECT COUNT(*) FROM public.ma_contact_office_affiliations WHERE office_id = acme_office_id AND is_active) <> 1 THEN
    RAISE EXCEPTION 'w064_fixture_provisioning_assertion_failed';
  END IF;
  PERFORM public.assert_ma_provisional_source_context_integrity();
END;
$$;

SELECT
  opportunity.id AS fixture_opportunity_id,
  replacement_office.id AS fixture_replacement_office_id,
  replacement_affiliation.id AS fixture_replacement_affiliation_id
FROM public.opportunities opportunity
JOIN public.ma_offices replacement_office ON replacement_office.name = 'Verified Paris'
JOIN public.ma_contact_office_affiliations replacement_affiliation
  ON replacement_affiliation.office_id = replacement_office.id
WHERE opportunity.reference = 'W064-REHEARSAL-1'
\gset

BEGIN;
SET LOCAL ROLE service_role;
SELECT public.assign_acme_provisional_source(
  :'fixture_opportunity_id',
  'fixture-staff',
  'Source identity is pending reconciliation.'
);
SET CONSTRAINTS ALL IMMEDIATE;
RESET ROLE;
COMMIT;

DO $$
DECLARE
  v_opportunity_id UUID;
  replacement_office_id UUID;
  assigned_event_id UUID;
BEGIN
  SELECT id INTO v_opportunity_id
  FROM public.opportunities
  WHERE reference = 'W064-REHEARSAL-1';
  SELECT id INTO replacement_office_id
  FROM public.ma_offices
  WHERE name = 'Verified Paris';

  IF NOT public.ma_opportunity_source_review_required(v_opportunity_id)
    OR (
      SELECT source_office_id
      FROM public.opportunities
      WHERE id = v_opportunity_id
    ) <> (
      SELECT office_id
      FROM public.ma_provisional_source_contexts
      WHERE context_key = 'acme_co_paris'
    )
    OR (
      SELECT COUNT(*)
      FROM public.ma_provisional_source_review_events event
      WHERE event.opportunity_id = v_opportunity_id
        AND event.event_kind = 'assigned'
    ) <> 1 THEN
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
END;
$$;

BEGIN;
SET LOCAL ROLE service_role;
SELECT public.resolve_acme_provisional_source(
  :'fixture_opportunity_id',
  :'fixture_replacement_office_id',
  ARRAY[:'fixture_replacement_affiliation_id'::UUID],
  :'fixture_replacement_affiliation_id',
  'fixture-staff',
  'Verified source office and contact are now available.'
);
SET CONSTRAINTS ALL IMMEDIATE;
RESET ROLE;
COMMIT;

DO $$
DECLARE
  v_opportunity_id UUID;
BEGIN
  SELECT id INTO v_opportunity_id
  FROM public.opportunities
  WHERE reference = 'W064-REHEARSAL-1';

  IF public.ma_opportunity_source_review_required(v_opportunity_id)
    OR (
      SELECT status
      FROM public.opportunities
      WHERE id = v_opportunity_id
    ) <> 'active'
    OR (
      SELECT COUNT(*)
      FROM public.ma_provisional_source_review_events event
      WHERE event.opportunity_id = v_opportunity_id
        AND event.event_kind = 'resolved'
    ) <> 1 THEN
    RAISE EXCEPTION 'w064_fixture_resolution_assertion_failed';
  END IF;
END;
$$;

DO $$
DECLARE
  second_opportunity_id UUID;
  third_opportunity_id UUID;
  replacement_office_id UUID;
  replacement_affiliation_id UUID;
  run_id UUID;
BEGIN
  SELECT id INTO replacement_office_id
  FROM public.ma_offices
  WHERE name = 'Verified Paris';
  SELECT id INTO replacement_affiliation_id
  FROM public.ma_contact_office_affiliations
  WHERE office_id = replacement_office_id;

  INSERT INTO public.opportunities (reference, status, description)
  VALUES ('W064-REHEARSAL-2', 'draft', 'Synthetic approved-run guard rehearsal')
  RETURNING id INTO second_opportunity_id;

  INSERT INTO public.ma_cutover_runs (
    status,
    source_fingerprint,
    source_hash,
    approval_digest,
    created_by,
    approved_by,
    approved_at
  ) VALUES (
    'approved',
    'sha256:' || REPEAT('a', 64),
    REPEAT('b', 64),
    REPEAT('c', 64),
    'fixture-staff',
    'fixture-approver',
    NOW()
  )
  RETURNING id INTO run_id;

  BEGIN
    PERFORM public.assign_acme_provisional_source(
      second_opportunity_id,
      'fixture-staff',
      'Approved run must block a new Acme assignment.'
    );
    RAISE EXCEPTION 'w064_fixture_approved_run_assignment_should_have_failed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ma_provisional_source_assignment_blocked_by_cutover' THEN
      RAISE;
    END IF;
  END;

  UPDATE public.ma_cutover_runs
  SET
    status = 'activated',
    activated_by = 'fixture-activator',
    activated_at = NOW(),
    result_summary = '{"fixture":true}'::JSONB
  WHERE id = run_id;

  -- Activated historical runs do not permanently disable ordinary Acme use.
  PERFORM public.assign_acme_provisional_source(
    second_opportunity_id,
    'fixture-staff',
    'Post-activation ordinary Acme use rehearsal.'
  );

  INSERT INTO public.opportunities (reference, status, description)
  VALUES ('W064-REHEARSAL-3', 'draft', 'Synthetic cutover-block rehearsal')
  RETURNING id INTO third_opportunity_id;

  INSERT INTO public.ma_cutover_runs (
    status,
    source_fingerprint,
    source_hash,
    created_by
  ) VALUES (
    'draft',
    'sha256:' || REPEAT('d', 64),
    REPEAT('e', 64),
    'fixture-staff'
  )
  RETURNING id INTO run_id;

  BEGIN
    UPDATE public.ma_cutover_runs
    SET
      status = 'approved',
      approval_digest = REPEAT('f', 64),
      approved_by = 'fixture-approver',
      approved_at = NOW()
    WHERE id = run_id;
    RAISE EXCEPTION 'w064_fixture_cutover_should_have_failed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ma_provisional_source_review_blocks_cutover_treatment' THEN
      RAISE;
    END IF;
  END;

  PERFORM public.resolve_acme_provisional_source(
    second_opportunity_id,
    replacement_office_id,
    ARRAY[replacement_affiliation_id],
    replacement_affiliation_id,
    'fixture-staff',
    'Restore clean readiness before the shell-level race proof.'
  );
END;
$$;

SELECT id AS reservation_opportunity_id
FROM public.opportunities
WHERE reference = 'W064-REHEARSAL-3'
\gset

BEGIN;
SET LOCAL ROLE service_role;
SELECT public.reserve_ma_source_email_send(
  :'reservation_opportunity_id',
  'fixture-email-reservation'
) AS email_reservation_token
\gset
RESET ROLE;
COMMIT;

BEGIN;
SET LOCAL ROLE service_role;
SELECT 1 / (
  public.refresh_ma_source_email_send(
    :'reservation_opportunity_id',
    :'email_reservation_token'
  )::INTEGER
);
RESET ROLE;
COMMIT;

DO $$
DECLARE
  v_opportunity_id UUID;
BEGIN
  SELECT id INTO v_opportunity_id
  FROM public.opportunities
  WHERE reference = 'W064-REHEARSAL-3';

  BEGIN
    PERFORM public.assign_acme_provisional_source(
      v_opportunity_id,
      'fixture-concurrent-assignment',
      'Committed email reservation must block source mutation.'
    );
    RAISE EXCEPTION 'w064_fixture_email_reservation_should_have_blocked_assignment';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ma_provisional_source_change_blocked_during_email_send' THEN
      RAISE;
    END IF;
  END;
END;
$$;

BEGIN;
SET LOCAL ROLE service_role;
SELECT public.release_ma_source_email_send(
  :'reservation_opportunity_id',
  :'email_reservation_token'
);
RESET ROLE;
COMMIT;

SET ROLE service_role;
DO $$
DECLARE
  context_row public.ma_provisional_source_contexts%ROWTYPE;
BEGIN
  SELECT *
  INTO context_row
  FROM public.ma_provisional_source_contexts
  WHERE context_key = 'acme_co_paris';

  BEGIN
    UPDATE public.ma_firms
    SET
      status = 'archived',
      archived_by = 'fixture-tamper',
      archived_at = NOW()
    WHERE id = context_row.firm_id;
    RAISE EXCEPTION 'w064_fixture_firm_archive_should_have_failed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ma_provisional_acme_firm_is_immutable' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    UPDATE public.ma_offices
    SET city = 'Lyon'
    WHERE id = context_row.office_id;
    RAISE EXCEPTION 'w064_fixture_office_mutation_should_have_failed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ma_provisional_acme_office_is_immutable' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    UPDATE public.ma_contacts
    SET email = 'changed@example.test'
    WHERE id = context_row.contact_id;
    RAISE EXCEPTION 'w064_fixture_contact_mutation_should_have_failed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ma_provisional_bertrand_contact_is_immutable' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    UPDATE public.ma_contact_office_affiliations
    SET
      is_active = FALSE,
      ended_at = CURRENT_DATE,
      ended_by = 'fixture-tamper'
    WHERE id = context_row.affiliation_id;
    RAISE EXCEPTION 'w064_fixture_affiliation_mutation_should_have_failed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ma_provisional_bertrand_affiliation_is_immutable' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    UPDATE public.ma_provisional_source_contexts
    SET firm_id = gen_random_uuid()
    WHERE context_key = 'acme_co_paris';
    RAISE EXCEPTION 'w064_fixture_context_update_should_have_failed';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    DELETE FROM public.ma_firms
    WHERE id = context_row.firm_id;
    RAISE EXCEPTION 'w064_fixture_service_delete_should_have_failed';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;
RESET ROLE;

-- The database guards remain authoritative even for the migration owner; the
-- service-role DELETE denial above is an additional least-privilege boundary.
DO $$
DECLARE
  context_row public.ma_provisional_source_contexts%ROWTYPE;
BEGIN
  SELECT *
  INTO context_row
  FROM public.ma_provisional_source_contexts
  WHERE context_key = 'acme_co_paris';

  BEGIN
    DELETE FROM public.ma_provisional_source_contexts
    WHERE context_key = 'acme_co_paris';
    RAISE EXCEPTION 'w064_fixture_context_delete_should_have_failed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ma_provisional_source_context_is_immutable' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    DELETE FROM public.ma_firms
    WHERE id = context_row.firm_id;
    RAISE EXCEPTION 'w064_fixture_owner_firm_delete_should_have_failed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ma_provisional_acme_firm_is_immutable' THEN
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
    OR NOT has_function_privilege('service_role', 'public.assign_acme_provisional_source(uuid,text,text)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.assert_ma_provisional_source_review_state(uuid)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.enforce_ma_provisional_source_review_on_event()', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.guard_ma_provisional_source_cutover()', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.reserve_ma_source_email_send(uuid,text)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.release_ma_source_email_send(uuid,uuid)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.refresh_ma_source_email_send(uuid,uuid)', 'EXECUTE')
    OR has_table_privilege('service_role', 'public.ma_provisional_source_contexts', 'UPDATE')
    OR has_table_privilege('service_role', 'public.ma_provisional_source_contexts', 'DELETE')
    OR has_table_privilege('service_role', 'public.ma_source_email_send_reservations', 'SELECT')
    OR has_table_privilege('service_role', 'public.ma_source_email_send_reservations', 'INSERT') THEN
    RAISE EXCEPTION 'w064_fixture_privilege_assertion_failed';
  END IF;
END;
$$;

SELECT 'W-064 disposable rehearsal passed' AS result;
