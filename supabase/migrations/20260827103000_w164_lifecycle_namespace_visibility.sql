-- W-164: lifecycle-derived Deal Flow visibility with equal REAL/DEMO namespaces.
--
-- This migration installs the invariant and guarded reconciliation primitives.
-- It deliberately does not run the production reconciliation: release must pass
-- the separately reviewed, current manifest to apply_w164_visibility_reconciliation.

CREATE TABLE public.w164_visibility_reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_key TEXT NOT NULL DEFAULT 'W-164-lifecycle-visibility' UNIQUE
    CHECK (operation_key = 'W-164-lifecycle-visibility'),
  actor TEXT NOT NULL CHECK (NULLIF(BTRIM(actor), '') IS NOT NULL),
  manifest_digest TEXT NOT NULL CHECK (manifest_digest ~ '^[0-9a-f]{64}$'),
  manifest JSONB NOT NULL CHECK (JSONB_TYPEOF(manifest) = 'array'),
  rollback_manifest JSONB NOT NULL CHECK (JSONB_TYPEOF(rollback_manifest) = 'array'),
  changed_count INTEGER NOT NULL CHECK (changed_count > 0),
  reconciled_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE public.w164_visibility_reconciliation_rollbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL UNIQUE REFERENCES public.w164_visibility_reconciliation_runs(id),
  actor TEXT NOT NULL CHECK (NULLIF(BTRIM(actor), '') IS NOT NULL),
  rolled_back_count INTEGER NOT NULL CHECK (rolled_back_count > 0),
  rolled_back_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE OR REPLACE FUNCTION public.prevent_w164_audit_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'w164_visibility_audit_is_immutable';
END;
$$;

CREATE TRIGGER prevent_w164_run_mutation
  BEFORE UPDATE OR DELETE OR TRUNCATE ON public.w164_visibility_reconciliation_runs
  FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_w164_audit_mutation();
CREATE TRIGGER prevent_w164_rollback_mutation
  BEFORE UPDATE OR DELETE OR TRUNCATE ON public.w164_visibility_reconciliation_rollbacks
  FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_w164_audit_mutation();

CREATE OR REPLACE FUNCTION public.w164_lifecycle_exposure(
  p_status public.opportunity_status
)
RETURNS public.opportunity_visibility
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN p_status = 'active'
    THEN 'anonymized'::public.opportunity_visibility
    ELSE 'staff_only'::public.opportunity_visibility
  END
$$;

CREATE OR REPLACE FUNCTION public.enforce_w164_lifecycle_exposure()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF current_setting('wave.w164_guarded_rollback', TRUE) = 'on' THEN
    RETURN NEW;
  END IF;
  NEW.repreneur_exposure := public.w164_lifecycle_exposure(NEW.status);
  RETURN NEW;
END;
$$;

-- W-021's insert-only staff approval gate is superseded. The new trigger also
-- covers lifecycle changes, DEMO classification changes and direct legacy writes.
DROP TRIGGER IF EXISTS enforce_w021_new_opportunity_staff_only ON public.opportunities;
DROP TRIGGER IF EXISTS enforce_w164_lifecycle_exposure ON public.opportunities;
CREATE TRIGGER enforce_w164_lifecycle_exposure
  BEFORE INSERT OR UPDATE OF status, is_demo, repreneur_exposure ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.enforce_w164_lifecycle_exposure();

CREATE OR REPLACE FUNCTION public.w164_visibility_preflight()
RETURNS TABLE (
  ordinal INTEGER,
  id UUID,
  reference TEXT,
  status public.opportunity_status,
  is_demo BOOLEAN,
  current_exposure public.opportunity_visibility,
  target_exposure public.opportunity_visibility,
  updated_at TIMESTAMPTZ,
  fingerprint TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH candidates AS (
    SELECT
      o.id,
      o.reference,
      o.status,
      o.is_demo,
      o.repreneur_exposure AS current_exposure,
      public.w164_lifecycle_exposure(o.status) AS target_exposure,
      o.updated_at
    FROM public.opportunities o
    WHERE o.repreneur_exposure IS DISTINCT FROM public.w164_lifecycle_exposure(o.status)
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY reference, id)::INTEGER,
    id,
    reference,
    status,
    is_demo,
    current_exposure,
    target_exposure,
    updated_at,
    ENCODE(extensions.digest(CONVERT_TO(CONCAT_WS('|',
      id, reference, status, is_demo, current_exposure, target_exposure,
      TO_CHAR(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    ), 'UTF8'), 'sha256'), 'hex')
  FROM candidates
  ORDER BY reference, id
$$;

CREATE OR REPLACE FUNCTION public.w164_visibility_manifest_digest(p_manifest JSONB)
RETURNS TEXT LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE(
    ENCODE(extensions.digest(CONVERT_TO(STRING_AGG(CONCAT_WS('|',
      ordinal, id, reference, status, is_demo, current_exposure, target_exposure,
      TO_CHAR(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), fingerprint
    ), E'\n' ORDER BY ordinal), 'UTF8'), 'sha256'), 'hex'),
    ENCODE(extensions.digest(''::BYTEA, 'sha256'), 'hex')
  )
  FROM JSONB_TO_RECORDSET(p_manifest) AS item(
    ordinal INTEGER,
    id UUID,
    reference TEXT,
    status public.opportunity_status,
    is_demo BOOLEAN,
    current_exposure public.opportunity_visibility,
    target_exposure public.opportunity_visibility,
    updated_at TIMESTAMPTZ,
    fingerprint TEXT
  )
$$;

CREATE OR REPLACE FUNCTION public.apply_w164_visibility_reconciliation(
  p_manifest JSONB,
  p_manifest_digest TEXT,
  p_actor TEXT
)
RETURNS TABLE(run_id UUID, changed_count INTEGER, rollback_manifest JSONB)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor TEXT := NULLIF(BTRIM(p_actor), '');
  v_expected INTEGER;
  v_changed INTEGER;
  v_run UUID;
  v_rollback JSONB;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'w164_actor_required'; END IF;
  IF JSONB_TYPEOF(p_manifest) <> 'array' OR JSONB_ARRAY_LENGTH(p_manifest) = 0 THEN
    RAISE EXCEPTION 'w164_manifest_required';
  END IF;
  IF p_manifest_digest !~ '^[0-9a-f]{64}$'
    OR public.w164_visibility_manifest_digest(p_manifest) IS DISTINCT FROM p_manifest_digest THEN
    RAISE EXCEPTION 'w164_manifest_digest_mismatch';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('w164:lifecycle-visibility', 164));
  IF EXISTS (SELECT 1 FROM public.w164_visibility_reconciliation_runs) THEN
    RAISE EXCEPTION 'w164_reconciliation_already_completed';
  END IF;
  LOCK TABLE public.opportunities IN SHARE ROW EXCLUSIVE MODE;

  CREATE TEMP TABLE w164_manifest (
    ordinal INTEGER NOT NULL UNIQUE,
    id UUID PRIMARY KEY,
    reference TEXT NOT NULL,
    status public.opportunity_status NOT NULL,
    is_demo BOOLEAN NOT NULL,
    current_exposure public.opportunity_visibility NOT NULL,
    target_exposure public.opportunity_visibility NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    fingerprint TEXT NOT NULL
  ) ON COMMIT DROP;
  INSERT INTO w164_manifest
  SELECT ordinal,id,reference,status,is_demo,current_exposure,target_exposure,updated_at,fingerprint
  FROM JSONB_TO_RECORDSET(p_manifest) AS item(
    ordinal INTEGER,id UUID,reference TEXT,status public.opportunity_status,is_demo BOOLEAN,
    current_exposure public.opportunity_visibility,target_exposure public.opportunity_visibility,
    updated_at TIMESTAMPTZ,fingerprint TEXT
  );
  SELECT COUNT(*)::INTEGER INTO v_expected FROM w164_manifest;
  IF v_expected <> JSONB_ARRAY_LENGTH(p_manifest) THEN RAISE EXCEPTION 'w164_manifest_invalid'; END IF;

  -- Gate the complete fresh mismatch set, never a selected subset. This catches
  -- the historical 37 plus any new active drift and every stale visible draft.
  IF EXISTS (
    SELECT 1 FROM w164_manifest manifest
    FULL OUTER JOIN public.w164_visibility_preflight() current ON current.id=manifest.id
    WHERE manifest.id IS NULL OR current.id IS NULL
      OR (current.ordinal,current.reference,current.status,current.is_demo,current.current_exposure,
          current.target_exposure,current.updated_at,current.fingerprint)
         IS DISTINCT FROM
         (manifest.ordinal,manifest.reference,manifest.status,manifest.is_demo,manifest.current_exposure,
          manifest.target_exposure,manifest.updated_at,manifest.fingerprint)
  ) THEN RAISE EXCEPTION 'w164_manifest_set_mismatch'; END IF;

  WITH changed AS (
    UPDATE public.opportunities opportunity
    SET repreneur_exposure=manifest.target_exposure, updated_by=v_actor
    FROM w164_manifest manifest
    WHERE opportunity.id=manifest.id
      AND opportunity.status=manifest.status
      AND opportunity.is_demo=manifest.is_demo
      AND opportunity.repreneur_exposure=manifest.current_exposure
      AND opportunity.updated_at=manifest.updated_at
    RETURNING opportunity.id,opportunity.updated_at,opportunity.updated_by
  )
  SELECT COUNT(*)::INTEGER,
    JSONB_AGG(JSONB_BUILD_OBJECT(
      'ordinal',manifest.ordinal,
      'id',manifest.id,
      'reference',manifest.reference,
      'status',manifest.status,
      'is_demo',manifest.is_demo,
      'reconciled_updated_at',changed.updated_at,
      'reconciled_updated_by',changed.updated_by,
      'target_exposure',manifest.current_exposure
    ) ORDER BY manifest.ordinal)
  INTO v_changed,v_rollback
  FROM w164_manifest manifest JOIN changed ON changed.id=manifest.id;
  IF v_changed <> v_expected THEN RAISE EXCEPTION 'w164_state_drift'; END IF;

  INSERT INTO public.w164_visibility_reconciliation_runs(
    actor,manifest_digest,manifest,rollback_manifest,changed_count
  ) VALUES(v_actor,p_manifest_digest,p_manifest,v_rollback,v_changed)
  RETURNING id INTO v_run;
  RETURN QUERY SELECT v_run,v_changed,v_rollback;
END;
$$;

CREATE OR REPLACE FUNCTION public.rollback_w164_visibility_reconciliation(
  p_run_id UUID,
  p_actor TEXT
)
RETURNS TABLE(rollback_id UUID, rolled_back_count INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor TEXT := NULLIF(BTRIM(p_actor), '');
  v_run public.w164_visibility_reconciliation_runs%ROWTYPE;
  v_expected INTEGER;
  v_changed INTEGER;
  v_rollback UUID;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'w164_rollback_actor_required'; END IF;
  SELECT * INTO v_run FROM public.w164_visibility_reconciliation_runs WHERE id=p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'w164_rollback_run_not_found'; END IF;
  IF EXISTS (SELECT 1 FROM public.w164_visibility_reconciliation_rollbacks WHERE run_id=p_run_id) THEN
    RAISE EXCEPTION 'w164_rollback_already_completed';
  END IF;

  CREATE TEMP TABLE w164_rollback (
    ordinal INTEGER NOT NULL,
    id UUID PRIMARY KEY,
    reference TEXT NOT NULL,
    status public.opportunity_status NOT NULL,
    is_demo BOOLEAN NOT NULL,
    reconciled_updated_at TIMESTAMPTZ NOT NULL,
    reconciled_updated_by TEXT NOT NULL,
    target_exposure public.opportunity_visibility NOT NULL
  ) ON COMMIT DROP;
  INSERT INTO w164_rollback
  SELECT ordinal,id,reference,status,is_demo,reconciled_updated_at,reconciled_updated_by,target_exposure
  FROM JSONB_TO_RECORDSET(v_run.rollback_manifest) AS item(
    ordinal INTEGER,id UUID,reference TEXT,status public.opportunity_status,is_demo BOOLEAN,
    reconciled_updated_at TIMESTAMPTZ,reconciled_updated_by TEXT,
    target_exposure public.opportunity_visibility
  );
  SELECT COUNT(*)::INTEGER INTO v_expected FROM w164_rollback;
  IF v_expected <> v_run.changed_count THEN RAISE EXCEPTION 'w164_rollback_manifest_invalid'; END IF;
  LOCK TABLE public.opportunities IN SHARE ROW EXCLUSIVE MODE;
  IF EXISTS (
    SELECT 1 FROM public.opportunities opportunity
    JOIN w164_rollback rollback ON rollback.id=opportunity.id
    WHERE opportunity.reference IS DISTINCT FROM rollback.reference
      OR opportunity.status IS DISTINCT FROM rollback.status
      OR opportunity.is_demo IS DISTINCT FROM rollback.is_demo
      OR opportunity.updated_at IS DISTINCT FROM rollback.reconciled_updated_at
      OR opportunity.updated_by IS DISTINCT FROM rollback.reconciled_updated_by
      OR opportunity.repreneur_exposure IS DISTINCT FROM public.w164_lifecycle_exposure(opportunity.status)
  ) THEN RAISE EXCEPTION 'w164_rollback_state_drift'; END IF;

  PERFORM set_config('wave.w164_guarded_rollback','on',TRUE);
  WITH changed AS (
    UPDATE public.opportunities opportunity
    SET repreneur_exposure=rollback.target_exposure,updated_by=v_actor
    FROM w164_rollback rollback WHERE opportunity.id=rollback.id RETURNING opportunity.id
  ) SELECT COUNT(*)::INTEGER INTO v_changed FROM changed;
  IF v_changed <> v_expected THEN RAISE EXCEPTION 'w164_rollback_count_drift'; END IF;
  INSERT INTO public.w164_visibility_reconciliation_rollbacks(run_id,actor,rolled_back_count)
  VALUES(p_run_id,v_actor,v_changed) RETURNING id INTO v_rollback;
  RETURN QUERY SELECT v_rollback,v_changed;
END;
$$;

-- Same-namespace is the sole DEMO boundary. Existing cross-namespace history is
-- retained, but every attempted mutation is frozen by this trigger.
CREATE OR REPLACE FUNCTION public.w164_match_has_same_namespace(p_match_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.opportunity_matches match
    JOIN public.opportunities opportunity ON opportunity.id=match.opportunity_id
    JOIN public.repreneurs repreneur ON repreneur.id=match.repreneur_id
    WHERE match.id=p_match_id AND opportunity.is_demo=repreneur.is_demo
  )
$$;

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
    RAISE EXCEPTION 'w164_cross_namespace_match_is_frozen_history';
  END IF;
  SELECT opportunity.is_demo=repreneur.is_demo INTO v_valid
  FROM public.opportunities opportunity, public.repreneurs repreneur
  WHERE opportunity.id=NEW.opportunity_id AND repreneur.id=NEW.repreneur_id;
  IF v_valid IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'w164_cross_namespace_match_denied'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_w164_match_namespace ON public.opportunity_matches;
CREATE TRIGGER enforce_w164_match_namespace
  BEFORE INSERT OR UPDATE OR DELETE ON public.opportunity_matches
  FOR EACH ROW EXECUTE FUNCTION public.enforce_w164_match_namespace();

CREATE OR REPLACE FUNCTION public.enforce_w164_match_child_namespace()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_match_id UUID;
BEGIN
  v_match_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.match_id ELSE NEW.match_id END;
  IF v_match_id IS NOT NULL AND NOT public.w164_match_has_same_namespace(v_match_id) THEN
    RAISE EXCEPTION 'w164_cross_namespace_match_action_denied';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'opportunity_pursuit_events',
    'opportunity_pursuit_evidence',
    'opportunity_pursuit_confidential_grants',
    'opportunity_nda_artifacts',
    'opportunity_memo_notifications'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS enforce_w164_match_child_namespace ON public.%I',table_name);
    EXECUTE format('CREATE TRIGGER enforce_w164_match_child_namespace BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_w164_match_child_namespace()',table_name);
  END LOOP;
END $$;

-- Reclassifying either endpoint can silently create, resolve or move an
-- existing relationship across namespaces. Once an endpoint has relationship
-- history, classification changes require a separately reviewed data plan.
CREATE OR REPLACE FUNCTION public.prevent_w164_matched_namespace_reclassification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.is_demo IS NOT DISTINCT FROM OLD.is_demo THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'opportunities' AND EXISTS(
    SELECT 1 FROM public.opportunity_matches WHERE opportunity_id=OLD.id
  ) THEN RAISE EXCEPTION 'w164_matched_opportunity_reclassification_denied'; END IF;
  IF TG_TABLE_NAME = 'repreneurs' AND EXISTS(
    SELECT 1 FROM public.opportunity_matches WHERE repreneur_id=OLD.id
  ) THEN RAISE EXCEPTION 'w164_matched_repreneur_reclassification_denied'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_w164_matched_namespace_reclassification ON public.opportunities;
CREATE TRIGGER prevent_w164_matched_namespace_reclassification
  BEFORE UPDATE OF is_demo ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.prevent_w164_matched_namespace_reclassification();
DROP TRIGGER IF EXISTS prevent_w164_matched_namespace_reclassification ON public.repreneurs;
CREATE TRIGGER prevent_w164_matched_namespace_reclassification
  BEFORE UPDATE OF is_demo ON public.repreneurs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_w164_matched_namespace_reclassification();

-- The portal inventory function returns a deliberately public-safe projection.
-- It never returns source identity, internal notes, source files, IMs or the
-- internal reference. Missing titles receive one neutral non-identifying label.
CREATE OR REPLACE FUNCTION public.w164_repreneur_live_inventory(
  p_repreneur_id UUID,
  p_opportunity_id UUID DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  is_demo BOOLEAN,
  reference TEXT,
  public_title TEXT,
  teaser_summary TEXT,
  sector TEXT,
  activity TEXT,
  location TEXT,
  revenue_meur NUMERIC,
  ebitda_keur NUMERIC,
  headcount INTEGER,
  geography_node_id UUID,
  headcount_range TEXT,
  date_added DATE,
  date_added_precision TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT
    opportunity.id,
    opportunity.is_demo,
    'Confidential opportunity'::TEXT,
    COALESCE(NULLIF(BTRIM(opportunity.public_title),''),'Confidential acquisition opportunity'),
    CASE
      WHEN NULLIF(BTRIM(opportunity.teaser_summary),'') IS NULL THEN NULL
      WHEN NULLIF(BTRIM(opportunity.description),'') IS NOT NULL
       AND REGEXP_REPLACE(LOWER(opportunity.teaser_summary),'[^[:alnum:]]','','g')
           = REGEXP_REPLACE(LOWER(opportunity.description),'[^[:alnum:]]','','g') THEN NULL
      ELSE opportunity.teaser_summary
    END,
    opportunity.sector,
    opportunity.activity,
    opportunity.location,
    opportunity.revenue_meur,
    opportunity.ebitda_keur,
    opportunity.headcount,
    opportunity.geography_node_id,
    opportunity.headcount_range,
    opportunity.date_added,
    opportunity.date_added_precision,
    opportunity.updated_at
  FROM public.repreneurs repreneur
  JOIN public.opportunities opportunity ON opportunity.is_demo=repreneur.is_demo
  WHERE repreneur.id=p_repreneur_id
    AND opportunity.status='active'
    AND (p_opportunity_id IS NULL OR opportunity.id=p_opportunity_id)
  ORDER BY opportunity.updated_at DESC,opportunity.id
$$;

-- Demo-to-demo portal responses are valid; cross-namespace and inactive rows
-- remain unavailable. Lifecycle replaces the old exposure approval condition.
CREATE OR REPLACE FUNCTION public.express_opportunity_interest(
  p_opportunity_id UUID,p_repreneur_id UUID,p_actor_id TEXT,p_expressed_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(match_id UUID,expressed_at TIMESTAMPTZ,notification_sent_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_opportunity public.opportunities%ROWTYPE; v_match public.opportunity_matches%ROWTYPE; v_has_match BOOLEAN:=FALSE; v_repreneur_demo BOOLEAN;
BEGIN
  SELECT is_demo INTO v_repreneur_demo FROM public.repreneurs WHERE id=p_repreneur_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'interest_not_available' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_opportunity FROM public.opportunities
    WHERE id=p_opportunity_id AND status='active' AND is_demo=v_repreneur_demo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'interest_not_available' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_match FROM public.opportunity_matches
    WHERE opportunity_id=p_opportunity_id AND repreneur_id=p_repreneur_id FOR UPDATE;
  v_has_match:=FOUND;
  IF v_has_match AND v_match.status='active_pursuit' THEN RAISE EXCEPTION 'interest_not_available' USING ERRCODE='P0001'; END IF;
  IF v_has_match AND ((v_match.nda_status='signed' AND v_match.nda_signed_at IS NULL)
    OR (v_match.nda_status='waived' AND (v_match.nda_waived_at IS NULL OR NULLIF(BTRIM(v_match.nda_waived_by),'') IS NULL)))
  THEN RAISE EXCEPTION 'interest_not_available' USING ERRCODE='P0001'; END IF;
  PERFORM 1 FROM public.opportunity_matches
    WHERE opportunity_id=p_opportunity_id AND status='active_pursuit' AND repreneur_id<>p_repreneur_id FOR UPDATE;
  IF v_has_match AND v_match.status='interested' THEN
    IF v_match.interest_expressed_at IS NULL THEN RAISE EXCEPTION 'interest_not_available' USING ERRCODE='P0001'; END IF;
    RETURN QUERY SELECT v_match.id,v_match.interest_expressed_at,v_match.interest_notification_sent_at; RETURN;
  END IF;
  IF v_has_match THEN
    UPDATE public.opportunity_matches SET status='interested',decline_reason_categories='{}',decline_reason_text=NULL,
      pursuit_stage=NULL,pursuit_stage_notes=NULL,pursuit_stage_updated_by=NULL,pursuit_stage_updated_at=NULL,
      reviewed_by=NULL,reviewed_at=NULL,interest_expressed_at=p_expressed_at,interest_notification_sent_at=NULL
    WHERE id=v_match.id RETURNING * INTO v_match;
  ELSE
    INSERT INTO public.opportunity_matches(opportunity_id,repreneur_id,status,created_by,interest_expressed_at)
    VALUES(p_opportunity_id,p_repreneur_id,'interested',p_actor_id,p_expressed_at) RETURNING * INTO v_match;
  END IF;
  RETURN QUERY SELECT v_match.id,v_match.interest_expressed_at,v_match.interest_notification_sent_at;
END
$$;

CREATE OR REPLACE FUNCTION public.update_repreneur_opportunity_response(
  p_match_id UUID,p_repreneur_id UUID,p_status TEXT,
  p_decline_reason_categories TEXT[] DEFAULT '{}',p_decline_reason_text TEXT DEFAULT NULL
)
RETURNS TABLE(match_id UUID,opportunity_id UUID,status TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE; v_opportunity public.opportunities%ROWTYPE; v_repreneur_demo BOOLEAN;
BEGIN
  IF p_status NOT IN ('interested','declined') THEN RAISE EXCEPTION 'response_not_available' USING ERRCODE='P0001'; END IF;
  SELECT is_demo INTO v_repreneur_demo FROM public.repreneurs WHERE id=p_repreneur_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'response_not_available' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id AND repreneur_id=p_repreneur_id FOR UPDATE;
  IF NOT FOUND OR NOT public.w164_match_has_same_namespace(v_match.id) THEN RAISE EXCEPTION 'response_not_available' USING ERRCODE='P0001'; END IF;
  IF v_match.status NOT IN ('proposed','interested','declined') THEN RAISE EXCEPTION 'response_locked' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_opportunity FROM public.opportunities opportunity
    WHERE opportunity.id=v_match.opportunity_id AND opportunity.status='active' AND opportunity.is_demo=v_repreneur_demo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'response_not_available' USING ERRCODE='P0001'; END IF;
  UPDATE public.opportunity_matches SET status=p_status::public.opportunity_match_status,
    decline_reason_categories=CASE WHEN p_status='declined' THEN COALESCE(p_decline_reason_categories,'{}') ELSE '{}' END,
    decline_reason_text=CASE WHEN p_status='declined' THEN NULLIF(BTRIM(p_decline_reason_text),'') ELSE NULL END,
    reviewed_by=NULL,reviewed_at=NULL WHERE id=v_match.id;
  RETURN QUERY SELECT v_match.id,v_opportunity.id,p_status;
END
$$;

CREATE OR REPLACE FUNCTION public.journey_repreneur_can_access_confidential(
  p_match_id UUID,p_repreneur_id UUID,p_document_id UUID
)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.wave_journey_is_enabled() AND EXISTS(
    SELECT 1 FROM public.opportunity_matches match
    JOIN public.repreneurs repreneur ON repreneur.id=match.repreneur_id
    JOIN public.opportunities opportunity ON opportunity.id=match.opportunity_id AND opportunity.is_demo=repreneur.is_demo
    JOIN public.opportunity_pursuit_confidential_grants grant_row ON grant_row.match_id=match.id
    WHERE match.id=p_match_id AND match.repreneur_id=p_repreneur_id AND match.status='active_pursuit'
      AND opportunity.status='active' AND grant_row.information_memo_document_id=p_document_id
      AND grant_row.revoked_at IS NULL AND grant_row.nda_expires_at>NOW()
      AND grant_row.cycle_started_evidence_id=public.journey_current_cycle_event(match.id)
      AND grant_row.gate_2_evidence_id=public.journey_current_gate_2_event(match.id)
      AND grant_row.dispatch_evidence_id=public.journey_current_dispatch_event(match.id)
  )
$$;

CREATE OR REPLACE FUNCTION public.journey_repreneur_authorized_template(
  p_match_id UUID,p_repreneur_id UUID
)
RETURNS TABLE(document_id UUID,storage_bucket TEXT,storage_path TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT document.id,document.storage_bucket,document.storage_path
  FROM public.wave_journey_settings settings
  JOIN public.opportunity_matches match ON match.id=p_match_id
  JOIN public.repreneurs repreneur ON repreneur.id=match.repreneur_id
  JOIN public.opportunities opportunity ON opportunity.id=match.opportunity_id AND opportunity.is_demo=repreneur.is_demo
  JOIN public.opportunity_nda_artifacts artifact ON artifact.id=public.journey_current_template_id(match.id)
  JOIN public.opportunity_documents document ON document.id=artifact.document_id
  WHERE settings.singleton=TRUE AND settings.enabled=TRUE
    AND match.repreneur_id=p_repreneur_id AND match.status='active_pursuit' AND opportunity.status='active'
    AND public.journey_current_gate_1_event(match.id) IS NOT NULL
    AND artifact.opportunity_id=match.opportunity_id AND artifact.match_id IS NULL AND artifact.artifact_role='blank_template'
    AND document.opportunity_id=match.opportunity_id AND document.document_type='nda' AND document.visibility='staff_only'
    AND document.external_url IS NULL AND document.storage_bucket='opportunity-documents'
    AND document.storage_path LIKE match.opportunity_id::TEXT||'/nda-artifacts/blank_template/%'
    AND ((LOWER(COALESCE(document.file_name,'')) LIKE '%.pdf' AND LOWER(COALESCE(document.mime_type,''))='application/pdf')
      OR (LOWER(COALESCE(document.file_name,'')) LIKE '%.docx'
        AND LOWER(COALESCE(document.mime_type,''))='application/vnd.openxmlformats-officedocument.wordprocessingml.document'))
    AND COALESCE(document.size_bytes,0)>0 LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.journey_submit_repreneur_signed_copy(
  p_match_id UUID,p_repreneur_id UUID,p_actor_email TEXT,p_title TEXT,p_storage_path TEXT,
  p_file_name TEXT,p_file_size BIGINT,p_content_sha256 TEXT
)
RETURNS TABLE(artifact_id UUID,document_id UUID,version_number INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE; v_email TEXT; v_gate UUID; v_prior UUID; v_version INTEGER; v_document UUID; v_artifact UUID;
BEGIN
  IF NOT public.wave_journey_is_enabled() THEN RAISE EXCEPTION 'wave_journey_disabled'; END IF;
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE;
  SELECT LOWER(BTRIM(email)) INTO v_email FROM public.repreneurs WHERE id=p_repreneur_id;
  IF v_match.id IS NULL OR NOT public.w164_match_has_same_namespace(v_match.id)
    OR v_match.status<>'active_pursuit' OR v_match.repreneur_id<>p_repreneur_id
    OR v_email IS NULL OR v_email<>LOWER(BTRIM(p_actor_email))
    OR NOT EXISTS(SELECT 1 FROM public.opportunities WHERE id=v_match.opportunity_id AND status='active')
  THEN RAISE EXCEPTION 'Only the active pursuit repreneur may submit this signed copy.'; END IF;
  v_gate:=public.journey_current_gate_1_event(p_match_id);
  IF v_gate IS NULL THEN RAISE EXCEPTION 'Current Gate 1 is required before signed-copy submission.'; END IF;
  IF NULLIF(BTRIM(p_title),'') IS NULL OR NULLIF(BTRIM(p_storage_path),'') IS NULL
    OR LOWER(p_file_name) NOT LIKE '%.pdf' OR p_file_size<=0 OR p_file_size>20971520
    OR LOWER(p_content_sha256)!~'^[0-9a-f]{64}$'
    OR p_storage_path NOT LIKE v_match.opportunity_id::TEXT||'/nda-artifacts/repreneur_signed_copy/%'
  THEN RAISE EXCEPTION 'Submit one retained PDF in the canonical signed-copy path.'; END IF;
  SELECT artifact.id,artifact.version_number INTO v_artifact,v_version
  FROM public.opportunity_nda_artifacts artifact
  WHERE artifact.match_id=p_match_id AND artifact.artifact_role='repreneur_signed_copy'
    AND artifact.content_sha256=LOWER(p_content_sha256) LIMIT 1;
  IF v_artifact IS NOT NULL THEN
    RETURN QUERY SELECT v_artifact,(SELECT artifact.document_id FROM public.opportunity_nda_artifacts artifact WHERE artifact.id=v_artifact),v_version; RETURN;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_match_id::TEXT||':repreneur_signed_copy',0));
  SELECT artifact.id,artifact.document_id,artifact.version_number INTO v_artifact,v_document,v_version
  FROM public.opportunity_nda_artifacts artifact
  WHERE artifact.match_id=p_match_id AND artifact.artifact_role='repreneur_signed_copy'
    AND artifact.content_sha256=LOWER(p_content_sha256) LIMIT 1;
  IF v_artifact IS NOT NULL THEN RETURN QUERY SELECT v_artifact,v_document,v_version; RETURN; END IF;
  SELECT artifact.id,artifact.version_number+1 INTO v_prior,v_version
  FROM public.opportunity_nda_artifacts artifact
  WHERE artifact.match_id=p_match_id AND artifact.artifact_role='repreneur_signed_copy'
  ORDER BY artifact.version_number DESC LIMIT 1;
  v_version:=COALESCE(v_version,1);
  INSERT INTO public.opportunity_documents(opportunity_id,title,document_type,visibility,storage_bucket,storage_path,file_name,size_bytes,mime_type,uploaded_by)
  VALUES(v_match.opportunity_id,p_title,'nda','staff_only','opportunity-documents',p_storage_path,p_file_name,p_file_size,'application/pdf',p_actor_email)
  RETURNING id INTO v_document;
  PERFORM set_config('wave.journey_portal_repreneur_upload','on',true);
  INSERT INTO public.opportunity_nda_artifacts(opportunity_id,match_id,document_id,artifact_role,version_number,content_sha256,supersedes_artifact_id,recorded_by,recorded_at)
  VALUES(v_match.opportunity_id,p_match_id,v_document,'repreneur_signed_copy',v_version,LOWER(p_content_sha256),v_prior,p_actor_email,clock_timestamp())
  RETURNING id INTO v_artifact;
  RETURN QUERY SELECT v_artifact,v_document,v_version;
EXCEPTION WHEN unique_violation THEN
  SELECT artifact.id,artifact.document_id,artifact.version_number INTO v_artifact,v_document,v_version
  FROM public.opportunity_nda_artifacts artifact
  WHERE artifact.match_id=p_match_id AND artifact.artifact_role='repreneur_signed_copy'
    AND artifact.content_sha256=LOWER(p_content_sha256) LIMIT 1;
  IF v_artifact IS NULL THEN RAISE; END IF;
  RETURN QUERY SELECT v_artifact,v_document,v_version;
END
$$;

-- The former manual publication actions remain as explicit compatibility
-- errors so stale clients cannot recreate a second visibility gate.
CREATE OR REPLACE FUNCTION public.publish_w021_opportunity(
  p_opportunity_id UUID,p_actor TEXT
)
RETURNS TABLE(event_id UUID,opportunity_id UUID,resulting_exposure public.opportunity_visibility)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'w164_visibility_is_derived_from_lifecycle';
END
$$;

CREATE OR REPLACE FUNCTION public.withdraw_w021_opportunity(
  p_opportunity_id UUID,p_actor TEXT
)
RETURNS TABLE(event_id UUID,opportunity_id UUID,resulting_exposure public.opportunity_visibility)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'w164_visibility_is_derived_from_lifecycle';
END
$$;

CREATE OR REPLACE FUNCTION public.set_opportunity_broad_discovery_visibility(
  p_opportunity_id UUID,p_visible BOOLEAN,p_actor TEXT
)
RETURNS TABLE(event_id UUID,opportunity_id UUID,resulting_exposure public.opportunity_visibility)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'w164_visibility_is_derived_from_lifecycle';
END
$$;

REVOKE ALL ON TABLE public.w164_visibility_reconciliation_runs,
  public.w164_visibility_reconciliation_rollbacks FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.w164_visibility_reconciliation_runs,
  public.w164_visibility_reconciliation_rollbacks TO service_role;

REVOKE ALL ON FUNCTION public.w164_lifecycle_exposure(public.opportunity_status),
  public.enforce_w164_lifecycle_exposure(),public.w164_visibility_preflight(),
  public.w164_visibility_manifest_digest(JSONB),
  public.apply_w164_visibility_reconciliation(JSONB,TEXT,TEXT),
  public.rollback_w164_visibility_reconciliation(UUID,TEXT),
  public.w164_match_has_same_namespace(UUID),public.enforce_w164_match_namespace(),
  public.enforce_w164_match_child_namespace(),public.prevent_w164_matched_namespace_reclassification(),
  public.w164_repreneur_live_inventory(UUID,UUID)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.w164_lifecycle_exposure(public.opportunity_status),
  public.enforce_w164_lifecycle_exposure(),public.w164_visibility_preflight(),
  public.w164_visibility_manifest_digest(JSONB),
  public.apply_w164_visibility_reconciliation(JSONB,TEXT,TEXT),
  public.rollback_w164_visibility_reconciliation(UUID,TEXT),
  public.w164_match_has_same_namespace(UUID),public.enforce_w164_match_namespace(),
  public.enforce_w164_match_child_namespace(),public.prevent_w164_matched_namespace_reclassification(),
  public.w164_repreneur_live_inventory(UUID,UUID)
  TO service_role;

REVOKE ALL ON FUNCTION public.express_opportunity_interest(UUID,UUID,TEXT,TIMESTAMPTZ),
  public.update_repreneur_opportunity_response(UUID,UUID,TEXT,TEXT[],TEXT),
  public.journey_repreneur_can_access_confidential(UUID,UUID,UUID),
  public.journey_repreneur_authorized_template(UUID,UUID),
  public.journey_submit_repreneur_signed_copy(UUID,UUID,TEXT,TEXT,TEXT,TEXT,BIGINT,TEXT),
  public.publish_w021_opportunity(UUID,TEXT),
  public.withdraw_w021_opportunity(UUID,TEXT),
  public.set_opportunity_broad_discovery_visibility(UUID,BOOLEAN,TEXT)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.express_opportunity_interest(UUID,UUID,TEXT,TIMESTAMPTZ),
  public.update_repreneur_opportunity_response(UUID,UUID,TEXT,TEXT[],TEXT),
  public.journey_repreneur_can_access_confidential(UUID,UUID,UUID),
  public.journey_repreneur_authorized_template(UUID,UUID),
  public.journey_submit_repreneur_signed_copy(UUID,UUID,TEXT,TEXT,TEXT,TEXT,BIGINT,TEXT),
  public.publish_w021_opportunity(UUID,TEXT),
  public.withdraw_w021_opportunity(UUID,TEXT),
  public.set_opportunity_broad_discovery_visibility(UUID,BOOLEAN,TEXT)
  TO service_role;
