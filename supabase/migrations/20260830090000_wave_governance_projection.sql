-- W-38: immutable, manually refreshed GitHub governance projection.
-- This installs no data. The service-role-only RPC is the sole write seam.
CREATE TABLE IF NOT EXISTS public.wave_governance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_repository TEXT NOT NULL CHECK (source_repository = 're-new-team/renew-governance'),
  source_commit TEXT NOT NULL CHECK (source_commit ~ '^[0-9a-f]{40}$'),
  registry_revision TEXT NOT NULL CHECK (NULLIF(BTRIM(registry_revision), '') IS NOT NULL),
  retrieved_at TIMESTAMPTZ NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL,
  snapshot_digest TEXT NOT NULL UNIQUE CHECK (snapshot_digest ~ '^[0-9a-f]{64}$'),
  payload JSONB NOT NULL,
  validation JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  created_by TEXT NOT NULL CHECK (NULLIF(BTRIM(created_by), '') IS NOT NULL),
  UNIQUE (source_repository, source_commit, registry_revision, snapshot_digest)
);

CREATE TABLE IF NOT EXISTS public.wave_governance_projection_current (
  projection_key TEXT PRIMARY KEY DEFAULT 'current' CHECK (projection_key = 'current'),
  snapshot_id UUID NOT NULL REFERENCES public.wave_governance_snapshots(id),
  snapshot_digest TEXT NOT NULL CHECK (snapshot_digest ~ '^[0-9a-f]{64}$'),
  selected_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  selected_by TEXT NOT NULL CHECK (NULLIF(BTRIM(selected_by), '') IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS wave_governance_snapshots_id_digest_unique
  ON public.wave_governance_snapshots(id, snapshot_digest);
ALTER TABLE public.wave_governance_projection_current
  DROP CONSTRAINT IF EXISTS wave_governance_projection_current_snapshot_coherence;
ALTER TABLE public.wave_governance_projection_current
  ADD CONSTRAINT wave_governance_projection_current_snapshot_coherence
  FOREIGN KEY (snapshot_id, snapshot_digest)
  REFERENCES public.wave_governance_snapshots(id, snapshot_digest);

ALTER TABLE public.wave_governance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wave_governance_projection_current ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE VIEW public.wave_governance_projection_current_read
WITH (security_invoker = true) AS
SELECT c.projection_key, c.snapshot_id, c.snapshot_digest, s.payload, s.validation,
       s.retrieved_at, s.snapshot_at
FROM public.wave_governance_projection_current c
JOIN public.wave_governance_snapshots s
  ON s.id = c.snapshot_id AND s.snapshot_digest = c.snapshot_digest;

CREATE OR REPLACE FUNCTION public.wave_governance_history_immutable()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN RAISE EXCEPTION 'wave_governance_snapshot_history_is_immutable'; END; $$;
DROP TRIGGER IF EXISTS wave_governance_history_immutable ON public.wave_governance_snapshots;
CREATE TRIGGER wave_governance_history_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.wave_governance_snapshots
  FOR EACH STATEMENT EXECUTE FUNCTION public.wave_governance_history_immutable();

CREATE OR REPLACE FUNCTION public.apply_wave_governance_snapshot(
  p_source_commit TEXT, p_registry_revision TEXT, p_retrieved_at TIMESTAMPTZ,
  p_snapshot_at TIMESTAMPTZ, p_payload JSONB, p_validation JSONB, p_canonical_text TEXT, p_snapshot_digest TEXT, p_expected_current_digest TEXT, p_actor TEXT
) RETURNS TABLE(snapshot_id UUID, snapshot_digest TEXT, applied BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id UUID; v_current TEXT; v_digest TEXT;
BEGIN
  IF p_source_commit !~ '^[0-9a-f]{40}$' OR p_snapshot_digest !~ '^[0-9a-f]{64}$' OR NULLIF(BTRIM(p_actor), '') IS NULL OR p_validation->>'result' IS DISTINCT FROM 'valid' OR p_validation->>'schema_version' IS DISTINCT FROM '1' OR NULLIF(p_canonical_text, '') IS NULL THEN
    RAISE EXCEPTION 'wave_governance_snapshot_invalid_arguments';
  END IF;
  IF p_canonical_text::jsonb IS DISTINCT FROM (p_payload - 'retrievedAt' - 'snapshotAt') THEN RAISE EXCEPTION 'wave_governance_snapshot_canonical_payload_mismatch'; END IF;
  v_digest := ENCODE(extensions.digest(CONVERT_TO(p_canonical_text, 'UTF8'), 'sha256'), 'hex');
  IF v_digest IS DISTINCT FROM p_snapshot_digest THEN RAISE EXCEPTION 'wave_governance_snapshot_digest_mismatch'; END IF;
  IF p_payload->>'sourceRepository' IS DISTINCT FROM 're-new-team/renew-governance'
    OR p_payload->>'sourceCommit' IS DISTINCT FROM p_source_commit
    OR p_payload->>'registryRevision' IS DISTINCT FROM p_registry_revision
    OR p_payload->>'retrievedAt' IS DISTINCT FROM to_char(p_retrieved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    OR p_payload->>'snapshotAt' IS DISTINCT FROM to_char(p_snapshot_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') THEN RAISE EXCEPTION 'wave_governance_snapshot_provenance_mismatch'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('wave-governance:current', 38));
  SELECT c.snapshot_digest INTO v_current FROM public.wave_governance_projection_current c WHERE c.projection_key='current' FOR UPDATE;
  IF COALESCE(v_current, '') IS DISTINCT FROM COALESCE(p_expected_current_digest, '') THEN RAISE EXCEPTION 'wave_governance_snapshot_current_changed'; END IF;
  SELECT s.id INTO v_id FROM public.wave_governance_snapshots s WHERE s.snapshot_digest=p_snapshot_digest;
  IF v_id IS NULL THEN
    INSERT INTO public.wave_governance_snapshots(source_repository,source_commit,registry_revision,retrieved_at,snapshot_at,snapshot_digest,payload,validation,created_by)
    VALUES ('re-new-team/renew-governance',p_source_commit,p_registry_revision,p_retrieved_at,p_snapshot_at,p_snapshot_digest,p_payload,p_validation,p_actor) RETURNING id INTO v_id;
  END IF;
  IF v_current IS NOT DISTINCT FROM p_snapshot_digest THEN RETURN QUERY SELECT v_id,p_snapshot_digest,FALSE; RETURN; END IF;
  INSERT INTO public.wave_governance_projection_current(projection_key,snapshot_id,snapshot_digest,selected_by)
  VALUES ('current',v_id,p_snapshot_digest,p_actor)
  ON CONFLICT (projection_key) DO UPDATE SET snapshot_id=EXCLUDED.snapshot_id,snapshot_digest=EXCLUDED.snapshot_digest,selected_at=clock_timestamp(),selected_by=EXCLUDED.selected_by;
  RETURN QUERY SELECT v_id,p_snapshot_digest,TRUE;
END; $$;

REVOKE ALL ON TABLE public.wave_governance_snapshots, public.wave_governance_projection_current FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.wave_governance_projection_current_read FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.apply_wave_governance_snapshot(TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,JSONB,JSONB,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.wave_governance_snapshots, public.wave_governance_projection_current TO service_role;
GRANT SELECT ON TABLE public.wave_governance_projection_current_read TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_wave_governance_snapshot(TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,JSONB,JSONB,TEXT,TEXT,TEXT,TEXT) TO service_role;
