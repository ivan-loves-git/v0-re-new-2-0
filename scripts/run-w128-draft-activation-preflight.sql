-- W-128 Gate 2 preflight. Run only after migrations 112 and 115 are present.
-- This transaction is explicitly read-only: it creates no candidate manifest in
-- the database and does not call the apply function.
BEGIN READ ONLY;

WITH preflight AS (
  SELECT * FROM public.w128_draft_activation_preflight()
), eligible AS (
  SELECT * FROM preflight WHERE eligible ORDER BY ordinal
), manifest AS (
  SELECT
    COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT(
      'ordinal', ordinal,
      'id', id,
      'reference', reference,
      'updated_at', updated_at,
      'fingerprint', fingerprint
    ) ORDER BY ordinal), '[]'::JSONB) AS value,
    COALESCE(ENCODE(extensions.digest(CONVERT_TO(STRING_AGG(
      CONCAT_WS('|', ordinal, id, reference, TO_CHAR(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), fingerprint),
      E'\n' ORDER BY ordinal
    ), 'UTF8'), 'sha256'), 'hex'), ENCODE(extensions.digest(''::BYTEA, 'sha256'), 'hex')) AS digest
  FROM eligible
)
SELECT
  (SELECT COUNT(*) FROM eligible)::INTEGER AS eligible_count,
  (SELECT COUNT(*) FROM preflight WHERE NOT eligible)::INTEGER AS excluded_count,
  manifest.digest AS manifest_digest,
  manifest.value AS ordered_manifest,
  COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT(
    'ordinal', preflight.ordinal,
    'id', preflight.id,
    'reference', preflight.reference,
    'reasons', preflight.exclusion_reasons
  ) ORDER BY preflight.ordinal) FILTER (WHERE NOT preflight.eligible), '[]'::JSONB) AS excluded_with_reasons
FROM manifest
LEFT JOIN preflight ON TRUE
GROUP BY manifest.digest, manifest.value;

COMMIT;
