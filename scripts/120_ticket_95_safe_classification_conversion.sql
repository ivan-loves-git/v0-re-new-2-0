-- Ticket #95: staff may move only a zero-match record between REAL and DEMO.
-- The existing W-164 trigger remains the final matched-record authority. This
-- narrow service adds atomic match serialization and durable actor/time
-- attribution without changing lifecycle, visibility or relationship history.
BEGIN;

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS demo_classification_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS demo_classification_updated_by TEXT;

COMMENT ON COLUMN public.opportunities.demo_classification_updated_at IS
  'Last time staff changed this zero-match opportunity between REAL and DEMO.';
COMMENT ON COLUMN public.opportunities.demo_classification_updated_by IS
  'Staff user that last changed this zero-match opportunity between REAL and DEMO.';

CREATE OR REPLACE FUNCTION public.set_zero_match_demo_classification(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_is_demo BOOLEAN,
  p_actor TEXT
)
RETURNS TABLE (
  entity_id UUID,
  is_demo BOOLEAN,
  changed BOOLEAN,
  changed_at TIMESTAMPTZ,
  changed_by TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_entity_type TEXT := LOWER(NULLIF(BTRIM(p_entity_type), ''));
  v_actor TEXT := NULLIF(BTRIM(p_actor), '');
  v_current_is_demo BOOLEAN;
  v_current_changed_at TIMESTAMPTZ;
  v_current_changed_by TEXT;
  v_changed_at TIMESTAMPTZ;
BEGIN
  IF v_entity_type IS NULL
    OR v_entity_type NOT IN ('opportunity', 'repreneur')
    OR p_entity_id IS NULL
    OR p_is_demo IS NULL
    OR v_actor IS NULL THEN
    RAISE EXCEPTION 'ticket_95_classification_input_required';
  END IF;

  -- Classification is a rare staff correction. Briefly serializing match
  -- writes closes the race between the zero-match check and the endpoint
  -- update without weakening the W-164 trigger or adding an override.
  LOCK TABLE public.opportunity_matches IN SHARE ROW EXCLUSIVE MODE;

  IF v_entity_type = 'opportunity' THEN
    SELECT opportunity.is_demo,
           opportunity.demo_classification_updated_at,
           opportunity.demo_classification_updated_by
      INTO v_current_is_demo, v_current_changed_at, v_current_changed_by
    FROM public.opportunities opportunity
    WHERE opportunity.id = p_entity_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'ticket_95_classification_not_found'; END IF;
    IF EXISTS (
      SELECT 1
      FROM public.opportunity_matches match
      WHERE match.opportunity_id = p_entity_id
    ) THEN
      RAISE EXCEPTION 'ticket_95_classification_locked';
    END IF;

    IF v_current_is_demo IS NOT DISTINCT FROM p_is_demo THEN
      RETURN QUERY SELECT p_entity_id, v_current_is_demo, FALSE,
        v_current_changed_at, v_current_changed_by;
      RETURN;
    END IF;

    v_changed_at := clock_timestamp();
    UPDATE public.opportunities opportunity
    SET is_demo = p_is_demo,
        demo_classification_updated_at = v_changed_at,
        demo_classification_updated_by = v_actor,
        updated_by = v_actor,
        updated_at = v_changed_at
    WHERE opportunity.id = p_entity_id;
  ELSE
    SELECT repreneur.is_demo,
           repreneur.demo_classification_updated_at,
           repreneur.demo_classification_updated_by
      INTO v_current_is_demo, v_current_changed_at, v_current_changed_by
    FROM public.repreneurs repreneur
    WHERE repreneur.id = p_entity_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'ticket_95_classification_not_found'; END IF;
    IF EXISTS (
      SELECT 1
      FROM public.opportunity_matches match
      WHERE match.repreneur_id = p_entity_id
    ) THEN
      RAISE EXCEPTION 'ticket_95_classification_locked';
    END IF;

    IF v_current_is_demo IS NOT DISTINCT FROM p_is_demo THEN
      RETURN QUERY SELECT p_entity_id, v_current_is_demo, FALSE,
        v_current_changed_at, v_current_changed_by;
      RETURN;
    END IF;

    v_changed_at := clock_timestamp();
    UPDATE public.repreneurs repreneur
    SET is_demo = p_is_demo,
        demo_classification_updated_at = v_changed_at,
        demo_classification_updated_by = v_actor,
        updated_at = v_changed_at
    WHERE repreneur.id = p_entity_id;
  END IF;

  RETURN QUERY SELECT p_entity_id, p_is_demo, TRUE, v_changed_at, v_actor;
END;
$$;

REVOKE ALL ON FUNCTION public.set_zero_match_demo_classification(TEXT, UUID, BOOLEAN, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_zero_match_demo_classification(TEXT, UUID, BOOLEAN, TEXT)
  TO service_role;

COMMIT;
