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
CREATE TABLE public.opportunities(id uuid PRIMARY KEY, is_demo boolean NOT NULL, status text NOT NULL DEFAULT 'active');
CREATE TABLE public.opportunity_matches(id uuid PRIMARY KEY, opportunity_id uuid REFERENCES public.opportunities(id), status text NOT NULL DEFAULT 'active_pursuit');
CREATE TABLE public.opportunity_pursuit_evidence(id uuid PRIMARY KEY, match_id uuid REFERENCES public.opportunity_matches(id), actor text, metadata jsonb, event_type text);
CREATE TABLE public.opportunity_ma_contacts(id uuid PRIMARY KEY);
CREATE TABLE public."user"(id text PRIMARY KEY, email text NOT NULL);
CREATE TABLE public.app_user_roles(user_id text, email text NOT NULL, role text);
CREATE TABLE public.ma_interactions(id uuid PRIMARY KEY, client_operation_key uuid, opportunity_id uuid,
  template_key text, recipient_email_snapshot text, title text, body_markdown text,
  delivery_status text, provider_message_id text, channel text DEFAULT 'email', direction text DEFAULT 'outbound',
  provider_request_fingerprint text);
CREATE TABLE public.opportunity_pursuit_handoff_deliveries(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), upstream_evidence_id uuid, match_id uuid,
  handoff_type text, delivery_status text, provider_message_id text, evidence_id uuid,
  attachment_snapshot jsonb DEFAULT '[]'::jsonb, ma_interaction_id uuid,
  operation_key uuid DEFAULT gen_random_uuid(), request_fingerprint text,
  attempt_count integer DEFAULT 1, attempt_started_at timestamptz DEFAULT clock_timestamp(),
  last_attempt_at timestamptz DEFAULT clock_timestamp(), last_attempted_by text,
  prior_attempts jsonb DEFAULT '[]'::jsonb, delivery_error text, created_by text,
  finalized_at timestamptz, sent_at timestamptz);
INSERT INTO public.opportunities VALUES ('18600000-0000-4000-8000-000000000001',false),('18600000-0000-4000-8000-000000000002',true);
INSERT INTO public.opportunity_ma_contacts VALUES ('18600000-0000-4000-8000-000000000003');
INSERT INTO public."user" VALUES
  ('staff-1','staff-one@example.test'),('staff-2','staff-two@example.test'),
  ('staff-fallback','Fallback@Example.Test'),('rep-1','rep@example.test'),
  ('spoof-1','unassigned@example.test');
INSERT INTO public.app_user_roles VALUES
  ('staff-1','staff-one@example.test','staff'),('staff-2','staff-two@example.test','staff'),
  (NULL,' fallback@example.test ','staff'),('rep-1','rep@example.test','repreneur');
SQL
"${psql[@]}" --file "$repo_root/scripts/121_staff_email_review_queue.sql" >/dev/null

# Install the two unchanged released source RPC definitions in this disposable
# schema. Other pursuit gates are minimal synthetic prerequisites; the begin and
# finalize functions under test are read verbatim from the shipped migration.
"${psql[@]}" >/dev/null <<'SQL'
CREATE FUNCTION public.wave_journey_is_enabled() RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
CREATE FUNCTION public.w164_match_has_same_namespace(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
CREATE FUNCTION public.journey_current_cycle_event(uuid) RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
CREATE FUNCTION public.journey_current_gate_1_event(p_match_id uuid) RETURNS uuid LANGUAGE sql AS $$
  SELECT id FROM public.opportunity_pursuit_evidence
  WHERE match_id=p_match_id AND event_type='gate_1_passed' ORDER BY id LIMIT 1 $$;
CREATE FUNCTION public.journey_current_gate_2_event(uuid) RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
CREATE FUNCTION public.journey_handoff_delivery_event_type(text) RETURNS text LANGUAGE sql AS $$ SELECT 'e6_nda_ready_notified'::text $$;
CREATE FUNCTION public.journey_append_evidence(uuid,text,text,text,uuid,uuid,text,jsonb) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.opportunity_pursuit_evidence(id,match_id,actor,metadata,event_type)
    VALUES(gen_random_uuid(),$1,$3,$8,$2) RETURNING id INTO v_id;
  RETURN v_id;
END $$;
SQL
awk '
  /^CREATE OR REPLACE FUNCTION public.journey_begin_handoff_delivery\(/ { inside=1 }
  inside { print }
  inside && /^END \$\$;/ { ended++; if (ended==2) exit }
' "$repo_root/supabase/migrations/20260905095841_pursuit_delivery_handoffs.sql" | "${psql[@]}" >/dev/null
"${psql[@]}" --file "$repo_root/scripts/123_staff_email_handoff_source_actor_alignment.sql" >/dev/null

"${psql[@]}" -Atc "SELECT public.staff_email_review_assert_actor('staff-fallback')" >/dev/null
if "${psql[@]}" -Atc "SELECT public.staff_email_review_assert_actor('rep-1')" >/dev/null 2>&1; then
  echo "Repreneur actor unexpectedly authorized" >&2; exit 1
fi
if "${psql[@]}" -Atc "SELECT public.staff_email_review_assert_actor('spoof-1')" >/dev/null 2>&1; then
  echo "Unrelated actor unexpectedly inherited a staff email role" >&2; exit 1
fi
if "${psql[@]}" -Atc "SELECT public.staff_email_review_assert_actor('Fallback@Example.Test')" >/dev/null 2>&1; then
  echo "Caller-supplied staff email unexpectedly bypassed the Better Auth user ID" >&2; exit 1
fi

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
if "${psql[@]}" -Atc "SELECT public.staff_email_review_finish('$review_id','$token','failed',NULL,NULL,'later pre-I/O veto','staff-2')" >/dev/null 2>&1; then
  echo "Earlier uncertain outcome was erased by a later veto" >&2; exit 1
fi
"${psql[@]}" -Atc "SELECT public.staff_email_review_finish('$review_id','$token','uncertain',NULL,NULL,'unknown result','staff-2')" >/dev/null
"${psql[@]}" -Atc "UPDATE public.staff_email_reviews SET attempted_at=now()-interval '24 hours' WHERE id='$review_id'" >/dev/null
if "${psql[@]}" -Atc "SELECT public.staff_email_review_reserve('$review_id',5,'{\"to\":[\"receiver@example.test\"],\"subject\":\"Subject\"}'::jsonb,'staff-2')" >/dev/null 2>&1; then
  echo "Expired uncertain payload unexpectedly retried" >&2; exit 1
fi
if "${psql[@]}" -Atc "SELECT public.staff_email_review_cancel('$review_id',5,'Ignore unknown result','staff-2')" >/dev/null 2>&1; then
  echo "Uncertain operation unexpectedly cancelled" >&2; exit 1
fi
if "${psql[@]}" -Atc "SELECT public.staff_email_review_prepare('ma','18600000-0000-4000-8000-000000000006','18600000-0000-4000-8000-000000000001',NULL,NULL,'18600000-0000-4000-8000-000000000003','receiver@example.test','REAL','ma_opportunity_validity_check','copy-v1','Subject','Body','[]'::jsonb,'staff-1')" >/dev/null 2>&1; then
  echo "New draft bypassed earlier uncertainty" >&2; exit 1
fi

# A fresh, independent opportunity exercises exact receipt linkage.
"${psql[@]}" -Atc "INSERT INTO public.opportunities VALUES('18600000-0000-4000-8000-000000000007',false)" >/dev/null
receipt_review="$("${psql[@]}" -Atc "SELECT public.staff_email_review_prepare('ma','18600000-0000-4000-8000-000000000008','18600000-0000-4000-8000-000000000007',NULL,NULL,'18600000-0000-4000-8000-000000000003','receiver@example.test','REAL','ma_opportunity_validity_check','copy-v1','Subject','Body','[]'::jsonb,'staff-1')")"
receipt_token="$("${psql[@]}" -Atc "SELECT public.staff_email_review_reserve('$receipt_review',1,'{\"to\":[\"receiver@example.test\"],\"subject\":\"Subject\"}'::jsonb,'staff-1')")"
if "${psql[@]}" -Atc "SELECT public.staff_email_review_finish('$receipt_review','$receipt_token','sent',NULL,NULL,NULL,'staff-1')" >/dev/null 2>&1; then
  echo "Sent queue state accepted a missing source receipt" >&2; exit 1
fi
"${psql[@]}" -Atc "INSERT INTO public.ma_interactions(id,client_operation_key,opportunity_id,template_key,recipient_email_snapshot,title,body_markdown,delivery_status,provider_message_id) VALUES('18600000-0000-4000-8000-000000000009','18600000-0000-4000-8000-000000000008','18600000-0000-4000-8000-000000000007','ma_opportunity_validity_check','receiver@example.test','Subject','Body','sent','provider-accepted-1')" >/dev/null
if "${psql[@]}" -Atc "SELECT public.staff_email_review_finish('$receipt_review','$receipt_token','sent','provider-fake','18600000-0000-4000-8000-000000000009',NULL,'staff-1')" >/dev/null 2>&1; then
  echo "Sent queue state accepted a forged provider receipt" >&2; exit 1
fi
"${psql[@]}" -Atc "SELECT public.staff_email_review_finish('$receipt_review','$receipt_token','sent','provider-accepted-1','18600000-0000-4000-8000-000000000009',NULL,'staff-1')" >/dev/null

# Conclusive failure can safely retry the same immutable draft and payload.
"${psql[@]}" -Atc "INSERT INTO public.opportunity_matches VALUES('18600000-0000-4000-8000-000000000020','18600000-0000-4000-8000-000000000007')" >/dev/null
"${psql[@]}" -Atc "INSERT INTO public.opportunity_pursuit_evidence VALUES('18600000-0000-4000-8000-000000000021','18600000-0000-4000-8000-000000000020')" >/dev/null
handoff_review="$("${psql[@]}" -Atc "SELECT public.staff_email_review_prepare('e6','18600000-0000-4000-8000-000000000021','18600000-0000-4000-8000-000000000007','18600000-0000-4000-8000-000000000020','18600000-0000-4000-8000-000000000021',NULL,'buyer@example.test','REAL','code:e6_nda_ready','w112-e6-v1','Ready','Ready body','[]'::jsonb,'staff-1')")"
handoff_token="$("${psql[@]}" -Atc "SELECT public.staff_email_review_reserve('$handoff_review',1,'{\"to\":[\"buyer@example.test\"],\"subject\":\"Ready\"}'::jsonb,'staff-1')")"
"${psql[@]}" -Atc "SELECT public.staff_email_review_finish('$handoff_review','$handoff_token','failed',NULL,NULL,'provider rejected','staff-1')" >/dev/null
if "${psql[@]}" -Atc "SELECT public.staff_email_review_reserve('$handoff_review',3,'{\"subject\":\"changed\"}'::jsonb,'staff-2')" >/dev/null 2>&1; then
  echo "Failed handoff changed its reviewed payload" >&2; exit 1
fi
"${psql[@]}" -Atc "SELECT public.staff_email_review_reserve('$handoff_review',3,'{\"to\":[\"buyer@example.test\"],\"subject\":\"Ready\"}'::jsonb,'staff-2')" >/dev/null
handoff_token="$("${psql[@]}" -Atc "SELECT attempt_token FROM public.staff_email_reviews WHERE id='$handoff_review'")"
"${psql[@]}" -Atc "INSERT INTO public.opportunity_pursuit_evidence VALUES('18600000-0000-4000-8000-000000000022','18600000-0000-4000-8000-000000000020')" >/dev/null
"${psql[@]}" -Atc "INSERT INTO public.opportunity_pursuit_handoff_deliveries(upstream_evidence_id,match_id,handoff_type,delivery_status,provider_message_id,evidence_id,attachment_snapshot,ma_interaction_id) VALUES('18600000-0000-4000-8000-000000000021','18600000-0000-4000-8000-000000000020','e6','sent','provider-accepted-e6','18600000-0000-4000-8000-000000000022','[]'::jsonb,NULL)" >/dev/null
if "${psql[@]}" -Atc "SELECT public.staff_email_review_finish('$handoff_review','$handoff_token','sent','provider-accepted-e6','18600000-0000-4000-8000-000000000009',NULL,'staff-2')" >/dev/null 2>&1; then
  echo "Sent handoff accepted unrelated MA evidence" >&2; exit 1
fi
"${psql[@]}" -Atc "SELECT public.staff_email_review_finish('$handoff_review','$handoff_token','sent','provider-accepted-e6','18600000-0000-4000-8000-000000000022',NULL,'staff-2')" >/dev/null

# E7 cannot claim acceptance using a handoff whose M&A interaction belongs to
# a different provider operation, even when the provider ID happens to match.
"${psql[@]}" -Atc "INSERT INTO public.opportunity_pursuit_evidence VALUES('18600000-0000-4000-8000-000000000023','18600000-0000-4000-8000-000000000020'),('18600000-0000-4000-8000-000000000025','18600000-0000-4000-8000-000000000020')" >/dev/null
e7_snapshot='[{"artifact_id":"18600000-0000-4000-8000-000000000030","document_id":"18600000-0000-4000-8000-000000000031","content_sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","file_name":"signed.pdf","mime_type":"application/pdf","size_bytes":234}]'
e7_review="$("${psql[@]}" -Atc "SELECT public.staff_email_review_prepare('e7','18600000-0000-4000-8000-000000000023','18600000-0000-4000-8000-000000000007','18600000-0000-4000-8000-000000000020','18600000-0000-4000-8000-000000000023','18600000-0000-4000-8000-000000000003','receiver@example.test','REAL','ma_nda_info_memo_request','w112-e7-v1','E7 subject','E7 body','$e7_snapshot'::jsonb,'staff-1')")"
e7_token="$("${psql[@]}" -Atc "SELECT public.staff_email_review_reserve('$e7_review',1,'{\"to\":[\"receiver@example.test\"],\"subject\":\"E7 subject\"}'::jsonb,'staff-1')")"
"${psql[@]}" -Atc "INSERT INTO public.ma_interactions(id,client_operation_key,opportunity_id,template_key,recipient_email_snapshot,title,body_markdown,delivery_status,provider_message_id,provider_request_fingerprint) VALUES('18600000-0000-4000-8000-000000000024','18600000-0000-4000-8000-000000000027','18600000-0000-4000-8000-000000000007','ma_nda_info_memo_request','receiver@example.test','E7 subject','E7 body','sent','provider-accepted-e7',repeat('a',64))" >/dev/null
"${psql[@]}" -Atc "INSERT INTO public.opportunity_pursuit_handoff_deliveries(upstream_evidence_id,match_id,handoff_type,delivery_status,provider_message_id,evidence_id,attachment_snapshot,ma_interaction_id,operation_key,request_fingerprint) VALUES('18600000-0000-4000-8000-000000000023','18600000-0000-4000-8000-000000000020','e7','sent','provider-accepted-e7','18600000-0000-4000-8000-000000000025','$e7_snapshot'::jsonb,'18600000-0000-4000-8000-000000000024','18600000-0000-4000-8000-000000000026',repeat('a',64))" >/dev/null
if "${psql[@]}" -Atc "SELECT public.staff_email_review_finish('$e7_review','$e7_token','sent','provider-accepted-e7','18600000-0000-4000-8000-000000000025',NULL,'staff-1')" >/dev/null 2>&1; then
  echo "E7 accepted a mismatched M&A source operation" >&2; exit 1
fi
"${psql[@]}" -Atc "UPDATE public.ma_interactions SET client_operation_key='18600000-0000-4000-8000-000000000026' WHERE id='18600000-0000-4000-8000-000000000024'" >/dev/null
"${psql[@]}" -Atc "SELECT public.staff_email_review_finish('$e7_review','$e7_token','sent','provider-accepted-e7','18600000-0000-4000-8000-000000000025',NULL,'staff-1')" >/dev/null

# All three handoff kinds permit only a same-review, same-payload retry after
# a conclusive failure. E6 is exercised above; E4/E7 cover the MA-backed path.
"${psql[@]}" -Atc "INSERT INTO public.opportunity_pursuit_evidence VALUES('18600000-0000-4000-8000-000000000040','18600000-0000-4000-8000-000000000020'),('18600000-0000-4000-8000-000000000041','18600000-0000-4000-8000-000000000020')" >/dev/null
for kind in e4 e7; do
  if [ "$kind" = e4 ]; then upstream='18600000-0000-4000-8000-000000000040'; snapshot='[]'; else upstream='18600000-0000-4000-8000-000000000041'; snapshot="$e7_snapshot"; fi
  retry_review="$("${psql[@]}" -Atc "SELECT public.staff_email_review_prepare('$kind','$upstream','18600000-0000-4000-8000-000000000007','18600000-0000-4000-8000-000000000020','$upstream','18600000-0000-4000-8000-000000000003','receiver@example.test','REAL','ma_nda_info_memo_request','w112-$kind-v1','Fixed subject','Fixed body','$snapshot'::jsonb,'staff-1')")"
  retry_payload='{"to":["receiver@example.test"],"subject":"Fixed subject"}'
  retry_token="$("${psql[@]}" -Atc "SELECT public.staff_email_review_reserve('$retry_review',1,'$retry_payload'::jsonb,'staff-1')")"
  "${psql[@]}" -Atc "SELECT public.staff_email_review_finish('$retry_review','$retry_token','failed',NULL,NULL,'provider rejected','staff-1')" >/dev/null
  "${psql[@]}" -Atc "SELECT public.staff_email_review_reserve('$retry_review',3,'$retry_payload'::jsonb,'staff-2')" >/dev/null
  retry_token="$("${psql[@]}" -Atc "SELECT attempt_token FROM public.staff_email_reviews WHERE id='$retry_review'")"
  "${psql[@]}" -Atc "SELECT public.staff_email_review_finish('$retry_review','$retry_token','failed',NULL,NULL,'second rejection','staff-2')" >/dev/null
done

demo_id="$("${psql[@]}" -Atc "SELECT public.staff_email_review_prepare('ma','18600000-0000-4000-8000-000000000005','18600000-0000-4000-8000-000000000002',NULL,NULL,'18600000-0000-4000-8000-000000000003','demo@example.test','DEMO','ma_opportunity_validity_check','copy-v1','Subject','Body','[]'::jsonb,'staff-1')")"
if "${psql[@]}" -Atc "SELECT public.staff_email_review_reserve('$demo_id',1,'{}'::jsonb,'staff-1')" >/dev/null 2>&1; then
  echo "DEMO draft unexpectedly reserved for delivery" >&2; exit 1
fi
"${psql[@]}" -Atc "SELECT public.staff_email_review_edit('$demo_id',1,'Edited subject','Edited body','staff-fallback')" >/dev/null
"${psql[@]}" -Atc "SELECT public.staff_email_review_cancel('$demo_id',2,'Synthetic draft not needed','staff-2')" >/dev/null
edited_cancelled="$("${psql[@]}" -Atc "SELECT state='cancelled' AND subject='Edited subject' AND body_text='Edited body' AND cancel_reason='Synthetic draft not needed' AND (SELECT count(*) FROM public.staff_email_review_events WHERE review_id='$demo_id')=3 FROM public.staff_email_reviews WHERE id='$demo_id'")"
[ "$edited_cancelled" = "t" ] || { echo "Authenticated edit/cancel was not retained" >&2; exit 1; }

# The real E6 source begin/finalize functions must accept the canonical Better
# Auth ID even when its only staff role matches by normalized email.
"${psql[@]}" -Atc "INSERT INTO public.opportunities VALUES('18600000-0000-4000-8000-000000000050',false,'active')" >/dev/null
"${psql[@]}" -Atc "INSERT INTO public.opportunity_matches(id,opportunity_id) VALUES('18600000-0000-4000-8000-000000000051','18600000-0000-4000-8000-000000000050')" >/dev/null
"${psql[@]}" -Atc "INSERT INTO public.opportunity_pursuit_evidence(id,match_id,event_type) VALUES('18600000-0000-4000-8000-000000000052','18600000-0000-4000-8000-000000000051','gate_1_passed')" >/dev/null
e6_source="$("${psql[@]}" -Atc "SELECT delivery_id||'|'||operation_key FROM public.journey_begin_handoff_delivery('18600000-0000-4000-8000-000000000051','18600000-0000-4000-8000-000000000052','e6',repeat('a',64),'staff-fallback','[]'::jsonb)")"
e6_delivery_id="${e6_source%%|*}"
e6_operation_key="${e6_source#*|}"
e6_evidence="$("${psql[@]}" -Atc "SELECT public.journey_finalize_handoff_delivery('$e6_delivery_id','$e6_operation_key','staff-fallback','sent','synthetic-e6-accepted',NULL,NULL)")"
e6_source_retained="$("${psql[@]}" -Atc "SELECT d.delivery_status='sent' AND d.created_by='staff-fallback' AND d.last_attempted_by='staff-fallback' AND d.provider_message_id='synthetic-e6-accepted' AND e.actor='staff-fallback' FROM public.opportunity_pursuit_handoff_deliveries d JOIN public.opportunity_pursuit_evidence e ON e.id=d.evidence_id WHERE d.id='$e6_delivery_id' AND e.id='$e6_evidence'")"
[ "$e6_source_retained" = "t" ] || { echo "Email-only E6 source delivery was not retained" >&2; exit 1; }
# A later non-Gate-1 event with a lower UUID must not displace Gate 1. The
# released source begin RPC is exercised again below, including its gate check.
"${psql[@]}" -Atc "INSERT INTO public.opportunity_pursuit_evidence(id,match_id,event_type) VALUES('10000000-0000-4000-8000-000000000001','18600000-0000-4000-8000-000000000051','e6_nda_ready_notified')" >/dev/null
e6_replay="$("${psql[@]}" -Atc "SELECT delivery_id||'|'||operation_key||'|'||delivery_status||'|'||evidence_id FROM public.journey_begin_handoff_delivery('18600000-0000-4000-8000-000000000051','18600000-0000-4000-8000-000000000052','e6',repeat('a',64),'staff-2','[]'::jsonb)")"
[ "$e6_replay" = "$e6_delivery_id|$e6_operation_key|sent|$e6_evidence" ] || { echo "Accepted E6 source did not preserve its operation on replay" >&2; exit 1; }
e6_original_actor="$("${psql[@]}" -Atc "SELECT created_by FROM public.opportunity_pursuit_handoff_deliveries WHERE id='$e6_delivery_id'")"
[ "$e6_original_actor" = staff-fallback ] || { echo "E6 replay changed original actor attribution" >&2; exit 1; }
for denied in rep-1 spoof-1 Fallback@Example.Test; do
  if denial="$("${psql[@]}" -Atc "SELECT public.journey_begin_handoff_delivery('18600000-0000-4000-8000-000000000051','18600000-0000-4000-8000-000000000052','e6',repeat('a',64),'$denied','[]'::jsonb)" 2>&1)"; then
    echo "Denied actor unexpectedly began an E6 source delivery: $denied" >&2; exit 1
  fi
  [[ "$denial" == *'Handoff requires a valid request and exact staff actor.'* ]] || { echo "E6 denial was not its staff guard: $denied" >&2; exit 1; }
done
if denial="$("${psql[@]}" -Atc "SELECT public.journey_finalize_handoff_delivery('$e6_delivery_id','$e6_operation_key','rep-1','sent','fake',NULL,NULL)" 2>&1)"; then
  echo "Repreneur unexpectedly finalized E6 source delivery" >&2; exit 1
fi
[[ "$denial" == *'Handoff finalization requires exact staff and bounded delivery evidence.'* ]] || { echo "E6 finalizer denial was not its staff guard" >&2; exit 1; }
source_acl="$("${psql[@]}" -Atc "SELECT NOT has_function_privilege('anon','public.journey_begin_handoff_delivery(uuid,uuid,text,text,text,jsonb)','EXECUTE') AND NOT has_function_privilege('authenticated','public.journey_finalize_handoff_delivery(uuid,uuid,text,text,text,text,uuid)','EXECUTE') AND has_function_privilege('service_role','public.journey_begin_handoff_delivery(uuid,uuid,text,text,text,jsonb)','EXECUTE')")"
[ "$source_acl" = t ] || { echo "E6 source RPC service-only ACL changed" >&2; exit 1; }
echo "staff email review queue rehearsal passed: role resolution, independent-session race, unchanged/failed retry, 23h fence, clone/DEMO denial, linked source receipts, retained edit/cancel"
