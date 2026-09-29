#!/usr/bin/env bash
set -euo pipefail

# Disposable PostgreSQL only. No project environment or production connection.
repo_root="$(git rev-parse --show-toplevel)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
cluster_dir="$(mktemp -d /private/tmp/renew-ui-language.XXXXXX)"
database_name="renew_ui_language_rehearsal"
database_user="renew_ui_language_admin"
port="${UI_LANGUAGE_REHEARSAL_PORT:-55537}"

cleanup() {
  if [[ -f "$cluster_dir/postmaster.pid" ]]; then
    "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true
  fi
  if [[ "$cluster_dir" == /private/tmp/renew-ui-language.* ]]; then
    rm -rf -- "$cluster_dir"
  fi
}
trap cleanup EXIT

"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 --auth-local=trust --auth-host=trust --username="$database_user" >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -l "$cluster_dir/postgres.log" -o "-p $port -h 127.0.0.1 -k $cluster_dir" -w start >/dev/null
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" -U "$database_user" "$database_name"
psql=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -U "$database_user" -d "$database_name")

"${psql[@]}" -c "CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS; CREATE TABLE public.\"user\" (id TEXT PRIMARY KEY); INSERT INTO public.\"user\"(id) VALUES ('user-a'),('user-b');" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/migrations/20260927120000_repreneur_ui_language.sql" >/dev/null
"${psql[@]}" <<'SQL' >/dev/null
DO $$
BEGIN
  IF (SELECT count(*) FROM public.repreneur_ui_preferences) <> 0 THEN
    RAISE EXCEPTION 'migration unexpectedly backfilled accounts';
  END IF;
  IF NOT (SELECT relrowsecurity AND relforcerowsecurity
          FROM pg_class WHERE oid='public.repreneur_ui_preferences'::regclass) THEN
    RAISE EXCEPTION 'preference table RLS is not forced';
  END IF;
  IF has_table_privilege('anon', 'public.repreneur_ui_preferences', 'SELECT')
     OR has_table_privilege('authenticated', 'public.repreneur_ui_preferences', 'SELECT')
     OR has_table_privilege('authenticated', 'public.repreneur_ui_preferences', 'INSERT')
     OR NOT has_table_privilege('service_role', 'public.repreneur_ui_preferences', 'UPDATE') THEN
    RAISE EXCEPTION 'unexpected browser or service privileges';
  END IF;
END $$;
SET ROLE service_role;
INSERT INTO public.repreneur_ui_preferences(user_id,language) VALUES ('user-a','en');
UPDATE public.repreneur_ui_preferences SET language='fr' WHERE user_id='user-a';
RESET ROLE;
DO $$
BEGIN
  IF (SELECT language FROM public.repreneur_ui_preferences WHERE user_id='user-a') <> 'fr' THEN
    RAISE EXCEPTION 'preference update failed';
  END IF;
END $$;
DELETE FROM public."user" WHERE id='user-a';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.repreneur_ui_preferences WHERE user_id='user-a') THEN
    RAISE EXCEPTION 'account deletion did not remove its preference';
  END IF;
END $$;
SQL

if "${psql[@]}" -c "INSERT INTO public.repreneur_ui_preferences(user_id,language) VALUES ('user-b','de')" >/dev/null 2>&1; then
  echo "invalid UI language was accepted" >&2
  exit 1
fi
echo "repreneur UI language migration rehearsal passed"
