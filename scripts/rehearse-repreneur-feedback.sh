#!/usr/bin/env bash
set -euo pipefail

# Ticket #229: disposable loopback PostgreSQL only. No Supabase connection.
repo_root="$(git -C "$PWD" rev-parse --show-toplevel)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
port="${RENEW_FEEDBACK_REHEARSAL_PORT:-55531}"
temp_base="${TMPDIR:-/tmp}"
cluster_dir="$(mktemp -d "$temp_base/renew-feedback-rehearsal.XXXXXX")"

cleanup() {
  if [[ ! -d "$cluster_dir" || "$cluster_dir" != "$temp_base"/renew-feedback-rehearsal.* ]]; then
    echo "Refusing cleanup outside the generated rehearsal cluster" >&2
    return
  fi
  if [[ -f "$cluster_dir/postmaster.pid" ]]; then
    "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true
  fi
  rm -rf -- "$cluster_dir"
}
trap cleanup EXIT

for binary in initdb pg_ctl createdb psql; do
  [[ -x "$pg_bin/$binary" ]] || { echo "Missing local PostgreSQL binary: $pg_bin/$binary" >&2; exit 1; }
done
"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 \
  --auth-local=trust --auth-host=trust --username=feedback_fixture_admin >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -l "$cluster_dir/postgres.log" \
  -o "-p $port -h 127.0.0.1 -k $cluster_dir" -w start >/dev/null
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" -U feedback_fixture_admin feedback_fixture
psql=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -U feedback_fixture_admin -d feedback_fixture)

"${psql[@]}" -c "
  CREATE ROLE postgres NOLOGIN;
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN BYPASSRLS;
  CREATE SCHEMA extensions;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT NULL::uuid';
" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/schema/771_extensions.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/schema/771_public_schema.sql" >/dev/null
"${psql[@]}" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role" >/dev/null

# The released W196 staff-role predicate is an independent predecessor. Copy
# only its exact signature/body into this small synthetic schema fixture; the
# feature migration itself is applied unmodified below.
"${psql[@]}" --file "$repo_root/scripts/rehearsals/repreneur-feedback-staff-predicate.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/migrations/20260929213346_repreneur_feedback.sql" >/dev/null
"${psql[@]}" --file "$repo_root/scripts/rehearsals/repreneur-feedback-after.sql" >/dev/null
if "${psql[@]}" -qAt -c "SET ROLE authenticated; SELECT count(*) FROM public.repreneur_feedback" >/dev/null 2>&1; then
  echo "Authenticated browser role unexpectedly read feedback" >&2
  exit 1
fi
if "${psql[@]}" -qAt -c "SET ROLE anon; SELECT public.purge_expired_repreneur_feedback()" >/dev/null 2>&1; then
  echo "Anonymous browser role unexpectedly invoked feedback purge" >&2
  exit 1
fi

# Two service clients race with the same version. One holds the row lock while
# the other waits; only the first may update. All output stays in the 0700
# disposable cluster and is removed by the trap.
"${psql[@]}" -qAt -c "
  BEGIN; SET ROLE service_role;
  SELECT 1 FROM public.repreneur_feedback WHERE id='fa000000-0000-4000-8000-000000000004' FOR UPDATE;
  SELECT pg_sleep(1);
  SELECT public.staff_mutate_repreneur_feedback('fa000000-0000-4000-8000-000000000004',1,'status','routed','staff-fixture','staff@example.test')->>'outcome';
  COMMIT;
" >"$cluster_dir/first.out" &
first_pid=$!
sleep 0.2
"${psql[@]}" -qAt -c "
  SET ROLE service_role;
  SELECT public.staff_mutate_repreneur_feedback('fa000000-0000-4000-8000-000000000004',1,'status','closed','staff-fixture','staff@example.test')->>'outcome';
" >"$cluster_dir/second.out" &
second_pid=$!
wait "$first_pid"
wait "$second_pid"
grep -qx 'updated' "$cluster_dir/first.out"
grep -qx 'conflict' "$cluster_dir/second.out"
"${psql[@]}" -qAt -c "SELECT status || ':' || version FROM public.repreneur_feedback WHERE id='fa000000-0000-4000-8000-000000000004'" | grep -qx 'routed:2'

echo "Ticket #229 disposable PostgreSQL feedback rehearsal passed"
