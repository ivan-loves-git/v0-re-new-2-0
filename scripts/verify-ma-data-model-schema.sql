-- Read-only verification for docs/data-models/ma-advisory-data-model-v1.md.
-- Run against production Supabase project iiuqcdnmxhtyispnykgf.

WITH target_tables(table_name) AS (
  VALUES
    ('ma_source_networks'),
    ('ma_sources'),
    ('ma_source_contacts'),
    ('ma_source_contact_moves'),
    ('ma_source_interactions'),
    ('opportunities'),
    ('opportunity_source_contacts'),
    ('opportunity_documents')
),
schema_evidence AS (
  SELECT
    'column'::text AS evidence_type,
    c.table_name,
    c.ordinal_position::bigint AS sort_order,
    c.column_name AS object_name,
    jsonb_build_object(
      'data_type', c.data_type,
      'is_nullable', c.is_nullable,
      'column_default', c.column_default
    ) AS details
  FROM information_schema.columns c
  JOIN target_tables t ON t.table_name = c.table_name
  WHERE c.table_schema = 'public'

  UNION ALL

  SELECT
    'constraint'::text AS evidence_type,
    table_class.relname AS table_name,
    10000::bigint AS sort_order,
    constraint_record.conname AS object_name,
    jsonb_build_object(
      'constraint_type', constraint_record.contype,
      'definition', pg_get_constraintdef(constraint_record.oid, true)
    ) AS details
  FROM pg_constraint constraint_record
  JOIN pg_class table_class ON table_class.oid = constraint_record.conrelid
  JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
  JOIN target_tables t ON t.table_name = table_class.relname
  WHERE table_namespace.nspname = 'public'

  UNION ALL

  SELECT
    'index'::text AS evidence_type,
    indexes.tablename AS table_name,
    20000::bigint AS sort_order,
    indexes.indexname AS object_name,
    jsonb_build_object('definition', indexes.indexdef) AS details
  FROM pg_indexes indexes
  JOIN target_tables t ON t.table_name = indexes.tablename
  WHERE indexes.schemaname = 'public'
)
SELECT evidence_type, table_name, object_name, details
FROM schema_evidence
ORDER BY table_name, sort_order, object_name;
