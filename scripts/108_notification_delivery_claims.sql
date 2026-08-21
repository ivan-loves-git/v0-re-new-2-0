-- Migration 108: durable, fenced delivery claims for one logical notification.
-- The same ledger protects cron reminders and staff-triggered offer/milestone
-- messages. Provider idempotency plus one durable email log makes retries safe
-- after an interrupted response without duplicating analytics or daily counts.

DO $$
BEGIN
  IF to_regclass('public.notification_delivery_claims') IS NULL
    AND to_regclass('public.cron_reminder_delivery_claims') IS NOT NULL
  THEN
    ALTER TABLE public.cron_reminder_delivery_claims
      RENAME TO notification_delivery_claims;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.notification_delivery_claims (
  idempotency_key TEXT PRIMARY KEY
    CHECK (NULLIF(BTRIM(idempotency_key), '') IS NOT NULL),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),
  lease_expires_at TIMESTAMPTZ,
  lease_token UUID,
  attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
  provider_message_id TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notification_delivery_claims
  ADD COLUMN IF NOT EXISTS lease_token UUID;

ALTER TABLE public.notification_delivery_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.notification_delivery_claims FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.notification_delivery_claims TO service_role;

CREATE OR REPLACE FUNCTION public.claim_notification_delivery(
  p_idempotency_key TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_key TEXT := NULLIF(BTRIM(p_idempotency_key), '');
  existing public.notification_delivery_claims%ROWTYPE;
  claimed_at TIMESTAMPTZ := clock_timestamp();
  next_lease_token UUID := gen_random_uuid();
BEGIN
  IF normalized_key IS NULL OR LENGTH(normalized_key) > 256 THEN
    RAISE EXCEPTION 'A valid notification idempotency key is required.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(normalized_key, 0));

  SELECT * INTO existing
  FROM public.notification_delivery_claims
  WHERE idempotency_key = normalized_key
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.notification_delivery_claims (
      idempotency_key, status, lease_expires_at, lease_token, attempt_count, updated_at
    ) VALUES (
      normalized_key,
      'pending',
      claimed_at + INTERVAL '5 minutes',
      next_lease_token,
      1,
      claimed_at
    );
    RETURN jsonb_build_object('status', 'claimed', 'leaseToken', next_lease_token::TEXT);
  END IF;

  IF existing.status = 'sent' THEN
    RETURN jsonb_build_object('status', 'sent');
  END IF;

  IF existing.status = 'pending' AND existing.lease_expires_at > claimed_at THEN
    RETURN jsonb_build_object('status', 'busy');
  END IF;

  UPDATE public.notification_delivery_claims
  SET status = 'pending',
      lease_expires_at = claimed_at + INTERVAL '5 minutes',
      lease_token = next_lease_token,
      attempt_count = attempt_count + 1,
      updated_at = claimed_at
  WHERE idempotency_key = normalized_key;

  RETURN jsonb_build_object('status', 'claimed', 'leaseToken', next_lease_token::TEXT);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_notification_delivery(
  p_idempotency_key TEXT,
  p_lease_token TEXT,
  p_succeeded BOOLEAN,
  p_provider_message_id TEXT DEFAULT NULL
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_key TEXT := NULLIF(BTRIM(p_idempotency_key), '');
  normalized_lease_token TEXT := NULLIF(BTRIM(p_lease_token), '');
  completed_at TIMESTAMPTZ := clock_timestamp();
  existing public.notification_delivery_claims%ROWTYPE;
BEGIN
  IF normalized_key IS NULL OR normalized_lease_token IS NULL THEN
    RAISE EXCEPTION 'A notification idempotency key and lease token are required.';
  END IF;

  SELECT * INTO existing
  FROM public.notification_delivery_claims
  WHERE idempotency_key = normalized_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Notification delivery claim was not found.';
  END IF;

  -- Sent is terminal. In particular, an expired older worker cannot report a
  -- late failure and downgrade a newer worker's conclusive success.
  IF existing.status = 'sent' THEN
    RETURN 'sent';
  END IF;

  IF existing.status <> 'pending'
    OR existing.lease_token::TEXT IS DISTINCT FROM normalized_lease_token
  THEN
    RETURN 'stale';
  END IF;

  UPDATE public.notification_delivery_claims
  SET status = CASE WHEN p_succeeded THEN 'sent' ELSE 'failed' END,
      lease_expires_at = NULL,
      lease_token = NULL,
      provider_message_id = CASE WHEN p_succeeded THEN p_provider_message_id ELSE NULL END,
      sent_at = CASE WHEN p_succeeded THEN completed_at ELSE NULL END,
      updated_at = completed_at
  WHERE idempotency_key = normalized_key;

  RETURN CASE WHEN p_succeeded THEN 'sent' ELSE 'failed' END;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_notification_delivery(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_notification_delivery(TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_delivery(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_notification_delivery(TEXT, TEXT, BOOLEAN, TEXT) TO service_role;

-- One provider idempotency key owns one email log and one daily-count charge.
ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS daily_counted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_attempted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_outcome TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.email_logs'::regclass
      AND conname = 'email_logs_provider_outcome_check'
  ) THEN
    ALTER TABLE public.email_logs
      ADD CONSTRAINT email_logs_provider_outcome_check
      CHECK (provider_outcome IS NULL OR provider_outcome IN ('attempting', 'uncertain', 'rejected', 'accepted'));
  END IF;
END;
$$;

-- Replace an earlier partial draft if this migration was rehearsed before
-- release. PostgREST `on_conflict=idempotency_key` needs an inferable index.
DROP INDEX IF EXISTS public.idx_email_logs_idempotency_key;
CREATE UNIQUE INDEX idx_email_logs_idempotency_key
  ON public.email_logs (idempotency_key);

CREATE OR REPLACE FUNCTION public.finalize_idempotent_email_delivery(
  p_email_log_id UUID,
  p_resend_id TEXT,
  p_sent_at TIMESTAMPTZ,
  p_target_date DATE
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  existing public.email_logs%ROWTYPE;
BEGIN
  SELECT * INTO existing
  FROM public.email_logs
  WHERE id = p_email_log_id
  FOR UPDATE;

  IF NOT FOUND OR existing.idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Idempotent email log was not found.';
  END IF;

  IF existing.daily_counted_at IS NULL THEN
    INSERT INTO public.email_daily_counts AS daily_counts (date, count)
    VALUES (p_target_date, 1)
    ON CONFLICT (date)
    DO UPDATE SET count = daily_counts.count + 1;
  END IF;

  UPDATE public.email_logs
  SET status = CASE
        WHEN existing.status IN ('delivered', 'opened', 'clicked') THEN existing.status
        ELSE 'sent'
      END,
      resend_id = COALESCE(existing.resend_id, p_resend_id),
      sent_at = COALESCE(existing.sent_at, p_sent_at),
      daily_counted_at = COALESCE(existing.daily_counted_at, p_sent_at),
      provider_outcome = 'accepted',
      error_message = NULL
  WHERE id = p_email_log_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_idempotent_email_delivery(UUID, TEXT, TIMESTAMPTZ, DATE)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_idempotent_email_delivery(UUID, TEXT, TIMESTAMPTZ, DATE)
  TO service_role;

-- Migration 108 replaces the narrower cron-only API. Do not leave a second,
-- unfenced completion path capable of mutating the renamed ledger.
DROP FUNCTION IF EXISTS public.claim_cron_reminder_delivery(TEXT);
DROP FUNCTION IF EXISTS public.complete_cron_reminder_delivery(TEXT, BOOLEAN, TEXT);

COMMENT ON TABLE public.notification_delivery_claims IS
  'Fenced operational idempotency leases for cron and staff-triggered notification deliveries.';
