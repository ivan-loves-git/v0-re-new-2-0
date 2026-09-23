-- Ticket #196 / Decision #183. Staff assistance is a separate, attributed
-- authority path. Owner-only RPCs and their W173 notification trigger stay
-- unchanged. No existing rows are rewritten.

CREATE TABLE public.staff_assisted_match_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.opportunity_matches(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  repreneur_id uuid NOT NULL REFERENCES public.repreneurs(id) ON DELETE CASCADE,
  staff_user_id text NOT NULL CHECK (NULLIF(BTRIM(staff_user_id), '') IS NOT NULL),
  staff_email text NOT NULL CHECK (NULLIF(BTRIM(staff_email), '') IS NOT NULL),
  origin text NOT NULL DEFAULT 'staff' CHECK (origin = 'staff'),
  response text NOT NULL CHECK (response IN ('interested', 'declined')),
  prior_status text,
  response_generation_at timestamptz,
  match_updated_at timestamptz NOT NULL,
  decline_reason_categories text[] NOT NULL DEFAULT '{}',
  decline_reason_text text,
  operation_key uuid NOT NULL,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{32}$'),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (staff_user_id, operation_key)
);
CREATE INDEX staff_assisted_match_responses_match_time
  ON public.staff_assisted_match_responses(match_id, recorded_at DESC);
ALTER TABLE public.staff_assisted_match_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_assisted_match_responses FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.staff_assisted_match_responses FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.staff_assisted_match_responses TO service_role;

CREATE FUNCTION public.w196_guard_staff_match_response_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'staff_assisted_response_immutable' USING ERRCODE = 'P0001';
END $$;
CREATE TRIGGER w196_staff_match_response_immutable
  BEFORE UPDATE OR DELETE ON public.staff_assisted_match_responses
  FOR EACH ROW EXECUTE FUNCTION public.w196_guard_staff_match_response_history();
CREATE TRIGGER w196_staff_match_response_no_truncate
  BEFORE TRUNCATE ON public.staff_assisted_match_responses
  FOR EACH STATEMENT EXECUTE FUNCTION public.w196_guard_staff_match_response_history();

CREATE FUNCTION public.w196_staff_role_matches(p_user_id text, p_email text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT NULLIF(BTRIM(p_user_id), '') IS NOT NULL
    AND NULLIF(BTRIM(p_email), '') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.app_user_roles role_row
      WHERE role_row.role = 'staff'
        AND LOWER(BTRIM(role_row.email)) = LOWER(BTRIM(p_email))
        AND (role_row.user_id = p_user_id OR (
          role_row.user_id IS NULL AND EXISTS (
            SELECT 1 FROM public."user" auth_user
            WHERE auth_user.id = p_user_id
              AND LOWER(BTRIM(auth_user.email)) = LOWER(BTRIM(p_email))
          )))
    )
$$;
REVOKE ALL ON FUNCTION public.w196_staff_role_matches(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.w196_staff_role_matches(text, text) TO service_role;

CREATE FUNCTION public.w196_record_staff_opportunity_response(
  p_repreneur_id uuid, p_opportunity_id uuid, p_match_id uuid,
  p_expected_opportunity_updated_at timestamptz,
  p_expected_match_updated_at timestamptz,
  p_expected_interest_at timestamptz,
  p_response text, p_decline_reason_categories text[], p_decline_reason_text text,
  p_staff_user_id text, p_staff_email text, p_operation_key uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_repreneur public.repreneurs%ROWTYPE;
  v_opportunity public.opportunities%ROWTYPE;
  v_match public.opportunity_matches%ROWTYPE;
  v_existing public.staff_assisted_match_responses%ROWTYPE;
  v_prior_status text;
  v_fingerprint text;
  v_categories text[] := COALESCE(p_decline_reason_categories, '{}');
  v_reason text := NULLIF(BTRIM(p_decline_reason_text), '');
  v_result jsonb;
BEGIN
  IF p_operation_key IS NULL OR p_repreneur_id IS NULL OR p_opportunity_id IS NULL
    OR p_expected_opportunity_updated_at IS NULL OR p_response IS NULL
    OR p_response NOT IN ('interested', 'declined')
    OR NOT public.w196_staff_role_matches(p_staff_user_id, p_staff_email)
  THEN RAISE EXCEPTION 'staff_assistance_denied' USING ERRCODE = 'P0001'; END IF;
  IF p_response = 'declined' AND (
    CARDINALITY(v_categories) = 0 OR v_reason IS NULL
    OR LENGTH(v_reason) > 2000 OR
    EXISTS (SELECT 1 FROM UNNEST(v_categories) reason
      WHERE reason IS NULL OR reason NOT IN ('geography', 'sector', 'size_metrics', 'business_model', 'other'))
  ) THEN RAISE EXCEPTION 'staff_assistance_decline_reason_required' USING ERRCODE = 'P0001'; END IF;
  IF p_response = 'interested' AND (CARDINALITY(v_categories) <> 0 OR v_reason IS NOT NULL)
  THEN RAISE EXCEPTION 'staff_assistance_invalid_response' USING ERRCODE = 'P0001'; END IF;

  v_fingerprint := MD5(JSONB_BUILD_OBJECT(
    'repreneur', p_repreneur_id, 'opportunity', p_opportunity_id,
    'match', p_match_id, 'opportunity_updated', p_expected_opportunity_updated_at,
    'match_updated', p_expected_match_updated_at, 'interest_at', p_expected_interest_at,
    'response', p_response, 'categories', v_categories, 'reason', v_reason
  )::text);
  PERFORM pg_advisory_xact_lock(hashtextextended(p_staff_user_id || ':' || p_operation_key::text, 0));
  SELECT * INTO v_existing FROM public.staff_assisted_match_responses
    WHERE staff_user_id = p_staff_user_id AND operation_key = p_operation_key;
  IF FOUND THEN
    IF v_existing.request_fingerprint IS DISTINCT FROM v_fingerprint
    THEN RAISE EXCEPTION 'staff_assistance_retry_conflict' USING ERRCODE = 'P0001'; END IF;
    RETURN JSONB_BUILD_OBJECT('eventId', v_existing.id, 'matchId', v_existing.match_id,
      'opportunityId', v_existing.opportunity_id, 'response', v_existing.response,
      'responseGenerationAt', v_existing.response_generation_at,
      'matchUpdatedAt', v_existing.match_updated_at, 'reusedExisting', true);
  END IF;

  -- Match W164's parent lock order so a concurrent owner response, assignment
  -- or locked-deal signal cannot create a second pair or bypass eligibility.
  SELECT * INTO v_repreneur FROM public.repreneurs WHERE id = p_repreneur_id FOR UPDATE;
  SELECT * INTO v_opportunity FROM public.opportunities WHERE id = p_opportunity_id FOR UPDATE;
  IF v_repreneur.id IS NULL OR v_opportunity.id IS NULL
    OR v_opportunity.status <> 'active'
    OR v_opportunity.is_demo IS DISTINCT FROM v_repreneur.is_demo
    OR v_opportunity.updated_at IS DISTINCT FROM p_expected_opportunity_updated_at
  THEN RAISE EXCEPTION 'staff_assistance_stale_target' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO v_match FROM public.opportunity_matches
    WHERE opportunity_id = p_opportunity_id AND repreneur_id = p_repreneur_id FOR UPDATE;
  IF p_match_id IS DISTINCT FROM v_match.id
    OR (v_match.id IS NOT NULL AND (
      NOT public.w164_match_has_same_namespace(v_match.id)
      OR v_match.updated_at IS DISTINCT FROM p_expected_match_updated_at
      OR v_match.interest_expressed_at IS DISTINCT FROM p_expected_interest_at))
  THEN RAISE EXCEPTION 'staff_assistance_stale_response' USING ERRCODE = 'P0001'; END IF;
  IF v_match.id IS NULL AND (p_response <> 'interested' OR p_match_id IS NOT NULL
    OR p_expected_match_updated_at IS NOT NULL OR p_expected_interest_at IS NOT NULL)
  THEN RAISE EXCEPTION 'staff_assistance_stale_response' USING ERRCODE = 'P0001'; END IF;
  IF v_match.id IS NOT NULL AND (
    v_match.status NOT IN ('proposed', 'interested', 'declined', 'dropped')
    OR v_match.status = p_response::public.opportunity_match_status
    OR EXISTS (SELECT 1 FROM public.opportunity_interest_events event_row
      WHERE event_row.match_id = v_match.id AND event_row.event_type = 'rejected'
        AND event_row.interest_expressed_at IS NOT DISTINCT FROM v_match.interest_expressed_at)
  ) THEN RAISE EXCEPTION 'staff_assistance_response_locked' USING ERRCODE = 'P0001'; END IF;
  IF p_response = 'declined' AND v_match.status NOT IN ('proposed', 'interested')
  THEN RAISE EXCEPTION 'staff_assistance_response_locked' USING ERRCODE = 'P0001'; END IF;
  IF p_response = 'interested' AND v_match.status IS DISTINCT FROM 'interested'
    AND v_match.recommendation_expires_at IS NOT NULL
    AND v_match.recommendation_expires_at <= clock_timestamp()
  THEN RAISE EXCEPTION 'staff_assistance_response_window_expired' USING ERRCODE = 'P0001'; END IF;
  v_prior_status := v_match.status::text;

  IF p_response = 'interested' THEN
    PERFORM 1 FROM public.express_opportunity_interest(
      p_opportunity_id, p_repreneur_id, p_staff_user_id, clock_timestamp());
  ELSE
    UPDATE public.opportunity_matches SET status = 'declined',
      decline_reason_categories = v_categories, decline_reason_text = v_reason,
      reviewed_by = NULL, reviewed_at = NULL
    WHERE id = v_match.id;
  END IF;
  SELECT * INTO v_match FROM public.opportunity_matches
    WHERE opportunity_id = p_opportunity_id AND repreneur_id = p_repreneur_id;
  IF v_match.id IS NULL OR v_match.status::text <> p_response
  THEN RAISE EXCEPTION 'staff_assistance_write_failed' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.staff_assisted_match_responses (
    match_id, opportunity_id, repreneur_id, staff_user_id, staff_email,
    response, prior_status, response_generation_at, match_updated_at,
    decline_reason_categories, decline_reason_text, operation_key, request_fingerprint
  ) VALUES (
    v_match.id, p_opportunity_id, p_repreneur_id, p_staff_user_id, LOWER(BTRIM(p_staff_email)),
    p_response, v_prior_status, v_match.interest_expressed_at, v_match.updated_at,
    v_categories, v_reason, p_operation_key, v_fingerprint
  ) RETURNING id INTO v_existing.id;
  v_result := JSONB_BUILD_OBJECT('eventId', v_existing.id, 'matchId', v_match.id,
    'opportunityId', p_opportunity_id, 'response', p_response,
    'responseGenerationAt', v_match.interest_expressed_at,
    'matchUpdatedAt', v_match.updated_at, 'reusedExisting', false);
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.w196_record_staff_opportunity_response(
  uuid, uuid, uuid, timestamptz, timestamptz, timestamptz,
  text, text[], text, text, text, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.w196_record_staff_opportunity_response(
  uuid, uuid, uuid, timestamptz, timestamptz, timestamptz,
  text, text[], text, text, text, uuid
) TO service_role;

-- The profile is the retention parent. This records who changed which thesis
-- fields without copying private thesis values into a second history store.
CREATE TABLE public.staff_assisted_profile_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repreneur_id uuid NOT NULL REFERENCES public.repreneurs(id) ON DELETE CASCADE,
  staff_user_id text NOT NULL CHECK (NULLIF(BTRIM(staff_user_id), '') IS NOT NULL),
  staff_email text NOT NULL CHECK (NULLIF(BTRIM(staff_email), '') IS NOT NULL),
  changed_fields text[] NOT NULL DEFAULT '{}',
  previous_updated_at timestamptz NOT NULL,
  resulting_updated_at timestamptz NOT NULL,
  operation_key uuid NOT NULL,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{32}$'),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (staff_user_id, operation_key)
);
CREATE INDEX staff_assisted_profile_changes_owner_time
  ON public.staff_assisted_profile_changes(repreneur_id, recorded_at DESC);
ALTER TABLE public.staff_assisted_profile_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_assisted_profile_changes FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.staff_assisted_profile_changes FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.staff_assisted_profile_changes TO service_role;
CREATE FUNCTION public.w196_guard_staff_profile_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'staff_assisted_profile_history_immutable' USING ERRCODE = 'P0001';
END $$;
CREATE TRIGGER w196_staff_profile_history_immutable
  BEFORE UPDATE OR DELETE ON public.staff_assisted_profile_changes
  FOR EACH ROW EXECUTE FUNCTION public.w196_guard_staff_profile_history();
CREATE TRIGGER w196_staff_profile_history_no_truncate
  BEFORE TRUNCATE ON public.staff_assisted_profile_changes
  FOR EACH STATEMENT EXECUTE FUNCTION public.w196_guard_staff_profile_history();

CREATE FUNCTION public.w196_update_staff_target_thesis(
  p_repreneur_id uuid, p_expected_updated_at timestamptz, p_values jsonb,
  p_staff_user_id text, p_staff_email text, p_operation_key uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_owner public.repreneurs%ROWTYPE;
  v_existing public.staff_assisted_profile_changes%ROWTYPE;
  v_fields text[] := ARRAY[
    'q12_geo_zones', 'q13_target_sectors_v2', 'q14_deal_size', 'q16_equity',
    'target_revenue_min_meur', 'target_revenue_max_meur',
    'target_ebitda_min_keur', 'target_ebitda_max_keur',
    'target_ebitda_margin_min_pct', 'target_staff_size_min', 'target_staff_size_max'
  ];
  v_changed text[];
  v_fingerprint text;
  v_new_updated_at timestamptz;
  v_numeric_field text;
  v_numeric_limit numeric;
  v_option text;
BEGIN
  IF p_operation_key IS NULL OR p_repreneur_id IS NULL OR p_expected_updated_at IS NULL
    OR NOT public.w196_staff_role_matches(p_staff_user_id, p_staff_email)
  THEN RAISE EXCEPTION 'staff_assistance_denied' USING ERRCODE = 'P0001'; END IF;
  IF JSONB_TYPEOF(p_values) IS DISTINCT FROM 'object'
    OR NOT p_values ?& v_fields
    OR (p_values - v_fields) <> '{}'::jsonb
    OR JSONB_TYPEOF(p_values->'q12_geo_zones') <> 'array'
    OR JSONB_TYPEOF(p_values->'q13_target_sectors_v2') <> 'array'
    OR JSONB_TYPEOF(p_values->'q14_deal_size') <> 'array'
    OR JSONB_TYPEOF(p_values->'q16_equity') <> 'string'
    OR JSONB_ARRAY_LENGTH(p_values->'q12_geo_zones') = 0
    OR JSONB_ARRAY_LENGTH(p_values->'q13_target_sectors_v2') = 0
    OR JSONB_ARRAY_LENGTH(p_values->'q14_deal_size') = 0
    OR EXISTS (SELECT 1 FROM JSONB_ARRAY_ELEMENTS(p_values->'q12_geo_zones') x WHERE JSONB_TYPEOF(x) <> 'string')
    OR EXISTS (SELECT 1 FROM JSONB_ARRAY_ELEMENTS(p_values->'q13_target_sectors_v2') x WHERE JSONB_TYPEOF(x) <> 'string')
    OR EXISTS (SELECT 1 FROM JSONB_ARRAY_ELEMENTS(p_values->'q14_deal_size') x WHERE JSONB_TYPEOF(x) <> 'string')
  THEN RAISE EXCEPTION 'staff_assistance_invalid_thesis' USING ERRCODE = 'P0001'; END IF;
  FOREACH v_numeric_field IN ARRAY ARRAY[
    'target_revenue_min_meur','target_revenue_max_meur',
    'target_ebitda_min_keur','target_ebitda_max_keur',
    'target_ebitda_margin_min_pct','target_staff_size_min','target_staff_size_max'
  ] LOOP
    IF p_values->v_numeric_field <> 'null'::jsonb THEN
      IF JSONB_TYPEOF(p_values->v_numeric_field) <> 'number'
      THEN RAISE EXCEPTION 'staff_assistance_invalid_thesis'; END IF;
      v_numeric_limit := CASE WHEN v_numeric_field = 'target_ebitda_margin_min_pct' THEN 100 ELSE 100000 END;
      IF (p_values->>v_numeric_field)::numeric < 0
        OR (p_values->>v_numeric_field)::numeric > v_numeric_limit
        OR (v_numeric_field IN ('target_staff_size_min','target_staff_size_max')
          AND (p_values->>v_numeric_field)::numeric <> TRUNC((p_values->>v_numeric_field)::numeric))
      THEN RAISE EXCEPTION 'staff_assistance_invalid_thesis'; END IF;
    END IF;
  END LOOP;
  IF (p_values->>'target_revenue_min_meur')::numeric > (p_values->>'target_revenue_max_meur')::numeric
    OR (p_values->>'target_ebitda_min_keur')::numeric > (p_values->>'target_ebitda_max_keur')::numeric
    OR (p_values->>'target_staff_size_min')::numeric > (p_values->>'target_staff_size_max')::numeric
  THEN RAISE EXCEPTION 'staff_assistance_invalid_thesis'; END IF;
  v_fingerprint := MD5(JSONB_BUILD_OBJECT(
    'owner', p_repreneur_id, 'expected_updated', p_expected_updated_at, 'values', p_values
  )::text);
  PERFORM pg_advisory_xact_lock(hashtextextended(p_staff_user_id || ':' || p_operation_key::text, 0));
  SELECT * INTO v_existing FROM public.staff_assisted_profile_changes
    WHERE staff_user_id = p_staff_user_id AND operation_key = p_operation_key;
  IF FOUND THEN
    IF v_existing.request_fingerprint IS DISTINCT FROM v_fingerprint
    THEN RAISE EXCEPTION 'staff_assistance_retry_conflict' USING ERRCODE = 'P0001'; END IF;
    RETURN JSONB_BUILD_OBJECT('eventId', v_existing.id,
      'updatedAt', v_existing.resulting_updated_at,
      'changedFields', v_existing.changed_fields, 'reusedExisting', true);
  END IF;
  SELECT * INTO v_owner FROM public.repreneurs WHERE id = p_repreneur_id FOR UPDATE;
  IF v_owner.id IS NULL OR v_owner.updated_at IS DISTINCT FROM p_expected_updated_at
  THEN RAISE EXCEPTION 'staff_assistance_stale_profile' USING ERRCODE = 'P0001'; END IF;
  IF p_values->>'q16_equity' NOT IN ('tbd','151-250','251-350','351-450','>450')
  THEN RAISE EXCEPTION 'staff_assistance_invalid_thesis'; END IF;
  FOR v_option IN SELECT JSONB_ARRAY_ELEMENTS_TEXT(p_values->'q12_geo_zones') LOOP
    IF v_option NOT IN (
      'all-france','auvergne-rhone-alpes','bourgogne-franche-comte','bretagne',
      'centre-val-de-loire','corse','dom-tom','grand-est','hauts-de-france',
      'ile-de-france','normandie','nouvelle-aquitaine','occitanie',
      'pays-de-la-loire','paca'
    ) AND NOT (COALESCE(v_owner.q12_geo_zones, '[]'::jsonb) @> JSONB_BUILD_ARRAY(v_option)
      OR COALESCE(v_owner.target_location, '[]'::jsonb) @> JSONB_BUILD_ARRAY(v_option))
    THEN RAISE EXCEPTION 'staff_assistance_invalid_thesis'; END IF;
  END LOOP;
  FOR v_option IN SELECT JSONB_ARRAY_ELEMENTS_TEXT(p_values->'q13_target_sectors_v2') LOOP
    IF v_option NOT IN (
      'Agroalimentaire','Industrie manufacturière','Industrie lourde',
      'Industrie pharmaceutique & Dispositifs médicaux','Services de santé',
      'Automobile & Mobilité','Textile, Luxe & Mode','Commerce, Négoce & Distribution',
      'BTP & Construction','Services aux entreprises (B2B)',
      'Services aux particuliers (B2C)','Tech & Digital','Environnement & Énergie',
      'Hôtellerie, Restauration & Loisirs','Transport & Logistique','Autre'
    ) AND NOT (COALESCE(v_owner.q13_target_sectors_v2, '[]'::jsonb) @> JSONB_BUILD_ARRAY(v_option)
      OR v_option = ANY(COALESCE(v_owner.sector_preferences, '{}'::text[])))
    THEN RAISE EXCEPTION 'staff_assistance_invalid_thesis'; END IF;
  END LOOP;
  FOR v_option IN SELECT JSONB_ARRAY_ELEMENTS_TEXT(p_values->'q14_deal_size') LOOP
    IF v_option NOT IN ('1-3M','3-5M','>5M')
      AND NOT (COALESCE(v_owner.q14_deal_size, '[]'::jsonb) @> JSONB_BUILD_ARRAY(v_option)
        OR v_owner.target_acquisition_size = v_option)
    THEN RAISE EXCEPTION 'staff_assistance_invalid_thesis'; END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM UNNEST(ARRAY['q12_geo_zones','q13_target_sectors_v2','q14_deal_size']) field_name
    WHERE JSONB_ARRAY_LENGTH(p_values->field_name) <> (
      SELECT COUNT(DISTINCT option_value) FROM JSONB_ARRAY_ELEMENTS_TEXT(p_values->field_name) option_value
    )
  ) THEN RAISE EXCEPTION 'staff_assistance_invalid_thesis'; END IF;
  v_changed := ARRAY_REMOVE(ARRAY[
    CASE WHEN v_owner.q12_geo_zones IS DISTINCT FROM p_values->'q12_geo_zones' THEN 'q12_geo_zones' END,
    CASE WHEN v_owner.q13_target_sectors_v2 IS DISTINCT FROM p_values->'q13_target_sectors_v2' THEN 'q13_target_sectors_v2' END,
    CASE WHEN v_owner.q14_deal_size IS DISTINCT FROM p_values->'q14_deal_size' THEN 'q14_deal_size' END,
    CASE WHEN v_owner.q16_equity IS DISTINCT FROM p_values->>'q16_equity' THEN 'q16_equity' END,
    CASE WHEN v_owner.target_revenue_min_meur IS DISTINCT FROM (p_values->>'target_revenue_min_meur')::numeric THEN 'target_revenue_min_meur' END,
    CASE WHEN v_owner.target_revenue_max_meur IS DISTINCT FROM (p_values->>'target_revenue_max_meur')::numeric THEN 'target_revenue_max_meur' END,
    CASE WHEN v_owner.target_ebitda_min_keur IS DISTINCT FROM (p_values->>'target_ebitda_min_keur')::numeric THEN 'target_ebitda_min_keur' END,
    CASE WHEN v_owner.target_ebitda_max_keur IS DISTINCT FROM (p_values->>'target_ebitda_max_keur')::numeric THEN 'target_ebitda_max_keur' END,
    CASE WHEN v_owner.target_ebitda_margin_min_pct IS DISTINCT FROM (p_values->>'target_ebitda_margin_min_pct')::numeric THEN 'target_ebitda_margin_min_pct' END,
    CASE WHEN v_owner.target_staff_size_min IS DISTINCT FROM (p_values->>'target_staff_size_min')::integer THEN 'target_staff_size_min' END,
    CASE WHEN v_owner.target_staff_size_max IS DISTINCT FROM (p_values->>'target_staff_size_max')::integer THEN 'target_staff_size_max' END
  ], NULL);
  IF CARDINALITY(v_changed) > 0 THEN
    UPDATE public.repreneurs SET
      q12_geo_zones = p_values->'q12_geo_zones',
      q13_target_sectors_v2 = p_values->'q13_target_sectors_v2',
      q14_deal_size = p_values->'q14_deal_size',
      q16_equity = p_values->>'q16_equity',
      sector_preferences = ARRAY(SELECT JSONB_ARRAY_ELEMENTS_TEXT(p_values->'q13_target_sectors_v2')),
      target_location = p_values->'q12_geo_zones',
      target_revenue_min_meur = (p_values->>'target_revenue_min_meur')::numeric,
      target_revenue_max_meur = (p_values->>'target_revenue_max_meur')::numeric,
      target_ebitda_min_keur = (p_values->>'target_ebitda_min_keur')::numeric,
      target_ebitda_max_keur = (p_values->>'target_ebitda_max_keur')::numeric,
      target_ebitda_margin_min_pct = (p_values->>'target_ebitda_margin_min_pct')::numeric,
      target_staff_size_min = (p_values->>'target_staff_size_min')::integer,
      target_staff_size_max = (p_values->>'target_staff_size_max')::integer
    WHERE id = p_repreneur_id RETURNING updated_at INTO v_new_updated_at;
  ELSE
    v_new_updated_at := v_owner.updated_at;
  END IF;
  INSERT INTO public.staff_assisted_profile_changes (
    repreneur_id, staff_user_id, staff_email, changed_fields,
    previous_updated_at, resulting_updated_at, operation_key, request_fingerprint
  ) VALUES (
    p_repreneur_id, p_staff_user_id, LOWER(BTRIM(p_staff_email)), v_changed,
    v_owner.updated_at, v_new_updated_at, p_operation_key, v_fingerprint
  ) RETURNING id INTO v_existing.id;
  RETURN JSONB_BUILD_OBJECT('eventId', v_existing.id, 'updatedAt', v_new_updated_at,
    'changedFields', v_changed, 'reusedExisting', false);
END $$;
REVOKE ALL ON FUNCTION public.w196_update_staff_target_thesis(
  uuid, timestamptz, jsonb, text, text, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.w196_update_staff_target_thesis(
  uuid, timestamptz, jsonb, text, text, uuid
) TO service_role;

-- Receipt of an already-signed copy is evidence, not a portal signature or
-- validation. The upload intent binds the actual staff actor and exact owner.
ALTER TABLE public.private_upload_intents DROP CONSTRAINT private_upload_intents_upload_kind_check;
ALTER TABLE public.private_upload_intents ADD CONSTRAINT private_upload_intents_upload_kind_check
  CHECK (upload_kind IN (
    'opportunity_document', 'staff_nda_artifact', 'portal_signed_nda',
    'repreneur_document', 'external_pursuit_attachment', 'staff_received_signed_nda'
  ));

CREATE TABLE public.staff_received_nda_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id uuid NOT NULL UNIQUE REFERENCES public.private_upload_intents(id) ON DELETE RESTRICT,
  artifact_id uuid NOT NULL REFERENCES public.opportunity_nda_artifacts(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.opportunity_documents(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.opportunity_matches(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  repreneur_id uuid NOT NULL REFERENCES public.repreneurs(id) ON DELETE CASCADE,
  staff_user_id text NOT NULL,
  staff_email text NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('email', 'in_person', 'other')),
  source_reference text NOT NULL CHECK (LENGTH(BTRIM(source_reference)) BETWEEN 1 AND 500),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX staff_received_nda_receipts_match_time ON public.staff_received_nda_receipts(match_id, recorded_at DESC);
ALTER TABLE public.staff_received_nda_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_received_nda_receipts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.staff_received_nda_receipts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.staff_received_nda_receipts TO service_role;
CREATE FUNCTION public.w196_guard_staff_nda_receipts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'staff_received_nda_receipt_immutable' USING ERRCODE = 'P0001';
END $$;
CREATE TRIGGER w196_staff_nda_receipts_immutable
  BEFORE UPDATE OR DELETE ON public.staff_received_nda_receipts
  FOR EACH ROW EXECUTE FUNCTION public.w196_guard_staff_nda_receipts();
CREATE TRIGGER w196_staff_nda_receipts_no_truncate
  BEFORE TRUNCATE ON public.staff_received_nda_receipts
  FOR EACH STATEMENT EXECUTE FUNCTION public.w196_guard_staff_nda_receipts();

CREATE OR REPLACE FUNCTION public.wave_journey_guard_repreneur_artifact_origin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.artifact_role = 'repreneur_signed_copy'
    AND current_setting('wave.journey_portal_repreneur_upload', true) IS DISTINCT FROM 'on'
    AND current_setting('wave.journey_staff_received_nda', true) IS DISTINCT FROM 'on'
  THEN RAISE EXCEPTION 'A signed repreneur copy needs portal submission or a guarded staff receipt.'; END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION public.w196_finalize_staff_received_nda(
  p_intent_id uuid, p_actor_key text, p_finalize_secret_hash text, p_content_sha256 text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v public.private_upload_intents%ROWTYPE;
  v_match public.opportunity_matches%ROWTYPE;
  v_gate uuid;
  v_artifact uuid;
  v_document uuid;
  v_prior uuid;
  v_version integer;
  v_reused boolean := false;
  v_result jsonb;
  v_source_kind text;
  v_source_reference text;
BEGIN
  IF p_content_sha256 !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'w196_digest_invalid'; END IF;
  SELECT * INTO v FROM public.private_upload_intents WHERE id = p_intent_id FOR UPDATE;
  IF v.id IS NULL OR v.upload_kind <> 'staff_received_signed_nda'
    OR v.actor_kind <> 'staff' OR v.actor_user_id IS NULL OR v.actor_email IS NULL
    OR v.actor_key IS DISTINCT FROM p_actor_key
    OR v.finalize_secret_hash IS DISTINCT FROM p_finalize_secret_hash
    OR NOT public.w196_staff_role_matches(v.actor_user_id, v.actor_email)
  THEN RAISE EXCEPTION 'w196_staff_nda_authority_denied'; END IF;
  IF v.status = 'finalized' THEN
    IF v.content_sha256 IS DISTINCT FROM p_content_sha256 THEN RAISE EXCEPTION 'w196_digest_conflict'; END IF;
    RETURN v.result;
  END IF;
  IF v.status <> 'pending' OR v.expires_at <= clock_timestamp() THEN RAISE EXCEPTION 'w196_intent_closed'; END IF;
  v_source_kind := v.metadata->>'source_kind';
  v_source_reference := NULLIF(BTRIM(v.metadata->>'source_reference'), '');
  IF v.resource_id IS NULL OR v.related_id IS NULL
    OR v.bucket_id <> 'opportunity-documents'
    OR v.content_type <> 'application/pdf' OR LOWER(v.original_filename) NOT LIKE '%.pdf'
    OR v.storage_path NOT LIKE (v.metadata->>'opportunity_id')
      || '/nda-artifacts/repreneur_signed_copy/' || v.id::text || '-%'
    OR v_source_kind NOT IN ('email', 'in_person', 'other')
    OR v_source_reference IS NULL OR LENGTH(v_source_reference) > 500
    OR COALESCE(v.metadata->>'title', '') = ''
  THEN RAISE EXCEPTION 'w196_staff_nda_intent_invalid'; END IF;
  IF NOT public.wave_journey_is_enabled() THEN RAISE EXCEPTION 'wave_journey_disabled'; END IF;
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id = v.resource_id FOR UPDATE;
  IF v_match.id IS NULL OR v_match.repreneur_id IS DISTINCT FROM v.related_id
    OR v_match.opportunity_id::text IS DISTINCT FROM v.metadata->>'opportunity_id'
    OR v_match.status <> 'active_pursuit'
    OR NOT public.w164_match_has_same_namespace(v_match.id)
    OR NOT EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = v_match.opportunity_id AND o.status = 'active')
  THEN RAISE EXCEPTION 'w196_staff_nda_pursuit_stale'; END IF;
  v_gate := public.journey_current_gate_1_event(v_match.id);
  IF v_gate IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.opportunity_pursuit_evidence e
    WHERE e.match_id = v_match.id AND e.event_type = 'e6_nda_ready_notified'
      AND e.metadata->>'upstream_evidence_id' = v_gate::text
  ) THEN RAISE EXCEPTION 'w196_staff_nda_gate_not_ready'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_match.id::text || ':repreneur_signed_copy', 0));
  SELECT a.id, a.document_id, a.version_number INTO v_artifact, v_document, v_version
  FROM public.opportunity_nda_artifacts a
  WHERE a.match_id = v_match.id AND a.artifact_role = 'repreneur_signed_copy'
    AND a.content_sha256 = p_content_sha256 LIMIT 1;
  IF v_artifact IS NULL THEN
    SELECT a.id, a.version_number + 1 INTO v_prior, v_version
    FROM public.opportunity_nda_artifacts a
    WHERE a.match_id = v_match.id AND a.artifact_role = 'repreneur_signed_copy'
    ORDER BY a.version_number DESC LIMIT 1;
    v_version := COALESCE(v_version, 1);
    INSERT INTO public.opportunity_documents (
      opportunity_id, title, document_type, visibility, storage_bucket, storage_path,
      file_name, size_bytes, mime_type, uploaded_by
    ) VALUES (
      v_match.opportunity_id, BTRIM(v.metadata->>'title'), 'nda', 'staff_only', v.bucket_id,
      v.storage_path, v.original_filename, v.declared_size, v.content_type, v.actor_user_id
    ) RETURNING id INTO v_document;
    PERFORM set_config('wave.journey_staff_received_nda', 'on', true);
    INSERT INTO public.opportunity_nda_artifacts (
      opportunity_id, match_id, document_id, artifact_role, version_number,
      content_sha256, supersedes_artifact_id, recorded_by, recorded_at
    ) VALUES (
      v_match.opportunity_id, v_match.id, v_document, 'repreneur_signed_copy', v_version,
      p_content_sha256, v_prior, v.actor_email, clock_timestamp()
    ) RETURNING id INTO v_artifact;
    PERFORM set_config('wave.journey_staff_received_nda', 'off', true);
  ELSE
    v_reused := true;
    INSERT INTO public.private_upload_cleanup_queue (intent_id, bucket_id, storage_path, reason)
    VALUES (v.id, v.bucket_id, v.storage_path, 'duplicate_staff_received_nda')
    ON CONFLICT (bucket_id, storage_path) DO NOTHING;
  END IF;
  INSERT INTO public.staff_received_nda_receipts (
    intent_id, artifact_id, document_id, match_id, opportunity_id, repreneur_id,
    staff_user_id, staff_email, source_kind, source_reference
  ) VALUES (
    v.id, v_artifact, v_document, v_match.id, v_match.opportunity_id, v_match.repreneur_id,
    v.actor_user_id, LOWER(BTRIM(v.actor_email)), v_source_kind, v_source_reference
  );
  v_result := JSONB_BUILD_OBJECT('artifactId', v_artifact, 'documentId', v_document,
    'versionNumber', v_version, 'reusedExisting', v_reused,
    'message', 'Received signed NDA recorded for staff validation.');
  UPDATE public.private_upload_intents SET status = 'finalized', content_sha256 = p_content_sha256,
    result = v_result, finalized_at = clock_timestamp(), failure_code = NULL WHERE id = v.id;
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.w196_finalize_staff_received_nda(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.w196_finalize_staff_received_nda(uuid, text, text, text) TO service_role;
