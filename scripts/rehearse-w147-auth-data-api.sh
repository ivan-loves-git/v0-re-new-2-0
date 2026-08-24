#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"; bin=/opt/homebrew/opt/postgresql@16/bin; dir="$(mktemp -d /private/tmp/renew-w147.XXXXXX)"; port=55447
cleanup(){ [ -f "$dir/postmaster.pid" ] && "$bin/pg_ctl" -D "$dir" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$dir"; }; trap cleanup EXIT
"$bin/initdb" -D "$dir" --no-locale --auth-local=trust >/dev/null; "$bin/pg_ctl" -D "$dir" -o "-p $port" -w start >/dev/null; "$bin/createdb" -p "$port" w147
psql=("$bin/psql" -v ON_ERROR_STOP=1 -p "$port" -d w147)
"${psql[@]}" -c "CREATE ROLE postgres; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE TABLE notes(id serial); CREATE TABLE clipboard(id serial); CREATE TABLE pdr_feedback(id serial); CREATE TABLE pdr_goals(id serial); CREATE TABLE pdr_milestones(id serial); CREATE TABLE pdr_proposals(id serial); CREATE TABLE pdr_requests(id serial); CREATE TABLE pdr_work_cards(id serial); CREATE POLICY leaked ON notes FOR SELECT TO PUBLIC USING (true); GRANT ALL ON ALL TABLES IN SCHEMA public TO PUBLIC; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO PUBLIC; CREATE FUNCTION public.leaked() RETURNS int LANGUAGE sql AS 'SELECT 1'; GRANT EXECUTE ON FUNCTION public.leaked() TO PUBLIC;"
"${psql[@]}" -f "$root/supabase/migrations/20260824093456_close_legacy_auth_and_data_api.sql" -f "$root/scripts/verify-w147-auth-data-api.sql"
echo 'W-147 disposable effective-grant and policy rehearsal passed'
