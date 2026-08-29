-- W-169 follow-up: keep the dedicated Pause transition flag scoped to the
-- exact opportunity update inside the service. A direct service transaction
-- must not inherit the flag and use it to pause a second opportunity.

CREATE OR REPLACE FUNCTION public.pause_opportunity_with_reason(
  p_opportunity_id UUID,
  p_reason TEXT,
  p_paused_by TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_opportunity public.opportunities%ROWTYPE;
  v_pause_id UUID;
  v_previous_transition_flag TEXT :=
    current_setting('wave.opportunity_pause_transition', TRUE);
BEGIN
  IF NULLIF(BTRIM(p_paused_by), '') IS NULL THEN
    RAISE EXCEPTION 'opportunity_pause_actor_required';
  END IF;
  IF NULLIF(BTRIM(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'opportunity_pause_reason_required';
  END IF;
  IF p_reason <> 'paused_cabinet' THEN
    RAISE EXCEPTION 'opportunity_pause_reason_invalid';
  END IF;

  SELECT *
  INTO v_opportunity
  FROM public.opportunities
  WHERE id = p_opportunity_id
  FOR UPDATE;

  IF v_opportunity.id IS NULL THEN
    RAISE EXCEPTION 'opportunity_not_found';
  END IF;
  IF v_opportunity.status <> 'active'::public.opportunity_status THEN
    RAISE EXCEPTION 'opportunity_not_active_for_pause';
  END IF;

  PERFORM set_config('wave.opportunity_pause_transition', 'on', TRUE);
  BEGIN
    UPDATE public.opportunities
    SET
      status = 'paused'::public.opportunity_status,
      updated_by = p_paused_by
    WHERE id = v_opportunity.id;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config(
      'wave.opportunity_pause_transition',
      COALESCE(v_previous_transition_flag, ''),
      TRUE
    );
    RAISE;
  END;
  PERFORM set_config(
    'wave.opportunity_pause_transition',
    COALESCE(v_previous_transition_flag, ''),
    TRUE
  );

  INSERT INTO public.opportunity_pause_history (
    opportunity_id,
    reason,
    previous_status,
    paused_by
  )
  VALUES (
    v_opportunity.id,
    p_reason,
    v_opportunity.status,
    p_paused_by
  )
  RETURNING id INTO v_pause_id;

  RETURN v_pause_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pause_opportunity_with_reason(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pause_opportunity_with_reason(UUID, TEXT, TEXT)
  TO service_role;

COMMENT ON FUNCTION public.pause_opportunity_with_reason(UUID, TEXT, TEXT) IS
  'W-169 service-only Active-to-Paused transition with one immutable reason record and a statement-scoped internal transition flag.';
