-- Ticket #121: future-only guarded Matching 2.2 provenance. Never backfill old matches.
-- The signing key and raw inputs stay in the application server. PostgREST only
-- exposes these two service-role functions, never the private child table.
CREATE SCHEMA IF NOT EXISTS matching_private;
REVOKE ALL ON SCHEMA matching_private FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.repreneurs ADD COLUMN IF NOT EXISTS match_source_revision BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.repreneurs ADD COLUMN IF NOT EXISTS match_target_revision BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS match_source_revision BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.opportunity_matches ADD COLUMN IF NOT EXISTS match_row_revision BIGINT NOT NULL DEFAULT 0;

CREATE TABLE matching_private.match_score_provenance (
  match_id UUID PRIMARY KEY REFERENCES public.opportunity_matches(id) ON DELETE CASCADE,
  platform_scoring_version TEXT,
  platform_inputs_hmac TEXT,
  platform_scored_at TIMESTAMPTZ,
  CONSTRAINT match_score_provenance_all_or_none CHECK (
    (platform_scoring_version IS NULL AND platform_inputs_hmac IS NULL AND platform_scored_at IS NULL)
    OR (platform_scoring_version IS NOT NULL AND platform_inputs_hmac IS NOT NULL
        AND platform_inputs_hmac ~ '^[0-9a-f]{64}$' AND platform_scored_at IS NOT NULL)
  )
);
ALTER TABLE matching_private.match_score_provenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE matching_private.match_score_provenance FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE matching_private.match_score_provenance FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE matching_private.geography_taxonomy_revision (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  revision BIGINT NOT NULL DEFAULT 0
);
INSERT INTO matching_private.geography_taxonomy_revision(singleton) VALUES (TRUE)
  ON CONFLICT (singleton) DO NOTHING;
ALTER TABLE matching_private.geography_taxonomy_revision ENABLE ROW LEVEL SECURITY;
ALTER TABLE matching_private.geography_taxonomy_revision FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE matching_private.geography_taxonomy_revision FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION matching_private.bump_repreneur_match_revision()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.match_source_revision := OLD.match_source_revision + 1;
  IF NEW.q12_geo_zones IS DISTINCT FROM OLD.q12_geo_zones
     OR NEW.target_location IS DISTINCT FROM OLD.target_location THEN
    NEW.match_target_revision := OLD.match_target_revision + 1;
  ELSE
    NEW.match_target_revision := GREATEST(OLD.match_target_revision, NEW.match_target_revision);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER bump_repreneur_match_revision BEFORE UPDATE ON public.repreneurs
  FOR EACH ROW EXECUTE FUNCTION matching_private.bump_repreneur_match_revision();

CREATE OR REPLACE FUNCTION matching_private.bump_opportunity_match_revision()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.match_source_revision := OLD.match_source_revision + 1;
  RETURN NEW;
END $$;
CREATE TRIGGER bump_opportunity_match_revision BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION matching_private.bump_opportunity_match_revision();

-- The old generic updated_at trigger conflated platform scoring with a human
-- match edit. This single replacement still revisions every match update.
CREATE OR REPLACE FUNCTION matching_private.revision_match_and_preserve_human_clock()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.match_row_revision := OLD.match_row_revision + 1;
  IF CURRENT_SETTING('matching_private.guarded_platform_refresh', TRUE) = 'on'
     AND (TO_JSONB(NEW) - ARRAY['platform_score','platform_recommendation','platform_reasons','match_row_revision','updated_at'])
       = (TO_JSONB(OLD) - ARRAY['platform_score','platform_recommendation','platform_reasons','match_row_revision','updated_at']) THEN
    NEW.updated_at := OLD.updated_at;
  ELSE
    NEW.updated_at := NOW();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS update_opportunity_matches_updated_at ON public.opportunity_matches;
CREATE TRIGGER revision_match_and_preserve_human_clock BEFORE UPDATE ON public.opportunity_matches
  FOR EACH ROW EXECUTE FUNCTION matching_private.revision_match_and_preserve_human_clock();

-- A legacy application can still update the public platform fields during a
-- rollback. It cannot leave an old signed tuple attached to those new fields.
-- The guarded commit repopulates the tuple later in this same transaction.
CREATE OR REPLACE FUNCTION matching_private.invalidate_changed_platform_score()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.platform_score IS DISTINCT FROM OLD.platform_score
     OR NEW.platform_recommendation IS DISTINCT FROM OLD.platform_recommendation
     OR NEW.platform_reasons IS DISTINCT FROM OLD.platform_reasons THEN
    DELETE FROM matching_private.match_score_provenance WHERE match_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER invalidate_changed_platform_score AFTER UPDATE ON public.opportunity_matches
  FOR EACH ROW EXECUTE FUNCTION matching_private.invalidate_changed_platform_score();

CREATE OR REPLACE FUNCTION matching_private.bump_geography_taxonomy_revision()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE matching_private.geography_taxonomy_revision SET revision = revision + 1 WHERE singleton;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER bump_geography_taxonomy_revision AFTER INSERT OR UPDATE OR DELETE ON public.geography_nodes
  FOR EACH ROW EXECUTE FUNCTION matching_private.bump_geography_taxonomy_revision();

-- Keep the released legacy-target bridge but avoid rewriting memberships on
-- unrelated parent updates. The parent UPDATE already owns its row lock and
-- bumps both relevant revisions before the child rows are touched.
DROP TRIGGER IF EXISTS sync_repreneur_geography_targets_from_legacy ON public.repreneurs;
CREATE TRIGGER sync_repreneur_geography_targets_from_legacy_insert
  AFTER INSERT ON public.repreneurs FOR EACH ROW
  EXECUTE FUNCTION public.sync_repreneur_geography_targets_from_legacy();
CREATE TRIGGER sync_repreneur_geography_targets_from_legacy_update
  AFTER UPDATE OF q12_geo_zones, target_location ON public.repreneurs FOR EACH ROW
  WHEN (NEW.q12_geo_zones IS DISTINCT FROM OLD.q12_geo_zones
        OR NEW.target_location IS DISTINCT FROM OLD.target_location)
  EXECUTE FUNCTION public.sync_repreneur_geography_targets_from_legacy();

-- Canonical target replacement also takes the parent first. A revision bump
-- happens even for an identical replacement; the HMAC still judges whether
-- the effective consumed inputs actually changed.
CREATE OR REPLACE FUNCTION public.replace_repreneur_geography_targets(p_repreneur_id UUID, p_stable_keys TEXT[])
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE requested_count INTEGER; resolved_count INTEGER;
BEGIN
  IF p_repreneur_id IS NULL THEN RAISE EXCEPTION 'repreneur_geography_target_repreneur_required'; END IF;
  PERFORM 1 FROM public.repreneurs WHERE id = p_repreneur_id FOR UPDATE NOWAIT;
  IF NOT FOUND THEN RAISE EXCEPTION 'repreneur_geography_target_repreneur_not_found'; END IF;
  SELECT COUNT(DISTINCT BTRIM(key)) INTO requested_count FROM UNNEST(COALESCE(p_stable_keys, ARRAY[]::TEXT[])) AS item(key) WHERE NULLIF(BTRIM(key), '') IS NOT NULL;
  SELECT COUNT(*) INTO resolved_count FROM public.geography_nodes WHERE stable_key = ANY(COALESCE(p_stable_keys, ARRAY[]::TEXT[]));
  IF requested_count <> resolved_count THEN RAISE EXCEPTION 'repreneur_geography_target_not_found'; END IF;
  UPDATE public.repreneurs SET match_target_revision = match_target_revision + 1 WHERE id = p_repreneur_id;
  DELETE FROM public.repreneur_geography_targets WHERE repreneur_id = p_repreneur_id;
  INSERT INTO public.repreneur_geography_targets(repreneur_id, geography_node_id)
    SELECT p_repreneur_id, id FROM public.geography_nodes WHERE stable_key = ANY(COALESCE(p_stable_keys, ARRAY[]::TEXT[]));
END $$;

-- A single SQL statement supplies one MVCC view of the pair, membership,
-- taxonomy, and private provenance. No free-form profile or deal text is read.
CREATE OR REPLACE FUNCTION public.match_score_source_snapshot(p_match_id UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT JSONB_BUILD_OBJECT(
    'match', JSONB_BUILD_OBJECT('id',m.id,'repreneur_id',m.repreneur_id,'opportunity_id',m.opportunity_id,
      'revision',m.match_row_revision,'platform_score',m.platform_score,
      'platform_recommendation',m.platform_recommendation,'platform_reasons',m.platform_reasons),
    'repreneur', JSONB_BUILD_OBJECT(
      'is_demo',r.is_demo,'revision',r.match_source_revision,'target_revision',r.match_target_revision,
      'q12_geo_zones',r.q12_geo_zones,'q13_target_sectors_v2',r.q13_target_sectors_v2,
      'sector_preferences',r.sector_preferences,'target_location',r.target_location,
      'target_revenue_min_meur',r.target_revenue_min_meur,'target_revenue_max_meur',r.target_revenue_max_meur,
      'target_ebitda_min_keur',r.target_ebitda_min_keur,'target_ebitda_max_keur',r.target_ebitda_max_keur,
      'target_ebitda_margin_min_pct',r.target_ebitda_margin_min_pct,
      'target_staff_size_min',r.target_staff_size_min,'target_staff_size_max',r.target_staff_size_max),
    'opportunity', JSONB_BUILD_OBJECT(
      'is_demo',o.is_demo,'revision',o.match_source_revision,'sector',o.sector,'activity',o.activity,
      'location',o.location,'revenue_meur',o.revenue_meur,'ebitda_keur',o.ebitda_keur,
      'headcount',o.headcount,'geography_node_id',o.geography_node_id),
    'target_node_ids', COALESCE((SELECT JSONB_AGG(t.geography_node_id ORDER BY t.geography_node_id)
      FROM public.repreneur_geography_targets t WHERE t.repreneur_id = r.id),'[]'::JSONB),
    'geography_nodes', COALESCE((SELECT JSONB_AGG(JSONB_BUILD_OBJECT('id',g.id,'stable_key',g.stable_key,'parent_id',g.parent_id) ORDER BY g.id)
      FROM public.geography_nodes g),'[]'::JSONB),
    'taxonomy_revision', x.revision,
    'provenance', CASE WHEN p.match_id IS NULL THEN NULL ELSE JSONB_BUILD_OBJECT(
      'platform_scoring_version',p.platform_scoring_version,
      'platform_inputs_hmac',p.platform_inputs_hmac,
      'platform_scored_at',p.platform_scored_at) END)
  FROM public.opportunity_matches m
  JOIN public.repreneurs r ON r.id = m.repreneur_id
  JOIN public.opportunities o ON o.id = m.opportunity_id
  CROSS JOIN matching_private.geography_taxonomy_revision x
  LEFT JOIN matching_private.match_score_provenance p ON p.match_id = m.id
  WHERE m.id = p_match_id AND x.singleton;
$$;

-- Lock order is repreneur, opportunity, match, taxonomy. NOWAIT makes a
-- conflict a retryable miss, never a long-held scoring transaction.
CREATE OR REPLACE FUNCTION public.match_score_commit_guarded(
  p_match_id UUID, p_repreneur_revision BIGINT, p_opportunity_revision BIGINT,
  p_match_revision BIGINT, p_target_revision BIGINT, p_taxonomy_revision BIGINT,
  p_scoring_version TEXT, p_inputs_hmac TEXT, p_score INTEGER,
  p_recommendation public.opportunity_match_recommendation, p_reasons TEXT[]
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE ids RECORD; r RECORD; o RECORD; m RECORD; taxonomy BIGINT; previous_refresh_setting TEXT;
BEGIN
  IF p_inputs_hmac IS NULL OR p_inputs_hmac !~ '^[0-9a-f]{64}$'
     OR NULLIF(BTRIM(p_scoring_version),'') IS NULL
     OR p_score IS NULL OR p_score NOT BETWEEN 0 AND 100
     OR p_recommendation IS NULL OR p_reasons IS NULL THEN
    RAISE EXCEPTION 'match_score_payload_invalid';
  END IF;
  SELECT repreneur_id, opportunity_id INTO ids FROM public.opportunity_matches WHERE id = p_match_id;
  IF NOT FOUND THEN RETURN 'conflict'; END IF;
  SELECT id, is_demo, match_source_revision, match_target_revision INTO r
    FROM public.repreneurs WHERE id = ids.repreneur_id FOR UPDATE NOWAIT;
  IF NOT FOUND THEN RETURN 'conflict'; END IF;
  SELECT id, is_demo, match_source_revision INTO o
    FROM public.opportunities WHERE id = ids.opportunity_id FOR UPDATE NOWAIT;
  IF NOT FOUND THEN RETURN 'conflict'; END IF;
  SELECT id, repreneur_id, opportunity_id, match_row_revision INTO m
    FROM public.opportunity_matches WHERE id = p_match_id FOR UPDATE NOWAIT;
  IF NOT FOUND THEN RETURN 'conflict'; END IF;
  SELECT revision INTO taxonomy FROM matching_private.geography_taxonomy_revision
    WHERE singleton FOR UPDATE NOWAIT;
  IF m.repreneur_id IS DISTINCT FROM r.id OR m.opportunity_id IS DISTINCT FROM o.id
     OR r.is_demo IS DISTINCT FROM o.is_demo
     OR r.match_source_revision IS DISTINCT FROM p_repreneur_revision
     OR o.match_source_revision IS DISTINCT FROM p_opportunity_revision
     OR m.match_row_revision IS DISTINCT FROM p_match_revision
     OR r.match_target_revision IS DISTINCT FROM p_target_revision
     OR taxonomy IS DISTINCT FROM p_taxonomy_revision THEN
    RETURN 'conflict';
  END IF;
  previous_refresh_setting := CURRENT_SETTING('matching_private.guarded_platform_refresh', TRUE);
  PERFORM SET_CONFIG('matching_private.guarded_platform_refresh', 'on', TRUE);
  UPDATE public.opportunity_matches SET platform_score = p_score,
    platform_recommendation = p_recommendation, platform_reasons = p_reasons WHERE id = p_match_id;
  PERFORM SET_CONFIG('matching_private.guarded_platform_refresh', COALESCE(previous_refresh_setting,''), TRUE);
  INSERT INTO matching_private.match_score_provenance
    (match_id,platform_scoring_version,platform_inputs_hmac,platform_scored_at)
    VALUES (p_match_id,p_scoring_version,p_inputs_hmac,clock_timestamp())
    ON CONFLICT (match_id) DO UPDATE SET
      platform_scoring_version = EXCLUDED.platform_scoring_version,
      platform_inputs_hmac = EXCLUDED.platform_inputs_hmac,
      platform_scored_at = EXCLUDED.platform_scored_at;
  RETURN 'committed';
EXCEPTION WHEN lock_not_available THEN
  RETURN 'conflict';
END $$;

REVOKE ALL ON FUNCTION public.match_score_source_snapshot(UUID),
  public.match_score_commit_guarded(UUID,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,TEXT,TEXT,INTEGER,public.opportunity_match_recommendation,TEXT[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_score_source_snapshot(UUID),
  public.match_score_commit_guarded(UUID,BIGINT,BIGINT,BIGINT,BIGINT,BIGINT,TEXT,TEXT,INTEGER,public.opportunity_match_recommendation,TEXT[])
  TO service_role;
