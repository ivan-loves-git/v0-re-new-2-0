#!/usr/bin/env bash
set -euo pipefail

# Isolated PostgreSQL proof for #268: the activity log is append-only for the
# service role, closed to browser roles and rejects malformed rows. No project
# credentials, provider or customer records are used.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
if [ ! -x "$pg_bin/initdb" ]; then pg_bin="/opt/homebrew/opt/postgresql@16/bin"; fi
cluster_dir="$(mktemp -d "${TMPDIR:-/tmp}/renew-activity-log.XXXXXX")"
port="${ACTIVITY_LOG_REHEARSAL_PORT:-55268}"
cleanup() {
  if [ -f "$cluster_dir/postmaster.pid" ]; then "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true; fi
  case "$cluster_dir" in */renew-activity-log.*) rm -rf "$cluster_dir" ;; esac
}
trap cleanup EXIT

for binary in initdb pg_ctl createdb psql; do
  [ -x "$pg_bin/$binary" ] || { echo "Missing PostgreSQL binary: $pg_bin/$binary" >&2; exit 1; }
done
"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 --auth-local=trust --auth-host=trust --username=renew_rehearsal_admin >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -l "$cluster_dir/postgres.log" -o "-p $port -h 127.0.0.1 -k $cluster_dir" -w start >/dev/null
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" -U renew_rehearsal_admin activity_log
psql=("$pg_bin/psql" -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -U renew_rehearsal_admin -d activity_log)

"${psql[@]}" >/dev/null <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
-- Supabase's service_role bypasses RLS; privileges are what bound it here.
CREATE ROLE service_role NOLOGIN BYPASSRLS;
-- Production grants service_role every new public table by default (W-147).
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
SQL
"${psql[@]}" --file "$repo_root/supabase/migrations/20261016150000_wave_activity_events.sql" >/dev/null

"${psql[@]}" >/dev/null <<'SQL'
DO $$
DECLARE api_role text;
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.wave_activity_events'::regclass) THEN
    RAISE EXCEPTION 'rls_disabled';
  END IF;
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF has_table_privilege(api_role, 'public.wave_activity_events', 'SELECT')
       OR has_table_privilege(api_role, 'public.wave_activity_events', 'INSERT') THEN
      RAISE EXCEPTION '% can reach the activity log', api_role;
    END IF;
  END LOOP;
  IF NOT has_table_privilege('service_role', 'public.wave_activity_events', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.wave_activity_events', 'INSERT') THEN
    RAISE EXCEPTION 'service_role cannot record or read activity';
  END IF;
  IF has_table_privilege('service_role', 'public.wave_activity_events', 'UPDATE')
     OR has_table_privilege('service_role', 'public.wave_activity_events', 'DELETE')
     OR has_table_privilege('service_role', 'public.wave_activity_events', 'TRUNCATE') THEN
    RAISE EXCEPTION 'service_role can rewrite activity history';
  END IF;
END $$;
SQL

# As the API role: record and read, but never rewrite or record nonsense.
"${psql[@]}" >/dev/null <<'SQL'
SET ROLE service_role;
INSERT INTO public.wave_activity_events (action, actor_user_id, actor_role, repreneur_id, details)
VALUES ('portal.interest_declined', 'user-268', 'repreneur', '11111111-1111-4111-8111-111111111111',
        '{"reason_categories": ["geography"], "reason_text": "Synthetic rehearsal reason"}');
DO $$
BEGIN
  IF (SELECT count(*) FROM public.wave_activity_events WHERE action = 'portal.interest_declined') <> 1 THEN
    RAISE EXCEPTION 'row_not_recorded';
  END IF;
  BEGIN
    UPDATE public.wave_activity_events SET details = '{}';
    RAISE EXCEPTION 'update_allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.wave_activity_events;
    RAISE EXCEPTION 'delete_allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.wave_activity_events (action, actor_role) VALUES ('Not An Action', 'repreneur');
    RAISE EXCEPTION 'malformed_action_allowed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.wave_activity_events (action, actor_role) VALUES ('auth.signed_in', 'admin');
    RAISE EXCEPTION 'unknown_role_allowed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.wave_activity_events (action, actor_role, details) VALUES ('auth.signed_in', 'staff', '[]');
    RAISE EXCEPTION 'non_object_details_allowed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;
SQL
echo 'WAVE activity log disposable persistence checks passed.'
