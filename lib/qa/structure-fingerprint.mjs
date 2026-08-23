import { createHash } from "node:crypto"

export const STRUCTURE_FINGERPRINT_SQL = `
WITH fingerprint_settings AS MATERIALIZED (
  SELECT set_config('search_path', 'pg_catalog, public, qa_control, extensions', true) AS search_path
),
inventory AS (
  SELECT 'column' AS kind,
         format('%I.%I.%s:%I', n.nspname, c.relname, a.attnum, a.attname) AS identity,
         concat_ws('|', format_type(a.atttypid, a.atttypmod), a.attnotnull::text,
           coalesce(pg_get_expr(ad.adbin, ad.adrelid), '')) AS definition
  FROM fingerprint_settings
  CROSS JOIN pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
  WHERE n.nspname IN ('public','qa_control') AND c.relkind IN ('r','p','v','m','S') AND a.attnum > 0 AND NOT a.attisdropped
  UNION ALL
  SELECT 'relation', format('%I.%I', n.nspname, c.relname),
         concat_ws('|', c.relkind::text, c.relrowsecurity::text, c.relforcerowsecurity::text,
           CASE WHEN c.relacl IS NULL THEN 'null' ELSE
             coalesce((SELECT jsonb_agg(acl::text ORDER BY acl::text COLLATE "C")::text FROM unnest(c.relacl) AS acl), '[]') END)
  FROM fingerprint_settings
  CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public','qa_control') AND c.relkind IN ('r','p','v','m','S')
  UNION ALL
  SELECT 'constraint', format('%I.%I:%I', n.nspname, c.relname, con.conname), pg_get_constraintdef(con.oid, true)
  FROM fingerprint_settings
  CROSS JOIN pg_constraint con JOIN pg_class c ON c.oid = con.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public','qa_control')
  UNION ALL
  SELECT 'index', format('%I.%I', n.nspname, c.relname), pg_get_indexdef(c.oid)
  FROM fingerprint_settings
  CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public','qa_control') AND c.relkind = 'i'
  UNION ALL
  SELECT 'function', format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)),
         pg_get_functiondef(p.oid) || '|' ||
           CASE WHEN p.proacl IS NULL THEN 'null' ELSE
             coalesce((SELECT jsonb_agg(acl::text ORDER BY acl::text COLLATE "C")::text FROM unnest(p.proacl) AS acl), '[]') END
  FROM fingerprint_settings
  CROSS JOIN pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname IN ('public','qa_control')
  UNION ALL
  SELECT 'trigger', format('%I.%I:%I', n.nspname, c.relname, t.tgname), pg_get_triggerdef(t.oid, true)
  FROM fingerprint_settings
  CROSS JOIN pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public','qa_control') AND NOT t.tgisinternal
  UNION ALL
  SELECT 'policy', format('%I.%I:%I', schemaname, tablename, policyname),
         concat_ws('|', permissive,
           CASE WHEN roles IS NULL THEN 'null' ELSE
             coalesce((SELECT jsonb_agg(role_name::text ORDER BY role_name::text COLLATE "C")::text FROM unnest(roles) AS role_name), '[]') END,
           cmd, coalesce(qual, ''), coalesce(with_check, ''))
  FROM fingerprint_settings
  CROSS JOIN pg_policies WHERE schemaname IN ('public','qa_control')
  UNION ALL
  SELECT 'type', format('%I.%I', n.nspname, t.typname),
         concat_ws('|', t.typtype::text, t.typcategory::text,
           coalesce((SELECT string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid = t.oid), ''))
  FROM fingerprint_settings
  CROSS JOIN pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname IN ('public','qa_control') AND t.typrelid = 0 AND t.typname NOT LIKE '\\_%'
  UNION ALL
  SELECT 'view', format('%I.%I', n.nspname, c.relname), pg_get_viewdef(c.oid, true)
  FROM fingerprint_settings
  CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public','qa_control') AND c.relkind IN ('v','m')
  UNION ALL
  SELECT 'extension', e.extname, n.nspname
  FROM fingerprint_settings
  CROSS JOIN pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname IN ('pgcrypto','uuid-ossp')
)
SELECT kind, identity, definition FROM inventory ORDER BY kind, identity, definition
`

export function deterministicStringCompare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

export function fingerprintStructureRows(rows) {
  const canonical = rows
    .map(({ kind, identity, definition }) => ({ kind: String(kind), identity: String(identity), definition: String(definition ?? "") }))
    .sort((a, b) =>
      deterministicStringCompare(a.kind, b.kind) ||
      deterministicStringCompare(a.identity, b.identity) ||
      deterministicStringCompare(a.definition, b.definition),
    )
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex")
}

export function assertMatchingStructureFingerprint(expectedStructureFingerprint, actualStructureFingerprint, report = console.error) {
  if (actualStructureFingerprint === expectedStructureFingerprint) return
  if (/^[0-9a-f]{64}$/.test(expectedStructureFingerprint) && /^[0-9a-f]{64}$/.test(actualStructureFingerprint)) {
    report(JSON.stringify({ expectedStructureFingerprint, actualStructureFingerprint }))
  }
  throw new Error("Live QA evidence failed: structure-fingerprint")
}

export async function computeLiveStructureFingerprint(database) {
  const result = await database.query(STRUCTURE_FINGERPRINT_SQL)
  return fingerprintStructureRows(result.rows)
}
