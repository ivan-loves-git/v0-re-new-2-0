-- W-039 Phase A/B and W-099: France-first staff geography and forward-only
-- mandate references. This migration intentionally does not backfill existing
-- opportunities, change literal locations, or activate Matching v2.
BEGIN;

CREATE TABLE IF NOT EXISTS public.geography_nodes (
  id UUID PRIMARY KEY,
  stable_key TEXT NOT NULL UNIQUE CHECK (stable_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  code TEXT NOT NULL CHECK (NULLIF(BTRIM(code), '') IS NOT NULL),
  label TEXT NOT NULL CHECK (NULLIF(BTRIM(label), '') IS NOT NULL),
  node_level TEXT NOT NULL CHECK (node_level IN ('country', 'macro_zone', 'region')),
  parent_id UUID REFERENCES public.geography_nodes(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((node_level = 'country' AND parent_id IS NULL) OR (node_level <> 'country' AND parent_id IS NOT NULL)),
  CHECK (parent_id IS DISTINCT FROM id)
);

CREATE OR REPLACE FUNCTION public.validate_geography_node_parent()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE parent_level TEXT;
BEGIN
  IF NEW.node_level = 'country' THEN
    IF NEW.parent_id IS NOT NULL THEN RAISE EXCEPTION 'geography_country_cannot_have_parent'; END IF;
    RETURN NEW;
  END IF;
  SELECT node_level INTO parent_level FROM public.geography_nodes WHERE id = NEW.parent_id;
  IF parent_level IS NULL THEN RAISE EXCEPTION 'geography_parent_not_found'; END IF;
  IF (NEW.node_level = 'macro_zone' AND parent_level <> 'country')
     OR (NEW.node_level = 'region' AND parent_level <> 'macro_zone') THEN
    RAISE EXCEPTION 'geography_parent_level_invalid';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS validate_geography_node_parent ON public.geography_nodes;
CREATE TRIGGER validate_geography_node_parent BEFORE INSERT OR UPDATE OF node_level, parent_id
  ON public.geography_nodes FOR EACH ROW EXECUTE FUNCTION public.validate_geography_node_parent();

INSERT INTO public.geography_nodes (id, stable_key, code, label, node_level, parent_id) VALUES
('00000000-0000-4092-8000-000000000001','france','FR','France','country',NULL),
('00000000-0000-4092-8000-000000000101','fr-macro-idf','IDF','Île-de-France','macro_zone','00000000-0000-4092-8000-000000000001'),
('00000000-0000-4092-8000-000000000102','fr-macro-north-east','NE','Nord-Est','macro_zone','00000000-0000-4092-8000-000000000001'),
('00000000-0000-4092-8000-000000000103','fr-macro-great-west','GO','Grand-Ouest','macro_zone','00000000-0000-4092-8000-000000000001'),
('00000000-0000-4092-8000-000000000104','fr-macro-south-west','SO','Sud-Ouest','macro_zone','00000000-0000-4092-8000-000000000001'),
('00000000-0000-4092-8000-000000000105','fr-macro-south-east','SE','Sud-Est','macro_zone','00000000-0000-4092-8000-000000000001'),
('00000000-0000-4092-8000-000000000106','fr-macro-overseas','OM','Outre-Mer','macro_zone','00000000-0000-4092-8000-000000000001'),
('00000000-0000-4092-8000-000000000201','fr-region-idf','IDF','Île-de-France','region','00000000-0000-4092-8000-000000000101'),
('00000000-0000-4092-8000-000000000202','fr-region-auvergne-rhone-alpes','AU','Auvergne-Rhône-Alpes','region','00000000-0000-4092-8000-000000000105'),
('00000000-0000-4092-8000-000000000203','fr-region-nouvelle-aquitaine','NA','Nouvelle-Aquitaine','region','00000000-0000-4092-8000-000000000104'),
('00000000-0000-4092-8000-000000000204','fr-region-occitanie','OC','Occitanie','region','00000000-0000-4092-8000-000000000104'),
('00000000-0000-4092-8000-000000000205','fr-region-provence-alpes-cote-d-azur','PA','Provence-Alpes-Côte d''Azur','region','00000000-0000-4092-8000-000000000105'),
('00000000-0000-4092-8000-000000000206','fr-region-corsica','COR','Corse','region','00000000-0000-4092-8000-000000000105'),
('00000000-0000-4092-8000-000000000207','fr-region-brittany','BR','Bretagne','region','00000000-0000-4092-8000-000000000103'),
('00000000-0000-4092-8000-000000000208','fr-region-normandy','NO','Normandie','region','00000000-0000-4092-8000-000000000103'),
('00000000-0000-4092-8000-000000000209','fr-region-pays-de-la-loire','PL','Pays de la Loire','region','00000000-0000-4092-8000-000000000103'),
('00000000-0000-4092-8000-000000000210','fr-region-centre-val-de-loire','CVL','Centre-Val de Loire','region','00000000-0000-4092-8000-000000000103'),
('00000000-0000-4092-8000-000000000211','fr-region-hauts-de-france','HDF','Hauts-de-France','region','00000000-0000-4092-8000-000000000102'),
('00000000-0000-4092-8000-000000000212','fr-region-grand-est','GE','Grand Est','region','00000000-0000-4092-8000-000000000102'),
('00000000-0000-4092-8000-000000000213','fr-region-bourgogne-franche-comte','BFR','Bourgogne-Franche-Comté','region','00000000-0000-4092-8000-000000000102'),
('00000000-0000-4092-8000-000000000214','fr-region-overseas','DOM','DOM-TOM','region','00000000-0000-4092-8000-000000000106')
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF (SELECT COUNT(*) FROM public.geography_nodes WHERE id::text LIKE '00000000-0000-4092-8000-%') <> 21 THEN
    RAISE EXCEPTION 'w039_france_seed_count_mismatch';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM (VALUES
      ('00000000-0000-4092-8000-000000000001'::UUID,'france','FR','France','country',NULL::UUID),
      ('00000000-0000-4092-8000-000000000101'::UUID,'fr-macro-idf','IDF','Île-de-France','macro_zone','00000000-0000-4092-8000-000000000001'::UUID),
      ('00000000-0000-4092-8000-000000000102'::UUID,'fr-macro-north-east','NE','Nord-Est','macro_zone','00000000-0000-4092-8000-000000000001'::UUID),
      ('00000000-0000-4092-8000-000000000103'::UUID,'fr-macro-great-west','GO','Grand-Ouest','macro_zone','00000000-0000-4092-8000-000000000001'::UUID),
      ('00000000-0000-4092-8000-000000000104'::UUID,'fr-macro-south-west','SO','Sud-Ouest','macro_zone','00000000-0000-4092-8000-000000000001'::UUID),
      ('00000000-0000-4092-8000-000000000105'::UUID,'fr-macro-south-east','SE','Sud-Est','macro_zone','00000000-0000-4092-8000-000000000001'::UUID),
      ('00000000-0000-4092-8000-000000000106'::UUID,'fr-macro-overseas','OM','Outre-Mer','macro_zone','00000000-0000-4092-8000-000000000001'::UUID),
      ('00000000-0000-4092-8000-000000000201'::UUID,'fr-region-idf','IDF','Île-de-France','region','00000000-0000-4092-8000-000000000101'::UUID),
      ('00000000-0000-4092-8000-000000000202'::UUID,'fr-region-auvergne-rhone-alpes','AU','Auvergne-Rhône-Alpes','region','00000000-0000-4092-8000-000000000105'::UUID),
      ('00000000-0000-4092-8000-000000000203'::UUID,'fr-region-nouvelle-aquitaine','NA','Nouvelle-Aquitaine','region','00000000-0000-4092-8000-000000000104'::UUID),
      ('00000000-0000-4092-8000-000000000204'::UUID,'fr-region-occitanie','OC','Occitanie','region','00000000-0000-4092-8000-000000000104'::UUID),
      ('00000000-0000-4092-8000-000000000205'::UUID,'fr-region-provence-alpes-cote-d-azur','PA','Provence-Alpes-Côte d''Azur','region','00000000-0000-4092-8000-000000000105'::UUID),
      ('00000000-0000-4092-8000-000000000206'::UUID,'fr-region-corsica','COR','Corse','region','00000000-0000-4092-8000-000000000105'::UUID),
      ('00000000-0000-4092-8000-000000000207'::UUID,'fr-region-brittany','BR','Bretagne','region','00000000-0000-4092-8000-000000000103'::UUID),
      ('00000000-0000-4092-8000-000000000208'::UUID,'fr-region-normandy','NO','Normandie','region','00000000-0000-4092-8000-000000000103'::UUID),
      ('00000000-0000-4092-8000-000000000209'::UUID,'fr-region-pays-de-la-loire','PL','Pays de la Loire','region','00000000-0000-4092-8000-000000000103'::UUID),
      ('00000000-0000-4092-8000-000000000210'::UUID,'fr-region-centre-val-de-loire','CVL','Centre-Val de Loire','region','00000000-0000-4092-8000-000000000103'::UUID),
      ('00000000-0000-4092-8000-000000000211'::UUID,'fr-region-hauts-de-france','HDF','Hauts-de-France','region','00000000-0000-4092-8000-000000000102'::UUID),
      ('00000000-0000-4092-8000-000000000212'::UUID,'fr-region-grand-est','GE','Grand Est','region','00000000-0000-4092-8000-000000000102'::UUID),
      ('00000000-0000-4092-8000-000000000213'::UUID,'fr-region-bourgogne-franche-comte','BFR','Bourgogne-Franche-Comté','region','00000000-0000-4092-8000-000000000102'::UUID),
      ('00000000-0000-4092-8000-000000000214'::UUID,'fr-region-overseas','DOM','DOM-TOM','region','00000000-0000-4092-8000-000000000106'::UUID)
    ) AS expected(id, stable_key, code, label, node_level, parent_id)
    LEFT JOIN public.geography_nodes actual USING (id)
    WHERE actual.id IS NULL
       OR actual.stable_key <> expected.stable_key
       OR actual.code <> expected.code
       OR actual.label <> expected.label
       OR actual.node_level <> expected.node_level
       OR actual.parent_id IS DISTINCT FROM expected.parent_id
  ) THEN
    RAISE EXCEPTION 'w039_france_seed_identity_mismatch';
  END IF;
END $$;

ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS geography_node_id UUID
  REFERENCES public.geography_nodes(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_opportunities_geography_node ON public.opportunities (geography_node_id)
  WHERE geography_node_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.repreneur_geography_targets (
  repreneur_id UUID NOT NULL REFERENCES public.repreneurs(id) ON DELETE CASCADE,
  geography_node_id UUID NOT NULL REFERENCES public.geography_nodes(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (repreneur_id, geography_node_id)
);
CREATE INDEX IF NOT EXISTS idx_repreneur_geography_targets_node ON public.repreneur_geography_targets (geography_node_id, repreneur_id);

CREATE TABLE IF NOT EXISTS public.opportunity_mandate_reference_counters (
  reference_code TEXT PRIMARY KEY CHECK (reference_code ~ '^[A-Z0-9]+$'),
  next_sequence BIGINT NOT NULL DEFAULT 1 CHECK (next_sequence >= 1),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.ma_w039_release_control (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  enforce_new_opportunity_geography BOOLEAN NOT NULL DEFAULT FALSE,
  activated_by TEXT,
  activated_at TIMESTAMPTZ
);
INSERT INTO public.ma_w039_release_control (singleton) VALUES (TRUE) ON CONFLICT (singleton) DO NOTHING;

CREATE OR REPLACE FUNCTION public.prevent_opportunity_reference_change()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.reference IS DISTINCT FROM OLD.reference THEN
    RAISE EXCEPTION 'opportunity_reference_is_immutable';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS prevent_opportunity_reference_change ON public.opportunities;
CREATE TRIGGER prevent_opportunity_reference_change BEFORE UPDATE OF reference ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.prevent_opportunity_reference_change();

-- Keep the mature W-063 write primitive intact, then wrap it so geography and
-- generated references share its existing transaction and lifecycle checks.
DO $$
BEGIN
  IF TO_REGPROCEDURE('public.save_opportunity_office_context_legacy(uuid,uuid,uuid[],uuid,text,public.opportunity_status,text,jsonb)') IS NULL THEN
    ALTER FUNCTION public.save_opportunity_office_context(UUID, UUID, UUID[], UUID, TEXT, public.opportunity_status, TEXT, JSONB)
      RENAME TO save_opportunity_office_context_legacy;
  END IF;
  IF TO_REGPROCEDURE('public.create_opportunity_with_office_context_legacy(text,uuid,uuid[],uuid,text,public.opportunity_status,text,jsonb)') IS NULL THEN
    ALTER FUNCTION public.create_opportunity_with_office_context(TEXT, UUID, UUID[], UUID, TEXT, public.opportunity_status, TEXT, JSONB)
      RENAME TO create_opportunity_with_office_context_legacy;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.resolve_w039_geography_node(p_value TEXT)
RETURNS public.geography_nodes LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE node public.geography_nodes%ROWTYPE;
BEGIN
  IF NULLIF(BTRIM(p_value), '') IS NULL THEN RAISE EXCEPTION 'opportunity_geography_required'; END IF;
  IF BTRIM(p_value) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'opportunity_geography_not_found';
  END IF;
  SELECT * INTO node FROM public.geography_nodes WHERE id = BTRIM(p_value)::UUID;
  IF node.id IS NULL THEN RAISE EXCEPTION 'opportunity_geography_not_found'; END IF;
  RETURN node;
END $$;

-- W-098 leaves the source's month-only meaning intact until staff deliberately
-- confirms a real calendar day. The browser can express that confirmation,
-- but cannot write the precision enum. Lock before delegating to the mature
-- W-063 routine so a concurrent save cannot turn a month-only value into a
-- day between this validation and the atomic update.
CREATE OR REPLACE FUNCTION public.validate_w098_date_precision_write(
  p_opportunity_id UUID,
  p_opportunity_fields JSONB
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE current_precision TEXT; requested_date TEXT; confirm_day BOOLEAN := FALSE;
BEGIN
  IF JSONB_TYPEOF(COALESCE(p_opportunity_fields, '{}'::JSONB)) <> 'object' THEN
    RAISE EXCEPTION 'opportunity_intake_fields_must_be_object';
  END IF;
  IF p_opportunity_fields ? 'date_added_confirm_day' THEN
    IF JSONB_TYPEOF(p_opportunity_fields -> 'date_added_confirm_day') <> 'boolean' THEN
      RAISE EXCEPTION 'opportunity_date_added_confirmation_must_be_boolean';
    END IF;
    confirm_day := (p_opportunity_fields ->> 'date_added_confirm_day')::BOOLEAN;
  END IF;
  SELECT date_added_precision INTO current_precision
  FROM public.opportunities
  WHERE id = p_opportunity_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  requested_date := NULLIF(BTRIM(p_opportunity_fields ->> 'date_added'), '');
  IF current_precision = 'month' THEN
    IF confirm_day AND requested_date IS NULL THEN
      RAISE EXCEPTION 'opportunity_date_added_confirmation_requires_day';
    END IF;
    IF requested_date IS NOT NULL AND NOT confirm_day THEN
      RAISE EXCEPTION 'opportunity_date_added_month_precision_requires_confirmation';
    END IF;
  ELSIF confirm_day AND requested_date IS NULL THEN
    RAISE EXCEPTION 'opportunity_date_added_confirmation_requires_day';
  END IF;
  RETURN confirm_day;
END $$;

CREATE OR REPLACE FUNCTION public.save_opportunity_office_context(
  p_opportunity_id UUID, p_source_office_id UUID DEFAULT NULL, p_affiliation_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_primary_affiliation_id UUID DEFAULT NULL, p_description TEXT DEFAULT NULL,
  p_target_status public.opportunity_status DEFAULT 'draft', p_actor TEXT DEFAULT NULL,
  p_opportunity_fields JSONB DEFAULT '{}'::JSONB
) RETURNS public.opportunities LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE node public.geography_nodes%ROWTYPE; saved public.opportunities%ROWTYPE; legacy_fields JSONB; confirm_day BOOLEAN;
BEGIN
  confirm_day := public.validate_w098_date_precision_write(p_opportunity_id, p_opportunity_fields);
  legacy_fields := p_opportunity_fields - ARRAY['geography_node_id', 'date_added_confirm_day'];
  saved := public.save_opportunity_office_context_legacy(p_opportunity_id,p_source_office_id,p_affiliation_ids,p_primary_affiliation_id,p_description,p_target_status,p_actor,legacy_fields);
  IF p_opportunity_fields ? 'geography_node_id' THEN
    node := public.resolve_w039_geography_node(p_opportunity_fields ->> 'geography_node_id');
    UPDATE public.opportunities SET geography_node_id = node.id, updated_by = NULLIF(BTRIM(p_actor), ''), updated_at = NOW()
      WHERE id = saved.id RETURNING * INTO saved;
  END IF;
  IF confirm_day THEN
    UPDATE public.opportunities
    SET date_added_precision = 'day',
        updated_by = NULLIF(BTRIM(p_actor), ''),
        updated_at = NOW()
    WHERE id = saved.id
    RETURNING * INTO saved;
  END IF;
  RETURN saved;
END $$;

CREATE OR REPLACE FUNCTION public.create_opportunity_with_office_context(
  p_reference TEXT, p_source_office_id UUID DEFAULT NULL, p_affiliation_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_primary_affiliation_id UUID DEFAULT NULL, p_description TEXT DEFAULT NULL,
  p_target_status public.opportunity_status DEFAULT 'draft', p_actor TEXT DEFAULT NULL,
  p_opportunity_fields JSONB DEFAULT '{}'::JSONB
) RETURNS public.opportunities LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE node public.geography_nodes%ROWTYPE; allocated BIGINT; initial_sequence BIGINT; generated_reference TEXT; saved public.opportunities%ROWTYPE; enforce_geography BOOLEAN;
BEGIN
  SELECT enforce_new_opportunity_geography INTO enforce_geography FROM public.ma_w039_release_control WHERE singleton;
  IF NOT enforce_geography AND NOT (p_opportunity_fields ? 'geography_node_id') THEN
    IF p_opportunity_fields ? 'date_added_confirm_day'
       AND JSONB_TYPEOF(p_opportunity_fields -> 'date_added_confirm_day') <> 'boolean' THEN
      RAISE EXCEPTION 'opportunity_date_added_confirmation_must_be_boolean';
    END IF;
    RETURN public.create_opportunity_with_office_context_legacy(p_reference,p_source_office_id,p_affiliation_ids,p_primary_affiliation_id,p_description,p_target_status,p_actor,p_opportunity_fields - 'date_added_confirm_day');
  END IF;
  node := public.resolve_w039_geography_node(p_opportunity_fields ->> 'geography_node_id');
  -- Bootstrap each canonical code from its exact historic numeric suffix, not
  -- from a row count. Existing BFC history does not collide with new BFR.
  SELECT COALESCE(MAX((regexp_match(reference, '^Re-New - ' || node.code || ' - ([0-9]+)$', 'i'))[1]::BIGINT), 0) + 1
    INTO initial_sequence
    FROM public.opportunities
    WHERE reference ~* ('^Re-New - ' || node.code || ' - [0-9]+$');
  INSERT INTO public.opportunity_mandate_reference_counters(reference_code,next_sequence)
    VALUES (node.code, initial_sequence + 1)
    ON CONFLICT (reference_code) DO UPDATE SET next_sequence = public.opportunity_mandate_reference_counters.next_sequence + 1, updated_at = NOW()
    RETURNING next_sequence - 1 INTO allocated;
  generated_reference := format(
    'Re-New - %s - %s',
    node.code,
    CASE WHEN allocated < 1000 THEN LPAD(allocated::TEXT, 3, '0') ELSE allocated::TEXT END
  );
  -- p_reference is retained only for old callers; it is deliberately ignored.
  IF p_opportunity_fields ? 'date_added_confirm_day'
     AND JSONB_TYPEOF(p_opportunity_fields -> 'date_added_confirm_day') <> 'boolean' THEN
    RAISE EXCEPTION 'opportunity_date_added_confirmation_must_be_boolean';
  END IF;
  saved := public.create_opportunity_with_office_context_legacy(generated_reference,p_source_office_id,p_affiliation_ids,p_primary_affiliation_id,p_description,p_target_status,p_actor,p_opportunity_fields - ARRAY['geography_node_id', 'date_added_confirm_day']);
  UPDATE public.opportunities SET geography_node_id = node.id, updated_by = NULLIF(BTRIM(p_actor), ''), updated_at = NOW()
    WHERE id = saved.id RETURNING * INTO saved;
  RETURN saved;
END $$;

CREATE OR REPLACE FUNCTION public.activate_w039_geography_mandates(p_actor TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NULLIF(BTRIM(p_actor), '') IS NULL THEN RAISE EXCEPTION 'w039_activation_actor_required'; END IF;
  UPDATE public.ma_w039_release_control SET enforce_new_opportunity_geography = TRUE, activated_by = BTRIM(p_actor), activated_at = NOW() WHERE singleton;
END $$;

CREATE OR REPLACE FUNCTION public.replace_repreneur_geography_targets(p_repreneur_id UUID, p_stable_keys TEXT[])
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE requested_count INTEGER; resolved_count INTEGER;
BEGIN
  IF p_repreneur_id IS NULL THEN RAISE EXCEPTION 'repreneur_geography_target_repreneur_required'; END IF;
  SELECT COUNT(DISTINCT BTRIM(key)) INTO requested_count FROM UNNEST(COALESCE(p_stable_keys, ARRAY[]::TEXT[])) AS item(key) WHERE NULLIF(BTRIM(key), '') IS NOT NULL;
  SELECT COUNT(*) INTO resolved_count FROM public.geography_nodes WHERE stable_key = ANY(COALESCE(p_stable_keys, ARRAY[]::TEXT[]));
  IF requested_count <> resolved_count THEN RAISE EXCEPTION 'repreneur_geography_target_not_found'; END IF;
  DELETE FROM public.repreneur_geography_targets WHERE repreneur_id = p_repreneur_id;
  INSERT INTO public.repreneur_geography_targets(repreneur_id, geography_node_id)
    SELECT p_repreneur_id, id FROM public.geography_nodes WHERE stable_key = ANY(COALESCE(p_stable_keys, ARRAY[]::TEXT[]));
END $$;

-- This is a compatibility bridge, not Matching v2.  The legacy questionnaire
-- fields remain authoritative for every current matching rule; the trigger
-- mirrors only exact France-first values in the same profile UPDATE so a
-- failed canonical write rolls the entire profile change back.
CREATE OR REPLACE FUNCTION public.sync_repreneur_geography_targets_from_legacy()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  DELETE FROM public.repreneur_geography_targets WHERE repreneur_id = NEW.id;
  INSERT INTO public.repreneur_geography_targets(repreneur_id, geography_node_id)
  SELECT NEW.id, node.id
  FROM public.geography_nodes node
  JOIN (
    VALUES
      ('all-france', 'france'),
      ('auvergne-rhone-alpes', 'fr-region-auvergne-rhone-alpes'),
      ('bourgogne-franche-comte', 'fr-region-bourgogne-franche-comte'),
      ('bretagne', 'fr-region-brittany'),
      ('centre-val-de-loire', 'fr-region-centre-val-de-loire'),
      ('corse', 'fr-region-corsica'),
      ('dom-tom', 'fr-region-overseas'),
      ('grand-est', 'fr-region-grand-est'),
      ('hauts-de-france', 'fr-region-hauts-de-france'),
      ('ile-de-france', 'fr-region-idf'),
      ('normandie', 'fr-region-normandy'),
      ('nouvelle-aquitaine', 'fr-region-nouvelle-aquitaine'),
      ('occitanie', 'fr-region-occitanie'),
      ('pays-de-la-loire', 'fr-region-pays-de-la-loire'),
      ('paca', 'fr-region-provence-alpes-cote-d-azur')
  ) AS mapped(legacy_value, stable_key)
    ON mapped.legacy_value IN (
      SELECT jsonb_array_elements_text(
        CASE
          WHEN JSONB_TYPEOF(NEW.q12_geo_zones) = 'array'
             AND JSONB_ARRAY_LENGTH(NEW.q12_geo_zones) > 0 THEN NEW.q12_geo_zones
          WHEN JSONB_TYPEOF(NEW.target_location) = 'array' THEN NEW.target_location
          ELSE '[]'::JSONB
        END
      )
    )
  WHERE node.stable_key = mapped.stable_key;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sync_repreneur_geography_targets_from_legacy ON public.repreneurs;
CREATE TRIGGER sync_repreneur_geography_targets_from_legacy
  AFTER INSERT OR UPDATE OF q12_geo_zones, target_location ON public.repreneurs
  FOR EACH ROW EXECUTE FUNCTION public.sync_repreneur_geography_targets_from_legacy();

-- Phase B deliberately performs no big-bang adoption of current profiles.
-- The exact trigger above synchronizes only future profile writes. Any current
-- canonical-target adoption remains a separate controlled, verified operation.

ALTER TABLE public.geography_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geography_nodes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.repreneur_geography_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repreneur_geography_targets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_mandate_reference_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_mandate_reference_counters FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ma_w039_release_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ma_w039_release_control FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.geography_nodes, public.repreneur_geography_targets, public.opportunity_mandate_reference_counters, public.ma_w039_release_control FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.geography_nodes, public.repreneur_geography_targets, public.opportunity_mandate_reference_counters TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.geography_nodes, public.repreneur_geography_targets, public.opportunity_mandate_reference_counters, public.ma_w039_release_control FROM service_role;
REVOKE ALL ON FUNCTION public.validate_geography_node_parent(), public.prevent_opportunity_reference_change(), public.resolve_w039_geography_node(TEXT), public.validate_w098_date_precision_write(UUID, JSONB), public.save_opportunity_office_context_legacy(UUID, UUID, UUID[], UUID, TEXT, public.opportunity_status, TEXT, JSONB), public.create_opportunity_with_office_context_legacy(TEXT, UUID, UUID[], UUID, TEXT, public.opportunity_status, TEXT, JSONB), public.save_opportunity_office_context(UUID, UUID, UUID[], UUID, TEXT, public.opportunity_status, TEXT, JSONB), public.create_opportunity_with_office_context(TEXT, UUID, UUID[], UUID, TEXT, public.opportunity_status, TEXT, JSONB), public.replace_repreneur_geography_targets(UUID, TEXT[]), public.sync_repreneur_geography_targets_from_legacy(), public.activate_w039_geography_mandates(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_opportunity_office_context_legacy(UUID, UUID, UUID[], UUID, TEXT, public.opportunity_status, TEXT, JSONB), public.create_opportunity_with_office_context_legacy(TEXT, UUID, UUID[], UUID, TEXT, public.opportunity_status, TEXT, JSONB) FROM service_role;
GRANT EXECUTE ON FUNCTION public.save_opportunity_office_context(UUID, UUID, UUID[], UUID, TEXT, public.opportunity_status, TEXT, JSONB), public.create_opportunity_with_office_context(TEXT, UUID, UUID[], UUID, TEXT, public.opportunity_status, TEXT, JSONB), public.activate_w039_geography_mandates(TEXT) TO service_role;

-- The approved CRM adoption remains a one-time, hash-bound operation. It
-- records all 148 reviewed rows, applies only France-tree nodes, and leaves
-- foreign/unknown rows null rather than inventing a geography identity.
CREATE TABLE IF NOT EXISTS public.ma_w039_geography_adoption_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_hash TEXT NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  payload_digest TEXT NOT NULL CHECK (payload_digest ~ '^[0-9a-f]{64}$'),
  applied_by TEXT NOT NULL CHECK (NULLIF(BTRIM(applied_by), '') IS NOT NULL),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_hash)
);
CREATE TABLE IF NOT EXISTS public.ma_w039_geography_adoption_evidence (
  run_id UUID NOT NULL REFERENCES public.ma_w039_geography_adoption_runs(id) ON DELETE RESTRICT,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  source_geography_code TEXT,
  target_stable_key TEXT,
  geography_node_before UUID REFERENCES public.geography_nodes(id) ON DELETE RESTRICT,
  geography_node_after UUID REFERENCES public.geography_nodes(id) ON DELETE RESTRICT,
  location_digest TEXT NOT NULL CHECK (location_digest ~ '^[0-9a-f]{64}$'),
  outcome TEXT NOT NULL CHECK (outcome IN ('applied','already_canonical','preserved_wave_edit','review_outside_france')),
  PRIMARY KEY (run_id, opportunity_id)
);
CREATE OR REPLACE FUNCTION public.prevent_w039_geography_adoption_evidence_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$ BEGIN RAISE EXCEPTION 'w039_geography_adoption_evidence_is_immutable'; END $$;
DROP TRIGGER IF EXISTS prevent_w039_geography_adoption_evidence_mutation ON public.ma_w039_geography_adoption_evidence;
CREATE TRIGGER prevent_w039_geography_adoption_evidence_mutation BEFORE UPDATE OR DELETE ON public.ma_w039_geography_adoption_evidence FOR EACH ROW EXECUTE FUNCTION public.prevent_w039_geography_adoption_evidence_mutation();

CREATE OR REPLACE FUNCTION public.apply_w039_geography_adoption(p_source_hash TEXT, p_actor TEXT, p_payload JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE row_count INTEGER; adoption_run UUID; computed_payload_digest TEXT; changed_count INTEGER;
BEGIN
  IF p_source_hash <> 'a4b50611de0578a4a2b36f8c6da284c6e53d10b2fd4f418ab560dd31a9a0d6a5' THEN RAISE EXCEPTION 'w039_geography_source_hash_not_approved'; END IF;
  IF NULLIF(BTRIM(p_actor), '') IS NULL THEN RAISE EXCEPTION 'w039_geography_actor_required'; END IF;
  IF pg_catalog.to_regclass('public.ma_cutover_runs') IS NULL
     OR (SELECT COUNT(*) FROM public.ma_cutover_runs WHERE status = 'activated') <> 1 THEN
    RAISE EXCEPTION 'w039_geography_requires_one_activated_cutover_manifest';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ma_cutover_runs WHERE status = 'activated' AND source_hash = p_source_hash) THEN
    RAISE EXCEPTION 'w039_geography_cutover_source_hash_mismatch';
  END IF;
  CREATE TEMP TABLE IF NOT EXISTS w039_rows(reference TEXT PRIMARY KEY, source_code TEXT, target_stable_key TEXT, location_digest TEXT NOT NULL) ON COMMIT DROP;
  TRUNCATE TABLE w039_rows;
  INSERT INTO w039_rows SELECT item.value ->> 'reference', item.value ->> 'sourceGeographyCode', NULLIF(item.value ->> 'geographyStableKey',''), item.value ->> 'locationDigest' FROM JSONB_ARRAY_ELEMENTS(p_payload -> 'rows') AS item(value);
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count <> 148 OR EXISTS (SELECT 1 FROM w039_rows WHERE NULLIF(BTRIM(reference),'') IS NULL OR (source_code IS NOT NULL AND source_code !~ '^[A-Z]{2,3}$') OR location_digest !~ '^[0-9a-f]{64}$') THEN RAISE EXCEPTION 'w039_geography_payload_invalid'; END IF;
  IF EXISTS (SELECT 1 FROM w039_rows r LEFT JOIN public.geography_nodes n ON n.stable_key = r.target_stable_key WHERE r.target_stable_key IS NOT NULL AND n.id IS NULL) THEN RAISE EXCEPTION 'w039_geography_payload_unknown_france_node'; END IF;
  IF EXISTS (
    SELECT 1 FROM w039_rows row
    LEFT JOIN (VALUES
      ('FR','france'),('IDF','fr-region-idf'),('NE','fr-macro-north-east'),('GO','fr-macro-great-west'),('SO','fr-macro-south-west'),('SE','fr-macro-south-east'),('OM','fr-macro-overseas'),('AU','fr-region-auvergne-rhone-alpes'),('NA','fr-region-nouvelle-aquitaine'),('OC','fr-region-occitanie'),('PA','fr-region-provence-alpes-cote-d-azur'),('COR','fr-region-corsica'),('BR','fr-region-brittany'),('NO','fr-region-normandy'),('PL','fr-region-pays-de-la-loire'),('CVL','fr-region-centre-val-de-loire'),('HDF','fr-region-hauts-de-france'),('GE','fr-region-grand-est'),('BFR','fr-region-bourgogne-franche-comte'),('BFC','fr-region-bourgogne-franche-comte'),('DOM','fr-region-overseas')
    ) approved(source_code, stable_key) ON approved.source_code = row.source_code
    WHERE approved.stable_key IS DISTINCT FROM row.target_stable_key
  ) THEN RAISE EXCEPTION 'w039_geography_source_mapping_not_approved'; END IF;
  IF EXISTS (SELECT 1 FROM w039_rows r JOIN public.geography_nodes n ON n.stable_key = r.target_stable_key WHERE r.source_code IN ('DE','BE','ES','IT','LU','MC','NL','PT','GB','CH')) THEN RAISE EXCEPTION 'w039_geography_foreign_node_not_allowed'; END IF;
  IF (SELECT COUNT(*) FROM public.opportunities o JOIN w039_rows r ON LOWER(BTRIM(o.reference)) = LOWER(BTRIM(r.reference))) <> 148 THEN RAISE EXCEPTION 'w039_geography_live_opportunity_count_mismatch'; END IF;
  IF EXISTS (SELECT 1 FROM public.opportunities o JOIN w039_rows r ON LOWER(BTRIM(o.reference)) = LOWER(BTRIM(r.reference)) WHERE ENCODE(extensions.digest(CONVERT_TO(COALESCE(o.location,''),'UTF8'),'sha256'),'hex') <> r.location_digest) THEN RAISE EXCEPTION 'w039_geography_location_changed_after_preflight'; END IF;
  computed_payload_digest := ENCODE(extensions.digest(CONVERT_TO(p_payload::TEXT,'UTF8'),'sha256'),'hex');
  -- No run row exists to lock before the first application. Serialize by the
  -- immutable source hash so concurrent identical calls become a clean replay
  -- and a concurrent changed payload fails after the first transaction ends.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_source_hash, 92039));
  IF EXISTS (SELECT 1 FROM public.ma_w039_geography_adoption_runs run WHERE run.source_hash = p_source_hash AND run.payload_digest = computed_payload_digest) THEN
    RETURN JSONB_BUILD_OBJECT('idempotent_replay',TRUE);
  END IF;
  IF EXISTS (SELECT 1 FROM public.ma_w039_geography_adoption_runs WHERE source_hash = p_source_hash) THEN
    RAISE EXCEPTION 'w039_geography_adoption_payload_mismatch';
  END IF;
  INSERT INTO public.ma_w039_geography_adoption_runs(source_hash,payload_digest,applied_by) VALUES(p_source_hash,computed_payload_digest,p_actor) RETURNING id INTO adoption_run;
  INSERT INTO public.ma_w039_geography_adoption_evidence(run_id,opportunity_id,source_geography_code,target_stable_key,geography_node_before,geography_node_after,location_digest,outcome)
  SELECT adoption_run,o.id,r.source_code,r.target_stable_key,o.geography_node_id,CASE WHEN o.geography_node_id IS NULL THEN n.id ELSE o.geography_node_id END,r.location_digest,CASE WHEN r.target_stable_key IS NULL THEN 'review_outside_france' WHEN o.geography_node_id IS NULL THEN 'applied' WHEN o.geography_node_id = n.id THEN 'already_canonical' ELSE 'preserved_wave_edit' END
  FROM public.opportunities o JOIN w039_rows r ON LOWER(BTRIM(o.reference)) = LOWER(BTRIM(r.reference)) LEFT JOIN public.geography_nodes n ON n.stable_key = r.target_stable_key;
  UPDATE public.opportunities o SET geography_node_id = n.id, updated_by = p_actor, updated_at = NOW() FROM w039_rows r JOIN public.geography_nodes n ON n.stable_key = r.target_stable_key WHERE LOWER(BTRIM(o.reference)) = LOWER(BTRIM(r.reference)) AND o.geography_node_id IS NULL;
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  RETURN JSONB_BUILD_OBJECT('run_id',adoption_run,'applied_rows',changed_count,'idempotent_replay',FALSE);
END $$;

ALTER TABLE public.ma_w039_geography_adoption_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ma_w039_geography_adoption_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ma_w039_geography_adoption_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ma_w039_geography_adoption_evidence FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ma_w039_geography_adoption_runs, public.ma_w039_geography_adoption_evidence FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.ma_w039_geography_adoption_runs, public.ma_w039_geography_adoption_evidence TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.ma_w039_geography_adoption_runs, public.ma_w039_geography_adoption_evidence FROM service_role;
REVOKE ALL ON FUNCTION public.prevent_w039_geography_adoption_evidence_mutation(), public.apply_w039_geography_adoption(TEXT,TEXT,JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_w039_geography_adoption(TEXT,TEXT,JSONB) TO service_role;

COMMIT;
