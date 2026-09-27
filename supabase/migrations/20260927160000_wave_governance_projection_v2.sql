-- #212 build candidate: admit validated v2 payloads while retaining immutable v1 snapshots.
-- No snapshot is written or selected by this migration.
ALTER TABLE public.wave_governance_projection_current
  ADD COLUMN IF NOT EXISTS last_validated_at TIMESTAMPTZ;

-- The existing pointer was last validated no later than its immutable snapshot.
-- Do not infer a newer GitHub check from selected_at or a page render.
UPDATE public.wave_governance_projection_current c
SET last_validated_at = s.retrieved_at
FROM public.wave_governance_snapshots s
WHERE c.snapshot_id = s.id AND c.last_validated_at IS NULL;

ALTER TABLE public.wave_governance_projection_current
  ALTER COLUMN last_validated_at SET NOT NULL;

CREATE OR REPLACE VIEW public.wave_governance_projection_current_read
WITH (security_invoker = true) AS
SELECT c.projection_key, c.snapshot_id, c.snapshot_digest,
       s.payload, s.validation, s.retrieved_at, s.snapshot_at,
       c.last_validated_at
FROM public.wave_governance_projection_current c
JOIN public.wave_governance_snapshots s
  ON s.id = c.snapshot_id AND s.snapshot_digest = c.snapshot_digest;

CREATE OR REPLACE FUNCTION public.apply_wave_governance_snapshot(
  p_source_commit TEXT, p_registry_revision TEXT, p_retrieved_at TIMESTAMPTZ,
  p_snapshot_at TIMESTAMPTZ, p_payload JSONB, p_validation JSONB, p_canonical_text TEXT, p_snapshot_digest TEXT, p_expected_current_digest TEXT, p_actor TEXT
) RETURNS TABLE(snapshot_id UUID, snapshot_digest TEXT, applied BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id UUID; v_current TEXT; v_digest TEXT;
BEGIN
  IF p_source_commit !~ '^[0-9a-f]{40}$' OR p_snapshot_digest !~ '^[0-9a-f]{64}$' OR NULLIF(BTRIM(p_actor), '') IS NULL OR p_validation->>'result' IS DISTINCT FROM 'valid' OR p_validation->>'schema_version' IS NULL OR p_validation->>'schema_version' NOT IN ('1','2') OR p_payload->>'schemaVersion' IS NULL OR p_payload->>'schemaVersion' IS DISTINCT FROM p_validation->>'schema_version' OR p_retrieved_at IS NULL OR p_snapshot_at IS NULL OR p_retrieved_at > p_snapshot_at OR p_snapshot_at > clock_timestamp() + interval '5 minutes' OR NULLIF(p_canonical_text, '') IS NULL THEN
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
  IF v_current IS NOT DISTINCT FROM p_snapshot_digest THEN
    UPDATE public.wave_governance_projection_current c
    SET last_validated_at=GREATEST(c.last_validated_at,p_retrieved_at)
    WHERE c.projection_key='current' AND c.snapshot_digest=p_snapshot_digest;
    RETURN QUERY SELECT v_id,p_snapshot_digest,FALSE;
    RETURN;
  END IF;
  INSERT INTO public.wave_governance_projection_current(projection_key,snapshot_id,snapshot_digest,selected_by,last_validated_at)
  VALUES ('current',v_id,p_snapshot_digest,p_actor,p_retrieved_at)
  ON CONFLICT (projection_key) DO UPDATE SET snapshot_id=EXCLUDED.snapshot_id,snapshot_digest=EXCLUDED.snapshot_digest,selected_at=clock_timestamp(),selected_by=EXCLUDED.selected_by,last_validated_at=EXCLUDED.last_validated_at;
  RETURN QUERY SELECT v_id,p_snapshot_digest,TRUE;
END; $$;
