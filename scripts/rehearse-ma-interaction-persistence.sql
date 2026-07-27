-- Synthetic, production-shaped prerequisite fixture for migration 080 only.
-- Values are invented and no body is printed by this rehearsal.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

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
  office_id UUID NOT NULL REFERENCES public.ma_offices(id),
  legacy_source_contact_id UUID,
  legacy_source_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ended_at TIMESTAMPTZ
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
CREATE TABLE public.ma_source_email_send_reservations (
  opportunity_id UUID PRIMARY KEY REFERENCES public.opportunities(id),
  reservation_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  actor TEXT NOT NULL,
  source_office_id UUID NOT NULL REFERENCES public.ma_offices(id),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE OR REPLACE FUNCTION public.ma_opportunity_source_review_required(
  p_opportunity_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT FALSE;
$$;

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
  public.opportunities,
  public.ma_source_email_send_reservations
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
  INSERT INTO public.ma_contact_office_affiliations (
    contact_id, office_id, legacy_source_contact_id, legacy_source_id
  )
  SELECT contact.id, source.default_office_id, contact.legacy_source_contact_id, source.id
  FROM contact JOIN source ON TRUE RETURNING id
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

  BEGIN
    UPDATE public.opportunities
    SET source_office_id = other_office_id
    WHERE id = (
      SELECT opportunity_id
      FROM public.ma_interactions
      WHERE id = interaction_id
    );
    RAISE EXCEPTION 'w062_parent_office_move_guard_missing';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ma_interaction_history_blocks_source_office_change%' THEN RAISE; END IF;
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

-- Canonical email persistence begins before delivery, uses the interaction UUID
-- as provider idempotency, blocks a second unresolved attempt and finalizes
-- through append-only delivery evidence.
INSERT INTO public.ma_source_email_send_reservations (
  opportunity_id, actor, source_office_id, expires_at
)
SELECT opportunity_id, 'bertrand-staff-user', office_id, NOW() + INTERVAL '2 minutes'
FROM public.ma_interactions
WHERE id IN (
  '00000000-0000-0000-0000-000000000002'::UUID,
  '00000000-0000-0000-0000-000000000003'::UUID
);

SET ROLE service_role;
SELECT *
FROM public.begin_ma_interaction_email_send(
  (SELECT opportunity_id FROM public.ma_interactions
    WHERE id = '00000000-0000-0000-0000-000000000002'::UUID),
  (SELECT office_id FROM public.ma_interactions
    WHERE id = '00000000-0000-0000-0000-000000000002'::UUID),
  (SELECT affiliation_id FROM public.ma_interactions
    WHERE id = '00000000-0000-0000-0000-000000000002'::UUID),
  'bertrand-staff-user',
  'ma_process_follow_up',
  'contact@example.test',
  'Synthetic failed send',
  'Synthetic failed body',
  '00000000-0000-4000-8000-000000000101'::UUID,
  REPEAT('a', 64),
  (SELECT reservation_token
    FROM public.ma_source_email_send_reservations
    WHERE opportunity_id = (
      SELECT opportunity_id FROM public.ma_interactions
      WHERE id = '00000000-0000-0000-0000-000000000002'::UUID
    ))
);

DO $$
DECLARE
  original_interaction_id UUID;
  replayed_interaction_id UUID;
BEGIN
  SELECT id INTO original_interaction_id
  FROM public.ma_interactions
  WHERE title = 'Synthetic failed send';

  SELECT interaction_id INTO replayed_interaction_id
  FROM public.begin_ma_interaction_email_send(
    (SELECT opportunity_id FROM public.ma_interactions
      WHERE id = '00000000-0000-0000-0000-000000000002'::UUID),
    (SELECT office_id FROM public.ma_interactions
      WHERE id = '00000000-0000-0000-0000-000000000002'::UUID),
    (SELECT affiliation_id FROM public.ma_interactions
      WHERE id = '00000000-0000-0000-0000-000000000002'::UUID),
    'bertrand-staff-user',
    'ma_process_follow_up',
    'contact@example.test',
    'Synthetic failed send',
    'Synthetic failed body',
    '00000000-0000-4000-8000-000000000101'::UUID,
    REPEAT('a', 64),
    (SELECT reservation_token
      FROM public.ma_source_email_send_reservations
      WHERE opportunity_id = (
        SELECT opportunity_id FROM public.ma_interactions
        WHERE id = '00000000-0000-0000-0000-000000000002'::UUID
      ))
  );
  IF replayed_interaction_id IS DISTINCT FROM original_interaction_id THEN
    RAISE EXCEPTION 'w062_same_operation_key_replay_created_duplicate';
  END IF;

  SELECT interaction_id INTO replayed_interaction_id
  FROM public.begin_ma_interaction_email_send(
    (SELECT opportunity_id FROM public.ma_interactions
      WHERE id = '00000000-0000-0000-0000-000000000002'::UUID),
    (SELECT office_id FROM public.ma_interactions
      WHERE id = '00000000-0000-0000-0000-000000000002'::UUID),
    (SELECT affiliation_id FROM public.ma_interactions
      WHERE id = '00000000-0000-0000-0000-000000000002'::UUID),
    'bertrand-staff-user',
    'ma_process_follow_up',
    'contact@example.test',
    'Synthetic failed send',
    'Synthetic failed body',
    '00000000-0000-4000-8000-000000000199'::UUID,
    REPEAT('a', 64),
    (SELECT reservation_token
      FROM public.ma_source_email_send_reservations
      WHERE opportunity_id = (
        SELECT opportunity_id FROM public.ma_interactions
        WHERE id = '00000000-0000-0000-0000-000000000002'::UUID
      ))
  );
  IF replayed_interaction_id IS DISTINCT FROM original_interaction_id THEN
    RAISE EXCEPTION 'w062_same_request_fingerprint_replay_created_duplicate';
  END IF;

  BEGIN
    PERFORM public.begin_ma_interaction_email_send(
      (SELECT opportunity_id FROM public.ma_interactions
        WHERE id = '00000000-0000-0000-0000-000000000002'::UUID),
      (SELECT office_id FROM public.ma_interactions
        WHERE id = '00000000-0000-0000-0000-000000000002'::UUID),
      (SELECT affiliation_id FROM public.ma_interactions
        WHERE id = '00000000-0000-0000-0000-000000000002'::UUID),
      'bertrand-staff-user',
      'ma_process_follow_up',
      'contact@example.test',
      'Synthetic duplicate send',
      'Synthetic duplicate body',
      '00000000-0000-4000-8000-000000000102'::UUID,
      REPEAT('c', 64),
      (SELECT reservation_token
        FROM public.ma_source_email_send_reservations
        WHERE opportunity_id = (
          SELECT opportunity_id FROM public.ma_interactions
          WHERE id = '00000000-0000-0000-0000-000000000002'::UUID
        ))
    );
    RAISE EXCEPTION 'w062_pending_delivery_duplicate_guard_missing';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ma_interaction_email_pending_delivery_requires_exact_replay%' THEN RAISE; END IF;
  END;
END;
$$;

SELECT public.finalize_ma_interaction_email_send(
  (SELECT id FROM public.ma_interactions
    WHERE client_operation_key = '00000000-0000-4000-8000-000000000101'::UUID),
  'bertrand-staff-user',
  'failed',
  NULL,
  'Synthetic provider failure'
);

DO $$
DECLARE
  failed_interaction_id UUID;
  retry_interaction_id UUID;
BEGIN
  SELECT id INTO failed_interaction_id
  FROM public.ma_interactions
  WHERE client_operation_key = '00000000-0000-4000-8000-000000000101'::UUID;

  SELECT interaction_id INTO retry_interaction_id
  FROM public.begin_ma_interaction_email_send(
    (SELECT opportunity_id FROM public.ma_interactions
      WHERE id = '00000000-0000-0000-0000-000000000002'::UUID),
    (SELECT office_id FROM public.ma_interactions
      WHERE id = '00000000-0000-0000-0000-000000000002'::UUID),
    (SELECT affiliation_id FROM public.ma_interactions
      WHERE id = '00000000-0000-0000-0000-000000000002'::UUID),
    'bertrand-staff-user',
    'ma_process_follow_up',
    'contact@example.test',
    'Synthetic failed send',
    'Synthetic failed body',
    '00000000-0000-4000-8000-000000000104'::UUID,
    REPEAT('a', 64),
    (SELECT reservation_token
      FROM public.ma_source_email_send_reservations
      WHERE opportunity_id = (
        SELECT opportunity_id FROM public.ma_interactions
        WHERE id = '00000000-0000-0000-0000-000000000002'::UUID
      ))
  );

  IF retry_interaction_id IS NULL
    OR retry_interaction_id = failed_interaction_id THEN
    RAISE EXCEPTION 'w062_finalized_failure_did_not_create_safe_retry';
  END IF;
END;
$$;

SELECT public.finalize_ma_interaction_email_send(
  (SELECT id FROM public.ma_interactions
    WHERE client_operation_key = '00000000-0000-4000-8000-000000000104'::UUID),
  'bertrand-staff-user',
  'failed',
  NULL,
  'Synthetic provider failure after safe retry'
);

SELECT *
FROM public.begin_ma_interaction_email_send(
  (SELECT opportunity_id FROM public.ma_interactions
    WHERE id = '00000000-0000-0000-0000-000000000003'::UUID),
  (SELECT office_id FROM public.ma_interactions
    WHERE id = '00000000-0000-0000-0000-000000000003'::UUID),
  (SELECT affiliation_id FROM public.ma_interactions
    WHERE id = '00000000-0000-0000-0000-000000000003'::UUID),
  'bertrand-staff-user',
  'ma_process_follow_up',
  'contact@example.test',
  'Synthetic sent send',
  'Synthetic sent body',
  '00000000-0000-4000-8000-000000000103'::UUID,
  REPEAT('b', 64),
  (SELECT reservation_token
    FROM public.ma_source_email_send_reservations
    WHERE opportunity_id = (
      SELECT opportunity_id FROM public.ma_interactions
      WHERE id = '00000000-0000-0000-0000-000000000003'::UUID
    ))
);

SELECT public.finalize_ma_interaction_email_send(
  (SELECT id FROM public.ma_interactions WHERE title = 'Synthetic sent send'),
  'bertrand-staff-user',
  'sent',
  'provider-message-synthetic',
  NULL
);

DO $$
DECLARE
  original_interaction_id UUID;
  replayed_interaction_id UUID;
  replayed_delivery_status TEXT;
BEGIN
  SELECT id INTO original_interaction_id
  FROM public.ma_interactions
  WHERE title = 'Synthetic sent send';

  SELECT interaction_id, delivery_status
  INTO replayed_interaction_id, replayed_delivery_status
  FROM public.begin_ma_interaction_email_send(
    (SELECT opportunity_id FROM public.ma_interactions
      WHERE id = '00000000-0000-0000-0000-000000000003'::UUID),
    (SELECT office_id FROM public.ma_interactions
      WHERE id = '00000000-0000-0000-0000-000000000003'::UUID),
    (SELECT affiliation_id FROM public.ma_interactions
      WHERE id = '00000000-0000-0000-0000-000000000003'::UUID),
    'bertrand-staff-user',
    'ma_process_follow_up',
    'contact@example.test',
    'Synthetic sent send',
    'Synthetic sent body',
    '00000000-0000-4000-8000-000000000103'::UUID,
    REPEAT('b', 64),
    (SELECT reservation_token
      FROM public.ma_source_email_send_reservations
      WHERE opportunity_id = (
        SELECT opportunity_id FROM public.ma_interactions
        WHERE id = '00000000-0000-0000-0000-000000000003'::UUID
      ))
  );

  IF replayed_interaction_id IS DISTINCT FROM original_interaction_id
    OR replayed_delivery_status <> 'sent' THEN
    RAISE EXCEPTION 'w062_finalized_response_loss_replay_created_duplicate';
  END IF;
END;
$$;
RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.ma_interactions
    WHERE title = 'Synthetic failed send'
      AND delivery_status = 'failed'
      AND delivery_error = 'Synthetic provider failure'
      AND client_operation_key = '00000000-0000-4000-8000-000000000101'::UUID
      AND provider_idempotency_key = id::TEXT
      AND provider_request_fingerprint = REPEAT('a', 64)
      AND delivery_finalized_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'w062_canonical_failed_delivery_evidence_missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.ma_interactions
    WHERE title = 'Synthetic sent send'
      AND delivery_status = 'sent'
      AND client_operation_key = '00000000-0000-4000-8000-000000000103'::UUID
      AND provider_message_id = 'provider-message-synthetic'
      AND provider_idempotency_key = id::TEXT
      AND provider_request_fingerprint = REPEAT('b', 64)
      AND sent_at IS NOT NULL
      AND delivery_finalized_at IS NOT NULL
  ) OR (
    SELECT COUNT(*) FROM public.ma_interaction_delivery_events
    WHERE event_kind = 'pending'
  ) <> 5 OR (
    SELECT COUNT(*) FROM public.ma_interaction_delivery_events
    WHERE event_kind IN ('sent', 'failed')
  ) <> 3 THEN
    RAISE EXCEPTION 'w062_provider_delivery_event_evidence_missing';
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
    SET LOCAL ROLE service_role;
    INSERT INTO public.ma_interactions (
      office_id, channel, direction, occurred_at, owner_staff_user_id,
      owner_verification_state, owner_verified_by, owner_verified_at,
      summary, created_by
    )
    SELECT id, 'call', 'outbound', NOW(), 'not-a-staff-user',
      'verified', 'not-a-staff-user', NOW(), 'Forbidden direct insert', NULL
    FROM public.ma_offices
    LIMIT 1;
    RAISE EXCEPTION 'w062_direct_verified_insert_denial_missing';
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

-- Generic opportunity source changes are blocked both by an active W-064 send
-- reservation and by already-linked immutable interaction history.
DO $$
DECLARE
  original_office_id UUID;
  other_office_id UUID;
  reserved_opportunity_id UUID;
BEGIN
  SELECT id INTO original_office_id
  FROM public.ma_offices
  ORDER BY name
  LIMIT 1;
  SELECT id INTO other_office_id
  FROM public.ma_offices
  WHERE id <> original_office_id
  ORDER BY name
  LIMIT 1;

  INSERT INTO public.opportunities (reference, source_office_id)
  VALUES ('W062-RESERVATION-GUARD', original_office_id)
  RETURNING id INTO reserved_opportunity_id;

  INSERT INTO public.ma_source_email_send_reservations (
    opportunity_id, actor, source_office_id, expires_at
  ) VALUES (
    reserved_opportunity_id, 'bertrand-staff-user', original_office_id,
    NOW() + INTERVAL '2 minutes'
  );

  BEGIN
    UPDATE public.opportunities
    SET source_office_id = other_office_id
    WHERE id = reserved_opportunity_id;
    RAISE EXCEPTION 'w062_reservation_source_move_guard_missing';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ma_source_office_change_blocked_during_email_send%' THEN RAISE; END IF;
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

SELECT 'W-062 migration rerun, manifest, owner, provider, privilege, reservation and same-office checks passed' AS rehearsal_result;
