-- #157: personal navigation evidence, separate from business responses and staff review.
BEGIN;
CREATE TABLE public.repreneur_opportunity_review_state (
  repreneur_id UUID NOT NULL REFERENCES public.repreneurs(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  is_demo BOOLEAN NOT NULL,
  first_viewed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  reviewed BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (repreneur_id, opportunity_id, is_demo)
);
CREATE INDEX repreneur_opportunity_review_state_opportunity_idx
  ON public.repreneur_opportunity_review_state(opportunity_id);
ALTER TABLE public.repreneur_opportunity_review_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repreneur_opportunity_review_state FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.repreneur_opportunity_review_state FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.repreneur_opportunity_review_state TO service_role;

-- Only the authenticated server action may supply the canonical repreneur ID.
-- NULL records an opening; a Boolean updates an already-opened personal review.
CREATE FUNCTION public.record_repreneur_opportunity_review(
  p_repreneur_id UUID, p_opportunity_id UUID, p_reviewed BOOLEAN DEFAULT NULL,
  p_expected_reviewed BOOLEAN DEFAULT NULL
) RETURNS TABLE(viewed BOOLEAN, reviewed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_demo BOOLEAN; v_state public.repreneur_opportunity_review_state%ROWTYPE;
BEGIN
  -- Parent locks serialize namespace/lifecycle changes and deletion with writes.
  SELECT r.is_demo INTO v_demo FROM public.repreneurs r
    WHERE r.id=p_repreneur_id FOR SHARE;
  IF NOT FOUND OR v_demo IS NULL THEN
    RAISE EXCEPTION 'review_not_available' USING ERRCODE='P0001';
  END IF;
  PERFORM 1 FROM public.opportunities o
    WHERE o.id=p_opportunity_id AND o.status='active' AND o.is_demo=v_demo FOR SHARE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.w164_repreneur_live_inventory(p_repreneur_id,p_opportunity_id)
  ) THEN
    RAISE EXCEPTION 'review_not_available' USING ERRCODE='P0001';
  END IF;
  IF p_reviewed IS NULL THEN
    -- A later opening must neither move the first timestamp nor undo Reviewed.
    INSERT INTO public.repreneur_opportunity_review_state(repreneur_id,opportunity_id,is_demo)
    VALUES(p_repreneur_id,p_opportunity_id,v_demo)
    ON CONFLICT (repreneur_id,opportunity_id,is_demo) DO NOTHING;
  ELSE
    SELECT s.* INTO v_state FROM public.repreneur_opportunity_review_state s
      WHERE s.repreneur_id=p_repreneur_id AND s.opportunity_id=p_opportunity_id AND s.is_demo=v_demo
      FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'review_requires_view' USING ERRCODE='P0001'; END IF;
    IF p_expected_reviewed IS NULL OR v_state.reviewed<>p_expected_reviewed THEN
      RAISE EXCEPTION 'review_state_changed' USING ERRCODE='P0001';
    END IF;
    UPDATE public.repreneur_opportunity_review_state s SET reviewed=p_reviewed
      WHERE s.repreneur_id=p_repreneur_id AND s.opportunity_id=p_opportunity_id AND s.is_demo=v_demo;
  END IF;
  RETURN QUERY SELECT true,s.reviewed FROM public.repreneur_opportunity_review_state s
    WHERE s.repreneur_id=p_repreneur_id AND s.opportunity_id=p_opportunity_id AND s.is_demo=v_demo;
END $$;
REVOKE ALL ON FUNCTION public.record_repreneur_opportunity_review(UUID,UUID,BOOLEAN,BOOLEAN) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_repreneur_opportunity_review(UUID,UUID,BOOLEAN,BOOLEAN) TO service_role;
COMMENT ON TABLE public.repreneur_opportunity_review_state IS
  '#157: prospective personal first opening and reversible review state; delete with either parent, no business evidence or analytics export.';
COMMIT;
