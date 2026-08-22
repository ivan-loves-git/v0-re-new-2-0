CREATE SCHEMA IF NOT EXISTS qa_control;
REVOKE ALL ON SCHEMA qa_control FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS qa_control.schema_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  contract_version text,
  structure_fingerprint text CHECK (structure_fingerprint IS NULL OR structure_fingerprint ~ '^[0-9a-f]{64}$'),
  blocked_reason text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO qa_control.schema_state (singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS qa_control.applied_files (
  contract_version text NOT NULL,
  position integer NOT NULL CHECK (position > 0),
  path text NOT NULL CHECK (path ~ '^supabase/schema/[a-z0-9_]+\.sql$'),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  applied_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contract_version, position),
  UNIQUE (contract_version, path)
);

CREATE TABLE IF NOT EXISTS qa_control.lease (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  run_id text NOT NULL CHECK (run_id ~ '^[A-Za-z0-9][A-Za-z0-9-]{2,63}$'),
  owner_hash text NOT NULL CHECK (owner_hash ~ '^[0-9a-f]{64}$'),
  candidate_sha text NOT NULL CHECK (candidate_sha ~ '^[0-9a-f]{40}$'),
  structure_fingerprint text NOT NULL CHECK (structure_fingerprint ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'recovering')),
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(manifest) = 'object'),
  singleton_before jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(singleton_before) = 'object'),
  acquired_at timestamptz NOT NULL DEFAULT now(),
  heartbeat_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  recovery_owner_hash text CHECK (recovery_owner_hash IS NULL OR recovery_owner_hash ~ '^[0-9a-f]{64}$'),
  CHECK (expires_at > acquired_at)
);

ALTER TABLE qa_control.schema_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_control.applied_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_control.lease ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION qa_control.owner_digest(p_owner text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = pg_catalog, extensions
AS $$
  SELECT encode(extensions.digest(p_owner, 'sha256'), 'hex')
$$;

CREATE OR REPLACE FUNCTION qa_control.acquire_lease(
  p_run_id text,
  p_owner text,
  p_candidate_sha text,
  p_structure_fingerprint text,
  p_ttl_seconds integer DEFAULT 900
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, qa_control
AS $$
DECLARE
  current_lease qa_control.lease%ROWTYPE;
  owner_hash_value text := qa_control.owner_digest(p_owner);
  blocked_reason_value text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('renew-permanent-qa-lease', 20260822));
  IF p_ttl_seconds < 60 OR p_ttl_seconds > 1800 THEN
    RAISE EXCEPTION 'qa-lease-invalid-ttl';
  END IF;
  SELECT blocked_reason INTO blocked_reason_value FROM qa_control.schema_state WHERE singleton = true;
  IF blocked_reason_value IS NOT NULL THEN
    RAISE EXCEPTION 'qa-schema-blocked';
  END IF;
  SELECT * INTO current_lease FROM qa_control.lease WHERE singleton = true FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO qa_control.lease (
      singleton, run_id, owner_hash, candidate_sha, structure_fingerprint, expires_at
    ) VALUES (
      true, p_run_id, owner_hash_value, p_candidate_sha, p_structure_fingerprint,
      now() + make_interval(secs => p_ttl_seconds)
    );
    RETURN jsonb_build_object('status', 'acquired', 'runId', p_run_id);
  END IF;
  IF current_lease.status = 'active'
     AND current_lease.run_id = p_run_id
     AND current_lease.owner_hash = owner_hash_value
     AND current_lease.candidate_sha = p_candidate_sha
     AND current_lease.structure_fingerprint = p_structure_fingerprint THEN
    UPDATE qa_control.lease
    SET heartbeat_at = now(), expires_at = now() + make_interval(secs => p_ttl_seconds)
    WHERE singleton = true;
    RETURN jsonb_build_object('status', 'acquired', 'runId', p_run_id, 'idempotent', true);
  END IF;
  IF current_lease.expires_at <= now() THEN
    RETURN jsonb_build_object(
      'status', 'recovery-required',
      'runId', current_lease.run_id,
      'candidateSha', current_lease.candidate_sha,
      'structureFingerprint', current_lease.structure_fingerprint,
      'manifest', current_lease.manifest,
      'singletonBefore', current_lease.singleton_before
    );
  END IF;
  RETURN jsonb_build_object('status', 'busy', 'runId', current_lease.run_id, 'expiresAt', current_lease.expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION qa_control.claim_expired_lease(p_recovery_owner text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, qa_control
AS $$
DECLARE
  current_lease qa_control.lease%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('renew-permanent-qa-lease', 20260822));
  SELECT * INTO current_lease FROM qa_control.lease WHERE singleton = true FOR UPDATE;
  IF NOT FOUND OR current_lease.expires_at > now() THEN
    RAISE EXCEPTION 'qa-recovery-not-expired';
  END IF;
  UPDATE qa_control.lease
  SET status = 'recovering', recovery_owner_hash = qa_control.owner_digest(p_recovery_owner),
      heartbeat_at = now(), expires_at = now() + interval '15 minutes'
  WHERE singleton = true;
  RETURN jsonb_build_object(
    'runId', current_lease.run_id,
    'candidateSha', current_lease.candidate_sha,
    'structureFingerprint', current_lease.structure_fingerprint,
    'manifest', current_lease.manifest,
    'singletonBefore', current_lease.singleton_before
  );
END;
$$;

CREATE OR REPLACE FUNCTION qa_control.assert_lease_owner(p_run_id text, p_owner text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, qa_control
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM qa_control.lease
    WHERE singleton = true AND status = 'active' AND run_id = p_run_id
      AND owner_hash = qa_control.owner_digest(p_owner) AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'qa-lease-owner-mismatch';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION qa_control.persist_manifest(
  p_run_id text,
  p_owner text,
  p_manifest jsonb,
  p_singleton_before jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, qa_control
AS $$
BEGIN
  PERFORM qa_control.assert_lease_owner(p_run_id, p_owner);
  IF jsonb_typeof(p_manifest) <> 'object' OR (p_singleton_before IS NOT NULL AND jsonb_typeof(p_singleton_before) <> 'object') THEN
    RAISE EXCEPTION 'qa-manifest-invalid';
  END IF;
  UPDATE qa_control.lease
  SET manifest = p_manifest, singleton_before = coalesce(p_singleton_before, singleton_before), heartbeat_at = now()
  WHERE singleton = true;
END;
$$;

CREATE OR REPLACE FUNCTION qa_control.assert_recovery_owner(p_recovery_owner text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, qa_control
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM qa_control.lease
    WHERE singleton = true AND status = 'recovering'
      AND recovery_owner_hash = qa_control.owner_digest(p_recovery_owner)
      AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'qa-recovery-owner-mismatch';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION qa_control.heartbeat_recovery(p_recovery_owner text, p_ttl_seconds integer DEFAULT 900)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, qa_control
AS $$
BEGIN
  PERFORM qa_control.assert_recovery_owner(p_recovery_owner);
  UPDATE qa_control.lease
  SET heartbeat_at = now(), expires_at = now() + make_interval(secs => p_ttl_seconds)
  WHERE singleton = true;
END;
$$;

CREATE OR REPLACE FUNCTION qa_control.heartbeat(p_run_id text, p_owner text, p_ttl_seconds integer DEFAULT 900)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, qa_control
AS $$
BEGIN
  PERFORM qa_control.assert_lease_owner(p_run_id, p_owner);
  UPDATE qa_control.lease
  SET heartbeat_at = now(), expires_at = now() + make_interval(secs => p_ttl_seconds)
  WHERE singleton = true;
END;
$$;

CREATE OR REPLACE FUNCTION qa_control.release_lease(p_run_id text, p_owner text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, qa_control
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('renew-permanent-qa-lease', 20260822));
  PERFORM qa_control.assert_lease_owner(p_run_id, p_owner);
  DELETE FROM qa_control.lease WHERE singleton = true;
END;
$$;

CREATE OR REPLACE FUNCTION qa_control.finish_recovery(p_recovery_owner text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, qa_control
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('renew-permanent-qa-lease', 20260822));
  DELETE FROM qa_control.lease
  WHERE singleton = true AND status = 'recovering'
    AND recovery_owner_hash = qa_control.owner_digest(p_recovery_owner);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'qa-recovery-owner-mismatch';
  END IF;
END;
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA qa_control FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA qa_control FROM PUBLIC, anon, authenticated;
