#!/usr/bin/env bash
set -euo pipefail

# Runs only against a fresh local PostgreSQL cluster beneath /private/tmp. The
# caller may override PG_BIN, but this script never reads project environment
# files or accepts a remote database URL.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@16/bin}"
cluster_dir="$(mktemp -d /private/tmp/renew-w064-postgres.XXXXXX)"
port="${W064_REHEARSAL_PORT:-55464}"

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
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" w064_rehearsal

cd "$repo_root/scripts"
psql_base=("$pg_bin/psql" -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port")

"${psql_base[@]}" -d w064_rehearsal \
  -f rehearse-ma-provisional-source-foundation.sql

# A clean second application proves that every fixed identity is revalidated
# and the migration remains idempotent against its own runtime objects.
"${psql_base[@]}" -d w064_rehearsal \
  -f 079_provisional_acme_source_foundation.sql >/dev/null

expect_collision_failure() {
  local database_name="$1"
  local setup_sql="$2"
  local expected_error="$3"
  local output_file="$cluster_dir/${database_name}.out"

  "$pg_bin/createdb" -h 127.0.0.1 -p "$port" \
    -T w064_rehearsal "$database_name"
  "${psql_base[@]}" -d "$database_name" -c "$setup_sql" >/dev/null

  if "${psql_base[@]}" -d "$database_name" \
    -f 079_provisional_acme_source_foundation.sql >"$output_file" 2>&1; then
    echo "Expected W-064 rerun collision failure in $database_name" >&2
    exit 1
  fi

  if ! grep -q "$expected_error" "$output_file"; then
    echo "W-064 rerun failed for an unexpected reason in $database_name" >&2
    cat "$output_file" >&2
    exit 1
  fi
}

expect_collision_failure \
  w064_collision_firm \
  "ALTER TABLE public.ma_firms DISABLE TRIGGER guard_ma_provisional_acme_firm_identity; INSERT INTO public.ma_firms (name, status) VALUES (' Acme Co. ', 'active'); ALTER TABLE public.ma_firms ENABLE TRIGGER guard_ma_provisional_acme_firm_identity;" \
  "ma_provisional_acme_requires_exactly_one_firm"

expect_collision_failure \
  w064_collision_office \
  "ALTER TABLE public.ma_offices DISABLE TRIGGER guard_ma_provisional_acme_office_identity; INSERT INTO public.ma_offices (firm_id, name, status, is_default, city) SELECT id, ' acme paris ', 'active', FALSE, 'Paris' FROM public.ma_firms WHERE name = 'Verified Intermediary'; ALTER TABLE public.ma_offices ENABLE TRIGGER guard_ma_provisional_acme_office_identity;" \
  "ma_provisional_acme_requires_exactly_one_office"

expect_collision_failure \
  w064_collision_contact_email \
  "ALTER TABLE public.ma_contacts DISABLE TRIGGER guard_ma_provisional_bertrand_contact_identity; INSERT INTO public.ma_contacts (first_name, last_name, display_name, status, email) VALUES ('Other', 'Person', 'Other Person', 'active', ' BERTRAND.GALAS@EDU.ESCP.EU '); ALTER TABLE public.ma_contacts ENABLE TRIGGER guard_ma_provisional_bertrand_contact_identity;" \
  "ma_provisional_acme_requires_one_bertrand_contact"

expect_collision_failure \
  w064_collision_contact_name \
  "ALTER TABLE public.ma_contacts DISABLE TRIGGER guard_ma_provisional_bertrand_contact_identity; INSERT INTO public.ma_contacts (first_name, last_name, display_name, status, email) VALUES ('Bertrand', 'Galas', ' bertrand galas ', 'active', 'other@example.test'); ALTER TABLE public.ma_contacts ENABLE TRIGGER guard_ma_provisional_bertrand_contact_identity;" \
  "ma_provisional_acme_requires_one_bertrand_contact"

expect_collision_failure \
  w064_collision_staff \
  "INSERT INTO public.app_user_roles (user_id, email, role) VALUES ('fixture-duplicate', ' BERTRAND.GALAS@EDU.ESCP.EU ', 'staff');" \
  "ma_provisional_acme_requires_one_bertrand_staff_identity"

# Race proof: assignment obtains the shared readiness lock first. A concurrent
# approval waits, then observes the committed review requirement and fails.
race_opportunity_id="$(
  "${psql_base[@]}" -At -d w064_rehearsal \
    -c "SELECT id FROM public.opportunities WHERE reference = 'W064-REHEARSAL-3'"
)"
race_run_id="$(
  "${psql_base[@]}" -At -d w064_rehearsal \
    -c "SELECT id FROM public.ma_cutover_runs WHERE status = 'draft' ORDER BY created_at DESC, id DESC LIMIT 1"
)"
assignment_output="$cluster_dir/race-assignment.out"
cutover_output="$cluster_dir/race-cutover.out"

"${psql_base[@]}" -d w064_rehearsal -c "
  BEGIN;
  SET LOCAL ROLE service_role;
  SELECT pg_advisory_xact_lock(
    hashtextextended('ma-provisional-source-cutover-readiness', 76064)
  );
  SELECT pg_sleep(1);
  SELECT public.assign_acme_provisional_source(
    '$race_opportunity_id',
    'fixture-race-assignment',
    'Concurrent assignment wins the readiness lock.'
  );
  SET CONSTRAINTS ALL IMMEDIATE;
  RESET ROLE;
  COMMIT;
" >"$assignment_output" 2>&1 &
assignment_pid=$!

for _ in $(seq 1 30); do
  lock_present="$(
    "${psql_base[@]}" -At -d w064_rehearsal \
      -c "SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND granted)"
  )"
  if [ "$lock_present" = "t" ]; then
    break
  fi
  sleep 0.05
done

if "${psql_base[@]}" -d w064_rehearsal -c "
  BEGIN;
  SET LOCAL ROLE service_role;
  UPDATE public.ma_cutover_runs
  SET
    status = 'approved',
    approval_digest = REPEAT('9', 64),
    approved_by = 'fixture-race-approver',
    approved_at = NOW()
  WHERE id = '$race_run_id';
  RESET ROLE;
  COMMIT;
" >"$cutover_output" 2>&1; then
  echo "Concurrent cutover approval unexpectedly succeeded" >&2
  exit 1
fi

wait "$assignment_pid"

if ! grep -q "ma_provisional_source_review_blocks_cutover_treatment" "$cutover_output"; then
  echo "Concurrent cutover approval failed for an unexpected reason" >&2
  cat "$cutover_output" >&2
  exit 1
fi

echo "W-064 clean rerun, collision reruns, and cutover race passed"
