-- Pin advisor-reported function resolution and remove browser RPC access to
-- trigger-only SECURITY DEFINER functions. Trigger invocation is unaffected;
-- the existing explicit service_role grants remain in place.

ALTER FUNCTION public.compute_journey_stage(integer, text) SET search_path TO public, pg_temp;
ALTER FUNCTION public.prevent_retained_opportunity_document_delete() SET search_path TO public, pg_temp;
ALTER FUNCTION public.reject_opportunity_pursuit_evidence_mutation() SET search_path TO public, pg_temp;
ALTER FUNCTION public.update_updated_at_column() SET search_path TO public, pg_temp;
ALTER FUNCTION public.reject_external_pursuit_audit_mutation() SET search_path TO public, pg_temp;
ALTER FUNCTION public.update_journey_stage_trigger() SET search_path TO public, pg_temp;
ALTER FUNCTION public.reject_external_pursuit_conversion_mutation() SET search_path TO public, pg_temp;
ALTER FUNCTION public.reject_opportunity_nda_artifact_mutation() SET search_path TO public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.assert_opportunity_nda_artifact_integrity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assert_opportunity_pursuit_evidence_integrity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_linked_nda_document_mutation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wave_journey_guard_opportunity_lifecycle() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wave_journey_guard_repreneur_artifact_origin() FROM PUBLIC, anon, authenticated;
