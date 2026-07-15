-- Repreneur portal self-service contributions are deliberately separate from
-- Re-New's staff-managed readiness milestones (`ms_*`).
ALTER TABLE public.repreneurs
  ADD COLUMN IF NOT EXISTS ldc_self_certified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS advisory_team_self_certified_at TIMESTAMPTZ;

COMMENT ON COLUMN public.repreneurs.ldc_self_certified_at IS
  'Timestamp when the repreneur last certified their Lettre de cadrage is current. This is not staff validation.';
COMMENT ON COLUMN public.repreneurs.advisory_team_self_certified_at IS
  'Timestamp when the repreneur declared their advisory team is in place. This is not a readiness-milestone validation.';
