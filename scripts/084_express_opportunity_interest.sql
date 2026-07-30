-- Generalize the existing locked-deal interest signal to every active,
-- repreneur-visible deal. It deliberately reuses opportunity_matches: an
-- interest is a staff-validation request, never an active pursuit or queue.
CREATE OR REPLACE FUNCTION public.express_opportunity_interest(
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
  v_match public.opportunity_matches%ROWTYPE;
  v_has_match BOOLEAN := FALSE;
BEGIN
  -- Serializes this eligibility check with concurrent opportunity changes.
  PERFORM 1
  FROM public.opportunities
  WHERE id = p_opportunity_id
    AND status = 'active'
    AND repreneur_exposure <> 'staff_only'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'interest_not_available' USING ERRCODE = 'P0001';
  END IF;

  -- Lock the caller's pair before changing it. Their existing active pursuit
  -- is never converted back into an interest signal.
  SELECT *
  INTO v_match
  FROM public.opportunity_matches
  WHERE opportunity_id = p_opportunity_id
    AND repreneur_id = p_repreneur_id
  FOR UPDATE;

  v_has_match := FOUND;

  IF v_has_match AND v_match.status = 'active_pursuit' THEN
    RAISE EXCEPTION 'interest_not_available' USING ERRCODE = 'P0001';
  END IF;

  -- Some legacy rows predate the evidence constraints and may carry a signed
  -- or waived label without its required audit evidence. Updating any column
  -- on those rows would trip the NOT VALID constraint. Fail closed instead of
  -- inferring evidence, clearing confidentiality history, or exposing a raw
  -- database error to the repreneur.
  IF v_has_match AND (
    (v_match.nda_status = 'signed' AND v_match.nda_signed_at IS NULL)
    OR (
      v_match.nda_status = 'waived'
      AND (
        v_match.nda_waived_at IS NULL
        OR NULLIF(BTRIM(v_match.nda_waived_by), '') IS NULL
      )
    )
  ) THEN
    RAISE EXCEPTION 'interest_not_available' USING ERRCODE = 'P0001';
  END IF;

  -- The existing partial unique index remains the concurrency authority for
  -- active pursuits. We lock another owner's row only to serialize a drop or
  -- reassignment with this signal; it is not modified here.
  PERFORM 1
  FROM public.opportunity_matches
  WHERE opportunity_id = p_opportunity_id
    AND status = 'active_pursuit'
    AND repreneur_id <> p_repreneur_id
  FOR UPDATE;

  IF v_has_match AND v_match.status = 'interested' THEN
    -- Existing history without the 067 signal timestamp remains ordinary
    -- interest history. Never silently reinterpret or notify it as a new
    -- self-discovered request.
    IF v_match.interest_expressed_at IS NULL THEN
      RAISE EXCEPTION 'interest_not_available' USING ERRCODE = 'P0001';
    END IF;

    RETURN QUERY SELECT v_match.id, v_match.interest_expressed_at, v_match.interest_notification_sent_at;
    RETURN;
  END IF;

  IF v_has_match THEN
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

  RETURN QUERY SELECT v_match.id, v_match.interest_expressed_at, v_match.interest_notification_sent_at;
END;
$$;

REVOKE ALL ON FUNCTION public.express_opportunity_interest(UUID, UUID, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.express_opportunity_interest(UUID, UUID, TEXT, TIMESTAMPTZ)
  TO service_role;

COMMENT ON FUNCTION public.express_opportunity_interest(UUID, UUID, TEXT, TIMESTAMPTZ) IS
  'Atomically creates or reuses one interested opportunity_matches pair for an active repreneur-visible opportunity; it never creates an active pursuit or changes confidentiality.';
