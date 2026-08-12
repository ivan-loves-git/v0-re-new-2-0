#!/usr/bin/env bash
set -euo pipefail

# Executes the exact migration-092 adoption function in a disposable local
# PostgreSQL cluster. No project credentials or live database are touched.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@16/bin}"
cluster_dir="$(mktemp -d /private/tmp/renew-w039-adoption-replay.XXXXXX)"
port="${W039_ADOPTION_REHEARSAL_PORT:-55440}"

cleanup() {
  if [ -f "$cluster_dir/postmaster.pid" ]; then
    "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true
  fi
  rm -rf "$cluster_dir"
}
trap cleanup EXIT

for binary in initdb pg_ctl createdb psql; do
  if [ ! -x "$pg_bin/$binary" ]; then
    echo "Missing PostgreSQL binary: $pg_bin/$binary" >&2
    exit 1
  fi
done

"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 --auth-local=trust --auth-host=trust >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -o "-p $port -h 127.0.0.1" -w start >/dev/null
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" w039_adoption_replay
psql_base=("$pg_bin/psql" -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -d w039_adoption_replay)

"${psql_base[@]}" <<'SQL'
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE TABLE public.ma_cutover_runs (
  status TEXT NOT NULL,
  source_hash TEXT NOT NULL
);
CREATE TABLE public.geography_nodes (
  id UUID PRIMARY KEY,
  stable_key TEXT NOT NULL UNIQUE
);
CREATE TABLE public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE,
  location TEXT,
  geography_node_id UUID REFERENCES public.geography_nodes(id),
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE public.ma_w039_geography_adoption_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_hash TEXT NOT NULL UNIQUE,
  payload_digest TEXT NOT NULL,
  applied_by TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE public.ma_w039_geography_adoption_evidence (
  run_id UUID NOT NULL REFERENCES public.ma_w039_geography_adoption_runs(id),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id),
  source_geography_code TEXT,
  target_stable_key TEXT,
  geography_node_before UUID,
  geography_node_after UUID,
  location_digest TEXT NOT NULL,
  outcome TEXT NOT NULL,
  PRIMARY KEY (run_id, opportunity_id)
);
INSERT INTO public.ma_cutover_runs (status, source_hash)
VALUES ('activated', 'a4b50611de0578a4a2b36f8c6da284c6e53d10b2fd4f418ab560dd31a9a0d6a5');
INSERT INTO public.geography_nodes (id, stable_key)
VALUES ('00000000-0000-4092-8000-000000000001', 'france');
INSERT INTO public.opportunities (reference)
SELECT 'W039-REPLAY-' || LPAD(value::TEXT, 3, '0')
FROM generate_series(1, 148) AS series(value);
SQL

awk '
  /^CREATE OR REPLACE FUNCTION public.apply_w039_geography_adoption\(/ { found = 1 }
  found { print }
  found && $0 == "END $$;" { exit }
' "$repo_root/scripts/092_france_geography_and_mandate_references.sql" | "${psql_base[@]}"

"${psql_base[@]}" <<'SQL'
DO $$
DECLARE
  source_hash CONSTANT TEXT := 'a4b50611de0578a4a2b36f8c6da284c6e53d10b2fd4f418ab560dd31a9a0d6a5';
  payload JSONB;
  changed_payload JSONB;
  first_result JSONB;
  replay_result JSONB;
BEGIN
  SELECT JSONB_BUILD_OBJECT(
    'rows',
    JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'reference', opportunity.reference,
        'sourceGeographyCode', 'FR',
        'geographyStableKey', 'france',
        'locationDigest', ENCODE(extensions.digest(CONVERT_TO('', 'UTF8'), 'sha256'), 'hex')
      ) ORDER BY opportunity.reference
    )
  ) INTO payload
  FROM public.opportunities opportunity;

  first_result := public.apply_w039_geography_adoption(source_hash, 'local-rehearsal', payload);
  IF first_result ->> 'applied_rows' <> '148' OR first_result ->> 'idempotent_replay' <> 'false' THEN
    RAISE EXCEPTION 'w039_rehearsal_first_application_mismatch';
  END IF;

  replay_result := public.apply_w039_geography_adoption(source_hash, 'local-rehearsal-retry', payload);
  IF replay_result ->> 'idempotent_replay' <> 'true' THEN
    RAISE EXCEPTION 'w039_rehearsal_identical_retry_not_idempotent';
  END IF;
  IF (SELECT COUNT(*) FROM public.ma_w039_geography_adoption_runs) <> 1
     OR (SELECT COUNT(*) FROM public.ma_w039_geography_adoption_evidence) <> 148
     OR (SELECT COUNT(*) FROM public.opportunities WHERE geography_node_id IS NOT NULL) <> 148 THEN
    RAISE EXCEPTION 'w039_rehearsal_identical_retry_duplicated_state';
  END IF;

  SELECT JSONB_BUILD_OBJECT('rows', JSONB_AGG(item.value ORDER BY item.ordinality DESC))
  INTO changed_payload
  FROM JSONB_ARRAY_ELEMENTS(payload -> 'rows') WITH ORDINALITY AS item(value, ordinality);
  BEGIN
    PERFORM public.apply_w039_geography_adoption(source_hash, 'local-rehearsal-changed', changed_payload);
    RAISE EXCEPTION 'w039_rehearsal_changed_payload_was_accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%w039_geography_adoption_payload_mismatch%' THEN RAISE; END IF;
  END;
END $$;
SQL

echo "W-039 adoption same-transaction replay rehearsal passed"
