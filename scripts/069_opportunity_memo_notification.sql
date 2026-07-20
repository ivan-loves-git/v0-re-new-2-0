-- Migration: Once-only repreneur info memo availability notification
-- Purpose: Atomically claim one notification per active pursuit only after the
-- signed/waived NDA gate and a real approved deal-book asset both exist.

CREATE TABLE IF NOT EXISTS public.opportunity_memo_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL UNIQUE REFERENCES public.opportunity_matches(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  repreneur_id UUID NOT NULL REFERENCES public.repreneurs(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'failed', 'sent')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_attempt_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  last_error TEXT,
  provider_id TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_memo_notifications_retry
  ON public.opportunity_memo_notifications(status, last_attempt_at)
  WHERE sent_at IS NULL;

COMMENT ON TABLE public.opportunity_memo_notifications IS
  'Durable once-only delivery record for the first eligible info memo notification on each pursuit.';
COMMENT ON COLUMN public.opportunity_memo_notifications.match_id IS
  'One delivery record per opportunity match/pursuit. A later memo replacement reuses this record and cannot resend after sent_at is set.';

ALTER TABLE public.opportunity_memo_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.opportunity_memo_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.opportunity_memo_notifications TO service_role;

CREATE OR REPLACE FUNCTION public.claim_opportunity_memo_notification(
  p_opportunity_id UUID,
  p_match_id UUID DEFAULT NULL,
  p_attempted_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  match_id UUID,
  opportunity_id UUID,
  repreneur_id UUID,
  recipient_email TEXT,
  repreneur_first_name TEXT,
  opportunity_title TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match_id UUID;
  v_repreneur_id UUID;
  v_recipient_email TEXT;
  v_repreneur_first_name TEXT;
  v_opportunity_title TEXT;
  v_claimed_match_id UUID;
BEGIN
  -- The active match row is the confidentiality boundary and concurrency lock.
  -- NDA receipt alone is intentionally excluded.
  SELECT
    om.id,
    om.repreneur_id,
    BTRIM(r.email),
    COALESCE(NULLIF(BTRIM(r.first_name), ''), 'Madame, Monsieur'),
    COALESCE(NULLIF(BTRIM(o.public_title), ''), 'votre opportunite')
  INTO
    v_match_id,
    v_repreneur_id,
    v_recipient_email,
    v_repreneur_first_name,
    v_opportunity_title
  FROM public.opportunity_matches om
  JOIN public.opportunities o ON o.id = om.opportunity_id
  JOIN public.repreneurs r ON r.id = om.repreneur_id
  LEFT JOIN public.opportunity_memo_notifications n ON n.match_id = om.id
  WHERE om.opportunity_id = p_opportunity_id
    AND (p_match_id IS NULL OR om.id = p_match_id)
    AND om.status = 'active_pursuit'
    AND om.nda_status IN ('signed', 'waived')
    AND NULLIF(BTRIM(r.email), '') IS NOT NULL
    AND (
      n.match_id IS NULL
      OR (
        n.sent_at IS NULL
        AND (
          n.status IN ('pending', 'failed')
          OR (
            n.status = 'sending'
            AND n.last_attempt_at < p_attempted_at - INTERVAL '15 minutes'
          )
        )
      )
    )
    AND EXISTS (
      SELECT 1
      FROM public.opportunity_documents d
      WHERE d.opportunity_id = om.opportunity_id
        AND d.document_type = 'deal_book'
        AND d.visibility = 'approved_for_repreneur'
        AND (NULLIF(BTRIM(d.storage_path), '') IS NOT NULL
          OR NULLIF(BTRIM(d.external_url), '') IS NOT NULL)
    )
  ORDER BY om.updated_at DESC
  LIMIT 1
  FOR UPDATE OF om;

  IF v_match_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.opportunity_memo_notifications (
    match_id,
    opportunity_id,
    repreneur_id,
    recipient_email
  )
  VALUES (
    v_match_id,
    p_opportunity_id,
    v_repreneur_id,
    v_recipient_email
  )
  ON CONFLICT (match_id) DO UPDATE
  SET
    recipient_email = EXCLUDED.recipient_email,
    updated_at = p_attempted_at
  WHERE opportunity_memo_notifications.sent_at IS NULL;

  -- Failed attempts are immediately retryable. An interrupted in-flight claim
  -- becomes retryable after fifteen minutes and reuses the same provider key.
  UPDATE public.opportunity_memo_notifications n
  SET
    status = 'sending',
    attempt_count = n.attempt_count + 1,
    last_attempt_at = p_attempted_at,
    failed_at = NULL,
    last_error = NULL,
    updated_at = p_attempted_at
  WHERE n.match_id = v_match_id
    AND n.sent_at IS NULL
    AND (
      n.status IN ('pending', 'failed')
      OR (
        n.status = 'sending'
        AND n.last_attempt_at < p_attempted_at - INTERVAL '15 minutes'
      )
    )
  RETURNING n.match_id INTO v_claimed_match_id;

  IF v_claimed_match_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY SELECT
    v_match_id,
    p_opportunity_id,
    v_repreneur_id,
    v_recipient_email,
    v_repreneur_first_name,
    v_opportunity_title;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_opportunity_memo_notification(
  p_match_id UUID,
  p_sent_at TIMESTAMPTZ DEFAULT NOW(),
  p_provider_id TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.opportunity_memo_notifications
  SET
    status = 'sent',
    provider_id = COALESCE(provider_id, p_provider_id),
    sent_at = COALESCE(sent_at, p_sent_at),
    failed_at = NULL,
    last_error = NULL,
    updated_at = p_sent_at
  WHERE match_id = p_match_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_opportunity_memo_notification(
  p_match_id UUID,
  p_failed_at TIMESTAMPTZ DEFAULT NOW(),
  p_error TEXT DEFAULT 'Email delivery failed'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.opportunity_memo_notifications
  SET
    status = 'failed',
    failed_at = p_failed_at,
    last_error = LEFT(p_error, 1000),
    updated_at = p_failed_at
  WHERE match_id = p_match_id
    AND sent_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_opportunity_memo_notification(UUID, UUID, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_opportunity_memo_notification(UUID, TIMESTAMPTZ, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_opportunity_memo_notification(UUID, TIMESTAMPTZ, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_opportunity_memo_notification(UUID, UUID, TIMESTAMPTZ)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_opportunity_memo_notification(UUID, TIMESTAMPTZ, TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_opportunity_memo_notification(UUID, TIMESTAMPTZ, TEXT)
  TO service_role;

-- Rollback after disabling the application triggers:
-- DROP FUNCTION IF EXISTS public.fail_opportunity_memo_notification(UUID, TIMESTAMPTZ, TEXT);
-- DROP FUNCTION IF EXISTS public.complete_opportunity_memo_notification(UUID, TIMESTAMPTZ, TEXT);
-- DROP FUNCTION IF EXISTS public.claim_opportunity_memo_notification(UUID, UUID, TIMESTAMPTZ);
-- DROP TABLE IF EXISTS public.opportunity_memo_notifications;
