-- W-131 through W-136: a dropped pursuit remains historical and confidential
-- access remains revoked. Its owner may only record a fresh, ordinary interest
-- signal through this existing idempotent boundary; it never reopens a pursuit.
CREATE OR REPLACE FUNCTION public.express_opportunity_interest(
  p_opportunity_id UUID,
  p_repreneur_id UUID,
  p_actor_id TEXT,
  p_expressed_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (match_id UUID, expressed_at TIMESTAMPTZ, notification_sent_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_opportunity public.opportunities%ROWTYPE;
  v_match public.opportunity_matches%ROWTYPE;
  v_has_match BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_opportunity
  FROM public.opportunities
  WHERE id=p_opportunity_id AND status='active' AND NOT is_demo
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'interest_not_available' USING ERRCODE='P0001'; END IF;

  SELECT * INTO v_match
  FROM public.opportunity_matches
  WHERE opportunity_id=p_opportunity_id AND repreneur_id=p_repreneur_id
  FOR UPDATE;
  v_has_match := FOUND;

  -- Exact current matches remain distinct from broad discovery. A dropped
  -- owner can reconsider, but an unmatched staff_only opportunity cannot.
  IF v_opportunity.repreneur_exposure='staff_only' AND (
    NOT v_has_match OR v_match.status NOT IN ('proposed','interested','declined','active_pursuit','dropped')
  ) THEN RAISE EXCEPTION 'interest_not_available' USING ERRCODE='P0001'; END IF;
  IF v_has_match AND v_match.status='active_pursuit' THEN RAISE EXCEPTION 'interest_not_available' USING ERRCODE='P0001'; END IF;
  IF v_has_match AND ((v_match.nda_status='signed' AND v_match.nda_signed_at IS NULL) OR (v_match.nda_status='waived' AND (v_match.nda_waived_at IS NULL OR NULLIF(BTRIM(v_match.nda_waived_by),'') IS NULL))) THEN
    RAISE EXCEPTION 'interest_not_available' USING ERRCODE='P0001';
  END IF;

  -- The unique active-pursuit index remains authoritative. This lock only
  -- serializes a concurrent staff drop/reassignment; no pursuit is changed.
  PERFORM 1 FROM public.opportunity_matches
  WHERE opportunity_id=p_opportunity_id AND status='active_pursuit' AND repreneur_id<>p_repreneur_id
  FOR UPDATE;

  IF v_has_match AND v_match.status='interested' THEN
    IF v_match.interest_expressed_at IS NULL THEN RAISE EXCEPTION 'interest_not_available' USING ERRCODE='P0001'; END IF;
    RETURN QUERY SELECT v_match.id,v_match.interest_expressed_at,v_match.interest_notification_sent_at;
    RETURN;
  END IF;

  IF v_has_match THEN
    UPDATE public.opportunity_matches
    SET status='interested',
        decline_reason_categories='{}',
        decline_reason_text=NULL,
        pursuit_stage=NULL,
        pursuit_stage_notes=NULL,
        pursuit_stage_updated_by=NULL,
        pursuit_stage_updated_at=NULL,
        reviewed_by=NULL,
        reviewed_at=NULL,
        interest_expressed_at=p_expressed_at,
        interest_notification_sent_at=NULL
    WHERE id=v_match.id
    RETURNING * INTO v_match;
  ELSE
    INSERT INTO public.opportunity_matches(opportunity_id,repreneur_id,status,created_by,interest_expressed_at)
    VALUES(p_opportunity_id,p_repreneur_id,'interested',p_actor_id,p_expressed_at)
    RETURNING * INTO v_match;
  END IF;

  RETURN QUERY SELECT v_match.id,v_match.interest_expressed_at,v_match.interest_notification_sent_at;
END $$;

REVOKE ALL ON FUNCTION public.express_opportunity_interest(UUID,UUID,TEXT,TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.express_opportunity_interest(UUID,UUID,TEXT,TIMESTAMPTZ) TO service_role;

COMMENT ON FUNCTION public.express_opportunity_interest(UUID,UUID,TEXT,TIMESTAMPTZ) IS
  'Atomically records an interest signal for an active non-DEMO opportunity; a dropped exact match may be reconsidered but no pursuit, source disclosure, NDA, memo or document access is restored.';
