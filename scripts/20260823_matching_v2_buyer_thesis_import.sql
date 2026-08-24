-- Matching v2 buyer-thesis import (approved Book_Acquereurs_WAVE snapshot).
--
-- Scope: exactly the 19 accepted Deal Flow Paid / End-to-end clients with a
-- source-backed row in the approved book. It intentionally excludes free
-- clients (including François Corrignan and Pierre Fournis), the Test2Colin
-- fixture, and the two eligible clients absent from the book (David Issautier
-- and François Naimo).
--
-- Safety:
-- * assertions fail closed if identities, eligibility, or cohort shape drift;
-- * approved open bounds clear stale values; unexpected numeric drift fails closed;
-- * the existing q12 geography trigger reconciles the canonical bridge;
-- * rerunning produces the same persisted values;
-- * after commit, run scripts/refresh-matching-v2-buyer-import.ts before UAT
--   to refresh stored opportunity-match score snapshots through the application scorer.

BEGIN;

CREATE TEMP TABLE matching_v2_book_profiles (
  repreneur_id UUID PRIMARY KEY,
  expected_name TEXT NOT NULL,
  geo_keys TEXT[] NOT NULL,
  sectors JSONB NOT NULL,
  revenue_min NUMERIC(12,2),
  revenue_max NUMERIC(12,2),
  ebitda_margin_min NUMERIC(5,2),
  ebitda_margin_max NUMERIC(5,2),
  staff_min INTEGER,
  staff_max INTEGER
) ON COMMIT DROP;

INSERT INTO matching_v2_book_profiles VALUES
  ('d482c003-e94b-4d28-8e82-0cfee49b73c4', 'Pierre Bondroit', ARRAY['ile-de-france','auvergne-rhone-alpes','bretagne','normandie','paca','pays-de-la-loire','nouvelle-aquitaine'], '["Services de santé","Services aux entreprises (B2B)","BTP & Construction","Environnement & Énergie","Industrie manufacturière"]', 10, 40, 10, NULL, 20, NULL),
  ('5f4c9e8c-f97d-499f-b98e-15ca20024a52', 'Wassim Sacre', ARRAY['ile-de-france','pays-de-la-loire','nouvelle-aquitaine','bretagne','hauts-de-france'], '["Tech & Digital","Industrie manufacturière"]', 2, 20, NULL, NULL, 15, NULL),
  ('e663a03b-e50f-436d-89b2-64a8145917bd', 'Edouard Malnoy', ARRAY['all-france'], '["Services aux entreprises (B2B)","Services aux particuliers (B2C)","BTP & Construction"]', 3, 30, NULL, NULL, 10, NULL),
  ('0222ed0f-5f63-45d7-87b0-e6d405bbebe7', 'Pierre-Alexis Buaillon', ARRAY['ile-de-france','nouvelle-aquitaine','auvergne-rhone-alpes'], '["Services aux entreprises (B2B)","Services aux particuliers (B2C)","Services de santé"]', 3, 20, 6, NULL, 10, NULL),
  ('e1b03a23-0ebd-46c8-b6b0-fb87d1a2ceef', 'Jacques Gout-Lombard', ARRAY['all-france'], '["Services aux entreprises (B2B)","Commerce, Négoce & Distribution"]', 2, 20, NULL, NULL, 10, 50),
  ('c6b7a6ef-4532-422e-b0fc-2300c359f88f', 'Pascal Turcot', ARRAY['ile-de-france','auvergne-rhone-alpes','nouvelle-aquitaine','occitanie','paca','corse','bretagne','normandie','pays-de-la-loire','centre-val-de-loire','hauts-de-france','grand-est','bourgogne-franche-comte'], '["Industrie pharmaceutique & Dispositifs médicaux","Environnement & Énergie","Industrie manufacturière","Agroalimentaire"]', 2, 10, NULL, NULL, 10, 100),
  ('3befdd37-1e19-4c8b-805d-fe37f5497557', 'Christophe Alaux', ARRAY['ile-de-france','auvergne-rhone-alpes','nouvelle-aquitaine','occitanie','paca','corse','bretagne','normandie','pays-de-la-loire','centre-val-de-loire','hauts-de-france','grand-est','bourgogne-franche-comte'], '["Commerce, Négoce & Distribution","Services aux entreprises (B2B)","BTP & Construction","Services de santé","Hôtellerie, Restauration & Loisirs"]', 3, 10, NULL, NULL, 10, NULL),
  ('196667bd-1ba6-43da-a7de-0a11e9588eb0', 'Nicolas Gauly', ARRAY['auvergne-rhone-alpes'], '["Industrie manufacturière","Tech & Digital","Services aux entreprises (B2B)","Environnement & Énergie"]', 5, 10, NULL, NULL, 20, 50),
  ('d4386948-5480-4bf1-aeea-9c6438929c3f', 'Hypolite Hadrien', ARRAY['all-france'], '["Transport & Logistique","Services aux entreprises (B2B)","Services aux particuliers (B2C)","Commerce, Négoce & Distribution","Hôtellerie, Restauration & Loisirs","Industrie manufacturière"]', 1.5, 10, 10, NULL, 10, NULL),
  ('4020a404-715a-4d6e-989c-afa70a4d8cef', 'Alexandre Englebert', ARRAY['auvergne-rhone-alpes'], '["Services aux entreprises (B2B)","Hôtellerie, Restauration & Loisirs","BTP & Construction"]', 2, NULL, NULL, NULL, 5, 25),
  ('197dc075-2508-4b2f-b4f7-97bb0da5f9eb', 'Henry de Lavenère', ARRAY['ile-de-france','hauts-de-france','bretagne'], '["Industrie manufacturière","Services aux entreprises (B2B)","Commerce, Négoce & Distribution","BTP & Construction"]', 3, 10, NULL, NULL, 20, NULL),
  ('9f7b912f-6f1d-492c-b62d-428249d2515a', 'Arnaud Akar', ARRAY['bretagne'], '["Commerce, Négoce & Distribution","Industrie manufacturière","Services aux entreprises (B2B)","Services aux particuliers (B2C)"]', 3, 10, NULL, NULL, 10, NULL),
  ('49d2c041-97e3-4c96-8b15-3a9e8b67f21f', 'Sacha Picard', ARRAY['ile-de-france','hauts-de-france','grand-est','bourgogne-franche-comte','centre-val-de-loire','normandie'], '["Agroalimentaire","Commerce, Négoce & Distribution"]', 1, 20, NULL, NULL, NULL, NULL),
  -- Source is strictly fewer than 20 employees; integer matching normalizes it to 19.
  ('2146f156-08dd-4aeb-8e00-cdf87dc86045', 'Jean-Christophe Arvat', ARRAY['auvergne-rhone-alpes'], '["Agroalimentaire","Commerce, Négoce & Distribution","Services aux entreprises (B2B)"]', 2, 5, NULL, NULL, NULL, 19),
  ('a698237d-7ea8-4992-a033-8781a5ac370e', 'Rafael Vinit', ARRAY['ile-de-france','normandie','centre-val-de-loire','pays-de-la-loire','bretagne','nouvelle-aquitaine','bourgogne-franche-comte','hauts-de-france'], '["Industrie manufacturière","Commerce, Négoce & Distribution","Services aux entreprises (B2B)","Tech & Digital"]', 3, 15, NULL, NULL, 10, 40),
  ('e7f80557-f7af-45ed-9654-980fdcbbe508', 'Arnaud Sené', ARRAY['pays-de-la-loire','bretagne','centre-val-de-loire','normandie','nouvelle-aquitaine','ile-de-france'], '["Agroalimentaire","Industrie manufacturière","Commerce, Négoce & Distribution"]', 3, 10, NULL, NULL, 10, 50),
  ('e35d3dbf-79d4-4bb2-bc27-fd7865bc06a4', 'Anne Charon', ARRAY['ile-de-france'], '["Commerce, Négoce & Distribution","Industrie manufacturière","Services aux entreprises (B2B)"]', 1, 6, NULL, NULL, 5, 40),
  ('c6b4eab6-45f6-4dcb-b653-391ad48fa6c9', 'Fady Bekhit', ARRAY['ile-de-france'], '["BTP & Construction","Services aux entreprises (B2B)"]', 3, NULL, NULL, NULL, 10, 30),
  ('54d49a82-7fca-4771-a0a8-39bc8d6253b7', 'Florent Lafleur', ARRAY['ile-de-france','normandie','centre-val-de-loire','hauts-de-france'], '["Commerce, Négoce & Distribution","Industrie manufacturière"]', 1.5, 5, NULL, NULL, 10, 20);

-- Exact pre-import state captured during the 2026-08-23 read-only preflight.
-- A rerun accepts the already-imported state; any other staff correction aborts.
CREATE TEMP TABLE matching_v2_pre_import_thesis (
  repreneur_id UUID PRIMARY KEY,
  q12_geo_zones JSONB NOT NULL,
  q13_target_sectors_v2 JSONB NOT NULL
) ON COMMIT DROP;

INSERT INTO matching_v2_pre_import_thesis VALUES
  ('d482c003-e94b-4d28-8e82-0cfee49b73c4', '["all-france"]', '["all"]'),
  ('5f4c9e8c-f97d-499f-b98e-15ca20024a52', '["ile-de-france","bourgogne-franche-comte","normandie","hauts-de-france"]', '["Tech & Digital","Services de santé","Industrie pharmaceutique & Dispositifs médicaux"]'),
  ('e663a03b-e50f-436d-89b2-64a8145917bd', '[]', '[]'),
  ('0222ed0f-5f63-45d7-87b0-e6d405bbebe7', '["all-france","ile-de-france"]', '["Services de santé","Industrie pharmaceutique & Dispositifs médicaux","Autre"]'),
  ('e1b03a23-0ebd-46c8-b6b0-fb87d1a2ceef', '["all-france"]', '["Services aux entreprises (B2B)","Services aux particuliers (B2C)"]'),
  ('c6b7a6ef-4532-422e-b0fc-2300c359f88f', '["auvergne-rhone-alpes","bretagne","bourgogne-franche-comte","centre-val-de-loire","grand-est","ile-de-france","nouvelle-aquitaine","pays-de-la-loire","occitanie","normandie"]', '["Services de santé","Industrie pharmaceutique & Dispositifs médicaux","Industrie manufacturière"]'),
  ('3befdd37-1e19-4c8b-805d-fe37f5497557', '["all-france","ile-de-france","nouvelle-aquitaine"]', '["Commerce, Négoce & Distribution","Services aux entreprises (B2B)","Services aux particuliers (B2C)","Hôtellerie, Restauration & Loisirs","Services de santé","Industrie pharmaceutique & Dispositifs médicaux","Industrie manufacturière"]'),
  ('196667bd-1ba6-43da-a7de-0a11e9588eb0', '["all-france"]', '["Industrie manufacturière","Tech & Digital","Environnement & Énergie","Services de santé","Industrie pharmaceutique & Dispositifs médicaux"]'),
  ('d4386948-5480-4bf1-aeea-9c6438929c3f', '[]', '[]'),
  ('4020a404-715a-4d6e-989c-afa70a4d8cef', '["auvergne-rhone-alpes"]', '["Commerce, Négoce & Distribution","Services aux entreprises (B2B)","Services aux particuliers (B2C)","Industrie manufacturière","BTP & Construction"]'),
  ('197dc075-2508-4b2f-b4f7-97bb0da5f9eb', '["ile-de-france","centre-val-de-loire","pays-de-la-loire","normandie","bretagne","hauts-de-france","nouvelle-aquitaine"]', '["Services aux entreprises (B2B)","Services aux particuliers (B2C)","Environnement & Énergie","Commerce, Négoce & Distribution","Industrie manufacturière"]'),
  ('9f7b912f-6f1d-492c-b62d-428249d2515a', '["bretagne","pays-de-la-loire"]', '[]'),
  ('49d2c041-97e3-4c96-8b15-3a9e8b67f21f', '["all-france"]', '["Industrie manufacturière","Commerce, Négoce & Distribution"]'),
  ('2146f156-08dd-4aeb-8e00-cdf87dc86045', '["all-france"]', '["all"]'),
  ('a698237d-7ea8-4992-a033-8781a5ac370e', '["centre-val-de-loire","hauts-de-france","normandie","ile-de-france","nouvelle-aquitaine","pays-de-la-loire","bourgogne-franche-comte"]', '["Industrie manufacturière","Services aux entreprises (B2B)","Services aux particuliers (B2C)"]'),
  ('e7f80557-f7af-45ed-9654-980fdcbbe508', '["pays-de-la-loire","centre-val-de-loire","bretagne"]', '["all"]'),
  ('e35d3dbf-79d4-4bb2-bc27-fd7865bc06a4', '["ile-de-france"]', '["Commerce, Négoce & Distribution","Tech & Digital","Transport & Logistique","Services aux entreprises (B2B)","Services aux particuliers (B2C)"]'),
  ('c6b4eab6-45f6-4dcb-b653-391ad48fa6c9', '["ile-de-france","nouvelle-aquitaine","hauts-de-france","centre-val-de-loire","bretagne","normandie","grand-est","pays-de-la-loire"]', '["Services aux entreprises (B2B)","Services aux particuliers (B2C)"]'),
  ('54d49a82-7fca-4771-a0a8-39bc8d6253b7', '["ile-de-france","centre-val-de-loire","normandie"]', '["Commerce, Négoce & Distribution","Services aux entreprises (B2B)","Services aux particuliers (B2C)","Industrie manufacturière","Autre","Environnement & Énergie"]');

DO $$
DECLARE eligible_real_clients INTEGER; source_backed_clients INTEGER; pre_import_clients INTEGER;
BEGIN
  SELECT COUNT(DISTINCT r.id) INTO eligible_real_clients
  FROM public.repreneurs r
  JOIN public.repreneur_offers ro ON ro.repreneur_id = r.id AND ro.status = 'accepted'
  JOIN public.offers o ON o.id = ro.offer_id
  WHERE r.lifecycle_status = 'client'
    AND o.name IN ('Deal Flow - Paid', 'End-to-end support')
    AND LOWER(CONCAT_WS(' ', r.first_name, r.last_name)) <> 'test2colin test2hofman';
  IF eligible_real_clients <> 21 THEN RAISE EXCEPTION 'matching_v2_eligible_client_count_mismatch'; END IF;

  SELECT COUNT(*) INTO source_backed_clients FROM matching_v2_book_profiles;
  IF source_backed_clients <> 19 THEN RAISE EXCEPTION 'matching_v2_source_profile_count_mismatch'; END IF;
  SELECT COUNT(*) INTO pre_import_clients FROM matching_v2_pre_import_thesis;
  IF pre_import_clients <> 19 OR EXISTS (
    (SELECT repreneur_id FROM matching_v2_book_profiles EXCEPT SELECT repreneur_id FROM matching_v2_pre_import_thesis)
    UNION ALL
    (SELECT repreneur_id FROM matching_v2_pre_import_thesis EXCEPT SELECT repreneur_id FROM matching_v2_book_profiles)
  ) THEN RAISE EXCEPTION 'matching_v2_pre_import_state_mismatch'; END IF;

  IF EXISTS (
    SELECT 1 FROM matching_v2_book_profiles p
    LEFT JOIN public.repreneurs r ON r.id = p.repreneur_id
    WHERE r.id IS NULL OR LOWER(CONCAT_WS(' ', r.first_name, r.last_name)) <> LOWER(p.expected_name)
  ) THEN RAISE EXCEPTION 'matching_v2_profile_identity_mismatch'; END IF;

  IF EXISTS (
    SELECT 1 FROM matching_v2_book_profiles p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.repreneur_offers ro JOIN public.offers o ON o.id = ro.offer_id
      JOIN public.repreneurs r ON r.id = ro.repreneur_id
      WHERE ro.repreneur_id = p.repreneur_id AND r.lifecycle_status = 'client' AND ro.status = 'accepted'
        AND o.name IN ('Deal Flow - Paid', 'End-to-end support')
    )
  ) THEN RAISE EXCEPTION 'matching_v2_profile_eligibility_mismatch'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.repreneurs r
    JOIN public.repreneur_offers ro ON ro.repreneur_id = r.id AND ro.status = 'accepted'
    JOIN public.offers o ON o.id = ro.offer_id
    WHERE r.lifecycle_status = 'client'
      AND o.name IN ('Deal Flow - Paid', 'End-to-end support')
      AND LOWER(CONCAT_WS(' ', r.first_name, r.last_name)) <> 'test2colin test2hofman'
      AND r.id NOT IN (SELECT repreneur_id FROM matching_v2_book_profiles)
      AND LOWER(CONCAT_WS(' ', r.first_name, r.last_name)) NOT IN ('david issautier', 'françois naimo')
  ) THEN RAISE EXCEPTION 'matching_v2_unexpected_eligible_client'; END IF;

  IF EXISTS (
    SELECT 1
    FROM matching_v2_book_profiles p
    JOIN public.repreneurs r ON r.id = p.repreneur_id
    WHERE NOT (r.target_revenue_min_meur IS NULL OR r.target_revenue_min_meur IS NOT DISTINCT FROM p.revenue_min)
       OR NOT (r.target_revenue_max_meur IS NULL OR r.target_revenue_max_meur IS NOT DISTINCT FROM p.revenue_max)
       OR NOT (r.target_ebitda_margin_min_pct IS NULL OR r.target_ebitda_margin_min_pct IS NOT DISTINCT FROM p.ebitda_margin_min)
       OR NOT (r.target_ebitda_margin_max_pct IS NULL OR r.target_ebitda_margin_max_pct IS NOT DISTINCT FROM p.ebitda_margin_max)
       OR NOT (r.target_staff_size_min IS NULL OR r.target_staff_size_min IS NOT DISTINCT FROM p.staff_min)
       OR NOT (r.target_staff_size_max IS NULL OR r.target_staff_size_max IS NOT DISTINCT FROM p.staff_max)
  ) THEN RAISE EXCEPTION 'matching_v2_numeric_profile_drift'; END IF;

  IF EXISTS (
    SELECT 1
    FROM matching_v2_book_profiles p
    JOIN matching_v2_pre_import_thesis pre ON pre.repreneur_id = p.repreneur_id
    JOIN public.repreneurs r ON r.id = p.repreneur_id
    WHERE NOT (
      (
        r.q12_geo_zones IS NOT DISTINCT FROM pre.q12_geo_zones
        AND r.q13_target_sectors_v2 IS NOT DISTINCT FROM pre.q13_target_sectors_v2
        AND r.target_location IS NULL
        AND (
          r.sector_preferences IS NOT DISTINCT FROM ARRAY(SELECT JSONB_ARRAY_ELEMENTS_TEXT(pre.q13_target_sectors_v2))
          OR (pre.q13_target_sectors_v2 = '[]'::JSONB AND r.sector_preferences IS NULL)
        )
      )
      OR (
        r.q12_geo_zones IS NOT DISTINCT FROM TO_JSONB(p.geo_keys)
        AND r.q13_target_sectors_v2 IS NOT DISTINCT FROM p.sectors
        AND r.target_location IS NOT DISTINCT FROM TO_JSONB(p.geo_keys)
        AND r.sector_preferences IS NOT DISTINCT FROM ARRAY(SELECT JSONB_ARRAY_ELEMENTS_TEXT(p.sectors))
      )
    )
  ) THEN RAISE EXCEPTION 'matching_v2_nonnumeric_profile_drift'; END IF;
END $$;

UPDATE public.repreneurs r
SET q12_geo_zones = TO_JSONB(p.geo_keys),
    q13_target_sectors_v2 = p.sectors,
    target_location = TO_JSONB(p.geo_keys),
    sector_preferences = ARRAY(SELECT JSONB_ARRAY_ELEMENTS_TEXT(p.sectors)),
    target_revenue_min_meur = p.revenue_min,
    target_revenue_max_meur = p.revenue_max,
    target_ebitda_margin_min_pct = p.ebitda_margin_min,
    target_ebitda_margin_max_pct = p.ebitda_margin_max,
    target_staff_size_min = p.staff_min,
    target_staff_size_max = p.staff_max
FROM matching_v2_book_profiles p
WHERE r.id = p.repreneur_id;

-- David Issautier and François Naimo are eligible, but absent from the source
-- book. Re-fire only the existing geography bridge from their live q12 data.
UPDATE public.repreneurs
SET q12_geo_zones = q12_geo_zones
WHERE id IN ('8a849298-4743-4e47-bbc5-0c554346879c', '5d9859d7-eb62-4bed-8ef9-d97a1b674364');

DO $$
BEGIN
  IF EXISTS (
    WITH geography_map(legacy_key, stable_key) AS (
      VALUES
        ('all-france', 'france'), ('auvergne-rhone-alpes', 'fr-region-auvergne-rhone-alpes'),
        ('bourgogne-franche-comte', 'fr-region-bourgogne-franche-comte'), ('bretagne', 'fr-region-brittany'),
        ('centre-val-de-loire', 'fr-region-centre-val-de-loire'), ('corse', 'fr-region-corsica'),
        ('grand-est', 'fr-region-grand-est'), ('hauts-de-france', 'fr-region-hauts-de-france'),
        ('ile-de-france', 'fr-region-idf'), ('normandie', 'fr-region-normandy'),
        ('nouvelle-aquitaine', 'fr-region-nouvelle-aquitaine'), ('occitanie', 'fr-region-occitanie'),
        ('paca', 'fr-region-provence-alpes-cote-d-azur'), ('pays-de-la-loire', 'fr-region-pays-de-la-loire')
    ), book_expected AS (
      SELECT p.repreneur_id, n.id AS geography_node_id
      FROM matching_v2_book_profiles p
      CROSS JOIN LATERAL UNNEST(p.geo_keys) key
      JOIN geography_map m ON m.legacy_key = key
      JOIN public.geography_nodes n ON n.stable_key = m.stable_key
    ), expected AS (
      SELECT * FROM book_expected
      UNION ALL
      SELECT missing.repreneur_id, n.id
      FROM (
        VALUES
          ('8a849298-4743-4e47-bbc5-0c554346879c'::UUID, ARRAY['fr-region-idf','fr-region-hauts-de-france','fr-region-centre-val-de-loire']::TEXT[]),
          ('5d9859d7-eb62-4bed-8ef9-d97a1b674364'::UUID, ARRAY['fr-region-auvergne-rhone-alpes','fr-region-bourgogne-franche-comte','fr-region-occitanie','fr-region-pays-de-la-loire','fr-region-brittany','fr-region-centre-val-de-loire']::TEXT[])
      ) AS missing(repreneur_id, stable_keys)
      CROSS JOIN LATERAL UNNEST(missing.stable_keys) AS requested(stable_key)
      JOIN public.geography_nodes n ON n.stable_key = requested.stable_key
    ), actual AS (
      SELECT t.repreneur_id, t.geography_node_id
      FROM public.repreneur_geography_targets t
      WHERE t.repreneur_id IN (
        SELECT repreneur_id FROM matching_v2_book_profiles
        UNION ALL SELECT '8a849298-4743-4e47-bbc5-0c554346879c'::UUID
        UNION ALL SELECT '5d9859d7-eb62-4bed-8ef9-d97a1b674364'::UUID
      )
    )
    SELECT 1 FROM ((SELECT * FROM expected EXCEPT SELECT * FROM actual)
                   UNION ALL (SELECT * FROM actual EXCEPT SELECT * FROM expected)) reconciliation_difference
  ) THEN RAISE EXCEPTION 'matching_v2_geography_bridge_reconciliation_mismatch'; END IF;

  IF EXISTS (
    SELECT 1
    FROM public.repreneurs r
    JOIN public.repreneur_offers ro ON ro.repreneur_id = r.id AND ro.status = 'accepted'
    JOIN public.offers o ON o.id = ro.offer_id
    WHERE r.lifecycle_status = 'client'
      AND o.name IN ('Deal Flow - Paid', 'End-to-end support')
      AND LOWER(CONCAT_WS(' ', r.first_name, r.last_name)) <> 'test2colin test2hofman'
      AND NOT EXISTS (
        SELECT 1 FROM public.repreneur_geography_targets t WHERE t.repreneur_id = r.id
      )
  ) THEN RAISE EXCEPTION 'matching_v2_eligible_geography_bridge_missing'; END IF;
END $$;

COMMIT;
