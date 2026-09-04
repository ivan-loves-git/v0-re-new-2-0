#!/usr/bin/env bash
set -euo pipefail

# Disposable PG17 proof for Ticket #104. It never reads the private production
# manifest. A temporary copy of the migration replaces only the fixed digest
# with the digest of this synthetic nine-row fixture; the checked-in migration
# is never modified.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
cluster_dir="$(mktemp -d /tmp/renew-ticket-104.XXXXXX)"
port="${TICKET_104_REHEARSAL_PORT:-55496}"
tmp_migration="$(mktemp /tmp/ticket-104-migration.XXXXXX.sql)"
cleanup() {
  "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$cluster_dir" "$tmp_migration"
}
trap cleanup EXIT

"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 --auth-local=trust --auth-host=trust >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -o "-p $port -h 127.0.0.1" -w start >/dev/null
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" ticket104
psql=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -d ticket104)

"${psql[@]}" -c "CREATE ROLE postgres NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS; CREATE ROLE ticket_104_public_probe NOLOGIN; CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid primary key); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT NULL::uuid';" >/dev/null
"${psql[@]}" -f "$repo_root/supabase/schema/771_extensions.sql" >/dev/null
"${psql[@]}" -f "$repo_root/supabase/schema/771_public_schema.sql" >/dev/null
"${psql[@]}" -c "ALTER TABLE public.opportunities ADD COLUMN is_demo boolean NOT NULL DEFAULT false; ALTER TABLE public.repreneurs ADD COLUMN is_demo boolean NOT NULL DEFAULT false;" >/dev/null

# Seed nine synthetic cross-namespace rows: six non-active, one active pursuit,
# and two terminal. The SQL below deliberately builds its manifest with the
# exact Postgres concat_ws/UTC serialization used in production.
"${psql[@]}" <<'SQL' >/dev/null
SET session_replication_role=replica;
INSERT INTO public.ma_firms(id,name,status,created_by) VALUES ('10000000-0000-4000-8000-000000009001','T104 Firm','active','fixture');
INSERT INTO public.ma_offices(id,firm_id,name,status,is_default,created_by) VALUES ('10000000-0000-4000-8000-000000009002','10000000-0000-4000-8000-000000009001','T104 Office','active',TRUE,'fixture');
INSERT INTO public.opportunities(id,reference,status,source_office_id,created_by,is_demo,updated_at) SELECT ('10000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'T104-'||i,'active','10000000-0000-4000-8000-000000009002','fixture',i%2=0,'2026-09-04 10:00:00+00'::timestamptz FROM generate_series(1,9) i;
INSERT INTO public.repreneurs(id,email,first_name,last_name,created_by,is_demo,updated_at) SELECT ('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'t104-'||i||'@example.test','T104',i::text,'fixture',i%2<>0,'2026-09-04 10:00:00+00'::timestamptz FROM generate_series(1,9) i;
INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,pursuit_stage,created_by,updated_at) SELECT ('30000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('10000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,CASE WHEN i=7 THEN 'active_pursuit'::public.opportunity_match_status WHEN i=8 THEN 'completed'::public.opportunity_match_status WHEN i=9 THEN 'declined'::public.opportunity_match_status ELSE 'proposed'::public.opportunity_match_status END,CASE WHEN i=7 THEN 'interest'::public.opportunity_pursuit_stage WHEN i=8 THEN 'closed'::public.opportunity_pursuit_stage END,'fixture','2026-09-04 10:00:00+00'::timestamptz FROM generate_series(1,9) i;
-- One immutable pre-existing row for every guarded dependent relation.  The
-- fixture uses replica mode only to establish historical malformed namespace
-- data; the Ticket #104 mutation itself executes through real guards.
INSERT INTO public.opportunity_pursuit_events(match_id,opportunity_id,repreneur_id,stage,note,created_by) VALUES ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','interest','historic event','fixture');
INSERT INTO public.opportunity_pursuit_evidence(match_id,opportunity_id,repreneur_id,event_type,actor,idempotency_key) VALUES ('30000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000007','20000000-0000-4000-8000-000000000007','mutual_interest_validated','fixture','fixture:mutual-interest');
INSERT INTO public.opportunity_pursuit_confidential_grants(match_id,opportunity_id,information_memo_document_id,source_firm_id,source_firm_name,source_office_id,source_office_name,disclosed_contacts,granted_by,revoked_at,revoked_by,revoked_reason) VALUES ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000008002','10000000-0000-4000-8000-000000009001','T104 Firm','10000000-0000-4000-8000-000000009002','T104 Office','[]'::jsonb,'fixture','2026-09-04 10:01:00+00','fixture','historic');
INSERT INTO public.opportunity_nda_artifacts(opportunity_id,match_id,document_id,artifact_role,version_number,content_sha256,recorded_by) VALUES ('10000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000008003','renew_signed_copy',1,repeat('a',64),'fixture');
INSERT INTO public.opportunity_memo_notifications(match_id,opportunity_id,repreneur_id,recipient_email) VALUES ('30000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000004','fixture@example.test');
RESET session_replication_role;
INSERT INTO public.wave_journey_settings(singleton,enabled,updated_by) VALUES(TRUE,TRUE,'fixture');
SQL

"${psql[@]}" -f "$repo_root/supabase/migrations/20260827103000_w164_lifecycle_namespace_visibility.sql" >/dev/null
"${psql[@]}" -f "$repo_root/supabase/migrations/20260829180000_w169_lifecycle_outcome_separation.sql" >/dev/null
"${psql[@]}" -f "$repo_root/supabase/migrations/20260829203000_w169_pause_guard_scope.sql" >/dev/null

# Full behavioral assertions (success, replay, privilege and all drift/rollback
# cases) are executed by the companion SQL generated from this same fixture in
# CI; keeping the manifest generated in PostgreSQL prevents JS serialization.
cp "$repo_root/scripts/119_ticket_104_cross_namespace_drop.sql" "$tmp_migration"
fixture_manifest=$("${psql[@]}" -Atq <<'SQL'
WITH rows AS (
 SELECT m.id match_id,m.opportunity_id,m.repreneur_id,m.status match_status,m.pursuit_stage,
  m.updated_at match_updated_at,o.updated_at opportunity_updated_at,r.updated_at repreneur_updated_at,
  jsonb_build_object('pursuit_events',(SELECT count(*) FROM public.opportunity_pursuit_events x WHERE x.match_id=m.id),'pursuit_evidence',(SELECT count(*) FROM public.opportunity_pursuit_evidence x WHERE x.match_id=m.id),'confidential_grants',(SELECT count(*) FROM public.opportunity_pursuit_confidential_grants x WHERE x.match_id=m.id),'nda_artifacts',(SELECT count(*) FROM public.opportunity_nda_artifacts x WHERE x.match_id=m.id),'memo_notifications',(SELECT count(*) FROM public.opportunity_memo_notifications x WHERE x.match_id=m.id)) dependent_rows,
  CASE WHEN o.is_demo THEN 'DEMO_to_REAL' ELSE 'REAL_to_DEMO' END namespace_direction,
  CASE WHEN m.status IN ('dropped','declined','completed') THEN 'retain_immutable' ELSE 'decision_required_quarantine_to_dropped' END proposed_treatment,
  encode(extensions.digest(convert_to(concat_ws('|',m.id,m.status,COALESCE(m.pursuit_stage::text,''),m.opportunity_id,o.is_demo,m.repreneur_id,r.is_demo,to_char(m.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),to_char(o.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),to_char(r.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),(SELECT count(*) FROM public.opportunity_pursuit_events x WHERE x.match_id=m.id),(SELECT count(*) FROM public.opportunity_pursuit_evidence x WHERE x.match_id=m.id),(SELECT count(*) FROM public.opportunity_pursuit_confidential_grants x WHERE x.match_id=m.id),(SELECT count(*) FROM public.opportunity_nda_artifacts x WHERE x.match_id=m.id),(SELECT count(*) FROM public.opportunity_memo_notifications x WHERE x.match_id=m.id)),'UTF8'),'sha256'),'hex') row_fingerprint
 FROM public.opportunity_matches m JOIN public.opportunities o ON o.id=m.opportunity_id JOIN public.repreneurs r ON r.id=m.repreneur_id
), digest AS (SELECT encode(extensions.digest(convert_to(string_agg(concat_ws('|',match_id,row_fingerprint),E'\n' ORDER BY match_id),'UTF8'),'sha256'),'hex') value FROM rows)
SELECT jsonb_build_object('schema_version','issue-103-cross-namespace-manifest/v1','manifest_digest',digest.value,'rows',jsonb_agg(to_jsonb(rows))) FROM rows,digest GROUP BY digest.value;
SQL
)
fixture_digest=$(printf '%s' "$fixture_manifest" | jq -r '.manifest_digest')
test -n "$fixture_digest" && test "$fixture_digest" != null
perl -0pi -e "s/11445554185917f4604d2f5dfd4b845ca5ec55c96e9757d01e40d3905da52f18/$fixture_digest/g" "$tmp_migration"
"${psql[@]}" -f "$tmp_migration" >/dev/null
call_apply() { printf "%s\n" "SET ROLE service_role; SELECT * FROM public.apply_ticket_104_cross_namespace_drop('$1'::jsonb,'migration:ticket-104');" | "${psql[@]}" -Atq; }
must_fail() { if call_apply "$1" >/dev/null 2>&1; then echo "ticket_104_expected_failure_missing:$2" >&2; exit 1; fi; }

# Every negative case is exercised before the successful one-shot run, so the
# function cannot short-circuit through its idempotent replay branch.
must_fail "$(printf '%s' "$fixture_manifest" | jq '.manifest_digest="00"')" bad_digest
must_fail "$(printf '%s' "$fixture_manifest" | jq '.rows[0].row_fingerprint="00"')" row_fingerprint
must_fail "$(printf '%s' "$fixture_manifest" | jq '.rows[0].dependent_rows.pursuit_events += 1')" dependent_count
"${psql[@]}" -c "SET session_replication_role=replica; INSERT INTO public.opportunities(id,reference,status,source_office_id,created_by,is_demo) VALUES ('40000000-0000-4000-8000-000000000001','T104-extra','active','10000000-0000-4000-8000-000000009002','fixture',true); INSERT INTO public.repreneurs(id,email,first_name,last_name,created_by,is_demo) VALUES ('50000000-0000-4000-8000-000000000001','extra@example.test','Extra','Fixture','fixture',false); INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,created_by) VALUES ('60000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','proposed','fixture'); RESET session_replication_role;" >/dev/null
must_fail "$fixture_manifest" global_extra
"${psql[@]}" -c "SET session_replication_role=replica; DELETE FROM public.opportunity_matches WHERE id='60000000-0000-4000-8000-000000000001'; RESET session_replication_role;" >/dev/null
"${psql[@]}" -c "SET session_replication_role=replica; UPDATE public.repreneurs SET is_demo=false WHERE id='20000000-0000-4000-8000-000000000001'; RESET session_replication_role;" >/dev/null
must_fail "$fixture_manifest" global_missing
"${psql[@]}" -c "SET session_replication_role=replica; UPDATE public.repreneurs SET is_demo=true WHERE id='20000000-0000-4000-8000-000000000001'; RESET session_replication_role;" >/dev/null
"${psql[@]}" -c "SET session_replication_role=replica; UPDATE public.opportunity_matches SET updated_at=updated_at+interval '1 microsecond' WHERE id='30000000-0000-4000-8000-000000000001'; RESET session_replication_role;" >/dev/null
must_fail "$fixture_manifest" state_drift
"${psql[@]}" -c "SET session_replication_role=replica; UPDATE public.opportunity_matches SET updated_at=updated_at-interval '1 microsecond' WHERE id='30000000-0000-4000-8000-000000000001'; RESET session_replication_role;" >/dev/null
"${psql[@]}" -c "SET session_replication_role=replica; INSERT INTO public.opportunity_pursuit_confidential_grants(match_id,opportunity_id,information_memo_document_id,source_firm_id,source_firm_name,source_office_id,source_office_name,disclosed_contacts,granted_by,revoked_at) VALUES ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000008001','10000000-0000-4000-8000-000000009001','T104 Firm','10000000-0000-4000-8000-000000009002','T104 Office','[]'::jsonb,'fixture',NULL); RESET session_replication_role;" >/dev/null
must_fail "$fixture_manifest" unrevoked_grant
"${psql[@]}" -c "SET session_replication_role=replica; DELETE FROM public.opportunity_pursuit_confidential_grants WHERE revoked_at IS NULL; RESET session_replication_role;" >/dev/null
for role in anon authenticated ticket_104_public_probe; do if "${psql[@]}" -Atq -c "SELECT has_function_privilege('$role','public.apply_ticket_104_cross_namespace_drop(jsonb,text)','EXECUTE');" | grep -qx t; then echo "ticket_104_privilege_leak:$role" >&2; exit 1; fi; done
# ticket_104_public_probe receives no grants, so it proves that PUBLIC itself
# cannot execute the RPC, independently of anon/authenticated.
"${psql[@]}" <<'SQL' >/dev/null
CREATE FUNCTION public.ticket_104_rehearsal_forced_failure() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.event_type = 'dropped' THEN RAISE EXCEPTION 'ticket_104_forced_post_first_write_failure'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER ticket_104_rehearsal_forced_failure AFTER INSERT ON public.opportunity_pursuit_evidence FOR EACH ROW EXECUTE FUNCTION public.ticket_104_rehearsal_forced_failure();
SQL
must_fail "$fixture_manifest" forced_post_first_write_failure
"${psql[@]}" -Atq -c "SELECT count(*) FROM public.ticket_104_cross_namespace_drop_runs; SELECT count(*) FROM public.ticket_104_cross_namespace_drop_before_images; SELECT count(*) FROM public.opportunity_matches WHERE status='dropped'; SELECT count(*) FROM public.opportunity_pursuit_evidence;" | tr '\n' ' ' | grep -qx '0 0 0 1 '
"${psql[@]}" -c "DROP TRIGGER ticket_104_rehearsal_forced_failure ON public.opportunity_pursuit_evidence; DROP FUNCTION public.ticket_104_rehearsal_forced_failure();" >/dev/null
apply_result=$(printf "%s\n" "SET ROLE service_role; SELECT outcome||'|'||dropped_count||'|'||evidence_added FROM public.apply_ticket_104_cross_namespace_drop('$fixture_manifest'::jsonb,'migration:ticket-104');" | "${psql[@]}" -Atq)
test "$apply_result" = 'applied|7|2'
"${psql[@]}" -c "SET session_replication_role=replica; INSERT INTO public.opportunities(id,reference,status,source_office_id,created_by,is_demo) VALUES ('40000000-0000-4000-8000-000000000002','T104-replay-extra','active','10000000-0000-4000-8000-000000009002','fixture',true); INSERT INTO public.repreneurs(id,email,first_name,last_name,created_by,is_demo) VALUES ('50000000-0000-4000-8000-000000000002','replay-extra@example.test','Extra','Replay','fixture',false); INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,created_by) VALUES ('60000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000002','dropped','fixture'); RESET session_replication_role;" >/dev/null
must_fail "$fixture_manifest" replay_global_extra
"${psql[@]}" -c "SET session_replication_role=replica; DELETE FROM public.opportunity_matches WHERE id='60000000-0000-4000-8000-000000000002'; RESET session_replication_role;" >/dev/null
replay_result=$(printf "%s\n" "SET ROLE service_role; SELECT outcome||'|'||dropped_count||'|'||evidence_added FROM public.apply_ticket_104_cross_namespace_drop('$fixture_manifest'::jsonb,'migration:ticket-104');" | "${psql[@]}" -Atq)
test "$replay_result" = 'already_applied|7|2'
"${psql[@]}" -Atq -c "SELECT count(*) FROM public.opportunity_matches WHERE status='dropped';" | grep -qx 7
"${psql[@]}" -Atq -c "SELECT string_agg(event_type::text,',' ORDER BY event_type::text) FROM public.opportunity_pursuit_evidence;" | grep -qx 'access_revoked,dropped,mutual_interest_validated'
if "${psql[@]}" -c "UPDATE public.opportunity_matches SET status='proposed' WHERE id='30000000-0000-4000-8000-000000000001';" >/dev/null 2>&1; then
  echo 'ticket_104_direct_cross_namespace_update_allowed' >&2; exit 1
fi
if "${psql[@]}" -c "INSERT INTO public.opportunity_pursuit_evidence(match_id,opportunity_id,repreneur_id,event_type,actor,idempotency_key) VALUES ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','dropped','attacker','ticket-104-direct-child');" >/dev/null 2>&1; then
  echo 'ticket_104_direct_cross_namespace_child_insert_allowed' >&2; exit 1
fi
"${psql[@]}" -c "SET session_replication_role=replica; UPDATE public.opportunity_pursuit_events SET note='tampered' WHERE match_id='30000000-0000-4000-8000-000000000001'; RESET session_replication_role;" >/dev/null
if printf "%s\n" "SET ROLE service_role; SELECT public.finalize_ticket_104_cross_namespace_drop('$fixture_digest','migration:ticket-104');" | "${psql[@]}" -Atq >/dev/null 2>&1; then
  echo 'ticket_104_finalizer_accepted_changed_existing_child' >&2; exit 1
fi
"${psql[@]}" -c "SET session_replication_role=replica; UPDATE public.opportunity_pursuit_events SET note='historic event' WHERE match_id='30000000-0000-4000-8000-000000000001'; RESET session_replication_role;" >/dev/null
"${psql[@]}" -c "SET session_replication_role=replica; INSERT INTO public.opportunity_pursuit_events(match_id,opportunity_id,repreneur_id,stage,created_by) VALUES ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','interest','tamper-fixture'); RESET session_replication_role;" >/dev/null
if printf "%s\n" "SET ROLE service_role; SELECT public.finalize_ticket_104_cross_namespace_drop('$fixture_digest','migration:ticket-104');" | "${psql[@]}" -Atq >/dev/null 2>&1; then
  echo 'ticket_104_finalizer_accepted_new_non_evidence_child' >&2; exit 1
fi
"${psql[@]}" -c "SET session_replication_role=replica; DELETE FROM public.opportunity_pursuit_events WHERE match_id='30000000-0000-4000-8000-000000000001' AND created_by='tamper-fixture'; RESET session_replication_role;" >/dev/null
finalize_result=$(printf "%s\n" "SET ROLE service_role; SELECT public.finalize_ticket_104_cross_namespace_drop('$fixture_digest','migration:ticket-104') IS NOT NULL;" | "${psql[@]}" -Atq)
test "$finalize_result" = t
if call_apply "$fixture_manifest" >/dev/null 2>&1; then echo 'ticket_104_apply_reopened_after_finalization' >&2; exit 1; fi
"${psql[@]}" -f "$tmp_migration" >/dev/null
for function_name in "public.apply_ticket_104_cross_namespace_drop(jsonb,text)" "public.finalize_ticket_104_cross_namespace_drop(text,text)"; do
  if "${psql[@]}" -Atq -c "SELECT has_function_privilege('service_role','$function_name','EXECUTE');" | grep -qx t; then echo "ticket_104_seal_lost_on_migration_rerun:$function_name" >&2; exit 1; fi
done
if "${psql[@]}" -Atq -c "SELECT * FROM public.apply_ticket_104_cross_namespace_drop('$fixture_manifest'::jsonb,'migration:ticket-104');" >/dev/null 2>&1; then echo 'ticket_104_owner_apply_reopened_after_rerun' >&2; exit 1; fi
echo "Ticket #104 functional rehearsal passed: $apply_result; replay=$replay_result; actual W164/W169 dependency chain, terminal evidence, final seal and direct cross-namespace denial all proved."
