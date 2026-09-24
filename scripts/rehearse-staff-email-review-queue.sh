#!/usr/bin/env bash
set -euo pipefail

# Isolated PostgreSQL proof for #186 queue transitions; no project credentials,
# persistent QA, provider, or customer records are used.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
if [ ! -x "$pg_bin/initdb" ]; then pg_bin="/opt/homebrew/opt/postgresql@16/bin"; fi
cluster_dir="$(mktemp -d "${TMPDIR:-/tmp}/renew-staff-email-review.XXXXXX")"
port="${STAFF_EMAIL_REHEARSAL_PORT:-55486}"
cleanup() {
  if [ -f "$cluster_dir/postmaster.pid" ]; then "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true; fi
  case "$cluster_dir" in */renew-staff-email-review.*) rm -rf "$cluster_dir" ;; esac
}
trap cleanup EXIT

for binary in initdb pg_ctl createdb psql; do
  [ -x "$pg_bin/$binary" ] || { echo "Missing PostgreSQL binary: $pg_bin/$binary" >&2; exit 1; }
done
"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 --auth-local=trust --auth-host=trust --username=renew_rehearsal_admin >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -l "$cluster_dir/postgres.log" -o "-p $port -h 127.0.0.1 -k $cluster_dir" -w start >/dev/null
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" -U renew_rehearsal_admin renew_review_rehearsal
psql=("$pg_bin/psql" -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -U renew_rehearsal_admin -d renew_review_rehearsal)

"${psql[@]}" >/dev/null <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE TABLE public.opportunities(id uuid PRIMARY KEY, is_demo boolean NOT NULL);
CREATE TABLE public.opportunity_matches(id uuid PRIMARY KEY, opportunity_id uuid REFERENCES public.opportunities(id));
CREATE TABLE public.opportunity_pursuit_evidence(id uuid PRIMARY KEY, match_id uuid REFERENCES public.opportunity_matches(id));
CREATE TABLE public.opportunity_ma_contacts(id uuid PRIMARY KEY);
CREATE TABLE public.app_user_roles(user_id text, role text);
INSERT INTO public.opportunities VALUES ('18600000-0000-4000-8000-000000000001',false),('18600000-0000-4000-8000-000000000002',true);
INSERT INTO public.opportunity_ma_contacts VALUES ('18600000-0000-4000-8000-000000000003');
INSERT INTO public.app_user_roles VALUES ('staff-1','staff'),('staff-2','staff'),('rep-1','repreneur');
SQL
"${psql[@]}" --file "$repo_root/scripts/121_staff_email_review_queue.sql" >/dev/null

"${psql[@]}" >/dev/null <<'SQL'
DO $$ BEGIN
 IF has_table_privilege('anon','public.staff_email_reviews','SELECT')
    OR has_table_privilege('authenticated','public.staff_email_reviews','SELECT')
    OR has_table_privilege('service_role','public.staff_email_reviews','UPDATE')
    OR has_table_privilege('service_role','public.staff_email_review_events','INSERT')
    OR has_function_privilege('anon','public.staff_email_review_reserve(uuid,integer,jsonb,text)','EXECUTE')
 THEN RAISE EXCEPTION 'review_privilege_boundary_failed'; END IF;
END $$;
SQL

review_id="$("${psql[@]}" -Atc "SELECT public.staff_email_review_prepare('ma','18600000-0000-4000-8000-000000000004','18600000-0000-4000-8000-000000000001',NULL,NULL,'18600000-0000-4000-8000-000000000003','receiver@example.test','REAL','ma_opportunity_validity_check','copy-v1','Subject','Body','[]'::jsonb,'staff-1')")"
same_id="$("${psql[@]}" -Atc "SELECT public.staff_email_review_prepare('ma','18600000-0000-4000-8000-000000000004','18600000-0000-4000-8000-000000000001',NULL,NULL,'18600000-0000-4000-8000-000000000003','receiver@example.test','REAL','ma_opportunity_validity_check','copy-v1','Subject','Body','[]'::jsonb,'staff-2')")"
[ "$review_id" = "$same_id" ] || { echo "Preparation did not reuse the same source operation" >&2; exit 1; }

# Two independent connections try to approve one visible version. The row lock
# makes the loser observe the committed version, never a second reservation.
"${psql[@]}" -Atc "BEGIN; SELECT public.staff_email_review_reserve('$review_id',1,'{\"to\":[\"receiver@example.test\"],\"subject\":\"Subject\"}'::jsonb,'staff-1'); SELECT pg_sleep(1); COMMIT;" >"$cluster_dir/first.out" 2>&1 &
first_pid=$!
sleep 0.2
if "${psql[@]}" -Atc "SELECT public.staff_email_review_reserve('$review_id',1,'{\"to\":[\"receiver@example.test\"],\"subject\":\"Subject\"}'::jsonb,'staff-2')" >"$cluster_dir/second.out" 2>&1; then
  echo "Independent stale approval unexpectedly won" >&2; exit 1
fi
wait "$first_pid"

race_ok="$("${psql[@]}" -Atc "SELECT state='sending' AND version=2 AND approved_by='staff-1' AND (SELECT count(*) FROM public.staff_email_review_events WHERE review_id='$review_id' AND event_kind='sending')=1 FROM public.staff_email_reviews WHERE id='$review_id'")"
[ "$race_ok" = "t" ] || { echo "Independent-session reservation state failed" >&2; exit 1; }

token="$("${psql[@]}" -Atc "SELECT attempt_token FROM public.staff_email_reviews WHERE id='$review_id'")"
"${psql[@]}" -Atc "SELECT public.staff_email_review_finish('$review_id','$token','uncertain',NULL,NULL,'unknown result','staff-1')" >/dev/null
"${psql[@]}" -Atc "UPDATE public.staff_email_reviews SET attempted_at=now()-interval '3 minutes' WHERE id='$review_id'" >/dev/null
if "${psql[@]}" -Atc "SELECT public.staff_email_review_reserve('$review_id',3,'{\"subject\":\"changed\"}'::jsonb,'staff-2')" >/dev/null 2>&1; then
  echo "Changed uncertain payload unexpectedly retried" >&2; exit 1
fi
"${psql[@]}" -Atc "SELECT public.staff_email_review_reserve('$review_id',3,'{\"to\":[\"receiver@example.test\"],\"subject\":\"Subject\"}'::jsonb,'staff-2')" >/dev/null
token="$("${psql[@]}" -Atc "SELECT attempt_token FROM public.staff_email_reviews WHERE id='$review_id'")"
"${psql[@]}" -Atc "SELECT public.staff_email_review_finish('$review_id','$token','uncertain',NULL,NULL,'unknown result','staff-2')" >/dev/null
"${psql[@]}" -Atc "UPDATE public.staff_email_reviews SET attempted_at=now()-interval '24 hours' WHERE id='$review_id'" >/dev/null
if "${psql[@]}" -Atc "SELECT public.staff_email_review_reserve('$review_id',5,'{\"to\":[\"receiver@example.test\"],\"subject\":\"Subject\"}'::jsonb,'staff-2')" >/dev/null 2>&1; then
  echo "Expired uncertain payload unexpectedly retried" >&2; exit 1
fi

demo_id="$("${psql[@]}" -Atc "SELECT public.staff_email_review_prepare('ma','18600000-0000-4000-8000-000000000005','18600000-0000-4000-8000-000000000002',NULL,NULL,'18600000-0000-4000-8000-000000000003','demo@example.test','DEMO','ma_opportunity_validity_check','copy-v1','Subject','Body','[]'::jsonb,'staff-1')")"
if "${psql[@]}" -Atc "SELECT public.staff_email_review_reserve('$demo_id',1,'{}'::jsonb,'staff-1')" >/dev/null 2>&1; then
  echo "DEMO draft unexpectedly reserved for delivery" >&2; exit 1
fi
"${psql[@]}" -Atc "SELECT public.staff_email_review_cancel('$demo_id',1,'Synthetic draft not needed','staff-2')" >/dev/null
echo "staff email review queue rehearsal passed: duplicate prepare, role grants, independent-session race, unchanged replay, 23h fence, DEMO denial, reasoned cancellation"
