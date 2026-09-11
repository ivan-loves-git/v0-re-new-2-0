-- Decision #123 / Tickets #116 and #118: only actual invited portal
-- publication starts a clock. An uninvited staff assignment grants no access.

ALTER TABLE public.opportunity_matches
  ADD COLUMN IF NOT EXISTS recommendation_published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recommendation_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recommendation_renewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recommendation_renewed_by TEXT;

COMMENT ON COLUMN public.opportunity_matches.recommendation_published_at IS
  'First explicit staff publication in the invited portal. Historical rows remain NULL until an explicit publication or renewal; never inferred from old timestamps.';
COMMENT ON COLUMN public.opportunity_matches.recommendation_expires_at IS
  'Current 72 elapsed-hour interest deadline. Historical NULL means unclocked, not expired. Existing interested pursuits are unaffected.';
COMMENT ON COLUMN public.opportunity_matches.recommendation_renewed_at IS
  'Most recent explicit staff renewal. Original publication is retained; this is current match state, not a complete renewal event ledger.';

CREATE OR REPLACE FUNCTION public.w172_set_recommendation_window()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_actor TEXT;
BEGIN
  IF NEW.status = 'proposed'
    AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'proposed')
    AND NEW.recommendation_published_at IS NULL THEN
    v_actor := NEW.created_by;
    IF (SELECT count(*) FROM public.app_user_roles
        WHERE role='staff' AND (user_id=v_actor OR email=v_actor)) <> 1 THEN
      RAISE EXCEPTION 'recommendation_publication_staff_required';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.opportunities o JOIN public.repreneurs r
      ON r.id=NEW.repreneur_id AND r.is_demo=o.is_demo
      WHERE o.id=NEW.opportunity_id AND o.status='active') THEN
      RAISE EXCEPTION 'recommendation_publication_active_same_namespace_required';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.app_user_roles
      WHERE role='repreneur' AND repreneur_id=NEW.repreneur_id AND user_id IS NOT NULL) THEN
      RETURN NEW;
    END IF;
    NEW.recommendation_published_at := clock_timestamp();
    NEW.recommendation_expires_at := NEW.recommendation_published_at + INTERVAL '72 hours';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.w172_reject_expired_interest()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
  -- Also protects declined -> interested reconsideration and generic discovery.
  IF NEW.status = 'interested' AND OLD.status NOT IN ('interested','active_pursuit')
    AND OLD.recommendation_expires_at IS NOT NULL
    AND OLD.recommendation_expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'recommendation_response_expired' USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS w172_set_recommendation_window ON public.opportunity_matches;
CREATE TRIGGER w172_set_recommendation_window BEFORE INSERT OR UPDATE OF status ON public.opportunity_matches
  FOR EACH ROW EXECUTE FUNCTION public.w172_set_recommendation_window();
DROP TRIGGER IF EXISTS w172_reject_expired_interest ON public.opportunity_matches;
CREATE TRIGGER w172_reject_expired_interest BEFORE UPDATE OF status ON public.opportunity_matches
  FOR EACH ROW EXECUTE FUNCTION public.w172_reject_expired_interest();

CREATE OR REPLACE FUNCTION public.renew_opportunity_recommendation(
  p_match_id UUID, p_actor TEXT
) RETURNS TABLE(match_id UUID, publication_at TIMESTAMPTZ, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE; v_now TIMESTAMPTZ;
BEGIN
  IF NULLIF(BTRIM(p_actor),'') IS NULL
    OR (SELECT count(*) FROM public.app_user_roles WHERE role='staff' AND (user_id=p_actor OR email=p_actor)) <> 1 THEN
    RAISE EXCEPTION 'recommendation_renewal_staff_required';
  END IF;
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE;
  IF NOT FOUND OR v_match.status <> 'proposed' THEN
    RAISE EXCEPTION 'recommendation_renewal_not_available' USING ERRCODE='P0001';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.app_user_roles WHERE role='repreneur'
      AND repreneur_id=v_match.repreneur_id AND user_id IS NOT NULL)
    OR NOT EXISTS(SELECT 1 FROM public.opportunities o JOIN public.repreneurs r
      ON r.id=v_match.repreneur_id AND r.is_demo=o.is_demo
      WHERE o.id=v_match.opportunity_id AND o.status='active') THEN
    RAISE EXCEPTION 'recommendation_renewal_visible_portal_required';
  END IF;
  v_now := clock_timestamp();
  IF v_match.recommendation_expires_at IS NOT NULL AND v_match.recommendation_expires_at > v_now THEN
    -- A double click/retry must not move an already open window.
    RETURN QUERY SELECT v_match.id, v_match.recommendation_published_at, v_match.recommendation_expires_at;
    RETURN;
  END IF;
  UPDATE public.opportunity_matches
  SET recommendation_published_at=COALESCE(recommendation_published_at,v_now),
      recommendation_expires_at=v_now + INTERVAL '72 hours',
      recommendation_renewed_at=v_now, recommendation_renewed_by=BTRIM(p_actor)
  WHERE id=v_match.id;
  RETURN QUERY SELECT v_match.id, COALESCE(v_match.recommendation_published_at,v_now), v_now + INTERVAL '72 hours';
END $$;

REVOKE ALL ON FUNCTION public.w172_set_recommendation_window(), public.w172_reject_expired_interest(),
  public.renew_opportunity_recommendation(UUID,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.w172_set_recommendation_window(), public.w172_reject_expired_interest(),
  public.renew_opportunity_recommendation(UUID,TEXT) TO service_role;
