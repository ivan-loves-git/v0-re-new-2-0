-- Additive source clarification evidence. This migration changes no real row.
-- Only the separately approved, direct-database operator can insert evidence.
CREATE TABLE public.pursuit_v4_clarification_batches (
  id TEXT PRIMARY KEY CHECK (id = 'v4-source-clarification-2026-09-16'),
  manifest_sha256 TEXT NOT NULL CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  manifest JSONB NOT NULL CHECK (jsonb_typeof(manifest) = 'object'),
  source_reference TEXT NOT NULL CHECK (source_reference LIKE 'https://re-newplatform.slack.com/archives/%'),
  applied_by TEXT NOT NULL CHECK (btrim(applied_by) <> ''),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE public.pursuit_v4_clarifications (
  ledger_id UUID PRIMARY KEY REFERENCES public.historical_pursuit_import_rows(id),
  batch_id TEXT NOT NULL REFERENCES public.pursuit_v4_clarification_batches(id),
  outcome TEXT NOT NULL CHECK (outcome IN ('closed_history','external_history','confidential_history','linked_history','reopened')),
  opportunity_id UUID REFERENCES public.opportunities(id),
  match_id UUID REFERENCES public.opportunity_matches(id),
  resolved_reference TEXT,
  before_match JSONB,
  after_match_sha256 TEXT,
  mapped_match_status public.opportunity_match_status,
  reopen_evidence_id UUID REFERENCES public.opportunity_pursuit_evidence(id),
  CHECK ((outcome IN ('closed_history','external_history','confidential_history') AND opportunity_id IS NULL AND match_id IS NULL
      AND resolved_reference IS NULL AND before_match IS NULL AND after_match_sha256 IS NULL AND mapped_match_status IS NULL AND reopen_evidence_id IS NULL)
    OR (outcome IN ('linked_history','reopened') AND opportunity_id IS NOT NULL AND match_id IS NOT NULL
      AND resolved_reference IS NOT NULL AND after_match_sha256 ~ '^[0-9a-f]{64}$' AND mapped_match_status IS NOT NULL
      AND ((outcome = 'reopened' AND before_match IS NOT NULL AND reopen_evidence_id IS NOT NULL)
        OR (outcome = 'linked_history' AND before_match IS NULL AND reopen_evidence_id IS NULL))))
);

ALTER TABLE public.pursuit_v4_clarification_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pursuit_v4_clarification_batches FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pursuit_v4_clarifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pursuit_v4_clarifications FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.pursuit_v4_clarification_batches, public.pursuit_v4_clarifications FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER pursuit_v4_clarification_batches_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
  ON public.pursuit_v4_clarification_batches FOR EACH STATEMENT EXECUTE FUNCTION public.historical_pursuit_import_rows_immutable();
CREATE TRIGGER pursuit_v4_clarifications_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
  ON public.pursuit_v4_clarifications FOR EACH STATEMENT EXECUTE FUNCTION public.historical_pursuit_import_rows_immutable();

-- The raw ledger is immutable. This staff-only read model overlays only the
-- explicitly clarified linkage/review outcome; raw references and stages survive.
CREATE VIEW public.historical_pursuit_resolved_rows WITH (security_invoker = true) AS
SELECT projected.*, c.outcome AS clarification_outcome, c.resolved_reference,
  b.applied_at AS clarified_at
FROM public.historical_pursuit_import_rows h
LEFT JOIN public.pursuit_v4_clarifications c ON c.ledger_id = h.id
LEFT JOIN public.pursuit_v4_clarification_batches b ON b.id = c.batch_id
CROSS JOIN LATERAL jsonb_populate_record(NULL::public.historical_pursuit_import_rows,
  to_jsonb(h) || CASE WHEN c.ledger_id IS NULL THEN '{}'::JSONB ELSE jsonb_build_object(
    'opportunity_id', c.opportunity_id, 'match_id', c.match_id,
    'mapped_match_status', c.mapped_match_status,
    'apply_outcome', CASE WHEN c.outcome = 'linked_history' THEN 'created' WHEN c.outcome = 'reopened' THEN 'merged' ELSE 'external_or_missing' END,
    'resolution_blockers', '[]'::JSONB,
    'review_flags', to_jsonb(ARRAY(SELECT f FROM unnest(h.review_flags) f WHERE f NOT IN ('source_active_current_dropped','current_status_preserved')))
  ) END) projected;
REVOKE ALL ON public.historical_pursuit_resolved_rows FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.historical_pursuit_resolved_rows_for_staff(p_repreneur_id UUID)
RETURNS SETOF public.historical_pursuit_resolved_rows
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT * FROM public.historical_pursuit_resolved_rows
  WHERE p_repreneur_id IS NULL OR repreneur_id = p_repreneur_id
  ORDER BY source_sha256, source_row
$$;
REVOKE ALL ON FUNCTION public.historical_pursuit_resolved_rows_for_staff(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.historical_pursuit_resolved_rows_for_staff(UUID) TO service_role;
