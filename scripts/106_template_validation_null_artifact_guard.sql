-- A partially completed staff action must not turn two NULL values (no
-- selected artifact and no current blank template) into a valid validation.
-- This forward migration repairs production installations that already ran
-- migration 088.

CREATE OR REPLACE FUNCTION public.journey_record_evidence(
  p_match_id UUID, p_event_type TEXT, p_actor TEXT, p_idempotency_key TEXT,
  p_artifact_id UUID DEFAULT NULL, p_document_id UUID DEFAULT NULL, p_evidence_reference TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_type public.opportunity_pursuit_evidence_type:=p_event_type::public.opportunity_pursuit_evidence_type;
  v_match public.opportunity_matches%ROWTYPE; v_cycle UUID; v_start TIMESTAMPTZ; v_template UUID;
  v_artifact public.opportunity_nda_artifacts%ROWTYPE; v_gate1 UUID; v_renew_validation UUID; v_repreneur_validation UUID;
  v_gate2 UUID; v_existing UUID; v_metadata JSONB:='{}'::JSONB;
BEGIN
  IF NOT public.wave_journey_is_enabled() THEN RAISE EXCEPTION 'wave_journey_disabled'; END IF;
  SELECT id INTO v_existing FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND idempotency_key=p_idempotency_key;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE;
  IF v_match.id IS NULL OR v_match.status<>'active_pursuit' THEN RAISE EXCEPTION 'An active pursuit is required.'; END IF;
  v_cycle:=public.journey_current_cycle_event(p_match_id); v_start:=public.journey_current_cycle_started_at(p_match_id);
  IF v_cycle IS NULL THEN RAISE EXCEPTION 'Recorded mutual interest is required.'; END IF;
  IF v_type='qualification_requested' THEN NULL;
  ELSIF v_type='intermediary_qualified' THEN
    IF NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND event_type='qualification_requested' AND recorded_at>=v_start) THEN RAISE EXCEPTION 'Intermediary qualification requires this cycle qualification request.'; END IF;
  ELSIF v_type='template_validated' THEN
    v_template:=public.journey_current_template_id(p_match_id);
    IF p_artifact_id IS NULL OR v_template IS NULL OR p_artifact_id IS DISTINCT FROM v_template OR NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND event_type='intermediary_qualified' AND recorded_at>=v_start) THEN RAISE EXCEPTION 'Template validation requires current-cycle qualification and the exact current blank template.'; END IF;
  ELSIF v_type='gate_1_passed' THEN
    IF public.journey_current_gate_1_event(p_match_id) IS NOT NULL THEN RAISE EXCEPTION 'Current Gate 1 is already recorded.'; END IF;
    v_template:=public.journey_current_template_id(p_match_id);
    IF v_template IS NULL OR NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND event_type='template_validated' AND nda_artifact_id=v_template AND recorded_at>=v_start) THEN RAISE EXCEPTION 'Gate 1 requires this cycle qualification and exact current-template validation.'; END IF;
  ELSIF v_type IN ('renew_signed_copy_validated','repreneur_signed_copy_validated') THEN
    v_gate1:=public.journey_current_gate_1_event(p_match_id);
    SELECT * INTO v_artifact FROM public.opportunity_nda_artifacts WHERE id=p_artifact_id;
    IF v_gate1 IS NULL OR v_artifact.id IS NULL OR v_artifact.match_id<>p_match_id
      OR v_artifact.artifact_role <> (CASE WHEN v_type='renew_signed_copy_validated' THEN 'renew_signed_copy'::public.opportunity_nda_artifact_role ELSE 'repreneur_signed_copy'::public.opportunity_nda_artifact_role END)
      OR EXISTS(SELECT 1 FROM public.opportunity_nda_artifacts n WHERE n.match_id=p_match_id AND n.artifact_role=v_artifact.artifact_role AND n.version_number>v_artifact.version_number)
      OR v_artifact.recorded_at < (SELECT recorded_at FROM public.opportunity_pursuit_evidence WHERE id=v_gate1)
    THEN RAISE EXCEPTION 'Validation requires the exact current signed copy uploaded after current Gate 1.'; END IF;
  ELSIF v_type='gate_2_passed' THEN
    v_renew_validation:=public.journey_current_signed_validation_event(p_match_id,'renew_signed_copy'); v_repreneur_validation:=public.journey_current_signed_validation_event(p_match_id,'repreneur_signed_copy');
    IF v_renew_validation IS NULL OR v_repreneur_validation IS NULL THEN RAISE EXCEPTION 'Gate 2 requires current signed copies validated after Gate 1.'; END IF;
    v_metadata:=jsonb_build_object('renew_validation_id',v_renew_validation,'repreneur_validation_id',v_repreneur_validation,'renew_artifact_id',(SELECT nda_artifact_id FROM public.opportunity_pursuit_evidence WHERE id=v_renew_validation),'repreneur_artifact_id',(SELECT nda_artifact_id FROM public.opportunity_pursuit_evidence WHERE id=v_repreneur_validation));
  ELSIF v_type='manual_package_dispatched' THEN
    v_gate2:=public.journey_current_gate_2_event(p_match_id);
    IF v_gate2 IS NULL THEN RAISE EXCEPTION 'Manual dispatch requires exact current Gate 2.'; END IF;
    v_metadata:=jsonb_build_object('gate_2_evidence_id',v_gate2,'renew_artifact_id',(SELECT metadata->>'renew_artifact_id' FROM public.opportunity_pursuit_evidence WHERE id=v_gate2),'repreneur_artifact_id',(SELECT metadata->>'repreneur_artifact_id' FROM public.opportunity_pursuit_evidence WHERE id=v_gate2));
  ELSE RAISE EXCEPTION 'This evidence type is not a staff journey action.';
  END IF;
  RETURN public.journey_append_evidence(p_match_id,v_type,p_actor,p_idempotency_key,p_artifact_id,p_document_id,p_evidence_reference,v_metadata);
END $$;
