ALTER TABLE public.opportunity_matches
  ADD COLUMN IF NOT EXISTS decline_reason_categories TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS decline_reason_text TEXT;

COMMENT ON COLUMN public.opportunity_matches.decline_reason_categories IS
  'Repreneur-selected reasons when marking a proposed opportunity as not a fit.';
COMMENT ON COLUMN public.opportunity_matches.decline_reason_text IS
  'Optional repreneur free-text context for a not-a-fit opportunity response.';
