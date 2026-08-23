-- W-112 candidate: controlled, source-row-idempotent import of historical
-- pursuit *facts*. This migration intentionally creates no canonical journey
-- evidence, documents, gates, grants, email or source-disclosure capability.

CREATE TABLE IF NOT EXISTS public.historical_pursuit_import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_sha256 TEXT NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  source_sheet TEXT NOT NULL CHECK (BTRIM(source_sheet) <> ''),
  source_row INTEGER NOT NULL CHECK (source_row >= 1),
  source_repreneur_name TEXT NOT NULL CHECK (BTRIM(source_repreneur_name) <> ''),
  source_offer_label TEXT,
  source_opportunity_reference TEXT,
  source_cells JSONB NOT NULL CHECK (jsonb_typeof(source_cells) = 'object'),
  source_row_fingerprint TEXT NOT NULL CHECK (source_row_fingerprint ~ '^[0-9a-f]{64}$'),
  manifest_digest TEXT NOT NULL CHECK (manifest_digest ~ '^[0-9a-f]{64}$'),
  payload_sha256 TEXT NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  repreneur_id UUID REFERENCES public.repreneurs(id) ON DELETE RESTRICT,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  match_id UUID REFERENCES public.opportunity_matches(id) ON DELETE RESTRICT,
  completed_source_stages TEXT[] NOT NULL DEFAULT '{}',
  not_applicable_source_stages TEXT[] NOT NULL DEFAULT '{}',
  last_reported_source_stage TEXT NOT NULL,
  raw_drop_reason TEXT,
  event_dates_unknown BOOLEAN NOT NULL DEFAULT TRUE CHECK (event_dates_unknown),
  source_terminal BOOLEAN NOT NULL,
  resolution_blockers TEXT[] NOT NULL DEFAULT '{}',
  review_flags TEXT[] NOT NULL DEFAULT '{}',
  mapped_match_status public.opportunity_match_status,
  apply_outcome TEXT NOT NULL CHECK (apply_outcome IN ('created', 'merged', 'external_or_missing')),
  applied_by TEXT NOT NULL CHECK (BTRIM(applied_by) <> ''),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT historical_pursuit_import_rows_source_key UNIQUE (source_sha256, source_sheet, source_row),
  CONSTRAINT historical_pursuit_import_rows_link_scope CHECK (
    (opportunity_id IS NULL AND match_id IS NULL AND mapped_match_status IS NULL AND apply_outcome = 'external_or_missing')
    OR (opportunity_id IS NOT NULL AND match_id IS NOT NULL AND mapped_match_status IS NOT NULL AND apply_outcome IN ('created', 'merged'))
  )
);

ALTER TABLE public.historical_pursuit_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_pursuit_import_rows FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.historical_pursuit_import_rows FROM PUBLIC, anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.historical_pursuit_import_rows_immutable() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'historical_pursuit_import_rows_are_immutable'; END $$;
CREATE TRIGGER historical_pursuit_import_rows_no_update_delete BEFORE UPDATE OR DELETE ON public.historical_pursuit_import_rows FOR EACH ROW EXECUTE FUNCTION public.historical_pursuit_import_rows_immutable();

CREATE OR REPLACE FUNCTION public.apply_historical_pursuit_import_row(
  p_source_sha256 TEXT,
  p_source_sheet TEXT,
  p_source_row INTEGER,
  p_repreneur_id UUID,
  p_opportunity_id UUID,
  p_completed_source_stages TEXT[],
  p_not_applicable_source_stages TEXT[],
  p_raw_drop_reason TEXT,
  p_event_dates_unknown BOOLEAN,
  p_actor TEXT,
  p_source_repreneur_name TEXT,
  p_source_offer_label TEXT,
  p_source_opportunity_reference TEXT,
  p_source_row_fingerprint TEXT,
  p_manifest_digest TEXT,
  p_resolution_blockers TEXT[],
  p_review_flags TEXT[],
  p_source_cells JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_payload JSONB;
  v_digest TEXT;
  v_existing public.historical_pursuit_import_rows%ROWTYPE;
  v_match public.opportunity_matches%ROWTYPE;
  v_match_id UUID;
  v_status public.opportunity_match_status;
  v_terminal BOOLEAN := FALSE;
  v_outcome TEXT;
  v_last_stage TEXT := 'none';
  v_flags TEXT[] := '{}';
  v_categories TEXT[] := '{}';
  v_allowed TEXT[] := ARRAY['interest_confirmed','nda_received','nda_signed','info_memo_received','qa_with_ma_firm','seller_meeting','valuation','loi_issued','audits','financing','closing'];
BEGIN
  IF p_source_sha256 <> '6fa8b640dfcd385c2bd6dabf571ee01a4f51d09a53122f65c422c047ddb3f60f'
    OR p_manifest_digest <> 'b25008e1dfcc7c9e8f21f0f2aad5d757e54ed508243a89595fd5e231feb907b7'
    OR p_source_row_fingerprint !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'historical_pursuit_source_hash_not_approved';
  END IF;
  IF BTRIM(COALESCE(p_source_sheet, '')) <> 'Synthese' OR p_source_row NOT BETWEEN 3 AND 62 THEN
    RAISE EXCEPTION 'historical_pursuit_source_locator_invalid';
  END IF;
  IF NULLIF(BTRIM(p_actor), '') IS NULL OR NULLIF(BTRIM(p_source_repreneur_name), '') IS NULL OR p_event_dates_unknown IS DISTINCT FROM TRUE OR jsonb_typeof(p_source_cells) <> 'object' OR (p_opportunity_id IS NOT NULL AND p_repreneur_id IS NULL) THEN
    RAISE EXCEPTION 'historical_pursuit_required_input_missing';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(COALESCE(p_completed_source_stages, '{}')) AS stage WHERE stage <> ALL(v_allowed))
    OR EXISTS (SELECT 1 FROM unnest(COALESCE(p_not_applicable_source_stages, '{}')) AS stage WHERE stage <> ALL(v_allowed))
    OR EXISTS (SELECT 1 FROM unnest(COALESCE(p_completed_source_stages, '{}')) AS stage WHERE stage = ANY(COALESCE(p_not_applicable_source_stages, '{}')))
  THEN RAISE EXCEPTION 'historical_pursuit_source_stage_invalid'; END IF;

  SELECT stage INTO v_last_stage
  FROM unnest(v_allowed) WITH ORDINALITY AS orderings(stage, ordinal)
  WHERE stage = ANY(COALESCE(p_completed_source_stages, '{}'))
  ORDER BY ordinal DESC LIMIT 1;
  v_last_stage := COALESCE(v_last_stage, 'none');
  IF cardinality(COALESCE(p_not_applicable_source_stages, '{}')) > 0 THEN
    v_terminal := TRUE;
    IF NULLIF(BTRIM(p_raw_drop_reason), '') IS NULL THEN v_flags := ARRAY['missing_reason']; END IF;
  ELSIF NULLIF(BTRIM(p_raw_drop_reason), '') IS NOT NULL THEN
    v_terminal := TRUE;
    v_flags := ARRAY['reason_without_terminal_marker'];
  END IF;
  IF v_terminal AND NULLIF(BTRIM(p_raw_drop_reason), '') IS NOT NULL THEN
    IF lower(p_raw_drop_reason) ~ 'locali|geograph' THEN v_categories := ARRAY['geography'];
    ELSIF lower(p_raw_drop_reason) ~ 'sector' THEN v_categories := ARRAY['sector'];
    ELSIF lower(p_raw_drop_reason) ~ 'size|profit|financ|price|valor' THEN v_categories := ARRAY['size_metrics'];
    ELSIF lower(p_raw_drop_reason) ~ 'business model' THEN v_categories := ARRAY['business_model'];
    ELSE v_categories := ARRAY['other']; END IF;
  END IF;
  v_payload := jsonb_build_object(
    'repreneur_id', p_repreneur_id, 'opportunity_id', p_opportunity_id,
    'completed_source_stages', COALESCE(p_completed_source_stages, '{}'),
    'not_applicable_source_stages', COALESCE(p_not_applicable_source_stages, '{}'),
    'raw_drop_reason', NULLIF(BTRIM(p_raw_drop_reason), ''),
    'event_dates_unknown', p_event_dates_unknown, 'terminal', v_terminal,
    'source_row_fingerprint', p_source_row_fingerprint, 'manifest_digest', p_manifest_digest,
    'resolution_blockers', COALESCE(p_resolution_blockers, '{}'), 'review_flags', COALESCE(p_review_flags, '{}'), 'source_cells', p_source_cells
  );
  v_digest := encode(extensions.digest(convert_to(v_payload::text, 'UTF8'), 'sha256'), 'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(p_source_sha256 || ':' || p_source_sheet || ':' || p_source_row::text, 112));
  SELECT * INTO v_existing FROM public.historical_pursuit_import_rows
  WHERE source_sha256 = p_source_sha256 AND source_sheet = p_source_sheet AND source_row = p_source_row FOR UPDATE;
  IF FOUND THEN
    IF v_existing.payload_sha256 <> v_digest THEN RAISE EXCEPTION 'historical_pursuit_source_row_payload_mismatch'; END IF;
    RETURN jsonb_build_object('outcome', 'replay', 'ledger_id', v_existing.id, 'match_id', v_existing.match_id);
  END IF;

  IF p_opportunity_id IS NULL THEN
    INSERT INTO public.historical_pursuit_import_rows(source_sha256,source_sheet,source_row,source_repreneur_name,source_offer_label,source_opportunity_reference,source_cells,source_row_fingerprint,manifest_digest,payload_sha256,repreneur_id,completed_source_stages,not_applicable_source_stages,last_reported_source_stage,raw_drop_reason,event_dates_unknown,source_terminal,resolution_blockers,review_flags,apply_outcome,applied_by)
    VALUES(p_source_sha256,p_source_sheet,p_source_row,BTRIM(p_source_repreneur_name),NULLIF(BTRIM(p_source_offer_label),''),NULLIF(BTRIM(p_source_opportunity_reference),''),p_source_cells,p_source_row_fingerprint,p_manifest_digest,v_digest,p_repreneur_id,COALESCE(p_completed_source_stages,'{}'),COALESCE(p_not_applicable_source_stages,'{}'),v_last_stage,NULLIF(BTRIM(p_raw_drop_reason),''),TRUE,v_terminal,COALESCE(p_resolution_blockers,'{}'),v_flags || COALESCE(p_review_flags,'{}'),'external_or_missing',BTRIM(p_actor))
    RETURNING id INTO v_match_id;
    RETURN jsonb_build_object('outcome', 'external_or_missing', 'ledger_id', v_match_id);
  END IF;

  SELECT * INTO v_match FROM public.opportunity_matches
  WHERE opportunity_id = p_opportunity_id AND repreneur_id = p_repreneur_id FOR UPDATE;
  IF FOUND THEN
    v_status := v_match.status;
    IF v_match.status = 'draft' AND v_terminal THEN
      UPDATE public.opportunity_matches SET status = 'dropped',
        decline_reason_categories = CASE WHEN cardinality(decline_reason_categories) = 0 THEN v_categories ELSE decline_reason_categories END,
        decline_reason_text = COALESCE(NULLIF(BTRIM(decline_reason_text), ''), NULLIF(BTRIM(p_raw_drop_reason), ''))
      WHERE id = v_match.id
        AND pursuit_stage IS NULL AND nda_status = 'not_required' AND nda_document_id IS NULL
        AND nda_received_at IS NULL AND nda_signed_at IS NULL AND nda_waived_at IS NULL;
      IF NOT FOUND THEN RAISE EXCEPTION 'historical_pursuit_draft_has_unexpected_workflow_state'; END IF;
      v_status := 'dropped';
    ELSIF v_match.status <> 'draft' THEN
      v_flags := array_append(v_flags, 'current_status_preserved');
    END IF;
    v_match_id := v_match.id; v_outcome := 'merged';
  ELSE
    v_status := CASE WHEN v_terminal THEN 'dropped'::public.opportunity_match_status ELSE 'draft'::public.opportunity_match_status END;
    INSERT INTO public.opportunity_matches(opportunity_id,repreneur_id,status,decline_reason_categories,decline_reason_text,created_by)
    VALUES(p_opportunity_id,p_repreneur_id,v_status,
      CASE WHEN v_terminal THEN v_categories ELSE '{}' END,
      CASE WHEN v_terminal THEN NULLIF(BTRIM(p_raw_drop_reason), '') ELSE NULL END,
      BTRIM(p_actor)) RETURNING id INTO v_match_id;
    v_outcome := 'created';
  END IF;
  INSERT INTO public.historical_pursuit_import_rows(source_sha256,source_sheet,source_row,source_repreneur_name,source_offer_label,source_opportunity_reference,source_cells,source_row_fingerprint,manifest_digest,payload_sha256,repreneur_id,opportunity_id,match_id,completed_source_stages,not_applicable_source_stages,last_reported_source_stage,raw_drop_reason,event_dates_unknown,source_terminal,resolution_blockers,review_flags,mapped_match_status,apply_outcome,applied_by)
  VALUES(p_source_sha256,p_source_sheet,p_source_row,BTRIM(p_source_repreneur_name),NULLIF(BTRIM(p_source_offer_label),''),NULLIF(BTRIM(p_source_opportunity_reference),''),p_source_cells,p_source_row_fingerprint,p_manifest_digest,v_digest,p_repreneur_id,p_opportunity_id,v_match_id,COALESCE(p_completed_source_stages,'{}'),COALESCE(p_not_applicable_source_stages,'{}'),v_last_stage,NULLIF(BTRIM(p_raw_drop_reason),''),TRUE,v_terminal,COALESCE(p_resolution_blockers,'{}'),v_flags || COALESCE(p_review_flags,'{}'),v_status,v_outcome,BTRIM(p_actor));
  RETURN jsonb_build_object('outcome', v_outcome, 'match_id', v_match_id, 'mapped_match_status', v_status);
END $$;

REVOKE ALL ON FUNCTION public.apply_historical_pursuit_import_row(TEXT,TEXT,INTEGER,UUID,UUID,TEXT[],TEXT[],TEXT,BOOLEAN,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT[],TEXT[],JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_historical_pursuit_import_row(TEXT,TEXT,INTEGER,UUID,UUID,TEXT[],TEXT[],TEXT,BOOLEAN,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT[],TEXT[],JSONB) TO service_role;
