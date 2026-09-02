-- Approved Colin Deal Flow data correction. This guarded operator does no
-- work unless renew.colin_data_correction_apply is exactly 2026-09-02-apply.
-- Preflight: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/20260902_apply_colin_deal_flow_data_correction.sql
-- Apply: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "SET renew.colin_data_correction_apply = '2026-09-02-apply'" -f scripts/20260902_apply_colin_deal_flow_data_correction.sql
--
-- The fixed 130-row manifest was classified activity-first. Explicit fallback:
-- Services aux entreprises->B2B; Industrie & Construction->Manufacturing;
-- Voyages & loisirs->Hospitality; Produits de consommation et services->Commerce;
-- Utilitaires->Autre; Energie->Environment; Construction finishing & installations->BTP;
-- INDUSTRIE-MANUFACTURIERE->Manufacturing; Vente au détail->Commerce; Technologie->Tech;
-- EDUCATION-FORMATION->B2B; Santé->Services de santé; Commerce->Commerce;
-- SERVICES-ENTREPRISES->B2B; Automobile et pièces détachées->Automobile;
-- Aménagement paysager->B2B; Peintures & revêtements->Manufacturing.
-- The exact resolved manifest below, not a new runtime heuristic, is authoritative.
-- Before-images live in the existing RLS-protected sector_taxonomy_legacy_20260720
-- ledger. The three review markers target public-safe opportunity references;
-- their source-chain identity is separately preflighted in private operations
-- evidence and is never committed here or mutated by this operator.

BEGIN;
CREATE TEMP TABLE colin_sector_manifest (reference TEXT PRIMARY KEY, target_sector TEXT NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE colin_source_marker_manifest (reference TEXT PRIMARY KEY, identity_fingerprint TEXT NOT NULL) ON COMMIT DROP;
INSERT INTO colin_source_marker_manifest(reference, identity_fingerprint) VALUES
  ('Re-New - AU - 001', '828ef4aa234481d2df8b91a48ecc4226becb3150a4b0e7ac1c2f455dc2c9987f'),
  ('Re-New - Idf - 001', 'a2bcfe023bc481bb06206bb179a22bc0807e602f95d3476310a772081916515d'),
  ('Re-New - PA - 005', '1a9e1708f572be930d5c42db3e71ab7dec8c7191edf7e088c19ce3a767f4b2e3');
INSERT INTO colin_sector_manifest(reference, target_sector) VALUES
  ('Re-New - AU - 002', 'Services aux entreprises (B2B)'),
  ('Re-New - AU - 003', 'Services aux entreprises (B2B)'),
  ('Re-New - AU - 006', 'Services aux entreprises (B2B)'),
  ('Re-New - AU - 008', 'Services aux entreprises (B2B)'),
  ('Re-New - AU - 013', 'Services aux entreprises (B2B)'),
  ('Re-New - AU - 019', 'Services aux entreprises (B2B)'),
  ('Re-New - GO - 001', 'Services aux entreprises (B2B)'),
  ('Re-New - GO - 005', 'Services aux entreprises (B2B)'),
  ('Re-New - GO - 015', 'Services aux entreprises (B2B)'),
  ('Re-New - GO - 016', 'Services aux entreprises (B2B)'),
  ('Re-New - HDF - 006', 'Services aux entreprises (B2B)'),
  ('Re-New - HDF - 010', 'Services aux entreprises (B2B)'),
  ('Re-New - HDF - 011', 'Services aux entreprises (B2B)'),
  ('Re-New - Idf - 012', 'Services aux entreprises (B2B)'),
  ('Re-New - Idf - 014', 'Services aux entreprises (B2B)'),
  ('Re-New - Idf - 020', 'Services aux entreprises (B2B)'),
  ('Re-New - Idf - 023', 'Services aux entreprises (B2B)'),
  ('Re-New - Idf - 026', 'Services aux entreprises (B2B)'),
  ('Re-New - Idf - 029', 'Services aux entreprises (B2B)'),
  ('Re-New - Idf - 030', 'Services aux entreprises (B2B)'),
  ('Re-New - Idf - 031', 'Services aux entreprises (B2B)'),
  ('Re-New - Idf - 034', 'Services aux entreprises (B2B)'),
  ('Re-New - Idf - 036', 'Services aux entreprises (B2B)'),
  ('Re-New - NA - 005', 'Services aux entreprises (B2B)'),
  ('Re-New - NA - 011', 'Services aux entreprises (B2B)'),
  ('Re-New - Oc - 001', 'Services aux entreprises (B2B)'),
  ('Re-New - Oc - 005', 'Services aux entreprises (B2B)'),
  ('Re-New - PA - 003', 'Services aux entreprises (B2B)'),
  ('Re-New - PA - 007', 'Services aux entreprises (B2B)'),
  ('Re-New - PA - 009', 'Services aux entreprises (B2B)'),
  ('Re-New - AU - 005', 'Hôtellerie, Restauration & Loisirs'),
  ('Re-New - AU - 023', 'Hôtellerie, Restauration & Loisirs'),
  ('Re-New - AU - 007', 'BTP & Construction'),
  ('Re-New - AU - 010', 'BTP & Construction'),
  ('Re-New - AU - 012', 'BTP & Construction'),
  ('Re-New - AU - 025', 'BTP & Construction'),
  ('Re-New - BFC - 004', 'BTP & Construction'),
  ('Re-New - Br - 001', 'BTP & Construction'),
  ('Re-New - CVL - 002', 'BTP & Construction'),
  ('Re-New - CVL - 003', 'BTP & Construction'),
  ('Re-New - GE - 002', 'BTP & Construction'),
  ('Re-New - GO - 010', 'BTP & Construction'),
  ('Re-New - GO - 014', 'BTP & Construction'),
  ('Re-New - GO - 021', 'BTP & Construction'),
  ('Re-New - HDF - 003', 'BTP & Construction'),
  ('Re-New - HDF - 005', 'BTP & Construction'),
  ('Re-New - HDF - 009', 'BTP & Construction'),
  ('Re-New - Idf - 001', 'BTP & Construction'),
  ('Re-New - Idf - 002', 'BTP & Construction'),
  ('Re-New - Idf - 004', 'BTP & Construction'),
  ('Re-New - Idf - 009', 'BTP & Construction'),
  ('Re-New - Idf - 017', 'BTP & Construction'),
  ('Re-New - Idf - 021', 'BTP & Construction'),
  ('Re-New - Idf - 022', 'BTP & Construction'),
  ('Re-New - Idf - 024', 'BTP & Construction'),
  ('Re-New - Idf - 032', 'BTP & Construction'),
  ('Re-New - NA - 006', 'BTP & Construction'),
  ('Re-New - NA - 007', 'BTP & Construction'),
  ('Re-New - Oc - 007', 'BTP & Construction'),
  ('Re-New - AU - 009', 'Industrie manufacturière'),
  ('Re-New - AU - 018', 'Industrie manufacturière'),
  ('Re-New - AU - 020', 'Industrie manufacturière'),
  ('Re-New - AU - 022', 'Industrie manufacturière'),
  ('Re-New - AU - 024', 'Industrie manufacturière'),
  ('Re-New - BFC - 003', 'Industrie manufacturière'),
  ('Re-New - BFC - 005', 'Industrie manufacturière'),
  ('Re-New - Br - 002', 'Industrie manufacturière'),
  ('Re-New - Br - 004', 'Industrie manufacturière'),
  ('Re-New - Br - 005', 'Industrie manufacturière'),
  ('Re-New - CVL - 004', 'Industrie manufacturière'),
  ('Re-New - CVL - 006', 'Industrie manufacturière'),
  ('Re-New - GO - 002', 'Industrie manufacturière'),
  ('Re-New - GO - 009', 'Industrie manufacturière'),
  ('Re-New - GO - 013', 'Industrie manufacturière'),
  ('Re-New - GO - 018', 'Industrie manufacturière'),
  ('Re-New - HDF - 001', 'Industrie manufacturière'),
  ('Re-New - HDF - 002', 'Industrie manufacturière'),
  ('Re-New - HDF - 007', 'Industrie manufacturière'),
  ('Re-New - Idf - 005', 'Industrie manufacturière'),
  ('Re-New - NA - 002', 'Industrie manufacturière'),
  ('Re-New - NA - 008', 'Industrie manufacturière'),
  ('Re-New - NA - 009', 'Industrie manufacturière'),
  ('Re-New - NA - 010', 'Industrie manufacturière'),
  ('Re-New - NO - 001', 'Industrie manufacturière'),
  ('Re-New - PA - 006', 'Industrie manufacturière'),
  ('Re-New - PA - 008', 'Industrie manufacturière'),
  ('Re-New - PL - 003', 'Industrie manufacturière'),
  ('Re-New - PL - 004', 'Industrie manufacturière'),
  ('Re-New - AU - 011', 'Commerce, Négoce & Distribution'),
  ('Re-New - AU - 015', 'Commerce, Négoce & Distribution'),
  ('Re-New - BFC - 002', 'Commerce, Négoce & Distribution'),
  ('Re-New - Br - 003', 'Commerce, Négoce & Distribution'),
  ('Re-New - CVL - 001', 'Commerce, Négoce & Distribution'),
  ('Re-New - CVL - 005', 'Commerce, Négoce & Distribution'),
  ('Re-New - FR - 004', 'Commerce, Négoce & Distribution'),
  ('Re-New - FR - 006', 'Commerce, Négoce & Distribution'),
  ('Re-New - GO - 004', 'Commerce, Négoce & Distribution'),
  ('Re-New - GO - 006', 'Commerce, Négoce & Distribution'),
  ('Re-New - GO - 007', 'Commerce, Négoce & Distribution'),
  ('Re-New - GO - 020', 'Commerce, Négoce & Distribution'),
  ('Re-New - Idf - 018', 'Commerce, Négoce & Distribution'),
  ('Re-New - Idf - 025', 'Commerce, Négoce & Distribution'),
  ('Re-New - Idf - 035', 'Commerce, Négoce & Distribution'),
  ('Re-New - NA - 001', 'Commerce, Négoce & Distribution'),
  ('Re-New - NO - 003', 'Commerce, Négoce & Distribution'),
  ('Re-New - Oc - 002', 'Commerce, Négoce & Distribution'),
  ('Re-New - Oc - 003', 'Commerce, Négoce & Distribution'),
  ('Re-New - Oc - 010', 'Commerce, Négoce & Distribution'),
  ('Re-New - PA - 004', 'Commerce, Négoce & Distribution'),
  ('Re-New - PA - 005', 'Commerce, Négoce & Distribution'),
  ('Re-New - AU - 016', 'Services de santé'),
  ('Re-New - Idf - 033', 'Services de santé'),
  ('Re-New - PA - 001', 'Services de santé'),
  ('Re-New - PA - 002', 'Services de santé'),
  ('Re-New - FR - 001', 'Tech & Digital'),
  ('Re-New - Idf - 007', 'Tech & Digital'),
  ('Re-New - Idf - 011', 'Tech & Digital'),
  ('Re-New - Idf - 013', 'Tech & Digital'),
  ('Re-New - Idf - 027', 'Tech & Digital'),
  ('Re-New - Idf - 028', 'Tech & Digital'),
  ('Re-New - NO - 004', 'Tech & Digital'),
  ('Re-New - Oc - 009', 'Tech & Digital'),
  ('Re-New - FR - 003', 'Automobile & Mobilité'),
  ('Re-New - GE - 003', 'Automobile & Mobilité'),
  ('Re-New - Idf - 016', 'Automobile & Mobilité'),
  ('Re-New - NA - 012', 'Automobile & Mobilité'),
  ('Re-New - GO - 008', 'Environnement & Énergie'),
  ('Re-New - GO - 019', 'Environnement & Énergie'),
  ('Re-New - Idf - 019', 'Transport & Logistique'),
  ('Re-New - NA - 004', 'Transport & Logistique');

DO $$
DECLARE
  apply_now BOOLEAN := COALESCE(current_setting('renew.colin_data_correction_apply', true), '') = '2026-09-02-apply';
  expected_sector_rows CONSTANT INTEGER := 130;
  expected_active_real_rows CONSTANT INTEGER := 155;
  expected_canonical_rows CONSTANT INTEGER := 25;
  expected_scope_rows INTEGER;
  active_real_rows INTEGER;
  canonical_rows INTEGER;
  manifest_rows INTEGER;
  invalid_manifest_rows INTEGER;
  target_mismatch_rows INTEGER;
  existing_backup_rows INTEGER;
  geography_node_ara UUID;
  geography_node_go UUID;
  geography_rows INTEGER;
  source_marker_rows INTEGER;
  source_marker_flagged_rows INTEGER;
  geography_target_rows INTEGER;
BEGIN
  SELECT COUNT(*) INTO manifest_rows FROM colin_sector_manifest;
  IF manifest_rows <> expected_sector_rows THEN RAISE EXCEPTION 'colin_data_correction_manifest_count_mismatch:%', manifest_rows; END IF;
  SELECT COUNT(*) INTO invalid_manifest_rows FROM colin_sector_manifest
  WHERE target_sector NOT IN ('Agroalimentaire','Industrie manufacturière','Industrie lourde','Industrie pharmaceutique & Dispositifs médicaux','Services de santé','Automobile & Mobilité','Textile, Luxe & Mode','Commerce, Négoce & Distribution','BTP & Construction','Services aux entreprises (B2B)','Services aux particuliers (B2C)','Tech & Digital','Environnement & Énergie','Hôtellerie, Restauration & Loisirs','Transport & Logistique','Autre');
  IF invalid_manifest_rows <> 0 THEN RAISE EXCEPTION 'colin_data_correction_manifest_has_noncanonical_target:%', invalid_manifest_rows; END IF;

  SELECT COUNT(*) INTO expected_scope_rows FROM public.opportunities
  WHERE status = 'active' AND is_demo = FALSE
    AND COALESCE(BTRIM(sector), '') NOT IN ('Agroalimentaire','Industrie manufacturière','Industrie lourde','Industrie pharmaceutique & Dispositifs médicaux','Services de santé','Automobile & Mobilité','Textile, Luxe & Mode','Commerce, Négoce & Distribution','BTP & Construction','Services aux entreprises (B2B)','Services aux particuliers (B2C)','Tech & Digital','Environnement & Énergie','Hôtellerie, Restauration & Loisirs','Transport & Logistique','Autre');
  SELECT COUNT(*) INTO active_real_rows FROM public.opportunities WHERE status = 'active' AND is_demo = FALSE;
  canonical_rows := active_real_rows - expected_scope_rows;
  IF active_real_rows <> expected_active_real_rows
     OR (expected_scope_rows = expected_sector_rows AND canonical_rows <> expected_canonical_rows)
     OR (expected_scope_rows = 0 AND canonical_rows <> expected_active_real_rows) THEN
    RAISE EXCEPTION 'colin_data_correction_inventory_preflight_failed:active_real=% legacy=% canonical=%', active_real_rows, expected_scope_rows, canonical_rows;
  END IF;
  SELECT COUNT(*) INTO target_mismatch_rows FROM colin_sector_manifest manifest
  LEFT JOIN public.opportunities opportunity ON opportunity.reference = manifest.reference
  WHERE opportunity.id IS NULL OR opportunity.status <> 'active' OR opportunity.is_demo IS DISTINCT FROM FALSE
    OR (expected_scope_rows = expected_sector_rows AND COALESCE(BTRIM(opportunity.sector), '') IN ('Agroalimentaire','Industrie manufacturière','Industrie lourde','Industrie pharmaceutique & Dispositifs médicaux','Services de santé','Automobile & Mobilité','Textile, Luxe & Mode','Commerce, Négoce & Distribution','BTP & Construction','Services aux entreprises (B2B)','Services aux particuliers (B2C)','Tech & Digital','Environnement & Énergie','Hôtellerie, Restauration & Loisirs','Transport & Logistique','Autre'))
    OR (expected_scope_rows = 0 AND opportunity.sector IS DISTINCT FROM manifest.target_sector);
  IF expected_scope_rows NOT IN (0, expected_sector_rows) OR target_mismatch_rows <> 0 THEN RAISE EXCEPTION 'colin_data_correction_sector_preflight_failed:scope=% manifest_mismatches=%', expected_scope_rows, target_mismatch_rows; END IF;

  SELECT id INTO geography_node_ara FROM public.geography_nodes WHERE stable_key = 'fr-region-auvergne-rhone-alpes';
  SELECT id INTO geography_node_go FROM public.geography_nodes WHERE stable_key = 'fr-macro-great-west';
  IF geography_node_ara IS NULL OR geography_node_go IS NULL THEN RAISE EXCEPTION 'colin_data_correction_geography_nodes_missing'; END IF;
  SELECT COUNT(*) INTO geography_rows FROM public.opportunities
  WHERE (reference = 'Re-New - AU - 001' AND status = 'active' AND is_demo = FALSE)
     OR (reference IN ('Re-New - GO - 020','Re-New - GO - 021') AND status = 'active' AND is_demo = FALSE);
  IF geography_rows <> 3 THEN RAISE EXCEPTION 'colin_data_correction_geography_scope_mismatch:%', geography_rows; END IF;

  SELECT COUNT(*) INTO source_marker_rows
  FROM colin_source_marker_manifest manifest
  JOIN public.opportunities opportunity ON opportunity.reference = manifest.reference
  WHERE opportunity.status = 'active' AND opportunity.is_demo = FALSE
    AND encode(extensions.digest(convert_to(concat_ws('|', opportunity.reference, opportunity.id, opportunity.source_id, opportunity.source_office_id), 'UTF8'), 'sha256'), 'hex') = manifest.identity_fingerprint;
  IF source_marker_rows <> 3 THEN RAISE EXCEPTION 'colin_data_correction_source_marker_preflight_failed:%', source_marker_rows; END IF;
  SELECT COUNT(*) INTO source_marker_flagged_rows
  FROM colin_source_marker_manifest manifest
  JOIN public.opportunities opportunity ON opportunity.reference = manifest.reference
  WHERE opportunity.source_identity_to_verify = TRUE;
  IF source_marker_flagged_rows NOT IN (0, 3) THEN RAISE EXCEPTION 'colin_data_correction_source_marker_partial_state:%', source_marker_flagged_rows; END IF;
  SELECT COUNT(*) INTO geography_target_rows FROM public.opportunities
  WHERE (reference = 'Re-New - AU - 001' AND location = 'Auvergne-Rhône-Alpes' AND geography_node_id = geography_node_ara)
     OR (reference IN ('Re-New - GO - 020','Re-New - GO - 021') AND location = 'Grand-Ouest' AND geography_node_id = geography_node_go);

  IF NOT apply_now THEN
    RAISE NOTICE 'Colin correction preflight passed; no mutation requested (legacy_scope=% source_markers=% geography_targets=%).', expected_scope_rows, source_marker_flagged_rows, geography_target_rows;
    RETURN;
  END IF;
  IF expected_scope_rows = 0 THEN
    IF source_marker_flagged_rows <> 3 OR geography_target_rows <> 3 THEN
      RAISE EXCEPTION 'colin_data_correction_rerun_state_failed:source_markers=% geography_targets=%', source_marker_flagged_rows, geography_target_rows;
    END IF;
    SELECT COUNT(*) INTO existing_backup_rows FROM public.sector_taxonomy_legacy_20260720
    WHERE entity_type = 'opportunity' AND field_name = 'colin_20260902_data_correction';
    IF existing_backup_rows <> 131 THEN RAISE EXCEPTION 'colin_data_correction_rerun_before_images_mismatch:%', existing_backup_rows; END IF;
    RAISE NOTICE 'Colin correction already applied and exact geography/source-marker state is verified.';
    RETURN;
  END IF;
  IF source_marker_flagged_rows <> 0 THEN RAISE EXCEPTION 'colin_data_correction_source_marker_already_set'; END IF;

  SELECT COUNT(*) INTO existing_backup_rows FROM public.sector_taxonomy_legacy_20260720 backup
  JOIN public.opportunities opportunity ON opportunity.id = backup.record_id
  WHERE backup.entity_type = 'opportunity' AND backup.field_name = 'colin_20260902_data_correction'
    AND (opportunity.reference IN (SELECT reference FROM colin_sector_manifest) OR opportunity.reference IN ('Re-New - AU - 001','Re-New - GO - 020','Re-New - GO - 021'));
  IF existing_backup_rows <> 0 THEN RAISE EXCEPTION 'colin_data_correction_existing_before_images:%', existing_backup_rows; END IF;

  INSERT INTO public.sector_taxonomy_legacy_20260720(entity_type,record_id,field_name,original_value)
  SELECT 'opportunity', opportunity.id, 'colin_20260902_data_correction',
    JSONB_BUILD_OBJECT('sector',opportunity.sector,'location',opportunity.location,'geography_node_id',opportunity.geography_node_id,'source_identity_to_verify',opportunity.source_identity_to_verify)
  FROM public.opportunities opportunity
  WHERE opportunity.reference IN (SELECT reference FROM colin_sector_manifest)
     OR opportunity.reference IN ('Re-New - AU - 001','Re-New - GO - 020','Re-New - GO - 021');

  UPDATE public.opportunities opportunity SET sector = manifest.target_sector, updated_by = 'Codex: Colin Deal Flow correction 2026-09-02', updated_at = NOW()
  FROM colin_sector_manifest manifest WHERE opportunity.reference = manifest.reference AND opportunity.status = 'active' AND opportunity.is_demo = FALSE;
  UPDATE public.opportunities SET location = 'Auvergne-Rhône-Alpes', geography_node_id = geography_node_ara, updated_by = 'Codex: Colin Deal Flow correction 2026-09-02', updated_at = NOW() WHERE reference = 'Re-New - AU - 001';
  UPDATE public.opportunities SET location = 'Grand-Ouest', geography_node_id = geography_node_go, updated_by = 'Codex: Colin Deal Flow correction 2026-09-02', updated_at = NOW() WHERE reference IN ('Re-New - GO - 020','Re-New - GO - 021');
  UPDATE public.opportunities opportunity SET source_identity_to_verify = TRUE, updated_by = 'Codex: Colin Deal Flow correction 2026-09-02', updated_at = NOW()
  FROM colin_source_marker_manifest manifest
  WHERE opportunity.reference = manifest.reference AND opportunity.status = 'active' AND opportunity.is_demo = FALSE
    AND encode(extensions.digest(convert_to(concat_ws('|', opportunity.reference, opportunity.id, opportunity.source_id, opportunity.source_office_id), 'UTF8'), 'sha256'), 'hex') = manifest.identity_fingerprint;

  IF (SELECT COUNT(*) FROM public.opportunities opportunity JOIN colin_sector_manifest manifest ON manifest.reference = opportunity.reference WHERE opportunity.sector = manifest.target_sector) <> expected_sector_rows
     OR (SELECT COUNT(*) FROM public.opportunities WHERE status = 'active' AND is_demo = FALSE AND COALESCE(BTRIM(sector), '') IN ('Agroalimentaire','Industrie manufacturière','Industrie lourde','Industrie pharmaceutique & Dispositifs médicaux','Services de santé','Automobile & Mobilité','Textile, Luxe & Mode','Commerce, Négoce & Distribution','BTP & Construction','Services aux entreprises (B2B)','Services aux particuliers (B2C)','Tech & Digital','Environnement & Énergie','Hôtellerie, Restauration & Loisirs','Transport & Logistique','Autre')) <> expected_active_real_rows
     OR (SELECT COUNT(*) FROM public.opportunities WHERE reference = 'Re-New - AU - 001' AND location = 'Auvergne-Rhône-Alpes' AND geography_node_id = geography_node_ara) <> 1
     OR (SELECT COUNT(*) FROM public.opportunities WHERE reference IN ('Re-New - GO - 020','Re-New - GO - 021') AND location = 'Grand-Ouest' AND geography_node_id = geography_node_go) <> 2
     OR (SELECT COUNT(*) FROM colin_source_marker_manifest manifest JOIN public.opportunities opportunity ON opportunity.reference = manifest.reference WHERE opportunity.source_identity_to_verify = TRUE AND encode(extensions.digest(convert_to(concat_ws('|', opportunity.reference, opportunity.id, opportunity.source_id, opportunity.source_office_id), 'UTF8'), 'sha256'), 'hex') = manifest.identity_fingerprint) <> 3
     OR (SELECT COUNT(*) FROM public.sector_taxonomy_legacy_20260720 WHERE entity_type = 'opportunity' AND field_name = 'colin_20260902_data_correction') < 131 THEN
    RAISE EXCEPTION 'colin_data_correction_postflight_failed';
  END IF;
END $$;
COMMIT;
