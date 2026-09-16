#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
cluster_dir="$(mktemp -d "${TMPDIR:-/tmp}/renew-clarification-rehearsal.XXXXXX")"
port="${RENEW_CLARIFICATION_REHEARSAL_PORT:-55504}"
cleanup() {
  if [[ -f "$cluster_dir/postmaster.pid" ]]; then "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true; fi
  echo "Stopped synthetic rehearsal retained at $cluster_dir"
}
trap cleanup EXIT
"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 --auth-local=trust --auth-host=trust --username=renew_test >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -l "$cluster_dir/postgres.log" -o "-p $port -h 127.0.0.1 -k $cluster_dir" -w start >/dev/null
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" -U renew_test clarification_test
psql=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -U renew_test -d clarification_test)
"${psql[@]}" -c "CREATE ROLE postgres NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS; CREATE SCHEMA extensions; CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS 'SELECT NULL::UUID';" >/dev/null
"${psql[@]}" -f "$repo_root/supabase/schema/771_extensions.sql" >/dev/null
"${psql[@]}" -f "$repo_root/supabase/schema/771_public_schema.sql" >/dev/null
"${psql[@]}" -c "ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE; ALTER TABLE public.repreneurs ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;" >/dev/null
for migration in \
  supabase/migrations/20260827103000_w164_lifecycle_namespace_visibility.sql \
  supabase/migrations/20260829180000_w169_lifecycle_outcome_separation.sql \
  supabase/migrations/20260829203000_w169_pause_guard_scope.sql \
  scripts/117_explicit_demo_real_creation.sql \
  scripts/118_ticket_94_strict_creation_cutover.sql \
  supabase/migrations/20260911133000_w172_recommendation_response_window.sql \
  supabase/migrations/20260911180000_w175_recommendation_assignment_notification.sql \
  supabase/migrations/20260914223836_single_public_opportunity_description.sql \
  scripts/116_historical_pursuit_ledger.sql \
  supabase/migrations/20260914230430_pursuit_workbook_v4.sql \
  supabase/migrations/20260916140912_pursuit_v4_clarifications.sql; do
  "${psql[@]}" -f "$repo_root/$migration" >/dev/null
done
node "$repo_root/scripts/rehearsals/pursuit-v4-clarifications.mjs" "$port"
