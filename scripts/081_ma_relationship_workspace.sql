-- Migration: staff M&A relationship workspace (W-066)
--
-- W-062 made the canonical interaction ledger append-only and introduced the
-- narrow provider-delivery path. This release adds one equally narrow service
-- for staff-recorded relationship activity. It never sends email and it does
-- not grant direct writes to the ledger.

BEGIN;

-- A staff member may record an email that happened outside WAVE (for example,
-- an inbound email). Such evidence has no provider delivery attempt. Keep the
-- delivery requirements strict whenever delivery_status is present, while
-- allowing a manual email record to retain delivery fields as NULL.
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT constraint_record.conname
    FROM pg_constraint constraint_record
    JOIN pg_class relation ON relation.oid = constraint_record.conrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'ma_interactions'
      AND constraint_record.contype = 'c'
      AND pg_get_constraintdef(constraint_record.oid) LIKE '%channel = ''email''%delivery_status IS NOT NULL%'
  LOOP
    EXECUTE format('ALTER TABLE public.ma_interactions DROP CONSTRAINT %I', constraint_name);
  END LOOP;

  FOR constraint_name IN
    SELECT constraint_record.conname
    FROM pg_constraint constraint_record
    JOIN pg_class relation ON relation.oid = constraint_record.conrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'ma_interactions'
      AND constraint_record.contype = 'c'
      AND pg_get_constraintdef(constraint_record.oid) LIKE '%channel <> ''email''%provider_idempotency_key%'
  LOOP
    EXECUTE format('ALTER TABLE public.ma_interactions DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END;
$$;

ALTER TABLE public.ma_interactions
  DROP CONSTRAINT IF EXISTS ma_interaction_email_delivery_if_present_check,
  DROP CONSTRAINT IF EXISTS ma_interaction_email_provider_evidence_check;

ALTER TABLE public.ma_interactions
  ADD CONSTRAINT ma_interaction_email_delivery_if_present_check
  CHECK (
    channel <> 'email'
    OR delivery_status IS NULL
    OR delivery_status IN ('pending', 'sent', 'failed')
  ),
  ADD CONSTRAINT ma_interaction_email_provider_evidence_check
  CHECK (
    delivery_status IS NULL
    OR (
      channel = 'email'
      AND NULLIF(BTRIM(provider_idempotency_key), '') IS NOT NULL
    )
  );

DROP FUNCTION IF EXISTS public.create_ma_relationship_interaction(
  UUID, UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT
);
CREATE OR REPLACE FUNCTION public.create_ma_relationship_interaction(
  p_office_id UUID,
  p_affiliation_id UUID,
  p_opportunity_id UUID,
  p_channel TEXT,
  p_direction TEXT,
  p_occurred_at TIMESTAMPTZ,
  p_title TEXT,
  p_summary TEXT,
  p_outcome TEXT,
  p_next_action TEXT,
  p_next_action_due_at TIMESTAMPTZ,
  p_recipient_email_snapshot TEXT,
  p_actor TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_actor TEXT;
  normalized_channel TEXT;
  normalized_direction TEXT;
  normalized_summary TEXT;
  normalized_recipient_email TEXT;
  affiliation_office_id UUID;
  opportunity_office_id UUID;
  new_interaction_id UUID;
BEGIN
  normalized_actor := NULLIF(BTRIM(p_actor), '');
  normalized_channel := LOWER(NULLIF(BTRIM(p_channel), ''));
  normalized_direction := LOWER(NULLIF(BTRIM(p_direction), ''));
  normalized_summary := NULLIF(BTRIM(p_summary), '');
  normalized_recipient_email := NULLIF(LOWER(BTRIM(p_recipient_email_snapshot)), '');

  IF normalized_actor IS NULL
    OR p_office_id IS NULL
    OR normalized_channel NOT IN ('call', 'email', 'meeting', 'document', 'other')
    OR p_occurred_at IS NULL
    OR normalized_summary IS NULL THEN
    RAISE EXCEPTION 'ma_relationship_interaction_requires_complete_staff_evidence';
  END IF;

  IF normalized_channel IN ('call', 'email')
    AND normalized_direction NOT IN ('inbound', 'outbound') THEN
    RAISE EXCEPTION 'ma_relationship_interaction_requires_direction';
  END IF;
  IF normalized_channel = 'email'
    AND normalized_direction = 'outbound'
    AND normalized_recipient_email IS NULL THEN
    RAISE EXCEPTION 'ma_relationship_interaction_outbound_email_requires_recipient';
  END IF;
  IF normalized_channel NOT IN ('call', 'email')
    AND normalized_direction IS NOT NULL THEN
    RAISE EXCEPTION 'ma_relationship_interaction_direction_not_supported';
  END IF;
  IF normalized_channel <> 'email' OR normalized_direction <> 'outbound' THEN
    normalized_recipient_email := NULL;
  END IF;

  IF (SELECT COUNT(*) FROM public.app_user_roles role
      WHERE role.role = 'staff' AND role.user_id = normalized_actor) <> 1 THEN
    RAISE EXCEPTION 'ma_relationship_interaction_requires_exact_staff_actor';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ma_offices office WHERE office.id = p_office_id
  ) THEN
    RAISE EXCEPTION 'ma_relationship_interaction_office_not_found';
  END IF;

  IF p_affiliation_id IS NOT NULL THEN
    SELECT affiliation.office_id INTO affiliation_office_id
    FROM public.ma_contact_office_affiliations affiliation
    WHERE affiliation.id = p_affiliation_id
      AND affiliation.is_active
      AND affiliation.ended_at IS NULL;
    IF affiliation_office_id IS DISTINCT FROM p_office_id THEN
      RAISE EXCEPTION 'ma_relationship_interaction_affiliation_must_match_active_office';
    END IF;
  END IF;

  IF p_opportunity_id IS NOT NULL THEN
    SELECT opportunity.source_office_id INTO opportunity_office_id
    FROM public.opportunities opportunity
    WHERE opportunity.id = p_opportunity_id;
    IF opportunity_office_id IS DISTINCT FROM p_office_id THEN
      RAISE EXCEPTION 'ma_relationship_interaction_opportunity_must_match_office';
    END IF;
  END IF;

  INSERT INTO public.ma_interactions (
    office_id, affiliation_id, opportunity_id, channel, direction, occurred_at,
    owner_staff_user_id, owner_verification_state, owner_verified_by,
    owner_verified_at, title, summary, outcome, next_action,
    next_action_due_at, recipient_email_snapshot, created_by, updated_by
  ) VALUES (
    p_office_id, p_affiliation_id, p_opportunity_id, normalized_channel,
    normalized_direction, p_occurred_at, normalized_actor, 'verified',
    normalized_actor, NOW(), NULLIF(BTRIM(p_title), ''), normalized_summary,
    NULLIF(BTRIM(p_outcome), ''), NULLIF(BTRIM(p_next_action), ''),
    p_next_action_due_at, normalized_recipient_email, normalized_actor, normalized_actor
  ) RETURNING id INTO new_interaction_id;

  RETURN new_interaction_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_ma_relationship_interaction(
  UUID, UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_ma_relationship_interaction(
  UUID, UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT
) TO service_role;

COMMENT ON FUNCTION public.create_ma_relationship_interaction(
  UUID, UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT
) IS 'Staff-only audited creation for manual M&A relationship history. It never sends email and validates current office, optional active affiliation, optional opportunity context and an outbound email recipient snapshot.';

COMMIT;
