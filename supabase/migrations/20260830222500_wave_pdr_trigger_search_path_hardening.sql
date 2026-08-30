-- Pin the two PDR trigger functions reported by the production database advisor.
-- They currently reference only trigger records, but an empty search path keeps
-- future edits from resolving attacker-controlled objects implicitly.
ALTER FUNCTION public.wave_pdr_proposal_intake_provenance_immutable()
  SET search_path = '';

ALTER FUNCTION public.wave_pdr_historical_work_cards_read_only()
  SET search_path = '';
