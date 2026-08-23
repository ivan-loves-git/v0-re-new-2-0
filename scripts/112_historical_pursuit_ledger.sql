-- W-112 candidate: controlled, source-row-idempotent import of historical
-- pursuit *facts*. This migration intentionally creates no canonical journey
-- evidence, documents, gates, grants, email or source-disclosure capability.

CREATE TABLE IF NOT EXISTS public.historical_pursuit_import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_sha256 TEXT NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  source_sheet TEXT NOT NULL CHECK (BTRIM(source_sheet) <> ''),
  source_row INTEGER NOT NULL CHECK (source_row >= 1),
  payload_sha256 TEXT NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  repreneur_id UUID REFERENCES public.repreneurs(id) ON DELETE RESTRICT,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  match_id UUID REFERENCES public.opportunity_matches(id) ON DELETE RESTRICT,
  completed_source_stages TEXT[] NOT NULL DEFAULT '{}',
  not_applicable_source_stages TEXT[] NOT NULL DEFAULT '{}',
  last_reported_source_stage TEXT NOT NULL,
  raw_drop_reason TEXT,
  event_dates_unknown BOOLEAN NOT NULL DEFAULT TRUE CHECK (event_dates_unknown),
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
  p_actor TEXT
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
  v_allowed TEXT[] := ARRAY['interest_confirmed','nda_received','nda_signed','info_memo_received','qa_with_ma_firm','seller_meeting','valuation','loi_issued','audits','financing','closing'];
BEGIN
  IF p_source_sha256 <> '6fa8b640dfcd385c2bd6dabf571ee01a4f51d09a53122f65c422c047ddb3f60f' THEN
    RAISE EXCEPTION 'historical_pursuit_source_hash_not_approved';
  END IF;
  IF BTRIM(COALESCE(p_source_sheet, '')) <> 'Synthese' OR p_source_row NOT BETWEEN 3 AND 62 THEN
    RAISE EXCEPTION 'historical_pursuit_source_locator_invalid';
  END IF;
  IF p_repreneur_id IS NULL OR NULLIF(BTRIM(p_actor), '') IS NULL OR p_event_dates_unknown IS DISTINCT FROM TRUE THEN
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
  v_payload := jsonb_build_object(
    'repreneur_id', p_repreneur_id, 'opportunity_id', p_opportunity_id,
    'completed_source_stages', COALESCE(p_completed_source_stages, '{}'),
    'not_applicable_source_stages', COALESCE(p_not_applicable_source_stages, '{}'),
    'raw_drop_reason', NULLIF(BTRIM(p_raw_drop_reason), ''),
    'event_dates_unknown', p_event_dates_unknown, 'terminal', v_terminal
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
    INSERT INTO public.historical_pursuit_import_rows(source_sha256,source_sheet,source_row,payload_sha256,repreneur_id,completed_source_stages,not_applicable_source_stages,last_reported_source_stage,raw_drop_reason,event_dates_unknown,review_flags,apply_outcome,applied_by)
    VALUES(p_source_sha256,p_source_sheet,p_source_row,v_digest,p_repreneur_id,COALESCE(p_completed_source_stages,'{}'),COALESCE(p_not_applicable_source_stages,'{}'),v_last_stage,NULLIF(BTRIM(p_raw_drop_reason),''),TRUE,v_flags,'external_or_missing',BTRIM(p_actor))
    RETURNING id INTO v_match_id;
    RETURN jsonb_build_object('outcome', 'external_or_missing', 'ledger_id', v_match_id);
  END IF;

  SELECT * INTO v_match FROM public.opportunity_matches
  WHERE opportunity_id = p_opportunity_id AND repreneur_id = p_repreneur_id FOR UPDATE;
  IF FOUND THEN
    v_status := v_match.status;
    IF v_match.status = 'draft' AND v_terminal THEN
      UPDATE public.opportunity_matches SET status = 'dropped', pursuit_stage = NULL, pursuit_stage_notes = NULL,
        pursuit_stage_updated_by = NULL, pursuit_stage_updated_at = NULL WHERE id = v_match.id;
      v_status := 'dropped';
    ELSIF v_match.status <> 'draft' THEN
      v_flags := array_append(v_flags, 'current_status_preserved');
    END IF;
    v_match_id := v_match.id; v_outcome := 'merged';
  ELSE
    v_status := CASE WHEN v_terminal THEN 'dropped'::public.opportunity_match_status ELSE 'draft'::public.opportunity_match_status END;
    INSERT INTO public.opportunity_matches(opportunity_id,repreneur_id,status,created_by)
    VALUES(p_opportunity_id,p_repreneur_id,v_status,BTRIM(p_actor)) RETURNING id INTO v_match_id;
    v_outcome := 'created';
  END IF;
  INSERT INTO public.historical_pursuit_import_rows(source_sha256,source_sheet,source_row,payload_sha256,repreneur_id,opportunity_id,match_id,completed_source_stages,not_applicable_source_stages,last_reported_source_stage,raw_drop_reason,event_dates_unknown,review_flags,mapped_match_status,apply_outcome,applied_by)
  VALUES(p_source_sha256,p_source_sheet,p_source_row,v_digest,p_repreneur_id,p_opportunity_id,v_match_id,COALESCE(p_completed_source_stages,'{}'),COALESCE(p_not_applicable_source_stages,'{}'),v_last_stage,NULLIF(BTRIM(p_raw_drop_reason),''),TRUE,v_flags,v_status,v_outcome,BTRIM(p_actor));
  RETURN jsonb_build_object('outcome', v_outcome, 'match_id', v_match_id, 'mapped_match_status', v_status);
END $$;

REVOKE ALL ON FUNCTION public.apply_historical_pursuit_import_row(TEXT,TEXT,INTEGER,UUID,UUID,TEXT[],TEXT[],TEXT,BOOLEAN,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_historical_pursuit_import_row(TEXT,TEXT,INTEGER,UUID,UUID,TEXT[],TEXT[],TEXT,BOOLEAN,TEXT) TO service_role;
