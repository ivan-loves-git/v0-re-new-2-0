-- W-098 — narrow, source-backed repair for the six legacy CRM dates that were
-- parsed as 2001. This is intentionally not an importer or a general-purpose
-- data correction path. Release gate: before approving or applying this SQL,
-- run `pnpm w098:source-preflight -- /absolute/path/to/2026_05_04_Mandats_Source_UPDATED_dealflow.xlsx`
-- with a configured read-only database connection, successfully against the
-- immutable historical PDR source workbook and current live descriptions.
BEGIN;

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS date_added_precision TEXT;

ALTER TABLE public.opportunities
  DROP CONSTRAINT IF EXISTS opportunities_date_added_precision_valid;

ALTER TABLE public.opportunities
  ADD CONSTRAINT opportunities_date_added_precision_valid
  CHECK (date_added_precision IS NULL OR date_added_precision IN ('day', 'month'));

-- The canonical save routine historically accepted only `date_added`. Keep
-- that public RPC stable, but make its date writes an atomic date/precision
-- pair at the persistence boundary. Explicit month precision remains intact
-- for source-backed imports and the six W-098 repairs below.
CREATE OR REPLACE FUNCTION public.sync_opportunity_date_added_precision()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.date_added IS NULL THEN
      NEW.date_added_precision := NULL;
    ELSIF NEW.date_added_precision IS NULL THEN
      NEW.date_added_precision := 'day';
    END IF;
  ELSIF NEW.date_added IS DISTINCT FROM OLD.date_added
    AND NEW.date_added_precision IS NOT DISTINCT FROM OLD.date_added_precision THEN
    IF NEW.date_added IS NULL THEN
      NEW.date_added_precision := NULL;
    ELSE
      NEW.date_added_precision := 'day';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS sync_opportunity_date_added_precision
  ON public.opportunities;
CREATE TRIGGER sync_opportunity_date_added_precision
  BEFORE INSERT OR UPDATE OF date_added ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_opportunity_date_added_precision();

REVOKE ALL ON FUNCTION public.sync_opportunity_date_added_precision()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.ma_opportunity_date_correction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL UNIQUE REFERENCES public.opportunities(id),
  opportunity_reference TEXT NOT NULL,
  prior_date_added DATE NOT NULL,
  corrected_date_added DATE NOT NULL,
  corrected_precision TEXT NOT NULL CHECK (corrected_precision IN ('day', 'month')),
  source_evidence_hash TEXT NOT NULL CHECK (source_evidence_hash ~ '^[0-9a-f]{64}$'),
  source_sheet TEXT NOT NULL,
  source_row INTEGER NOT NULL CHECK (source_row > 0),
  source_reference TEXT NOT NULL,
  source_date_serial INTEGER NOT NULL,
  source_description_hash TEXT NOT NULL CHECK (source_description_hash ~ '^[0-9a-f]{64}$'),
  live_description_hash TEXT NOT NULL CHECK (live_description_hash ~ '^[0-9a-f]{64}$'),
  correction_code TEXT NOT NULL CHECK (correction_code = 'W-098 legacy month-year repair'),
  corrected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (prior_date_added <> corrected_date_added)
);

CREATE OR REPLACE FUNCTION public.prevent_ma_opportunity_date_correction_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'ma_opportunity_date_correction_events_are_immutable';
END
$$;

DROP TRIGGER IF EXISTS prevent_ma_opportunity_date_correction_event_mutation
  ON public.ma_opportunity_date_correction_events;
CREATE TRIGGER prevent_ma_opportunity_date_correction_event_mutation
  BEFORE UPDATE OR DELETE ON public.ma_opportunity_date_correction_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_ma_opportunity_date_correction_event_mutation();

ALTER TABLE public.ma_opportunity_date_correction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ma_opportunity_date_correction_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ma_opportunity_date_correction_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.ma_opportunity_date_correction_events TO service_role;
REVOKE ALL ON FUNCTION public.prevent_ma_opportunity_date_correction_event_mutation()
  FROM PUBLIC, anon, authenticated, service_role;

DO $$
DECLARE
  repair RECORD;
  actual_date DATE;
  actual_precision TEXT;
  existing_event public.ma_opportunity_date_correction_events%ROWTYPE;
BEGIN
  -- These are the only mappings authorised by the approved legacy PDR source
  -- workbook. This repair is independent from the later W-010 workbook.
  -- Month-only source values use day 01; the source supplied no day.
  FOR repair IN
    SELECT *
    FROM (
      VALUES
        ('733e7e38-784a-4dbb-9815-f399a5fcab16'::UUID, 'Re-New - AU - 001'::TEXT, DATE '2001-12-25', DATE '2025-12-01', '2026.05.04 Source'::TEXT, 7, 'Re-New - AU - 004'::TEXT, 45992, 'f07b748dbc4f9cb5703ad69f0f92276b5440c38a5229d5df4e3c9a9720c38259'::TEXT, 'f07b748dbc4f9cb5703ad69f0f92276b5440c38a5229d5df4e3c9a9720c38259'::TEXT),
        ('de8a550c-a77b-4a80-9c06-800aac8e109f'::UUID, 'Re-New - BFC - 001'::TEXT, DATE '2001-01-26', DATE '2026-01-01', '2026.05.04 Source'::TEXT, 19, 'Re-New - BFC - 001'::TEXT, 46023, '31c5a41f73ab0872315313bca912bc30d27117fb8b15831b03d0c98e74e52690'::TEXT, '31c5a41f73ab0872315313bca912bc30d27117fb8b15831b03d0c98e74e52690'::TEXT),
        ('104edeab-0383-4e9a-9b40-b27385b41795'::UUID, 'Re-New - GE - 001'::TEXT, DATE '2001-01-26', DATE '2026-01-01', '2026.05.04 Source'::TEXT, 29, 'Re-New - GE - 001'::TEXT, 46023, 'ff21a12a77d49b7d2a198a72952a61df69c0d59d750bf5b7dd7c04d6879e3f52'::TEXT, 'ff21a12a77d49b7d2a198a72952a61df69c0d59d750bf5b7dd7c04d6879e3f52'::TEXT),
        ('2650915e-f648-47ea-a4f8-b30abc47bcef'::UUID, 'Re-New - Idf - 003'::TEXT, DATE '2001-01-26', DATE '2026-01-01', '2026.05.04 Source'::TEXT, 55, 'Re-New - Idf - 003'::TEXT, 46023, '10d77cea3c4de605748ab36ce4d3a888d9711fd5a8d4cd7e3f08777964baf560'::TEXT, '10d77cea3c4de605748ab36ce4d3a888d9711fd5a8d4cd7e3f08777964baf560'::TEXT),
        ('ab4847d8-09dd-4a54-ad6a-967a28bdaa4e'::UUID, 'Re-New - Idf - 015'::TEXT, DATE '2001-05-26', DATE '2026-05-01', '2026.05.04 Source'::TEXT, 68, 'Re-New - Idf - 016'::TEXT, 46146, 'ffe6f1672620130067d325af8bf65d6ec1e5812f5a76df89dfab2eae635e4736'::TEXT, '76c420fcd78b9095a0a8c01a4985ea58684e003cdd9f1cb6851f1d2aa66f1c90'::TEXT),
        ('1d0fc197-e26d-4274-9a74-04c6719c600e'::UUID, 'Re-New - PL - 002'::TEXT, DATE '2001-02-26', DATE '2026-02-01', '2026.05.04 Source'::TEXT, 92, 'Re-New - PL - 002'::TEXT, 46054, '29ab8e4bbd42a467185e7c66e64acf03f0f86def07bc7baf79ff23fd9ec0f954'::TEXT, '970b55724cb7ae94b33c1ff89f824218138b9c15a3f09db7d0379acb13524741'::TEXT)
    ) AS repairs(opportunity_id, reference, prior_date_added, corrected_date_added, source_sheet, source_row, source_reference, source_date_serial, source_description_hash, live_description_hash)
  LOOP
    SELECT opportunity.date_added, opportunity.date_added_precision
      INTO actual_date, actual_precision
    FROM public.opportunities opportunity
    WHERE opportunity.id = repair.opportunity_id
      AND opportunity.reference = repair.reference
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'w098_expected_opportunity_missing_or_reference_changed';
    END IF;

    SELECT *
      INTO existing_event
    FROM public.ma_opportunity_date_correction_events event
    WHERE event.opportunity_id = repair.opportunity_id;

    IF actual_date = repair.prior_date_added AND actual_precision IS NULL THEN
      IF FOUND THEN
        RAISE EXCEPTION 'w098_existing_evidence_does_not_match_legacy_value';
      END IF;

      UPDATE public.opportunities
      SET
        date_added = repair.corrected_date_added,
        date_added_precision = 'month'
      WHERE id = repair.opportunity_id;

      INSERT INTO public.ma_opportunity_date_correction_events (
        opportunity_id,
        opportunity_reference,
        prior_date_added,
        corrected_date_added,
        corrected_precision,
        source_evidence_hash,
        source_sheet,
        source_row,
        source_reference,
        source_date_serial,
        source_description_hash,
        live_description_hash,
        correction_code
      ) VALUES (
        repair.opportunity_id,
        repair.reference,
        repair.prior_date_added,
        repair.corrected_date_added,
        'month',
        '7f139050605e1c90dee92db79e7b8f6211a554b625365b024d260eea36627225',
        repair.source_sheet,
        repair.source_row,
        repair.source_reference,
        repair.source_date_serial,
        repair.source_description_hash,
        repair.live_description_hash,
        'W-098 legacy month-year repair'
      );
    ELSIF actual_date = repair.corrected_date_added AND actual_precision = 'month' THEN
      IF NOT FOUND
        OR existing_event.opportunity_reference <> repair.reference
        OR existing_event.prior_date_added <> repair.prior_date_added
        OR existing_event.corrected_date_added <> repair.corrected_date_added
        OR existing_event.corrected_precision <> 'month'
        OR existing_event.source_evidence_hash <> '7f139050605e1c90dee92db79e7b8f6211a554b625365b024d260eea36627225'
        OR existing_event.source_sheet <> repair.source_sheet
        OR existing_event.source_row <> repair.source_row
        OR existing_event.source_reference <> repair.source_reference
        OR existing_event.source_date_serial <> repair.source_date_serial
        OR existing_event.source_description_hash <> repair.source_description_hash
        OR existing_event.live_description_hash <> repair.live_description_hash
        OR existing_event.correction_code <> 'W-098 legacy month-year repair'
      THEN
        RAISE EXCEPTION 'w098_existing_repair_evidence_mismatch';
      END IF;
      -- A deliberate re-run is a verified no-op, not a new correction event.
    ELSE
      RAISE EXCEPTION 'w098_unexpected_live_date_or_precision';
    END IF;
  END LOOP;
END;
$$;

DO $$
DECLARE
  repaired_count INTEGER;
  event_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO repaired_count
  FROM public.opportunities
  WHERE id IN (
    '733e7e38-784a-4dbb-9815-f399a5fcab16'::UUID,
    'de8a550c-a77b-4a80-9c06-800aac8e109f'::UUID,
    '104edeab-0383-4e9a-9b40-b27385b41795'::UUID,
    '2650915e-f648-47ea-a4f8-b30abc47bcef'::UUID,
    'ab4847d8-09dd-4a54-ad6a-967a28bdaa4e'::UUID,
    '1d0fc197-e26d-4274-9a74-04c6719c600e'::UUID
  )
    AND date_added_precision = 'month'
    AND date_added >= DATE '2025-12-01'
    AND date_added < DATE '2026-06-01';

  SELECT COUNT(*) INTO event_count
  FROM public.ma_opportunity_date_correction_events
  WHERE correction_code = 'W-098 legacy month-year repair';

  IF repaired_count <> 6 OR event_count <> 6 THEN
    RAISE EXCEPTION 'w098_reconciliation_count_mismatch';
  END IF;
END;
$$;

COMMIT;
