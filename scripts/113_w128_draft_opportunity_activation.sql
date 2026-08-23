-- W-128: a deliberately one-time, approval-gated Draft -> Active operation.
--
-- This migration installs read-only preflight and guarded apply primitives only.
-- It neither selects a production candidate set nor mutates any opportunity.
-- The release operator must supply the reviewed, ordered manifest returned by
-- w128_draft_activation_preflight() and a matching digest at Gate 2.

CREATE TABLE IF NOT EXISTS public.w128_draft_activation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  'Immutable audit evidence for the separately approved W-128 one-time Draft-to-Active operation. The migration itself performs no activation.';

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
        contact_fingerprint, match_count
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

  CREATE TEMP TABLE w128_manifest (
    ordinal INTEGER NOT NULL,
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

  -- Lock every record that feeds the active-contract decision before its
  -- current fingerprint is recomputed. This makes a concurrent correction a
  -- clean failure rather than a partial activation.
  PERFORM 1 FROM public.opportunities opportunity JOIN w128_manifest manifest ON manifest.id = opportunity.id FOR UPDATE OF opportunity;
  GET DIAGNOSTICS v_locked_count = ROW_COUNT;
  IF v_locked_count <> v_expected_count THEN RAISE EXCEPTION 'w128_activation_identity_mismatch'; END IF;
  PERFORM 1 FROM public.ma_offices office JOIN public.opportunities opportunity ON opportunity.source_office_id = office.id JOIN w128_manifest manifest ON manifest.id = opportunity.id FOR UPDATE OF office;
  PERFORM 1 FROM public.ma_firms firm JOIN public.ma_offices office ON office.firm_id = firm.id JOIN public.opportunities opportunity ON opportunity.source_office_id = office.id JOIN w128_manifest manifest ON manifest.id = opportunity.id FOR UPDATE OF firm;
  PERFORM 1 FROM public.opportunity_ma_contacts link JOIN w128_manifest manifest ON manifest.id = link.opportunity_id WHERE link.is_active FOR UPDATE OF link;
  PERFORM 1 FROM public.ma_contact_office_affiliations affiliation JOIN public.opportunity_ma_contacts link ON link.affiliation_id = affiliation.id JOIN w128_manifest manifest ON manifest.id = link.opportunity_id WHERE link.is_active FOR UPDATE OF affiliation;
  PERFORM 1 FROM public.ma_contacts contact JOIN public.ma_contact_office_affiliations affiliation ON affiliation.contact_id = contact.id JOIN public.opportunity_ma_contacts link ON link.affiliation_id = affiliation.id JOIN w128_manifest manifest ON manifest.id = link.opportunity_id WHERE link.is_active FOR UPDATE OF contact;

  IF EXISTS (
    SELECT 1 FROM w128_manifest manifest
    LEFT JOIN public.w128_draft_activation_preflight() current ON current.id = manifest.id
    WHERE current.id IS NULL OR NOT current.eligible
      OR current.reference IS DISTINCT FROM manifest.reference
      OR current.updated_at IS DISTINCT FROM manifest.updated_at
      OR current.fingerprint IS DISTINCT FROM manifest.fingerprint
  ) THEN RAISE EXCEPTION 'w128_activation_manifest_drift'; END IF;

  SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
    'ordinal', manifest.ordinal, 'id', manifest.id, 'reference', manifest.reference,
    'prior_status', 'draft', 'expected_status_after_rollback', 'active',
    'repreneur_exposure', current.repreneur_exposure, 'source_visibility', current.source_visibility
  ) ORDER BY manifest.ordinal) INTO v_rollback
  FROM w128_manifest manifest JOIN public.w128_draft_activation_preflight() current ON current.id = manifest.id;

  UPDATE public.opportunities opportunity
  SET status = 'active', updated_by = v_actor
  FROM w128_manifest manifest
  WHERE opportunity.id = manifest.id
    AND opportunity.status = 'draft'
    AND NOT opportunity.is_demo;
  GET DIAGNOSTICS v_locked_count = ROW_COUNT;
  IF v_locked_count <> v_expected_count THEN RAISE EXCEPTION 'w128_activation_status_drift'; END IF;

  INSERT INTO public.w128_draft_activation_runs(actor, manifest_digest, manifest, rollback_manifest, activated_count)
  VALUES (v_actor, p_manifest_digest, p_manifest, v_rollback, v_expected_count)
  RETURNING id INTO v_run_id;
  RETURN QUERY SELECT v_run_id, v_expected_count, v_rollback;
END;
$$;

REVOKE ALL ON TABLE public.w128_draft_activation_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.w128_draft_activation_runs TO service_role;
REVOKE ALL ON FUNCTION public.w128_draft_activation_preflight(), public.apply_w128_draft_activation(JSONB, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.w128_draft_activation_preflight(), public.apply_w128_draft_activation(JSONB, TEXT, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.prevent_w128_draft_activation_run_mutation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_w128_draft_activation_run_mutation() TO service_role;
