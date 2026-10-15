-- A provider may retry a signed business callback after its final operational
-- parent has been intentionally deleted. Keep only an irreversible marker so
-- that callback is acknowledged without retaining an orphan event or masking
-- genuinely missing receipts.
BEGIN;

CREATE TABLE public.email_provider_deleted_source_markers (
  provider_message_hash text PRIMARY KEY
    CHECK (provider_message_hash ~ '^[0-9a-f]{64}$')
);
ALTER TABLE public.email_provider_deleted_source_markers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_provider_deleted_source_markers
  FROM PUBLIC, anon, authenticated, service_role;

-- Three provider receipts from the authorised 15 October owned-QA cleanup
-- were already deleted before this marker existed. These irreversible hashes
-- are the only historical exception; no lookup, backfill, or provider replay
-- is performed.
INSERT INTO public.email_provider_deleted_source_markers(provider_message_hash)
VALUES
  ('d939d7747b460d9e3c414e666a6d2a5d6f4739807d24c6e7d7589061e06d6781'),
  ('b5feb5f3e5d0df3800dad99a9d7905d86a0fdf0422ce3394f708a4f8d082328a'),
  ('942ad06063911e912cffe7f13159b8a99f60f20ba1378ff6971954dd4f701563')
ON CONFLICT (provider_message_hash) DO NOTHING;

-- A callback can update email_logs, while deleting a final source can remove
-- that same row. Callbacks share one transaction-scoped lock; source deletion
-- takes it exclusively before a DELETE statement can take row locks. This
-- avoids a row-lock/advisory-lock inversion without serializing callbacks.
CREATE FUNCTION public.email_provider_retention_callback_lock()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock_shared(20261015, 1300);
END;
$$;
REVOKE ALL ON FUNCTION public.email_provider_retention_callback_lock()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.email_provider_source_delete_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(20261015, 1300);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.email_provider_source_delete_lock()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER email_provider_source_delete_lock
BEFORE DELETE ON public.email_logs
FOR EACH STATEMENT EXECUTE FUNCTION public.email_provider_source_delete_lock();
CREATE TRIGGER email_provider_source_delete_lock
BEFORE DELETE ON public.staff_email_reviews
FOR EACH STATEMENT EXECUTE FUNCTION public.email_provider_source_delete_lock();
CREATE TRIGGER email_provider_source_delete_lock
BEFORE DELETE ON public.ma_interactions
FOR EACH STATEMENT EXECUTE FUNCTION public.email_provider_source_delete_lock();
CREATE TRIGGER email_provider_source_delete_lock
BEFORE DELETE ON public.opportunity_pursuit_handoff_deliveries
FOR EACH STATEMENT EXECUTE FUNCTION public.email_provider_source_delete_lock();

CREATE FUNCTION public.email_provider_was_deleted(p_provider_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_provider_id text := nullif(btrim(p_provider_id), '');
BEGIN
  IF v_provider_id IS NULL THEN
    RETURN false;
  END IF;

  -- A retained parent is always authoritative, even if an older deletion
  -- marker exists for a provider ID reused in a repair or fixture.
  IF EXISTS (
    SELECT 1 FROM public.email_operations_history WHERE provider_message_id = v_provider_id
  ) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.email_provider_deleted_source_markers
    WHERE provider_message_hash = encode(extensions.digest(v_provider_id, 'sha256'), 'hex')
  );
END;
$$;
REVOKE ALL ON FUNCTION public.email_provider_was_deleted(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_provider_was_deleted(text) TO service_role;

CREATE OR REPLACE FUNCTION public.email_provider_record_event(
  p_id text,
  p_provider_id text,
  p_type text,
  p_occurred_at timestamptz,
  p_recipient_kind text,
  p_reason text,
  p_recipient text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inserted integer;
  v_provider_id text := nullif(btrim(p_provider_id), '');
BEGIN
  IF nullif(btrim(p_id), '') IS NULL OR v_provider_id IS NULL
    OR p_type NOT IN (
      'email.sent', 'email.delivered', 'email.opened', 'email.clicked',
      'email.bounced', 'email.complained', 'email.delivery_delayed',
      'email.failed', 'email.suppressed'
    )
    OR p_recipient_kind NOT IN ('primary', 'copy', 'unknown')
  THEN
    RAISE EXCEPTION 'email_provider_invalid';
  END IF;

  PERFORM public.email_provider_retention_callback_lock();

  IF NOT EXISTS (
    SELECT 1 FROM public.email_operations_history WHERE provider_message_id = v_provider_id
  ) THEN
    IF public.email_provider_was_deleted(v_provider_id) THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'email_provider_parent_not_yet_retained';
  END IF;

  INSERT INTO public.email_provider_events(
    id, provider_message_id, event_type, occurred_at, recipient_kind, reason, recipient_email
  ) VALUES (
    p_id, v_provider_id, p_type, p_occurred_at, p_recipient_kind,
    left(p_reason, 500), lower(btrim(p_recipient))
  ) ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 OR p_recipient_kind <> 'primary' THEN
    RETURN;
  END IF;

  UPDATE public.email_logs SET
    delivered_at = CASE WHEN p_type = 'email.delivered' THEN least(delivered_at, p_occurred_at) ELSE delivered_at END,
    opened_at = CASE WHEN p_type = 'email.opened' THEN least(opened_at, p_occurred_at) ELSE opened_at END,
    clicked_at = CASE WHEN p_type = 'email.clicked' THEN least(clicked_at, p_occurred_at) ELSE clicked_at END,
    bounced_at = CASE WHEN p_type = 'email.bounced' THEN least(bounced_at, p_occurred_at) ELSE bounced_at END,
    complained_at = CASE WHEN p_type = 'email.complained' THEN least(complained_at, p_occurred_at) ELSE complained_at END,
    delayed_at = CASE WHEN p_type = 'email.delivery_delayed' THEN least(delayed_at, p_occurred_at) ELSE delayed_at END,
    suppressed_at = CASE WHEN p_type = 'email.suppressed' THEN least(suppressed_at, p_occurred_at) ELSE suppressed_at END,
    status = CASE
      WHEN status IN ('bounced', 'complained') THEN status
      WHEN p_type = 'email.complained' THEN 'complained'
      WHEN p_type = 'email.bounced' THEN 'bounced'
      WHEN p_type = 'email.clicked' THEN 'clicked'
      WHEN p_type = 'email.opened' AND status <> 'clicked' THEN 'opened'
      WHEN p_type = 'email.delivered' AND status NOT IN ('clicked', 'opened') THEN 'delivered'
      WHEN p_type = 'email.sent' AND status IN ('pending', 'failed') THEN 'sent'
      ELSE status
    END
  WHERE resend_id = v_provider_id;
END;
$$;
REVOKE ALL ON FUNCTION public.email_provider_record_event(text, text, text, timestamptz, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_provider_record_event(text, text, text, timestamptz, text, text, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.email_provider_source_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_provider_id text;
BEGIN
  v_provider_id := nullif(btrim(
    CASE WHEN TG_TABLE_NAME = 'email_logs'
      THEN to_jsonb(OLD)->>'resend_id'
      ELSE to_jsonb(OLD)->>'provider_message_id'
    END
  ), '');

  IF v_provider_id IS NULL THEN
    RETURN OLD;
  END IF;

  -- Only normalized outbound M&A email rows participate in the history
  -- projection. A non-email/non-outbound/incomplete M&A row must never turn
  -- into a deleted receipt marker, though any already-orphaned event facts
  -- still follow the existing cleanup boundary.
  IF TG_TABLE_NAME = 'ma_interactions'
    AND (
      (to_jsonb(OLD)->>'channel') IS DISTINCT FROM 'email'
      OR (to_jsonb(OLD)->>'direction') IS DISTINCT FROM 'outbound'
      OR (to_jsonb(OLD)->>'delivery_status') IS NULL
    )
  THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.email_operations_history WHERE provider_message_id = v_provider_id
    ) THEN
      DELETE FROM public.email_provider_events WHERE provider_message_id = v_provider_id;
    END IF;
    RETURN OLD;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.email_operations_history WHERE provider_message_id = v_provider_id
  ) THEN
    INSERT INTO public.email_provider_deleted_source_markers(provider_message_hash)
    VALUES (encode(extensions.digest(v_provider_id, 'sha256'), 'hex'))
    ON CONFLICT (provider_message_hash) DO NOTHING;

    DELETE FROM public.email_provider_events WHERE provider_message_id = v_provider_id;
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.email_provider_source_deleted()
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
