-- Colin Deal Flow hardening: audit ledgers are implementation evidence, not
-- browser-readable data.  Service-role operations continue to bypass RLS; no
-- policies, grants, FORCE RLS, rows, or browser access are changed here.
--
-- The associated, separately approved data-correction operator is deliberately
-- not embedded in this migration. It must run only after its exact live
-- preflight passes and records before-images in the existing immutable ledger.

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS source_identity_to_verify BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.w021_opportunity_publication_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.w021_opportunity_publication_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.w021_opportunity_publication_rollbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.w128_draft_activation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.w128_draft_activation_rollbacks ENABLE ROW LEVEL SECURITY;

-- The generic staff-only flag joins the pre-existing source-review predicate,
-- so lifecycle, relationship and source-email database guards cannot bypass it.
CREATE OR REPLACE FUNCTION public.ma_opportunity_source_review_required(p_opportunity_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  IF COALESCE((
    SELECT opportunity.source_identity_to_verify
    FROM public.opportunities opportunity
    WHERE opportunity.id = p_opportunity_id
  ), FALSE) THEN
    RETURN TRUE;
  END IF;

  PERFORM public.assert_ma_provisional_source_context_integrity();

  RETURN EXISTS (
    SELECT 1
    FROM public.ma_provisional_source_contexts context
    JOIN public.opportunities opportunity ON opportunity.id = p_opportunity_id
    WHERE context.context_key = 'acme_co_paris'
      AND opportunity.source_office_id = context.office_id
  ) OR EXISTS (
    SELECT 1
    FROM public.ma_provisional_source_review_events assignment
    JOIN public.ma_provisional_source_contexts context
      ON context.context_key = 'acme_co_paris'
      AND context.office_id = assignment.provisional_office_id
    WHERE assignment.opportunity_id = p_opportunity_id
      AND assignment.event_kind = 'assigned'
      AND NOT EXISTS (
        SELECT 1
        FROM public.ma_provisional_source_review_events resolution
        WHERE resolution.event_kind = 'resolved'
          AND resolution.related_assignment_id = assignment.id
      )
  );
END;
$$;

-- The lifecycle trigger calls this assertion. Check the generic persisted flag
-- before the legacy Acme-context assertion, which is irrelevant to it.
CREATE OR REPLACE FUNCTION public.assert_ma_provisional_source_review_state(p_opportunity_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  context_row public.ma_provisional_source_contexts%ROWTYPE;
  opportunity_row public.opportunities%ROWTYPE;
  unresolved_assignment_count INTEGER;
BEGIN
  SELECT * INTO opportunity_row FROM public.opportunities WHERE id = p_opportunity_id;
  IF opportunity_row.id IS NULL THEN RETURN; END IF;

  IF opportunity_row.source_identity_to_verify
     AND opportunity_row.status IN ('closed', 'archived') THEN
    RAISE EXCEPTION 'ma_provisional_source_review_blocks_opportunity_lifecycle_exit';
  END IF;

  PERFORM public.assert_ma_provisional_source_context_integrity();
  SELECT * INTO context_row FROM public.ma_provisional_source_contexts WHERE context_key = 'acme_co_paris';
  IF context_row.context_key IS NULL THEN RETURN; END IF;

  SELECT COUNT(*) INTO unresolved_assignment_count
  FROM public.ma_provisional_source_review_events assignment
  WHERE assignment.opportunity_id = opportunity_row.id
    AND assignment.provisional_office_id = context_row.office_id
    AND assignment.event_kind = 'assigned'
    AND NOT EXISTS (
      SELECT 1 FROM public.ma_provisional_source_review_events resolution
      WHERE resolution.event_kind = 'resolved' AND resolution.related_assignment_id = assignment.id
    );

  IF opportunity_row.source_office_id = context_row.office_id AND unresolved_assignment_count <> 1 THEN
    RAISE EXCEPTION 'ma_provisional_source_assignment_requires_immutable_evidence';
  END IF;
  IF opportunity_row.source_office_id IS DISTINCT FROM context_row.office_id AND unresolved_assignment_count <> 0 THEN
    RAISE EXCEPTION 'ma_provisional_source_resolution_requires_immutable_evidence';
  END IF;
  IF public.ma_opportunity_source_review_required(opportunity_row.id)
     AND opportunity_row.status IN ('closed', 'archived') THEN
    RAISE EXCEPTION 'ma_provisional_source_review_blocks_opportunity_lifecycle_exit';
  END IF;
END;
$$;
