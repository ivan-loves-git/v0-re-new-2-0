-- Disposable production-shaped rehearsal for W-066. Run with psql against an
-- empty disposable database; the W-062 rehearsal builds the canonical fixture.

\ir rehearse-ma-interaction-persistence.sql
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

SELECT 'W-066 relationship creation, manual-email boundary, same-office and clean-rerun checks passed' AS rehearsal_result;
