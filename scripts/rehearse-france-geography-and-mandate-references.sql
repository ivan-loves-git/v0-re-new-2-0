-- Disposable W-039/W-099 rehearsal. Run in a transaction after migration 092
-- against a Supabase-compatible database with the canonical office intake RPC.
BEGIN;

DO $$
DECLARE idf_region UUID := '00000000-0000-4092-8000-000000000201';
DECLARE idf_zone UUID := '00000000-0000-4092-8000-000000000101';
DECLARE france UUID := '00000000-0000-4092-8000-000000000001';
DECLARE before_reference TEXT;
DECLARE idf_expected BIGINT;
DECLARE idf_first TEXT;
DECLARE idf_second TEXT;
DECLARE idf_after_failure TEXT;
DECLARE france_reference TEXT;
BEGIN
  IF (SELECT COUNT(*) FROM public.geography_nodes WHERE id::TEXT LIKE '00000000-0000-4092-8000-%') <> 21 THEN
    RAISE EXCEPTION 'w039_rehearsal_seed_count';
  END IF;
  IF (SELECT COUNT(*) FROM public.geography_nodes WHERE code = 'IDF') <> 2 THEN
    RAISE EXCEPTION 'w039_rehearsal_duplicate_readable_code';
  END IF;
  IF (SELECT parent_id FROM public.geography_nodes WHERE id = idf_region) <> idf_zone THEN
    RAISE EXCEPTION 'w039_rehearsal_parent_identity';
  END IF;
  -- The counter has no historical state in a fresh migration.  Its first
  -- allocation must use the highest exact reference suffix, including an
  -- existing 999, rather than row count or a fuzzy string match.  This whole
  -- rehearsal rolls back, so it cannot consume a live number.
  DELETE FROM public.opportunity_mandate_reference_counters
    WHERE reference_code IN ('IDF', 'FR');
  INSERT INTO public.opportunities (reference, status, repreneur_exposure)
    VALUES ('Re-New - IDF - 999', 'draft', 'staff_only')
    ON CONFLICT (reference) DO NOTHING;
  SELECT COALESCE(MAX((regexp_match(reference, '^Re-New - IDF - ([0-9]+)$', 'i'))[1]::BIGINT), 0) + 1
    INTO idf_expected
    FROM public.opportunities
    WHERE reference ~* '^Re-New - IDF - [0-9]+$';
  SELECT reference INTO before_reference FROM public.opportunities WHERE reference = 'Re-New - IDF - 999';
  BEGIN
    UPDATE public.opportunities SET reference = 'Re-New - IDF - 1000' WHERE reference = before_reference;
    RAISE EXCEPTION 'w099_rehearsal_historical_reference_changed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%opportunity_reference_is_immutable%' THEN RAISE; END IF;
  END;
  SELECT reference INTO idf_first
  FROM public.create_opportunity_with_office_context(
    'forged caller reference', NULL, ARRAY[]::UUID[], NULL, NULL, 'draft',
    'w039-rehearsal', JSONB_BUILD_OBJECT('geography_node_id', idf_region::TEXT, 'public_title', 'Rehearsal only')
  );
  IF idf_first <> 'Re-New - IDF - 1000' THEN
    RAISE EXCEPTION 'w099_rehearsal_counter_initialization_failed';
  END IF;
  SELECT reference INTO idf_second
  FROM public.create_opportunity_with_office_context(
    'forged caller reference', NULL, ARRAY[]::UUID[], NULL, NULL, 'draft',
    'w039-rehearsal', JSONB_BUILD_OBJECT('geography_node_id', idf_region::TEXT, 'public_title', 'Rehearsal only')
  );
  IF idf_second <> 'Re-New - IDF - 1001' THEN
    RAISE EXCEPTION 'w099_rehearsal_counter_serial_allocation_failed';
  END IF;
  -- A rejected lifecycle transition happens after allocation in the same RPC;
  -- the exception subtransaction must roll its counter increment back.
  BEGIN
    PERFORM public.create_opportunity_with_office_context(
      'forged caller reference', NULL, ARRAY[]::UUID[], NULL, NULL, 'closed',
      'w039-rehearsal', JSONB_BUILD_OBJECT('geography_node_id', idf_region::TEXT, 'public_title', 'Rehearsal only')
    );
    RAISE EXCEPTION 'w099_rehearsal_failed_creation_was_accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%opportunity_office_context_supports_draft_active_or_paused_only%' THEN RAISE; END IF;
  END;
  SELECT reference INTO idf_after_failure
  FROM public.create_opportunity_with_office_context(
    'forged caller reference', NULL, ARRAY[]::UUID[], NULL, NULL, 'draft',
    'w039-rehearsal', JSONB_BUILD_OBJECT('geography_node_id', idf_region::TEXT, 'public_title', 'Rehearsal only')
  );
  IF idf_after_failure <> 'Re-New - IDF - 1002' THEN
    RAISE EXCEPTION 'w099_rehearsal_failed_creation_consumed_a_number';
  END IF;
  SELECT reference INTO france_reference
  FROM public.create_opportunity_with_office_context(
    'forged caller reference', NULL, ARRAY[]::UUID[], NULL, NULL, 'draft',
    'w039-rehearsal', JSONB_BUILD_OBJECT('geography_node_id', france::TEXT, 'public_title', 'Rehearsal only')
  );
  IF france_reference !~ '^Re-New - FR - [0-9]+$' OR france_reference = idf_first THEN
    RAISE EXCEPTION 'w099_rehearsal_reference_codes_not_independent';
  END IF;
  -- Direct table mutation and browser roles stay denied; only the controlled
  -- services are executable by service_role in the real release verification.
  IF has_table_privilege('authenticated', 'public.opportunity_mandate_reference_counters', 'INSERT')
    OR has_table_privilege('authenticated', 'public.geography_nodes', 'SELECT') THEN
    RAISE EXCEPTION 'w039_rehearsal_browser_privilege_exposed';
  END IF;
END $$;

ROLLBACK;
