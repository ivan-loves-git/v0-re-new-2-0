-- W-021 Gate 2 preflight. Read only; it never writes a candidate manifest.
BEGIN READ ONLY;
WITH eligible AS (SELECT * FROM public.w021_opportunity_publication_preflight() WHERE eligible ORDER BY ordinal),
manifest AS (
  SELECT COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT('ordinal',ordinal,'id',id,'reference',reference,'updated_at',updated_at,'fingerprint',fingerprint) ORDER BY ordinal),'[]'::JSONB) value FROM eligible
)
SELECT (SELECT COUNT(*)::INTEGER FROM eligible) AS eligible_count,
  public.w021_publication_manifest_digest(manifest.value) AS manifest_digest,
  manifest.value AS ordered_manifest
FROM manifest;
COMMIT;
