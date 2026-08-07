-- Read-only verification for docs/data-models/ma-advisory-data-model-v1.md.
-- Run against production Supabase project iiuqcdnmxhtyispnykgf.

WITH target_tables(table_name) AS (
  VALUES
    ('ma_firms'),
    ('ma_offices'),
    ('ma_contacts'),
    ('ma_contact_office_affiliations'),
    ('ma_contact_email_policy_events'),
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
    ('ma_interaction_delivery_events'),
    ('ma_interaction_legacy_migration_manifest'),
    ('opportunities'),
    ('opportunity_source_contacts'),
    ('opportunity_ma_contacts'),
    ('opportunity_documents'),
    ('opportunity_nda_artifacts')
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
      'ma_interaction_delivery_events',
      'ma_interaction_legacy_migration_manifest',
      'ma_contact_email_policy_events',
      'opportunity_nda_artifacts'
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
      'ma_contact_email_is_allowed',
      'ma_contact_email_address_is_suppressed',
      'authorize_ma_contact_email_send',
      'set_ma_contact_campaign_email_suppression',
      'verify_ma_interaction_owner',
      'create_ma_relationship_interaction',
      'begin_ma_interaction_email_send',
      'finalize_ma_interaction_email_send',
      'activate_ma_cutover_run',
      'move_ma_source_contact',
      'register_opportunity_nda_artifact'
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

-- Aggregate-only W-062 release evidence. This proves the exact migrated
-- four-row manifest, provisional Bertrand ownership and effective role denial
-- without returning UUIDs, recipients, subjects or message bodies.
SELECT
  'w062_release_evidence'::TEXT AS evidence_type,
  JSONB_BUILD_OBJECT(
    'legacy_rows',
      (SELECT COUNT(*) FROM public.ma_source_interactions),
    'legacy_distinct_ids',
      (SELECT COUNT(DISTINCT id) FROM public.ma_source_interactions),
    'manifest_rows',
      (SELECT COUNT(*) FROM public.ma_interaction_legacy_migration_manifest),
    'manifest_digest_mismatches',
      (
        SELECT COUNT(*)
        FROM public.ma_interaction_legacy_migration_manifest
        WHERE legacy_evidence_digest <> canonical_evidence_digest
      ),
    'manifest_missing_canonical_uuid',
      (
        SELECT COUNT(*)
        FROM public.ma_interaction_legacy_migration_manifest manifest
        LEFT JOIN public.ma_interactions interaction
          ON interaction.id = manifest.legacy_interaction_id
        WHERE interaction.id IS NULL
      ),
    'migrated_provisional_bertrand_owner',
      (
        SELECT COUNT(*)
        FROM public.ma_interaction_legacy_migration_manifest manifest
        JOIN public.ma_interactions interaction
          ON interaction.id = manifest.legacy_interaction_id
        JOIN public.app_user_roles role
          ON role.user_id = interaction.owner_staff_user_id
        WHERE role.role = 'staff'
          AND LOWER(BTRIM(role.email)) = 'bertrand.galas@edu.escp.eu'
          AND interaction.owner_verification_state = 'provisional'
          AND interaction.owner_verified_by IS NULL
          AND interaction.owner_verified_at IS NULL
      ),
    'migrated_delivery_evidence',
      (
        SELECT COUNT(*)
        FROM public.ma_interaction_legacy_migration_manifest manifest
        JOIN public.ma_interactions interaction
          ON interaction.id = manifest.legacy_interaction_id
        WHERE interaction.delivery_status = 'sent'
          AND interaction.sent_at IS NOT NULL
          AND interaction.delivery_finalized_at = interaction.sent_at
          AND interaction.provider_idempotency_key = 'legacy:' || interaction.id::TEXT
          AND interaction.provider_message_id IS NULL
      ),
    'legacy_service_can_write',
      (
        has_table_privilege(
          'service_role',
          'public.ma_source_interactions',
          'INSERT,UPDATE,DELETE'
        )
      ),
    'canonical_service_can_write',
      (
        EXISTS (
          SELECT 1
          FROM (
            VALUES
              ('ma_interactions'),
              ('ma_interaction_owner_verification_events'),
              ('ma_interaction_delivery_events'),
              ('ma_interaction_legacy_migration_manifest')
          ) AS target(table_name)
          WHERE has_table_privilege(
            'service_role',
            'public.' || target.table_name,
            'INSERT,UPDATE,DELETE'
          )
        )
      ),
    'browser_interaction_access',
      (
        EXISTS (
          SELECT 1
          FROM (VALUES ('anon'), ('authenticated')) AS browser(role_name)
          CROSS JOIN (
            VALUES
              ('ma_source_interactions'),
              ('ma_interactions'),
              ('ma_interaction_owner_verification_events'),
              ('ma_interaction_delivery_events'),
              ('ma_interaction_legacy_migration_manifest')
          ) AS target(table_name)
          WHERE has_table_privilege(
            browser.role_name,
            'public.' || target.table_name,
            'SELECT,INSERT,UPDATE,DELETE'
          )
        )
      ),
    'service_can_verify_owner',
      has_function_privilege(
        'service_role',
        'public.verify_ma_interaction_owner(uuid,text)',
        'EXECUTE'
      ),
    'service_can_create_relationship_interaction',
      has_function_privilege(
        'service_role',
        'public.create_ma_relationship_interaction(uuid,uuid,uuid,text,text,timestamptz,text,text,text,text,timestamptz,text,text)',
        'EXECUTE'
      ),
    'service_can_begin',
      has_function_privilege(
        'service_role',
        'public.begin_ma_interaction_email_send(uuid,uuid,uuid,text,text,text,text,text,uuid,text,uuid)',
        'EXECUTE'
      ),
    'service_can_finalize',
      has_function_privilege(
        'service_role',
        'public.finalize_ma_interaction_email_send(uuid,text,text,text,text)',
        'EXECUTE'
      )
  ) AS details;

-- Aggregate-only W-043 release evidence. This deliberately returns no document
-- names, paths, URLs, people or opportunity identifiers.
SELECT
  'w043_release_evidence'::TEXT AS evidence_type,
  JSONB_BUILD_OBJECT(
    'artifact_rows',
      (SELECT COUNT(*) FROM public.opportunity_nda_artifacts),
    'scope_violations',
      (
        SELECT COUNT(*)
        FROM public.opportunity_nda_artifacts
        WHERE (artifact_role = 'blank_template' AND match_id IS NOT NULL)
          OR (
            artifact_role IN ('renew_signed_copy', 'repreneur_signed_copy')
            AND match_id IS NULL
          )
      ),
    'document_boundary_violations',
      (
        SELECT COUNT(*)
        FROM public.opportunity_nda_artifacts artifact
        JOIN public.opportunity_documents document
          ON document.id = artifact.document_id
        WHERE document.opportunity_id <> artifact.opportunity_id
          OR document.document_type <> 'nda'
          OR document.visibility <> 'staff_only'
          OR document.storage_path IS NULL
          OR document.external_url IS NOT NULL
          OR document.file_name IS NULL
          OR (
            artifact.artifact_role = 'blank_template'
            AND NOT (
              (LOWER(document.file_name) LIKE '%.pdf' AND document.mime_type = 'application/pdf')
              OR (
                LOWER(document.file_name) LIKE '%.docx'
                AND document.mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              )
            )
          )
          OR (
            artifact.artifact_role IN ('renew_signed_copy', 'repreneur_signed_copy')
            AND (
              LOWER(document.file_name) NOT LIKE '%.pdf'
              OR document.mime_type <> 'application/pdf'
            )
          )
          OR document.size_bytes IS NULL
          OR document.size_bytes <= 0
          OR document.storage_path NOT LIKE (
            artifact.opportunity_id::TEXT
            || '/nda-artifacts/'
            || artifact.artifact_role::TEXT
            || '/%'
          )
      ),
    'invalid_content_digests',
      (
        SELECT COUNT(*)
        FROM public.opportunity_nda_artifacts
        WHERE content_sha256 !~ '^[0-9a-f]{64}$'
      ),
    'reused_storage_paths',
      (
        SELECT COUNT(*)
        FROM (
          SELECT document.storage_bucket, document.storage_path
          FROM public.opportunity_nda_artifacts artifact
          JOIN public.opportunity_documents document
            ON document.id = artifact.document_id
          GROUP BY document.storage_bucket, document.storage_path
          HAVING COUNT(*) > 1
        ) duplicate_paths
      ),
    'pursuit_boundary_violations',
      (
        SELECT COUNT(*)
        FROM public.opportunity_nda_artifacts artifact
        JOIN public.opportunity_matches match
          ON match.id = artifact.match_id
        WHERE match.opportunity_id <> artifact.opportunity_id
      ),
    'version_chain_violations',
      (
        SELECT COUNT(*)
        FROM public.opportunity_nda_artifacts artifact
        LEFT JOIN public.opportunity_nda_artifacts prior
          ON prior.id = artifact.supersedes_artifact_id
        WHERE
          (
            artifact.version_number = 1
            AND artifact.supersedes_artifact_id IS NOT NULL
          )
          OR (
            artifact.version_number > 1
            AND (
              prior.id IS NULL
              OR prior.opportunity_id <> artifact.opportunity_id
              OR prior.match_id IS DISTINCT FROM artifact.match_id
              OR prior.artifact_role <> artifact.artifact_role
              OR prior.version_number <> artifact.version_number - 1
            )
          )
      ),
    'legacy_links_promoted',
      (
        SELECT COUNT(*)
        FROM public.opportunity_matches match
        JOIN public.opportunity_nda_artifacts artifact
          ON artifact.document_id = match.nda_document_id
      ),
    'browser_artifact_access',
      (
        EXISTS (
          SELECT 1
          FROM (VALUES ('anon'), ('authenticated')) AS browser(role_name)
          WHERE has_table_privilege(
            browser.role_name,
            'public.opportunity_nda_artifacts',
            'SELECT,INSERT,UPDATE,DELETE'
          )
        )
      ),
    'service_artifact_direct_write',
      has_table_privilege(
        'service_role',
        'public.opportunity_nda_artifacts',
        'INSERT,UPDATE,DELETE'
      ),
    'service_can_register_artifact',
      has_function_privilege(
        'service_role',
        'public.register_opportunity_nda_artifact(uuid,uuid,text,text,text,text,bigint,text,text)',
        'EXECUTE'
      )
  ) AS details;

-- Aggregate-only W-072 release evidence. This deliberately returns no contact
-- names, addresses, opportunity identifiers, policy reasons or message bodies.
SELECT
  'w072_release_evidence'::TEXT AS evidence_type,
  JSONB_BUILD_OBJECT(
    'structured_suppressed_contacts',
      (
        SELECT COUNT(*)
        FROM public.ma_contacts
        WHERE campaign_email_suppressed
      ),
    'structured_suppressed_without_reason',
      (
        SELECT COUNT(*)
        FROM public.ma_contacts
        WHERE campaign_email_suppressed
          AND NULLIF(BTRIM(campaign_email_suppression_reason), '') IS NULL
      ),
    'w010_warning_contacts',
      (
        SELECT COUNT(*)
        FROM public.ma_contacts
        WHERE created_by = 'Ivan Paudice via Codex W-010'
          AND internal_notes LIKE
            'Email suppressed in the W-010 source snapshot;%'
      ),
    'w010_warning_contacts_not_structured',
      (
        SELECT COUNT(*)
        FROM public.ma_contacts
        WHERE created_by = 'Ivan Paudice via Codex W-010'
          AND internal_notes LIKE
            'Email suppressed in the W-010 source snapshot;%'
          AND NOT campaign_email_suppressed
      ),
    'w010_backfill_events',
      (
        SELECT COUNT(*)
        FROM public.ma_contact_email_policy_events
        WHERE source_key = 'w010_import_backfill'
          AND event_type = 'suppression_enabled'
      ),
    'suppression_change_events',
      (
        SELECT COUNT(*)
        FROM public.ma_contact_email_policy_events
        WHERE event_type IN ('suppression_enabled', 'suppression_removed')
      ),
    'allowlisted_exception_events',
      (
        SELECT COUNT(*)
        FROM public.ma_contact_email_policy_events
        WHERE event_type = 'allowlisted_operational_send'
      ),
    'browser_policy_event_access',
      (
        EXISTS (
          SELECT 1
          FROM (VALUES ('anon'), ('authenticated')) AS browser(role_name)
          WHERE has_table_privilege(
            browser.role_name,
            'public.ma_contact_email_policy_events',
            'SELECT,INSERT,UPDATE,DELETE'
          )
        )
      ),
    'service_policy_event_direct_write',
      has_table_privilege(
        'service_role',
        'public.ma_contact_email_policy_events',
        'INSERT,UPDATE,DELETE'
      ),
    'service_can_check_audience',
      has_function_privilege(
        'service_role',
        'public.ma_contact_email_is_allowed(uuid,uuid,ma_contact_email_purpose)',
        'EXECUTE'
      ),
    'service_can_block_direct_address',
      has_function_privilege(
        'service_role',
        'public.ma_contact_email_address_is_suppressed(text)',
        'EXECUTE'
      ),
    'service_can_authorize_send',
      has_function_privilege(
        'service_role',
        'public.authorize_ma_contact_email_send(uuid,uuid,ma_contact_email_purpose,text,uuid)',
        'EXECUTE'
      ),
    'service_can_change_suppression',
      has_function_privilege(
        'service_role',
        'public.set_ma_contact_campaign_email_suppression(uuid,boolean,text,text)',
        'EXECUTE'
      )
  ) AS details;
