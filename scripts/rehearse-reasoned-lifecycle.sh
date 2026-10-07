#!/usr/bin/env bash
set -euo pipefail

# Product Change #251 / Ticket #252: disposable, synthetic persistence proof.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
cluster_dir="$(mktemp -d "${TMPDIR:-/tmp}/renew-252.XXXXXX")"
port="${LIFECYCLE_REHEARSAL_PORT:-55582}"
cleanup() {
  [ ! -f "$cluster_dir/postmaster.pid" ] || "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true
  case "$cluster_dir" in */renew-252.*) rm -rf -- "$cluster_dir" ;; esac
}
trap cleanup EXIT
"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 --auth-local=trust --auth-host=trust --username=renew_lifecycle_admin >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -l "$cluster_dir/postgres.log" -o "-p $port -h 127.0.0.1 -k $cluster_dir" -w start >/dev/null
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" -U renew_lifecycle_admin lifecycle
psql=("$pg_bin/psql" -X -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -U renew_lifecycle_admin -d lifecycle)
"${psql[@]}" -c "CREATE ROLE postgres NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS; CREATE SCHEMA auth; CREATE SCHEMA extensions; CREATE TABLE auth.users(id UUID PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS 'SELECT NULL::UUID';" >/dev/null
"${psql[@]}" -f "$repo_root/supabase/schema/771_extensions.sql" >/dev/null
"${psql[@]}" -f "$repo_root/supabase/schema/771_public_schema.sql" >/dev/null
"${psql[@]}" -f "$repo_root/supabase/migrations/20260829180000_w169_lifecycle_outcome_separation.sql" >/dev/null
"${psql[@]}" -f "$repo_root/supabase/migrations/20260829203000_w169_pause_guard_scope.sql" >/dev/null
"${psql[@]}" -c "ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE; ALTER TABLE public.repreneurs ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE; CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,public boolean,file_size_limit bigint,allowed_mime_types text[]); INSERT INTO storage.buckets(id) VALUES ('opportunity-documents'),('cvs'),('external-pursuit-attachments');" >/dev/null
"${psql[@]}" -f "$repo_root/supabase/migrations/20260827113000_w165_private_direct_uploads.sql" >/dev/null
"${psql[@]}" -f "$repo_root/scripts/121_staff_email_review_queue.sql" >/dev/null
"${psql[@]}" -f "$repo_root/scripts/124_recipient_information_memos.sql" >/dev/null
# Use the actual Colin predicate and flag without unrelated publication-run
# ledgers that this reconstruction snapshot does not contain.
"${psql[@]}" -c "ALTER TABLE public.opportunities ADD COLUMN source_identity_to_verify BOOLEAN NOT NULL DEFAULT FALSE" >/dev/null
sed -n '/^CREATE OR REPLACE FUNCTION public.ma_opportunity_source_review_required(/,/^\$\$;/p' "$repo_root/supabase/migrations/20260902202154_colin_data_security_corrections.sql" | "${psql[@]}" >/dev/null
"${psql[@]}" -f "$repo_root/scripts/129_opportunity_freshness_reviews.sql" >/dev/null

"${psql[@]}" <<'SQL'
SET session_replication_role = replica;
INSERT INTO public."user"(id,name,email) VALUES ('staff-252','Synthetic Staff','staff@re-new.invalid');
INSERT INTO public.app_user_roles(id,user_id,email,role) VALUES ('25200000-0000-4000-8000-000000000001','staff-252','staff@re-new.invalid','staff');
INSERT INTO public.repreneurs(id,email,first_name,last_name) VALUES ('25200000-0000-4000-8000-000000000002','buyer@re-new.invalid','Synthetic','Buyer');
INSERT INTO public.ma_firms(id,name,status,created_by) VALUES ('25200000-0000-4000-8000-000000000030','Synthetic firm','active','fixture');
INSERT INTO public.ma_offices(id,firm_id,name,status,is_default,created_by) VALUES ('25200000-0000-4000-8000-000000000031','25200000-0000-4000-8000-000000000030','Synthetic office','active',FALSE,'fixture');
-- The complete baseline requires its reserved, redacted Acme context even
-- when the tested opportunity belongs to another entirely synthetic office.
INSERT INTO public.ma_firms(id,name,status,created_by) VALUES ('25200000-0000-4000-8000-000000000032','Acme Co.','active','fixture');
INSERT INTO public.ma_offices(id,firm_id,name,status,is_default,city,created_by) VALUES ('25200000-0000-4000-8000-000000000033','25200000-0000-4000-8000-000000000032','Acme Paris','active',FALSE,'Paris','fixture');
INSERT INTO public.ma_contacts(id,first_name,display_name,status,email,created_by) VALUES
 ('25200000-0000-4000-8000-000000000034','Schema','TEST-schema-redacted-person','active','test-schema-redacted-003','fixture'),
 ('25200000-0000-4000-8000-000000000035','Schema','Synthetic reserved email','active','test-schema-redacted-001','fixture');
INSERT INTO public.app_user_roles(id,email,role) VALUES ('25200000-0000-4000-8000-000000000036','test-schema-redacted-002','staff');
INSERT INTO public.ma_contact_office_affiliations(id,contact_id,office_id,is_active,created_by) VALUES ('25200000-0000-4000-8000-000000000037','25200000-0000-4000-8000-000000000034','25200000-0000-4000-8000-000000000033',TRUE,'fixture');
INSERT INTO public.ma_provisional_source_contexts(context_key,firm_id,office_id,contact_id,affiliation_id) VALUES ('acme_co_paris','25200000-0000-4000-8000-000000000032','25200000-0000-4000-8000-000000000033','25200000-0000-4000-8000-000000000034','25200000-0000-4000-8000-000000000037');
INSERT INTO public.opportunities(id,reference,status,source_office_id,description,created_by) VALUES
 ('25200000-0000-4000-8000-000000000010','SYNTHETIC-252','active','25200000-0000-4000-8000-000000000031','Synthetic lifecycle proof','fixture'),
 ('25200000-0000-4000-8000-000000000011','SYNTHETIC-252-HISTORY','closed','25200000-0000-4000-8000-000000000031','Historical proof','fixture');
INSERT INTO public.ma_contacts(id,first_name,display_name,status,email,created_by) VALUES ('25200000-0000-4000-8000-000000000040','Synthetic','Synthetic advisor','active','advisor@re-new.invalid','fixture');
INSERT INTO public.ma_contact_office_affiliations(id,contact_id,office_id,is_active,created_by) VALUES ('25200000-0000-4000-8000-000000000041','25200000-0000-4000-8000-000000000040','25200000-0000-4000-8000-000000000031',TRUE,'fixture');
INSERT INTO public.opportunity_ma_contacts(id,opportunity_id,affiliation_id,is_primary,is_active,linked_by) VALUES ('25200000-0000-4000-8000-000000000042','25200000-0000-4000-8000-000000000010','25200000-0000-4000-8000-000000000041',TRUE,TRUE,'fixture');
INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,pursuit_stage,created_by) VALUES
 ('25200000-0000-4000-8000-000000000020','25200000-0000-4000-8000-000000000010','25200000-0000-4000-8000-000000000002','active_pursuit','interest','fixture');
INSERT INTO public.opportunity_pursuit_evidence(match_id,opportunity_id,repreneur_id,event_type,actor,evidence_reference,idempotency_key) VALUES
 ('25200000-0000-4000-8000-000000000020','25200000-0000-4000-8000-000000000010','25200000-0000-4000-8000-000000000002','dropped','original-actor','no_viable_match','legacy-drop');
CREATE TABLE public.fixture_original_history AS SELECT id,to_jsonb(e) AS row FROM public.opportunity_pursuit_evidence e;
INSERT INTO public.opportunity_closure_history(id,opportunity_id,reason,closed_by,closed_at) VALUES ('25200000-0000-4000-8000-000000000060','25200000-0000-4000-8000-000000000011','paused_cabinet','original-actor','2020-01-01T00:00:00Z');
CREATE TABLE public.fixture_original_closure AS SELECT id,to_jsonb(e) AS row FROM public.opportunity_closure_history e;
INSERT INTO public.opportunities(id,reference,status,source_office_id,description,date_added,created_by) VALUES ('25200000-0000-4000-8000-000000000012','SYNTHETIC-252-LEGACY','active','25200000-0000-4000-8000-000000000031','No trustworthy interval','2000-01-01','fixture');
INSERT INTO public.opportunity_ma_contacts(opportunity_id,affiliation_id,is_primary,is_active,linked_by) VALUES ('25200000-0000-4000-8000-000000000012','25200000-0000-4000-8000-000000000041',TRUE,TRUE,'fixture');
INSERT INTO public.opportunity_documents(id,opportunity_id,title,document_type,storage_path,file_name,mime_type,recipient_match_id,recipient_repreneur_id) VALUES ('25200000-0000-4000-8000-000000000050','25200000-0000-4000-8000-000000000010','Synthetic personalized IM','deal_book','synthetic/recipient-252.pdf','recipient-252.pdf','application/pdf','25200000-0000-4000-8000-000000000020','25200000-0000-4000-8000-000000000002');
INSERT INTO public.opportunity_documents(id,opportunity_id,title,document_type,storage_path) VALUES ('25200000-0000-4000-8000-000000000051','25200000-0000-4000-8000-000000000010','Synthetic reusable IM','deal_book','synthetic/reusable-252.pdf');
INSERT INTO public.opportunity_pursuit_confidential_grants(id,match_id,opportunity_id,information_memo_document_id,source_firm_id,source_firm_name,source_office_id,source_office_name,granted_by) VALUES ('25200000-0000-4000-8000-000000000052','25200000-0000-4000-8000-000000000020','25200000-0000-4000-8000-000000000010','25200000-0000-4000-8000-000000000050','25200000-0000-4000-8000-000000000030','Synthetic firm','25200000-0000-4000-8000-000000000031','Synthetic office','fixture');
SET session_replication_role = origin;
INSERT INTO public.wave_journey_settings(singleton,enabled,updated_by) VALUES (TRUE,TRUE,'fixture') ON CONFLICT(singleton) DO UPDATE SET enabled=TRUE;
SQL

migration="$repo_root/supabase/migrations/20261007100000_reasoned_staff_lifecycle.sql"
[ ! -f "$migration" ] || "${psql[@]}" -f "$migration" >/dev/null
"${psql[@]}" <<'SQL'
DO $$
DECLARE event_id UUID; saved public.opportunity_pursuit_evidence%ROWTYPE;
BEGIN
 event_id:=public.journey_transition_terminal('25200000-0000-4000-8000-000000000020','drop','staff@re-new.invalid','new-drop','seller_price_expectations_too_high',ARRAY['financing_not_secured'],'Financing was declined.');
 SELECT * INTO saved FROM public.opportunity_pursuit_evidence WHERE id=event_id;
 IF saved.evidence_reference <> 'seller_price_expectations_too_high' OR saved.metadata->'secondary_reasons' <> '["financing_not_secured"]'::jsonb OR saved.metadata->>'reason_note' <> 'Financing was declined.' THEN
   RAISE EXCEPTION 'reasoned_drop_readback_failed';
 END IF;
 IF (SELECT status FROM public.opportunities WHERE id='25200000-0000-4000-8000-000000000010') <> 'active' OR (SELECT status FROM public.opportunity_matches WHERE id='25200000-0000-4000-8000-000000000020') <> 'dropped' THEN RAISE EXCEPTION 'drop_scope_changed'; END IF;
END $$;
DO $$
DECLARE pause_id UUID;
BEGIN
 pause_id:=public.pause_opportunity_with_reason('25200000-0000-4000-8000-000000000010','other','staff@re-new.invalid','Awaiting a revised sale mandate.');
 IF (SELECT reason_note FROM public.opportunity_pause_history WHERE id=pause_id) <> 'Awaiting a revised sale mandate.' OR (SELECT status FROM public.opportunities WHERE id='25200000-0000-4000-8000-000000000010') <> 'paused' THEN RAISE EXCEPTION 'pause_reason_readback_failed'; END IF;
END $$;
UPDATE public.opportunities SET status='active' WHERE id='25200000-0000-4000-8000-000000000010';
DO $$
BEGIN
 BEGIN
  PERFORM public.close_opportunity_with_reason('25200000-0000-4000-8000-000000000010','stale','staff@re-new.invalid');
  RAISE EXCEPTION 'early_stale_closure_allowed';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%opportunity_stale_not_eligible%' THEN RAISE; END IF;
 END;
END $$;
SQL
"${psql[@]}" -f "$repo_root/scripts/rehearsals/reasoned-lifecycle-after.sql"
# Observe an actual open first transaction before starting its rival. Both
# services contend on the same opportunity row; no guessed timing is evidence.
wait_for_held_transaction() {
  local application_name="$1"
  for attempt in {1..150}; do
    if [ "$("${psql[@]}" -Atc "SELECT count(*) FROM pg_stat_activity WHERE application_name='$application_name' AND wait_event='PgSleep'")" = 1 ]; then return; fi
    sleep 0.02
  done
  echo "The first race transaction did not acquire its fence." >&2
  exit 1
}
PGAPPNAME=lifecycle-race-start "${psql[@]}" >"$cluster_dir/start-race.log" 2>&1 <<'SQL' &
BEGIN;
UPDATE public.opportunity_matches SET status='active_pursuit',pursuit_stage='interest' WHERE id='25200000-0000-4000-8000-000000000082';
SELECT pg_sleep(1);
COMMIT;
SQL
race_pid=$!
wait_for_held_transaction lifecycle-race-start
"${psql[@]}" -c "SELECT public.fixture_assert_rejected(\$q\$SELECT public.close_opportunity_with_reason('25200000-0000-4000-8000-000000000080','stale','staff-252')\$q\$,'opportunity_stale_not_eligible');" >/dev/null
wait "$race_pid" || { cat "$cluster_dir/start-race.log" >&2; exit 1; }
PGAPPNAME=lifecycle-race-close "${psql[@]}" >"$cluster_dir/close-race.log" 2>&1 <<'SQL' &
BEGIN;
SELECT public.close_opportunity_with_reason('25200000-0000-4000-8000-000000000081','stale','staff-252');
SELECT pg_sleep(1);
COMMIT;
SQL
race_pid=$!
wait_for_held_transaction lifecycle-race-close
"${psql[@]}" -c "SELECT public.fixture_assert_rejected(\$q\$UPDATE public.opportunity_matches SET status='active_pursuit' WHERE id='25200000-0000-4000-8000-000000000083'\$q\$,'active_pursuit_requires_active_opportunity');" >/dev/null
wait "$race_pid" || { cat "$cluster_dir/close-race.log" >&2; exit 1; }
PGAPPNAME=lifecycle-race-pause "${psql[@]}" >"$cluster_dir/pause-race.log" 2>&1 <<'SQL' &
BEGIN;
SET LOCAL statement_timeout='5s';
SELECT id FROM public.opportunities WHERE id='25200000-0000-4000-8000-000000000084' FOR UPDATE;
SELECT pg_sleep(1);
SELECT public.pause_opportunity_with_reason('25200000-0000-4000-8000-000000000084','seller_paused_sale','staff-252');
COMMIT;
SQL
race_pid=$!
wait_for_held_transaction lifecycle-race-pause
"${psql[@]}" -c "SET statement_timeout='5s'; SELECT public.journey_transition_terminal('25200000-0000-4000-8000-000000000086','drop','staff@re-new.invalid','pause-drop-race','buyer_search_paused');" >/dev/null
wait "$race_pid" || { cat "$cluster_dir/pause-race.log" >&2; exit 1; }
"${psql[@]}" >/dev/null <<'SQL'
DO $$ BEGIN
 IF (SELECT status FROM public.opportunities WHERE id='25200000-0000-4000-8000-000000000084')<>'paused' OR (SELECT stale_clock_started_at FROM public.opportunities WHERE id='25200000-0000-4000-8000-000000000084') IS NOT NULL OR (SELECT status FROM public.opportunity_matches WHERE id='25200000-0000-4000-8000-000000000086')<>'dropped' OR NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_confidential_grants WHERE id='25200000-0000-4000-8000-000000000088' AND revoked_at IS NOT NULL) THEN RAISE EXCEPTION 'pause_drop_race_partial_outcome'; END IF;
 IF (SELECT status FROM public.opportunities WHERE id='25200000-0000-4000-8000-000000000080')<>'active'
   OR EXISTS(SELECT 1 FROM public.opportunity_closure_history WHERE opportunity_id='25200000-0000-4000-8000-000000000080')
   OR (SELECT status FROM public.opportunities WHERE id='25200000-0000-4000-8000-000000000081')<>'closed'
   OR (SELECT status FROM public.opportunity_matches WHERE id='25200000-0000-4000-8000-000000000083')<>'interested'
   OR (SELECT count(*) FROM public.opportunity_closure_history WHERE opportunity_id='25200000-0000-4000-8000-000000000081' AND reason='stale')<>1 THEN RAISE EXCEPTION 'stale_activation_race_partial_outcome'; END IF;
END $$;
SQL
echo 'Ticket #252 disposable persistence, history, confidentiality, clocks and independent-session races passed.'
