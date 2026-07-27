-- Synthetic, production-shaped prerequisite fixture for migration 080 only.
-- Values are invented and no body is printed by this rehearsal.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END;
$$;

CREATE TABLE public.app_user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  email TEXT NOT NULL,
  role TEXT NOT NULL
);
CREATE TABLE public.ma_firms (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL);
CREATE TABLE public.ma_offices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES public.ma_firms(id),
  name TEXT NOT NULL
);
CREATE TABLE public.ma_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_name TEXT NOT NULL,
  default_office_id UUID REFERENCES public.ma_offices(id)
);
CREATE TABLE public.ma_source_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.ma_sources(id),
  email TEXT
);
CREATE TABLE public.ma_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_source_contact_id UUID UNIQUE,
  display_name TEXT NOT NULL
);
CREATE TABLE public.ma_contact_office_affiliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.ma_contacts(id),
  office_id UUID NOT NULL REFERENCES public.ma_offices(id)
);
CREATE TABLE public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE,
  source_id UUID REFERENCES public.ma_sources(id),
  source_office_id UUID REFERENCES public.ma_offices(id)
);
CREATE TABLE public.ma_source_interactions (
  id UUID PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id),
  source_id UUID REFERENCES public.ma_sources(id),
  contact_id UUID REFERENCES public.ma_source_contacts(id),
  template_key TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  direction TEXT NOT NULL DEFAULT 'outbound',
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_markdown TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mirror the released canonical office foundation: service actions can resolve
-- the foreign-key context used by the interaction trigger, while browser roles
-- receive no grants.
GRANT SELECT ON TABLE
  public.ma_firms,
  public.ma_offices,
  public.ma_sources,
  public.ma_source_contacts,
  public.ma_contacts,
  public.ma_contact_office_affiliations,
  public.opportunities
TO service_role;

INSERT INTO public.app_user_roles (user_id, email, role)
VALUES ('bertrand-staff-user', 'bertrand.galas@edu.escp.eu', 'staff');

WITH firm AS (
  INSERT INTO public.ma_firms (name) VALUES ('Synthetic Advisory') RETURNING id
), office AS (
  INSERT INTO public.ma_offices (firm_id, name) SELECT id, 'Paris' FROM firm RETURNING id
), source AS (
  INSERT INTO public.ma_sources (firm_name, default_office_id)
  SELECT 'Synthetic Advisory', id FROM office RETURNING id, default_office_id
), legacy_contact AS (
  INSERT INTO public.ma_source_contacts (source_id, email)
  SELECT id, 'contact@example.test' FROM source RETURNING id, source_id
), contact AS (
  INSERT INTO public.ma_contacts (legacy_source_contact_id, display_name)
  SELECT id, 'Synthetic Contact' FROM legacy_contact RETURNING id, legacy_source_contact_id
), affiliation AS (
  INSERT INTO public.ma_contact_office_affiliations (contact_id, office_id)
  SELECT contact.id, source.default_office_id FROM contact
  JOIN source ON TRUE RETURNING id
), opportunities AS (
  INSERT INTO public.opportunities (reference, source_id, source_office_id)
  SELECT 'W062-SYN-' || n, source.id, source.default_office_id
  FROM source CROSS JOIN generate_series(1, 4) n
  RETURNING id, reference
)
INSERT INTO public.ma_source_interactions (
  id, opportunity_id, source_id, contact_id, template_key, channel, direction,
  recipient_email, subject, body_markdown, status, sent_at, created_at
)
SELECT
  ('00000000-0000-0000-0000-00000000000' || row_number() OVER (ORDER BY reference))::UUID,
  opportunities.id, source.id, legacy_contact.id, 'ma_process_follow_up', 'email', 'outbound',
  'contact@example.test', 'Synthetic subject ' || reference, 'Synthetic private body ' || reference,
  'sent', TIMESTAMPTZ '2026-07-27 10:00:00+00', TIMESTAMPTZ '2026-07-27 10:00:00+00'
FROM opportunities
CROSS JOIN source
CROSS JOIN legacy_contact;

\ir 080_ma_interaction_persistence.sql

DO $$
DECLARE
  migrated_count INTEGER;
  provisional_count INTEGER;
  digest_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_count FROM public.ma_interactions;
  SELECT COUNT(*) INTO provisional_count
  FROM public.ma_interactions
  WHERE owner_staff_user_id = 'bertrand-staff-user'
    AND owner_verification_state = 'provisional';
  SELECT COUNT(*) INTO digest_count
  FROM public.ma_interaction_legacy_migration_manifest
  WHERE legacy_evidence_digest = canonical_evidence_digest;
  IF migrated_count <> 4 OR provisional_count <> 4 OR digest_count <> 4 THEN
    RAISE EXCEPTION 'w062_migration_manifest_or_owner_check_failed';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.ma_interaction_legacy_migration_manifest
    WHERE legacy_evidence_digest LIKE '%Synthetic private body%'
  ) THEN
    RAISE EXCEPTION 'w062_manifest_exposes_body';
  END IF;
END;
$$;

-- Same-office acceptance and both mismatch rejections are database checks,
-- independent of any browser form or server action.
DO $$
DECLARE
  office_id UUID;
  other_office_id UUID;
  affiliation_id UUID;
  interaction_id UUID;
BEGIN
  SELECT interaction.office_id, interaction.affiliation_id, interaction.id
  INTO office_id, affiliation_id, interaction_id
  FROM public.ma_interactions interaction ORDER BY interaction.id LIMIT 1;
  INSERT INTO public.ma_offices (firm_id, name)
  SELECT firm_id, 'Other office' FROM public.ma_offices WHERE id = office_id
  RETURNING id INTO other_office_id;

  INSERT INTO public.ma_interactions (
    office_id, affiliation_id, channel, direction, occurred_at,
    owner_staff_user_id, summary, created_by
  ) VALUES (
    office_id, affiliation_id, 'call', 'outbound', NOW(),
    'bertrand-staff-user', 'Synthetic permitted call', 'bertrand-staff-user'
  );

  BEGIN
    INSERT INTO public.ma_interactions (
      office_id, affiliation_id, channel, direction, occurred_at,
      owner_staff_user_id, summary
    ) VALUES (
      other_office_id, affiliation_id, 'call', 'outbound', NOW(),
      'bertrand-staff-user', 'Synthetic rejected call'
    );
    RAISE EXCEPTION 'w062_same_office_affiliation_rejection_missing';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ma_interaction_affiliation_must_match_office%' THEN RAISE; END IF;
  END;

  BEGIN
    INSERT INTO public.ma_interactions (
      office_id, opportunity_id, channel, direction, occurred_at,
      owner_staff_user_id, summary
    ) VALUES (
      other_office_id, (SELECT opportunity_id FROM public.ma_interactions WHERE id = interaction_id),
      'call', 'outbound', NOW(), 'bertrand-staff-user', 'Synthetic rejected opportunity'
    );
    RAISE EXCEPTION 'w062_same_office_opportunity_rejection_missing';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ma_interaction_opportunity_must_match_office%' THEN RAISE; END IF;
  END;
END;
$$;

SET ROLE service_role;
SELECT public.verify_ma_interaction_owner(
  '00000000-0000-0000-0000-000000000001'::UUID,
  'bertrand-staff-user'
);
RESET ROLE;

DO $$
BEGIN
  IF (SELECT owner_verification_state FROM public.ma_interactions
      WHERE id = '00000000-0000-0000-0000-000000000001'::UUID) <> 'verified'
    OR (SELECT COUNT(*) FROM public.ma_interaction_owner_verification_events) <> 1 THEN
    RAISE EXCEPTION 'w062_owner_verification_audit_failed';
  END IF;
END;
$$;

-- A current workflow-shaped failed email is recorded canonically with its
-- failure evidence. Browser-role direct reads are denied by grants and RLS.
SET ROLE service_role;
INSERT INTO public.ma_interactions (
  office_id, affiliation_id, opportunity_id, channel, direction, occurred_at,
  owner_staff_user_id, title, recipient_email_snapshot, body_markdown,
  delivery_status, delivery_error, created_by
)
SELECT office_id, affiliation_id, opportunity_id, 'email', 'outbound', NOW(),
  'bertrand-staff-user', 'Synthetic failed send', 'contact@example.test',
  'Synthetic failed body', 'failed', 'Synthetic provider failure', 'bertrand-staff-user'
FROM public.ma_interactions
WHERE id = '00000000-0000-0000-0000-000000000002'::UUID;
RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.ma_interactions
    WHERE title = 'Synthetic failed send'
      AND delivery_status = 'failed'
      AND delivery_error = 'Synthetic provider failure'
  ) THEN
    RAISE EXCEPTION 'w062_canonical_failed_delivery_evidence_missing';
  END IF;

  BEGIN
    SET LOCAL ROLE service_role;
    INSERT INTO public.ma_source_interactions (
      id, opportunity_id, template_key, recipient_email, subject, status
    ) SELECT gen_random_uuid(), id, 'x', 'x@example.test', 'x', 'sent'
      FROM public.opportunities LIMIT 1;
    RAISE EXCEPTION 'w062_legacy_write_retirement_missing';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM 1 FROM public.ma_interactions LIMIT 1;
    RAISE EXCEPTION 'w062_browser_read_denial_missing';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    SET LOCAL ROLE service_role;
    UPDATE public.ma_interactions
    SET title = 'Synthetic forbidden mutation'
    WHERE id = '00000000-0000-0000-0000-000000000003'::UUID;
    RAISE EXCEPTION 'w062_canonical_mutation_guard_missing';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;

\ir 080_ma_interaction_persistence.sql

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.ma_interaction_legacy_migration_manifest) <> 4 THEN
    RAISE EXCEPTION 'w062_clean_rerun_failed';
  END IF;
END;
$$;

SELECT 'W-062 migration rerun, manifest, ownership, privilege and same-office checks passed' AS rehearsal_result;
