-- W-169: separate permanent opportunity closure, temporary opportunity pause,
-- and one-repreneur pursuit Drop outcomes. Existing closure and pursuit rows
-- are deliberately preserved without backfill or reinterpretation.

CREATE TABLE IF NOT EXISTS public.opportunity_pause_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (reason = 'paused_cabinet'),
  previous_status public.opportunity_status NOT NULL,
  paused_by TEXT NOT NULL CHECK (NULLIF(BTRIM(paused_by), '') IS NOT NULL),
  paused_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE public.opportunity_pause_history IS
  'W-169 append-only staff evidence for a dedicated opportunity pause. Existing pre-W-169 paused rows are not backfilled.';
COMMENT ON COLUMN public.opportunity_pause_history.reason IS
  'Canonical temporary opportunity-pause reason; never an opportunity closure or pursuit Drop reason.';

CREATE INDEX IF NOT EXISTS opportunity_pause_history_opportunity_paused_idx
  ON public.opportunity_pause_history(opportunity_id, paused_at DESC);

CREATE OR REPLACE FUNCTION public.reject_opportunity_pause_history_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'opportunity_pause_history_is_immutable';
END;
$$;

DROP TRIGGER IF EXISTS opportunity_pause_history_immutable
  ON public.opportunity_pause_history;
CREATE TRIGGER opportunity_pause_history_immutable
  BEFORE UPDATE OR DELETE ON public.opportunity_pause_history
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_opportunity_pause_history_mutation();

CREATE OR REPLACE FUNCTION public.guard_opportunity_pause_reason()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'paused'::public.opportunity_status
    AND current_setting('wave.opportunity_pause_transition', TRUE) IS DISTINCT FROM 'on' THEN
    IF TG_OP = 'INSERT'
      OR OLD.status IS DISTINCT FROM 'paused'::public.opportunity_status THEN
      RAISE EXCEPTION 'opportunity_pause_reason_required';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_opportunity_pause_reason ON public.opportunities;
DROP TRIGGER IF EXISTS guard_opportunity_pause_reason_on_insert
  ON public.opportunities;
CREATE TRIGGER guard_opportunity_pause_reason
  BEFORE UPDATE OF status ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_opportunity_pause_reason();
CREATE TRIGGER guard_opportunity_pause_reason_on_insert
  BEFORE INSERT ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_opportunity_pause_reason();

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
  UPDATE public.opportunities
  SET
    status = 'paused'::public.opportunity_status,
    updated_by = p_paused_by
  WHERE id = v_opportunity.id;

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

CREATE OR REPLACE FUNCTION public.close_opportunity_with_reason(
  p_opportunity_id UUID,
  p_reason public.opportunity_closure_reason,
  p_closed_by TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_opportunity_id UUID;
BEGIN
  IF p_closed_by IS NULL OR BTRIM(p_closed_by) = '' THEN
    RAISE EXCEPTION 'closure_actor_required';
  END IF;
  IF p_reason IS NULL OR p_reason::TEXT NOT IN (
    'stale',
    'sold',
    'signed_repreneur',
    'withdrawn_seller',
    'duplicate',
    'dd_disqualified'
  ) THEN
    RAISE EXCEPTION 'opportunity_closure_reason_not_permanent';
  END IF;

  UPDATE public.opportunities
  SET status = 'closed'::public.opportunity_status
  WHERE id = p_opportunity_id
    AND status <> 'closed'::public.opportunity_status
  RETURNING id INTO v_opportunity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'opportunity_not_open_for_closure';
  END IF;

  INSERT INTO public.opportunity_closure_history (
    opportunity_id,
    reason,
    closed_by
  )
  VALUES (
    v_opportunity_id,
    p_reason,
    p_closed_by
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.journey_transition_terminal(
  p_match_id UUID,
  p_transition TEXT,
  p_actor TEXT,
  p_idempotency_key TEXT,
  p_closure_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match public.opportunity_matches%ROWTYPE;
  v_event UUID;
BEGIN
  IF NOT public.wave_journey_is_enabled() THEN
    RAISE EXCEPTION 'wave_journey_disabled';
  END IF;

  SELECT id INTO v_event
  FROM public.opportunity_pursuit_evidence
  WHERE match_id = p_match_id AND idempotency_key = p_idempotency_key;
  IF v_event IS NOT NULL THEN RETURN v_event; END IF;

  SELECT * INTO v_match
  FROM public.opportunity_matches
  WHERE id = p_match_id
  FOR UPDATE;
  IF v_match.id IS NULL THEN RAISE EXCEPTION 'Pursuit not found.'; END IF;

  IF p_transition = 'continue' THEN
    IF v_match.status <> 'active_pursuit'
      OR NOT public.journey_repreneur_can_access_confidential(
        p_match_id,
        v_match.repreneur_id,
        (SELECT information_memo_document_id
         FROM public.opportunity_pursuit_confidential_grants
         WHERE match_id = p_match_id)
      ) THEN
      RAISE EXCEPTION 'Continue requires a live current confidential grant.';
    END IF;
    RETURN public.journey_append_evidence(
      p_match_id,
      'continued',
      p_actor,
      p_idempotency_key
    );
  END IF;

  IF p_transition = 'drop' THEN
    IF NULLIF(BTRIM(p_closure_reason), '') IS NULL THEN
      RAISE EXCEPTION 'pursuit_drop_reason_required';
    END IF;
    IF p_closure_reason NOT IN (
      'no_viable_match',
      'dd_disqualified_repreneur'
    ) THEN
      RAISE EXCEPTION 'pursuit_drop_reason_invalid';
    END IF;
    IF v_match.status <> 'active_pursuit' THEN
      RAISE EXCEPTION 'Only an active pursuit can be dropped.';
    END IF;
    PERFORM public.journey_revoke_confidential_access(
      p_match_id,
      p_actor,
      'dropped',
      p_idempotency_key || ':revoke'
    );
    UPDATE public.opportunity_matches
    SET
      status = 'dropped',
      pursuit_stage = 'dropped',
      pursuit_stage_updated_by = p_actor,
      pursuit_stage_updated_at = NOW()
    WHERE id = p_match_id;
    RETURN public.journey_append_evidence(
      p_match_id,'dropped',p_actor,p_idempotency_key,NULL,NULL,p_closure_reason
    );
  END IF;

  IF p_transition = 'complete' THEN
    IF v_match.status <> 'active_pursuit'
      OR NOT EXISTS (
        SELECT 1
        FROM public.opportunity_pursuit_evidence
        WHERE match_id = p_match_id
          AND event_type = 'continued'
          AND recorded_at >= public.journey_current_cycle_started_at(p_match_id)
      ) THEN
      RAISE EXCEPTION 'Complete requires current continued external follow-up.';
    END IF;
    PERFORM public.journey_revoke_confidential_access(
      p_match_id,
      p_actor,
      'completed',
      p_idempotency_key || ':revoke'
    );
    UPDATE public.opportunity_matches
    SET
      status = 'completed',
      pursuit_stage = 'closed',
      pursuit_stage_updated_by = p_actor,
      pursuit_stage_updated_at = NOW()
    WHERE id = p_match_id;
    PERFORM set_config('wave.journey_terminal_transition', 'on', TRUE);
    UPDATE public.opportunities
    SET status = 'closed', updated_by = p_actor
    WHERE id = v_match.opportunity_id;
    INSERT INTO public.opportunity_closure_history(
      opportunity_id,
      reason,
      closed_by
    ) VALUES (
      v_match.opportunity_id,
      'signed_repreneur'::public.opportunity_closure_reason,
      p_actor
    );
    RETURN public.journey_append_evidence(
      p_match_id,
      'completed',
      p_actor,
      p_idempotency_key,
      NULL,
      NULL,
      p_closure_reason
    );
  END IF;

  IF p_transition = 'reopen' THEN
    IF v_match.status <> 'dropped' THEN
      RAISE EXCEPTION 'Only a dropped pursuit can reopen.';
    END IF;
    UPDATE public.opportunity_matches
    SET
      status = 'interested',
      pursuit_stage = NULL,
      pursuit_stage_notes = NULL,
      pursuit_stage_updated_by = p_actor,
      pursuit_stage_updated_at = NOW()
    WHERE id = p_match_id;
    RETURN public.journey_append_evidence(
      p_match_id,
      'reopened',
      p_actor,
      p_idempotency_key
    );
  END IF;

  RAISE EXCEPTION 'Unsupported pursuit transition.';
END;
$$;

ALTER TABLE public.opportunity_pause_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_pause_history FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.opportunity_pause_history
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.opportunity_pause_history TO service_role;

REVOKE ALL ON FUNCTION public.reject_opportunity_pause_history_mutation()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_opportunity_pause_reason()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pause_opportunity_with_reason(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pause_opportunity_with_reason(UUID, TEXT, TEXT)
  TO service_role;

REVOKE ALL ON FUNCTION public.close_opportunity_with_reason(
  UUID,
  public.opportunity_closure_reason,
  TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_opportunity_with_reason(
  UUID,
  public.opportunity_closure_reason,
  TEXT
) TO service_role;

REVOKE ALL ON FUNCTION public.journey_transition_terminal(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.journey_transition_terminal(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT
) TO service_role;

COMMENT ON FUNCTION public.pause_opportunity_with_reason(UUID, TEXT, TEXT) IS
  'W-169 service-only transition from Active to Paused with one immutable Paused by cabinet record.';
COMMENT ON FUNCTION public.close_opportunity_with_reason(
  UUID,
  public.opportunity_closure_reason,
  TEXT
) IS
  'W-169 service-only permanent opportunity closure; temporary and pursuit-specific reasons are rejected.';
COMMENT ON FUNCTION public.journey_transition_terminal(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT
) IS
  'Canonical pursuit terminal transition. W-169 requires and retains one exact reason for each future Drop.';
