-- W-098 — narrow, source-backed repair for the six legacy CRM dates that were
-- parsed as 2001. This is intentionally not an importer or a general-purpose
-- data correction path.
BEGIN;

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS date_added_precision TEXT;

ALTER TABLE public.opportunities
  DROP CONSTRAINT IF EXISTS opportunities_date_added_precision_valid;

ALTER TABLE public.opportunities
  ADD CONSTRAINT opportunities_date_added_precision_valid
  CHECK (date_added_precision IS NULL OR date_added_precision IN ('day', 'month'));

CREATE TABLE IF NOT EXISTS public.ma_opportunity_date_correction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL UNIQUE REFERENCES public.opportunities(id),
  opportunity_reference TEXT NOT NULL,
  prior_date_added DATE NOT NULL,
  corrected_date_added DATE NOT NULL,
  corrected_precision TEXT NOT NULL CHECK (corrected_precision IN ('day', 'month')),
  source_evidence_hash TEXT NOT NULL CHECK (source_evidence_hash ~ '^[0-9a-f]{64}$'),
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
  -- These are the only mappings authorised by the approved, hash-bound CRM
  -- snapshot. Month-only values use day 01; the source supplied no day.
  FOR repair IN
    SELECT *
    FROM (
      VALUES
        ('733e7e38-784a-4dbb-9815-f399a5fcab16'::UUID, 'Re-New - AU - 001'::TEXT, DATE '2001-12-25', DATE '2025-12-01'),
        ('de8a550c-a77b-4a80-9c06-800aac8e109f'::UUID, 'Re-New - BFC - 001'::TEXT, DATE '2001-01-26', DATE '2026-01-01'),
        ('104edeab-0383-4e9a-9b40-b27385b41795'::UUID, 'Re-New - GE - 001'::TEXT, DATE '2001-01-26', DATE '2026-01-01'),
        ('2650915e-f648-47ea-a4f8-b30abc47bcef'::UUID, 'Re-New - Idf - 003'::TEXT, DATE '2001-01-26', DATE '2026-01-01'),
        ('ab4847d8-09dd-4a54-ad6a-967a28bdaa4e'::UUID, 'Re-New - Idf - 015'::TEXT, DATE '2001-05-26', DATE '2026-05-01'),
        ('1d0fc197-e26d-4274-9a74-04c6719c600e'::UUID, 'Re-New - PL - 002'::TEXT, DATE '2001-02-26', DATE '2026-02-01')
    ) AS repairs(opportunity_id, reference, prior_date_added, corrected_date_added)
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
        correction_code
      ) VALUES (
        repair.opportunity_id,
        repair.reference,
        repair.prior_date_added,
        repair.corrected_date_added,
        'month',
        'a4b50611de0578a4a2b36f8c6da284c6e53d10b2fd4f418ab560dd31a9a0d6a5',
        'W-098 legacy month-year repair'
      );
    ELSIF actual_date = repair.corrected_date_added AND actual_precision = 'month' THEN
      IF NOT FOUND
        OR existing_event.prior_date_added <> repair.prior_date_added
        OR existing_event.corrected_date_added <> repair.corrected_date_added
        OR existing_event.corrected_precision <> 'month'
        OR existing_event.source_evidence_hash <> 'a4b50611de0578a4a2b36f8c6da284c6e53d10b2fd4f418ab560dd31a9a0d6a5'
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
