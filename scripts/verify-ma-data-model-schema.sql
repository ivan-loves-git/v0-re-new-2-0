-- Read-only verification for docs/data-models/ma-advisory-data-model-v1.md.
-- Run against production Supabase project iiuqcdnmxhtyispnykgf.

WITH target_tables(table_name) AS (
  VALUES
    ('ma_firms'),
    ('ma_offices'),
    ('ma_contacts'),
    ('ma_contact_office_affiliations'),
    ('ma_provisional_source_contexts'),
    ('ma_provisional_source_review_events'),
    ('ma_source_email_send_reservations'),
    ('ma_source_networks'),
    ('ma_sources'),
    ('ma_source_contacts'),
    ('ma_source_contact_moves'),
    ('ma_source_interactions'),
    ('ma_interactions'),
    ('ma_interaction_owner_verification_events'),
    ('ma_interaction_legacy_migration_manifest'),
    ('opportunities'),
    ('opportunity_source_contacts'),
    ('opportunity_ma_contacts'),
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

  UNION ALL

  SELECT
    'rls'::text AS evidence_type,
    relation.relname AS table_name,
    30000::bigint AS sort_order,
    relation.relname AS object_name,
    jsonb_build_object(
      'enabled', relation.relrowsecurity,
      'forced', relation.relforcerowsecurity
    ) AS details
  FROM pg_class relation
  JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
  JOIN target_tables t ON t.table_name = relation.relname
  WHERE namespace.nspname = 'public'
    AND relation.relkind IN ('r', 'p')

  UNION ALL

  SELECT
    'table_privilege'::text AS evidence_type,
    grants.table_name,
    31000::bigint AS sort_order,
    grants.grantee || ':' || grants.privilege_type AS object_name,
    jsonb_build_object('is_grantable', grants.is_grantable) AS details
  FROM information_schema.role_table_grants grants
  JOIN target_tables t ON t.table_name = grants.table_name
  WHERE grants.table_schema = 'public'
    AND grants.grantee IN ('anon', 'authenticated', 'service_role')

  UNION ALL

  SELECT
    'legacy_role_capability'::text AS evidence_type,
    relation.relname AS table_name,
    31500::bigint AS sort_order,
    'service_role'::text AS object_name,
    jsonb_build_object(
      'service_role_can_select',
        has_table_privilege(
          'service_role',
          format('%I.%I', namespace.nspname, relation.relname),
          'SELECT'
        ),
      'service_role_can_write',
        has_table_privilege(
          'service_role',
          format('%I.%I', namespace.nspname, relation.relname),
          'INSERT'
        )
        OR has_table_privilege(
          'service_role',
          format('%I.%I', namespace.nspname, relation.relname),
          'UPDATE'
        )
        OR has_table_privilege(
          'service_role',
          format('%I.%I', namespace.nspname, relation.relname),
          'DELETE'
        )
        OR has_table_privilege(
          'service_role',
          format('%I.%I', namespace.nspname, relation.relname),
          'TRUNCATE'
        )
        OR has_table_privilege(
          'service_role',
          format('%I.%I', namespace.nspname, relation.relname),
          'REFERENCES'
        )
        OR has_table_privilege(
          'service_role',
          format('%I.%I', namespace.nspname, relation.relname),
          'TRIGGER'
        ),
      'owner', owner.rolname,
      'service_role_inherits_owner',
        pg_has_role('service_role', owner.rolname, 'MEMBER')
    ) AS details
  FROM pg_class relation
  JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
  JOIN pg_roles owner ON owner.oid = relation.relowner
  WHERE namespace.nspname = 'public'
    AND relation.relname IN (
      'ma_sources',
      'ma_source_networks',
      'ma_source_contacts',
      'ma_source_contact_moves',
      'opportunity_source_contacts',
      'ma_source_interactions',
      'ma_interactions',
      'ma_interaction_owner_verification_events',
      'ma_interaction_legacy_migration_manifest'
    )
    AND relation.relkind IN ('r', 'p')

  UNION ALL

  SELECT
    'routine'::text AS evidence_type,
    'ma_office_foundation'::text AS table_name,
    32000::bigint AS sort_order,
    routine.proname || '(' || pg_get_function_identity_arguments(routine.oid) || ')' AS object_name,
    jsonb_build_object(
      'security_definer', routine.prosecdef,
      'acl', COALESCE(routine.proacl::text, '')
    ) AS details
  FROM pg_proc routine
  JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
  WHERE namespace.nspname = 'public'
    AND routine.proname IN (
      'create_ma_firm_with_default_office',
      'create_or_affiliate_ma_contact',
      'save_opportunity_office_context',
      'create_opportunity_with_office_context',
      'assert_opportunity_office_context',
      'assign_acme_provisional_source',
      'resolve_acme_provisional_source',
      'assert_ma_provisional_source_context_integrity',
      'assert_ma_provisional_source_review_state',
      'ma_opportunity_source_review_required',
      'reserve_ma_source_email_send',
      'release_ma_source_email_send',
      'refresh_ma_source_email_send',
      'verify_ma_interaction_owner',
      'activate_ma_cutover_run',
      'move_ma_source_contact'
    )

  UNION ALL

  SELECT
    'view'::text AS evidence_type,
    'staff_ma_office_intake_projection'::text AS table_name,
    33000::bigint AS sort_order,
    view_class.relname AS object_name,
    jsonb_build_object(
      'definition', pg_get_viewdef(view_class.oid, true),
      'reloptions', COALESCE(view_class.reloptions::text, '')
    ) AS details
  FROM pg_class view_class
  JOIN pg_namespace namespace ON namespace.oid = view_class.relnamespace
  WHERE namespace.nspname = 'public'
    AND view_class.relname = 'staff_ma_office_intake_projection'
)
SELECT evidence_type, table_name, object_name, details
FROM schema_evidence
ORDER BY table_name, sort_order, object_name;
