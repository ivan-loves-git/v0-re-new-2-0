#!/usr/bin/env bash
set -euo pipefail

# Runs only against a fresh local PostgreSQL cluster below /private/tmp. This
# script accepts no project environment values and never contacts Supabase.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@16/bin}"
cluster_dir="$(mktemp -d /private/tmp/renew-w043-postgres.XXXXXX)"
port="${W043_REHEARSAL_PORT:-55443}"

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
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" w043_rehearsal

cd "$repo_root/scripts"
psql_base=("$pg_bin/psql" -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port")
"${psql_base[@]}" -d w043_rehearsal \
  -f rehearse-opportunity-nda-artifact-foundation.sql

race_output_one="$cluster_dir/race-one.out"
race_output_two="$cluster_dir/race-two.out"

# Both sessions register the first blank-template version for the same new
# opportunity. The opportunity row lock must serialize them into v1 and v2.
"${psql_base[@]}" -d w043_rehearsal -c "
  BEGIN;
  SELECT id
  FROM public.opportunities
  WHERE id = '00000000-0000-4000-8000-000000000003'
  FOR UPDATE;
  SELECT pg_sleep(2);
  SET LOCAL ROLE service_role;
  SELECT *
  FROM public.register_opportunity_nda_artifact(
    '00000000-0000-4000-8000-000000000003',
    NULL,
    'blank_template',
    'Race blank one',
    '00000000-0000-4000-8000-000000000003/nda-artifacts/blank_template/race-one.pdf',
    'race-one.pdf',
    101,
    repeat('5', 64),
    'staff@example.test'
  );
  RESET ROLE;
  COMMIT;
" >"$race_output_one" 2>&1 &
race_pid_one=$!

for _ in $(seq 1 40); do
  lock_present="$(
    "${psql_base[@]}" -At -d w043_rehearsal -c "
      SELECT EXISTS (
        SELECT 1
        FROM pg_locks lock
        JOIN pg_class relation ON relation.oid = lock.relation
        WHERE relation.relname = 'opportunities'
          AND lock.granted
      )
    "
  )"
  if [ "$lock_present" = "t" ]; then
    break
  fi
  sleep 0.05
done

"${psql_base[@]}" -d w043_rehearsal -c "
  BEGIN;
  SET LOCAL ROLE service_role;
  SELECT *
  FROM public.register_opportunity_nda_artifact(
    '00000000-0000-4000-8000-000000000003',
    NULL,
    'blank_template',
    'Race blank two',
    '00000000-0000-4000-8000-000000000003/nda-artifacts/blank_template/race-two.pdf',
    'race-two.pdf',
    102,
    repeat('6', 64),
    'staff@example.test'
  );
  RESET ROLE;
  COMMIT;
" >"$race_output_two" 2>&1 &
race_pid_two=$!

wait "$race_pid_one"
wait "$race_pid_two"

if [ "$("${psql_base[@]}" -At -d w043_rehearsal -c "
  SELECT STRING_AGG(version_number::TEXT, ',' ORDER BY version_number)
  FROM public.opportunity_nda_artifacts
  WHERE opportunity_id = '00000000-0000-4000-8000-000000000003'
    AND artifact_role = 'blank_template'
")" != "1,2" ]; then
  echo "Concurrent W-043 registrations did not serialize into versions 1 and 2" >&2
  cat "$race_output_one" "$race_output_two" >&2
  exit 1
fi

if [ "$("${psql_base[@]}" -At -d w043_rehearsal -c "
  SELECT COUNT(*)
  FROM public.opportunity_nda_artifacts later
  JOIN public.opportunity_nda_artifacts earlier
    ON earlier.id = later.supersedes_artifact_id
  WHERE later.opportunity_id = '00000000-0000-4000-8000-000000000003'
    AND later.version_number = 2
    AND earlier.version_number = 1
")" != "1" ]; then
  echo "Concurrent W-043 registrations did not retain the version chain" >&2
  exit 1
fi

if [ "$("${psql_base[@]}" -At -d w043_rehearsal -c "
  SELECT COUNT(DISTINCT document.storage_path)
  FROM public.opportunity_nda_artifacts artifact
  JOIN public.opportunity_documents document
    ON document.id = artifact.document_id
  WHERE artifact.opportunity_id = '00000000-0000-4000-8000-000000000003'
")" != "2" ]; then
  echo "Concurrent W-043 registrations reused an object path" >&2
  exit 1
fi

echo "W-043 clean rerun, immutable-path boundaries, and two-session version race passed"
