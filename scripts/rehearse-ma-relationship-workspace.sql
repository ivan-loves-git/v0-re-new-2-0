-- Disposable production-shaped rehearsal for W-066. Run with psql against an
-- empty disposable database; the W-062 rehearsal builds the canonical fixture.

\ir rehearse-ma-interaction-persistence.sql

-- Mirror the W-064/W-065 computed review predicate in this intentionally
-- compact fixture. The production migration calls the released function, not
-- a UI-provided review flag.
CREATE TABLE public.ma_provisional_source_contexts (
  context_key TEXT PRIMARY KEY,
  office_id UUID NOT NULL REFERENCES public.ma_offices(id)
);
CREATE TABLE public.ma_provisional_source_review_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id),
  provisional_office_id UUID NOT NULL REFERENCES public.ma_offices(id),
  event_kind TEXT NOT NULL,
  related_assignment_id UUID
);
CREATE OR REPLACE FUNCTION public.ma_opportunity_source_review_required(
  p_opportunity_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ma_provisional_source_contexts context
    JOIN public.opportunities opportunity ON opportunity.id = p_opportunity_id
    WHERE context.context_key = 'acme_co_paris'
      AND opportunity.source_office_id = context.office_id
  ) OR EXISTS (
    SELECT 1
    FROM public.ma_provisional_source_review_events assignment
    JOIN public.ma_provisional_source_contexts context
      ON context.context_key = 'acme_co_paris'
      AND context.office_id = assignment.provisional_office_id
    WHERE assignment.opportunity_id = p_opportunity_id
      AND assignment.event_kind = 'assigned'
      AND NOT EXISTS (
        SELECT 1
        FROM public.ma_provisional_source_review_events resolution
        WHERE resolution.event_kind = 'resolved'
          AND resolution.related_assignment_id = assignment.id
      )
  );
$$;
\ir 081_ma_relationship_workspace.sql

SET ROLE service_role;

SELECT public.create_ma_relationship_interaction(
  (SELECT id FROM public.ma_offices ORDER BY name LIMIT 1),
  NULL,
  NULL,
  'meeting',
  NULL,
  NOW() - INTERVAL '1 hour',
  'Synthetic relationship meeting',
  'Discussed a possible mandate before an opportunity exists.',
  'Awaiting source material.',
  'Follow up with the office.',
  NOW() + INTERVAL '2 days',
  'stale-outbound@example.test',
  'bertrand-staff-user'
);

SELECT public.create_ma_relationship_interaction(
  (SELECT id FROM public.ma_offices ORDER BY name LIMIT 1),
  (SELECT id FROM public.ma_contact_office_affiliations
    WHERE office_id = (SELECT id FROM public.ma_offices ORDER BY name LIMIT 1)
      AND is_active AND ended_at IS NULL
    LIMIT 1),
  NULL,
  'email',
  'inbound',
  NOW(),
  'Synthetic inbound email',
  'The contact sent an evidence-only message outside WAVE.',
  NULL,
  NULL,
  NULL,
  'stale-inbound@example.test',
  'bertrand-staff-user'
);

SELECT public.create_ma_relationship_interaction(
  (SELECT id FROM public.ma_offices ORDER BY name LIMIT 1),
  NULL,
  NULL,
  'email',
  'outbound',
  NOW(),
  'Synthetic outbound email',
  'Staff records a completed outbound communication without sending one.',
  NULL,
  NULL,
  NULL,
  'recipient@example.test',
  'bertrand-staff-user'
);

RESET ROLE;

DO $$
DECLARE
  first_office UUID;
  other_office UUID;
  other_firm UUID;
  active_affiliation UUID;
  other_affiliation UUID;
  acme_firm UUID;
  acme_office UUID;
  acme_opportunity UUID;
BEGIN
  SELECT office_id, id INTO first_office, active_affiliation
  FROM public.ma_contact_office_affiliations
  WHERE is_active AND ended_at IS NULL
  ORDER BY id
  LIMIT 1;
  INSERT INTO public.ma_firms (name)
  VALUES ('W066 alternate office fixture')
  RETURNING id INTO other_firm;
  INSERT INTO public.ma_offices (firm_id, name)
  VALUES (other_firm, 'W066 alternate office')
  RETURNING id INTO other_office;
  INSERT INTO public.ma_contact_office_affiliations (contact_id, office_id)
  SELECT contact_id, other_office
  FROM public.ma_contact_office_affiliations
  WHERE id = active_affiliation
  RETURNING id INTO other_affiliation;

  INSERT INTO public.ma_firms (name)
  VALUES ('W066 Acme provisional fixture')
  RETURNING id INTO acme_firm;
  INSERT INTO public.ma_offices (firm_id, name)
  VALUES (acme_firm, 'W066 Acme provisional office')
  RETURNING id INTO acme_office;
  INSERT INTO public.ma_provisional_source_contexts (context_key, office_id)
  VALUES ('acme_co_paris', acme_office);
  INSERT INTO public.opportunities (reference, source_office_id)
  VALUES ('W066-ACME-REVIEW', acme_office)
  RETURNING id INTO acme_opportunity;

  IF NOT EXISTS (
    SELECT 1 FROM public.ma_interactions
    WHERE title = 'Synthetic relationship meeting'
      AND channel = 'meeting'
      AND opportunity_id IS NULL
      AND affiliation_id IS NULL
      AND owner_staff_user_id = 'bertrand-staff-user'
      AND owner_verification_state = 'verified'
      AND delivery_status IS NULL
      AND recipient_email_snapshot IS NULL
  ) THEN
    RAISE EXCEPTION 'w066_preopportunity_relationship_capture_missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ma_interactions
    WHERE title = 'Synthetic inbound email'
      AND channel = 'email'
      AND direction = 'inbound'
      AND delivery_status IS NULL
      AND provider_idempotency_key IS NULL
      AND provider_message_id IS NULL
      AND recipient_email_snapshot IS NULL
  ) THEN
    RAISE EXCEPTION 'w066_manual_email_evidence_boundary_missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.ma_interactions
    WHERE title = 'Synthetic outbound email'
      AND channel = 'email'
      AND direction = 'outbound'
      AND recipient_email_snapshot = 'recipient@example.test'
      AND delivery_status IS NULL
      AND provider_idempotency_key IS NULL
  ) THEN
    RAISE EXCEPTION 'w066_outbound_email_recipient_snapshot_missing';
  END IF;

  BEGIN
    SET LOCAL ROLE service_role;
    PERFORM public.create_ma_relationship_interaction(
      first_office, NULL, NULL, 'email', 'outbound', NOW(),
      'Missing outbound recipient', 'This must be rejected.', NULL, NULL, NULL,
      NULL, 'bertrand-staff-user'
    );
    RAISE EXCEPTION 'w066_outbound_email_recipient_rejection_missing';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ma_relationship_interaction_outbound_email_requires_recipient%' THEN RAISE; END IF;
  END;

  BEGIN
    SET LOCAL ROLE service_role;
    PERFORM public.create_ma_relationship_interaction(
      other_office, active_affiliation, NULL, 'call', 'outbound', NOW(),
      'Bad office relation', 'This must be rejected.', NULL, NULL, NULL,
      NULL, 'bertrand-staff-user'
    );
    RAISE EXCEPTION 'w066_cross_office_affiliation_rejection_missing';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ma_relationship_interaction_affiliation_must_match_active_office%' THEN RAISE; END IF;
  END;

  BEGIN
    SET LOCAL ROLE service_role;
    PERFORM public.create_ma_relationship_interaction(
      first_office, NULL, NULL, 'email', 'outbound', NOW(),
      'Invalid outbound recipient', 'This must be rejected.', NULL, NULL, NULL,
      'not-an-email', 'bertrand-staff-user'
    );
    RAISE EXCEPTION 'w066_outbound_email_invalid_recipient_rejection_missing';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ma_relationship_interaction_outbound_email_requires_valid_recipient%' THEN RAISE; END IF;
  END;

  BEGIN
    SET LOCAL ROLE service_role;
    PERFORM public.create_ma_relationship_interaction(
      acme_office, NULL, acme_opportunity, 'meeting', NULL, NOW(),
      'Blocked Acme-linked activity', 'This must be rejected.', NULL, NULL, NULL,
      NULL, 'bertrand-staff-user'
    );
    RAISE EXCEPTION 'w066_acme_linked_interaction_rejection_missing';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ma_provisional_source_review_blocks_relationship_interaction%' THEN RAISE; END IF;
  END;

  UPDATE public.opportunities
  SET source_office_id = first_office
  WHERE id = acme_opportunity;
  IF (SELECT source_office_id FROM public.opportunities WHERE id = acme_opportunity)
    IS DISTINCT FROM first_office THEN
    RAISE EXCEPTION 'w066_acme_resolution_remains_possible_missing';
  END IF;

  SET LOCAL ROLE service_role;
  PERFORM public.create_ma_relationship_interaction(
    other_office, other_affiliation, NULL, 'call', 'outbound', NOW(),
    'Same contact at another office', 'Canonical contact filter regression fixture.', NULL, NULL, NULL,
    NULL, 'bertrand-staff-user'
  );
  RESET ROLE;
  IF (SELECT COUNT(DISTINCT interaction.affiliation_id)
      FROM public.ma_interactions interaction
      JOIN public.ma_contact_office_affiliations affiliation
        ON affiliation.id = interaction.affiliation_id
      WHERE affiliation.contact_id = (
        SELECT contact_id FROM public.ma_contact_office_affiliations
        WHERE id = active_affiliation
      )) < 2 THEN
    RAISE EXCEPTION 'w066_canonical_contact_multi_affiliation_fixture_missing';
  END IF;
END;
$$;

\ir 081_ma_relationship_workspace.sql

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.ma_interactions WHERE title = 'Synthetic inbound email') <> 1 THEN
    RAISE EXCEPTION 'w066_clean_rerun_changed_relationship_history';
  END IF;
END;
$$;

INSERT INTO public.opportunities (reference, source_office_id)
SELECT fixture.reference, office.id
FROM (
  VALUES
    ('W066-RACE-CREATE-FIRST'),
    ('W066-RACE-SOURCE-FIRST')
) AS fixture(reference)
CROSS JOIN LATERAL (
  SELECT affiliation.office_id AS id
  FROM public.ma_contact_office_affiliations affiliation
  WHERE affiliation.is_active AND affiliation.ended_at IS NULL
  ORDER BY affiliation.id
  LIMIT 1
) office
ON CONFLICT (reference) DO NOTHING;

CREATE OR REPLACE FUNCTION public.w066_pause_after_relationship_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.title = 'Concurrent create-first' THEN
    PERFORM pg_sleep(6);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER w066_pause_after_relationship_lock
BEFORE INSERT ON public.ma_interactions
FOR EACH ROW EXECUTE FUNCTION public.w066_pause_after_relationship_lock();

SELECT 'W-066 relationship creation, Acme/source-resolution, manual-email, same-office and canonical-contact checks passed' AS rehearsal_result;
