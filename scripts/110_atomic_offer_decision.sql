-- An offer decision and the repreneur lifecycle must either both commit or
-- both remain unchanged. This closes the retry race between separate writes.
CREATE OR REPLACE FUNCTION public.transition_repreneur_offer_decision(
  p_repreneur_offer_id UUID,
  p_repreneur_id UUID,
  p_new_status TEXT,
  p_decline_reason_category TEXT DEFAULT NULL,
  p_decline_reason_text TEXT DEFAULT NULL
)
RETURNS TABLE (
  status TEXT,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_offer public.repreneur_offers%ROWTYPE;
  v_duration_days INTEGER;
  v_decided_at TIMESTAMPTZ := NOW();
  v_transitioned BOOLEAN := FALSE;
BEGIN
  IF p_new_status NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'Only offered decisions can be accepted or declined.';
  END IF;

  SELECT *
  INTO v_offer
  FROM public.repreneur_offers ro
  WHERE ro.id = p_repreneur_offer_id
    AND ro.repreneur_id = p_repreneur_id
  FOR UPDATE OF ro;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This offer no longer belongs to this repreneur. Refresh and try again.';
  END IF;

  SELECT duration_days INTO v_duration_days
  FROM public.offers
  WHERE id = v_offer.offer_id;

  IF v_offer.status::TEXT <> 'offered' AND v_offer.status::TEXT <> p_new_status THEN
    RAISE EXCEPTION 'This offer was already %. Refresh before changing it again.', v_offer.status;
  END IF;

  -- A same-decision retry intentionally keeps the original dates. It still
  -- reaches the lifecycle update below, so legacy partial state is repaired.
  IF v_offer.status::TEXT = 'offered' THEN
    v_transitioned := TRUE;
    IF p_new_status = 'accepted' THEN
      UPDATE public.repreneur_offers
      SET status = 'accepted',
          accepted_at = v_decided_at,
          expires_at = v_decided_at + make_interval(days => v_duration_days)
      WHERE id = p_repreneur_offer_id;
    ELSE
      UPDATE public.repreneur_offers
      SET status = 'declined',
          declined_at = v_decided_at
      WHERE id = p_repreneur_offer_id;
    END IF;
  END IF;

  IF p_new_status = 'accepted' THEN
    UPDATE public.repreneurs
    SET lifecycle_status = 'client'
    WHERE id = p_repreneur_id;
  ELSIF v_transitioned THEN
    UPDATE public.repreneurs
    SET lifecycle_status = 'declined',
        declined_at = v_decided_at,
        decline_reason_category = p_decline_reason_category,
        decline_reason_text = NULLIF(BTRIM(p_decline_reason_text), '')
    WHERE id = p_repreneur_id;
  ELSE
    UPDATE public.repreneurs
    SET lifecycle_status = 'declined',
        declined_at = COALESCE(declined_at, v_offer.declined_at)
    WHERE id = p_repreneur_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Repreneur was not found.';
  END IF;

  RETURN QUERY
  SELECT ro.status::TEXT, ro.accepted_at, ro.expires_at, ro.declined_at
  FROM public.repreneur_offers ro
  WHERE ro.id = p_repreneur_offer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.transition_repreneur_offer_decision(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transition_repreneur_offer_decision(UUID, UUID, TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.transition_repreneur_offer_decision(UUID, UUID, TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.transition_repreneur_offer_decision(UUID, UUID, TEXT, TEXT, TEXT) TO service_role;
