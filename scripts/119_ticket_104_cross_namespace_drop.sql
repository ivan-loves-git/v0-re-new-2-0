-- Ticket #104: one-time, manifest-bound treatment of the nine retained
-- historical cross-namespace matches.  The manifest is deliberately supplied
-- at execution time from the gitignored operator file: this migration contains
-- no customer, opportunity, repreneur or match identifier.
--
-- Apply only through public.apply_ticket_104_cross_namespace_drop(jsonb,text)
-- as service_role in one transaction.  It is intentionally not a general
-- repair endpoint.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ticket_104_cross_namespace_drop_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manifest_digest TEXT NOT NULL UNIQUE,
  manifest_fingerprint TEXT NOT NULL,
  actor TEXT NOT NULL,
  -- W-169's canonical transition records NOW() (transaction start); use the
  -- same clock for a truthful ordering assertion in the immutable ledger.
  applied_at TIMESTAMPTZ NOT NULL DEFAULT transaction_timestamp(),
  target_count INTEGER NOT NULL CHECK (target_count = 9),
  dropped_count INTEGER NOT NULL CHECK (dropped_count = 7),
  terminal_count INTEGER NOT NULL CHECK (terminal_count = 2),
  active_pursuit_count INTEGER NOT NULL CHECK (active_pursuit_count = 1),
  evidence_added INTEGER NOT NULL CHECK (evidence_added = 2)
);

CREATE TABLE IF NOT EXISTS public.ticket_104_cross_namespace_drop_before_images (
  run_id UUID NOT NULL REFERENCES public.ticket_104_cross_namespace_drop_runs(id) ON DELETE RESTRICT,
  match_id UUID NOT NULL,
  match_snapshot JSONB NOT NULL,
  match_hash TEXT NOT NULL,
  opportunity_snapshot JSONB NOT NULL,
  opportunity_hash TEXT NOT NULL,
  repreneur_snapshot JSONB NOT NULL,
  repreneur_hash TEXT NOT NULL,
  dependent_counts JSONB NOT NULL,
  PRIMARY KEY (run_id, match_id)
);

-- Every pre-existing dependent row is captured independently.  A count alone
-- would not detect an in-place rewrite with the same cardinality.
CREATE TABLE IF NOT EXISTS public.ticket_104_cross_namespace_drop_dependent_before_images (
  run_id UUID NOT NULL REFERENCES public.ticket_104_cross_namespace_drop_runs(id) ON DELETE RESTRICT,
  match_id UUID NOT NULL,
  relation_name TEXT NOT NULL CHECK (relation_name IN ('pursuit_events','pursuit_evidence','confidential_grants','nda_artifacts','memo_notifications')),
  row_id UUID NOT NULL,
  row_snapshot JSONB NOT NULL,
  row_hash TEXT NOT NULL,
  PRIMARY KEY (run_id, relation_name, row_id)
);

CREATE OR REPLACE FUNCTION public.ticket_104_immutable_ledger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'ticket_104_immutable_ledger';
END;
$$;

DROP TRIGGER IF EXISTS ticket_104_runs_immutable ON public.ticket_104_cross_namespace_drop_runs;
CREATE TRIGGER ticket_104_runs_immutable
  BEFORE UPDATE OR DELETE ON public.ticket_104_cross_namespace_drop_runs
  FOR EACH ROW EXECUTE FUNCTION public.ticket_104_immutable_ledger();
DROP TRIGGER IF EXISTS ticket_104_before_images_immutable ON public.ticket_104_cross_namespace_drop_before_images;
CREATE TRIGGER ticket_104_before_images_immutable
  BEFORE UPDATE OR DELETE ON public.ticket_104_cross_namespace_drop_before_images
  FOR EACH ROW EXECUTE FUNCTION public.ticket_104_immutable_ledger();
DROP TRIGGER IF EXISTS ticket_104_dependent_before_images_immutable ON public.ticket_104_cross_namespace_drop_dependent_before_images;
CREATE TRIGGER ticket_104_dependent_before_images_immutable
  BEFORE UPDATE OR DELETE ON public.ticket_104_cross_namespace_drop_dependent_before_images
  FOR EACH ROW EXECUTE FUNCTION public.ticket_104_immutable_ledger();

-- This table is a transaction-local capability implemented as a row which only
-- SECURITY DEFINER functions may create.  It is deliberately not a GUC: callers
-- cannot forge it with SET LOCAL, and it is tied to both the backend and txid.
CREATE TABLE IF NOT EXISTS public.ticket_104_cross_namespace_drop_authorizations (
  run_id UUID NOT NULL REFERENCES public.ticket_104_cross_namespace_drop_runs(id) ON DELETE CASCADE,
  match_id UUID NOT NULL,
  backend_pid INTEGER NOT NULL,
  transaction_id BIGINT NOT NULL,
  allow_evidence BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (run_id, match_id)
);

CREATE TABLE IF NOT EXISTS public.ticket_104_cross_namespace_drop_finalizations (
  run_id UUID PRIMARY KEY REFERENCES public.ticket_104_cross_namespace_drop_runs(id) ON DELETE RESTRICT,
  finalized_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  actor TEXT NOT NULL CHECK (actor = 'migration:ticket-104')
);
DROP TRIGGER IF EXISTS ticket_104_finalizations_immutable ON public.ticket_104_cross_namespace_drop_finalizations;
CREATE TRIGGER ticket_104_finalizations_immutable
  BEFORE UPDATE OR DELETE ON public.ticket_104_cross_namespace_drop_finalizations
  FOR EACH ROW EXECUTE FUNCTION public.ticket_104_immutable_ledger();

REVOKE ALL ON TABLE public.ticket_104_cross_namespace_drop_runs,
  public.ticket_104_cross_namespace_drop_before_images,
  public.ticket_104_cross_namespace_drop_dependent_before_images,
  public.ticket_104_cross_namespace_drop_authorizations,
  public.ticket_104_cross_namespace_drop_finalizations
  FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.ticket_104_cross_namespace_drop_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_104_cross_namespace_drop_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_104_cross_namespace_drop_before_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_104_cross_namespace_drop_before_images FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_104_cross_namespace_drop_dependent_before_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_104_cross_namespace_drop_dependent_before_images FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_104_cross_namespace_drop_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_104_cross_namespace_drop_authorizations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_104_cross_namespace_drop_finalizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_104_cross_namespace_drop_finalizations FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.ticket_104_cross_namespace_mutation_authorized(p_match_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ticket_104_cross_namespace_drop_authorizations authz
    WHERE authz.match_id = p_match_id
      AND authz.backend_pid = pg_backend_pid()
      AND authz.transaction_id = txid_current()
  )
$$;

REVOKE ALL ON FUNCTION public.ticket_104_cross_namespace_mutation_authorized(UUID)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ticket_104_hash_json(p_value JSONB)
RETURNS TEXT LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT encode(extensions.digest(convert_to(p_value::TEXT, 'UTF8'), 'sha256'), 'hex')
$$;
REVOKE ALL ON FUNCTION public.ticket_104_hash_json(JSONB) FROM PUBLIC, anon, authenticated, service_role;

-- Compare the immutable snapshots after the mutation.  Existing dependent
-- rows must be byte-for-byte equivalent as JSONB; only the two explicitly
-- identified evidence rows may be new.
CREATE OR REPLACE FUNCTION public.ticket_104_verify_preservation(p_run_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_bad INTEGER; v_new_evidence INTEGER;
BEGIN
  -- Terminal rows are frozen byte-for-byte.  The active pursuit may receive
  -- the canonical stage metadata; the six other rows may change only status
  -- and updated_at.  Endpoints are immutable in every case.
  SELECT count(*) INTO v_bad
  FROM public.ticket_104_cross_namespace_drop_before_images image
  LEFT JOIN public.opportunity_matches m ON m.id=image.match_id
  LEFT JOIN public.opportunities o ON o.id=m.opportunity_id
  LEFT JOIN public.repreneurs r ON r.id=m.repreneur_id
  WHERE image.run_id=p_run_id AND (
    m.id IS NULL OR o.id IS NULL OR r.id IS NULL
    OR public.ticket_104_hash_json(to_jsonb(o)) IS DISTINCT FROM image.opportunity_hash
    OR public.ticket_104_hash_json(to_jsonb(r)) IS DISTINCT FROM image.repreneur_hash
    OR CASE image.match_snapshot->>'status'
      WHEN 'completed' THEN public.ticket_104_hash_json(to_jsonb(m)) IS DISTINCT FROM image.match_hash
      WHEN 'declined' THEN public.ticket_104_hash_json(to_jsonb(m)) IS DISTINCT FROM image.match_hash
      WHEN 'active_pursuit' THEN m.status IS DISTINCT FROM 'dropped'::public.opportunity_match_status
        OR m.pursuit_stage IS DISTINCT FROM 'dropped'::public.opportunity_pursuit_stage
        OR public.ticket_104_hash_json(to_jsonb(m) - ARRAY['status','pursuit_stage','pursuit_stage_updated_by','pursuit_stage_updated_at','updated_at'])
           IS DISTINCT FROM public.ticket_104_hash_json(image.match_snapshot - ARRAY['status','pursuit_stage','pursuit_stage_updated_by','pursuit_stage_updated_at','updated_at'])
      ELSE m.status IS DISTINCT FROM 'dropped'::public.opportunity_match_status
        OR public.ticket_104_hash_json(to_jsonb(m) - ARRAY['status','updated_at'])
           IS DISTINCT FROM public.ticket_104_hash_json(image.match_snapshot - ARRAY['status','updated_at'])
    END
  );
  IF v_bad <> 0 THEN RAISE EXCEPTION 'ticket_104_match_or_endpoint_preservation_drift'; END IF;

  WITH actual AS (
    SELECT 'pursuit_events'::TEXT relation_name,id,row_to_json(e)::JSONB row_snapshot FROM public.opportunity_pursuit_events e
    UNION ALL SELECT 'pursuit_evidence',id,row_to_json(e)::JSONB FROM public.opportunity_pursuit_evidence e
    UNION ALL SELECT 'confidential_grants',id,row_to_json(g)::JSONB FROM public.opportunity_pursuit_confidential_grants g
    UNION ALL SELECT 'nda_artifacts',id,row_to_json(a)::JSONB FROM public.opportunity_nda_artifacts a
    UNION ALL SELECT 'memo_notifications',id,row_to_json(n)::JSONB FROM public.opportunity_memo_notifications n
  )
  SELECT count(*) INTO v_bad
  FROM public.ticket_104_cross_namespace_drop_dependent_before_images image
  LEFT JOIN actual actual ON actual.relation_name=image.relation_name AND actual.id=image.row_id
  WHERE image.run_id=p_run_id
    AND (actual.id IS NULL OR public.ticket_104_hash_json(actual.row_snapshot) IS DISTINCT FROM image.row_hash);
  IF v_bad <> 0 THEN RAISE EXCEPTION 'ticket_104_dependent_preservation_drift'; END IF;

  SELECT count(*) INTO v_new_evidence
  FROM public.opportunity_pursuit_evidence e
  JOIN public.ticket_104_cross_namespace_drop_before_images image ON image.run_id=p_run_id AND image.match_id=e.match_id
  LEFT JOIN public.ticket_104_cross_namespace_drop_dependent_before_images old_e
    ON old_e.run_id=p_run_id AND old_e.relation_name='pursuit_evidence' AND old_e.row_id=e.id
  WHERE old_e.row_id IS NULL;
  IF v_new_evidence <> 2
     OR (SELECT count(*) FROM public.opportunity_pursuit_evidence e WHERE e.idempotency_key LIKE 'ticket-104:'||p_run_id::TEXT||':%' AND e.event_type IN ('access_revoked','dropped')) <> 2
     OR EXISTS (SELECT 1 FROM public.opportunity_pursuit_evidence e JOIN public.ticket_104_cross_namespace_drop_before_images active ON active.run_id=p_run_id AND active.match_id=e.match_id WHERE e.idempotency_key LIKE 'ticket-104:'||p_run_id::TEXT||':%' AND (e.event_type NOT IN ('access_revoked','dropped') OR e.actor <> 'migration:ticket-104' OR active.match_snapshot->>'status' <> 'active_pursuit'))
     OR EXISTS (SELECT 1 FROM public.opportunity_pursuit_evidence e JOIN public.ticket_104_cross_namespace_drop_before_images image ON image.run_id=p_run_id AND image.match_id=e.match_id LEFT JOIN public.ticket_104_cross_namespace_drop_dependent_before_images old_e ON old_e.run_id=p_run_id AND old_e.relation_name='pursuit_evidence' AND old_e.row_id=e.id WHERE old_e.row_id IS NULL AND e.idempotency_key NOT LIKE 'ticket-104:'||p_run_id::TEXT||':%')
  THEN RAISE EXCEPTION 'ticket_104_evidence_preservation_drift'; END IF;

  -- Counts make insertion of a new child record visible even where no
  -- pre-existing snapshot could be changed.  Only the active pursuit may
  -- receive the two canonical evidence rows.
  SELECT count(*) INTO v_bad
  FROM public.ticket_104_cross_namespace_drop_before_images image
  WHERE image.run_id=p_run_id AND (
    (SELECT count(*) FROM public.opportunity_pursuit_events x WHERE x.match_id=image.match_id) <> (image.dependent_counts->>'pursuit_events')::INTEGER
    OR (SELECT count(*) FROM public.opportunity_pursuit_confidential_grants x WHERE x.match_id=image.match_id) <> (image.dependent_counts->>'confidential_grants')::INTEGER
    OR (SELECT count(*) FROM public.opportunity_nda_artifacts x WHERE x.match_id=image.match_id) <> (image.dependent_counts->>'nda_artifacts')::INTEGER
    OR (SELECT count(*) FROM public.opportunity_memo_notifications x WHERE x.match_id=image.match_id) <> (image.dependent_counts->>'memo_notifications')::INTEGER
    OR (SELECT count(*) FROM public.opportunity_pursuit_evidence x WHERE x.match_id=image.match_id) <> (image.dependent_counts->>'pursuit_evidence')::INTEGER + CASE WHEN image.match_snapshot->>'status'='active_pursuit' THEN 2 ELSE 0 END
  );
  IF v_bad <> 0 THEN RAISE EXCEPTION 'ticket_104_dependent_count_drift'; END IF;

  SELECT count(*) INTO v_bad
  FROM public.ticket_104_cross_namespace_drop_before_images image
  JOIN public.ticket_104_cross_namespace_drop_runs run ON run.id=image.run_id
  JOIN public.opportunity_matches m ON m.id=image.match_id
  WHERE image.run_id=p_run_id AND image.match_snapshot->>'status'='active_pursuit'
    AND (m.pursuit_stage_updated_by IS DISTINCT FROM 'migration:ticket-104'
      OR m.pursuit_stage_updated_at IS NULL OR m.pursuit_stage_updated_at < run.applied_at);
  IF v_bad <> 0 THEN RAISE EXCEPTION 'ticket_104_active_actor_or_time_drift'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.ticket_104_verify_preservation(UUID) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ticket_104_verify_global_terminal_state(p_run_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF EXISTS (
    (SELECT m.id FROM public.opportunity_matches m JOIN public.opportunities o ON o.id=m.opportunity_id JOIN public.repreneurs r ON r.id=m.repreneur_id WHERE o.is_demo IS DISTINCT FROM r.is_demo
      EXCEPT SELECT image.match_id FROM public.ticket_104_cross_namespace_drop_before_images image WHERE image.run_id=p_run_id)
    UNION ALL
    (SELECT image.match_id FROM public.ticket_104_cross_namespace_drop_before_images image WHERE image.run_id=p_run_id
      EXCEPT SELECT m.id FROM public.opportunity_matches m JOIN public.opportunities o ON o.id=m.opportunity_id JOIN public.repreneurs r ON r.id=m.repreneur_id WHERE o.is_demo IS DISTINCT FROM r.is_demo)
  ) OR (SELECT count(*) FROM public.opportunity_matches m JOIN public.ticket_104_cross_namespace_drop_before_images image ON image.run_id=p_run_id AND image.match_id=m.id WHERE m.status='dropped') <> 7
    OR EXISTS (SELECT 1 FROM public.opportunity_matches m JOIN public.ticket_104_cross_namespace_drop_before_images image ON image.run_id=p_run_id AND image.match_id=m.id WHERE m.status NOT IN ('dropped','completed','declined'))
    OR EXISTS (SELECT 1 FROM public.ticket_104_cross_namespace_drop_before_images image JOIN public.opportunity_matches m ON m.id=image.match_id WHERE image.run_id=p_run_id AND image.match_snapshot->>'status' IN ('completed','declined') AND public.ticket_104_hash_json(to_jsonb(m)) IS DISTINCT FROM image.match_hash)
  THEN RAISE EXCEPTION 'ticket_104_global_terminal_state_drift'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.ticket_104_verify_global_terminal_state(UUID) FROM PUBLIC, anon, authenticated, service_role;

-- Preserve W-164's freeze for every normal caller.  The exact one-shot
-- capability above is the only exception, and it may only make the approved
-- terminal transition; it cannot alter either endpoint or any other match data.
CREATE OR REPLACE FUNCTION public.enforce_w164_match_namespace()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_valid BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT public.w164_match_has_same_namespace(OLD.id) THEN
      RAISE EXCEPTION 'w164_cross_namespace_match_is_frozen_history';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND NOT public.w164_match_has_same_namespace(OLD.id) THEN
    IF NOT public.ticket_104_cross_namespace_mutation_authorized(OLD.id)
      OR NEW.id IS DISTINCT FROM OLD.id
      OR NEW.opportunity_id IS DISTINCT FROM OLD.opportunity_id
      OR NEW.repreneur_id IS DISTINCT FROM OLD.repreneur_id
      OR NEW.status <> 'dropped'::public.opportunity_match_status
      OR (OLD.status = 'active_pursuit'::public.opportunity_match_status
          AND NEW.pursuit_stage IS DISTINCT FROM 'dropped'::public.opportunity_pursuit_stage)
      OR (OLD.status <> 'active_pursuit'::public.opportunity_match_status
          AND NEW.pursuit_stage IS DISTINCT FROM OLD.pursuit_stage)
      OR (to_jsonb(NEW) - ARRAY['status','pursuit_stage','pursuit_stage_updated_by','pursuit_stage_updated_at','updated_at'])
           IS DISTINCT FROM
          (to_jsonb(OLD) - ARRAY['status','pursuit_stage','pursuit_stage_updated_by','pursuit_stage_updated_at','updated_at'])
    THEN
      RAISE EXCEPTION 'w164_cross_namespace_match_is_frozen_history';
    END IF;
    RETURN NEW;
  END IF;

  SELECT opportunity.is_demo = repreneur.is_demo INTO v_valid
  FROM public.opportunities opportunity, public.repreneurs repreneur
  WHERE opportunity.id = NEW.opportunity_id AND repreneur.id = NEW.repreneur_id;
  IF v_valid IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'w164_cross_namespace_match_denied'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_w164_match_child_namespace()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_match_id UUID;
BEGIN
  v_match_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.match_id ELSE NEW.match_id END;
  IF v_match_id IS NOT NULL AND NOT public.w164_match_has_same_namespace(v_match_id) THEN
    -- The one-shot cutover may append only its two terminal audit events.  It
    -- cannot modify confidential grants, artifacts, notifications or prior
    -- evidence, even while the transaction capability is present.
    IF TG_TABLE_NAME <> 'opportunity_pursuit_evidence' OR TG_OP <> 'INSERT' THEN
      RAISE EXCEPTION 'w164_cross_namespace_match_action_denied';
    END IF;
    IF NOT public.ticket_104_cross_namespace_mutation_authorized(v_match_id)
       OR NOT EXISTS (SELECT 1 FROM public.ticket_104_cross_namespace_drop_authorizations authz WHERE authz.match_id=v_match_id AND authz.backend_pid=pg_backend_pid() AND authz.transaction_id=txid_current() AND authz.allow_evidence)
       OR NEW.event_type NOT IN ('access_revoked','dropped')
       OR NEW.idempotency_key NOT LIKE 'ticket-104:%'
    THEN RAISE EXCEPTION 'w164_cross_namespace_match_action_denied'; END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_ticket_104_cross_namespace_drop(
  p_manifest JSONB,
  p_actor TEXT
)
RETURNS TABLE(run_id UUID, outcome TEXT, dropped_count INTEGER, evidence_added INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_digest CONSTANT TEXT := '11445554185917f4604d2f5dfd4b845ca5ec55c96e9757d01e40d3905da52f18';
  v_rows JSONB := COALESCE(p_manifest->'rows','[]'::JSONB);
  v_fingerprint TEXT;
  v_run public.ticket_104_cross_namespace_drop_runs%ROWTYPE;
  v_actual_fingerprint TEXT;
  v_actual_count INTEGER;
  v_nonterminal_count INTEGER;
  v_terminal_count INTEGER;
  v_active_count INTEGER;
  v_evidence_before INTEGER;
  v_evidence_after INTEGER;
  v_row RECORD;
BEGIN
  IF p_actor IS DISTINCT FROM 'migration:ticket-104' THEN RAISE EXCEPTION 'ticket_104_actor_denied'; END IF;
  IF p_manifest->>'manifest_digest' IS DISTINCT FROM v_digest THEN RAISE EXCEPTION 'ticket_104_manifest_digest_denied'; END IF;
  IF jsonb_typeof(v_rows) <> 'array' OR jsonb_array_length(v_rows) <> 9 THEN
    RAISE EXCEPTION 'ticket_104_manifest_count_denied';
  END IF;
  IF p_manifest->>'schema_version' IS DISTINCT FROM 'issue-103-cross-namespace-manifest/v1' THEN RAISE EXCEPTION 'ticket_104_manifest_schema_denied'; END IF;
  SELECT encode(extensions.digest(convert_to(string_agg(
    (item->>'match_id') || '|' || (item->>'row_fingerprint'), E'\n' ORDER BY item->>'match_id'
  ), 'UTF8'), 'sha256'), 'hex')
  INTO v_fingerprint FROM jsonb_array_elements(v_rows) item;
  IF v_fingerprint IS DISTINCT FROM v_digest THEN RAISE EXCEPTION 'ticket_104_manifest_digest_recompute_denied'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ticket_104_cross_namespace_drop', 0));
  SELECT * INTO v_run FROM public.ticket_104_cross_namespace_drop_runs
  WHERE manifest_digest = v_digest FOR UPDATE;

  -- Exact replay is safe only after the previously written terminal state and
  -- two immutable evidence rows are still present.  A changed manifest never
  -- becomes an alternative execution path.
  IF FOUND THEN
    IF EXISTS (SELECT 1 FROM public.ticket_104_cross_namespace_drop_finalizations f WHERE f.run_id=v_run.id) THEN RAISE EXCEPTION 'ticket_104_apply_sealed'; END IF;
    IF v_run.manifest_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'ticket_104_manifest_replay_mismatch';
    END IF;
    IF (SELECT count(*) FROM public.ticket_104_cross_namespace_drop_before_images image WHERE image.run_id=v_run.id) <> 9
      OR (SELECT count(*) FROM public.opportunity_matches m
          JOIN public.ticket_104_cross_namespace_drop_before_images image ON image.run_id=v_run.id AND image.match_id=m.id
          WHERE m.status='dropped') <> 7
      OR (SELECT count(*) FROM public.opportunity_pursuit_evidence e
          WHERE e.idempotency_key LIKE 'ticket-104:'||v_run.id::TEXT||':%') <> 2
    THEN RAISE EXCEPTION 'ticket_104_replay_state_drift'; END IF;
    PERFORM public.ticket_104_verify_preservation(v_run.id);
    PERFORM public.ticket_104_verify_global_terminal_state(v_run.id);
    RETURN QUERY SELECT v_run.id, 'already_applied'::TEXT, v_run.dropped_count, v_run.evidence_added;
    RETURN;
  END IF;

  CREATE TEMP TABLE ticket_104_manifest_rows (
    match_id UUID PRIMARY KEY, opportunity_id UUID NOT NULL, repreneur_id UUID NOT NULL,
    match_status public.opportunity_match_status NOT NULL, pursuit_stage public.opportunity_pursuit_stage,
    match_updated_at TIMESTAMPTZ NOT NULL, opportunity_updated_at TIMESTAMPTZ NOT NULL,
    repreneur_updated_at TIMESTAMPTZ NOT NULL, dependent_rows JSONB NOT NULL,
    namespace_direction TEXT NOT NULL, proposed_treatment TEXT NOT NULL, row_fingerprint TEXT NOT NULL
  ) ON COMMIT DROP;
  INSERT INTO ticket_104_manifest_rows
  SELECT match_id,opportunity_id,repreneur_id,match_status,pursuit_stage,match_updated_at,
    opportunity_updated_at,repreneur_updated_at,dependent_rows,namespace_direction,proposed_treatment,row_fingerprint
  FROM jsonb_to_recordset(v_rows) AS manifest(
    match_id UUID, opportunity_id UUID, repreneur_id UUID,
    match_status public.opportunity_match_status, pursuit_stage public.opportunity_pursuit_stage,
    match_updated_at TIMESTAMPTZ, opportunity_updated_at TIMESTAMPTZ, repreneur_updated_at TIMESTAMPTZ,
    dependent_rows JSONB, namespace_direction TEXT, proposed_treatment TEXT, row_fingerprint TEXT
  );
  IF (SELECT count(*) FROM ticket_104_manifest_rows) <> 9 THEN RAISE EXCEPTION 'ticket_104_manifest_duplicate_or_null'; END IF;

  LOCK TABLE public.opportunity_matches IN SHARE ROW EXCLUSIVE MODE;
  PERFORM 1 FROM public.opportunities o JOIN ticket_104_manifest_rows expected ON expected.opportunity_id=o.id ORDER BY o.id FOR UPDATE;
  PERFORM 1 FROM public.repreneurs r JOIN ticket_104_manifest_rows expected ON expected.repreneur_id=r.id ORDER BY r.id FOR UPDATE;
  SELECT count(*)::INTEGER,
    count(*) FILTER (WHERE m.status NOT IN ('dropped','declined','completed'))::INTEGER,
    count(*) FILTER (WHERE m.status IN ('dropped','declined','completed'))::INTEGER,
    count(*) FILTER (WHERE m.status='active_pursuit')::INTEGER
  INTO v_actual_count,v_nonterminal_count,v_terminal_count,v_active_count
  FROM public.opportunity_matches m
  JOIN public.opportunities o ON o.id=m.opportunity_id
  JOIN public.repreneurs r ON r.id=m.repreneur_id
  WHERE o.is_demo IS DISTINCT FROM r.is_demo;
  IF v_actual_count <> 9 OR v_nonterminal_count <> 7 OR v_terminal_count <> 2 OR v_active_count <> 1 THEN
    RAISE EXCEPTION 'ticket_104_global_cross_namespace_set_drift';
  END IF;

  -- This is deliberately the original preflight serialization.  Do not replace
  -- concat_ws with JSON or application code: PostgreSQL's UUID/boolean text
  -- output and UTC microsecond timestamp format are part of the signed input.
  WITH current_rows AS (
    SELECT m.id AS match_id,m.opportunity_id,m.repreneur_id,m.status AS match_status,m.pursuit_stage,
      m.updated_at AS match_updated_at,o.updated_at AS opportunity_updated_at,r.updated_at AS repreneur_updated_at,
      jsonb_build_object(
        'pursuit_events',(SELECT count(*) FROM public.opportunity_pursuit_events e WHERE e.match_id=m.id),
        'pursuit_evidence',(SELECT count(*) FROM public.opportunity_pursuit_evidence e WHERE e.match_id=m.id),
        'confidential_grants',(SELECT count(*) FROM public.opportunity_pursuit_confidential_grants g WHERE g.match_id=m.id),
        'nda_artifacts',(SELECT count(*) FROM public.opportunity_nda_artifacts a WHERE a.match_id=m.id),
        'memo_notifications',(SELECT count(*) FROM public.opportunity_memo_notifications n WHERE n.match_id=m.id)
      ) AS dependent_rows,
      CASE WHEN o.is_demo THEN 'DEMO_to_REAL' ELSE 'REAL_to_DEMO' END AS namespace_direction,
      CASE WHEN m.status IN ('dropped','declined','completed') THEN 'retain_immutable' ELSE 'decision_required_quarantine_to_dropped' END AS proposed_treatment,
      encode(extensions.digest(convert_to(concat_ws('|',m.id,m.status,COALESCE(m.pursuit_stage::TEXT,''),m.opportunity_id,o.is_demo,m.repreneur_id,r.is_demo,
        to_char(m.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        to_char(o.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        to_char(r.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        (SELECT count(*) FROM public.opportunity_pursuit_events e WHERE e.match_id=m.id),
        (SELECT count(*) FROM public.opportunity_pursuit_evidence e WHERE e.match_id=m.id),
        (SELECT count(*) FROM public.opportunity_pursuit_confidential_grants g WHERE g.match_id=m.id),
        (SELECT count(*) FROM public.opportunity_nda_artifacts a WHERE a.match_id=m.id),
        (SELECT count(*) FROM public.opportunity_memo_notifications n WHERE n.match_id=m.id)
      ),'UTF8'),'sha256'),'hex') AS row_fingerprint
    FROM public.opportunity_matches m
    JOIN public.opportunities o ON o.id=m.opportunity_id
    JOIN public.repreneurs r ON r.id=m.repreneur_id
    WHERE o.is_demo IS DISTINCT FROM r.is_demo
  )
  SELECT encode(extensions.digest(convert_to(string_agg(concat_ws('|',match_id,row_fingerprint),E'\n' ORDER BY match_id),'UTF8'),'sha256'),'hex')
  INTO v_actual_fingerprint FROM current_rows;
  IF v_actual_fingerprint <> v_digest THEN RAISE EXCEPTION 'ticket_104_manifest_fingerprint_drift'; END IF;

  IF EXISTS (
    SELECT 1 FROM ticket_104_manifest_rows expected
    FULL JOIN (
      SELECT m.id AS match_id,m.opportunity_id,m.repreneur_id,m.status AS match_status,m.pursuit_stage,
        m.updated_at AS match_updated_at,o.updated_at AS opportunity_updated_at,r.updated_at AS repreneur_updated_at,
        jsonb_build_object('pursuit_events',(SELECT count(*) FROM public.opportunity_pursuit_events e WHERE e.match_id=m.id),'pursuit_evidence',(SELECT count(*) FROM public.opportunity_pursuit_evidence e WHERE e.match_id=m.id),'confidential_grants',(SELECT count(*) FROM public.opportunity_pursuit_confidential_grants g WHERE g.match_id=m.id),'nda_artifacts',(SELECT count(*) FROM public.opportunity_nda_artifacts a WHERE a.match_id=m.id),'memo_notifications',(SELECT count(*) FROM public.opportunity_memo_notifications n WHERE n.match_id=m.id)) AS dependent_rows,
        CASE WHEN o.is_demo THEN 'DEMO_to_REAL' ELSE 'REAL_to_DEMO' END AS namespace_direction,
        CASE WHEN m.status IN ('dropped','declined','completed') THEN 'retain_immutable' ELSE 'decision_required_quarantine_to_dropped' END AS proposed_treatment,
        encode(extensions.digest(convert_to(concat_ws('|',m.id,m.status,COALESCE(m.pursuit_stage::TEXT,''),m.opportunity_id,o.is_demo,m.repreneur_id,r.is_demo,to_char(m.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),to_char(o.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),to_char(r.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),(SELECT count(*) FROM public.opportunity_pursuit_events e WHERE e.match_id=m.id),(SELECT count(*) FROM public.opportunity_pursuit_evidence e WHERE e.match_id=m.id),(SELECT count(*) FROM public.opportunity_pursuit_confidential_grants g WHERE g.match_id=m.id),(SELECT count(*) FROM public.opportunity_nda_artifacts a WHERE a.match_id=m.id),(SELECT count(*) FROM public.opportunity_memo_notifications n WHERE n.match_id=m.id)),'UTF8'),'sha256'),'hex') AS row_fingerprint
      FROM public.opportunity_matches m JOIN public.opportunities o ON o.id=m.opportunity_id JOIN public.repreneurs r ON r.id=m.repreneur_id
      WHERE o.is_demo IS DISTINCT FROM r.is_demo
    ) actual USING(match_id)
    WHERE expected.match_id IS NULL OR actual.match_id IS NULL
      OR ROW(expected.opportunity_id,expected.repreneur_id,expected.match_status,expected.pursuit_stage,expected.match_updated_at,expected.opportunity_updated_at,expected.repreneur_updated_at,expected.dependent_rows,expected.namespace_direction,expected.proposed_treatment,expected.row_fingerprint)
         IS DISTINCT FROM ROW(actual.opportunity_id,actual.repreneur_id,actual.match_status,actual.pursuit_stage,actual.match_updated_at,actual.opportunity_updated_at,actual.repreneur_updated_at,actual.dependent_rows,actual.namespace_direction,actual.proposed_treatment,actual.row_fingerprint)
  ) THEN RAISE EXCEPTION 'ticket_104_manifest_row_drift'; END IF;
  IF EXISTS (SELECT 1 FROM public.opportunity_pursuit_confidential_grants grant_row JOIN ticket_104_manifest_rows expected ON expected.match_id=grant_row.match_id WHERE grant_row.revoked_at IS NULL) THEN
    RAISE EXCEPTION 'ticket_104_unrevoked_grant_denied';
  END IF;

  INSERT INTO public.ticket_104_cross_namespace_drop_runs(manifest_digest,manifest_fingerprint,actor,target_count,dropped_count,terminal_count,active_pursuit_count,evidence_added)
  VALUES(v_digest,v_fingerprint,p_actor,9,7,2,1,2) RETURNING * INTO v_run;
  INSERT INTO public.ticket_104_cross_namespace_drop_before_images(run_id,match_id,match_snapshot,match_hash,opportunity_snapshot,opportunity_hash,repreneur_snapshot,repreneur_hash,dependent_counts)
  SELECT v_run.id,m.id,to_jsonb(m),public.ticket_104_hash_json(to_jsonb(m)),to_jsonb(o),public.ticket_104_hash_json(to_jsonb(o)),to_jsonb(r),public.ticket_104_hash_json(to_jsonb(r)),expected.dependent_rows
  FROM public.opportunity_matches m JOIN ticket_104_manifest_rows expected ON expected.match_id=m.id JOIN public.opportunities o ON o.id=m.opportunity_id JOIN public.repreneurs r ON r.id=m.repreneur_id;
  INSERT INTO public.ticket_104_cross_namespace_drop_dependent_before_images(run_id,match_id,relation_name,row_id,row_snapshot,row_hash)
  SELECT v_run.id,match_id,relation_name,row_id,row_snapshot,public.ticket_104_hash_json(row_snapshot)
  FROM (
    SELECT e.match_id,'pursuit_events'::TEXT relation_name,e.id row_id,row_to_json(e)::JSONB row_snapshot FROM public.opportunity_pursuit_events e JOIN ticket_104_manifest_rows x ON x.match_id=e.match_id
    UNION ALL SELECT e.match_id,'pursuit_evidence',e.id,row_to_json(e)::JSONB FROM public.opportunity_pursuit_evidence e JOIN ticket_104_manifest_rows x ON x.match_id=e.match_id
    UNION ALL SELECT g.match_id,'confidential_grants',g.id,row_to_json(g)::JSONB FROM public.opportunity_pursuit_confidential_grants g JOIN ticket_104_manifest_rows x ON x.match_id=g.match_id
    UNION ALL SELECT a.match_id,'nda_artifacts',a.id,row_to_json(a)::JSONB FROM public.opportunity_nda_artifacts a JOIN ticket_104_manifest_rows x ON x.match_id=a.match_id
    UNION ALL SELECT n.match_id,'memo_notifications',n.id,row_to_json(n)::JSONB FROM public.opportunity_memo_notifications n JOIN ticket_104_manifest_rows x ON x.match_id=n.match_id
  ) snapshots;
  INSERT INTO public.ticket_104_cross_namespace_drop_authorizations(run_id,match_id,backend_pid,transaction_id,allow_evidence)
  SELECT v_run.id,match_id,pg_backend_pid(),txid_current(),match_status='active_pursuit'
  FROM ticket_104_manifest_rows
  WHERE match_status NOT IN ('dropped','declined','completed');
  SELECT count(*) INTO v_evidence_before FROM public.opportunity_pursuit_evidence
  WHERE match_id IN (SELECT match_id FROM ticket_104_manifest_rows);

  FOR v_row IN SELECT * FROM ticket_104_manifest_rows ORDER BY match_id LOOP
    IF v_row.match_status = 'active_pursuit' THEN
      PERFORM public.journey_transition_terminal(v_row.match_id,'drop',p_actor,'ticket-104:'||v_run.id::TEXT||':'||v_row.match_id::TEXT||':drop','no_viable_match');
    ELSIF v_row.match_status NOT IN ('dropped','declined','completed') THEN
      UPDATE public.opportunity_matches
      SET status='dropped',updated_at=clock_timestamp()
      WHERE id=v_row.match_id;
    END IF;
  END LOOP;

  SELECT count(*) INTO v_evidence_after FROM public.opportunity_pursuit_evidence
  WHERE match_id IN (SELECT match_id FROM ticket_104_manifest_rows);
  IF v_evidence_after - v_evidence_before <> 2 THEN RAISE EXCEPTION 'ticket_104_evidence_count_drift'; END IF;
  IF (SELECT count(*) FROM public.opportunity_matches WHERE id IN (SELECT match_id FROM ticket_104_manifest_rows) AND status='dropped') <> 7 THEN
    RAISE EXCEPTION 'ticket_104_terminal_write_drift';
  END IF;
  IF (SELECT count(*) FROM public.opportunity_pursuit_evidence e WHERE e.idempotency_key LIKE 'ticket-104:'||v_run.id::TEXT||':%' AND e.event_type IN ('access_revoked','dropped')) <> 2
    OR EXISTS (SELECT 1 FROM public.opportunity_pursuit_evidence e WHERE e.idempotency_key LIKE 'ticket-104:'||v_run.id::TEXT||':%' AND e.event_type NOT IN ('access_revoked','dropped'))
  THEN RAISE EXCEPTION 'ticket_104_evidence_type_drift'; END IF;
  PERFORM public.ticket_104_verify_preservation(v_run.id);
  DELETE FROM public.ticket_104_cross_namespace_drop_authorizations authz WHERE authz.run_id=v_run.id;
  RETURN QUERY SELECT v_run.id,'applied'::TEXT,7,2;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_ticket_104_cross_namespace_drop(JSONB,TEXT)
  FROM PUBLIC, anon, authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.ticket_104_cross_namespace_drop_finalizations) THEN
    GRANT EXECUTE ON FUNCTION public.apply_ticket_104_cross_namespace_drop(JSONB,TEXT) TO service_role;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.finalize_ticket_104_cross_namespace_drop(p_manifest_digest TEXT,p_actor TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_run UUID;
BEGIN
  IF p_actor IS DISTINCT FROM 'migration:ticket-104'
     OR p_manifest_digest IS DISTINCT FROM '11445554185917f4604d2f5dfd4b845ca5ec55c96e9757d01e40d3905da52f18' THEN
    RAISE EXCEPTION 'ticket_104_finalize_denied';
  END IF;
  SELECT id INTO v_run FROM public.ticket_104_cross_namespace_drop_runs WHERE manifest_digest=p_manifest_digest FOR UPDATE;
  IF v_run IS NULL THEN RAISE EXCEPTION 'ticket_104_finalize_no_run'; END IF;
  IF EXISTS (SELECT 1 FROM public.ticket_104_cross_namespace_drop_finalizations WHERE run_id=v_run) THEN
    REVOKE EXECUTE ON FUNCTION public.apply_ticket_104_cross_namespace_drop(JSONB,TEXT) FROM service_role;
    REVOKE EXECUTE ON FUNCTION public.finalize_ticket_104_cross_namespace_drop(TEXT,TEXT) FROM service_role;
    RETURN v_run;
  END IF;
  PERFORM public.ticket_104_verify_preservation(v_run);
  PERFORM public.ticket_104_verify_global_terminal_state(v_run);
  INSERT INTO public.ticket_104_cross_namespace_drop_finalizations(run_id,actor) VALUES(v_run,p_actor);
  REVOKE EXECUTE ON FUNCTION public.apply_ticket_104_cross_namespace_drop(JSONB,TEXT) FROM service_role;
  REVOKE EXECUTE ON FUNCTION public.finalize_ticket_104_cross_namespace_drop(TEXT,TEXT) FROM service_role;
  RETURN v_run;
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_ticket_104_cross_namespace_drop(TEXT,TEXT) FROM PUBLIC, anon, authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.ticket_104_cross_namespace_drop_finalizations) THEN
    GRANT EXECUTE ON FUNCTION public.finalize_ticket_104_cross_namespace_drop(TEXT,TEXT) TO service_role;
  END IF;
END $$;

COMMIT;
