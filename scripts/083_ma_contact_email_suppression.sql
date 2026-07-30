-- W-072: purpose-aware M&A contact campaign email suppression.
--
-- Suppression belongs to the canonical person, not an affiliation or an
-- email address. The only suppressed-contact exception at launch is an NDA
-- request for an opportunity to which that person is actively linked.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'ma_contact_email_purpose'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.ma_contact_email_purpose AS ENUM (
      'campaign',
      'general_relationship',
      'opportunity_general',
      'opportunity_nda_request'
    );
  END IF;
END
$$;

ALTER TABLE public.ma_contacts
  ADD COLUMN IF NOT EXISTS campaign_email_suppressed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS campaign_email_suppression_reason TEXT;

CREATE TABLE IF NOT EXISTS public.ma_contact_email_policy_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL
    REFERENCES public.ma_contacts(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL
    CHECK (
      event_type IN (
        'suppression_enabled',
        'suppression_removed',
        'allowlisted_operational_send'
      )
    ),
  previous_suppressed BOOLEAN,
  resulting_suppressed BOOLEAN,
  purpose public.ma_contact_email_purpose,
  opportunity_id UUID
    REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  actor TEXT NOT NULL CHECK (NULLIF(BTRIM(actor), '') IS NOT NULL),
  reason TEXT NOT NULL CHECK (NULLIF(BTRIM(reason), '') IS NOT NULL),
  operation_key UUID,
  source_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (
      event_type IN ('suppression_enabled', 'suppression_removed')
      AND previous_suppressed IS NOT NULL
      AND resulting_suppressed IS NOT NULL
      AND previous_suppressed IS DISTINCT FROM resulting_suppressed
      AND purpose IS NULL
      AND opportunity_id IS NULL
      AND operation_key IS NULL
    )
    OR
    (
      event_type = 'allowlisted_operational_send'
      AND previous_suppressed IS NULL
      AND resulting_suppressed IS NULL
      AND purpose = 'opportunity_nda_request'
      AND opportunity_id IS NOT NULL
      AND operation_key IS NOT NULL
      AND source_key IS NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_ma_contact_email_policy_events_contact
  ON public.ma_contact_email_policy_events (contact_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ma_contact_email_policy_events_opportunity
  ON public.ma_contact_email_policy_events (opportunity_id, created_at DESC)
  WHERE opportunity_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ma_contact_email_policy_events_source
  ON public.ma_contact_email_policy_events (contact_id, source_key)
  WHERE source_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ma_contact_email_policy_events_exception
  ON public.ma_contact_email_policy_events (
    contact_id,
    opportunity_id,
    purpose,
    operation_key
  )
  WHERE event_type = 'allowlisted_operational_send';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ma_contacts_campaign_email_suppression_reason_check'
      AND conrelid = 'public.ma_contacts'::regclass
  ) THEN
    ALTER TABLE public.ma_contacts
      ADD CONSTRAINT ma_contacts_campaign_email_suppression_reason_check
      CHECK (
        (
          campaign_email_suppressed
          AND NULLIF(BTRIM(campaign_email_suppression_reason), '') IS NOT NULL
        )
        OR
        (
          NOT campaign_email_suppressed
          AND campaign_email_suppression_reason IS NULL
        )
      );
  END IF;
END
$$;

DO $$
DECLARE
  flagged_count INTEGER;
  distinct_flagged_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER, COUNT(DISTINCT id)::INTEGER
  INTO flagged_count, distinct_flagged_count
  FROM public.ma_contacts
  WHERE created_by = 'Ivan Paudice via Codex W-010'
    AND internal_notes LIKE
      'Email suppressed in the W-010 source snapshot;%';

  IF flagged_count <> 18 OR distinct_flagged_count <> 18 THEN
    RAISE EXCEPTION
      'w072_expected_exactly_18_w010_suppressed_contacts';
  END IF;
END
$$;

WITH pending_backfill AS (
  SELECT contact.id
  FROM public.ma_contacts contact
  WHERE contact.created_by = 'Ivan Paudice via Codex W-010'
    AND contact.internal_notes LIKE
      'Email suppressed in the W-010 source snapshot;%'
    AND NOT EXISTS (
      SELECT 1
      FROM public.ma_contact_email_policy_events event
      WHERE event.contact_id = contact.id
        AND event.source_key = 'w010_import_backfill'
    )
),
updated_contacts AS (
  UPDATE public.ma_contacts contact
  SET
    campaign_email_suppressed = TRUE,
    campaign_email_suppression_reason =
      'Imported do-not-email marker from the W-010 source snapshot.',
    updated_by = 'Ivan Paudice via Codex W-072',
    updated_at = NOW()
  FROM pending_backfill pending
  WHERE contact.id = pending.id
  RETURNING contact.id
)
INSERT INTO public.ma_contact_email_policy_events (
  contact_id,
  event_type,
  previous_suppressed,
  resulting_suppressed,
  actor,
  reason,
  source_key
)
SELECT
  contact.id,
  'suppression_enabled',
  FALSE,
  TRUE,
  'Ivan Paudice via Codex W-072',
  'Structured backfill of the retained W-010 do-not-email marker.',
  'w010_import_backfill'
FROM updated_contacts contact;

-- Production has a deferred contact-integrity constraint trigger. Flush the
-- backfill's queued checks before installing the contact policy trigger;
-- PostgreSQL otherwise rejects later DDL on ma_contacts in this transaction.
SET CONSTRAINTS ALL IMMEDIATE;

CREATE OR REPLACE FUNCTION public.prevent_ma_contact_email_policy_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'ma_contact_email_policy_events_are_immutable';
END
$$;

DROP TRIGGER IF EXISTS prevent_ma_contact_email_policy_event_mutation
  ON public.ma_contact_email_policy_events;
CREATE TRIGGER prevent_ma_contact_email_policy_event_mutation
  BEFORE UPDATE OR DELETE ON public.ma_contact_email_policy_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_ma_contact_email_policy_event_mutation();

CREATE OR REPLACE FUNCTION public.guard_ma_contact_campaign_email_suppression()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (
    OLD.campaign_email_suppressed
      IS DISTINCT FROM NEW.campaign_email_suppressed
    OR OLD.campaign_email_suppression_reason
      IS DISTINCT FROM NEW.campaign_email_suppression_reason
  )
  AND current_setting(
    'app.ma_contact_campaign_email_suppression_change',
    TRUE
  ) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION
      'ma_contact_campaign_email_suppression_requires_service';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS guard_ma_contact_campaign_email_suppression
  ON public.ma_contacts;
CREATE TRIGGER guard_ma_contact_campaign_email_suppression
  BEFORE UPDATE OF
    campaign_email_suppressed,
    campaign_email_suppression_reason
  ON public.ma_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_ma_contact_campaign_email_suppression();

CREATE OR REPLACE FUNCTION public.ma_contact_email_is_allowed(
  p_contact_id UUID,
  p_opportunity_id UUID,
  p_purpose public.ma_contact_email_purpose
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  contact_row public.ma_contacts%ROWTYPE;
  has_active_link BOOLEAN := FALSE;
BEGIN
  SELECT *
  INTO contact_row
  FROM public.ma_contacts
  WHERE id = p_contact_id;

  IF NOT FOUND OR contact_row.status <> 'active' THEN
    RETURN FALSE;
  END IF;

  IF p_purpose IN (
    'opportunity_general'::public.ma_contact_email_purpose,
    'opportunity_nda_request'::public.ma_contact_email_purpose
  ) THEN
    IF p_opportunity_id IS NULL THEN
      RETURN FALSE;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.opportunity_ma_contacts link
      JOIN public.ma_contact_office_affiliations affiliation
        ON affiliation.id = link.affiliation_id
      WHERE link.opportunity_id = p_opportunity_id
        AND affiliation.contact_id = p_contact_id
        AND link.is_active
        AND link.removed_at IS NULL
        AND affiliation.is_active
        AND affiliation.ended_at IS NULL
    )
    INTO has_active_link;

    IF NOT has_active_link THEN
      RETURN FALSE;
    END IF;
  ELSIF p_opportunity_id IS NOT NULL THEN
    RETURN FALSE;
  END IF;

  IF NOT contact_row.campaign_email_suppressed THEN
    RETURN TRUE;
  END IF;

  RETURN p_purpose =
    'opportunity_nda_request'::public.ma_contact_email_purpose;
END
$$;

CREATE OR REPLACE FUNCTION public.ma_contact_email_address_is_suppressed(
  p_email TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    NULLIF(BTRIM(p_email), '') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.ma_contacts contact
      WHERE contact.campaign_email_suppressed
        AND LOWER(BTRIM(contact.email)) = LOWER(BTRIM(p_email))
    );
$$;

CREATE OR REPLACE FUNCTION public.authorize_ma_contact_email_send(
  p_contact_id UUID,
  p_opportunity_id UUID,
  p_purpose public.ma_contact_email_purpose,
  p_actor TEXT,
  p_operation_key UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  contact_row public.ma_contacts%ROWTYPE;
  allowed BOOLEAN;
BEGIN
  IF NULLIF(BTRIM(p_actor), '') IS NULL OR p_operation_key IS NULL THEN
    RAISE EXCEPTION 'ma_contact_email_authorization_requires_actor_and_operation';
  END IF;

  SELECT *
  INTO contact_row
  FROM public.ma_contacts
  WHERE id = p_contact_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ma_contact_email_authorization_contact_not_found';
  END IF;

  allowed := public.ma_contact_email_is_allowed(
    p_contact_id,
    p_opportunity_id,
    p_purpose
  );

  IF NOT allowed THEN
    IF contact_row.campaign_email_suppressed THEN
      RAISE EXCEPTION 'ma_contact_campaign_email_suppressed';
    END IF;
    RAISE EXCEPTION 'ma_contact_email_purpose_or_link_not_authorized';
  END IF;

  IF contact_row.campaign_email_suppressed THEN
    INSERT INTO public.ma_contact_email_policy_events (
      contact_id,
      event_type,
      purpose,
      opportunity_id,
      actor,
      reason,
      operation_key
    )
    VALUES (
      p_contact_id,
      'allowlisted_operational_send',
      p_purpose,
      p_opportunity_id,
      BTRIM(p_actor),
      'Allowlisted NDA request for an actively linked opportunity contact.',
      p_operation_key
    )
    ON CONFLICT (
      contact_id,
      opportunity_id,
      purpose,
      operation_key
    )
    WHERE event_type = 'allowlisted_operational_send'
    DO NOTHING;
  END IF;

  RETURN TRUE;
END
$$;

CREATE OR REPLACE FUNCTION public.set_ma_contact_campaign_email_suppression(
  p_contact_id UUID,
  p_suppressed BOOLEAN,
  p_reason TEXT,
  p_actor TEXT
)
RETURNS TABLE (
  contact_id UUID,
  campaign_email_suppressed BOOLEAN,
  campaign_email_suppression_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  contact_row public.ma_contacts%ROWTYPE;
  clean_reason TEXT := NULLIF(BTRIM(p_reason), '');
  clean_actor TEXT := NULLIF(BTRIM(p_actor), '');
BEGIN
  IF p_suppressed IS NULL
    OR clean_reason IS NULL
    OR CHAR_LENGTH(clean_reason) < 5
    OR CHAR_LENGTH(clean_reason) > 500
    OR clean_actor IS NULL THEN
    RAISE EXCEPTION
      'ma_contact_campaign_email_suppression_requires_state_actor_and_reason';
  END IF;

  SELECT *
  INTO contact_row
  FROM public.ma_contacts
  WHERE id = p_contact_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ma_contact_campaign_email_suppression_contact_not_found';
  END IF;

  IF contact_row.campaign_email_suppressed = p_suppressed THEN
    RAISE EXCEPTION 'ma_contact_campaign_email_suppression_state_unchanged';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ma_source_email_send_reservations reservation
    JOIN public.opportunity_ma_contacts link
      ON link.opportunity_id = reservation.opportunity_id
    JOIN public.ma_contact_office_affiliations affiliation
      ON affiliation.id = link.affiliation_id
    WHERE affiliation.contact_id = p_contact_id
      AND link.is_active
      AND link.removed_at IS NULL
      AND reservation.expires_at > NOW()
  ) THEN
    RAISE EXCEPTION
      'ma_contact_campaign_email_suppression_change_blocked_during_send';
  END IF;

  PERFORM set_config(
    'app.ma_contact_campaign_email_suppression_change',
    'true',
    TRUE
  );

  UPDATE public.ma_contacts contact
  SET
    campaign_email_suppressed = p_suppressed,
    campaign_email_suppression_reason = CASE
      WHEN p_suppressed THEN clean_reason
      ELSE NULL
    END,
    updated_by = clean_actor,
    updated_at = NOW()
  WHERE contact.id = p_contact_id;

  INSERT INTO public.ma_contact_email_policy_events (
    contact_id,
    event_type,
    previous_suppressed,
    resulting_suppressed,
    actor,
    reason
  )
  VALUES (
    p_contact_id,
    CASE
      WHEN p_suppressed THEN 'suppression_enabled'
      ELSE 'suppression_removed'
    END,
    contact_row.campaign_email_suppressed,
    p_suppressed,
    clean_actor,
    clean_reason
  );

  RETURN QUERY
  SELECT
    contact.id,
    contact.campaign_email_suppressed,
    contact.campaign_email_suppression_reason
  FROM public.ma_contacts contact
  WHERE contact.id = p_contact_id;
END
$$;

ALTER TABLE public.ma_contact_email_policy_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ma_contact_email_policy_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TYPE public.ma_contact_email_purpose
  FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON TYPE public.ma_contact_email_purpose TO service_role;

REVOKE ALL ON TABLE public.ma_contact_email_policy_events
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.ma_contact_email_policy_events TO service_role;

REVOKE ALL ON FUNCTION
  public.prevent_ma_contact_email_policy_event_mutation()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION
  public.guard_ma_contact_campaign_email_suppression()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION
  public.ma_contact_email_is_allowed(
    UUID,
    UUID,
    public.ma_contact_email_purpose
  )
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION
  public.ma_contact_email_address_is_suppressed(TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION
  public.authorize_ma_contact_email_send(
    UUID,
    UUID,
    public.ma_contact_email_purpose,
    TEXT,
    UUID
  )
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION
  public.set_ma_contact_campaign_email_suppression(
    UUID,
    BOOLEAN,
    TEXT,
    TEXT
  )
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION
  public.ma_contact_email_is_allowed(
    UUID,
    UUID,
    public.ma_contact_email_purpose
  )
  TO service_role;
GRANT EXECUTE ON FUNCTION
  public.ma_contact_email_address_is_suppressed(TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION
  public.authorize_ma_contact_email_send(
    UUID,
    UUID,
    public.ma_contact_email_purpose,
    TEXT,
    UUID
  )
  TO service_role;
GRANT EXECUTE ON FUNCTION
  public.set_ma_contact_campaign_email_suppression(
    UUID,
    BOOLEAN,
    TEXT,
    TEXT
  )
  TO service_role;

COMMENT ON COLUMN public.ma_contacts.campaign_email_suppressed IS
  'Person-level W-072 campaign/general-outreach suppression across affiliations.';
COMMENT ON COLUMN public.ma_contacts.campaign_email_suppression_reason IS
  'Current reason while campaign email suppression is enabled.';
COMMENT ON TABLE public.ma_contact_email_policy_events IS
  'Immutable W-072 suppression changes and allowlisted operational-send evidence.';
COMMENT ON FUNCTION public.ma_contact_email_is_allowed(
  UUID,
  UUID,
  public.ma_contact_email_purpose
) IS
  'Audience-construction policy for canonical M&A contacts; service role only.';
COMMENT ON FUNCTION public.ma_contact_email_address_is_suppressed(TEXT) IS
  'Fail-closed direct-address check for generic/manual email paths; service role only.';
COMMENT ON FUNCTION public.authorize_ma_contact_email_send(
  UUID,
  UUID,
  public.ma_contact_email_purpose,
  TEXT,
  UUID
) IS
  'Final W-072 send authorization and idempotent exception audit; service role only.';

COMMIT;
