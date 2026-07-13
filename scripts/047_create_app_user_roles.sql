-- Migration: explicit app-level roles for staff and external repreneur routing
-- Purpose: Keep internal staff dashboard routes separate from the external repreneur portal.

DO $$ BEGIN
  CREATE TYPE app_user_role AS ENUM ('staff', 'repreneur');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.app_user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE,
  email TEXT NOT NULL UNIQUE,
  role app_user_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.app_user_roles IS
  'App-level role routing for internal staff dashboard vs external repreneur portal.';
COMMENT ON COLUMN public.app_user_roles.role IS
  'staff users see the internal dashboard; repreneur users see the external portal.';

CREATE INDEX IF NOT EXISTS idx_app_user_roles_email ON public.app_user_roles(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_app_user_roles_role ON public.app_user_roles(role);

DROP TRIGGER IF EXISTS update_app_user_roles_updated_at ON public.app_user_roles;
CREATE TRIGGER update_app_user_roles_updated_at
  BEFORE UPDATE ON public.app_user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.app_user_roles ENABLE ROW LEVEL SECURITY;

-- Role assignments are managed through server-side staff-authorized actions.
-- No anon/authenticated policies are created here; service_role bypasses RLS.

INSERT INTO public.app_user_roles (user_id, email, role)
SELECT id, LOWER(email), 'staff'::app_user_role
FROM public."user"
WHERE LOWER(email) IN (
  'ivanpaudice@icloud.com',
  'bertrand.galas@edu.escp.eu',
  'contact@re-new.team',
  'renew@icpteam.eu'
)
ON CONFLICT (email) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  role = EXCLUDED.role,
  updated_at = NOW();
