-- Operational integrity: a stale staff tab must not assign an archived offer
-- or create a second open assignment. The RPC keeps assignment and lifecycle
-- state in one transaction and serializes requests for the same pair.
CREATE OR REPLACE FUNCTION public.assign_repreneur_offer(
  p_repreneur_id UUID,
  p_offer_id UUID,
  p_created_by TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_assignment_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_repreneur_id::text || ':' || p_offer_id::text, 0));

  IF NOT EXISTS (
    SELECT 1 FROM public.offers WHERE id = p_offer_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'This offer is no longer active. Refresh before assigning it.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.repreneur_offers
    WHERE repreneur_id = p_repreneur_id
      AND offer_id = p_offer_id
      AND status IN ('offered', 'accepted')
  ) THEN
    RAISE EXCEPTION 'This offer already has an open assignment for this repreneur.';
  END IF;

  INSERT INTO public.repreneur_offers (repreneur_id, offer_id, status, offered_at, created_by)
  VALUES (p_repreneur_id, p_offer_id, 'offered', NOW(), p_created_by)
  RETURNING id INTO v_assignment_id;

  UPDATE public.repreneurs
  SET lifecycle_status = 'qualified'
  WHERE id = p_repreneur_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Repreneur was not found.';
  END IF;

  RETURN v_assignment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_repreneur_offer(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_repreneur_offer(UUID, UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.assign_repreneur_offer(UUID, UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.assign_repreneur_offer(UUID, UUID, TEXT) TO service_role;
