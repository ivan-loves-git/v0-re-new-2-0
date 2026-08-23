#!/usr/bin/env bash
set -euo pipefail

# Runs solely against a disposable local PostgreSQL cluster. It does not read
# project credentials, connect to Supabase, or mutate production data.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
if [ ! -x "$pg_bin/initdb" ]; then pg_bin="/opt/homebrew/opt/postgresql@16/bin"; fi
cluster_dir="$(mktemp -d /private/tmp/renew-w131-rehearsal.XXXXXX)"
port="${W131_REHEARSAL_PORT:-55443}"

cleanup() {
  if [ -f "$cluster_dir/postmaster.pid" ]; then "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true; fi
  rm -rf "$cluster_dir"
}
trap cleanup EXIT
for binary in initdb pg_ctl createdb psql; do
  [ -x "$pg_bin/$binary" ] || { echo "Missing PostgreSQL binary: $pg_bin/$binary" >&2; exit 1; }
done

"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 --auth-local=trust --auth-host=trust >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -o "-p $port -h 127.0.0.1" -w start >/dev/null
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" w131_rehearsal
"$pg_bin/psql" -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -d w131_rehearsal --file "$repo_root/scripts/rehearse-w131-deals-reconsideration.sql"

# Also compile the migration in the sanctioned production-shaped schema after
# the W-126 predecessor migration, without inserting or changing any rows.
"$pg_bin/psql" -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -d w131_rehearsal -c "CREATE ROLE postgres NOLOGIN;" >/dev/null
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" w131_full_schema
full_psql=("$pg_bin/psql" -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -d w131_full_schema)
"${full_psql[@]}" -c "CREATE SCHEMA extensions; CREATE SCHEMA auth; CREATE TABLE auth.users (id UUID PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS 'SELECT NULL::UUID';" >/dev/null
"${full_psql[@]}" --file "$repo_root/supabase/schema/771_extensions.sql" >/dev/null
"${full_psql[@]}" --file "$repo_root/supabase/schema/771_public_schema.sql" >/dev/null
"${full_psql[@]}" --file "$repo_root/scripts/112_demo_opportunity_quarantine.sql" >/dev/null
"${full_psql[@]}" --file "$repo_root/scripts/113_deals_reconsideration.sql" >/dev/null
echo "W-131/W-136 production-shaped migration compile passed"
