#!/usr/bin/env bash
set -euo pipefail

# Runs only against a fresh local PostgreSQL cluster below /private/tmp. This
# script accepts no project environment values and never contacts Supabase.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@16/bin}"
cluster_dir="$(mktemp -d /private/tmp/renew-w066-postgres.XXXXXX)"
port="${W066_REHEARSAL_PORT:-55463}"

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
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" w066_rehearsal

cd "$repo_root/scripts"
psql_base=("$pg_bin/psql" -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port")
"${psql_base[@]}" -d w066_rehearsal \
  -f rehearse-ma-relationship-workspace.sql

race_create_first_id="$(
  "${psql_base[@]}" -At -d w066_rehearsal \
    -c "SELECT id FROM public.opportunities WHERE reference = 'W066-RACE-CREATE-FIRST'"
)"
race_source_first_id="$(
  "${psql_base[@]}" -At -d w066_rehearsal \
    -c "SELECT id FROM public.opportunities WHERE reference = 'W066-RACE-SOURCE-FIRST'"
)"
race_source_office_id="$(
  "${psql_base[@]}" -At -d w066_rehearsal \
    -c "SELECT source_office_id FROM public.opportunities WHERE id = '$race_create_first_id'"
)"
race_other_office_id="$(
  "${psql_base[@]}" -At -d w066_rehearsal \
    -c "SELECT id FROM public.ma_offices WHERE name = 'W066 alternate office'"
)"
wait_for_blocked_session() {
  local marker="$1"
  for _ in $(seq 1 80); do
    if [ "$("${psql_base[@]}" -At -d w066_rehearsal -c "
      SELECT EXISTS (
        SELECT 1
        FROM pg_stat_activity activity
        WHERE activity.datname = 'w066_rehearsal'
          AND activity.wait_event_type = 'Lock'
      )")" = "t" ]; then
      return 0
    fi
    sleep 0.1
  done
  echo "Timed out waiting for blocked W-066 race session: $marker" >&2
  cat "$cluster_dir"/race-*.out 2>/dev/null >&2 || true
  return 1
}

# Create-first: the RPC itself takes the opportunity row lock before its insert
# trigger pauses it. The source change waits, then the W-062 parent guard
# rejects it rather than leaving a mismatched immutable interaction.
create_first_output="$cluster_dir/race-create-first.out"
source_change_output="$cluster_dir/race-source-change.out"
"${psql_base[@]}" -d w066_rehearsal -c "
  BEGIN;
  SET LOCAL ROLE service_role;
  SELECT public.create_ma_relationship_interaction(
    '$race_source_office_id', NULL, '$race_create_first_id', 'meeting', NULL, NOW(),
    'Concurrent create-first', 'The source-change session must revalidate after this commits.',
    NULL, NULL, NULL, NULL, 'bertrand-staff-user'
  );
  RESET ROLE;
  COMMIT;
" >"$create_first_output" 2>&1 &
create_first_pid=$!
sleep 0.5

"${psql_base[@]}" -d w066_rehearsal -c "
  BEGIN;
  UPDATE /* w066-race-create-first-source-change */ public.opportunities
  SET source_office_id = '$race_other_office_id'
  WHERE id = '$race_create_first_id';
  COMMIT;
" >"$source_change_output" 2>&1 &
source_change_pid=$!
wait_for_blocked_session "w066-race-create-first-source-change"
wait "$create_first_pid"
if wait "$source_change_pid"; then
  echo "Source change unexpectedly committed after concurrent relationship capture" >&2
  exit 1
fi
if ! grep -q "ma_interaction_history_blocks_source_office_change" "$source_change_output"; then
  echo "Create-first race failed for an unexpected reason" >&2
  cat "$source_change_output" >&2
  exit 1
fi

# Source-change-first: the later relationship capture waits on the opportunity
# row, then reads the committed source and rejects the stale office context.
source_first_output="$cluster_dir/race-source-first.out"
create_after_change_output="$cluster_dir/race-create-after-change.out"
"${psql_base[@]}" -d w066_rehearsal -c "
  BEGIN;
  SELECT id FROM public.opportunities WHERE id = '$race_source_first_id' FOR UPDATE;
  SELECT pg_sleep(6);
  UPDATE public.opportunities
  SET source_office_id = '$race_other_office_id'
  WHERE id = '$race_source_first_id';
  COMMIT;
" >"$source_first_output" 2>&1 &
source_first_pid=$!
sleep 0.5

"${psql_base[@]}" -d w066_rehearsal -c "
  BEGIN;
  SET LOCAL ROLE service_role;
  SELECT /* w066-race-source-first-create */ public.create_ma_relationship_interaction(
    '$race_source_office_id', NULL, '$race_source_first_id', 'meeting', NULL, NOW(),
    'Concurrent source-first', 'This stale office context must be rejected.',
    NULL, NULL, NULL, NULL, 'bertrand-staff-user'
  );
  RESET ROLE;
  COMMIT;
" >"$create_after_change_output" 2>&1 &
create_after_change_pid=$!
wait_for_blocked_session "w066-race-source-first-create"
wait "$source_first_pid"
if wait "$create_after_change_pid"; then
  echo "Relationship capture unexpectedly committed after concurrent source change" >&2
  exit 1
fi
if ! grep -q "ma_relationship_interaction_opportunity_must_match_office" "$create_after_change_output"; then
  echo "Source-first race failed for an unexpected reason" >&2
  cat "$create_after_change_output" >&2
  exit 1
fi

if [ "$("${psql_base[@]}" -At -d w066_rehearsal -c "
  SELECT COUNT(*)
  FROM public.ma_interactions interaction
  JOIN public.opportunities opportunity ON opportunity.id = interaction.opportunity_id
  WHERE interaction.office_id IS DISTINCT FROM opportunity.source_office_id
")" != "0" ]; then
  echo "Concurrent rehearsal left an interaction/source-office mismatch" >&2
  exit 1
fi

echo "W-066 two-session source-change races passed"
