-- Security hardening: keep CRM data and application roles behind the server-side
-- service-role boundary. The Next.js application uses createAdminClient for all
-- reads and writes, so browser API roles do not need direct table policies.

ALTER TABLE public.repreneurs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read repreneurs" ON public.repreneurs;
DROP POLICY IF EXISTS "Allow authenticated users to update repreneurs" ON public.repreneurs;
DROP POLICY IF EXISTS "Allow authenticated users to insert repreneurs" ON public.repreneurs;
DROP POLICY IF EXISTS "Allow public to insert repreneurs" ON public.repreneurs;
DROP POLICY IF EXISTS "Users can view own repreneurs" ON public.repreneurs;
-- These legacy names are present in some deployed databases.
DROP POLICY IF EXISTS "Authenticated users can insert repreneurs" ON public.repreneurs;
DROP POLICY IF EXISTS "Authenticated users can view all repreneurs" ON public.repreneurs;
DROP POLICY IF EXISTS "authenticated_read_all" ON public.repreneurs;

ALTER TABLE public.app_user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view app user roles" ON public.app_user_roles;
DROP POLICY IF EXISTS "Authenticated users can insert app user roles" ON public.app_user_roles;
DROP POLICY IF EXISTS "Authenticated users can update app user roles" ON public.app_user_roles;

COMMENT ON TABLE public.repreneurs IS
  'CRM repreneur records are accessed through server-side staff-authorized actions; browser API roles have no direct policies.';

COMMENT ON TABLE public.app_user_roles IS
  'Application role assignments are managed by server-side staff-authorized actions; browser API roles have no direct policies.';
