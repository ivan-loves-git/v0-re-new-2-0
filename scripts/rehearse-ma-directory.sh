#!/usr/bin/env bash
set -euo pipefail

# #257 / #260: local disposable PostgreSQL; only synthetic records, no credentials.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
cluster_dir="$(mktemp -d "${TMPDIR:-/tmp}/renew-ma-directory.XXXXXX")"
port="${MA_DIRECTORY_REHEARSAL_PORT:-55597}"
cleanup() {
  [ ! -f "$cluster_dir/postmaster.pid" ] || "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true
  case "$cluster_dir" in */renew-ma-directory.*) rm -rf -- "$cluster_dir" ;; esac
}
trap cleanup EXIT
"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 --auth-local=trust --auth-host=trust --username=renew_directory_admin >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -l "$cluster_dir/postgres.log" -o "-p $port -h 127.0.0.1 -k $cluster_dir" -w start >/dev/null
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" -U renew_directory_admin directory
psql=("$pg_bin/psql" -X -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -U renew_directory_admin -d directory)
"${psql[@]}" -c "CREATE ROLE postgres NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS; CREATE SCHEMA auth; CREATE SCHEMA extensions; CREATE TABLE auth.users(id UUID PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS 'SELECT NULL::UUID';" >/dev/null
"${psql[@]}" -f "$repo_root/supabase/schema/771_extensions.sql" >/dev/null
"${psql[@]}" -f "$repo_root/supabase/schema/771_public_schema.sql" >/dev/null
"${psql[@]}" -f "$repo_root/supabase/schema/823_staff_ma_relationship_corrections.sql" >/dev/null
"${psql[@]}" --single-transaction -f "$repo_root/supabase/migrations/20260825072313_w157_single_office_per_contact.sql" >/dev/null
"${psql[@]}" -f "$repo_root/scripts/rehearsals/ma-directory-legacy.sql" >/dev/null
migration="$repo_root/supabase/migrations/20261007140000_staff_ma_directory_profiles.sql"
[ ! -f "$migration" ] || "${psql[@]}" --single-transaction -f "$migration" >/dev/null
status_migration="$repo_root/supabase/migrations/20261007193000_ma_firm_operational_status.sql"
# Induce a normalization failure and prove that the atomic migration restores
# the old rows/default and never leaves the profile clock trigger suspended.
"${psql[@]}" <<'SQL' >/dev/null
CREATE FUNCTION public.fixture_reject_normalization() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'fixture_expected_normalization_failure'; END $$;
CREATE TRIGGER fixture_reject_normalization BEFORE UPDATE ON public.ma_firms
  FOR EACH ROW WHEN (OLD.status='prospect') EXECUTE FUNCTION public.fixture_reject_normalization();
SQL
if "${psql[@]}" -f "$status_migration" >"$cluster_dir/normalization-failure.log" 2>&1; then
  echo 'Normalization failure probe unexpectedly committed.' >&2; exit 1
fi
grep -q fixture_expected_normalization_failure "$cluster_dir/normalization-failure.log"
"${psql[@]}" <<'SQL' >/dev/null
DROP TRIGGER fixture_reject_normalization ON public.ma_firms;
DROP FUNCTION public.fixture_reject_normalization();
CREATE FUNCTION public.fixture_assert_status_rollback() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT to_jsonb(f) FROM public.ma_firms f WHERE id='26200000-0000-4000-8000-000000000001')
      IS DISTINCT FROM (SELECT row FROM public.fixture_directory_retained WHERE entity='firm' AND id='26200000-0000-4000-8000-000000000001')
    OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.ma_firms'::regclass AND tgname='update_ma_firms_updated_at' AND tgenabled='O')
    OR (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='ma_firms' AND column_name='status') IS DISTINCT FROM '''prospect''::text'
    OR to_regprocedure('public.normalize_ma_firm_legacy_creation_status()') IS NOT NULL
  THEN RAISE EXCEPTION 'normalization_rollback_changed_original_state'; END IF;
END $$;
SELECT public.fixture_assert_status_rollback();
SQL
# Same migration, with its final commit changed to rollback for the disposable
# preflight. Its SET CONSTRAINTS ALL IMMEDIATE still exercises commit invariants.
awk '$0=="COMMIT;" {$0="ROLLBACK;"; commits++} {print} END {if(commits!=1) exit 1}' "$status_migration" >"$cluster_dir/status-preflight.sql"
"${psql[@]}" -f "$cluster_dir/status-preflight.sql" >/dev/null
"${psql[@]}" -c 'SELECT public.fixture_assert_status_rollback();' >/dev/null
"${psql[@]}" -f "$status_migration" >/dev/null
# A repeated install performs no second data rewrite and retains every value.
"${psql[@]}" -f "$status_migration" >/dev/null
"${psql[@]}" -f "$repo_root/scripts/rehearsals/ma-directory.sql"
wait_for_fence() {
  local application_name="$1"
  for attempt in {1..150}; do
    [ "$("${psql[@]}" -Atc "SELECT count(*) FROM pg_stat_activity WHERE application_name='$application_name' AND wait_event='PgSleep'")" != 1 ] || return 0
    sleep 0.02
  done
  echo 'The first duplicate transaction never acquired its fence.' >&2
  exit 1
}
PGAPPNAME=directory-firm-race "${psql[@]}" >"$cluster_dir/firm-race.log" 2>&1 <<'SQL' &
BEGIN;
SET LOCAL ROLE service_role;
SELECT * FROM public.create_ma_firm_with_first_office('Synthetic race firm','Central','Lyon',FALSE,NULL,NULL,NULL,NULL,NULL,'staff-257');
SELECT pg_sleep(1);
COMMIT;
SQL
race_pid=$!
wait_for_fence directory-firm-race
"${psql[@]}" -c "SET statement_timeout='5s'; SELECT public.fixture_directory_reject(\$q\$SELECT public.create_ma_firm_with_first_office(' synthetic RACE firm ','Central','Lyon',FALSE,NULL,NULL,NULL,NULL,NULL,'staff-257')\$q\$,'ma_firm_name_already_exists');" >/dev/null
wait "$race_pid" || { cat "$cluster_dir/firm-race.log" >&2; exit 1; }
PGAPPNAME=directory-office-race "${psql[@]}" >"$cluster_dir/office-race.log" 2>&1 <<'SQL' &
BEGIN;
SET LOCAL ROLE service_role;
SELECT * FROM public.create_ma_office_for_existing_firm('25700000-0000-4000-8000-000000000001','Synthetic race office','Lille','staff-257');
SELECT pg_sleep(1);
COMMIT;
SQL
race_pid=$!
wait_for_fence directory-office-race
"${psql[@]}" -c "SET statement_timeout='5s'; SELECT public.fixture_directory_reject(\$q\$SELECT public.create_ma_office_for_existing_firm('25700000-0000-4000-8000-000000000001',' synthetic RACE office ','Lille','staff-257')\$q\$,'ma_real_office_name_already_exists');" >/dev/null
wait "$race_pid" || { cat "$cluster_dir/office-race.log" >&2; exit 1; }
"${psql[@]}" -c "DO \$\$ BEGIN IF (SELECT count(*) FROM public.ma_firms WHERE lower(btrim(name))='synthetic race firm')<>1 OR (SELECT count(*) FROM public.ma_offices WHERE lower(btrim(name))='synthetic race office')<>1 THEN RAISE EXCEPTION 'duplicate_race_left_duplicate_records'; END IF; END \$\$;" >/dev/null
MA_QA_DATABASE_URL="postgresql://renew_directory_admin@127.0.0.1:$port/directory" node --import tsx "$repo_root/scripts/rehearsals/ma-directory-proof.ts"
echo 'M&A directory disposable persistence checks passed.'
