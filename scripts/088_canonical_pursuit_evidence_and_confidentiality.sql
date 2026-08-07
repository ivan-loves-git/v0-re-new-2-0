-- W-090/W-091: canonical, fail-closed pursuit evidence and confidential access.
-- Legacy pursuit stages, NDA fields and document visibility are compatibility
-- history only. They are deliberately not backfilled into this ledger.

ALTER TYPE public.opportunity_match_status ADD VALUE IF NOT EXISTS 'completed';

DO $$
BEGIN
  CREATE TYPE public.opportunity_pursuit_evidence_type AS ENUM (
    'mutual_interest_validated', 'qualification_requested',
    'intermediary_qualified', 'template_validated', 'gate_1_passed',
    'renew_signed_copy_validated', 'repreneur_signed_copy_validated',
    'gate_2_passed', 'manual_package_dispatched', 'confidential_access_granted',
    'access_revoked', 'continued', 'dropped', 'reopened', 'completed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.wave_journey_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);
INSERT INTO public.wave_journey_settings (singleton, enabled)
VALUES (TRUE, FALSE) ON CONFLICT (singleton) DO NOTHING;
ALTER TABLE public.wave_journey_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wave_journey_settings FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.wave_journey_settings FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, UPDATE ON public.wave_journey_settings TO service_role;

CREATE TABLE IF NOT EXISTS public.opportunity_pursuit_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.opportunity_matches(id) ON DELETE RESTRICT,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  repreneur_id UUID NOT NULL REFERENCES public.repreneurs(id) ON DELETE RESTRICT,
  event_type public.opportunity_pursuit_evidence_type NOT NULL,
  actor TEXT NOT NULL CHECK (NULLIF(BTRIM(actor), '') IS NOT NULL),
  evidence_reference TEXT,
  nda_artifact_id UUID REFERENCES public.opportunity_nda_artifacts(id) ON DELETE RESTRICT,
  document_id UUID REFERENCES public.opportunity_documents(id) ON DELETE RESTRICT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(metadata) = 'object'),
  idempotency_key TEXT NOT NULL CHECK (NULLIF(BTRIM(idempotency_key), '') IS NOT NULL),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS opportunity_pursuit_evidence_match_recorded_idx
  ON public.opportunity_pursuit_evidence (match_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS opportunity_pursuit_evidence_type_idx
  ON public.opportunity_pursuit_evidence (match_id, event_type, recorded_at DESC);
ALTER TABLE public.opportunity_pursuit_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_pursuit_evidence FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.opportunity_pursuit_evidence FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.opportunity_pursuit_evidence TO service_role;

CREATE TABLE IF NOT EXISTS public.opportunity_pursuit_confidential_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL UNIQUE REFERENCES public.opportunity_matches(id) ON DELETE RESTRICT,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  information_memo_document_id UUID NOT NULL REFERENCES public.opportunity_documents(id) ON DELETE RESTRICT,
  source_disclosed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by TEXT NOT NULL CHECK (NULLIF(BTRIM(granted_by), '') IS NOT NULL),
  revoked_at TIMESTAMPTZ,
  revoked_by TEXT,
  revoked_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((revoked_at IS NULL AND revoked_by IS NULL AND revoked_reason IS NULL)
    OR (revoked_at IS NOT NULL AND NULLIF(BTRIM(revoked_by), '') IS NOT NULL))
);
ALTER TABLE public.opportunity_pursuit_confidential_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_pursuit_confidential_grants FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.opportunity_pursuit_confidential_grants FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.opportunity_pursuit_confidential_grants TO service_role;

CREATE OR REPLACE FUNCTION public.wave_journey_is_enabled()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE((SELECT enabled FROM public.wave_journey_settings WHERE singleton), FALSE)
$$;

CREATE OR REPLACE FUNCTION public.reject_opportunity_pursuit_evidence_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Canonical pursuit evidence is append-only.'; END; $$;
DROP TRIGGER IF EXISTS opportunity_pursuit_evidence_immutable ON public.opportunity_pursuit_evidence;
CREATE TRIGGER opportunity_pursuit_evidence_immutable BEFORE UPDATE OR DELETE
ON public.opportunity_pursuit_evidence FOR EACH ROW EXECUTE FUNCTION public.reject_opportunity_pursuit_evidence_mutation();

CREATE OR REPLACE FUNCTION public.assert_opportunity_pursuit_evidence_integrity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE; v_artifact public.opportunity_nda_artifacts%ROWTYPE; v_doc public.opportunity_documents%ROWTYPE;
BEGIN
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id = NEW.match_id;
  IF v_match.id IS NULL OR v_match.opportunity_id <> NEW.opportunity_id OR v_match.repreneur_id <> NEW.repreneur_id THEN
    RAISE EXCEPTION 'Pursuit evidence must retain the exact match, opportunity and repreneur.';
  END IF;
  IF NEW.nda_artifact_id IS NOT NULL THEN
    SELECT * INTO v_artifact FROM public.opportunity_nda_artifacts WHERE id = NEW.nda_artifact_id;
    IF v_artifact.id IS NULL OR v_artifact.opportunity_id <> NEW.opportunity_id
      OR (v_artifact.match_id IS NOT NULL AND v_artifact.match_id <> NEW.match_id) THEN
      RAISE EXCEPTION 'Evidence artifact must belong to this opportunity and pursuit.';
    END IF;
  END IF;
  IF NEW.document_id IS NOT NULL THEN
    SELECT * INTO v_doc FROM public.opportunity_documents WHERE id = NEW.document_id;
    IF v_doc.id IS NULL OR v_doc.opportunity_id <> NEW.opportunity_id THEN
      RAISE EXCEPTION 'Evidence document must belong to this opportunity.';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS opportunity_pursuit_evidence_integrity ON public.opportunity_pursuit_evidence;
CREATE TRIGGER opportunity_pursuit_evidence_integrity BEFORE INSERT ON public.opportunity_pursuit_evidence
FOR EACH ROW EXECUTE FUNCTION public.assert_opportunity_pursuit_evidence_integrity();

CREATE OR REPLACE FUNCTION public.journey_append_evidence(
  p_match_id UUID, p_event_type public.opportunity_pursuit_evidence_type, p_actor TEXT,
  p_idempotency_key TEXT, p_artifact_id UUID DEFAULT NULL, p_document_id UUID DEFAULT NULL,
  p_evidence_reference TEXT DEFAULT NULL, p_metadata JSONB DEFAULT '{}'::JSONB
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE; v_id UUID;
BEGIN
  IF NOT public.wave_journey_is_enabled() THEN RAISE EXCEPTION 'wave_journey_disabled'; END IF;
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id = p_match_id FOR UPDATE;
  IF v_match.id IS NULL THEN RAISE EXCEPTION 'Pursuit not found.'; END IF;
  INSERT INTO public.opportunity_pursuit_evidence (
    match_id, opportunity_id, repreneur_id, event_type, actor, idempotency_key,
    nda_artifact_id, document_id, evidence_reference, metadata
  ) VALUES (
    v_match.id, v_match.opportunity_id, v_match.repreneur_id, p_event_type, p_actor,
    p_idempotency_key, p_artifact_id, p_document_id, p_evidence_reference, COALESCE(p_metadata, '{}'::JSONB)
  ) ON CONFLICT (match_id, idempotency_key) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.opportunity_pursuit_evidence
    WHERE match_id = p_match_id AND idempotency_key = p_idempotency_key;
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.journey_current_artifact_is_valid(
  p_match_id UUID, p_role public.opportunity_nda_artifact_role
) RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH current_artifact AS (
    SELECT a.id FROM public.opportunity_nda_artifacts a
    WHERE a.match_id = p_match_id AND a.artifact_role = p_role
    ORDER BY a.version_number DESC LIMIT 1
  ) SELECT EXISTS (
    SELECT 1 FROM current_artifact a
    JOIN public.opportunity_pursuit_evidence e ON e.nda_artifact_id = a.id
    WHERE e.match_id = p_match_id
      AND e.event_type = CASE p_role
        WHEN 'renew_signed_copy' THEN 'renew_signed_copy_validated'::public.opportunity_pursuit_evidence_type
        WHEN 'repreneur_signed_copy' THEN 'repreneur_signed_copy_validated'::public.opportunity_pursuit_evidence_type
        ELSE 'template_validated'::public.opportunity_pursuit_evidence_type END
  )
$$;

CREATE OR REPLACE FUNCTION public.journey_gate_2_satisfied(p_match_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH current_artifacts AS (
    SELECT DISTINCT ON (artifact_role) id, artifact_role
    FROM public.opportunity_nda_artifacts
    WHERE match_id = p_match_id AND artifact_role IN ('renew_signed_copy', 'repreneur_signed_copy')
    ORDER BY artifact_role, version_number DESC
  ), validations AS (
    SELECT e.recorded_at FROM public.opportunity_pursuit_evidence e
    JOIN current_artifacts a ON a.id=e.nda_artifact_id
    WHERE (a.artifact_role='renew_signed_copy' AND e.event_type='renew_signed_copy_validated')
       OR (a.artifact_role='repreneur_signed_copy' AND e.event_type='repreneur_signed_copy_validated')
  ) SELECT public.wave_journey_is_enabled()
    AND (SELECT count(*) FROM validations) = 2
    AND EXISTS (SELECT 1 FROM public.opportunity_pursuit_evidence gate
      WHERE gate.match_id=p_match_id AND gate.event_type='gate_2_passed'
        AND gate.recorded_at >= (SELECT max(recorded_at) FROM validations))
$$;

CREATE OR REPLACE FUNCTION public.journey_record_evidence(
  p_match_id UUID, p_event_type TEXT, p_actor TEXT, p_idempotency_key TEXT,
  p_artifact_id UUID DEFAULT NULL, p_document_id UUID DEFAULT NULL, p_evidence_reference TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_type public.opportunity_pursuit_evidence_type; v_match public.opportunity_matches%ROWTYPE; v_artifact public.opportunity_nda_artifacts%ROWTYPE; v_template_id UUID; v_existing UUID;
BEGIN
  v_type := p_event_type::public.opportunity_pursuit_evidence_type;
  SELECT id INTO v_existing FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND idempotency_key=p_idempotency_key;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id = p_match_id FOR UPDATE;
  IF v_match.id IS NULL OR v_match.status <> 'active_pursuit' THEN RAISE EXCEPTION 'An active pursuit is required.'; END IF;
  IF v_type IN ('template_validated', 'renew_signed_copy_validated', 'repreneur_signed_copy_validated') THEN
    IF p_artifact_id IS NULL THEN RAISE EXCEPTION 'This validation requires an exact NDA artifact.'; END IF;
    SELECT * INTO v_artifact FROM public.opportunity_nda_artifacts WHERE id=p_artifact_id;
    IF v_artifact.id IS NULL OR v_artifact.opportunity_id <> v_match.opportunity_id THEN RAISE EXCEPTION 'Artifact does not belong to this pursuit opportunity.'; END IF;
    IF v_type='template_validated' THEN
      SELECT id INTO v_template_id FROM public.opportunity_nda_artifacts WHERE opportunity_id=v_match.opportunity_id AND match_id IS NULL AND artifact_role='blank_template' ORDER BY version_number DESC LIMIT 1;
      IF v_artifact.id <> v_template_id THEN RAISE EXCEPTION 'Only the current opportunity blank template may be validated.'; END IF;
    ELSIF (v_type='renew_signed_copy_validated' AND (v_artifact.match_id <> p_match_id OR v_artifact.artifact_role <> 'renew_signed_copy'))
       OR (v_type='repreneur_signed_copy_validated' AND (v_artifact.match_id <> p_match_id OR v_artifact.artifact_role <> 'repreneur_signed_copy')) THEN
      RAISE EXCEPTION 'Validation must reference the current signed copy for this pursuit.';
    ELSIF EXISTS (SELECT 1 FROM public.opportunity_nda_artifacts newer WHERE newer.match_id=v_artifact.match_id AND newer.artifact_role=v_artifact.artifact_role AND newer.version_number > v_artifact.version_number) THEN
      RAISE EXCEPTION 'Only the current signed artifact version may be validated.';
    END IF;
  END IF;
  IF v_type = 'gate_1_passed' AND NOT EXISTS (SELECT 1 FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND event_type='intermediary_qualified') THEN
    RAISE EXCEPTION 'Gate 1 requires recorded intermediary qualification.'; END IF;
  IF v_type = 'gate_1_passed' AND NOT EXISTS (SELECT 1 FROM public.opportunity_pursuit_evidence evidence JOIN public.opportunity_nda_artifacts artifact ON artifact.id=evidence.nda_artifact_id WHERE evidence.match_id=p_match_id AND evidence.event_type='template_validated' AND artifact.match_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.opportunity_nda_artifacts newer WHERE newer.opportunity_id=artifact.opportunity_id AND newer.match_id IS NULL AND newer.artifact_role='blank_template' AND newer.version_number > artifact.version_number)) THEN
    RAISE EXCEPTION 'Gate 1 requires a validated blank template.'; END IF;
  IF v_type = 'gate_2_passed' AND (NOT public.journey_current_artifact_is_valid(p_match_id, 'renew_signed_copy') OR NOT public.journey_current_artifact_is_valid(p_match_id, 'repreneur_signed_copy')) THEN
    RAISE EXCEPTION 'Gate 2 requires both current signed copies to be validated.'; END IF;
  IF v_type = 'manual_package_dispatched' AND NOT public.journey_gate_2_satisfied(p_match_id) THEN
    RAISE EXCEPTION 'Manual dispatch requires current Gate 2 evidence.';
  END IF;
  IF v_type NOT IN ('intermediary_qualified', 'template_validated', 'gate_1_passed', 'renew_signed_copy_validated', 'repreneur_signed_copy_validated', 'gate_2_passed', 'manual_package_dispatched') THEN
    RAISE EXCEPTION 'This evidence type is not a staff journey action.';
  END IF;
  RETURN public.journey_append_evidence(p_match_id, v_type, p_actor, p_idempotency_key, p_artifact_id, p_document_id, p_evidence_reference,
    CASE WHEN v_type='manual_package_dispatched' THEN jsonb_build_object('renew_artifact_id', (SELECT id FROM public.opportunity_nda_artifacts WHERE match_id=p_match_id AND artifact_role='renew_signed_copy' ORDER BY version_number DESC LIMIT 1), 'repreneur_artifact_id', (SELECT id FROM public.opportunity_nda_artifacts WHERE match_id=p_match_id AND artifact_role='repreneur_signed_copy' ORDER BY version_number DESC LIMIT 1)) ELSE '{}'::JSONB END);
END; $$;

CREATE OR REPLACE FUNCTION public.journey_grant_confidential_access(
  p_match_id UUID, p_information_memo_document_id UUID, p_actor TEXT, p_idempotency_key TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE; v_doc public.opportunity_documents%ROWTYPE; v_event UUID;
BEGIN
  IF NOT public.wave_journey_is_enabled() THEN RAISE EXCEPTION 'wave_journey_disabled'; END IF;
  SELECT id INTO v_event FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND idempotency_key=p_idempotency_key;
  IF v_event IS NOT NULL THEN RETURN v_event; END IF;
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE;
  SELECT * INTO v_doc FROM public.opportunity_documents WHERE id=p_information_memo_document_id;
  IF v_match.id IS NULL OR v_match.status <> 'active_pursuit' OR NOT public.journey_gate_2_satisfied(p_match_id) OR NOT EXISTS (SELECT 1 FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND event_type='manual_package_dispatched') THEN RAISE EXCEPTION 'Gate 2 and recorded manual dispatch are required before confidential access.'; END IF;
  IF v_doc.id IS NULL OR v_doc.opportunity_id <> v_match.opportunity_id OR v_doc.document_type <> 'deal_book'
    OR NULLIF(BTRIM(v_doc.storage_path), '') IS NULL THEN RAISE EXCEPTION 'Select a retained Information Memorandum for this opportunity.'; END IF;
  INSERT INTO public.opportunity_pursuit_confidential_grants (match_id, opportunity_id, information_memo_document_id, granted_by)
  VALUES (v_match.id, v_match.opportunity_id, v_doc.id, p_actor)
  ON CONFLICT (match_id) DO UPDATE SET information_memo_document_id=EXCLUDED.information_memo_document_id, source_disclosed_at=NOW(), granted_by=EXCLUDED.granted_by, revoked_at=NULL, revoked_by=NULL, revoked_reason=NULL;
  v_event := public.journey_append_evidence(p_match_id, 'confidential_access_granted', p_actor, p_idempotency_key, NULL, v_doc.id);
  RETURN v_event;
END; $$;

CREATE OR REPLACE FUNCTION public.journey_revoke_confidential_access(
  p_match_id UUID, p_actor TEXT, p_reason TEXT, p_idempotency_key TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_event UUID;
BEGIN
  IF NOT public.wave_journey_is_enabled() THEN RAISE EXCEPTION 'wave_journey_disabled'; END IF;
  SELECT id INTO v_event FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND idempotency_key=p_idempotency_key;
  IF v_event IS NOT NULL THEN RETURN v_event; END IF;
  UPDATE public.opportunity_pursuit_confidential_grants SET revoked_at=NOW(), revoked_by=p_actor, revoked_reason=NULLIF(BTRIM(p_reason),'')
  WHERE match_id=p_match_id AND revoked_at IS NULL;
  RETURN public.journey_append_evidence(p_match_id, 'access_revoked', p_actor, p_idempotency_key, NULL, NULL, p_reason);
END; $$;

CREATE OR REPLACE FUNCTION public.journey_transition_terminal(
  p_match_id UUID, p_transition TEXT, p_actor TEXT, p_idempotency_key TEXT, p_closure_reason TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE; v_event UUID;
BEGIN
  IF NOT public.wave_journey_is_enabled() THEN RAISE EXCEPTION 'wave_journey_disabled'; END IF;
  SELECT id INTO v_event FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND idempotency_key=p_idempotency_key;
  IF v_event IS NOT NULL THEN RETURN v_event; END IF;
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE;
  IF v_match.id IS NULL THEN RAISE EXCEPTION 'Pursuit not found.'; END IF;
  IF p_transition='continue' THEN
    IF v_match.status <> 'active_pursuit' THEN RAISE EXCEPTION 'Only an active pursuit can continue.'; END IF;
    RETURN public.journey_append_evidence(p_match_id, 'continued', p_actor, p_idempotency_key);
  ELSIF p_transition='drop' THEN
    IF v_match.status <> 'active_pursuit' THEN RAISE EXCEPTION 'Only an active pursuit can be dropped.'; END IF;
    PERFORM public.journey_revoke_confidential_access(p_match_id, p_actor, 'dropped', p_idempotency_key || ':revoke');
    UPDATE public.opportunity_matches SET status='dropped', pursuit_stage='dropped', pursuit_stage_updated_by=p_actor, pursuit_stage_updated_at=NOW() WHERE id=p_match_id;
    RETURN public.journey_append_evidence(p_match_id, 'dropped', p_actor, p_idempotency_key);
  ELSIF p_transition='complete' THEN
    IF v_match.status <> 'active_pursuit' THEN RAISE EXCEPTION 'Only an active pursuit can complete.'; END IF;
    PERFORM public.journey_revoke_confidential_access(p_match_id, p_actor, 'completed', p_idempotency_key || ':revoke');
    UPDATE public.opportunity_matches SET status='completed', pursuit_stage='closed', pursuit_stage_updated_by=p_actor, pursuit_stage_updated_at=NOW() WHERE id=p_match_id;
    UPDATE public.opportunities SET status='closed', updated_by=p_actor WHERE id=v_match.opportunity_id;
    RETURN public.journey_append_evidence(p_match_id, 'completed', p_actor, p_idempotency_key, NULL, NULL, p_closure_reason);
  ELSIF p_transition='reopen' THEN
    IF v_match.status <> 'dropped' THEN RAISE EXCEPTION 'Only a dropped pursuit can reopen.'; END IF;
    UPDATE public.opportunity_matches SET status='interested', pursuit_stage=NULL, pursuit_stage_notes=NULL, pursuit_stage_updated_by=p_actor, pursuit_stage_updated_at=NOW() WHERE id=p_match_id;
    RETURN public.journey_append_evidence(p_match_id, 'reopened', p_actor, p_idempotency_key);
  END IF;
  RAISE EXCEPTION 'Unsupported pursuit transition.';
END; $$;

CREATE OR REPLACE FUNCTION public.journey_repreneur_can_access_confidential(
  p_match_id UUID, p_repreneur_id UUID, p_document_id UUID
) RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.wave_journey_is_enabled() AND EXISTS (
    SELECT 1 FROM public.opportunity_matches m
    JOIN public.opportunities o ON o.id=m.opportunity_id
    JOIN public.opportunity_pursuit_confidential_grants g ON g.match_id=m.id
    WHERE m.id=p_match_id AND m.repreneur_id=p_repreneur_id AND m.status='active_pursuit'
      AND o.status='active' AND g.revoked_at IS NULL AND g.information_memo_document_id=p_document_id
      AND public.journey_gate_2_satisfied(m.id)
  )
$$;

-- The server action maps allowed transitions; anonymous/authenticated browser
-- clients have no table or RPC authority. The generic helper remains private.
REVOKE ALL ON FUNCTION public.journey_append_evidence(UUID, public.opportunity_pursuit_evidence_type, TEXT, TEXT, UUID, UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.wave_journey_is_enabled() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.journey_current_artifact_is_valid(UUID, public.opportunity_nda_artifact_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.journey_gate_2_satisfied(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.journey_repreneur_can_access_confidential(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.journey_record_evidence(UUID, TEXT, TEXT, TEXT, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.journey_grant_confidential_access(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.journey_revoke_confidential_access(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.journey_transition_terminal(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.journey_record_evidence(UUID, TEXT, TEXT, TEXT, UUID, UUID, TEXT), public.journey_grant_confidential_access(UUID, UUID, TEXT, TEXT), public.journey_revoke_confidential_access(UUID, TEXT, TEXT, TEXT), public.journey_transition_terminal(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.wave_journey_is_enabled(), public.journey_current_artifact_is_valid(UUID, public.opportunity_nda_artifact_role), public.journey_gate_2_satisfied(UUID), public.journey_repreneur_can_access_confidential(UUID, UUID, UUID) TO service_role;

COMMENT ON TABLE public.opportunity_pursuit_evidence IS 'Canonical append-only W-090 evidence; legacy match NDA/stage fields never satisfy gates.';
COMMENT ON TABLE public.opportunity_pursuit_confidential_grants IS 'Exact pursuit-specific IM and source disclosure grants; no later pursuit inherits a grant.';
