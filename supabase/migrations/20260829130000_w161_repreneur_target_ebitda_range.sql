-- W-161 / governance ticket #12: optional absolute EBITDA thesis range in kEUR.
-- Additive only: existing profiles retain NULL values and no default/backfill is applied.
ALTER TABLE public.repreneurs
  ADD COLUMN target_ebitda_min_keur NUMERIC(12,2),
  ADD COLUMN target_ebitda_max_keur NUMERIC(12,2),
  ADD CONSTRAINT repreneurs_target_ebitda_range_check CHECK (
    (target_ebitda_min_keur IS NULL OR (target_ebitda_min_keur::TEXT NOT IN ('NaN', 'Infinity', '-Infinity') AND target_ebitda_min_keur >= 0))
    AND (target_ebitda_max_keur IS NULL OR (target_ebitda_max_keur::TEXT NOT IN ('NaN', 'Infinity', '-Infinity') AND target_ebitda_max_keur >= 0))
    AND (target_ebitda_min_keur IS NULL OR target_ebitda_max_keur IS NULL OR target_ebitda_min_keur <= target_ebitda_max_keur)
  );
