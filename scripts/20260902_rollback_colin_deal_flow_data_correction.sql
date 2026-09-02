-- Rollback companion for 20260902_apply_colin_deal_flow_data_correction.sql.
-- It is intentionally fail-closed: it restores only the 131 retained before-images
-- when every target row still carries this operator's audit actor. A later staff
-- edit therefore blocks rollback instead of being overwritten.
-- Preview: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/20260902_rollback_colin_deal_flow_data_correction.sql
-- Roll back: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "SET renew.colin_data_correction_rollback = '2026-09-02-rollback'" -f scripts/20260902_rollback_colin_deal_flow_data_correction.sql

BEGIN;
DO $$
DECLARE
  rollback_now BOOLEAN := COALESCE(current_setting('renew.colin_data_correction_rollback', true), '') = '2026-09-02-rollback';
  retained_rows INTEGER;
  mutable_rows INTEGER;
  source_marker_rows INTEGER;
BEGIN
  SELECT COUNT(*) INTO retained_rows
  FROM public.sector_taxonomy_legacy_20260720
  WHERE entity_type = 'opportunity' AND field_name = 'colin_20260902_data_correction';
  IF retained_rows <> 131 THEN
    RAISE EXCEPTION 'colin_data_correction_rollback_before_images_mismatch:%', retained_rows;
  END IF;

  SELECT COUNT(*) INTO mutable_rows
  FROM public.sector_taxonomy_legacy_20260720 backup
  JOIN public.opportunities opportunity ON opportunity.id = backup.record_id
  WHERE backup.entity_type = 'opportunity'
    AND backup.field_name = 'colin_20260902_data_correction'
    AND opportunity.updated_by = 'Codex: Colin Deal Flow correction 2026-09-02';
  IF mutable_rows <> retained_rows THEN
    RAISE EXCEPTION 'colin_data_correction_rollback_blocked_by_later_edit:eligible=% expected=%', mutable_rows, retained_rows;
  END IF;

  SELECT COUNT(*) INTO source_marker_rows
  FROM public.opportunities
  WHERE reference IN ('Re-New - AU - 001','Re-New - Idf - 001','Re-New - PA - 005')
    AND source_identity_to_verify = TRUE
    AND updated_by = 'Codex: Colin Deal Flow correction 2026-09-02';
  IF source_marker_rows <> 3 THEN
    RAISE EXCEPTION 'colin_data_correction_rollback_source_marker_state_mismatch:%', source_marker_rows;
  END IF;

  IF NOT rollback_now THEN
    RAISE NOTICE 'Colin correction rollback preflight passed; no mutation requested.';
    RETURN;
  END IF;

  UPDATE public.opportunities opportunity
  SET sector = backup.original_value ->> 'sector',
      location = backup.original_value ->> 'location',
      geography_node_id = NULLIF(backup.original_value ->> 'geography_node_id', '')::UUID,
      source_identity_to_verify = COALESCE((backup.original_value ->> 'source_identity_to_verify')::BOOLEAN, FALSE),
      updated_by = 'Codex: Colin Deal Flow correction rollback 2026-09-02',
      updated_at = NOW()
  FROM public.sector_taxonomy_legacy_20260720 backup
  WHERE backup.entity_type = 'opportunity'
    AND backup.field_name = 'colin_20260902_data_correction'
    AND backup.record_id = opportunity.id;

  IF (SELECT COUNT(*) FROM public.opportunities WHERE updated_by = 'Codex: Colin Deal Flow correction rollback 2026-09-02') < retained_rows THEN
    RAISE EXCEPTION 'colin_data_correction_rollback_postflight_failed';
  END IF;
END $$;
COMMIT;
