-- Product Change #251 / Ticket #252. Additive staff outcome contract.
-- Existing immutable histories are retained; no reason remapping occurs.

CREATE OR REPLACE FUNCTION public.require_staff_outcome_actor(p_actor TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NULLIF(BTRIM(p_actor),'') IS NULL OR (
    SELECT COUNT(*) FROM public.app_user_roles r WHERE r.role='staff'
      AND (r.user_id=p_actor OR LOWER(BTRIM(r.email))=LOWER(BTRIM(p_actor))
        OR EXISTS(SELECT 1 FROM public."user" account WHERE account.id=p_actor
          AND LOWER(BTRIM(account.email))=LOWER(BTRIM(r.email))))
  )<>1 THEN RAISE EXCEPTION 'staff_outcome_actor_required'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.validate_pursuit_drop_explanation(p_primary TEXT, p_secondary TEXT[], p_note TEXT)
RETURNS JSONB LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE catalogue TEXT[] := ARRAY[
  'customer_concentration','owner_family_dependency','no_management_team','lack_recurring_revenue','low_barriers_to_entry','declining_market','deteriorating_performance',
  'insufficient_profitability','unconvincing_ebitda_adjustments','below_buyer_size_criteria','seller_price_expectations_too_high','distressed_financial_position','financing_not_secured',
  'outside_investment_thesis','no_value_creation_angle','location_incompatible',
  'carve_out_risk','assets_premises_not_secured','business_plan_not_credible','quality_hr_red_flags','issues_in_due_diligence','deal_terms_disagreement',
  'deprioritized_another_deal','buyer_search_paused','no_response_buyer','path_stopped_seller_advisor','buyer_rejected_seller','reason_not_disclosed','other'
]; note TEXT := NULLIF(BTRIM(p_note),'');
BEGIN
  IF p_primary IS NULL OR NOT (p_primary=ANY(catalogue)) THEN RAISE EXCEPTION 'pursuit_drop_reason_invalid'; END IF;
  IF p_secondary IS NULL OR EXISTS(SELECT 1 FROM unnest(p_secondary) reason WHERE reason IS NULL OR NOT(reason=ANY(catalogue)) OR reason=p_primary)
    OR cardinality(p_secondary) <> (SELECT COUNT(DISTINCT reason) FROM unnest(p_secondary) reason) THEN RAISE EXCEPTION 'pursuit_drop_secondary_reasons_invalid'; END IF;
  IF (p_primary='reason_not_disclosed' AND cardinality(p_secondary)>0) OR 'reason_not_disclosed'=ANY(p_secondary) THEN RAISE EXCEPTION 'pursuit_drop_reason_not_disclosed_exclusive'; END IF;
  IF (p_primary='other' OR 'other'=ANY(p_secondary)) AND note IS NULL THEN RAISE EXCEPTION 'pursuit_drop_other_explanation_required'; END IF;
  IF length(note)>4000 THEN RAISE EXCEPTION 'outcome_note_too_long'; END IF;
  RETURN jsonb_build_object('secondary_reasons',to_jsonb(p_secondary),'reason_note',note);
END $$;

CREATE OR REPLACE FUNCTION public.journey_transition_terminal(
  p_match_id UUID,
  p_transition TEXT,
  p_actor TEXT,
  p_idempotency_key TEXT,
  p_closure_reason TEXT,
  p_secondary_reasons TEXT[],
  p_reason_note TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match public.opportunity_matches%ROWTYPE;
  v_event UUID;
  v_saved public.opportunity_pursuit_evidence%ROWTYPE;
  v_metadata JSONB;
  v_drop_flag TEXT := current_setting('wave.pursuit_drop_transition', TRUE);
BEGIN
  PERFORM public.require_staff_outcome_actor(p_actor);
  IF NULLIF(BTRIM(p_idempotency_key), '') IS NULL THEN RAISE EXCEPTION 'outcome_operation_key_required'; END IF;
  IF p_transition = 'drop' THEN v_metadata := public.validate_pursuit_drop_explanation(p_closure_reason,p_secondary_reasons,p_reason_note); END IF;
  IF NOT public.wave_journey_is_enabled() THEN
    RAISE EXCEPTION 'wave_journey_disabled';
  END IF;

  -- Serialize decisions without blocking Pause's unchanged match FK when it
  -- appends access-revocation evidence while holding the opportunity fence.
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id = p_match_id FOR NO KEY UPDATE;
  IF v_match.id IS NULL THEN RAISE EXCEPTION 'Pursuit not found.'; END IF;
  -- Fence lifecycle before acquiring a grant row. Pause also owns opportunity
  -- then grant; reversing these two locks can deadlock concurrent Drop/Pause.
  PERFORM 1 FROM public.opportunities WHERE id=v_match.opportunity_id FOR UPDATE;
  SELECT * INTO v_saved FROM public.opportunity_pursuit_evidence WHERE match_id = p_match_id AND idempotency_key = p_idempotency_key;
  IF v_saved.id IS NOT NULL THEN
    IF v_saved.actor IS DISTINCT FROM p_actor OR v_saved.event_type::text IS DISTINCT FROM (CASE p_transition WHEN 'drop' THEN 'dropped' WHEN 'continue' THEN 'continued' WHEN 'complete' THEN 'completed' WHEN 'reopen' THEN 'reopened' ELSE '' END)
      OR (p_transition = 'drop' AND (v_saved.evidence_reference IS DISTINCT FROM p_closure_reason OR COALESCE(v_saved.metadata->'secondary_reasons','[]'::jsonb) IS DISTINCT FROM v_metadata->'secondary_reasons' OR v_saved.metadata->>'reason_note' IS DISTINCT FROM v_metadata->>'reason_note')) THEN
      RAISE EXCEPTION 'outcome_replay_payload_changed';
    END IF;
    RETURN v_saved.id;
  END IF;

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
    IF v_match.status <> 'active_pursuit' THEN
      RAISE EXCEPTION 'Only an active pursuit can be dropped.';
    END IF;
    PERFORM set_config('wave.pursuit_drop_transition', p_match_id::text || ':' || p_idempotency_key, TRUE);
    BEGIN
      PERFORM public.journey_revoke_confidential_access(p_match_id,p_actor,'dropped',p_idempotency_key || ':revoke');
      UPDATE public.opportunity_matches SET status='dropped',pursuit_stage='dropped',pursuit_stage_updated_by=p_actor,pursuit_stage_updated_at=clock_timestamp() WHERE id=p_match_id;
      v_event := public.journey_append_evidence(p_match_id,'dropped',p_actor,p_idempotency_key,NULL,NULL,p_closure_reason,v_metadata);
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('wave.pursuit_drop_transition',COALESCE(v_drop_flag,''),TRUE);
      RAISE;
    END;
    PERFORM set_config('wave.pursuit_drop_transition',COALESCE(v_drop_flag,''),TRUE);
    RETURN v_event;
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
    PERFORM public.close_opportunity_with_reason(v_match.opportunity_id,'signed_repreneur'::public.opportunity_closure_reason,p_actor);
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

-- Retain the original signature for existing non-Drop callers; no overload has
-- overlapping defaults. Old Drop keys now pass the new guarded catalogue.
CREATE OR REPLACE FUNCTION public.journey_transition_terminal(p_match_id UUID,p_transition TEXT,p_actor TEXT,p_idempotency_key TEXT,p_closure_reason TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT public.journey_transition_terminal(p_match_id,p_transition,p_actor,p_idempotency_key,p_closure_reason,ARRAY[]::text[],NULL::text)
$$;

CREATE OR REPLACE FUNCTION public.guard_reasoned_pursuit_drop()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status='dropped' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
    AND COALESCE(current_setting('wave.pursuit_drop_transition',TRUE),'') NOT LIKE NEW.id::text || ':%' THEN
    RAISE EXCEPTION 'pursuit_drop_requires_reasoned_transition';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_reasoned_pursuit_drop BEFORE INSERT OR UPDATE OF status ON public.opportunity_matches FOR EACH ROW EXECUTE FUNCTION public.guard_reasoned_pursuit_drop();

CREATE OR REPLACE FUNCTION public.guard_reasoned_drop_evidence()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE reasons TEXT[];
BEGIN
  IF NEW.event_type='dropped' THEN
    IF current_setting('wave.pursuit_drop_transition',TRUE) IS DISTINCT FROM NEW.match_id::text || ':' || NEW.idempotency_key THEN RAISE EXCEPTION 'drop_evidence_requires_reasoned_transition'; END IF;
    IF jsonb_typeof(NEW.metadata->'secondary_reasons') IS DISTINCT FROM 'array' OR (NEW.metadata ? 'reason_note' AND jsonb_typeof(NEW.metadata->'reason_note') NOT IN ('string','null')) THEN RAISE EXCEPTION 'drop_explanation_metadata_invalid'; END IF;
    SELECT ARRAY(SELECT jsonb_array_elements_text(NEW.metadata->'secondary_reasons')) INTO reasons;
    PERFORM public.validate_pursuit_drop_explanation(NEW.evidence_reference,reasons,NEW.metadata->>'reason_note');
    PERFORM public.require_staff_outcome_actor(NEW.actor);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_reasoned_drop_evidence BEFORE INSERT ON public.opportunity_pursuit_evidence FOR EACH ROW EXECUTE FUNCTION public.guard_reasoned_drop_evidence();

REVOKE ALL ON FUNCTION public.require_staff_outcome_actor(TEXT), public.validate_pursuit_drop_explanation(TEXT,TEXT[],TEXT), public.guard_reasoned_pursuit_drop(), public.guard_reasoned_drop_evidence() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.require_staff_outcome_actor(TEXT),public.validate_pursuit_drop_explanation(TEXT,TEXT[],TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.journey_transition_terminal(UUID,TEXT,TEXT,TEXT,TEXT,TEXT[],TEXT),public.journey_transition_terminal(UUID,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.journey_transition_terminal(UUID,TEXT,TEXT,TEXT,TEXT,TEXT[],TEXT),public.journey_transition_terminal(UUID,TEXT,TEXT,TEXT,TEXT) TO service_role;

ALTER TABLE public.opportunity_pause_history ADD COLUMN reason_note TEXT;
ALTER TABLE public.opportunity_pause_history DROP CONSTRAINT opportunity_pause_history_reason_check;
ALTER TABLE public.opportunity_pause_history ADD CONSTRAINT opportunity_pause_history_reason_check CHECK (reason IN ('paused_cabinet','seller_paused_sale','exclusivity_another_buyer','waiting_updated_information','other'));
ALTER TABLE public.opportunity_pause_history ADD CONSTRAINT opportunity_pause_history_note_check CHECK ((reason<>'other' OR NULLIF(BTRIM(reason_note),'') IS NOT NULL) AND (reason_note IS NULL OR length(reason_note)<=4000));
CREATE OR REPLACE FUNCTION public.pause_opportunity_with_reason(
  p_opportunity_id UUID,
  p_reason TEXT,
  p_paused_by TEXT,
  p_reason_note TEXT
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
  PERFORM public.require_staff_outcome_actor(p_paused_by);
  IF NULLIF(BTRIM(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'opportunity_pause_reason_required';
  END IF;
  IF p_reason NOT IN ('paused_cabinet','seller_paused_sale','exclusivity_another_buyer','waiting_updated_information','other') THEN
    RAISE EXCEPTION 'opportunity_pause_reason_invalid';
  END IF;

  IF p_reason='other' AND NULLIF(BTRIM(p_reason_note),'') IS NULL THEN RAISE EXCEPTION 'opportunity_pause_other_explanation_required'; END IF;
  IF length(p_reason_note)>4000 THEN RAISE EXCEPTION 'outcome_note_too_long'; END IF;

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
    paused_by,
    reason_note
  )
  VALUES (
    v_opportunity.id,
    p_reason,
    v_opportunity.status,
    p_paused_by,
    NULLIF(BTRIM(p_reason_note),'')
  )
  RETURNING id INTO v_pause_id;

  RETURN v_pause_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.pause_opportunity_with_reason(p_opportunity_id UUID,p_reason TEXT,p_paused_by TEXT)
RETURNS UUID LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
 SELECT public.pause_opportunity_with_reason(p_opportunity_id,p_reason,p_paused_by,NULL::text)
$$;
REVOKE ALL ON FUNCTION public.pause_opportunity_with_reason(UUID,TEXT,TEXT,TEXT),public.pause_opportunity_with_reason(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pause_opportunity_with_reason(UUID,TEXT,TEXT,TEXT),public.pause_opportunity_with_reason(UUID,TEXT,TEXT) TO service_role;
COMMENT ON COLUMN public.opportunity_pause_history.reason_note IS 'Staff-only context; mandatory for Other, retained with the immutable pause event.';

-- A source date, current emptiness and updated_at cannot establish a complete
-- historical Active interval. Existing inventory starts at actual activation.
CREATE TABLE public.opportunity_stale_policy (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK(singleton),
  effective_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO public.opportunity_stale_policy(singleton) VALUES(TRUE);
ALTER TABLE public.opportunity_stale_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_stale_policy FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.opportunity_stale_policy FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.opportunity_stale_policy TO service_role;
CREATE OR REPLACE FUNCTION public.reject_opportunity_stale_policy_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'opportunity_stale_policy_is_immutable'; END $$;
REVOKE ALL ON FUNCTION public.reject_opportunity_stale_policy_mutation() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER opportunity_stale_policy_immutable BEFORE UPDATE OR DELETE ON public.opportunity_stale_policy FOR EACH ROW EXECUTE FUNCTION public.reject_opportunity_stale_policy_mutation();

ALTER TABLE public.opportunities ADD COLUMN stale_clock_started_at TIMESTAMPTZ;
ALTER TABLE public.opportunities ADD COLUMN stale_clock_basis TEXT CHECK(stale_clock_basis IN ('policy_activation','became_active','pursuit_ended'));
ALTER TABLE public.opportunities ADD CONSTRAINT opportunity_stale_clock_pair CHECK ((stale_clock_started_at IS NULL)=(stale_clock_basis IS NULL));
UPDATE public.opportunities o SET stale_clock_started_at=p.effective_at,stale_clock_basis='policy_activation'
FROM public.opportunity_stale_policy p WHERE o.status='active' AND NOT EXISTS(SELECT 1 FROM public.opportunity_matches m WHERE m.opportunity_id=o.id AND m.status='active_pursuit');

CREATE OR REPLACE FUNCTION public.guard_opportunity_stale_clock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP='UPDATE' AND (NEW.stale_clock_started_at IS DISTINCT FROM OLD.stale_clock_started_at OR NEW.stale_clock_basis IS DISTINCT FROM OLD.stale_clock_basis) AND pg_trigger_depth()=1 THEN
    RAISE EXCEPTION 'opportunity_stale_clock_has_no_manual_refresh';
  END IF;
  IF TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.stale_clock_started_at:=NULL; NEW.stale_clock_basis:=NULL;
    IF NEW.status='active' AND NOT EXISTS(SELECT 1 FROM public.opportunity_matches m WHERE m.opportunity_id=NEW.id AND m.status='active_pursuit') THEN
      NEW.stale_clock_started_at:=clock_timestamp(); NEW.stale_clock_basis:='became_active';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_opportunity_stale_clock BEFORE INSERT OR UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.guard_opportunity_stale_clock();

-- Match writers already hold the match before the opportunity. Close only
-- locks the opportunity, never waits for a match row, and rechecks eligibility.
CREATE OR REPLACE FUNCTION public.lock_pursuit_opportunity_for_stale()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE old_id UUID; new_id UUID;
BEGIN
  IF TG_OP='UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.opportunity_id=OLD.opportunity_id THEN RETURN NEW; END IF;
  IF TG_OP<>'INSERT' THEN old_id:=OLD.opportunity_id; END IF;
  IF TG_OP<>'DELETE' THEN new_id:=NEW.opportunity_id; END IF;
  PERFORM 1 FROM public.opportunities WHERE id IN (old_id,new_id) ORDER BY id FOR UPDATE;
  IF TG_OP<>'DELETE' AND NEW.status='active_pursuit' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status OR OLD.opportunity_id IS DISTINCT FROM NEW.opportunity_id)
    AND NOT EXISTS(SELECT 1 FROM public.opportunities WHERE id=NEW.opportunity_id AND status='active') THEN
    RAISE EXCEPTION 'active_pursuit_requires_active_opportunity';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER lock_pursuit_opportunity_for_stale BEFORE INSERT OR UPDATE OF status,opportunity_id OR DELETE ON public.opportunity_matches FOR EACH ROW EXECUTE FUNCTION public.lock_pursuit_opportunity_for_stale();

CREATE OR REPLACE FUNCTION public.update_opportunity_stale_clock_from_pursuit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE affected UUID; old_id UUID; new_id UUID; old_active BOOLEAN:=FALSE; new_active BOOLEAN:=FALSE; clock_start TIMESTAMPTZ; basis TEXT;
BEGIN
  IF TG_OP<>'INSERT' THEN old_id:=OLD.opportunity_id; old_active:=OLD.status='active_pursuit'; END IF;
  IF TG_OP<>'DELETE' THEN new_id:=NEW.opportunity_id; new_active:=NEW.status='active_pursuit'; END IF;
  IF NOT old_active AND NOT new_active THEN RETURN NULL; END IF;
  IF old_id IS NOT DISTINCT FROM new_id AND old_active=new_active THEN RETURN NULL; END IF;
  FOR affected IN SELECT DISTINCT id FROM unnest(ARRAY[old_id,new_id]) id WHERE id IS NOT NULL LOOP
    clock_start:=NULL; basis:=NULL;
    IF EXISTS(SELECT 1 FROM public.opportunities WHERE id=affected AND status='active') AND NOT EXISTS(SELECT 1 FROM public.opportunity_matches WHERE opportunity_id=affected AND status='active_pursuit') THEN
      clock_start:=clock_timestamp(); basis:='pursuit_ended';
    END IF;
    UPDATE public.opportunities SET stale_clock_started_at=clock_start,stale_clock_basis=basis WHERE id=affected AND (stale_clock_started_at IS DISTINCT FROM clock_start OR stale_clock_basis IS DISTINCT FROM basis);
  END LOOP;
  RETURN NULL;
END $$;
CREATE TRIGGER update_opportunity_stale_clock_from_pursuit AFTER INSERT OR UPDATE OF status,opportunity_id OR DELETE ON public.opportunity_matches FOR EACH ROW EXECUTE FUNCTION public.update_opportunity_stale_clock_from_pursuit();

CREATE OR REPLACE FUNCTION public.opportunity_stale_closure_eligibility(p_opportunity_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE o public.opportunities%ROWTYPE; eligible_at TIMESTAMPTZ; active_pursuit BOOLEAN; elapsed INTEGER;
BEGIN
  SELECT * INTO o FROM public.opportunities WHERE id=p_opportunity_id;
  IF o.id IS NULL THEN RAISE EXCEPTION 'opportunity_not_found'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.opportunity_matches WHERE opportunity_id=o.id AND status='active_pursuit') INTO active_pursuit;
  eligible_at:=o.stale_clock_started_at + INTERVAL '2160 hours';
  elapsed:=GREATEST(0,FLOOR(EXTRACT(EPOCH FROM clock_timestamp()-o.stale_clock_started_at)/86400)::integer);
  RETURN jsonb_build_object('eligible',o.status='active' AND NOT active_pursuit AND eligible_at IS NOT NULL AND clock_timestamp()>=eligible_at,
    'startedAt',o.stale_clock_started_at,'eligibleAt',eligible_at,'completedDays',CASE WHEN o.stale_clock_started_at IS NULL THEN 0 ELSE elapsed END,'basis',o.stale_clock_basis,
    'message',CASE WHEN o.status<>'active' THEN 'Stale requires an Active opportunity.' WHEN active_pursuit THEN 'An active pursuit interrupts the 90-day count.'
      WHEN eligible_at IS NULL THEN 'No verified start of the 90-day count is available.' WHEN clock_timestamp()<eligible_at THEN 'Stale requires 90 consecutive Active days without an active pursuit.'
      ELSE 'Staff may choose Stale closure. The opportunity stays Active until explicitly closed.' END);
END $$;

CREATE OR REPLACE FUNCTION public.close_opportunity_with_reason(p_opportunity_id UUID,p_reason public.opportunity_closure_reason,p_closed_by TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE o public.opportunities%ROWTYPE; previous_flag TEXT:=current_setting('wave.opportunity_close_transition',TRUE);
BEGIN
  PERFORM public.require_staff_outcome_actor(p_closed_by);
  IF p_reason IS NULL OR p_reason::text NOT IN ('stale','sold','signed_repreneur','withdrawn_seller','duplicate','dd_disqualified') THEN RAISE EXCEPTION 'opportunity_closure_reason_not_permanent'; END IF;
  SELECT * INTO o FROM public.opportunities WHERE id=p_opportunity_id FOR UPDATE;
  IF o.id IS NULL OR o.status='closed' THEN RAISE EXCEPTION 'opportunity_not_open_for_closure'; END IF;
  IF p_reason='stale' AND NOT COALESCE((public.opportunity_stale_closure_eligibility(o.id)->>'eligible')::boolean,FALSE) THEN RAISE EXCEPTION 'opportunity_stale_not_eligible'; END IF;
  PERFORM set_config('wave.opportunity_close_transition',o.id::text || ':' || p_reason::text,TRUE);
  BEGIN
    UPDATE public.opportunities SET status='closed',updated_by=p_closed_by WHERE id=o.id;
    INSERT INTO public.opportunity_closure_history(opportunity_id,reason,closed_by) VALUES(o.id,p_reason,p_closed_by);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('wave.opportunity_close_transition',COALESCE(previous_flag,''),TRUE); RAISE;
  END;
  PERFORM set_config('wave.opportunity_close_transition',COALESCE(previous_flag,''),TRUE);
END $$;

CREATE OR REPLACE FUNCTION public.guard_reasoned_opportunity_close()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status='closed' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) AND COALESCE(current_setting('wave.opportunity_close_transition',TRUE),'') NOT LIKE NEW.id::text || ':%' THEN RAISE EXCEPTION 'opportunity_close_requires_reasoned_transition'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_reasoned_opportunity_close BEFORE INSERT OR UPDATE OF status ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.guard_reasoned_opportunity_close();

CREATE OR REPLACE FUNCTION public.guard_reasoned_closure_history()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.reason::text NOT IN ('stale','sold','signed_repreneur','withdrawn_seller','duplicate','dd_disqualified') OR current_setting('wave.opportunity_close_transition',TRUE) IS DISTINCT FROM NEW.opportunity_id::text || ':' || NEW.reason::text THEN RAISE EXCEPTION 'closure_evidence_requires_reasoned_transition'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_reasoned_closure_history BEFORE INSERT ON public.opportunity_closure_history FOR EACH ROW EXECUTE FUNCTION public.guard_reasoned_closure_history();

REVOKE ALL ON FUNCTION public.guard_opportunity_stale_clock(),public.lock_pursuit_opportunity_for_stale(),public.update_opportunity_stale_clock_from_pursuit(),public.guard_reasoned_opportunity_close(),public.guard_reasoned_closure_history(),public.opportunity_stale_closure_eligibility(UUID),public.close_opportunity_with_reason(UUID,public.opportunity_closure_reason,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.opportunity_stale_closure_eligibility(UUID),public.close_opportunity_with_reason(UUID,public.opportunity_closure_reason,TEXT) TO service_role;
COMMENT ON COLUMN public.opportunities.stale_clock_started_at IS 'Staff-only DB-managed consecutive Active/no-active-pursuit start; no manual refresh, source-confirmation reset or inferred legacy age.';
COMMENT ON COLUMN public.opportunities.stale_clock_basis IS 'Policy activation for unproved legacy intervals, actual Active transition, or end of the last active pursuit.';
