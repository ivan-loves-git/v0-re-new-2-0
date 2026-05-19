-- Strengthen repreneur portal access linkage.
-- Portal access is now staff-controlled through app_user_roles and tied to a
-- concrete repreneur record instead of relying only on email matching.

ALTER TABLE public.app_user_roles
  ADD COLUMN IF NOT EXISTS repreneur_id UUID REFERENCES public.repreneurs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS access_enabled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_access_email_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.app_user_roles.repreneur_id IS
  'Linked repreneur profile for external portal access. Required for repreneur roles after the portal access hardening.';
COMMENT ON COLUMN public.app_user_roles.access_enabled_at IS
  'Timestamp when staff enabled or re-enabled portal access for this role.';
COMMENT ON COLUMN public.app_user_roles.last_access_email_sent_at IS
  'Timestamp when staff last sent a portal access or password setup email.';

UPDATE public.app_user_roles aur
SET
  repreneur_id = r.id,
  access_enabled_at = COALESCE(aur.access_enabled_at, aur.created_at),
  updated_at = NOW()
FROM public.repreneurs r
WHERE aur.role = 'repreneur'
  AND aur.repreneur_id IS NULL
  AND LOWER(aur.email) = LOWER(r.email);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_user_roles_repreneur_role_unique
  ON public.app_user_roles(repreneur_id)
  WHERE role = 'repreneur' AND repreneur_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_app_user_roles_repreneur_id
  ON public.app_user_roles(repreneur_id);
