-- Minimal locked-opportunity interest signal.
-- The existing opportunity_matches row records who and which opportunity;
-- these timestamps preserve when interest was expressed and when the internal
-- staff email was confirmed as sent.
ALTER TABLE public.opportunity_matches
  ADD COLUMN IF NOT EXISTS interest_expressed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS interest_notification_sent_at TIMESTAMPTZ;

UPDATE public.opportunity_matches
SET interest_expressed_at = COALESCE(interest_expressed_at, updated_at, created_at)
WHERE status = 'interested'
  AND interest_expressed_at IS NULL;

COMMENT ON COLUMN public.opportunity_matches.interest_expressed_at IS
  'When this repreneur most recently expressed interest in the opportunity.';
COMMENT ON COLUMN public.opportunity_matches.interest_notification_sent_at IS
  'When WAVE confirmed the internal Re-New notification email for this interest signal.';

CREATE OR REPLACE FUNCTION public.express_locked_opportunity_interest(
  p_opportunity_id UUID,
  p_repreneur_id UUID,
  p_actor_id TEXT,
  p_expressed_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  match_id UUID,
  expressed_at TIMESTAMPTZ,
  notification_sent_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_match_id UUID;
  v_match public.opportunity_matches%ROWTYPE;
BEGIN
  -- Only active opportunities deliberately exposed to repreneurs are eligible.
  -- Lock the opportunity row for the duration of this transaction so status or
  -- exposure changes cannot race the interest write.
  PERFORM 1
  FROM public.opportunities
  WHERE id = p_opportunity_id
    AND status = 'active'
    AND repreneur_exposure <> 'staff_only'
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'locked_interest_not_available' USING ERRCODE = 'P0001';
  END IF;

  -- The action exists only while a different repreneur owns the active pursuit.
  -- The row lock serializes this signal with a concurrent drop/reassignment.
  SELECT id
  INTO v_active_match_id
  FROM public.opportunity_matches
  WHERE opportunity_id = p_opportunity_id
    AND status = 'active_pursuit'
    AND repreneur_id <> p_repreneur_id
  LIMIT 1
  FOR UPDATE;

  IF v_active_match_id IS NULL THEN
    RAISE EXCEPTION 'locked_interest_not_available' USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_match
  FROM public.opportunity_matches
  WHERE opportunity_id = p_opportunity_id
    AND repreneur_id = p_repreneur_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_match.status = 'active_pursuit' THEN
      RAISE EXCEPTION 'locked_interest_not_available' USING ERRCODE = 'P0001';
    END IF;

    -- Once both the signal and its email are recorded, repeated actions are a
    -- true no-op. If the email failed, keep the original expressed-at timestamp
    -- and let the application retry only the notification.
    IF v_match.status = 'interested'
      AND v_match.interest_expressed_at IS NOT NULL THEN
      RETURN QUERY SELECT
        v_match.id,
        v_match.interest_expressed_at,
        v_match.interest_notification_sent_at;
      RETURN;
    END IF;

    UPDATE public.opportunity_matches
    SET
      status = 'interested',
      decline_reason_categories = '{}',
      decline_reason_text = NULL,
      pursuit_stage = NULL,
      pursuit_stage_notes = NULL,
      pursuit_stage_updated_by = NULL,
      pursuit_stage_updated_at = NULL,
      reviewed_by = NULL,
      reviewed_at = NULL,
      interest_expressed_at = p_expressed_at,
      interest_notification_sent_at = NULL
    WHERE id = v_match.id
    RETURNING * INTO v_match;
  ELSE
    INSERT INTO public.opportunity_matches (
      opportunity_id,
      repreneur_id,
      status,
      created_by,
      interest_expressed_at
    )
    VALUES (
      p_opportunity_id,
      p_repreneur_id,
      'interested',
      p_actor_id,
      p_expressed_at
    )
    RETURNING * INTO v_match;
  END IF;

  RETURN QUERY SELECT
    v_match.id,
    v_match.interest_expressed_at,
    v_match.interest_notification_sent_at;
END;
$$;

REVOKE ALL ON FUNCTION public.express_locked_opportunity_interest(UUID, UUID, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.express_locked_opportunity_interest(UUID, UUID, TEXT, TIMESTAMPTZ)
  TO service_role;

COMMENT ON FUNCTION public.express_locked_opportunity_interest(UUID, UUID, TEXT, TIMESTAMPTZ) IS
  'Atomically records one repreneur interest signal only while another repreneur owns the active pursuit. Callable only through the server-side service role.';
