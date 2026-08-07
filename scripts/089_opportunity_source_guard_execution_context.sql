-- W-088 production correction: opportunity intake must be able to execute the
-- existing source-office guard without granting the service role direct access
-- to the private email-send reservation ledger.

ALTER FUNCTION public.guard_ma_interaction_opportunity_source_office()
  SECURITY DEFINER;
ALTER FUNCTION public.guard_ma_interaction_opportunity_source_office()
  SET search_path = '';

REVOKE ALL ON FUNCTION public.guard_ma_interaction_opportunity_source_office()
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.guard_ma_interaction_opportunity_source_office() IS
  'Trigger-only source-office guard. It runs as its database owner so staff intake can check the private send-reservation ledger without receiving direct ledger privileges.';
