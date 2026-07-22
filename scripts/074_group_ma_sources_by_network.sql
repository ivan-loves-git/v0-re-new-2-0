-- Migration: Group M&A firms by canonical intermediary network
-- Purpose: Let staff group the minority of related firms while preserving the
-- existing ungrouped firm list and staff-only confidentiality boundary.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ma_source_networks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  internal_notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (NULLIF(BTRIM(name), '') IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ma_source_networks_name
  ON public.ma_source_networks (LOWER(BTRIM(name)));

ALTER TABLE public.ma_sources
  ADD COLUMN IF NOT EXISTS network_id UUID REFERENCES public.ma_source_networks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ma_sources_network_id
  ON public.ma_sources(network_id, firm_name)
  WHERE network_id IS NOT NULL;

DROP TRIGGER IF EXISTS update_ma_source_networks_updated_at ON public.ma_source_networks;
CREATE TRIGGER update_ma_source_networks_updated_at
  BEFORE UPDATE ON public.ma_source_networks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ma_source_networks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ma_source_networks FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ma_source_networks TO service_role;

COMMENT ON TABLE public.ma_source_networks IS
  'Staff-only canonical intermediary networks used to visually group related M&A firms.';
COMMENT ON COLUMN public.ma_sources.network_id IS
  'Optional staff-only grouping. Most independent firms intentionally remain ungrouped.';

COMMIT;
