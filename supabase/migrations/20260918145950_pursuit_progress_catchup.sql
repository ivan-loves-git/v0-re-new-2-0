-- Decision #151 / Ticket #152. This operator is intentionally inert until a
-- separately prepared, exact private manifest is supplied. Source milestones
-- establish staff-confirmed operating progress only: they never establish a
-- document, a Gate, an NDA date, a handoff, or confidential access.
ALTER TABLE public.opportunity_matches
  ADD COLUMN IF NOT EXISTS pursuit_stage_provenance TEXT
  CHECK (pursuit_stage_provenance IN ('staff_confirmed_history'));

CREATE FUNCTION public.clear_nonactive_pursuit_stage_provenance()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.status <> 'active_pursuit' THEN NEW.pursuit_stage_provenance := NULL; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER opportunity_matches_clear_nonactive_pursuit_stage_provenance
BEFORE INSERT OR UPDATE OF status ON public.opportunity_matches
FOR EACH ROW EXECUTE FUNCTION public.clear_nonactive_pursuit_stage_provenance();

CREATE FUNCTION public.pursuit_progress_catchup_children_sha(p_match_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT encode(extensions.digest(convert_to(jsonb_build_object(
    'evidence',COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM public.opportunity_pursuit_evidence e WHERE e.match_id=p_match_id),'[]'::jsonb),
    -- journey_start_pursuit also snapshots an opportunity-level blank template,
    -- so bind that unassigned artifact into the fingerprint as well.
    'artifacts',COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM public.opportunity_nda_artifacts a WHERE a.match_id=p_match_id OR (a.match_id IS NULL AND a.opportunity_id=(SELECT m.opportunity_id FROM public.opportunity_matches m WHERE m.id=p_match_id))),'[]'::jsonb),
    'grants',COALESCE((SELECT jsonb_agg(to_jsonb(g) ORDER BY g.id) FROM public.opportunity_pursuit_confidential_grants g WHERE g.match_id=p_match_id),'[]'::jsonb),
    'events',COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM public.opportunity_pursuit_events e WHERE e.match_id=p_match_id),'[]'::jsonb),
    'notifications',COALESCE((SELECT jsonb_agg(to_jsonb(n) ORDER BY n.id) FROM public.opportunity_recommendation_assignment_notifications n WHERE n.match_id=p_match_id),'[]'::jsonb),
    'documents',COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.id) FROM public.opportunity_documents d JOIN public.opportunity_matches m ON m.opportunity_id=d.opportunity_id WHERE m.id=p_match_id),'[]'::jsonb)
  )::text,'UTF8'),'sha256'),'hex')
$$;
REVOKE ALL ON FUNCTION public.pursuit_progress_catchup_children_sha(UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pursuit_progress_catchup_children_sha(UUID) FROM service_role;

CREATE TABLE public.pursuit_progress_catchup_batches (
  id TEXT PRIMARY KEY CHECK (id = 'v4-ongoing-pursuit-progress-2026-09-18'),
  manifest_sha256 TEXT NOT NULL CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  manifest JSONB NOT NULL CHECK (jsonb_typeof(manifest) = 'object'),
  applied_by TEXT NOT NULL CHECK (btrim(applied_by) <> ''),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE public.pursuit_progress_catchup_receipts (
  batch_id TEXT NOT NULL REFERENCES public.pursuit_progress_catchup_batches(id),
  source_row INTEGER NOT NULL,
  ledger_id UUID NOT NULL REFERENCES public.historical_pursuit_import_rows(id),
  match_id UUID NOT NULL REFERENCES public.opportunity_matches(id),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id),
  source_stage TEXT NOT NULL,
  target_stage public.opportunity_pursuit_stage NOT NULL,
  before_match JSONB NOT NULL,
  before_children_sha256 TEXT NOT NULL CHECK (before_children_sha256 ~ '^[0-9a-f]{64}$'),
  after_match_sha256 TEXT NOT NULL CHECK (after_match_sha256 ~ '^[0-9a-f]{64}$'),
  after_children_sha256 TEXT NOT NULL CHECK (after_children_sha256 ~ '^[0-9a-f]{64}$'),
  mutual_interest_evidence_id UUID REFERENCES public.opportunity_pursuit_evidence(id),
  PRIMARY KEY (batch_id, source_row),
  UNIQUE (ledger_id), UNIQUE (match_id), UNIQUE (opportunity_id)
);

ALTER TABLE public.pursuit_progress_catchup_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pursuit_progress_catchup_batches FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pursuit_progress_catchup_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pursuit_progress_catchup_receipts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.pursuit_progress_catchup_batches, public.pursuit_progress_catchup_receipts FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER pursuit_progress_catchup_batches_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.pursuit_progress_catchup_batches FOR EACH STATEMENT EXECUTE FUNCTION public.historical_pursuit_import_rows_immutable();
CREATE TRIGGER pursuit_progress_catchup_receipts_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.pursuit_progress_catchup_receipts FOR EACH STATEMENT EXECUTE FUNCTION public.historical_pursuit_import_rows_immutable();

CREATE FUNCTION public.apply_pursuit_progress_catchup(p_manifest JSONB, p_actor TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_id CONSTANT TEXT := 'v4-ongoing-pursuit-progress-2026-09-18';
  v_sha CONSTANT TEXT := 'f527683a09d1e67e2c01479c20529963b7b1760578ff558181cad18c7febfbd3';
  v_digest TEXT; v_row JSONB; v_ledger public.historical_pursuit_import_rows%ROWTYPE;
  v_match public.opportunity_matches%ROWTYPE; v_target public.opportunity_pursuit_stage;
  v_event UUID; v_before JSONB; v_children TEXT; v_effective_match_id UUID; v_expected TEXT[] := ARRAY['11','14','21','33','34','36','38','39','40','41','50','57','58','61','62','65','68','73'];
BEGIN
  IF (SELECT count(*) FROM public.app_user_roles WHERE role='staff' AND (user_id=p_actor OR email=p_actor)) <> 1 THEN RAISE EXCEPTION 'pursuit_progress_catchup_staff_required'; END IF;
  IF jsonb_typeof(p_manifest) IS DISTINCT FROM 'object' OR p_manifest->>'version' IS DISTINCT FROM '1' OR p_manifest->>'batchId' IS DISTINCT FROM v_id OR p_manifest->>'sourceSha' IS DISTINCT FROM v_sha
    OR jsonb_typeof(p_manifest->'rows') <> 'array' OR jsonb_array_length(p_manifest->'rows') <> 18
    OR (SELECT count(DISTINCT value->>'opportunityId') FROM jsonb_array_elements(p_manifest->'rows')) <> 18
  THEN RAISE EXCEPTION 'pursuit_progress_catchup_exact_18_required'; END IF;
  IF (SELECT array_agg(value->>'sourceRow' ORDER BY (value->>'sourceRow')::integer) FROM jsonb_array_elements(p_manifest->'rows')) IS DISTINCT FROM v_expected THEN RAISE EXCEPTION 'pursuit_progress_catchup_source_set_changed'; END IF;
  v_digest := encode(extensions.digest(convert_to(p_manifest::text,'UTF8'),'sha256'),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(v_id,151));
  -- The manifest fingerprints span these relations.  A short, private table
  -- lock makes their before/after images one atomic operator boundary, rather
  -- than allowing an unrelated document, evidence or grant write between its
  -- preflight and receipt creation.
  LOCK TABLE public.historical_pursuit_import_rows, public.opportunity_matches,
    public.opportunities, public.repreneurs, public.opportunity_pursuit_evidence,
    public.opportunity_nda_artifacts, public.opportunity_pursuit_confidential_grants,
    public.opportunity_pursuit_events, public.opportunity_recommendation_assignment_notifications,
    public.opportunity_documents IN SHARE ROW EXCLUSIVE MODE;
  IF EXISTS(SELECT 1 FROM public.pursuit_progress_catchup_batches WHERE id=v_id) THEN
    IF EXISTS(SELECT 1 FROM public.pursuit_progress_catchup_batches b WHERE b.id=v_id AND b.manifest_sha256=v_digest
      AND (SELECT count(*) FROM public.pursuit_progress_catchup_receipts r JOIN public.opportunity_matches m ON m.id=r.match_id WHERE r.batch_id=v_id AND r.after_match_sha256=encode(sha256(convert_to(to_jsonb(m)::text,'UTF8')),'hex') AND r.after_children_sha256 IS NOT DISTINCT FROM public.pursuit_progress_catchup_children_sha(r.match_id))=18)
    THEN RETURN jsonb_build_object('outcome','replay','rows',18); END IF;
    RAISE EXCEPTION 'pursuit_progress_catchup_already_applied';
  END IF;
  -- Preflight every row before any update. The private preparer pins IDs and
  -- row/match fingerprints; the database recomputes them under the same locks.
  FOR v_row IN SELECT value FROM jsonb_array_elements(p_manifest->'rows') ORDER BY (value->>'sourceRow')::integer LOOP
    SELECT * INTO v_ledger FROM public.historical_pursuit_import_rows WHERE source_sha256=v_sha AND source_row=(v_row->>'sourceRow')::integer FOR UPDATE;
    SELECT match_id INTO v_effective_match_id FROM public.historical_pursuit_resolved_rows WHERE id=v_ledger.id;
    IF v_ledger.id IS NULL OR v_ledger.id::text IS DISTINCT FROM v_row->>'ledgerId' OR v_ledger.source_terminal OR v_effective_match_id::text IS DISTINCT FROM v_row->>'matchId'
      OR v_ledger.last_reported_source_stage IS DISTINCT FROM v_row->>'sourceStage' THEN RAISE EXCEPTION 'pursuit_progress_catchup_ledger_drift'; END IF;
    SELECT * INTO v_match FROM public.opportunity_matches WHERE id=v_effective_match_id FOR UPDATE;
    IF v_match.id IS NULL OR v_match.status NOT IN ('draft','interested','active_pursuit') OR v_match.opportunity_id::text IS DISTINCT FROM v_row->>'opportunityId'
      OR encode(sha256(convert_to(to_jsonb(v_match)::text,'UTF8')),'hex') IS DISTINCT FROM v_row->>'matchFingerprint'
      OR v_match.status::text IS DISTINCT FROM v_row->>'expectedStatus' THEN RAISE EXCEPTION 'pursuit_progress_catchup_match_drift'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.opportunities o JOIN public.repreneurs r ON r.id=v_match.repreneur_id WHERE o.id=v_match.opportunity_id AND o.status='active' AND o.is_demo=FALSE AND r.is_demo=FALSE) THEN RAISE EXCEPTION 'pursuit_progress_catchup_target_ineligible'; END IF;
    IF EXISTS(SELECT 1 FROM public.opportunity_matches x WHERE x.opportunity_id=v_match.opportunity_id AND x.status='active_pursuit' AND x.id<>v_match.id) THEN RAISE EXCEPTION 'pursuit_progress_catchup_active_conflict'; END IF;
    IF EXISTS(SELECT 1 FROM public.opportunity_pursuit_confidential_grants g WHERE g.match_id=v_match.id AND g.revoked_at IS NULL) THEN RAISE EXCEPTION 'pursuit_progress_catchup_live_grant'; END IF;
    SELECT public.pursuit_progress_catchup_children_sha(v_match.id) INTO v_children;
    IF v_children IS DISTINCT FROM v_row->>'childrenFingerprint' THEN RAISE EXCEPTION 'pursuit_progress_catchup_children_drift'; END IF;
    IF v_match.status='active_pursuit' AND (CASE WHEN v_match.pursuit_stage IS NULL THEN 0 ELSE CASE v_match.pursuit_stage WHEN 'interest' THEN 1 WHEN 'nda_signed' THEN 2 WHEN 'info_memo_received' THEN 3 WHEN 'qa_with_ma_firm' THEN 4 WHEN 'intermediary_meeting' THEN 5 WHEN 'seller_meeting' THEN 6 WHEN 'loi' THEN 7 ELSE 99 END END)
      > (CASE v_ledger.last_reported_source_stage WHEN 'interest_confirmed' THEN 1 WHEN 'nda_signed' THEN 2 WHEN 'info_memo_received' THEN 3 WHEN 'qa_with_ma_firm' THEN 4 WHEN 'seller_meeting' THEN 6 WHEN 'loi_issued' THEN 7 ELSE -1 END)
    THEN RAISE EXCEPTION 'pursuit_progress_catchup_stage_regression'; END IF;
  END LOOP;
  INSERT INTO public.pursuit_progress_catchup_batches(id,manifest_sha256,manifest,applied_by) VALUES(v_id,v_digest,p_manifest,p_actor);
  FOR v_row IN SELECT value FROM jsonb_array_elements(p_manifest->'rows') ORDER BY (value->>'sourceRow')::integer LOOP
    SELECT * INTO v_ledger FROM public.historical_pursuit_import_rows WHERE source_sha256=v_sha AND source_row=(v_row->>'sourceRow')::integer;
    SELECT match_id INTO v_effective_match_id FROM public.historical_pursuit_resolved_rows WHERE id=v_ledger.id;
    SELECT * INTO v_match FROM public.opportunity_matches WHERE id=v_effective_match_id FOR UPDATE;
    v_before:=to_jsonb(v_match);
    SELECT public.pursuit_progress_catchup_children_sha(v_match.id) INTO v_children;
    v_target := CASE v_ledger.last_reported_source_stage
      WHEN 'interest_confirmed' THEN 'interest'::public.opportunity_pursuit_stage
      WHEN 'nda_signed' THEN 'nda_signed'::public.opportunity_pursuit_stage
      WHEN 'info_memo_received' THEN 'info_memo_received'::public.opportunity_pursuit_stage
      WHEN 'qa_with_ma_firm' THEN 'qa_with_ma_firm'::public.opportunity_pursuit_stage
      WHEN 'seller_meeting' THEN 'seller_meeting'::public.opportunity_pursuit_stage
      WHEN 'loi_issued' THEN 'loi'::public.opportunity_pursuit_stage
      ELSE NULL END;
    IF v_target IS NULL THEN RAISE EXCEPTION 'pursuit_progress_catchup_stage_invalid'; END IF;
    v_event:=NULL;
    IF v_match.status<>'active_pursuit' THEN
      IF v_match.status='draft' THEN UPDATE public.opportunity_matches SET status='interested' WHERE id=v_match.id; END IF;
      v_event:=public.journey_start_pursuit(v_match.id,p_actor,v_id||':'||v_ledger.id::text,NULL);
    END IF;
    UPDATE public.opportunity_matches SET status='active_pursuit',pursuit_stage=v_target,pursuit_stage_provenance='staff_confirmed_history',pursuit_stage_updated_by=p_actor,pursuit_stage_updated_at=clock_timestamp() WHERE id=v_match.id;
    INSERT INTO public.pursuit_progress_catchup_receipts(batch_id,source_row,ledger_id,match_id,opportunity_id,source_stage,target_stage,before_match,before_children_sha256,after_match_sha256,after_children_sha256,mutual_interest_evidence_id)
    SELECT v_id,v_ledger.source_row,v_ledger.id,v_match.id,v_match.opportunity_id,v_ledger.last_reported_source_stage,v_target,v_before,v_children,encode(sha256(convert_to(to_jsonb(m)::text,'UTF8')),'hex'),public.pursuit_progress_catchup_children_sha(v_match.id),v_event FROM public.opportunity_matches m WHERE m.id=v_match.id;
  END LOOP;
  RETURN jsonb_build_object('outcome','applied','rows',18);
END $$;
REVOKE ALL ON FUNCTION public.apply_pursuit_progress_catchup(JSONB,TEXT) FROM PUBLIC,anon,authenticated,service_role;

-- A compensation is deliberately not a destructive rollback.  The current
-- mutual-interest evidence remains a truthful record of this correction; only
-- the mutable match fields are returned to their pre-catch-up values.  Any
-- subsequent staff work makes the compensation fail closed through the exact
-- after-image hashes retained above.
CREATE TABLE public.pursuit_progress_catchup_compensations (
  original_batch_id TEXT PRIMARY KEY REFERENCES public.pursuit_progress_catchup_batches(id),
  compensated_by TEXT NOT NULL CHECK (btrim(compensated_by) <> ''),
  reason TEXT NOT NULL CHECK (btrim(reason) <> ''),
  compensated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE public.pursuit_progress_catchup_compensation_receipts (
  original_batch_id TEXT NOT NULL,
  source_row INTEGER NOT NULL,
  match_id UUID NOT NULL REFERENCES public.opportunity_matches(id),
  before_compensation_match_sha256 TEXT NOT NULL CHECK (before_compensation_match_sha256 ~ '^[0-9a-f]{64}$'),
  before_compensation_children_sha256 TEXT NOT NULL CHECK (before_compensation_children_sha256 ~ '^[0-9a-f]{64}$'),
  restored_fields JSONB NOT NULL CHECK (jsonb_typeof(restored_fields) = 'object'),
  after_compensation_match_sha256 TEXT NOT NULL CHECK (after_compensation_match_sha256 ~ '^[0-9a-f]{64}$'),
  PRIMARY KEY (original_batch_id, source_row),
  FOREIGN KEY (original_batch_id, source_row)
    REFERENCES public.pursuit_progress_catchup_receipts(batch_id, source_row)
);

ALTER TABLE public.pursuit_progress_catchup_compensations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pursuit_progress_catchup_compensations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pursuit_progress_catchup_compensation_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pursuit_progress_catchup_compensation_receipts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.pursuit_progress_catchup_compensations, public.pursuit_progress_catchup_compensation_receipts FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER pursuit_progress_catchup_compensations_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.pursuit_progress_catchup_compensations FOR EACH STATEMENT EXECUTE FUNCTION public.historical_pursuit_import_rows_immutable();
CREATE TRIGGER pursuit_progress_catchup_compensation_receipts_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.pursuit_progress_catchup_compensation_receipts FOR EACH STATEMENT EXECUTE FUNCTION public.historical_pursuit_import_rows_immutable();

CREATE FUNCTION public.compensate_pursuit_progress_catchup(p_actor TEXT, p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_id CONSTANT TEXT := 'v4-ongoing-pursuit-progress-2026-09-18';
  v_receipt public.pursuit_progress_catchup_receipts%ROWTYPE;
  v_match public.opportunity_matches%ROWTYPE;
  v_restored JSONB;
BEGIN
  IF (SELECT count(*) FROM public.app_user_roles WHERE role='staff' AND (user_id=p_actor OR email=p_actor)) <> 1 THEN RAISE EXCEPTION 'pursuit_progress_catchup_staff_required'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'pursuit_progress_catchup_compensation_reason_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_id,151));
  LOCK TABLE public.opportunity_matches, public.opportunity_pursuit_evidence,
    public.opportunity_nda_artifacts, public.opportunity_pursuit_confidential_grants,
    public.opportunity_pursuit_events, public.opportunity_recommendation_assignment_notifications,
    public.opportunity_documents IN SHARE ROW EXCLUSIVE MODE;
  IF NOT EXISTS(SELECT 1 FROM public.pursuit_progress_catchup_batches WHERE id=v_id)
    OR (SELECT count(*) FROM public.pursuit_progress_catchup_receipts WHERE batch_id=v_id) <> 18
  THEN RAISE EXCEPTION 'pursuit_progress_catchup_missing_original_receipts'; END IF;
  IF EXISTS(SELECT 1 FROM public.pursuit_progress_catchup_compensations WHERE original_batch_id=v_id) THEN RAISE EXCEPTION 'pursuit_progress_catchup_already_compensated'; END IF;

  -- Lock and prove every after-image before changing even the first record.
  FOR v_receipt IN SELECT * FROM public.pursuit_progress_catchup_receipts WHERE batch_id=v_id ORDER BY source_row FOR UPDATE LOOP
    SELECT * INTO v_match FROM public.opportunity_matches WHERE id=v_receipt.match_id FOR UPDATE;
    IF v_match.id IS NULL
      OR encode(sha256(convert_to(to_jsonb(v_match)::text,'UTF8')),'hex') IS DISTINCT FROM v_receipt.after_match_sha256
      OR public.pursuit_progress_catchup_children_sha(v_match.id) IS DISTINCT FROM v_receipt.after_children_sha256
      OR EXISTS(SELECT 1 FROM public.opportunity_pursuit_confidential_grants g WHERE g.match_id=v_match.id AND g.revoked_at IS NULL)
      OR (v_receipt.mutual_interest_evidence_id IS NOT NULL AND NOT EXISTS(
        SELECT 1 FROM public.opportunity_pursuit_evidence e WHERE e.id=v_receipt.mutual_interest_evidence_id AND e.match_id=v_match.id AND e.event_type='mutual_interest_validated'
      ))
    THEN RAISE EXCEPTION 'pursuit_progress_catchup_compensation_drift'; END IF;
  END LOOP;

  INSERT INTO public.pursuit_progress_catchup_compensations(original_batch_id,compensated_by,reason) VALUES(v_id,p_actor,p_reason);
  FOR v_receipt IN SELECT * FROM public.pursuit_progress_catchup_receipts WHERE batch_id=v_id ORDER BY source_row LOOP
    SELECT * INTO v_match FROM public.opportunity_matches WHERE id=v_receipt.match_id FOR UPDATE;
    v_restored := jsonb_build_object(
      'status',v_receipt.before_match->'status',
      'pursuit_stage',v_receipt.before_match->'pursuit_stage',
      'pursuit_stage_provenance',v_receipt.before_match->'pursuit_stage_provenance',
      'pursuit_stage_updated_by',v_receipt.before_match->'pursuit_stage_updated_by',
      'pursuit_stage_updated_at',v_receipt.before_match->'pursuit_stage_updated_at',
      'reviewed_by',v_receipt.before_match->'reviewed_by',
      'reviewed_at',v_receipt.before_match->'reviewed_at'
    );
    UPDATE public.opportunity_matches SET
      status=(v_receipt.before_match->>'status')::public.opportunity_match_status,
      pursuit_stage=CASE WHEN v_receipt.before_match->>'pursuit_stage' IS NULL THEN NULL ELSE (v_receipt.before_match->>'pursuit_stage')::public.opportunity_pursuit_stage END,
      pursuit_stage_provenance=v_receipt.before_match->>'pursuit_stage_provenance',
      pursuit_stage_updated_by=v_receipt.before_match->>'pursuit_stage_updated_by',
      pursuit_stage_updated_at=(v_receipt.before_match->>'pursuit_stage_updated_at')::timestamptz,
      reviewed_by=v_receipt.before_match->>'reviewed_by',
      reviewed_at=(v_receipt.before_match->>'reviewed_at')::timestamptz
      WHERE id=v_match.id;
    INSERT INTO public.pursuit_progress_catchup_compensation_receipts(original_batch_id,source_row,match_id,before_compensation_match_sha256,before_compensation_children_sha256,restored_fields,after_compensation_match_sha256)
    SELECT v_id,v_receipt.source_row,v_match.id,encode(sha256(convert_to(to_jsonb(v_match)::text,'UTF8')),'hex'),public.pursuit_progress_catchup_children_sha(v_match.id),v_restored,encode(sha256(convert_to(to_jsonb(m)::text,'UTF8')),'hex') FROM public.opportunity_matches m WHERE m.id=v_match.id;
  END LOOP;
  RETURN jsonb_build_object('outcome','compensated','rows',18,'evidenceRetained',true);
END $$;
REVOKE ALL ON FUNCTION public.compensate_pursuit_progress_catchup(TEXT,TEXT) FROM PUBLIC,anon,authenticated,service_role;
