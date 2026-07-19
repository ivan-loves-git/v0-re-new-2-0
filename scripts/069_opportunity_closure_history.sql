-- Migration: Append-only opportunity closure history
-- Purpose: Require a canonical staff reason whenever an opportunity is closed,
-- while allowing later reopening without changing historical closure records.

DO $$ BEGIN
  CREATE TYPE public.opportunity_closure_reason AS ENUM (
    'stale',
    'sold',
    'signed_repreneur',
    'paused_cabinet',
    'withdrawn_seller',
    'no_viable_match',
    'dd_disqualified',
    'duplicate'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.opportunity_closure_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  reason public.opportunity_closure_reason NOT NULL,
  closed_by TEXT NOT NULL,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.opportunity_closure_history IS
  'Append-only staff closure records. Reopening an opportunity never edits or deletes these rows.';
COMMENT ON COLUMN public.opportunity_closure_history.reason IS
  'Canonical staff-selected reason for closing an opportunity.';

CREATE INDEX IF NOT EXISTS idx_opportunity_closure_history_opportunity_closed_at
  ON public.opportunity_closure_history(opportunity_id, closed_at DESC);

CREATE OR REPLACE FUNCTION public.prevent_opportunity_closure_history_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'opportunity_closure_history_is_immutable';
END;
$$;

DROP TRIGGER IF EXISTS prevent_opportunity_closure_history_mutation ON public.opportunity_closure_history;
CREATE TRIGGER prevent_opportunity_closure_history_mutation
  BEFORE UPDATE OR DELETE ON public.opportunity_closure_history
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_opportunity_closure_history_mutation();

CREATE OR REPLACE FUNCTION public.close_opportunity_with_reason(
  p_opportunity_id UUID,
  p_reason public.opportunity_closure_reason,
  p_closed_by TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_opportunity_id UUID;
BEGIN
  IF p_closed_by IS NULL OR BTRIM(p_closed_by) = '' THEN
    RAISE EXCEPTION 'closure_actor_required';
  END IF;

  UPDATE public.opportunities
  SET status = 'closed'::public.opportunity_status
  WHERE id = p_opportunity_id
    AND status <> 'closed'::public.opportunity_status
  RETURNING id INTO v_opportunity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'opportunity_not_open_for_closure';
  END IF;

  INSERT INTO public.opportunity_closure_history (
    opportunity_id,
    reason,
    closed_by
  )
  VALUES (
    v_opportunity_id,
    p_reason,
    p_closed_by
  );
END;
$$;

ALTER TABLE public.opportunity_closure_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.opportunity_closure_history FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.opportunity_closure_history TO service_role;

REVOKE ALL ON TYPE public.opportunity_closure_reason FROM PUBLIC, anon, authenticated;
GRANT USAGE ON TYPE public.opportunity_closure_reason TO service_role;

REVOKE ALL ON FUNCTION public.close_opportunity_with_reason(UUID, public.opportunity_closure_reason, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_opportunity_with_reason(UUID, public.opportunity_closure_reason, TEXT)
  TO service_role;

COMMENT ON FUNCTION public.close_opportunity_with_reason(UUID, public.opportunity_closure_reason, TEXT) IS
  'Atomically closes an opportunity and records one immutable canonical reason. Callable only through the server-side service role.';
