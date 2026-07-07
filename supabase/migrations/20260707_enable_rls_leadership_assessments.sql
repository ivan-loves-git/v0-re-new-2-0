-- Security fix: Supabase Advisor rls_disabled_in_public / sensitive_columns_exposed
-- Project: supabase-RN-2-0 (iiuqcdnmxhtyispnykgf)
--
-- leadership_assessments contains tokenized public-form links and assessment answers.
-- The Next.js app reads/writes it only through server-side service-role clients, so anon/authenticated
-- API roles should not receive direct PostgREST access. Enabling RLS with no anon/auth policies keeps
-- service_role operational while blocking public table access.

ALTER TABLE public.leadership_assessments ENABLE ROW LEVEL SECURITY;

-- Keep the surface explicitly closed for browser API roles. Supabase service_role still bypasses RLS.
DROP POLICY IF EXISTS "anon can read leadership assessments" ON public.leadership_assessments;
DROP POLICY IF EXISTS "anon can insert leadership assessments" ON public.leadership_assessments;
DROP POLICY IF EXISTS "anon can update leadership assessments" ON public.leadership_assessments;
DROP POLICY IF EXISTS "authenticated can read leadership assessments" ON public.leadership_assessments;
DROP POLICY IF EXISTS "authenticated can insert leadership assessments" ON public.leadership_assessments;
DROP POLICY IF EXISTS "authenticated can update leadership assessments" ON public.leadership_assessments;
DROP POLICY IF EXISTS "authenticated can delete leadership assessments" ON public.leadership_assessments;

COMMENT ON TABLE public.leadership_assessments IS
  'Leadership potential assessment: 26 questions across 3 blocks. RLS enabled; public form access is mediated by server-side service-role actions, not direct API access.';
