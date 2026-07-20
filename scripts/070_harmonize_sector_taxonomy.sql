-- Harmonize persisted sector values with the 16-value product taxonomy.
--
-- Safety contract:
--   * creates a durable before-image for every changed field;
--   * expands broad repreneur preferences (Services/Sante) to both successors;
--   * never guesses a single sector for ambiguous opportunity records;
--   * can be rerun safely; canonical values remain unchanged.
--
-- Rollback example (run only after reviewing the backup rows):
--   UPDATE public.opportunities o
--   SET sector = b.original_value #>> '{}'
--   FROM public.sector_taxonomy_legacy_20260720 b
--   WHERE b.entity_type = 'opportunity'
--     AND b.field_name = 'sector'
--     AND b.record_id = o.id;
--
--   UPDATE public.repreneurs r
--   SET q13_target_sectors_v2 = b.original_value
--   FROM public.sector_taxonomy_legacy_20260720 b
--   WHERE b.entity_type = 'repreneur'
--     AND b.field_name = 'q13_target_sectors_v2'
--     AND b.record_id = r.id;
--
--   UPDATE public.repreneurs r
--   SET sector_preferences = ARRAY(
--     SELECT jsonb_array_elements_text(b.original_value)
--   )
--   FROM public.sector_taxonomy_legacy_20260720 b
--   WHERE b.entity_type = 'repreneur'
--     AND b.field_name = 'sector_preferences'
--     AND b.record_id = r.id;

BEGIN;

CREATE TABLE IF NOT EXISTS public.sector_taxonomy_legacy_20260720 (
  entity_type TEXT NOT NULL,
  record_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  original_value JSONB NOT NULL,
  backed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (entity_type, record_id, field_name)
);

COMMENT ON TABLE public.sector_taxonomy_legacy_20260720 IS
  'Rollback before-images for the 2026-07-20 sector taxonomy harmonization.';

ALTER TABLE public.sector_taxonomy_legacy_20260720 ENABLE ROW LEVEL SECURITY;

INSERT INTO public.sector_taxonomy_legacy_20260720 (
  entity_type,
  record_id,
  field_name,
  original_value
)
SELECT 'opportunity', id, 'sector', to_jsonb(sector)
FROM public.opportunities
WHERE sector IN (
  'Industrie',
  'Automobile',
  'Luxe & Mode',
  'Commerce / Distribution',
  'BTP / Construction',
  'Tech / Digital',
  'Environnement',
  'Hôtellerie / Restauration',
  'Transport / Logistique',
  'Autre'
)
ON CONFLICT DO NOTHING;

UPDATE public.opportunities
SET sector = CASE sector
  WHEN 'Industrie' THEN 'Industrie manufacturière'
  WHEN 'Automobile' THEN 'Automobile & Mobilité'
  WHEN 'Luxe & Mode' THEN 'Textile, Luxe & Mode'
  WHEN 'Commerce / Distribution' THEN 'Commerce, Négoce & Distribution'
  WHEN 'BTP / Construction' THEN 'BTP & Construction'
  WHEN 'Tech / Digital' THEN 'Tech & Digital'
  WHEN 'Environnement' THEN 'Environnement & Énergie'
  WHEN 'Hôtellerie / Restauration' THEN 'Hôtellerie, Restauration & Loisirs'
  WHEN 'Transport / Logistique' THEN 'Transport & Logistique'
  WHEN 'Autre' THEN 'Autre'
  ELSE sector
END
WHERE sector IN (
  'Industrie',
  'Automobile',
  'Luxe & Mode',
  'Commerce / Distribution',
  'BTP / Construction',
  'Tech / Digital',
  'Environnement',
  'Hôtellerie / Restauration',
  'Transport / Logistique',
  'Autre'
);

INSERT INTO public.sector_taxonomy_legacy_20260720 (
  entity_type,
  record_id,
  field_name,
  original_value
)
SELECT 'repreneur', id, 'q13_target_sectors_v2', q13_target_sectors_v2
FROM public.repreneurs
WHERE q13_target_sectors_v2 ?| ARRAY[
  'industry', 'healthcare', 'automobile', 'retail', 'construction',
  'services', 'tech', 'environment', 'hospitality', 'transport', 'other'
]
ON CONFLICT DO NOTHING;

UPDATE public.repreneurs r
SET q13_target_sectors_v2 = (
  SELECT jsonb_agg(value ORDER BY first_position) AS values
  FROM (
    SELECT value, MIN(position) AS first_position
    FROM (
      SELECT mapped.value, source.position
      FROM jsonb_array_elements_text(r.q13_target_sectors_v2)
        WITH ORDINALITY AS source(value, position)
      CROSS JOIN LATERAL (
        SELECT value
        FROM (VALUES
          ('industry', 'Industrie manufacturière'),
          ('healthcare', 'Industrie pharmaceutique & Dispositifs médicaux'),
          ('healthcare', 'Services de santé'),
          ('automobile', 'Automobile & Mobilité'),
          ('retail', 'Commerce, Négoce & Distribution'),
          ('construction', 'BTP & Construction'),
          ('services', 'Services aux entreprises (B2B)'),
          ('services', 'Services aux particuliers (B2C)'),
          ('tech', 'Tech & Digital'),
          ('environment', 'Environnement & Énergie'),
          ('hospitality', 'Hôtellerie, Restauration & Loisirs'),
          ('transport', 'Transport & Logistique'),
          ('other', 'Autre')
        ) AS compatibility(old_value, value)
        WHERE compatibility.old_value = source.value
        UNION ALL
        SELECT source.value
        WHERE NOT EXISTS (
          SELECT 1
          FROM (VALUES
            ('industry'), ('healthcare'), ('automobile'), ('retail'),
            ('construction'), ('services'), ('tech'), ('environment'),
            ('hospitality'), ('transport'), ('other')
          ) AS known(old_value)
          WHERE known.old_value = source.value
        )
      ) mapped
    ) expanded
    GROUP BY value
  ) deduplicated
)
WHERE r.q13_target_sectors_v2 ?| ARRAY[
  'industry', 'healthcare', 'automobile', 'retail', 'construction',
  'services', 'tech', 'environment', 'hospitality', 'transport', 'other'
];

INSERT INTO public.sector_taxonomy_legacy_20260720 (
  entity_type,
  record_id,
  field_name,
  original_value
)
SELECT 'repreneur', id, 'sector_preferences', to_jsonb(sector_preferences)
FROM public.repreneurs
WHERE sector_preferences && ARRAY[
  'industry', 'healthcare', 'automobile', 'retail', 'construction',
  'services', 'tech', 'environment', 'hospitality', 'transport', 'other'
]::TEXT[]
ON CONFLICT DO NOTHING;

UPDATE public.repreneurs r
SET sector_preferences = (
  SELECT array_agg(value ORDER BY first_position) AS values
  FROM (
    SELECT value, MIN(position) AS first_position
    FROM (
      SELECT mapped.value, source.position
      FROM unnest(r.sector_preferences) WITH ORDINALITY AS source(value, position)
      CROSS JOIN LATERAL (
        SELECT value
        FROM (VALUES
          ('industry', 'Industrie manufacturière'),
          ('healthcare', 'Industrie pharmaceutique & Dispositifs médicaux'),
          ('healthcare', 'Services de santé'),
          ('automobile', 'Automobile & Mobilité'),
          ('retail', 'Commerce, Négoce & Distribution'),
          ('construction', 'BTP & Construction'),
          ('services', 'Services aux entreprises (B2B)'),
          ('services', 'Services aux particuliers (B2C)'),
          ('tech', 'Tech & Digital'),
          ('environment', 'Environnement & Énergie'),
          ('hospitality', 'Hôtellerie, Restauration & Loisirs'),
          ('transport', 'Transport & Logistique'),
          ('other', 'Autre')
        ) AS compatibility(old_value, value)
        WHERE compatibility.old_value = source.value
        UNION ALL
        SELECT source.value
        WHERE NOT EXISTS (
          SELECT 1
          FROM (VALUES
            ('industry'), ('healthcare'), ('automobile'), ('retail'),
            ('construction'), ('services'), ('tech'), ('environment'),
            ('hospitality'), ('transport'), ('other')
          ) AS known(old_value)
          WHERE known.old_value = source.value
        )
      ) mapped
    ) expanded
    GROUP BY value
  ) deduplicated
)
WHERE r.sector_preferences && ARRAY[
  'industry', 'healthcare', 'automobile', 'retail', 'construction',
  'services', 'tech', 'environment', 'hospitality', 'transport', 'other'
]::TEXT[];

COMMIT;
