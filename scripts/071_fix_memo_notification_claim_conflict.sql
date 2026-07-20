-- Fix the notification claim function after production verification exposed a
-- PL/pgSQL name collision between the RETURNS TABLE match_id output and the
-- ledger's ON CONFLICT target.

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
  ON CONFLICT ON CONSTRAINT opportunity_memo_notifications_match_id_key DO UPDATE
  SET
    recipient_email = EXCLUDED.recipient_email,
    updated_at = p_attempted_at
  WHERE opportunity_memo_notifications.sent_at IS NULL;

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

REVOKE ALL ON FUNCTION public.claim_opportunity_memo_notification(UUID, UUID, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_opportunity_memo_notification(UUID, UUID, TIMESTAMPTZ)
  TO service_role;
