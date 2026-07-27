-- Migration: canonical office-anchored M&A interaction persistence (W-062)
--
-- This is an additive, fail-closed cutover from ma_source_interactions. It
-- deliberately does not create a general interaction workspace or attachment
-- capability; those remain W-066 work. Legacy rows remain service-read-only
-- compatibility evidence after their exact UUIDs and evidence are copied.

BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.ma_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.ma_offices(id) ON DELETE RESTRICT,
  affiliation_id UUID REFERENCES public.ma_contact_office_affiliations(id) ON DELETE RESTRICT,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  channel TEXT NOT NULL CHECK (channel IN ('call', 'email', 'meeting', 'document', 'other')),
  direction TEXT CHECK (direction IN ('inbound', 'outbound')),
  occurred_at TIMESTAMPTZ NOT NULL,
  owner_staff_user_id TEXT NOT NULL,
  owner_verification_state TEXT NOT NULL DEFAULT 'provisional'
    CHECK (owner_verification_state IN ('provisional', 'verified')),
  owner_verified_by TEXT,
  owner_verified_at TIMESTAMPTZ,
  title TEXT,
  summary TEXT,
  outcome TEXT,
  next_action TEXT,
  next_action_due_at TIMESTAMPTZ,
  template_key TEXT,
  recipient_email_snapshot TEXT,
  body_markdown TEXT,
  delivery_status TEXT CHECK (delivery_status IN ('pending', 'sent', 'failed')),
  delivery_error TEXT,
  provider_idempotency_key TEXT,
  provider_message_id TEXT,
  delivery_finalized_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (channel IN ('call', 'email') AND direction IS NOT NULL)
    OR (channel NOT IN ('call', 'email'))
  ),
  CHECK (
    (channel = 'email' AND delivery_status IS NOT NULL)
    OR (channel <> 'email' AND delivery_status IS NULL)
  ),
  CHECK (
    (channel <> 'email' OR direction <> 'outbound'
      OR NULLIF(BTRIM(recipient_email_snapshot), '') IS NOT NULL)
  ),
  CHECK (
    (delivery_status <> 'failed')
    OR NULLIF(BTRIM(delivery_error), '') IS NOT NULL
  ),
  CHECK ((delivery_status <> 'sent') OR sent_at IS NOT NULL),
  CHECK ((delivery_status <> 'pending') OR delivery_finalized_at IS NULL),
  CHECK ((delivery_status = 'pending') OR delivery_finalized_at IS NOT NULL),
  CHECK (
    channel <> 'email'
    OR NULLIF(BTRIM(provider_idempotency_key), '') IS NOT NULL
  ),
  CHECK (
    (owner_verification_state = 'provisional'
      AND owner_verified_by IS NULL AND owner_verified_at IS NULL)
    OR (owner_verification_state = 'verified'
      AND NULLIF(BTRIM(owner_verified_by), '') IS NOT NULL
      AND owner_verified_at IS NOT NULL)
  ),
  CHECK (
    NULLIF(BTRIM(summary), '') IS NOT NULL
    OR NULLIF(BTRIM(body_markdown), '') IS NOT NULL
  )
);

CREATE TABLE IF NOT EXISTS public.ma_interaction_owner_verification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id UUID NOT NULL REFERENCES public.ma_interactions(id) ON DELETE RESTRICT,
  owner_staff_user_id TEXT NOT NULL,
  verified_by TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  previous_state TEXT NOT NULL CHECK (previous_state = 'provisional'),
  resulting_state TEXT NOT NULL CHECK (resulting_state = 'verified'),
  CHECK (NULLIF(BTRIM(owner_staff_user_id), '') IS NOT NULL),
  CHECK (NULLIF(BTRIM(verified_by), '') IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.ma_interaction_delivery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id UUID NOT NULL REFERENCES public.ma_interactions(id) ON DELETE RESTRICT,
  event_kind TEXT NOT NULL CHECK (event_kind IN ('pending', 'sent', 'failed')),
  actor TEXT NOT NULL,
  provider_idempotency_key TEXT NOT NULL,
  provider_message_id TEXT,
  delivery_error TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (NULLIF(BTRIM(actor), '') IS NOT NULL),
  CHECK (NULLIF(BTRIM(provider_idempotency_key), '') IS NOT NULL),
  CHECK ((event_kind <> 'failed') OR NULLIF(BTRIM(delivery_error), '') IS NOT NULL),
  CHECK ((event_kind <> 'sent') OR NULLIF(BTRIM(provider_message_id), '') IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.ma_interaction_legacy_migration_manifest (
  legacy_interaction_id UUID PRIMARY KEY,
  legacy_evidence_digest TEXT NOT NULL CHECK (legacy_evidence_digest ~ '^[0-9a-f]{64}$'),
  canonical_evidence_digest TEXT NOT NULL CHECK (canonical_evidence_digest ~ '^[0-9a-f]{64}$'),
  migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (legacy_evidence_digest = canonical_evidence_digest)
);

CREATE INDEX IF NOT EXISTS idx_ma_interactions_office_occurred_at
  ON public.ma_interactions (office_id, occurred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_ma_interactions_opportunity_occurred_at
  ON public.ma_interactions (opportunity_id, occurred_at DESC, id DESC)
  WHERE opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ma_interactions_affiliation_occurred_at
  ON public.ma_interactions (affiliation_id, occurred_at DESC, id DESC)
  WHERE affiliation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ma_interaction_owner_verification_events_interaction
  ON public.ma_interaction_owner_verification_events (interaction_id, verified_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_ma_interaction_delivery_events_interaction
  ON public.ma_interaction_delivery_events (interaction_id, occurred_at DESC, id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ma_interactions_pending_opportunity
  ON public.ma_interactions (opportunity_id)
  WHERE delivery_status = 'pending' AND opportunity_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ma_interactions_provider_idempotency_key
  ON public.ma_interactions (provider_idempotency_key)
  WHERE provider_idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_ma_interaction_office_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  affiliation_office_id UUID;
  opportunity_office_id UUID;
BEGIN
  IF NEW.affiliation_id IS NOT NULL THEN
    SELECT affiliation.office_id
    INTO affiliation_office_id
    FROM public.ma_contact_office_affiliations affiliation
    WHERE affiliation.id = NEW.affiliation_id;

    IF affiliation_office_id IS NULL OR affiliation_office_id IS DISTINCT FROM NEW.office_id THEN
      RAISE EXCEPTION 'ma_interaction_affiliation_must_match_office';
    END IF;
  END IF;

  IF NEW.opportunity_id IS NOT NULL THEN
    SELECT opportunity.source_office_id
    INTO opportunity_office_id
    FROM public.opportunities opportunity
    WHERE opportunity.id = NEW.opportunity_id;

    IF opportunity_office_id IS NULL OR opportunity_office_id IS DISTINCT FROM NEW.office_id THEN
      RAISE EXCEPTION 'ma_interaction_opportunity_must_match_office';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_ma_interaction_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'ma_interactions_are_append_only';
  END IF;

  IF current_setting('app.ma_interaction_owner_verification', true) = 'true' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.office_id IS DISTINCT FROM OLD.office_id
    OR NEW.affiliation_id IS DISTINCT FROM OLD.affiliation_id
    OR NEW.opportunity_id IS DISTINCT FROM OLD.opportunity_id
    OR NEW.channel IS DISTINCT FROM OLD.channel
    OR NEW.direction IS DISTINCT FROM OLD.direction
    OR NEW.occurred_at IS DISTINCT FROM OLD.occurred_at
    OR NEW.owner_staff_user_id IS DISTINCT FROM OLD.owner_staff_user_id
    OR NEW.title IS DISTINCT FROM OLD.title
    OR NEW.summary IS DISTINCT FROM OLD.summary
    OR NEW.outcome IS DISTINCT FROM OLD.outcome
    OR NEW.next_action IS DISTINCT FROM OLD.next_action
    OR NEW.next_action_due_at IS DISTINCT FROM OLD.next_action_due_at
    OR NEW.template_key IS DISTINCT FROM OLD.template_key
    OR NEW.recipient_email_snapshot IS DISTINCT FROM OLD.recipient_email_snapshot
    OR NEW.body_markdown IS DISTINCT FROM OLD.body_markdown
    OR NEW.delivery_status IS DISTINCT FROM OLD.delivery_status
    OR NEW.delivery_error IS DISTINCT FROM OLD.delivery_error
    OR NEW.sent_at IS DISTINCT FROM OLD.sent_at
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.updated_by IS DISTINCT FROM OLD.updated_by
    OR NEW.updated_at IS DISTINCT FROM OLD.updated_at
    OR OLD.owner_verification_state <> 'provisional'
    OR NEW.owner_verification_state <> 'verified'
    OR NEW.owner_verified_by IS NULL
    OR NEW.owner_verified_at IS NULL THEN
      RAISE EXCEPTION 'ma_interactions_are_append_only_except_owner_verification';
    END IF;
    RETURN NEW;
  END IF;

  IF current_setting('app.ma_interaction_delivery_finalization', true) = 'true' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.office_id IS DISTINCT FROM OLD.office_id
      OR NEW.affiliation_id IS DISTINCT FROM OLD.affiliation_id
      OR NEW.opportunity_id IS DISTINCT FROM OLD.opportunity_id
      OR NEW.channel IS DISTINCT FROM OLD.channel
      OR NEW.direction IS DISTINCT FROM OLD.direction
      OR NEW.occurred_at IS DISTINCT FROM OLD.occurred_at
      OR NEW.owner_staff_user_id IS DISTINCT FROM OLD.owner_staff_user_id
      OR NEW.owner_verification_state IS DISTINCT FROM OLD.owner_verification_state
      OR NEW.owner_verified_by IS DISTINCT FROM OLD.owner_verified_by
      OR NEW.owner_verified_at IS DISTINCT FROM OLD.owner_verified_at
      OR NEW.title IS DISTINCT FROM OLD.title
      OR NEW.summary IS DISTINCT FROM OLD.summary
      OR NEW.outcome IS DISTINCT FROM OLD.outcome
      OR NEW.next_action IS DISTINCT FROM OLD.next_action
      OR NEW.next_action_due_at IS DISTINCT FROM OLD.next_action_due_at
      OR NEW.template_key IS DISTINCT FROM OLD.template_key
      OR NEW.recipient_email_snapshot IS DISTINCT FROM OLD.recipient_email_snapshot
      OR NEW.body_markdown IS DISTINCT FROM OLD.body_markdown
      OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.updated_by IS DISTINCT FROM OLD.updated_by
      OR NEW.updated_at IS DISTINCT FROM OLD.updated_at
      OR OLD.delivery_status <> 'pending'
      OR NEW.delivery_status NOT IN ('sent', 'failed')
      OR NEW.provider_idempotency_key IS DISTINCT FROM OLD.provider_idempotency_key
      OR NEW.delivery_finalized_at IS NULL
      OR (NEW.delivery_status = 'sent' AND (NEW.sent_at IS NULL OR NULLIF(BTRIM(NEW.provider_message_id), '') IS NULL))
      OR (NEW.delivery_status = 'failed' AND NULLIF(BTRIM(NEW.delivery_error), '') IS NULL) THEN
      RAISE EXCEPTION 'ma_interactions_are_append_only_except_delivery_finalization';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'ma_interactions_are_append_only';
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_ma_interaction_owner_verification_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'ma_interaction_owner_verification_events_are_append_only';
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_ma_interaction_delivery_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'ma_interaction_delivery_events_are_append_only';
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_ma_interaction_opportunity_source_office()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.source_office_id IS DISTINCT FROM OLD.source_office_id THEN
    IF EXISTS (
      SELECT 1
      FROM public.ma_source_email_send_reservations reservation
      WHERE reservation.opportunity_id = OLD.id
        AND reservation.expires_at > NOW()
    ) THEN
      RAISE EXCEPTION 'ma_source_office_change_blocked_during_email_send';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.ma_interactions interaction
      WHERE interaction.opportunity_id = OLD.id
        AND interaction.office_id IS DISTINCT FROM NEW.source_office_id
    ) THEN
      RAISE EXCEPTION 'ma_interaction_history_blocks_source_office_change';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_ma_interaction_office_context ON public.ma_interactions;
DROP TRIGGER IF EXISTS guard_ma_interaction_mutation ON public.ma_interactions;
DROP TRIGGER IF EXISTS prevent_ma_interaction_owner_verification_event_mutation
  ON public.ma_interaction_owner_verification_events;
DROP TRIGGER IF EXISTS prevent_ma_interaction_delivery_event_mutation
  ON public.ma_interaction_delivery_events;
DROP TRIGGER IF EXISTS guard_ma_interaction_opportunity_source_office
  ON public.opportunities;
CREATE TRIGGER enforce_ma_interaction_office_context
  BEFORE INSERT OR UPDATE ON public.ma_interactions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ma_interaction_office_context();
CREATE TRIGGER guard_ma_interaction_mutation
  BEFORE UPDATE OR DELETE ON public.ma_interactions
  FOR EACH ROW EXECUTE FUNCTION public.guard_ma_interaction_mutation();
CREATE TRIGGER prevent_ma_interaction_owner_verification_event_mutation
  BEFORE UPDATE OR DELETE ON public.ma_interaction_owner_verification_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_ma_interaction_owner_verification_event_mutation();
CREATE TRIGGER prevent_ma_interaction_delivery_event_mutation
  BEFORE UPDATE OR DELETE ON public.ma_interaction_delivery_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_ma_interaction_delivery_event_mutation();
CREATE TRIGGER guard_ma_interaction_opportunity_source_office
  BEFORE UPDATE OF source_office_id ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.guard_ma_interaction_opportunity_source_office();

CREATE OR REPLACE FUNCTION public.verify_ma_interaction_owner(
  p_interaction_id UUID,
  p_actor TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  interaction_owner TEXT;
  interaction_state TEXT;
  actor_is_staff BOOLEAN;
BEGIN
  IF NULLIF(BTRIM(p_actor), '') IS NULL THEN
    RAISE EXCEPTION 'ma_interaction_owner_verification_requires_actor';
  END IF;

  SELECT owner_staff_user_id, owner_verification_state
  INTO interaction_owner, interaction_state
  FROM public.ma_interactions
  WHERE id = p_interaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ma_interaction_not_found';
  END IF;
  IF interaction_state <> 'provisional' THEN
    RAISE EXCEPTION 'ma_interaction_owner_already_verified';
  END IF;
  IF interaction_owner IS DISTINCT FROM BTRIM(p_actor) THEN
    RAISE EXCEPTION 'ma_interaction_owner_must_verify_self';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.app_user_roles role
    WHERE role.role = 'staff'
      AND role.user_id = BTRIM(p_actor)
  ) INTO actor_is_staff;

  IF NOT actor_is_staff THEN
    RAISE EXCEPTION 'ma_interaction_owner_verification_requires_staff_actor';
  END IF;

  PERFORM set_config('app.ma_interaction_owner_verification', 'true', true);
  UPDATE public.ma_interactions
  SET owner_verification_state = 'verified',
      owner_verified_by = BTRIM(p_actor),
      owner_verified_at = NOW()
  WHERE id = p_interaction_id;

  INSERT INTO public.ma_interaction_owner_verification_events (
    interaction_id, owner_staff_user_id, verified_by, previous_state, resulting_state
  ) VALUES (
    p_interaction_id, interaction_owner, BTRIM(p_actor), 'provisional', 'verified'
  );

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.begin_ma_interaction_email_send(
  p_opportunity_id UUID,
  p_office_id UUID,
  p_affiliation_id UUID,
  p_actor TEXT,
  p_template_key TEXT,
  p_recipient_email TEXT,
  p_title TEXT,
  p_body_markdown TEXT,
  p_reservation_token UUID
)
RETURNS TABLE (interaction_id UUID, provider_idempotency_key TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_actor TEXT;
  opportunity_row public.opportunities%ROWTYPE;
  affiliation_office_id UUID;
  interaction_row public.ma_interactions%ROWTYPE;
  new_interaction_id UUID;
  staff_count INTEGER;
BEGIN
  normalized_actor := NULLIF(BTRIM(p_actor), '');
  IF normalized_actor IS NULL
    OR NULLIF(BTRIM(p_template_key), '') IS NULL
    OR NULLIF(BTRIM(p_recipient_email), '') IS NULL
    OR NULLIF(BTRIM(p_title), '') IS NULL
    OR NULLIF(BTRIM(p_body_markdown), '') IS NULL THEN
    RAISE EXCEPTION 'ma_interaction_email_begin_requires_complete_staff_evidence';
  END IF;

  SELECT COUNT(*) INTO staff_count
  FROM public.app_user_roles role
  WHERE role.role = 'staff' AND role.user_id = normalized_actor;
  IF staff_count <> 1 THEN
    RAISE EXCEPTION 'ma_interaction_email_begin_requires_exact_staff_actor';
  END IF;

  SELECT * INTO opportunity_row
  FROM public.opportunities opportunity
  WHERE opportunity.id = p_opportunity_id
  FOR UPDATE;
  IF opportunity_row.id IS NULL
    OR opportunity_row.source_office_id IS DISTINCT FROM p_office_id THEN
    RAISE EXCEPTION 'ma_interaction_email_begin_requires_current_opportunity_office';
  END IF;

  SELECT affiliation.office_id INTO affiliation_office_id
  FROM public.ma_contact_office_affiliations affiliation
  WHERE affiliation.id = p_affiliation_id
    AND affiliation.is_active
    AND affiliation.ended_at IS NULL;
  IF affiliation_office_id IS DISTINCT FROM p_office_id THEN
    RAISE EXCEPTION 'ma_interaction_email_begin_requires_same_office_affiliation';
  END IF;

  IF public.ma_opportunity_source_review_required(opportunity_row.id) THEN
    RAISE EXCEPTION 'ma_provisional_source_review_blocks_external_email';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.ma_source_email_send_reservations reservation
    WHERE reservation.opportunity_id = opportunity_row.id
      AND reservation.reservation_token = p_reservation_token
      AND reservation.actor = normalized_actor
      AND reservation.source_office_id = p_office_id
      AND reservation.expires_at > NOW()
  ) THEN
    RAISE EXCEPTION 'ma_interaction_email_begin_requires_active_reservation';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ma_interactions interaction
    WHERE interaction.opportunity_id = opportunity_row.id
      AND interaction.delivery_status = 'pending'
  ) THEN
    RAISE EXCEPTION 'ma_interaction_email_pending_delivery_requires_reconciliation';
  END IF;

  new_interaction_id := gen_random_uuid();
  INSERT INTO public.ma_interactions (
    id, office_id, affiliation_id, opportunity_id, channel, direction, occurred_at,
    owner_staff_user_id, owner_verification_state, owner_verified_by,
    owner_verified_at, title, template_key, recipient_email_snapshot,
    body_markdown, delivery_status, provider_idempotency_key, created_by
  ) VALUES (
    new_interaction_id, p_office_id, p_affiliation_id, opportunity_row.id, 'email', 'outbound', NOW(),
    normalized_actor, 'verified', normalized_actor, NOW(), BTRIM(p_title), BTRIM(p_template_key),
    BTRIM(p_recipient_email), p_body_markdown, 'pending', new_interaction_id::TEXT, normalized_actor
  ) RETURNING * INTO interaction_row;

  INSERT INTO public.ma_interaction_delivery_events (
    interaction_id, event_kind, actor, provider_idempotency_key
  ) VALUES (
    interaction_row.id, 'pending', normalized_actor, interaction_row.provider_idempotency_key
  );

  RETURN QUERY SELECT interaction_row.id, interaction_row.id::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_ma_interaction_email_send(
  p_interaction_id UUID,
  p_actor TEXT,
  p_delivery_status TEXT,
  p_provider_message_id TEXT DEFAULT NULL,
  p_delivery_error TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_actor TEXT;
  interaction_row public.ma_interactions%ROWTYPE;
  staff_count INTEGER;
BEGIN
  normalized_actor := NULLIF(BTRIM(p_actor), '');
  IF normalized_actor IS NULL OR p_delivery_status NOT IN ('sent', 'failed') THEN
    RAISE EXCEPTION 'ma_interaction_email_finalize_requires_valid_input';
  END IF;

  SELECT COUNT(*) INTO staff_count
  FROM public.app_user_roles role
  WHERE role.role = 'staff' AND role.user_id = normalized_actor;
  IF staff_count <> 1 THEN
    RAISE EXCEPTION 'ma_interaction_email_finalize_requires_exact_staff_actor';
  END IF;

  SELECT * INTO interaction_row
  FROM public.ma_interactions interaction
  WHERE interaction.id = p_interaction_id
  FOR UPDATE;
  IF interaction_row.id IS NULL
    OR interaction_row.owner_staff_user_id IS DISTINCT FROM normalized_actor
    OR interaction_row.created_by IS DISTINCT FROM normalized_actor
    OR interaction_row.delivery_status <> 'pending' THEN
    RAISE EXCEPTION 'ma_interaction_email_finalize_requires_owned_pending_interaction';
  END IF;
  IF p_delivery_status = 'sent' AND NULLIF(BTRIM(p_provider_message_id), '') IS NULL THEN
    RAISE EXCEPTION 'ma_interaction_email_finalize_requires_provider_message_id';
  END IF;
  IF p_delivery_status = 'failed' AND NULLIF(BTRIM(p_delivery_error), '') IS NULL THEN
    RAISE EXCEPTION 'ma_interaction_email_finalize_requires_delivery_error';
  END IF;

  PERFORM set_config('app.ma_interaction_delivery_finalization', 'true', true);
  UPDATE public.ma_interactions
  SET delivery_status = p_delivery_status,
      provider_message_id = NULLIF(BTRIM(p_provider_message_id), ''),
      delivery_error = CASE WHEN p_delivery_status = 'failed' THEN BTRIM(p_delivery_error) ELSE NULL END,
      sent_at = CASE WHEN p_delivery_status = 'sent' THEN NOW() ELSE NULL END,
      delivery_finalized_at = NOW()
  WHERE id = interaction_row.id;

  INSERT INTO public.ma_interaction_delivery_events (
    interaction_id, event_kind, actor, provider_idempotency_key,
    provider_message_id, delivery_error
  ) VALUES (
    interaction_row.id, p_delivery_status, normalized_actor, interaction_row.provider_idempotency_key,
    NULLIF(BTRIM(p_provider_message_id), ''),
    CASE WHEN p_delivery_status = 'failed' THEN BTRIM(p_delivery_error) ELSE NULL END
  );

  RETURN TRUE;
END;
$$;

-- The production preflight established exactly four historical rows. Recheck
-- the complete shape inside this transaction, derive every canonical relation
-- from current canonical evidence, and fail before any target write if reality
-- has changed. No message or manifest stores an email body in plain text.
LOCK TABLE public.ma_source_interactions IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  legacy_count INTEGER;
  legacy_distinct_count INTEGER;
  invalid_count INTEGER;
  bertrand_owner TEXT;
  bertrand_count INTEGER;
BEGIN
  SELECT COUNT(*), COUNT(DISTINCT interaction.id)
  INTO legacy_count, legacy_distinct_count
  FROM public.ma_source_interactions interaction;

  IF legacy_count <> 4 OR legacy_distinct_count <> 4 THEN
    RAISE EXCEPTION 'ma_interaction_legacy_manifest_requires_exactly_four_distinct_rows';
  END IF;

  SELECT COUNT(*) INTO bertrand_count
  FROM public.app_user_roles role
  WHERE role.role = 'staff'
    AND NULLIF(BTRIM(role.user_id), '') IS NOT NULL
    AND LOWER(BTRIM(role.email)) = 'bertrand.galas@edu.escp.eu';

  IF bertrand_count <> 1 THEN
    RAISE EXCEPTION 'ma_interaction_legacy_manifest_requires_one_bertrand_staff_owner';
  END IF;

  SELECT role.user_id INTO bertrand_owner
  FROM public.app_user_roles role
  WHERE role.role = 'staff'
    AND NULLIF(BTRIM(role.user_id), '') IS NOT NULL
    AND LOWER(BTRIM(role.email)) = 'bertrand.galas@edu.escp.eu';

  SELECT COUNT(*) INTO invalid_count
  FROM public.ma_source_interactions interaction
  LEFT JOIN public.ma_sources source ON source.id = interaction.source_id
  LEFT JOIN public.ma_source_contacts legacy_contact ON legacy_contact.id = interaction.contact_id
  LEFT JOIN public.ma_contacts contact
    ON contact.legacy_source_contact_id = interaction.contact_id
  LEFT JOIN public.ma_contact_office_affiliations affiliation
    ON affiliation.legacy_source_contact_id = interaction.contact_id
    AND affiliation.legacy_source_id = source.id
    AND affiliation.contact_id = contact.id
    AND affiliation.office_id = source.default_office_id
  LEFT JOIN public.opportunities opportunity ON opportunity.id = interaction.opportunity_id
  WHERE interaction.source_id IS NULL
    OR interaction.contact_id IS NULL
    OR NULLIF(BTRIM(interaction.recipient_email), '') IS NULL
    OR NULLIF(BTRIM(interaction.subject), '') IS NULL
    OR NULLIF(BTRIM(interaction.body_markdown), '') IS NULL
    OR interaction.channel IS DISTINCT FROM 'email'
    OR interaction.direction IS DISTINCT FROM 'outbound'
    OR interaction.status IS DISTINCT FROM 'sent'
    OR interaction.sent_at IS NULL
    OR interaction.created_by IS NOT NULL
    OR source.id IS NULL
    OR source.default_office_id IS NULL
    OR legacy_contact.id IS NULL
    OR legacy_contact.source_id IS DISTINCT FROM source.id
    OR contact.id IS NULL
    OR affiliation.id IS NULL
    OR 1 <> (
      SELECT COUNT(*)
      FROM public.ma_contact_office_affiliations bridge
      WHERE bridge.legacy_source_contact_id = interaction.contact_id
        AND bridge.legacy_source_id = source.id
        AND bridge.contact_id = contact.id
        AND bridge.office_id = source.default_office_id
    )
    OR opportunity.id IS NULL
    OR opportunity.source_id IS DISTINCT FROM source.id
    OR opportunity.source_office_id IS DISTINCT FROM source.default_office_id;

  IF invalid_count <> 0 THEN
    RAISE EXCEPTION 'ma_interaction_legacy_manifest_does_not_match_verified_production_shape';
  END IF;
END;
$$;

WITH legacy_rows AS (
  SELECT
    interaction.id,
    interaction.source_id AS legacy_source_id,
    interaction.contact_id AS legacy_contact_id,
    source.default_office_id AS office_id,
    affiliation.id AS affiliation_id,
    interaction.opportunity_id,
    interaction.channel,
    interaction.direction,
    interaction.sent_at AS occurred_at,
    owner_role.user_id AS owner_staff_user_id,
    interaction.subject AS title,
    interaction.template_key,
    interaction.recipient_email AS recipient_email_snapshot,
    interaction.body_markdown,
    interaction.status AS delivery_status,
    interaction.error_message AS delivery_error,
    interaction.sent_at,
    interaction.created_by::TEXT AS created_by,
    interaction.created_at,
    encode(extensions.digest(jsonb_build_object(
      'id', interaction.id,
      'source_id', interaction.source_id,
      'office_id', source.default_office_id,
      'contact_id', interaction.contact_id,
      'affiliation_id', affiliation.id,
      'opportunity_id', interaction.opportunity_id,
      'channel', interaction.channel,
      'direction', interaction.direction,
      'recipient_email', interaction.recipient_email,
      'subject', interaction.subject,
      'body_sha256', encode(extensions.digest(interaction.body_markdown, 'sha256'), 'hex'),
      'template_key', interaction.template_key,
      'status', interaction.status,
      'error_message', interaction.error_message,
      'sent_at', interaction.sent_at,
      'created_by', interaction.created_by,
      'created_at', interaction.created_at
    )::TEXT, 'sha256'), 'hex') AS legacy_evidence_digest
  FROM public.ma_source_interactions interaction
  JOIN public.ma_sources source ON source.id = interaction.source_id
  JOIN public.ma_contacts contact ON contact.legacy_source_contact_id = interaction.contact_id
  JOIN public.ma_contact_office_affiliations affiliation
    ON affiliation.legacy_source_contact_id = interaction.contact_id
    AND affiliation.legacy_source_id = source.id
    AND affiliation.contact_id = contact.id
    AND affiliation.office_id = source.default_office_id
  JOIN public.app_user_roles owner_role
    ON owner_role.role = 'staff'
    AND LOWER(BTRIM(owner_role.email)) = 'bertrand.galas@edu.escp.eu'
)
INSERT INTO public.ma_interactions (
    id, office_id, affiliation_id, opportunity_id, channel, direction,
    occurred_at, owner_staff_user_id, owner_verification_state, title,
    template_key, recipient_email_snapshot, body_markdown, delivery_status,
    delivery_error, provider_idempotency_key, sent_at, delivery_finalized_at,
    created_by, created_at
)
SELECT
  id, office_id, affiliation_id, opportunity_id, channel, direction,
    occurred_at, owner_staff_user_id, 'provisional', title,
    template_key, recipient_email_snapshot, body_markdown, delivery_status,
    delivery_error, 'legacy:' || id::TEXT, sent_at, sent_at, created_by, created_at
FROM legacy_rows
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ma_interaction_legacy_migration_manifest (
  legacy_interaction_id, legacy_evidence_digest, canonical_evidence_digest
)
SELECT
  interaction.id,
  encode(extensions.digest(jsonb_build_object(
    'id', interaction.id,
    'source_id', interaction.source_id,
    'office_id', source.default_office_id,
    'contact_id', interaction.contact_id,
    'affiliation_id', affiliation.id,
    'opportunity_id', interaction.opportunity_id,
    'channel', interaction.channel,
    'direction', interaction.direction,
    'recipient_email', interaction.recipient_email,
    'subject', interaction.subject,
    'body_sha256', encode(extensions.digest(interaction.body_markdown, 'sha256'), 'hex'),
    'template_key', interaction.template_key,
    'status', interaction.status,
    'error_message', interaction.error_message,
    'sent_at', interaction.sent_at,
    'created_by', interaction.created_by,
    'created_at', interaction.created_at
  )::TEXT, 'sha256'), 'hex'),
  encode(extensions.digest(jsonb_build_object(
    'id', canonical.id,
    'source_id', interaction.source_id,
    'office_id', canonical.office_id,
    'contact_id', interaction.contact_id,
    'affiliation_id', canonical.affiliation_id,
    'opportunity_id', canonical.opportunity_id,
    'channel', canonical.channel,
    'direction', canonical.direction,
    'recipient_email', canonical.recipient_email_snapshot,
    'subject', canonical.title,
    'body_sha256', encode(extensions.digest(canonical.body_markdown, 'sha256'), 'hex'),
    'template_key', canonical.template_key,
    'status', canonical.delivery_status,
    'error_message', canonical.delivery_error,
    'sent_at', canonical.sent_at,
    'created_by', canonical.created_by,
    'created_at', canonical.created_at
  )::TEXT, 'sha256'), 'hex')
FROM public.ma_source_interactions interaction
JOIN public.ma_sources source ON source.id = interaction.source_id
JOIN public.ma_contacts contact ON contact.legacy_source_contact_id = interaction.contact_id
JOIN public.ma_contact_office_affiliations affiliation
  ON affiliation.legacy_source_contact_id = interaction.contact_id
  AND affiliation.legacy_source_id = source.id
  AND affiliation.contact_id = contact.id
  AND affiliation.office_id = source.default_office_id
JOIN public.ma_interactions canonical ON canonical.id = interaction.id
ON CONFLICT (legacy_interaction_id) DO UPDATE
SET legacy_evidence_digest = EXCLUDED.legacy_evidence_digest,
    canonical_evidence_digest = EXCLUDED.canonical_evidence_digest;

DO $$
DECLARE
  manifest_count INTEGER;
  digest_mismatch_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO manifest_count
  FROM public.ma_interaction_legacy_migration_manifest;
  IF manifest_count <> 4 THEN
    RAISE EXCEPTION 'ma_interaction_legacy_manifest_requires_four_rows';
  END IF;

  SELECT COUNT(*) INTO digest_mismatch_count
  FROM public.ma_interaction_legacy_migration_manifest manifest
  WHERE manifest.legacy_evidence_digest <> manifest.canonical_evidence_digest;
  IF digest_mismatch_count <> 0 THEN
    RAISE EXCEPTION 'ma_interaction_legacy_manifest_evidence_mismatch';
  END IF;
END;
$$;

ALTER TABLE public.ma_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ma_interaction_owner_verification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ma_interaction_delivery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ma_interaction_legacy_migration_manifest ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ma_source_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view ma source interactions" ON public.ma_source_interactions;
DROP POLICY IF EXISTS "Authenticated users can insert ma source interactions" ON public.ma_source_interactions;

REVOKE ALL ON TABLE
  public.ma_interactions,
  public.ma_interaction_owner_verification_events,
  public.ma_interaction_delivery_events,
  public.ma_interaction_legacy_migration_manifest,
  public.ma_source_interactions
FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.ma_interactions TO service_role;
GRANT SELECT ON TABLE
  public.ma_interaction_owner_verification_events,
  public.ma_interaction_delivery_events,
  public.ma_interaction_legacy_migration_manifest,
  public.ma_source_interactions
TO service_role;

REVOKE ALL ON FUNCTION public.enforce_ma_interaction_office_context() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_ma_interaction_mutation() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.prevent_ma_interaction_owner_verification_event_mutation() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.prevent_ma_interaction_delivery_event_mutation() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_ma_interaction_opportunity_source_office() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.verify_ma_interaction_owner(UUID, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.begin_ma_interaction_email_send(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.finalize_ma_interaction_email_send(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_ma_interaction_owner(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.begin_ma_interaction_email_send(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_ma_interaction_email_send(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;

COMMENT ON TABLE public.ma_interactions IS
  'Staff-only canonical office-anchored M&A relationship history. Email delivery and owner verification use narrow audited service functions; direct table mutation is denied.';
COMMENT ON TABLE public.ma_interaction_owner_verification_events IS
  'Append-only staff-owner verification evidence for canonical M&A interactions.';
COMMENT ON TABLE public.ma_interaction_delivery_events IS
  'Append-only pending/sent/failed provider delivery evidence for canonical M&A emails.';
COMMENT ON TABLE public.ma_interaction_legacy_migration_manifest IS
  'Four-row SHA-256 before/after evidence manifest for the W-062 legacy interaction cutover; bodies are never copied into this manifest.';
COMMENT ON TABLE public.ma_source_interactions IS
  'Read-only legacy M&A email interaction evidence after W-062. Canonical writes use ma_interactions only.';

COMMIT;
