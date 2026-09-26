#!/usr/bin/env bash
set -euo pipefail

# Disposable persisted SQL proof for #185. No production connection, customer
# row, provider account, document byte, or Storage object is used here.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
cluster_dir="$(mktemp -d "${TMPDIR:-/tmp}/renew-recipient-im.XXXXXX")"
port="${RECIPIENT_IM_REHEARSAL_PORT:-55485}"
cleanup() {
  if [ -f "$cluster_dir/postmaster.pid" ]; then "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true; fi
  case "$cluster_dir" in */renew-recipient-im.*) rm -rf "$cluster_dir" ;; esac
}
trap cleanup EXIT
for binary in initdb pg_ctl createdb psql; do
  [ -x "$pg_bin/$binary" ] || { echo "Missing PostgreSQL binary: $pg_bin/$binary" >&2; exit 1; }
done
"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 --auth-local=trust --auth-host=trust --username=renew_rehearsal_admin >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -l "$cluster_dir/postgres.log" -o "-p $port -h 127.0.0.1 -k $cluster_dir" -w start >/dev/null
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" -U renew_rehearsal_admin renew_recipient_im_rehearsal
psql=("$pg_bin/psql" -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -U renew_rehearsal_admin -d renew_recipient_im_rehearsal)

"${psql[@]}" >/dev/null <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE TYPE public.opportunity_document_type AS ENUM ('deal_book','other');
CREATE TYPE public.opportunity_document_visibility AS ENUM ('staff_only','approved_for_repreneur');
CREATE TYPE public.opportunity_closure_reason AS ENUM ('signed_repreneur');
CREATE TABLE public.opportunities(id UUID PRIMARY KEY,is_demo BOOLEAN NOT NULL,status TEXT NOT NULL,updated_by TEXT);
CREATE TABLE public.repreneurs(id UUID PRIMARY KEY,is_demo BOOLEAN NOT NULL);
CREATE TABLE public.opportunity_matches(id UUID PRIMARY KEY,opportunity_id UUID NOT NULL REFERENCES public.opportunities(id),
  repreneur_id UUID NOT NULL REFERENCES public.repreneurs(id),status TEXT NOT NULL,
  pursuit_stage_updated_by TEXT,pursuit_stage_updated_at TIMESTAMPTZ,pursuit_stage TEXT,pursuit_stage_notes TEXT);
CREATE TABLE public.opportunity_closure_history(opportunity_id UUID,reason public.opportunity_closure_reason,closed_by TEXT);
CREATE TABLE public.opportunity_documents(id UUID PRIMARY KEY,opportunity_id UUID NOT NULL REFERENCES public.opportunities(id),
  title TEXT NOT NULL,document_type public.opportunity_document_type NOT NULL,
  visibility public.opportunity_document_visibility NOT NULL DEFAULT 'staff_only',
  storage_bucket TEXT NOT NULL DEFAULT 'opportunity-documents',storage_path TEXT,external_url TEXT,
  file_name TEXT,mime_type TEXT,size_bytes BIGINT,uploaded_by TEXT,uploaded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp());
CREATE TABLE public.private_upload_intents(id UUID PRIMARY KEY,storage_path TEXT UNIQUE,upload_kind TEXT NOT NULL,
  status TEXT NOT NULL,related_id UUID,actor_kind TEXT,resource_id UUID,bucket_id TEXT,actor_user_id TEXT,content_type TEXT);
CREATE TABLE public.opportunity_pursuit_evidence(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),match_id UUID NOT NULL REFERENCES public.opportunity_matches(id),
  event_type TEXT NOT NULL,actor TEXT NOT NULL,evidence_reference TEXT,idempotency_key TEXT,recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp());
CREATE TABLE public.opportunity_pursuit_confidential_grants(id UUID PRIMARY KEY,match_id UUID NOT NULL UNIQUE REFERENCES public.opportunity_matches(id),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id),information_memo_document_id UUID NOT NULL REFERENCES public.opportunity_documents(id),
  revoked_at TIMESTAMPTZ,nda_expires_at TIMESTAMPTZ NOT NULL,cycle_started_evidence_id UUID,gate_2_evidence_id UUID,dispatch_evidence_id UUID);
CREATE TABLE public.app_user_roles(user_id TEXT,email TEXT,role TEXT);
CREATE FUNCTION public.wave_journey_is_enabled() RETURNS BOOLEAN LANGUAGE sql AS $$ SELECT TRUE $$;
CREATE FUNCTION public.journey_current_cycle_event(UUID) RETURNS UUID LANGUAGE sql AS $$ SELECT '18500000-0000-4000-8000-000000000090'::UUID $$;
CREATE FUNCTION public.journey_current_gate_2_event(UUID) RETURNS UUID LANGUAGE sql AS $$ SELECT '18500000-0000-4000-8000-000000000091'::UUID $$;
CREATE FUNCTION public.journey_current_dispatch_event(UUID) RETURNS UUID LANGUAGE sql AS $$ SELECT '18500000-0000-4000-8000-000000000092'::UUID $$;
CREATE FUNCTION public.journey_revoke_confidential_access(UUID,TEXT,TEXT,TEXT) RETURNS UUID LANGUAGE plpgsql AS $$
BEGIN UPDATE public.opportunity_pursuit_confidential_grants SET revoked_at=clock_timestamp() WHERE match_id=$1; RETURN gen_random_uuid(); END $$;
CREATE FUNCTION public.journey_append_evidence(UUID,TEXT,TEXT,TEXT,UUID DEFAULT NULL,UUID DEFAULT NULL,TEXT DEFAULT NULL,JSONB DEFAULT '{}'::JSONB)
RETURNS UUID LANGUAGE plpgsql AS $$ DECLARE v_id UUID; BEGIN
  INSERT INTO public.opportunity_pursuit_evidence(match_id,event_type,actor,idempotency_key,evidence_reference)
  VALUES($1,$2,$3,$4,$7) RETURNING id INTO v_id; RETURN v_id;
END $$;
INSERT INTO public.opportunities(id,is_demo,status) VALUES('18500000-0000-4000-8000-000000000001',FALSE,'active');
INSERT INTO public.repreneurs VALUES('18500000-0000-4000-8000-000000000002',FALSE),('18500000-0000-4000-8000-000000000003',FALSE);
INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,pursuit_stage_updated_by,pursuit_stage_updated_at) VALUES
  ('18500000-0000-4000-8000-000000000004','18500000-0000-4000-8000-000000000001','18500000-0000-4000-8000-000000000002','active_pursuit',NULL,NULL),
  ('18500000-0000-4000-8000-000000000005','18500000-0000-4000-8000-000000000001','18500000-0000-4000-8000-000000000003','interested',NULL,NULL);
INSERT INTO public.opportunity_documents(id,opportunity_id,title,document_type,storage_bucket,storage_path,file_name,mime_type,uploaded_by)
  VALUES('18500000-0000-4000-8000-000000000006','18500000-0000-4000-8000-000000000001','Legacy reusable','deal_book','opportunity-documents',
    '18500000-0000-4000-8000-000000000001/documents/legacy.pdf','legacy.pdf','application/pdf','staff-1');
INSERT INTO public.app_user_roles VALUES('staff-1','staff@example.test','staff');
INSERT INTO public.opportunity_pursuit_confidential_grants VALUES
  ('18500000-0000-4000-8000-000000000007','18500000-0000-4000-8000-000000000004','18500000-0000-4000-8000-000000000001',
   '18500000-0000-4000-8000-000000000006',NULL,clock_timestamp()+INTERVAL '1 day',
   '18500000-0000-4000-8000-000000000090','18500000-0000-4000-8000-000000000091','18500000-0000-4000-8000-000000000092');
SQL

"${psql[@]}" --file "$repo_root/scripts/124_recipient_information_memos.sql" >/dev/null
"${psql[@]}" >/dev/null <<'SQL'
DO $$ BEGIN
  IF (SELECT recipient_im_required FROM public.opportunities LIMIT 1) THEN RAISE EXCEPTION 'legacy_flag_changed'; END IF;
  IF (SELECT recipient_match_id FROM public.opportunity_documents WHERE title='Legacy reusable') IS NOT NULL THEN RAISE EXCEPTION 'legacy_im_reclassified'; END IF;
  IF NOT public.journey_repreneur_can_access_confidential('18500000-0000-4000-8000-000000000004','18500000-0000-4000-8000-000000000002','18500000-0000-4000-8000-000000000006') THEN RAISE EXCEPTION 'legacy_grant_lost'; END IF;
  IF has_table_privilege('anon','public.recipient_im_cleanup','SELECT') OR has_table_privilege('authenticated','public.recipient_im_cleanup','SELECT')
     OR has_table_privilege('service_role','public.recipient_im_cleanup','UPDATE') OR has_function_privilege('anon','public.set_opportunity_recipient_im_required(uuid,boolean,text)','EXECUTE')
  THEN RAISE EXCEPTION 'browser_or_service_write_permission_leaked'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.journey_current_dispatch_event(UUID) RETURNS UUID LANGUAGE sql AS $$ SELECT NULL::UUID $$;
DO $$ BEGIN
  IF public.journey_repreneur_can_access_confidential('18500000-0000-4000-8000-000000000004','18500000-0000-4000-8000-000000000002','18500000-0000-4000-8000-000000000006')
  THEN RAISE EXCEPTION 'e7_gate_bypassed'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.journey_current_dispatch_event(UUID) RETURNS UUID LANGUAGE sql AS $$ SELECT '18500000-0000-4000-8000-000000000092'::UUID $$;
CREATE OR REPLACE FUNCTION public.journey_current_gate_2_event(UUID) RETURNS UUID LANGUAGE sql AS $$ SELECT NULL::UUID $$;
DO $$ BEGIN
  IF public.journey_repreneur_can_access_confidential('18500000-0000-4000-8000-000000000004','18500000-0000-4000-8000-000000000002','18500000-0000-4000-8000-000000000006')
  THEN RAISE EXCEPTION 'gate_2_bypassed'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.journey_current_gate_2_event(UUID) RETURNS UUID LANGUAGE sql AS $$ SELECT '18500000-0000-4000-8000-000000000091'::UUID $$;
CREATE OR REPLACE FUNCTION public.journey_current_cycle_event(UUID) RETURNS UUID LANGUAGE sql AS $$ SELECT NULL::UUID $$;
DO $$ BEGIN
  IF public.journey_repreneur_can_access_confidential('18500000-0000-4000-8000-000000000004','18500000-0000-4000-8000-000000000002','18500000-0000-4000-8000-000000000006')
  THEN RAISE EXCEPTION 'cycle_gate_bypassed'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.journey_current_cycle_event(UUID) RETURNS UUID LANGUAGE sql AS $$ SELECT '18500000-0000-4000-8000-000000000090'::UUID $$;
SELECT public.set_opportunity_recipient_im_required('18500000-0000-4000-8000-000000000001',TRUE,'staff-1');
DO $$ BEGIN
  IF NOT public.journey_repreneur_can_access_confidential('18500000-0000-4000-8000-000000000004','18500000-0000-4000-8000-000000000002','18500000-0000-4000-8000-000000000006') THEN RAISE EXCEPTION 'historical_grant_changed_by_flag'; END IF;
  BEGIN
    UPDATE public.opportunity_pursuit_confidential_grants SET information_memo_document_id='18500000-0000-4000-8000-000000000006' WHERE match_id='18500000-0000-4000-8000-000000000004';
    RAISE EXCEPTION 'shared_grant_allowed_when_flagged';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='shared_grant_allowed_when_flagged' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.opportunity_documents(id,opportunity_id,title,document_type,storage_path,file_name,mime_type)
      VALUES('18500000-0000-4000-8000-000000000099','18500000-0000-4000-8000-000000000001','Unbound','deal_book','18500000-0000-4000-8000-000000000001/documents/unbound.pdf','unbound.pdf','application/pdf');
    RAISE EXCEPTION 'unbound_insert_allowed_when_flagged';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='unbound_insert_allowed_when_flagged' THEN RAISE; END IF;
  END;
END $$;
INSERT INTO public.private_upload_intents VALUES
  ('18500000-0000-4000-8000-000000000008','18500000-0000-4000-8000-000000000001/recipient-im/18500000-0000-4000-8000-000000000004/first.pdf',
   'opportunity_document','pending','18500000-0000-4000-8000-000000000004','staff','18500000-0000-4000-8000-000000000001','opportunity-documents','staff-1','application/pdf'),
  ('18500000-0000-4000-8000-000000000009','18500000-0000-4000-8000-000000000001/recipient-im/18500000-0000-4000-8000-000000000004/second.pdf',
   'opportunity_document','pending','18500000-0000-4000-8000-000000000004','staff','18500000-0000-4000-8000-000000000001','opportunity-documents','staff-1','application/pdf');
INSERT INTO public.opportunity_documents(id,opportunity_id,title,document_type,storage_bucket,storage_path,file_name,mime_type,uploaded_by)
  VALUES('18500000-0000-4000-8000-000000000010','18500000-0000-4000-8000-000000000001','A personalized','deal_book','opportunity-documents',
   '18500000-0000-4000-8000-000000000001/recipient-im/18500000-0000-4000-8000-000000000004/first.pdf','first.pdf','application/pdf','staff-1');
DO $$ BEGIN
  IF (SELECT recipient_repreneur_id FROM public.opportunity_documents WHERE id='18500000-0000-4000-8000-000000000010')<>'18500000-0000-4000-8000-000000000002'::UUID THEN RAISE EXCEPTION 'recipient_binding_missing'; END IF;
  BEGIN
    UPDATE public.opportunity_documents SET recipient_match_id=NULL WHERE id='18500000-0000-4000-8000-000000000010';
    RAISE EXCEPTION 'recipient_binding_mutated';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='recipient_binding_mutated' THEN RAISE; END IF; END;
END $$;
UPDATE public.opportunity_pursuit_confidential_grants SET information_memo_document_id='18500000-0000-4000-8000-000000000010' WHERE match_id='18500000-0000-4000-8000-000000000004';
SQL

# Two connections: a Drop transaction owns A's match row. A concurrent new
# grant and a stale signed-upload finalization must both lose after it commits.
"${psql[@]}" -Atc "BEGIN; SELECT public.journey_transition_terminal('18500000-0000-4000-8000-000000000004','drop','staff-1','drop-a-once','no_viable_match'); SELECT pg_sleep(1); COMMIT;" >"$cluster_dir/drop.out" 2>&1 &
drop_pid=$!
sleep 0.2
"${psql[@]}" -Atc "UPDATE public.opportunity_pursuit_confidential_grants SET information_memo_document_id='18500000-0000-4000-8000-000000000010',revoked_at=NULL WHERE match_id='18500000-0000-4000-8000-000000000004'" >"$cluster_dir/grant.out" 2>&1 &
grant_pid=$!
"${psql[@]}" -Atc "INSERT INTO public.opportunity_documents(id,opportunity_id,title,document_type,storage_bucket,storage_path,file_name,mime_type,uploaded_by) VALUES('18500000-0000-4000-8000-000000000011','18500000-0000-4000-8000-000000000001','Late A','deal_book','opportunity-documents','18500000-0000-4000-8000-000000000001/recipient-im/18500000-0000-4000-8000-000000000004/second.pdf','second.pdf','application/pdf','staff-1')" >"$cluster_dir/upload.out" 2>&1 &
upload_pid=$!
wait "$drop_pid"
if wait "$grant_pid"; then echo "Concurrent stale grant succeeded" >&2; exit 1; fi
if wait "$upload_pid"; then echo "Concurrent stale upload finalized" >&2; exit 1; fi

"${psql[@]}" >/dev/null <<'SQL'
DO $$ BEGIN
  IF public.recipient_im_staff_can_read('18500000-0000-4000-8000-000000000010')
    OR public.journey_repreneur_can_access_confidential('18500000-0000-4000-8000-000000000004','18500000-0000-4000-8000-000000000002','18500000-0000-4000-8000-000000000010')
  THEN RAISE EXCEPTION 'dropped_im_still_readable'; END IF;
  IF (SELECT count(*) FROM public.recipient_im_cleanup WHERE match_id='18500000-0000-4000-8000-000000000004')<>1
    OR NOT EXISTS(SELECT 1 FROM public.recipient_im_cleanup WHERE document_id='18500000-0000-4000-8000-000000000010'
      AND storage_path='18500000-0000-4000-8000-000000000001/recipient-im/18500000-0000-4000-8000-000000000004/first.pdf'
      AND drop_reason='no_viable_match' AND dropped_by='staff-1' AND status='pending')
  THEN RAISE EXCEPTION 'exact_cleanup_tombstone_missing'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.opportunity_documents WHERE id='18500000-0000-4000-8000-000000000006')
    OR NOT EXISTS(SELECT 1 FROM public.opportunity_documents WHERE id='18500000-0000-4000-8000-000000000010')
  THEN RAISE EXCEPTION 'legacy_or_tombstone_document_lost'; END IF;
  IF public.record_recipient_im_cleanup_attempt('18500000-0000-4000-8000-000000000010','failed','storage_remove_failed')<>'failed'
    OR public.record_recipient_im_cleanup_attempt('18500000-0000-4000-8000-000000000010','deleted',NULL)<>'deleted'
    OR public.record_recipient_im_cleanup_attempt('18500000-0000-4000-8000-000000000010','deleted',NULL)<>'deleted'
  THEN RAISE EXCEPTION 'cleanup_retry_state_invalid'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.recipient_im_cleanup WHERE document_id='18500000-0000-4000-8000-000000000010' AND status='deleted' AND attempt_count=2 AND deletion_receipt_at IS NOT NULL)
  THEN RAISE EXCEPTION 'cleanup_receipt_not_truthful'; END IF;
END $$;
UPDATE public.opportunity_matches SET status='active_pursuit' WHERE id='18500000-0000-4000-8000-000000000005';
DO $$ BEGIN
  BEGIN
    INSERT INTO public.opportunity_pursuit_confidential_grants VALUES('18500000-0000-4000-8000-000000000012','18500000-0000-4000-8000-000000000005','18500000-0000-4000-8000-000000000001',
      '18500000-0000-4000-8000-000000000010',NULL,clock_timestamp()+INTERVAL '1 day',
      '18500000-0000-4000-8000-000000000090','18500000-0000-4000-8000-000000000091','18500000-0000-4000-8000-000000000092');
    RAISE EXCEPTION 'B_inherited_A_im';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='B_inherited_A_im' THEN RAISE; END IF; END;
END $$;
SELECT public.set_opportunity_recipient_im_required('18500000-0000-4000-8000-000000000001',FALSE,'staff-1');
INSERT INTO public.opportunity_pursuit_confidential_grants VALUES('18500000-0000-4000-8000-000000000013','18500000-0000-4000-8000-000000000005','18500000-0000-4000-8000-000000000001',
  '18500000-0000-4000-8000-000000000006',NULL,clock_timestamp()+INTERVAL '1 day',
  '18500000-0000-4000-8000-000000000090','18500000-0000-4000-8000-000000000091','18500000-0000-4000-8000-000000000092');
DO $$ BEGIN
  IF NOT public.journey_repreneur_can_access_confidential('18500000-0000-4000-8000-000000000005','18500000-0000-4000-8000-000000000003','18500000-0000-4000-8000-000000000006')
  THEN RAISE EXCEPTION 'B_reusable_grant_missing'; END IF;
END $$;
SQL

# A recipient download's shared match lock must hold Drop at the transaction
# boundary until the private response has been buffered and reauthorized.
"${psql[@]}" -Atc "BEGIN; SELECT id FROM public.opportunity_matches WHERE id='18500000-0000-4000-8000-000000000005' FOR SHARE; SELECT pg_sleep(1); COMMIT;" >"$cluster_dir/download.out" 2>&1 &
download_pid=$!
sleep 0.2
"${psql[@]}" -Atc "SELECT public.journey_transition_terminal('18500000-0000-4000-8000-000000000005','drop','staff-1','drop-b-after-download','no_viable_match');" >"$cluster_dir/drop-after-download.out" 2>&1 &
delayed_drop_pid=$!
sleep 0.2
if ! kill -0 "$delayed_drop_pid" 2>/dev/null; then echo "Drop bypassed an in-flight recipient download lock" >&2; exit 1; fi
wait "$download_pid"
wait "$delayed_drop_pid"

echo "PASS: additive legacy compatibility, exact binding, grant isolation, Gate 2/E7, Drop/grant/upload/download serialization, permissions, tombstone and cleanup retry"
