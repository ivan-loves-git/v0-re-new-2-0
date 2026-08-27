-- W-164/W-165 defense in depth: the release migrations already revoke direct
-- browser-role privileges and grant only service_role. RLS remains enabled on
-- every table in the exposed public schema as a second independent boundary.

ALTER TABLE public.w164_visibility_reconciliation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.w164_visibility_reconciliation_rollbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_upload_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_upload_cleanup_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_intake_upload_claims ENABLE ROW LEVEL SECURITY;
