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
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (match_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS opportunity_pursuit_evidence_match_recorded_idx
  ON public.opportunity_pursuit_evidence (match_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS opportunity_pursuit_evidence_type_idx
  ON public.opportunity_pursuit_evidence (match_id, event_type, recorded_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS opportunity_nda_artifacts_signed_content_unique
  ON public.opportunity_nda_artifacts (match_id, artifact_role, content_sha256)
  WHERE match_id IS NOT NULL AND artifact_role IN ('renew_signed_copy', 'repreneur_signed_copy');
ALTER TABLE public.opportunity_pursuit_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_pursuit_evidence FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.opportunity_pursuit_evidence FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.opportunity_pursuit_evidence TO service_role;

CREATE TABLE IF NOT EXISTS public.opportunity_pursuit_confidential_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL UNIQUE REFERENCES public.opportunity_matches(id) ON DELETE RESTRICT,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  information_memo_document_id UUID NOT NULL REFERENCES public.opportunity_documents(id) ON DELETE RESTRICT,
  source_firm_id UUID NOT NULL REFERENCES public.ma_firms(id) ON DELETE RESTRICT,
  source_firm_name TEXT NOT NULL,
  source_office_id UUID NOT NULL REFERENCES public.ma_offices(id) ON DELETE RESTRICT,
  source_office_name TEXT NOT NULL,
  disclosed_contacts JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(disclosed_contacts) = 'array'),
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
    nda_artifact_id, document_id, evidence_reference, metadata, recorded_at
  ) VALUES (
    v_match.id, v_match.opportunity_id, v_match.repreneur_id, p_event_type, p_actor,
    p_idempotency_key, p_artifact_id, p_document_id, p_evidence_reference, COALESCE(p_metadata, '{}'::JSONB), clock_timestamp()
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
  WITH cycle AS (SELECT max(recorded_at) AS started_at FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND event_type='mutual_interest_validated'), current_artifact AS (
    SELECT a.id FROM public.opportunity_nda_artifacts a
    WHERE a.match_id = p_match_id AND a.artifact_role = p_role
    ORDER BY a.version_number DESC LIMIT 1
  ) SELECT EXISTS (
    SELECT 1 FROM current_artifact a
    JOIN public.opportunity_pursuit_evidence e ON e.nda_artifact_id = a.id
    WHERE e.match_id = p_match_id
      AND e.recorded_at >= (SELECT started_at FROM cycle)
      AND e.event_type = CASE p_role
        WHEN 'renew_signed_copy' THEN 'renew_signed_copy_validated'::public.opportunity_pursuit_evidence_type
        WHEN 'repreneur_signed_copy' THEN 'repreneur_signed_copy_validated'::public.opportunity_pursuit_evidence_type
        ELSE 'template_validated'::public.opportunity_pursuit_evidence_type END
  )
$$;

CREATE OR REPLACE FUNCTION public.journey_gate_2_satisfied(p_match_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH cycle AS (SELECT max(recorded_at) AS started_at FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND event_type='mutual_interest_validated'), current_artifacts AS (
    SELECT DISTINCT ON (artifact_role) id, artifact_role
    FROM public.opportunity_nda_artifacts
    WHERE match_id = p_match_id AND artifact_role IN ('renew_signed_copy', 'repreneur_signed_copy')
    ORDER BY artifact_role, version_number DESC
  ), validations AS (
    SELECT a.artifact_role, max(e.recorded_at) AS recorded_at FROM public.opportunity_pursuit_evidence e
    JOIN current_artifacts a ON a.id=e.nda_artifact_id
    CROSS JOIN cycle
    WHERE ((a.artifact_role='renew_signed_copy' AND e.event_type='renew_signed_copy_validated')
       OR (a.artifact_role='repreneur_signed_copy' AND e.event_type='repreneur_signed_copy_validated'))
      AND e.recorded_at >= cycle.started_at
    GROUP BY a.artifact_role
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
  IF v_type = 'qualification_requested' AND NOT EXISTS (SELECT 1 FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND event_type='mutual_interest_validated' AND recorded_at=(SELECT max(recorded_at) FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND event_type='mutual_interest_validated')) THEN
    RAISE EXCEPTION 'Qualification requires recorded mutual interest.'; END IF;
  IF v_type = 'intermediary_qualified' AND NOT EXISTS (SELECT 1 FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND event_type='qualification_requested' AND recorded_at >= (SELECT max(recorded_at) FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND event_type='mutual_interest_validated')) THEN
    RAISE EXCEPTION 'Intermediary qualification requires a recorded qualification request.'; END IF;
  IF v_type = 'template_validated' AND NOT EXISTS (SELECT 1 FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND event_type='intermediary_qualified' AND recorded_at >= (SELECT max(recorded_at) FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND event_type='mutual_interest_validated')) THEN
    RAISE EXCEPTION 'Template validation requires intermediary qualification.'; END IF;
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
  IF v_type NOT IN ('qualification_requested', 'intermediary_qualified', 'template_validated', 'gate_1_passed', 'renew_signed_copy_validated', 'repreneur_signed_copy_validated', 'gate_2_passed', 'manual_package_dispatched') THEN
    RAISE EXCEPTION 'This evidence type is not a staff journey action.';
  END IF;
  RETURN public.journey_append_evidence(p_match_id, v_type, p_actor, p_idempotency_key, p_artifact_id, p_document_id, p_evidence_reference,
    CASE WHEN v_type='manual_package_dispatched' THEN jsonb_build_object('renew_artifact_id', (SELECT id FROM public.opportunity_nda_artifacts WHERE match_id=p_match_id AND artifact_role='renew_signed_copy' ORDER BY version_number DESC LIMIT 1), 'repreneur_artifact_id', (SELECT id FROM public.opportunity_nda_artifacts WHERE match_id=p_match_id AND artifact_role='repreneur_signed_copy' ORDER BY version_number DESC LIMIT 1)) ELSE '{}'::JSONB END);
END; $$;

CREATE OR REPLACE FUNCTION public.journey_start_pursuit(
  p_match_id UUID, p_actor TEXT, p_idempotency_key TEXT, p_evidence_reference TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE; v_existing UUID;
BEGIN
  IF NOT public.wave_journey_is_enabled() THEN RAISE EXCEPTION 'wave_journey_disabled'; END IF;
  SELECT id INTO v_existing FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND idempotency_key=p_idempotency_key;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE;
  IF v_match.id IS NULL OR v_match.status <> 'interested' THEN RAISE EXCEPTION 'Only an interested match can start a pursuit.'; END IF;
  PERFORM 1 FROM public.opportunities WHERE id=v_match.opportunity_id AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only an active opportunity can start a pursuit.'; END IF;
  UPDATE public.opportunity_matches SET status='active_pursuit', pursuit_stage='interest', pursuit_stage_updated_by=p_actor, pursuit_stage_updated_at=NOW(), reviewed_by=p_actor, reviewed_at=NOW() WHERE id=p_match_id;
  RETURN public.journey_append_evidence(p_match_id, 'mutual_interest_validated', p_actor, p_idempotency_key, NULL, NULL, p_evidence_reference);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'This opportunity already has an active pursuit.'; END; $$;

CREATE OR REPLACE FUNCTION public.journey_grant_confidential_access(
  p_match_id UUID, p_information_memo_document_id UUID, p_actor TEXT, p_idempotency_key TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE; v_doc public.opportunity_documents%ROWTYPE; v_event UUID; v_firm_id UUID; v_firm_name TEXT; v_office_id UUID; v_office_name TEXT; v_contacts JSONB;
BEGIN
  IF NOT public.wave_journey_is_enabled() THEN RAISE EXCEPTION 'wave_journey_disabled'; END IF;
  SELECT id INTO v_event FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND idempotency_key=p_idempotency_key;
  IF v_event IS NOT NULL THEN RETURN v_event; END IF;
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE;
  SELECT * INTO v_doc FROM public.opportunity_documents WHERE id=p_information_memo_document_id;
  IF v_match.id IS NULL OR v_match.status <> 'active_pursuit' OR NOT public.journey_gate_2_satisfied(p_match_id) OR NOT EXISTS (SELECT 1 FROM public.opportunity_pursuit_evidence dispatch WHERE dispatch.match_id=p_match_id AND dispatch.event_type='manual_package_dispatched' AND dispatch.recorded_at >= (SELECT max(gate.recorded_at) FROM public.opportunity_pursuit_evidence gate WHERE gate.match_id=p_match_id AND gate.event_type='gate_2_passed')) THEN RAISE EXCEPTION 'Gate 2 and recorded manual dispatch are required before confidential access.'; END IF;
  IF v_doc.id IS NULL OR v_doc.opportunity_id <> v_match.opportunity_id OR v_doc.document_type <> 'deal_book'
    OR NULLIF(BTRIM(v_doc.storage_path), '') IS NULL THEN RAISE EXCEPTION 'Select a retained Information Memorandum for this opportunity.'; END IF;
  SELECT firm.id, firm.name, office.id, office.name INTO v_firm_id, v_firm_name, v_office_id, v_office_name
  FROM public.opportunities opportunity JOIN public.ma_offices office ON office.id=opportunity.source_office_id JOIN public.ma_firms firm ON firm.id=office.firm_id
  WHERE opportunity.id=v_match.opportunity_id AND office.status='active' AND firm.status <> 'archived';
  IF v_office_id IS NULL THEN RAISE EXCEPTION 'An active canonical source office is required before disclosure.'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('opportunity_contact_id', link.id, 'contact_id', contact.id, 'name', link.contact_name_snapshot, 'email', link.contact_email_snapshot) ORDER BY link.is_primary DESC, link.linked_at), '[]'::JSONB)
  INTO v_contacts FROM public.opportunity_ma_contacts link JOIN public.ma_contact_office_affiliations affiliation ON affiliation.id=link.affiliation_id JOIN public.ma_contacts contact ON contact.id=affiliation.contact_id
  WHERE link.opportunity_id=v_match.opportunity_id AND link.is_active AND affiliation.office_id=v_office_id;
  IF jsonb_array_length(v_contacts)=0 THEN RAISE EXCEPTION 'An approved source contact is required before disclosure.'; END IF;
  INSERT INTO public.opportunity_pursuit_confidential_grants (match_id, opportunity_id, information_memo_document_id, source_firm_id, source_firm_name, source_office_id, source_office_name, disclosed_contacts, granted_by)
  VALUES (v_match.id, v_match.opportunity_id, v_doc.id, v_firm_id, v_firm_name, v_office_id, v_office_name, v_contacts, p_actor)
  ON CONFLICT (match_id) DO UPDATE SET information_memo_document_id=EXCLUDED.information_memo_document_id, source_firm_id=EXCLUDED.source_firm_id, source_firm_name=EXCLUDED.source_firm_name, source_office_id=EXCLUDED.source_office_id, source_office_name=EXCLUDED.source_office_name, disclosed_contacts=EXCLUDED.disclosed_contacts, source_disclosed_at=NOW(), granted_by=EXCLUDED.granted_by, revoked_at=NULL, revoked_by=NULL, revoked_reason=NULL;
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

CREATE OR REPLACE FUNCTION public.journey_submit_repreneur_signed_copy(
  p_match_id UUID, p_repreneur_id UUID, p_actor_email TEXT, p_title TEXT, p_storage_path TEXT,
  p_file_name TEXT, p_file_size BIGINT, p_content_sha256 TEXT
) RETURNS TABLE (artifact_id UUID, document_id UUID, version_number INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE; v_prior UUID; v_version INTEGER; v_document UUID; v_artifact UUID; v_email TEXT;
BEGIN
  IF NOT public.wave_journey_is_enabled() THEN RAISE EXCEPTION 'wave_journey_disabled'; END IF;
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE;
  SELECT LOWER(BTRIM(email)) INTO v_email FROM public.repreneurs WHERE id=p_repreneur_id;
  IF v_match.id IS NULL OR v_match.status <> 'active_pursuit' OR v_match.repreneur_id <> p_repreneur_id OR v_email IS NULL OR v_email <> LOWER(BTRIM(p_actor_email)) THEN RAISE EXCEPTION 'Only the active pursuit repreneur may submit this signed copy.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.opportunity_pursuit_evidence gate WHERE gate.match_id=p_match_id AND gate.event_type='gate_1_passed' AND gate.recorded_at >= COALESCE((SELECT max(validation.recorded_at) FROM public.opportunity_pursuit_evidence validation JOIN public.opportunity_nda_artifacts template ON template.id=validation.nda_artifact_id WHERE validation.match_id=p_match_id AND validation.event_type='template_validated' AND template.match_id IS NULL AND template.artifact_role='blank_template' AND NOT EXISTS (SELECT 1 FROM public.opportunity_nda_artifacts newer WHERE newer.opportunity_id=template.opportunity_id AND newer.match_id IS NULL AND newer.artifact_role='blank_template' AND newer.version_number>template.version_number)), '-infinity'::timestamptz)) THEN RAISE EXCEPTION 'Current Gate 1 is required before signed-copy submission.'; END IF;
  IF NULLIF(BTRIM(p_title),'') IS NULL OR NULLIF(BTRIM(p_storage_path),'') IS NULL OR LOWER(p_file_name) NOT LIKE '%.pdf' OR p_file_size <= 0 OR LOWER(p_content_sha256) !~ '^[0-9a-f]{64}$' OR p_storage_path NOT LIKE v_match.opportunity_id::TEXT || '/nda-artifacts/repreneur_signed_copy/%' THEN RAISE EXCEPTION 'Submit one retained PDF in the canonical signed-copy path.'; END IF;
  SELECT id, version_number+1 INTO v_prior, v_version FROM public.opportunity_nda_artifacts WHERE match_id=p_match_id AND artifact_role='repreneur_signed_copy' ORDER BY version_number DESC LIMIT 1;
  v_version := COALESCE(v_version, 1);
  INSERT INTO public.opportunity_documents (opportunity_id,title,document_type,visibility,storage_bucket,storage_path,file_name,size_bytes,mime_type,uploaded_by)
  VALUES (v_match.opportunity_id, p_title, 'nda', 'staff_only', 'opportunity-documents', p_storage_path, p_file_name, p_file_size, 'application/pdf', p_actor_email) RETURNING id INTO v_document;
  INSERT INTO public.opportunity_nda_artifacts (opportunity_id,match_id,document_id,artifact_role,version_number,content_sha256,supersedes_artifact_id,recorded_by)
  VALUES (v_match.opportunity_id,p_match_id,v_document,'repreneur_signed_copy',v_version,LOWER(p_content_sha256),v_prior,p_actor_email) RETURNING id INTO v_artifact;
  RETURN QUERY SELECT v_artifact,v_document,v_version;
END; $$;

-- The server action maps allowed transitions; anonymous/authenticated browser
-- clients have no table or RPC authority. The generic helper remains private.
REVOKE ALL ON FUNCTION public.journey_append_evidence(UUID, public.opportunity_pursuit_evidence_type, TEXT, TEXT, UUID, UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.wave_journey_is_enabled() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.journey_current_artifact_is_valid(UUID, public.opportunity_nda_artifact_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.journey_gate_2_satisfied(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.journey_repreneur_can_access_confidential(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.journey_submit_repreneur_signed_copy(UUID, UUID, TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.journey_record_evidence(UUID, TEXT, TEXT, TEXT, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.journey_start_pursuit(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.journey_grant_confidential_access(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.journey_revoke_confidential_access(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.journey_transition_terminal(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.journey_record_evidence(UUID, TEXT, TEXT, TEXT, UUID, UUID, TEXT), public.journey_start_pursuit(UUID, TEXT, TEXT, TEXT), public.journey_grant_confidential_access(UUID, UUID, TEXT, TEXT), public.journey_revoke_confidential_access(UUID, TEXT, TEXT, TEXT), public.journey_transition_terminal(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.wave_journey_is_enabled(), public.journey_current_artifact_is_valid(UUID, public.opportunity_nda_artifact_role), public.journey_gate_2_satisfied(UUID), public.journey_repreneur_can_access_confidential(UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.journey_submit_repreneur_signed_copy(UUID, UUID, TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT) TO service_role;

COMMENT ON TABLE public.opportunity_pursuit_evidence IS 'Canonical append-only W-090 evidence; legacy match NDA/stage fields never satisfy gates.';
COMMENT ON TABLE public.opportunity_pursuit_confidential_grants IS 'Exact pursuit-specific IM and source disclosure grants; no later pursuit inherits a grant.';

-- Final authority layer.  The earlier definitions in this additive migration
-- establish the objects; the definitions below deliberately replace their
-- transitional predicates.  Every predicate starts from the latest mutual
-- interest event.  Nothing recorded in an older attempt can be reused.
ALTER TABLE public.opportunity_pursuit_confidential_grants
  ADD COLUMN IF NOT EXISTS cycle_started_evidence_id UUID REFERENCES public.opportunity_pursuit_evidence(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS gate_2_evidence_id UUID REFERENCES public.opportunity_pursuit_evidence(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS dispatch_evidence_id UUID REFERENCES public.opportunity_pursuit_evidence(id) ON DELETE RESTRICT;
ALTER TABLE public.opportunity_pursuit_confidential_grants
  ADD COLUMN IF NOT EXISTS nda_expires_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.journey_current_cycle_event(p_match_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT e.id FROM public.opportunity_pursuit_evidence e
  JOIN public.opportunity_matches m ON m.id=e.match_id
  WHERE e.match_id=p_match_id AND e.event_type='mutual_interest_validated'
    AND m.status='active_pursuit'
  ORDER BY recorded_at DESC, id DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.journey_current_cycle_started_at(p_match_id UUID)
RETURNS TIMESTAMPTZ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT recorded_at FROM public.opportunity_pursuit_evidence
  WHERE id=public.journey_current_cycle_event(p_match_id)
$$;

CREATE OR REPLACE FUNCTION public.journey_current_template_id(p_match_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT a.id FROM public.opportunity_nda_artifacts a
  JOIN public.opportunity_matches m ON m.opportunity_id=a.opportunity_id
  WHERE m.id=p_match_id AND a.match_id IS NULL AND a.artifact_role='blank_template'
  ORDER BY a.version_number DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.journey_current_gate_1_event(p_match_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH cycle AS (SELECT public.journey_current_cycle_event(p_match_id) id),
  start AS (SELECT e.recorded_at FROM public.opportunity_pursuit_evidence e JOIN cycle c ON c.id=e.id),
  template AS (SELECT public.journey_current_template_id(p_match_id) id),
  qualification AS (
    SELECT max(e.recorded_at) recorded_at FROM public.opportunity_pursuit_evidence e, start
    WHERE e.match_id=p_match_id AND e.event_type='qualification_requested' AND e.recorded_at>=start.recorded_at
  ), qualified AS (
    SELECT max(e.recorded_at) recorded_at FROM public.opportunity_pursuit_evidence e, start, qualification q
    WHERE e.match_id=p_match_id AND e.event_type='intermediary_qualified' AND e.recorded_at>=start.recorded_at AND q.recorded_at IS NOT NULL AND e.recorded_at>=q.recorded_at
  ), template_validated AS (
    SELECT max(e.recorded_at) recorded_at FROM public.opportunity_pursuit_evidence e, template t, qualified q
    WHERE e.match_id=p_match_id AND e.event_type='template_validated' AND e.nda_artifact_id=t.id AND q.recorded_at IS NOT NULL AND e.recorded_at>=q.recorded_at
  )
  SELECT e.id FROM public.opportunity_pursuit_evidence e, cycle c, template_validated v
  WHERE c.id IS NOT NULL AND e.match_id=p_match_id AND e.event_type='gate_1_passed'
    AND v.recorded_at IS NOT NULL AND e.recorded_at>=v.recorded_at
  ORDER BY e.recorded_at DESC, e.id DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.journey_current_signed_validation_event(
  p_match_id UUID, p_role public.opportunity_nda_artifact_role
) RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH gate AS (SELECT id, recorded_at FROM public.opportunity_pursuit_evidence WHERE id=public.journey_current_gate_1_event(p_match_id)),
  artifact AS (
    SELECT id FROM public.opportunity_nda_artifacts WHERE match_id=p_match_id AND artifact_role=p_role
    ORDER BY version_number DESC LIMIT 1
  )
  SELECT e.id FROM public.opportunity_pursuit_evidence e, gate g, artifact a
  WHERE e.match_id=p_match_id AND e.nda_artifact_id=a.id AND e.recorded_at>=g.recorded_at
    AND e.event_type=CASE p_role WHEN 'renew_signed_copy' THEN 'renew_signed_copy_validated'::public.opportunity_pursuit_evidence_type ELSE 'repreneur_signed_copy_validated'::public.opportunity_pursuit_evidence_type END
  ORDER BY e.recorded_at DESC, e.id DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.journey_current_gate_2_event(p_match_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH cycle AS (SELECT public.journey_current_cycle_event(p_match_id) id),
  start AS (SELECT e.recorded_at FROM public.opportunity_pursuit_evidence e JOIN cycle c ON c.id=e.id),
  renew AS (SELECT public.journey_current_signed_validation_event(p_match_id, 'renew_signed_copy') id),
  repreneur AS (SELECT public.journey_current_signed_validation_event(p_match_id, 'repreneur_signed_copy') id),
  v AS (SELECT greatest((SELECT recorded_at FROM public.opportunity_pursuit_evidence WHERE id=(SELECT id FROM renew)), (SELECT recorded_at FROM public.opportunity_pursuit_evidence WHERE id=(SELECT id FROM repreneur))) recorded_at)
  SELECT e.id FROM public.opportunity_pursuit_evidence e, cycle c, start s, renew r, repreneur rp, v
  WHERE c.id IS NOT NULL AND r.id IS NOT NULL AND rp.id IS NOT NULL AND e.match_id=p_match_id AND e.event_type='gate_2_passed'
    AND e.recorded_at>=s.recorded_at AND e.recorded_at>=v.recorded_at
    AND e.metadata->>'renew_validation_id'=r.id::TEXT AND e.metadata->>'repreneur_validation_id'=rp.id::TEXT
    AND e.metadata->>'renew_artifact_id'=(SELECT nda_artifact_id::TEXT FROM public.opportunity_pursuit_evidence WHERE id=r.id)
    AND e.metadata->>'repreneur_artifact_id'=(SELECT nda_artifact_id::TEXT FROM public.opportunity_pursuit_evidence WHERE id=rp.id)
  ORDER BY e.recorded_at DESC, e.id DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.journey_current_dispatch_event(p_match_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH gate AS (SELECT id, recorded_at, metadata FROM public.opportunity_pursuit_evidence WHERE id=public.journey_current_gate_2_event(p_match_id))
  SELECT e.id FROM public.opportunity_pursuit_evidence e, gate g
  WHERE e.match_id=p_match_id AND e.event_type='manual_package_dispatched' AND e.recorded_at>=g.recorded_at
    AND e.metadata->>'gate_2_evidence_id'=g.id::TEXT
    AND e.metadata->>'renew_artifact_id'=g.metadata->>'renew_artifact_id'
    AND e.metadata->>'repreneur_artifact_id'=g.metadata->>'repreneur_artifact_id'
  ORDER BY e.recorded_at DESC, e.id DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.journey_current_artifact_is_valid(p_match_id UUID, p_role public.opportunity_nda_artifact_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
 SELECT public.journey_current_signed_validation_event(p_match_id,p_role) IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.journey_gate_2_satisfied(p_match_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
 SELECT public.wave_journey_is_enabled() AND public.journey_current_gate_2_event(p_match_id) IS NOT NULL
$$;

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
    IF p_artifact_id IS DISTINCT FROM v_template OR NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND event_type='intermediary_qualified' AND recorded_at>=v_start) THEN RAISE EXCEPTION 'Template validation requires current-cycle qualification and the exact current blank template.'; END IF;
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

CREATE OR REPLACE FUNCTION public.journey_grant_confidential_access(
  p_match_id UUID, p_information_memo_document_id UUID, p_actor TEXT, p_idempotency_key TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE; v_doc public.opportunity_documents%ROWTYPE; v_existing UUID;
 v_cycle UUID; v_gate2 UUID; v_dispatch UUID; v_event UUID; v_firm_id UUID; v_firm_name TEXT; v_office_id UUID; v_office_name TEXT; v_contacts JSONB;
BEGIN
 IF NOT public.wave_journey_is_enabled() THEN RAISE EXCEPTION 'wave_journey_disabled'; END IF;
 SELECT id INTO v_existing FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND idempotency_key=p_idempotency_key; IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
 SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE;
 SELECT * INTO v_doc FROM public.opportunity_documents WHERE id=p_information_memo_document_id;
 v_cycle:=public.journey_current_cycle_event(p_match_id); v_gate2:=public.journey_current_gate_2_event(p_match_id); v_dispatch:=public.journey_current_dispatch_event(p_match_id);
 IF v_match.id IS NULL OR v_match.status<>'active_pursuit' OR NOT EXISTS(SELECT 1 FROM public.opportunities WHERE id=v_match.opportunity_id AND status='active') OR v_cycle IS NULL OR v_gate2 IS NULL OR v_dispatch IS NULL THEN RAISE EXCEPTION 'Current Gate 2 and its exact manual dispatch are required before confidential access.'; END IF;
 IF v_doc.id IS NULL OR v_doc.opportunity_id<>v_match.opportunity_id OR v_doc.document_type<>'deal_book' OR NULLIF(BTRIM(v_doc.storage_path),'') IS NULL THEN RAISE EXCEPTION 'Select a retained Information Memorandum for this opportunity.'; END IF;
 SELECT f.id,f.name,o.id,o.name INTO v_firm_id,v_firm_name,v_office_id,v_office_name FROM public.opportunities p JOIN public.ma_offices o ON o.id=p.source_office_id JOIN public.ma_firms f ON f.id=o.firm_id WHERE p.id=v_match.opportunity_id AND o.status='active' AND f.status<>'archived';
 IF v_office_id IS NULL THEN RAISE EXCEPTION 'An active canonical source office is required before disclosure.'; END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('name',link.contact_name_snapshot) ORDER BY link.is_primary DESC,link.linked_at),'[]'::JSONB) INTO v_contacts FROM public.opportunity_ma_contacts link JOIN public.ma_contact_office_affiliations a ON a.id=link.affiliation_id WHERE link.opportunity_id=v_match.opportunity_id AND link.is_active AND a.office_id=v_office_id AND NULLIF(BTRIM(link.contact_name_snapshot),'') IS NOT NULL;
 IF jsonb_array_length(v_contacts)=0 THEN RAISE EXCEPTION 'An approved source contact is required before disclosure.'; END IF;
 INSERT INTO public.opportunity_pursuit_confidential_grants(match_id,opportunity_id,information_memo_document_id,source_firm_id,source_firm_name,source_office_id,source_office_name,disclosed_contacts,granted_by,cycle_started_evidence_id,gate_2_evidence_id,dispatch_evidence_id,revoked_at,revoked_by,revoked_reason)
 VALUES(v_match.id,v_match.opportunity_id,v_doc.id,v_firm_id,v_firm_name,v_office_id,v_office_name,v_contacts,p_actor,v_cycle,v_gate2,v_dispatch,NULL,NULL,NULL)
 ON CONFLICT(match_id) DO UPDATE SET information_memo_document_id=EXCLUDED.information_memo_document_id,source_firm_id=EXCLUDED.source_firm_id,source_firm_name=EXCLUDED.source_firm_name,source_office_id=EXCLUDED.source_office_id,source_office_name=EXCLUDED.source_office_name,disclosed_contacts=EXCLUDED.disclosed_contacts,granted_by=EXCLUDED.granted_by,source_disclosed_at=NOW(),cycle_started_evidence_id=EXCLUDED.cycle_started_evidence_id,gate_2_evidence_id=EXCLUDED.gate_2_evidence_id,dispatch_evidence_id=EXCLUDED.dispatch_evidence_id,revoked_at=NULL,revoked_by=NULL,revoked_reason=NULL;
 v_event:=public.journey_append_evidence(p_match_id,'confidential_access_granted',p_actor,p_idempotency_key,NULL,v_doc.id,NULL,jsonb_build_object('cycle_started_evidence_id',v_cycle,'gate_2_evidence_id',v_gate2,'dispatch_evidence_id',v_dispatch,'information_memo_document_id',v_doc.id));
 RETURN v_event;
END $$;

CREATE OR REPLACE FUNCTION public.journey_repreneur_can_access_confidential(p_match_id UUID,p_repreneur_id UUID,p_document_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
 SELECT public.wave_journey_is_enabled() AND EXISTS(
  SELECT 1 FROM public.opportunity_matches m JOIN public.opportunities o ON o.id=m.opportunity_id JOIN public.opportunity_pursuit_confidential_grants g ON g.match_id=m.id
  WHERE m.id=p_match_id AND m.repreneur_id=p_repreneur_id AND m.status='active_pursuit' AND o.status='active'
   AND g.information_memo_document_id=p_document_id AND g.revoked_at IS NULL AND g.nda_expires_at>NOW()
   AND g.cycle_started_evidence_id=public.journey_current_cycle_event(m.id)
   AND g.gate_2_evidence_id=public.journey_current_gate_2_event(m.id)
   AND g.dispatch_evidence_id=public.journey_current_dispatch_event(m.id)
 )
$$;

CREATE OR REPLACE FUNCTION public.journey_revoke_confidential_access(p_match_id UUID,p_actor TEXT,p_reason TEXT,p_idempotency_key TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_event UUID; BEGIN
 IF NOT public.wave_journey_is_enabled() THEN RAISE EXCEPTION 'wave_journey_disabled'; END IF;
 SELECT id INTO v_event FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND idempotency_key=p_idempotency_key; IF v_event IS NOT NULL THEN RETURN v_event; END IF;
 UPDATE public.opportunity_pursuit_confidential_grants SET revoked_at=NOW(),revoked_by=p_actor,revoked_reason=NULLIF(BTRIM(p_reason),'') WHERE match_id=p_match_id AND revoked_at IS NULL;
 RETURN public.journey_append_evidence(p_match_id,'access_revoked',p_actor,p_idempotency_key,NULL,NULL,p_reason,jsonb_build_object('cycle_started_evidence_id',public.journey_current_cycle_event(p_match_id)));
END $$;

-- Expiry is a required legal bound for every new V1 grant.  The four-argument
-- predecessor is left defined only for migration compatibility and loses its
-- service-role execute grant below; callers must use this exact signature.
CREATE OR REPLACE FUNCTION public.journey_grant_confidential_access(
  p_match_id UUID,p_information_memo_document_id UUID,p_actor TEXT,p_idempotency_key TEXT,p_nda_expires_at TIMESTAMPTZ
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_match public.opportunity_matches%ROWTYPE; v_doc public.opportunity_documents%ROWTYPE;
  v_existing UUID; v_cycle UUID; v_gate2 UUID; v_dispatch UUID; v_firm_id UUID;
  v_firm_name TEXT; v_office_id UUID; v_office_name TEXT; v_contacts JSONB; v_event UUID;
  v_grant public.opportunity_pursuit_confidential_grants%ROWTYPE;
BEGIN
  IF NOT public.wave_journey_is_enabled() THEN RAISE EXCEPTION 'wave_journey_disabled'; END IF;
  IF p_nda_expires_at IS NULL OR p_nda_expires_at <= clock_timestamp() THEN RAISE EXCEPTION 'A future NDA expiry is required before confidential access.'; END IF;
  SELECT id INTO v_existing FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND idempotency_key=p_idempotency_key;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE;
  IF v_match.id IS NULL OR v_match.status<>'active_pursuit' OR NOT EXISTS(SELECT 1 FROM public.opportunities WHERE id=v_match.opportunity_id AND status='active') THEN RAISE EXCEPTION 'An active pursuit on an active opportunity is required.'; END IF;
  SELECT * INTO v_doc FROM public.opportunity_documents WHERE id=p_information_memo_document_id;
  v_cycle:=public.journey_current_cycle_event(p_match_id); v_gate2:=public.journey_current_gate_2_event(p_match_id); v_dispatch:=public.journey_current_dispatch_event(p_match_id);
  IF v_cycle IS NULL OR v_gate2 IS NULL OR v_dispatch IS NULL THEN RAISE EXCEPTION 'Current Gate 2 and its exact manual dispatch are required before confidential access.'; END IF;
  IF v_doc.id IS NULL OR v_doc.opportunity_id<>v_match.opportunity_id OR v_doc.document_type<>'deal_book' OR NULLIF(BTRIM(v_doc.storage_path),'') IS NULL THEN RAISE EXCEPTION 'Select a retained Information Memorandum for this opportunity.'; END IF;
  SELECT f.id,f.name,o.id,o.name INTO v_firm_id,v_firm_name,v_office_id,v_office_name FROM public.opportunities p JOIN public.ma_offices o ON o.id=p.source_office_id JOIN public.ma_firms f ON f.id=o.firm_id WHERE p.id=v_match.opportunity_id AND o.status='active' AND f.status<>'archived';
  IF v_office_id IS NULL THEN RAISE EXCEPTION 'An active canonical source office is required before disclosure.'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('name',link.contact_name_snapshot) ORDER BY link.is_primary DESC,link.linked_at),'[]'::JSONB) INTO v_contacts FROM public.opportunity_ma_contacts link JOIN public.ma_contact_office_affiliations a ON a.id=link.affiliation_id WHERE link.opportunity_id=v_match.opportunity_id AND link.is_active AND a.office_id=v_office_id AND NULLIF(BTRIM(link.contact_name_snapshot),'') IS NOT NULL;
  IF jsonb_array_length(v_contacts)=0 THEN RAISE EXCEPTION 'An approved source contact is required before disclosure.'; END IF;
  SELECT * INTO v_grant FROM public.opportunity_pursuit_confidential_grants WHERE match_id=p_match_id FOR UPDATE;
  IF v_grant.id IS NOT NULL AND v_grant.revoked_at IS NULL
    AND v_grant.cycle_started_evidence_id=v_cycle AND v_grant.gate_2_evidence_id=v_gate2 AND v_grant.dispatch_evidence_id=v_dispatch THEN
    IF v_grant.information_memo_document_id=p_information_memo_document_id AND v_grant.nda_expires_at=p_nda_expires_at THEN
      SELECT id INTO v_event FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND event_type='confidential_access_granted' AND metadata->>'cycle_started_evidence_id'=v_cycle::TEXT AND metadata->>'gate_2_evidence_id'=v_gate2::TEXT AND metadata->>'dispatch_evidence_id'=v_dispatch::TEXT ORDER BY recorded_at DESC,id DESC LIMIT 1;
      IF v_event IS NULL THEN RAISE EXCEPTION 'Live grant lacks its immutable disclosure evidence.'; END IF;
      RETURN v_event;
    END IF;
    RAISE EXCEPTION 'Confidential access is already live for this pursuit. Revoke it before changing the disclosure.';
  END IF;
  INSERT INTO public.opportunity_pursuit_confidential_grants(match_id,opportunity_id,information_memo_document_id,source_firm_id,source_firm_name,source_office_id,source_office_name,disclosed_contacts,granted_by,cycle_started_evidence_id,gate_2_evidence_id,dispatch_evidence_id,nda_expires_at)
  VALUES(v_match.id,v_match.opportunity_id,v_doc.id,v_firm_id,v_firm_name,v_office_id,v_office_name,v_contacts,p_actor,v_cycle,v_gate2,v_dispatch,p_nda_expires_at)
  ON CONFLICT(match_id) DO UPDATE SET information_memo_document_id=EXCLUDED.information_memo_document_id,source_firm_id=EXCLUDED.source_firm_id,source_firm_name=EXCLUDED.source_firm_name,source_office_id=EXCLUDED.source_office_id,source_office_name=EXCLUDED.source_office_name,disclosed_contacts=EXCLUDED.disclosed_contacts,source_disclosed_at=clock_timestamp(),granted_by=EXCLUDED.granted_by,cycle_started_evidence_id=EXCLUDED.cycle_started_evidence_id,gate_2_evidence_id=EXCLUDED.gate_2_evidence_id,dispatch_evidence_id=EXCLUDED.dispatch_evidence_id,nda_expires_at=EXCLUDED.nda_expires_at,revoked_at=NULL,revoked_by=NULL,revoked_reason=NULL;
  v_event:=public.journey_append_evidence(p_match_id,'confidential_access_granted',p_actor,p_idempotency_key,NULL,v_doc.id,NULL,jsonb_build_object('cycle_started_evidence_id',v_cycle,'gate_2_evidence_id',v_gate2,'dispatch_evidence_id',v_dispatch,'information_memo_document_id',v_doc.id,'source_firm_name',v_firm_name,'source_office_name',v_office_name,'contact_names',v_contacts,'nda_expires_at',p_nda_expires_at));
  RETURN v_event;
END $$;

CREATE OR REPLACE FUNCTION public.journey_submit_repreneur_signed_copy_v2(p_match_id UUID,p_repreneur_id UUID,p_actor_email TEXT,p_title TEXT,p_storage_path TEXT,p_file_name TEXT,p_file_size BIGINT,p_content_sha256 TEXT)
RETURNS TABLE(artifact_id UUID,document_id UUID,version_number INTEGER,reused_existing BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r RECORD; v_path TEXT; BEGIN
 -- The core authorizes ownership and current Gate 1 before it may reuse a
 -- content-hash match; hashes are never an artifact-discovery side channel.
 SELECT * INTO r FROM public.journey_submit_repreneur_signed_copy(p_match_id,p_repreneur_id,p_actor_email,p_title,p_storage_path,p_file_name,p_file_size,p_content_sha256);
 SELECT storage_path INTO v_path FROM public.opportunity_documents WHERE id=r.document_id;
 RETURN QUERY SELECT r.artifact_id,r.document_id,r.version_number,v_path IS DISTINCT FROM p_storage_path;
END $$;
REVOKE ALL ON FUNCTION public.journey_submit_repreneur_signed_copy_v2(UUID,UUID,TEXT,TEXT,TEXT,TEXT,BIGINT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.journey_submit_repreneur_signed_copy_v2(UUID,UUID,TEXT,TEXT,TEXT,TEXT,BIGINT,TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.journey_submit_repreneur_signed_copy(p_match_id UUID,p_repreneur_id UUID,p_actor_email TEXT,p_title TEXT,p_storage_path TEXT,p_file_name TEXT,p_file_size BIGINT,p_content_sha256 TEXT)
RETURNS TABLE(artifact_id UUID,document_id UUID,version_number INTEGER) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE; v_email TEXT; v_gate UUID; v_prior UUID; v_version INTEGER; v_document UUID; v_artifact UUID; BEGIN
 IF NOT public.wave_journey_is_enabled() THEN RAISE EXCEPTION 'wave_journey_disabled'; END IF;
 SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE; SELECT LOWER(BTRIM(email)) INTO v_email FROM public.repreneurs WHERE id=p_repreneur_id;
 IF v_match.id IS NULL OR v_match.status<>'active_pursuit' OR v_match.repreneur_id<>p_repreneur_id OR v_email IS NULL OR v_email<>LOWER(BTRIM(p_actor_email)) THEN RAISE EXCEPTION 'Only the active pursuit repreneur may submit this signed copy.'; END IF;
 v_gate:=public.journey_current_gate_1_event(p_match_id); IF v_gate IS NULL THEN RAISE EXCEPTION 'Current Gate 1 is required before signed-copy submission.'; END IF;
 IF NULLIF(BTRIM(p_title),'') IS NULL OR NULLIF(BTRIM(p_storage_path),'') IS NULL OR LOWER(p_file_name) NOT LIKE '%.pdf' OR p_file_size<=0 OR LOWER(p_content_sha256)!~'^[0-9a-f]{64}$' OR p_storage_path NOT LIKE v_match.opportunity_id::TEXT||'/nda-artifacts/repreneur_signed_copy/%' THEN RAISE EXCEPTION 'Submit one retained PDF in the canonical signed-copy path.'; END IF;
 SELECT a.id,a.version_number INTO v_artifact,v_version FROM public.opportunity_nda_artifacts a WHERE a.match_id=p_match_id AND a.artifact_role='repreneur_signed_copy' AND a.content_sha256=LOWER(p_content_sha256) LIMIT 1;
 IF v_artifact IS NOT NULL THEN RETURN QUERY SELECT v_artifact,(SELECT a.document_id FROM public.opportunity_nda_artifacts a WHERE a.id=v_artifact),v_version; RETURN; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_match_id::TEXT||':repreneur_signed_copy',0));
 SELECT a.id,a.document_id,a.version_number INTO v_artifact,v_document,v_version FROM public.opportunity_nda_artifacts a WHERE a.match_id=p_match_id AND a.artifact_role='repreneur_signed_copy' AND a.content_sha256=LOWER(p_content_sha256) LIMIT 1;
 IF v_artifact IS NOT NULL THEN RETURN QUERY SELECT v_artifact,v_document,v_version; RETURN; END IF;
 SELECT a.id,a.version_number+1 INTO v_prior,v_version FROM public.opportunity_nda_artifacts a WHERE a.match_id=p_match_id AND a.artifact_role='repreneur_signed_copy' ORDER BY a.version_number DESC LIMIT 1; v_version:=COALESCE(v_version,1);
 INSERT INTO public.opportunity_documents(opportunity_id,title,document_type,visibility,storage_bucket,storage_path,file_name,size_bytes,mime_type,uploaded_by) VALUES(v_match.opportunity_id,p_title,'nda','staff_only','opportunity-documents',p_storage_path,p_file_name,p_file_size,'application/pdf',p_actor_email) RETURNING id INTO v_document;
 PERFORM set_config('wave.journey_portal_repreneur_upload','on',true);
 INSERT INTO public.opportunity_nda_artifacts(opportunity_id,match_id,document_id,artifact_role,version_number,content_sha256,supersedes_artifact_id,recorded_by,recorded_at) VALUES(v_match.opportunity_id,p_match_id,v_document,'repreneur_signed_copy',v_version,LOWER(p_content_sha256),v_prior,p_actor_email,clock_timestamp()) RETURNING id INTO v_artifact;
 RETURN QUERY SELECT v_artifact,v_document,v_version;
EXCEPTION WHEN unique_violation THEN
 SELECT a.id,a.document_id,a.version_number INTO v_artifact,v_document,v_version FROM public.opportunity_nda_artifacts a WHERE a.match_id=p_match_id AND a.artifact_role='repreneur_signed_copy' AND a.content_sha256=LOWER(p_content_sha256) LIMIT 1;
 IF v_artifact IS NULL THEN RAISE; END IF; RETURN QUERY SELECT v_artifact,v_document,v_version;
END $$;

-- Keep migration 082's registered, lock-safe staff RPC unchanged. This origin
-- guard makes its repreneur role fail unless the canonical portal RPC marked
-- the transaction after ownership and Gate 1 validation.
CREATE OR REPLACE FUNCTION public.wave_journey_guard_repreneur_artifact_origin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.artifact_role='repreneur_signed_copy' AND current_setting('wave.journey_portal_repreneur_upload',true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Repreneur signed copies may be submitted only by the active repreneur after Gate 1.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS wave_journey_guard_repreneur_artifact_origin ON public.opportunity_nda_artifacts;
CREATE TRIGGER wave_journey_guard_repreneur_artifact_origin BEFORE INSERT ON public.opportunity_nda_artifacts FOR EACH ROW EXECUTE FUNCTION public.wave_journey_guard_repreneur_artifact_origin();

-- The notification claim is intentionally replaced, not supplemented.  A
-- legacy NDA flag or document visibility can never claim delivery again.
CREATE OR REPLACE FUNCTION public.claim_opportunity_memo_notification(p_opportunity_id UUID,p_match_id UUID DEFAULT NULL,p_attempted_at TIMESTAMPTZ DEFAULT NOW())
RETURNS TABLE(match_id UUID,opportunity_id UUID,repreneur_id UUID,recipient_email TEXT,repreneur_first_name TEXT,opportunity_title TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v public.opportunity_matches%ROWTYPE; v_email TEXT; v_first TEXT; v_title TEXT; v_claim UUID;
BEGIN
 SELECT m.* INTO v FROM public.opportunity_matches m JOIN public.opportunities o ON o.id=m.opportunity_id JOIN public.opportunity_pursuit_confidential_grants g ON g.match_id=m.id JOIN public.repreneurs r ON r.id=m.repreneur_id LEFT JOIN public.opportunity_memo_notifications n ON n.match_id=m.id
 WHERE m.opportunity_id=p_opportunity_id AND (p_match_id IS NULL OR m.id=p_match_id) AND m.status='active_pursuit' AND o.status='active' AND g.revoked_at IS NULL AND g.nda_expires_at>p_attempted_at
 AND g.cycle_started_evidence_id=public.journey_current_cycle_event(m.id) AND g.gate_2_evidence_id=public.journey_current_gate_2_event(m.id) AND g.dispatch_evidence_id=public.journey_current_dispatch_event(m.id)
 AND NULLIF(BTRIM(r.email),'') IS NOT NULL AND (n.match_id IS NULL OR (n.sent_at IS NULL AND (n.status IN ('pending','failed') OR (n.status='sending' AND n.last_attempt_at<p_attempted_at-INTERVAL '15 minutes')))) ORDER BY m.updated_at DESC LIMIT 1 FOR UPDATE OF m;
 IF v.id IS NULL THEN RETURN; END IF;
 SELECT BTRIM(email),COALESCE(NULLIF(BTRIM(first_name),''),'Madame, Monsieur') INTO v_email,v_first FROM public.repreneurs WHERE id=v.repreneur_id; SELECT COALESCE(NULLIF(BTRIM(public_title),''),'votre opportunite') INTO v_title FROM public.opportunities WHERE id=v.opportunity_id;
 INSERT INTO public.opportunity_memo_notifications(match_id,opportunity_id,repreneur_id,recipient_email) VALUES(v.id,v.opportunity_id,v.repreneur_id,v_email) ON CONFLICT ON CONSTRAINT opportunity_memo_notifications_match_id_key DO UPDATE SET recipient_email=EXCLUDED.recipient_email,updated_at=p_attempted_at WHERE opportunity_memo_notifications.sent_at IS NULL;
 UPDATE public.opportunity_memo_notifications n SET status='sending',attempt_count=n.attempt_count+1,last_attempt_at=p_attempted_at,failed_at=NULL,last_error=NULL,updated_at=p_attempted_at WHERE n.match_id=v.id AND n.sent_at IS NULL AND (n.status IN ('pending','failed') OR (n.status='sending' AND n.last_attempt_at<p_attempted_at-INTERVAL '15 minutes')) RETURNING n.match_id INTO v_claim;
 IF v_claim IS NULL THEN RETURN; END IF;
 RETURN QUERY SELECT v.id,v.opportunity_id,v.repreneur_id,v_email,v_first,v_title;
END $$;

REVOKE ALL ON FUNCTION public.journey_current_cycle_event(UUID),public.journey_current_cycle_started_at(UUID),public.journey_current_template_id(UUID),public.journey_current_gate_1_event(UUID),public.journey_current_signed_validation_event(UUID,public.opportunity_nda_artifact_role),public.journey_current_gate_2_event(UUID),public.journey_current_dispatch_event(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.journey_current_cycle_event(UUID),public.journey_current_cycle_started_at(UUID),public.journey_current_template_id(UUID),public.journey_current_gate_1_event(UUID),public.journey_current_signed_validation_event(UUID,public.opportunity_nda_artifact_role),public.journey_current_gate_2_event(UUID),public.journey_current_dispatch_event(UUID) TO service_role;
REVOKE EXECUTE ON FUNCTION public.journey_grant_confidential_access(UUID,UUID,TEXT,TEXT) FROM service_role;
DROP FUNCTION public.journey_grant_confidential_access(UUID,UUID,TEXT,TEXT);
REVOKE EXECUTE ON FUNCTION public.journey_submit_repreneur_signed_copy(UUID,UUID,TEXT,TEXT,TEXT,TEXT,BIGINT,TEXT) FROM service_role;
GRANT EXECUTE ON FUNCTION public.journey_grant_confidential_access(UUID,UUID,TEXT,TEXT,TIMESTAMPTZ) TO service_role;

-- Compatibility cutover is deliberately narrow: a currently active pursuit
-- proves only that its journey started.  It proves no qualification, template,
-- signature, Gate 1/2, dispatch or disclosure fact, so every such record
-- appears in the staff Evidence required queue until facts are earned anew.
INSERT INTO public.opportunity_pursuit_evidence(match_id,opportunity_id,repreneur_id,event_type,actor,evidence_reference,idempotency_key,recorded_at)
SELECT m.id,m.opportunity_id,m.repreneur_id,'mutual_interest_validated','migration:088','legacy active-pursuit start only; no gate inferred','migration:088:active-pursuit-start:'||m.id::TEXT,COALESCE(m.pursuit_stage_updated_at,m.updated_at,NOW())
FROM public.opportunity_matches m
WHERE m.status='active_pursuit'
ON CONFLICT(match_id,idempotency_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.wave_journey_guard_opportunity_lifecycle()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r RECORD; BEGIN
 IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status='active' THEN RETURN NEW; END IF;
 IF NEW.status IN ('closed','archived') AND EXISTS(SELECT 1 FROM public.opportunity_matches WHERE opportunity_id=NEW.id AND status='active_pursuit') AND current_setting('wave.journey_terminal_transition',true) IS DISTINCT FROM 'on' THEN
   RAISE EXCEPTION 'Active pursuit must be dropped or completed through the canonical journey before closing or archiving the opportunity.';
 END IF;
 FOR r IN SELECT id FROM public.opportunity_matches WHERE opportunity_id=NEW.id AND status='active_pursuit' LOOP
   UPDATE public.opportunity_pursuit_confidential_grants SET revoked_at=NOW(),revoked_by='system:opportunity-status',revoked_reason='opportunity_'||NEW.status WHERE match_id=r.id AND revoked_at IS NULL;
   IF FOUND THEN
     INSERT INTO public.opportunity_pursuit_evidence(match_id,opportunity_id,repreneur_id,event_type,actor,evidence_reference,idempotency_key,metadata)
     SELECT m.id,m.opportunity_id,m.repreneur_id,'access_revoked','system:opportunity-status','opportunity status changed to '||NEW.status,'opportunity-status:'||NEW.id::TEXT||':'||NEW.status||':'||r.id::TEXT||':'||COALESCE((SELECT source_disclosed_at::TEXT FROM public.opportunity_pursuit_confidential_grants WHERE match_id=r.id),'unknown'),jsonb_build_object('cycle_started_evidence_id',public.journey_current_cycle_event(r.id)) FROM public.opportunity_matches m WHERE m.id=r.id
     ON CONFLICT(match_id,idempotency_key) DO NOTHING;
   END IF;
 END LOOP;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS wave_journey_guard_opportunity_lifecycle ON public.opportunities;
CREATE TRIGGER wave_journey_guard_opportunity_lifecycle BEFORE UPDATE OF status ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.wave_journey_guard_opportunity_lifecycle();

CREATE OR REPLACE FUNCTION public.journey_transition_terminal(p_match_id UUID,p_transition TEXT,p_actor TEXT,p_idempotency_key TEXT,p_closure_reason TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE; v_event UUID; BEGIN
 IF NOT public.wave_journey_is_enabled() THEN RAISE EXCEPTION 'wave_journey_disabled'; END IF;
 SELECT id INTO v_event FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND idempotency_key=p_idempotency_key; IF v_event IS NOT NULL THEN RETURN v_event; END IF;
 SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE; IF v_match.id IS NULL THEN RAISE EXCEPTION 'Pursuit not found.'; END IF;
 IF p_transition='continue' THEN IF v_match.status<>'active_pursuit' OR NOT public.journey_repreneur_can_access_confidential(p_match_id,v_match.repreneur_id,(SELECT information_memo_document_id FROM public.opportunity_pursuit_confidential_grants WHERE match_id=p_match_id)) THEN RAISE EXCEPTION 'Continue requires a live current confidential grant.'; END IF; RETURN public.journey_append_evidence(p_match_id,'continued',p_actor,p_idempotency_key); END IF;
 IF p_transition='drop' THEN IF v_match.status<>'active_pursuit' THEN RAISE EXCEPTION 'Only an active pursuit can be dropped.'; END IF; PERFORM public.journey_revoke_confidential_access(p_match_id,p_actor,'dropped',p_idempotency_key||':revoke'); UPDATE public.opportunity_matches SET status='dropped',pursuit_stage='dropped',pursuit_stage_updated_by=p_actor,pursuit_stage_updated_at=NOW() WHERE id=p_match_id; RETURN public.journey_append_evidence(p_match_id,'dropped',p_actor,p_idempotency_key); END IF;
 IF p_transition='complete' THEN IF v_match.status<>'active_pursuit' OR NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND event_type='continued' AND recorded_at>=public.journey_current_cycle_started_at(p_match_id)) THEN RAISE EXCEPTION 'Complete requires current continued external follow-up.'; END IF; PERFORM public.journey_revoke_confidential_access(p_match_id,p_actor,'completed',p_idempotency_key||':revoke'); UPDATE public.opportunity_matches SET status='completed',pursuit_stage='closed',pursuit_stage_updated_by=p_actor,pursuit_stage_updated_at=NOW() WHERE id=p_match_id; PERFORM set_config('wave.journey_terminal_transition','on',true); UPDATE public.opportunities SET status='closed',updated_by=p_actor WHERE id=v_match.opportunity_id; INSERT INTO public.opportunity_closure_history(opportunity_id,reason,closed_by) VALUES(v_match.opportunity_id,'signed_repreneur'::public.opportunity_closure_reason,p_actor); RETURN public.journey_append_evidence(p_match_id,'completed',p_actor,p_idempotency_key,NULL,NULL,p_closure_reason); END IF;
 IF p_transition='reopen' THEN IF v_match.status<>'dropped' THEN RAISE EXCEPTION 'Only a dropped pursuit can reopen.'; END IF; UPDATE public.opportunity_matches SET status='interested',pursuit_stage=NULL,pursuit_stage_notes=NULL,pursuit_stage_updated_by=p_actor,pursuit_stage_updated_at=NOW() WHERE id=p_match_id; RETURN public.journey_append_evidence(p_match_id,'reopened',p_actor,p_idempotency_key); END IF;
 RAISE EXCEPTION 'Unsupported pursuit transition.';
END $$;
