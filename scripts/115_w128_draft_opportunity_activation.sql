-- Migration 115 / W-128: a deliberately one-time, approval-gated Draft -> Active operation.
--
-- This migration installs read-only preflight and guarded apply/rollback primitives only.
-- It neither selects a production candidate set nor mutates any opportunity.
-- The release operator must supply the reviewed, ordered manifest returned by
-- w128_draft_activation_preflight() and a matching digest at Gate 2.

CREATE TABLE IF NOT EXISTS public.w128_draft_activation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_key TEXT NOT NULL DEFAULT 'W-128' UNIQUE CHECK (operation_key = 'W-128'),
  actor TEXT NOT NULL,
  manifest_digest TEXT NOT NULL,
  manifest JSONB NOT NULL,
  rollback_manifest JSONB NOT NULL,
  activated_count INTEGER NOT NULL,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (NULLIF(BTRIM(actor), '') IS NOT NULL),
  CHECK (manifest_digest ~ '^[0-9a-f]{64}$'),
  CHECK (activated_count > 0)
);

COMMENT ON TABLE public.w128_draft_activation_runs IS
  'Immutable audit evidence for the separately approved W-128 one-time Draft-to-Active operation. The migration itself performs no activation or rollback.';

CREATE TABLE IF NOT EXISTS public.w128_draft_activation_rollbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL UNIQUE REFERENCES public.w128_draft_activation_runs(id),
  actor TEXT NOT NULL,
  rollback_manifest JSONB NOT NULL,
  rolled_back_count INTEGER NOT NULL,
  rolled_back_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (NULLIF(BTRIM(actor), '') IS NOT NULL),
  CHECK (rolled_back_count > 0)
);

COMMENT ON TABLE public.w128_draft_activation_rollbacks IS
  'Immutable audit evidence for one manifest-bound rollback of a W-128 activation run. The migration itself performs no activation or rollback.';

CREATE OR REPLACE FUNCTION public.prevent_w128_draft_activation_run_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'w128_draft_activation_runs_are_immutable';
END;
$$;

DROP TRIGGER IF EXISTS prevent_w128_draft_activation_run_mutation ON public.w128_draft_activation_runs;
CREATE TRIGGER prevent_w128_draft_activation_run_mutation
  BEFORE UPDATE OR DELETE ON public.w128_draft_activation_runs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_w128_draft_activation_run_mutation();

DROP TRIGGER IF EXISTS prevent_w128_draft_activation_rollback_mutation ON public.w128_draft_activation_rollbacks;
CREATE TRIGGER prevent_w128_draft_activation_rollback_mutation
  BEFORE UPDATE OR DELETE ON public.w128_draft_activation_rollbacks
  FOR EACH ROW EXECUTE FUNCTION public.prevent_w128_draft_activation_run_mutation();

DROP TRIGGER IF EXISTS prevent_w128_draft_activation_run_truncate ON public.w128_draft_activation_runs;
CREATE TRIGGER prevent_w128_draft_activation_run_truncate
  BEFORE TRUNCATE ON public.w128_draft_activation_runs
  FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_w128_draft_activation_run_mutation();

DROP TRIGGER IF EXISTS prevent_w128_draft_activation_rollback_truncate ON public.w128_draft_activation_rollbacks;
CREATE TRIGGER prevent_w128_draft_activation_rollback_truncate
  BEFORE TRUNCATE ON public.w128_draft_activation_rollbacks
  FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_w128_draft_activation_run_mutation();

CREATE OR REPLACE FUNCTION public.w128_draft_activation_preflight()
RETURNS TABLE (
  ordinal INTEGER,
  id UUID,
  reference TEXT,
  updated_at TIMESTAMPTZ,
  fingerprint TEXT,
  eligible BOOLEAN,
  exclusion_reasons TEXT[],
  match_count INTEGER,
  repreneur_exposure public.opportunity_visibility,
  source_visibility public.opportunity_visibility
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH candidate AS (
    SELECT
      opportunity.id,
      opportunity.reference,
      opportunity.updated_at,
      opportunity.is_demo,
      opportunity.status,
      opportunity.source_office_id,
      opportunity.description,
      opportunity.repreneur_exposure,
      opportunity.source_visibility,
      office.id AS office_id,
      office.status AS office_status,
      office.is_default AS office_is_default,
      firm.id AS firm_id,
      firm.status AS firm_status,
      EXISTS (
        SELECT 1 FROM public.ma_offices real_office
        WHERE real_office.firm_id = office.firm_id
          AND real_office.status = 'active'
          AND NOT real_office.is_default
      ) AS has_real_active_office,
      COALESCE(contacts.active_count, 0) AS active_contact_count,
      COALESCE(contacts.primary_count, 0) AS primary_contact_count,
      COALESCE(contacts.has_usable_primary_email, FALSE) AS has_usable_primary_email,
      COALESCE(contacts.has_invalid_active_contact, FALSE) AS has_invalid_active_contact,
      COALESCE(contacts.contact_fingerprint, '') AS contact_fingerprint,
      COALESCE(matches.match_count, 0) AS match_count
    FROM public.opportunities opportunity
    LEFT JOIN public.ma_offices office ON office.id = opportunity.source_office_id
    LEFT JOIN public.ma_firms firm ON firm.id = office.firm_id
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::INTEGER AS active_count,
        COUNT(*) FILTER (WHERE link.is_primary)::INTEGER AS primary_count,
        COALESCE(BOOL_OR(
          link.is_primary
          AND affiliation.is_active
          AND contact.status = 'active'
          AND (NULLIF(BTRIM(contact.first_name), '') IS NOT NULL OR NULLIF(BTRIM(contact.last_name), '') IS NOT NULL)
          AND NULLIF(BTRIM(contact.email), '') IS NOT NULL
          AND BTRIM(contact.email) ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
        ), FALSE) AS has_usable_primary_email,
        COALESCE(BOOL_OR(
          affiliation.office_id IS DISTINCT FROM opportunity.source_office_id
          OR NOT affiliation.is_active
          OR contact.status <> 'active'
        ), FALSE) AS has_invalid_active_contact,
        STRING_AGG(
          CONCAT_WS(':', link.id, link.affiliation_id, link.is_primary, link.is_active, affiliation.office_id, affiliation.is_active, contact.status, contact.first_name, contact.last_name, contact.email),
          ',' ORDER BY link.id
        ) AS contact_fingerprint
      FROM public.opportunity_ma_contacts link
      JOIN public.ma_contact_office_affiliations affiliation ON affiliation.id = link.affiliation_id
      JOIN public.ma_contacts contact ON contact.id = affiliation.contact_id
      WHERE link.opportunity_id = opportunity.id
        AND link.is_active
    ) contacts ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::INTEGER AS match_count
      FROM public.opportunity_matches match
      WHERE match.opportunity_id = opportunity.id
    ) matches ON TRUE
    WHERE opportunity.status = 'draft'
  ), classified AS (
    SELECT
      candidate.*,
      ARRAY_REMOVE(ARRAY[
        CASE WHEN is_demo THEN 'demo_classification' END,
        CASE WHEN source_office_id IS NULL THEN 'source_office_missing' END,
        CASE WHEN office_status IS DISTINCT FROM 'active' THEN 'source_office_inactive_or_missing' END,
        CASE WHEN firm_status IS NULL OR firm_status = 'archived' THEN 'source_firm_archived_or_missing' END,
        CASE WHEN office_is_default AND has_real_active_office THEN 'synthetic_default_when_real_office_exists' END,
        CASE WHEN NULLIF(BTRIM(description), '') IS NULL THEN 'description_missing' END,
        CASE WHEN has_invalid_active_contact THEN 'active_contact_invalid_or_wrong_office' END,
        CASE WHEN active_contact_count = 0 THEN 'active_contact_missing' END,
        CASE WHEN primary_contact_count <> 1 THEN 'primary_contact_not_exactly_one' END,
        CASE WHEN NOT has_usable_primary_email THEN 'primary_email_unusable' END
      ], NULL) AS exclusion_reasons
    FROM candidate
  ), fingerprinted AS (
    SELECT
      classified.*,
      ENCODE(extensions.digest(CONVERT_TO(CONCAT_WS('|',
        id, reference, TO_CHAR(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        is_demo, status, source_office_id, description, repreneur_exposure, source_visibility,
        office_id, office_status, office_is_default, firm_id, firm_status, has_real_active_office,
        active_contact_count, primary_contact_count, has_usable_primary_email, has_invalid_active_contact,
        -- Matches are explicitly preserved by W-128 but do not decide whether a
        -- Draft is eligible. Keeping their volatile count outside the manifest
        -- fingerprint avoids a false drift race with a concurrent match insert.
        contact_fingerprint
      ), 'UTF8'), 'sha256'), 'hex') AS fingerprint
    FROM classified
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY reference, id)::INTEGER AS ordinal,
    id, reference, updated_at, fingerprint,
    CARDINALITY(exclusion_reasons) = 0 AS eligible,
    exclusion_reasons, match_count, repreneur_exposure, source_visibility
  FROM fingerprinted
  ORDER BY reference, id;
$$;

-- Hash the downstream lifecycle state that makes a later Active -> Draft
-- rollback unsafe. Only the digest is retained; no repreneur, document or
-- pursuit content is copied into the W-128 audit tables.
CREATE OR REPLACE FUNCTION public.w128_opportunity_dependency_fingerprint(
  p_opportunity_id UUID
)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT ENCODE(extensions.digest(CONVERT_TO(JSONB_BUILD_OBJECT(
    'matches', COALESCE((SELECT JSONB_AGG(TO_JSONB(row_value) ORDER BY row_value.id) FROM public.opportunity_matches row_value WHERE row_value.opportunity_id = p_opportunity_id), '[]'::JSONB),
    'documents', COALESCE((SELECT JSONB_AGG(TO_JSONB(row_value) ORDER BY row_value.id) FROM public.opportunity_documents row_value WHERE row_value.opportunity_id = p_opportunity_id), '[]'::JSONB),
    'nda_artifacts', COALESCE((SELECT JSONB_AGG(TO_JSONB(row_value) ORDER BY row_value.id) FROM public.opportunity_nda_artifacts row_value WHERE row_value.opportunity_id = p_opportunity_id), '[]'::JSONB),
    'confidential_grants', COALESCE((SELECT JSONB_AGG(TO_JSONB(row_value) ORDER BY row_value.id) FROM public.opportunity_pursuit_confidential_grants row_value WHERE row_value.opportunity_id = p_opportunity_id), '[]'::JSONB),
    'pursuit_events', COALESCE((SELECT JSONB_AGG(TO_JSONB(row_value) ORDER BY row_value.id) FROM public.opportunity_pursuit_events row_value WHERE row_value.opportunity_id = p_opportunity_id), '[]'::JSONB),
    'pursuit_evidence', COALESCE((SELECT JSONB_AGG(TO_JSONB(row_value) ORDER BY row_value.id) FROM public.opportunity_pursuit_evidence row_value WHERE row_value.opportunity_id = p_opportunity_id), '[]'::JSONB),
    'memo_notifications', COALESCE((SELECT JSONB_AGG(TO_JSONB(row_value) ORDER BY row_value.id) FROM public.opportunity_memo_notifications row_value WHERE row_value.opportunity_id = p_opportunity_id), '[]'::JSONB),
    'closure_history', COALESCE((SELECT JSONB_AGG(TO_JSONB(row_value) ORDER BY row_value.id) FROM public.opportunity_closure_history row_value WHERE row_value.opportunity_id = p_opportunity_id), '[]'::JSONB),
    'ma_contacts', COALESCE((SELECT JSONB_AGG(TO_JSONB(row_value) ORDER BY row_value.id) FROM public.opportunity_ma_contacts row_value WHERE row_value.opportunity_id = p_opportunity_id), '[]'::JSONB),
    'legacy_source_contacts', COALESCE((SELECT JSONB_AGG(TO_JSONB(row_value) ORDER BY row_value.contact_id, row_value.source_id) FROM public.opportunity_source_contacts row_value WHERE row_value.opportunity_id = p_opportunity_id), '[]'::JSONB)
  )::TEXT, 'UTF8'), 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.apply_w128_draft_activation(
  p_manifest JSONB,
  p_manifest_digest TEXT,
  p_actor TEXT
)
RETURNS TABLE (run_id UUID, activated_count INTEGER, rollback_manifest JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor TEXT := NULLIF(BTRIM(p_actor), '');
  v_expected_digest TEXT;
  v_expected_count INTEGER;
  v_locked_count INTEGER;
  v_run_id UUID;
  v_rollback JSONB;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'w128_activation_actor_required'; END IF;
  IF JSONB_TYPEOF(p_manifest) <> 'array' OR JSONB_ARRAY_LENGTH(p_manifest) = 0 THEN RAISE EXCEPTION 'w128_activation_manifest_required'; END IF;
  IF p_manifest_digest !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'w128_activation_manifest_digest_invalid'; END IF;

  -- Serialize the deliberately one-time operation, then freeze every table
  -- that can change the Active eligibility decision while the exact manifest
  -- is compared and applied. Reads remain available during this short gate.
  PERFORM pg_advisory_xact_lock(hashtextextended('w128:draft-activation', 115));
  IF EXISTS (SELECT 1 FROM public.w128_draft_activation_runs) THEN
    RAISE EXCEPTION 'w128_activation_already_completed';
  END IF;
  LOCK TABLE public.opportunities, public.ma_offices, public.ma_firms,
    public.opportunity_ma_contacts, public.ma_contact_office_affiliations,
    public.ma_contacts IN SHARE ROW EXCLUSIVE MODE;

  CREATE TEMP TABLE w128_manifest (
    ordinal INTEGER NOT NULL UNIQUE,
    id UUID PRIMARY KEY,
    reference TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    fingerprint TEXT NOT NULL
  ) ON COMMIT DROP;
  INSERT INTO w128_manifest(ordinal, id, reference, updated_at, fingerprint)
  SELECT ordinal, id, reference, updated_at, fingerprint
  FROM JSONB_TO_RECORDSET(p_manifest) AS item(ordinal INTEGER, id UUID, reference TEXT, updated_at TIMESTAMPTZ, fingerprint TEXT);
  SELECT COUNT(*) INTO v_expected_count FROM w128_manifest;
  IF v_expected_count <> JSONB_ARRAY_LENGTH(p_manifest) THEN RAISE EXCEPTION 'w128_activation_manifest_duplicate_or_invalid'; END IF;

  SELECT ENCODE(extensions.digest(CONVERT_TO(STRING_AGG(CONCAT_WS('|', ordinal, id, reference, TO_CHAR(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), fingerprint), E'\n' ORDER BY ordinal), 'UTF8'), 'sha256'), 'hex')
  INTO v_expected_digest FROM w128_manifest;
  IF v_expected_digest IS DISTINCT FROM p_manifest_digest THEN RAISE EXCEPTION 'w128_activation_manifest_digest_mismatch'; END IF;

  -- Gate 2 authorizes the complete fresh eligible set, never a caller-chosen
  -- subset. Reject any omitted, extra, reordered or drifted row.
  IF EXISTS (
    SELECT 1
    FROM w128_manifest manifest
    FULL OUTER JOIN (
      SELECT ordinal, id, reference, updated_at, fingerprint
      FROM public.w128_draft_activation_preflight()
      WHERE eligible
    ) current ON current.id = manifest.id
    WHERE manifest.id IS NULL OR current.id IS NULL
      OR current.ordinal IS DISTINCT FROM manifest.ordinal
      OR current.reference IS DISTINCT FROM manifest.reference
      OR current.updated_at IS DISTINCT FROM manifest.updated_at
      OR current.fingerprint IS DISTINCT FROM manifest.fingerprint
  ) THEN RAISE EXCEPTION 'w128_activation_manifest_set_mismatch'; END IF;

  -- Lock every record that feeds the active-contract decision before its
  -- current fingerprint is recomputed. This makes a concurrent correction a
  -- clean failure rather than a partial activation.
  PERFORM 1 FROM public.opportunities opportunity JOIN w128_manifest manifest ON manifest.id = opportunity.id FOR UPDATE OF opportunity;
  GET DIAGNOSTICS v_locked_count = ROW_COUNT;
  IF v_locked_count <> v_expected_count THEN RAISE EXCEPTION 'w128_activation_identity_mismatch'; END IF;
  PERFORM 1 FROM public.ma_offices office JOIN public.opportunities opportunity ON opportunity.source_office_id = office.id JOIN w128_manifest manifest ON manifest.id = opportunity.id FOR UPDATE OF office;
  PERFORM 1 FROM public.ma_firms firm JOIN public.ma_offices office ON office.firm_id = firm.id JOIN public.opportunities opportunity ON opportunity.source_office_id = office.id JOIN w128_manifest manifest ON manifest.id = opportunity.id FOR UPDATE OF firm;
  -- Lock inactive links too: otherwise a concurrent correction could activate
  -- an existing historical link after the current active set was inspected.
  PERFORM 1 FROM public.opportunity_ma_contacts link JOIN w128_manifest manifest ON manifest.id = link.opportunity_id FOR UPDATE OF link;
  PERFORM 1 FROM public.ma_contact_office_affiliations affiliation JOIN public.opportunity_ma_contacts link ON link.affiliation_id = affiliation.id JOIN w128_manifest manifest ON manifest.id = link.opportunity_id FOR UPDATE OF affiliation;
  PERFORM 1 FROM public.ma_contacts contact JOIN public.ma_contact_office_affiliations affiliation ON affiliation.contact_id = contact.id JOIN public.opportunity_ma_contacts link ON link.affiliation_id = affiliation.id JOIN w128_manifest manifest ON manifest.id = link.opportunity_id FOR UPDATE OF contact;

  IF EXISTS (
    SELECT 1 FROM w128_manifest manifest
    LEFT JOIN public.w128_draft_activation_preflight() current ON current.id = manifest.id
    WHERE current.id IS NULL OR NOT current.eligible
      OR current.reference IS DISTINCT FROM manifest.reference
      OR current.updated_at IS DISTINCT FROM manifest.updated_at
      OR current.fingerprint IS DISTINCT FROM manifest.fingerprint
  ) THEN RAISE EXCEPTION 'w128_activation_manifest_drift'; END IF;

  WITH activated AS (
    UPDATE public.opportunities opportunity
    SET status = 'active', updated_by = v_actor
    FROM w128_manifest manifest
    WHERE opportunity.id = manifest.id
      AND opportunity.status = 'draft'
      AND NOT opportunity.is_demo
    RETURNING opportunity.id, opportunity.status, opportunity.updated_at, opportunity.updated_by
  )
  SELECT
    COUNT(*)::INTEGER,
    JSONB_AGG(JSONB_BUILD_OBJECT(
      'ordinal', manifest.ordinal, 'id', manifest.id, 'reference', manifest.reference,
      'status_before_rollback', activated.status,
      -- A normal before-update trigger may advance updated_at. Store the exact
      -- post-activation value so rollback refuses a record changed afterwards.
      'activation_updated_at', activated.updated_at,
      'activation_updated_by', activated.updated_by,
      'dependency_fingerprint', public.w128_opportunity_dependency_fingerprint(activated.id),
      'target_status', 'draft'
    ) ORDER BY manifest.ordinal)
  INTO v_locked_count, v_rollback
  FROM w128_manifest manifest
  JOIN activated ON activated.id = manifest.id;
  IF v_locked_count <> v_expected_count THEN RAISE EXCEPTION 'w128_activation_status_drift'; END IF;

  INSERT INTO public.w128_draft_activation_runs(actor, manifest_digest, manifest, rollback_manifest, activated_count)
  VALUES (v_actor, p_manifest_digest, p_manifest, v_rollback, v_expected_count)
  RETURNING id INTO v_run_id;
  RETURN QUERY SELECT v_run_id, v_expected_count, v_rollback;
END;
$$;

CREATE OR REPLACE FUNCTION public.rollback_w128_draft_activation(
  p_run_id UUID,
  p_actor TEXT
)
RETURNS TABLE (rollback_id UUID, rolled_back_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor TEXT := NULLIF(BTRIM(p_actor), '');
  v_run public.w128_draft_activation_runs%ROWTYPE;
  v_expected_count INTEGER;
  v_locked_count INTEGER;
  v_rollback_id UUID;
  v_result_manifest JSONB;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'w128_rollback_actor_required'; END IF;

  SELECT * INTO v_run
  FROM public.w128_draft_activation_runs
  WHERE id = p_run_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'w128_rollback_run_not_found'; END IF;
  IF EXISTS (SELECT 1 FROM public.w128_draft_activation_rollbacks WHERE run_id = p_run_id) THEN
    RAISE EXCEPTION 'w128_rollback_already_recorded';
  END IF;

  CREATE TEMP TABLE w128_rollback_manifest (
    ordinal INTEGER NOT NULL,
    id UUID PRIMARY KEY,
    reference TEXT NOT NULL,
    status_before_rollback TEXT NOT NULL,
    activation_updated_at TIMESTAMPTZ NOT NULL,
    activation_updated_by TEXT NOT NULL,
    dependency_fingerprint TEXT NOT NULL,
    target_status TEXT NOT NULL
  ) ON COMMIT DROP;
  INSERT INTO w128_rollback_manifest(
    ordinal, id, reference, status_before_rollback, activation_updated_at,
    activation_updated_by, dependency_fingerprint, target_status
  )
  SELECT ordinal, id, reference, status_before_rollback, activation_updated_at,
    activation_updated_by, dependency_fingerprint, target_status
  FROM JSONB_TO_RECORDSET(v_run.rollback_manifest) AS item(
    ordinal INTEGER, id UUID, reference TEXT, status_before_rollback TEXT,
    activation_updated_at TIMESTAMPTZ, activation_updated_by TEXT,
    dependency_fingerprint TEXT, target_status TEXT
  );
  SELECT COUNT(*) INTO v_expected_count FROM w128_rollback_manifest;
  IF v_expected_count <> v_run.activated_count THEN RAISE EXCEPTION 'w128_rollback_manifest_invalid'; END IF;

  PERFORM 1
  FROM public.opportunities opportunity
  JOIN w128_rollback_manifest manifest ON manifest.id = opportunity.id
  FOR UPDATE OF opportunity;
  GET DIAGNOSTICS v_locked_count = ROW_COUNT;
  IF v_locked_count <> v_expected_count THEN RAISE EXCEPTION 'w128_rollback_identity_mismatch'; END IF;

  -- The parent opportunity locks block new FK dependants; lock every existing
  -- lifecycle row before recomputing the audit digest so updates cannot race.
  PERFORM 1 FROM public.opportunity_matches row_value JOIN w128_rollback_manifest manifest ON manifest.id = row_value.opportunity_id FOR UPDATE OF row_value;
  PERFORM 1 FROM public.opportunity_documents row_value JOIN w128_rollback_manifest manifest ON manifest.id = row_value.opportunity_id FOR UPDATE OF row_value;
  PERFORM 1 FROM public.opportunity_nda_artifacts row_value JOIN w128_rollback_manifest manifest ON manifest.id = row_value.opportunity_id FOR UPDATE OF row_value;
  PERFORM 1 FROM public.opportunity_pursuit_confidential_grants row_value JOIN w128_rollback_manifest manifest ON manifest.id = row_value.opportunity_id FOR UPDATE OF row_value;
  PERFORM 1 FROM public.opportunity_pursuit_events row_value JOIN w128_rollback_manifest manifest ON manifest.id = row_value.opportunity_id FOR UPDATE OF row_value;
  PERFORM 1 FROM public.opportunity_pursuit_evidence row_value JOIN w128_rollback_manifest manifest ON manifest.id = row_value.opportunity_id FOR UPDATE OF row_value;
  PERFORM 1 FROM public.opportunity_memo_notifications row_value JOIN w128_rollback_manifest manifest ON manifest.id = row_value.opportunity_id FOR UPDATE OF row_value;
  PERFORM 1 FROM public.opportunity_closure_history row_value JOIN w128_rollback_manifest manifest ON manifest.id = row_value.opportunity_id FOR UPDATE OF row_value;
  PERFORM 1 FROM public.opportunity_ma_contacts row_value JOIN w128_rollback_manifest manifest ON manifest.id = row_value.opportunity_id FOR UPDATE OF row_value;
  PERFORM 1 FROM public.opportunity_source_contacts row_value JOIN w128_rollback_manifest manifest ON manifest.id = row_value.opportunity_id FOR UPDATE OF row_value;

  IF EXISTS (
    SELECT 1
    FROM public.opportunities opportunity
    JOIN w128_rollback_manifest manifest ON manifest.id = opportunity.id
    WHERE opportunity.reference IS DISTINCT FROM manifest.reference
      OR opportunity.status::TEXT IS DISTINCT FROM manifest.status_before_rollback
      OR opportunity.updated_at IS DISTINCT FROM manifest.activation_updated_at
      OR opportunity.updated_by IS DISTINCT FROM manifest.activation_updated_by
      OR public.w128_opportunity_dependency_fingerprint(opportunity.id) IS DISTINCT FROM manifest.dependency_fingerprint
      OR manifest.target_status <> 'draft'
  ) THEN RAISE EXCEPTION 'w128_rollback_manifest_drift'; END IF;

  WITH rolled_back AS (
    UPDATE public.opportunities opportunity
    SET status = 'draft', updated_by = v_actor
    FROM w128_rollback_manifest manifest
    WHERE opportunity.id = manifest.id
    RETURNING opportunity.id, opportunity.status, opportunity.updated_at, opportunity.updated_by
  )
  SELECT
    COUNT(*)::INTEGER,
    JSONB_AGG(JSONB_BUILD_OBJECT(
      'ordinal', manifest.ordinal, 'id', manifest.id, 'reference', manifest.reference,
      'status_after_rollback', rolled_back.status,
      'rollback_updated_at', rolled_back.updated_at,
      'rollback_updated_by', rolled_back.updated_by
    ) ORDER BY manifest.ordinal)
  INTO v_locked_count, v_result_manifest
  FROM w128_rollback_manifest manifest
  JOIN rolled_back ON rolled_back.id = manifest.id;
  IF v_locked_count <> v_expected_count THEN RAISE EXCEPTION 'w128_rollback_count_mismatch'; END IF;

  INSERT INTO public.w128_draft_activation_rollbacks(run_id, actor, rollback_manifest, rolled_back_count)
  VALUES (p_run_id, v_actor, v_result_manifest, v_expected_count)
  RETURNING id INTO v_rollback_id;
  RETURN QUERY SELECT v_rollback_id, v_expected_count;
END;
$$;

REVOKE ALL ON TABLE public.w128_draft_activation_runs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.w128_draft_activation_runs TO service_role;
REVOKE ALL ON TABLE public.w128_draft_activation_rollbacks FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.w128_draft_activation_rollbacks TO service_role;
REVOKE ALL ON FUNCTION public.w128_draft_activation_preflight(), public.w128_opportunity_dependency_fingerprint(UUID), public.apply_w128_draft_activation(JSONB, TEXT, TEXT), public.rollback_w128_draft_activation(UUID, TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.w128_draft_activation_preflight(), public.apply_w128_draft_activation(JSONB, TEXT, TEXT), public.rollback_w128_draft_activation(UUID, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.prevent_w128_draft_activation_run_mutation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_w128_draft_activation_run_mutation() TO service_role;
