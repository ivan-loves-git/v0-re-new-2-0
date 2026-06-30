ALTER TABLE public.repreneurs
  ADD COLUMN IF NOT EXISTS target_revenue_min_meur NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS target_revenue_max_meur NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS target_ebitda_margin_min_pct NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS target_ebitda_margin_max_pct NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS target_staff_size_min INTEGER,
  ADD COLUMN IF NOT EXISTS target_staff_size_max INTEGER;

COMMENT ON COLUMN public.repreneurs.target_revenue_min_meur IS
  'Optional repreneur target acquisition revenue minimum in MEUR, used for opportunity matching only.';
COMMENT ON COLUMN public.repreneurs.target_revenue_max_meur IS
  'Optional repreneur target acquisition revenue maximum in MEUR, used for opportunity matching only.';
COMMENT ON COLUMN public.repreneurs.target_ebitda_margin_min_pct IS
  'Optional repreneur target EBITDA margin minimum percentage, used for opportunity matching only.';
COMMENT ON COLUMN public.repreneurs.target_ebitda_margin_max_pct IS
  'Optional repreneur target EBITDA margin maximum percentage, used for opportunity matching only.';
COMMENT ON COLUMN public.repreneurs.target_staff_size_min IS
  'Optional repreneur target staff size minimum, used for opportunity matching only.';
COMMENT ON COLUMN public.repreneurs.target_staff_size_max IS
  'Optional repreneur target staff size maximum, used for opportunity matching only.';
