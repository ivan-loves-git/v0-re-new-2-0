#!/usr/bin/env bash
set -euo pipefail

# Disposable #224 transaction proof. No app credentials or provider access.
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
fixture_root="${TMPDIR:-/tmp}"
fixture_root="${fixture_root%/}"
cluster_dir="$(mktemp -d "$fixture_root/renew-email-bulk.XXXXXX")"
port=$((56000 + RANDOM % 7000))
cleanup() {
  if [[ -f "$cluster_dir/postmaster.pid" ]]; then "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true; fi
  case "$cluster_dir" in "$fixture_root"/renew-email-bulk.*) rm -rf "$cluster_dir" ;; esac
}
trap cleanup EXIT

"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 --auth-local=trust --username=renew_bulk_admin >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -l "$cluster_dir/postgres.log" -o "-c listen_addresses='' -k $cluster_dir -p $port" -w start >/dev/null
"$pg_bin/createdb" -h "$cluster_dir" -p "$port" -U renew_bulk_admin renew_bulk_fixture
psql=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h "$cluster_dir" -p "$port" -U renew_bulk_admin -d renew_bulk_fixture)

"${psql[@]}" >/dev/null <<'SQL'
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE TABLE public.opportunities(id uuid PRIMARY KEY,is_demo boolean NOT NULL);
CREATE TABLE public.repreneurs(id uuid PRIMARY KEY,first_name text,last_name text,avatar_url text);
CREATE TABLE public.opportunity_matches(id uuid PRIMARY KEY,opportunity_id uuid REFERENCES public.opportunities(id),repreneur_id uuid);
CREATE TABLE public.opportunity_pursuit_evidence(id uuid PRIMARY KEY,match_id uuid REFERENCES public.opportunity_matches(id));
CREATE TABLE public.ma_firms(id uuid PRIMARY KEY,name text);
CREATE TABLE public.ma_offices(id uuid PRIMARY KEY,firm_id uuid REFERENCES public.ma_firms(id),name text);
CREATE TABLE public.ma_contacts(id uuid PRIMARY KEY,display_name text);
CREATE TABLE public.ma_contact_office_affiliations(id uuid PRIMARY KEY,contact_id uuid REFERENCES public.ma_contacts(id),office_id uuid REFERENCES public.ma_offices(id));
CREATE TABLE public.opportunity_ma_contacts(id uuid PRIMARY KEY,affiliation_id uuid REFERENCES public.ma_contact_office_affiliations(id));
CREATE TABLE public."user"(id text PRIMARY KEY,email text NOT NULL);
CREATE TABLE public.app_user_roles(user_id text,email text,role text);
CREATE TABLE public.ma_source_email_send_reservations(opportunity_id uuid PRIMARY KEY REFERENCES public.opportunities(id),reservation_token uuid DEFAULT gen_random_uuid(),expires_at timestamptz,actor text);
CREATE TABLE public.ma_interactions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),client_operation_key uuid,
  opportunity_id uuid,template_key text,recipient_email_snapshot text,title text,body_markdown text,
  channel text,direction text,delivery_status text,provider_message_id text);
CREATE TABLE public.ma_interaction_delivery_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),interaction_id uuid REFERENCES public.ma_interactions(id),event_kind text);
CREATE TABLE public.opportunity_pursuit_handoff_deliveries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),upstream_evidence_id uuid,
  match_id uuid,handoff_type text,delivery_status text,provider_message_id text,evidence_id uuid,
  operation_key uuid DEFAULT gen_random_uuid(),attempt_count integer DEFAULT 1,last_attempt_at timestamptz);
CREATE TABLE public.opportunity_freshness_deliveries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),review_id uuid,
  delivery_status text,provider_message_id text,attempted_at timestamptz);
INSERT INTO public.opportunities VALUES
  ('22400000-0000-4000-8000-000000000001',false),('22400000-0000-4000-8000-000000000002',false),
  ('22400000-0000-4000-8000-000000000003',false),('22400000-0000-4000-8000-000000000004',false),
  ('22400000-0000-4000-8000-000000000005',false),('22400000-0000-4000-8000-000000000006',true);
INSERT INTO public.repreneurs VALUES ('22400000-0000-4000-8000-000000000011','Fictional','Buyer',NULL);
INSERT INTO public.opportunity_matches VALUES
  ('22400000-0000-4000-8000-000000000021','22400000-0000-4000-8000-000000000002','22400000-0000-4000-8000-000000000011'),
  ('22400000-0000-4000-8000-000000000022','22400000-0000-4000-8000-000000000003','22400000-0000-4000-8000-000000000011'),
  ('22400000-0000-4000-8000-000000000023','22400000-0000-4000-8000-000000000004','22400000-0000-4000-8000-000000000011');
INSERT INTO public.opportunity_pursuit_evidence VALUES
  ('22400000-0000-4000-8000-000000000031','22400000-0000-4000-8000-000000000021'),
  ('22400000-0000-4000-8000-000000000032','22400000-0000-4000-8000-000000000022'),
  ('22400000-0000-4000-8000-000000000033','22400000-0000-4000-8000-000000000023');
INSERT INTO public.ma_firms VALUES ('22400000-0000-4000-8000-000000000041','Fictional firm');
INSERT INTO public.ma_offices VALUES ('22400000-0000-4000-8000-000000000042','22400000-0000-4000-8000-000000000041','Fictional office');
INSERT INTO public.ma_contacts VALUES ('22400000-0000-4000-8000-000000000043','Fictional contact');
INSERT INTO public.ma_contact_office_affiliations VALUES ('22400000-0000-4000-8000-000000000044','22400000-0000-4000-8000-000000000043','22400000-0000-4000-8000-000000000042');
INSERT INTO public.opportunity_ma_contacts VALUES ('22400000-0000-4000-8000-000000000045','22400000-0000-4000-8000-000000000044');
INSERT INTO public."user" VALUES ('staff-one','one@example.test'),('staff-two','two@example.test');
INSERT INTO public.app_user_roles VALUES ('staff-one','one@example.test','staff'),('staff-two','two@example.test','staff');
SQL

"${psql[@]}" -f "$repo_root/scripts/121_staff_email_review_queue.sql" >/dev/null
"${psql[@]}" >/dev/null <<'SQL'
ALTER TABLE public.staff_email_reviews DROP CONSTRAINT staff_email_reviews_source_kind_check;
ALTER TABLE public.staff_email_reviews ADD CONSTRAINT staff_email_reviews_source_kind_check CHECK (source_kind IN ('ma','e4','e6','e7','freshness'));
ALTER TABLE public.staff_email_reviews DROP CONSTRAINT staff_email_reviews_handoff_binding;
ALTER TABLE public.staff_email_reviews ADD CONSTRAINT staff_email_reviews_handoff_binding CHECK (
  (source_kind IN ('ma','freshness') AND match_id IS NULL AND upstream_evidence_id IS NULL AND contact_link_id IS NOT NULL)
  OR (source_kind='e6' AND match_id IS NOT NULL AND upstream_evidence_id=source_operation_id AND contact_link_id IS NULL)
  OR (source_kind IN ('e4','e7') AND match_id IS NOT NULL AND upstream_evidence_id=source_operation_id AND contact_link_id IS NOT NULL));
ALTER TABLE public.staff_email_review_events DROP CONSTRAINT staff_email_review_events_event_kind_check;
ALTER TABLE public.staff_email_review_events ADD CONSTRAINT staff_email_review_events_event_kind_check
  CHECK (event_kind IN ('prepared','edited','refreshed','approved','sending','sent','failed','uncertain','cancelled'));
CREATE TABLE public.opportunity_freshness_members(review_id uuid REFERENCES public.staff_email_reviews(id) ON DELETE CASCADE,
  opportunity_id uuid,episode_key text,PRIMARY KEY(review_id,opportunity_id),UNIQUE(opportunity_id,episode_key));
ALTER TABLE public.opportunity_freshness_deliveries ADD CONSTRAINT fixture_freshness_review_fk
  FOREIGN KEY(review_id) REFERENCES public.staff_email_reviews(id) ON DELETE RESTRICT;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO service_role;
SQL
"${psql[@]}" -f "$repo_root/scripts/130_staff_email_review_queue_projection.sql" >/dev/null
"${psql[@]}" -f "$repo_root/supabase/migrations/20260929230707_reversible_staff_email_archive.sql" >/dev/null

"${psql[@]}" >/dev/null <<'SQL'
CREATE FUNCTION public.reserve_ma_source_email_send(p_opportunity_id uuid,p_actor text)
RETURNS uuid LANGUAGE plpgsql AS $$ DECLARE v uuid; BEGIN
  INSERT INTO public.ma_source_email_send_reservations(opportunity_id,expires_at,actor)
    VALUES(p_opportunity_id,now()+interval '2 minutes',p_actor) RETURNING reservation_token INTO v;
  RETURN v;
END $$;
CREATE FUNCTION public.journey_begin_handoff_delivery(p_match_id uuid,p_upstream_evidence_id uuid,
  p_handoff_type text,p_request_fingerprint text,p_actor text,p_attachment_snapshot jsonb)
RETURNS TABLE(delivery_id uuid,operation_key uuid,delivery_status text,evidence_id uuid)
LANGUAGE plpgsql AS $$ BEGIN
  RETURN QUERY INSERT INTO public.opportunity_pursuit_handoff_deliveries(upstream_evidence_id,match_id,handoff_type,delivery_status)
    VALUES(p_upstream_evidence_id,p_match_id,p_handoff_type,'sending')
    RETURNING id,public.opportunity_pursuit_handoff_deliveries.operation_key,public.opportunity_pursuit_handoff_deliveries.delivery_status,
      public.opportunity_pursuit_handoff_deliveries.evidence_id;
END $$;
CREATE FUNCTION public.opportunity_freshness_reserve(p_review_id uuid,p_version integer,p_payload jsonb,p_fingerprint text,p_actor text)
RETURNS uuid LANGUAGE plpgsql AS $$ DECLARE v uuid:=gen_random_uuid(); BEGIN
  UPDATE public.staff_email_reviews SET state='sending',version=version+1,attempted_payload=p_payload,
    attempted_at=now(),attempt_token=v,approved_by=p_actor,approved_at=now()
    WHERE id=p_review_id AND version=p_version AND state='pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'freshness_stale'; END IF;
  INSERT INTO public.opportunity_freshness_deliveries(review_id,delivery_status,attempted_at)
    VALUES(p_review_id,'pending',now());
  RETURN v;
END $$;
SQL

"${psql[@]}" -f "$repo_root/supabase/migrations/20260929235619_bounded_staff_email_bulk_send.sql" >/dev/null
"${psql[@]}" >/dev/null <<'SQL'
DO $$ DECLARE i integer; v uuid; v_op uuid; v_kind text; v_match uuid; v_source uuid; BEGIN
  FOR i IN 1..5 LOOP
    v_op:=('22400000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
    v_kind:=CASE i WHEN 1 THEN 'ma' WHEN 2 THEN 'e4' WHEN 3 THEN 'e6' WHEN 4 THEN 'e7' ELSE 'freshness' END;
    v_match:=CASE i WHEN 2 THEN '22400000-0000-4000-8000-000000000021'::uuid
      WHEN 3 THEN '22400000-0000-4000-8000-000000000022'::uuid
      WHEN 4 THEN '22400000-0000-4000-8000-000000000023'::uuid ELSE NULL END;
    v_source:=CASE i WHEN 2 THEN '22400000-0000-4000-8000-000000000031'::uuid
      WHEN 3 THEN '22400000-0000-4000-8000-000000000032'::uuid
      WHEN 4 THEN '22400000-0000-4000-8000-000000000033'::uuid
      ELSE ('22400000-0000-4000-8000-'||lpad((50+i)::text,12,'0'))::uuid END;
    IF i=5 THEN
      INSERT INTO public.staff_email_reviews(source_kind,source_operation_id,opportunity_id,contact_link_id,
        recipient_email,namespace,template_key,template_version,subject,body_text,created_by)
      VALUES('freshness',v_source,v_op,'22400000-0000-4000-8000-000000000045',
        'recipient5@example.test','REAL','ma_opportunity_validity_check','copy-v1',
        'Fictional subject 5','Fictional complete body 5','staff-one') RETURNING id INTO v;
      INSERT INTO public.opportunity_freshness_members VALUES(v,v_op,'fictional-episode');
    ELSE
      v:=public.staff_email_review_prepare(v_kind,v_source,v_op,v_match,
        CASE WHEN v_match IS NULL THEN NULL ELSE v_source END,
        CASE WHEN i=3 THEN NULL ELSE '22400000-0000-4000-8000-000000000045'::uuid END,
        'recipient'||i||'@example.test','REAL',CASE WHEN i=3 THEN 'code:e6_nda_ready' ELSE 'ma_process_follow_up' END,
        'copy-v1','Fictional subject '||i,'Fictional complete body '||i,'[]'::jsonb,'staff-one');
    END IF;
  END LOOP;
END $$;
DO $$ DECLARE v uuid; BEGIN
  v:=public.staff_email_review_prepare('ma','22400000-0000-4000-8000-000000000056',
    '22400000-0000-4000-8000-000000000006',NULL,NULL,'22400000-0000-4000-8000-000000000045',
    'demo@example.test','DEMO','ma_process_follow_up','copy-v1','DEMO','No send','[]'::jsonb,'staff-one');
END $$;
SQL

"${psql[@]}" -Atc "SELECT public.staff_email_bulk_prepare(
  ARRAY(SELECT id FROM public.staff_email_reviews WHERE namespace='REAL' ORDER BY id),
  ARRAY[1,1,1,1,1],1,'active','%','all','prepared','desc','staff-one')" >/dev/null
"${psql[@]}" >/dev/null <<'SQL'
DO $$ DECLARE v uuid; i integer; h text; BEGIN
  SELECT id INTO v FROM public.staff_email_bulk_batches LIMIT 1;
  FOR i IN 1..5 LOOP
    SELECT snapshot_sha256 INTO h FROM public.staff_email_bulk_items WHERE batch_id=v AND ordinal=i;
    PERFORM public.staff_email_bulk_ack(v,i,h,'staff-one');
  END LOOP;
  PERFORM public.staff_email_bulk_confirm(v,(SELECT manifest_sha256 FROM public.staff_email_bulk_batches WHERE id=v),'staff-one');
  IF (SELECT count(*) FROM public.staff_email_bulk_items WHERE batch_id=v AND acknowledged_by='staff-one')<>5
  THEN RAISE EXCEPTION 'acks_missing'; END IF;
END $$;
SQL

echo "bulk fixture migration, five-kind manifest, individual acknowledgments and confirmation: passed"

"${psql[@]}" >/dev/null <<'SQL'
DO $$ DECLARE v_batch uuid; v_item public.staff_email_bulk_items%ROWTYPE;
  v_claim jsonb; v_again jsonb; v_payload jsonb; v_kind text; v_count integer:=0;
BEGIN
  SELECT id INTO v_batch FROM public.staff_email_bulk_batches LIMIT 1;
  IF has_table_privilege('anon','public.staff_email_bulk_batches','SELECT')
    OR has_table_privilege('authenticated','public.staff_email_bulk_items','SELECT')
    OR has_function_privilege('anon','public.staff_email_bulk_claim(uuid,integer,text,jsonb,text)','EXECUTE')
    OR has_function_privilege('authenticated','public.staff_email_bulk_prepare(uuid[],integer[],integer,text,text,text,text,text,text)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.staff_email_bulk_claim(uuid,integer,text,jsonb,text)','EXECUTE')
  THEN RAISE EXCEPTION 'bulk_acl_not_service_only'; END IF;
  FOR v_item IN SELECT * FROM public.staff_email_bulk_items WHERE batch_id=v_batch ORDER BY ordinal LOOP
    v_kind:=v_item.review_snapshot->>'source_kind';
    v_payload:=jsonb_build_object('from','Fictional sender','to',jsonb_build_array(v_item.review_snapshot->>'recipient_email'),
      'subject',v_item.review_snapshot->>'subject','text',v_item.review_snapshot->>'body_text','html','<p>Fictional</p>');
    IF v_kind<>'freshness' THEN
      v_payload:=v_payload||jsonb_build_object('attachments',v_item.review_snapshot->'attachment_snapshot');
    END IF;
    v_claim:=public.staff_email_bulk_claim(v_batch,v_item.ordinal,'staff-one',v_payload,repeat('a',64));
    IF v_claim->>'start'<>'true' OR v_claim->>'claim_token' IS NULL OR v_claim->>'review_attempt_token' IS NULL
    THEN RAISE EXCEPTION 'bulk_claim_not_started_%',v_kind; END IF;
    v_again:=public.staff_email_bulk_claim(v_batch,v_item.ordinal,'staff-one',v_payload,repeat('a',64));
    IF v_again->>'start'<>'false' OR v_again->>'state'<>'started'
    THEN RAISE EXCEPTION 'bulk_claim_repeated_%',v_kind; END IF;
    PERFORM public.staff_email_bulk_finish(v_batch,v_item.ordinal,(v_claim->>'claim_token')::uuid,
      'uncertain','Fixture lost provider response','staff-one');
    v_count:=v_count+1;
  END LOOP;
  IF v_count<>5 OR (SELECT count(*) FROM public.staff_email_bulk_items WHERE batch_id=v_batch AND state='uncertain')<>5
    OR (SELECT count(*) FROM public.ma_source_email_send_reservations)<>3
    OR (SELECT count(*) FROM public.opportunity_pursuit_handoff_deliveries)<>3
    OR (SELECT count(*) FROM public.opportunity_freshness_deliveries)<>1
  THEN RAISE EXCEPTION 'bulk_five_source_reservation_count_mismatch'; END IF;
  BEGIN
    DELETE FROM public.staff_email_reviews WHERE id=(SELECT review_id FROM public.staff_email_bulk_items WHERE batch_id=v_batch LIMIT 1);
    RAISE EXCEPTION 'bulk_unknown_review_delete_allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='bulk_unknown_review_delete_allowed' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.staff_email_bulk_items WHERE batch_id=v_batch)<>5
  THEN RAISE EXCEPTION 'bulk_unknown_item_lost'; END IF;
END $$;
SQL
echo "five source reservations, once-only repeat, uncertainty and parent-delete guard: passed"

"${psql[@]}" >/dev/null <<'SQL'
CREATE FUNCTION public.fixture_bulk_payload(p_batch uuid,p_ordinal integer DEFAULT 1) RETURNS jsonb
LANGUAGE sql AS $$
  SELECT jsonb_build_object('from','Fictional sender','to',jsonb_build_array(i.review_snapshot->>'recipient_email'),
    'subject',i.review_snapshot->>'subject','text',i.review_snapshot->>'body_text',
    'html','<p>Fictional</p>','attachments',i.review_snapshot->'attachment_snapshot')
  FROM public.staff_email_bulk_items i WHERE i.batch_id=p_batch AND i.ordinal=p_ordinal;
$$;
CREATE FUNCTION public.fixture_bulk_claim(p_batch uuid,p_ordinal integer DEFAULT 1) RETURNS jsonb
LANGUAGE sql AS $$ SELECT public.staff_email_bulk_claim(p_batch,p_ordinal,'staff-one',
  public.fixture_bulk_payload(p_batch,p_ordinal),repeat('b',64)); $$;
CREATE FUNCTION public.fixture_bulk_prepare_one(p_source uuid,p_confirm boolean DEFAULT true) RETURNS uuid
LANGUAGE plpgsql AS $$ DECLARE v_review uuid; v_batch uuid; v_hash text; BEGIN
  SELECT id INTO v_review FROM public.staff_email_reviews WHERE source_operation_id=p_source;
  v_batch:=public.staff_email_bulk_prepare(ARRAY[v_review],ARRAY[1],1,'active','%','all','prepared','desc','staff-one');
  SELECT snapshot_sha256 INTO v_hash FROM public.staff_email_bulk_items WHERE batch_id=v_batch AND ordinal=1;
  PERFORM public.staff_email_bulk_ack(v_batch,1,v_hash,'staff-one');
  IF p_confirm THEN
    PERFORM public.staff_email_bulk_confirm(v_batch,(SELECT manifest_sha256 FROM public.staff_email_bulk_batches WHERE id=v_batch),'staff-one');
  END IF;
  RETURN v_batch;
END $$;
INSERT INTO public.opportunities VALUES
  ('22400000-0000-4000-8000-000000000007',false),
  ('22400000-0000-4000-8000-000000000008',false),
  ('22400000-0000-4000-8000-000000000009',false),
  ('22400000-0000-4000-8000-000000000010',false),
  ('22400000-0000-4000-8000-000000000011',false);
DO $$ DECLARE i integer; v uuid; BEGIN
  FOR i IN 7..11 LOOP
    v:=public.staff_email_review_prepare('ma',('22400000-0000-4000-8000-'||lpad((50+i)::text,12,'0'))::uuid,
      ('22400000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,NULL,NULL,
      '22400000-0000-4000-8000-000000000045','extra'||i||'@example.test','REAL',
      'ma_process_follow_up','copy-v1','Fictional extra '||i,'Fictional complete body',
      '[]'::jsonb,'staff-one');
  END LOOP;
END $$;
SQL

"${psql[@]}" >/dev/null <<'SQL'
DO $$ DECLARE v uuid; v_review uuid; BEGIN
  -- A live recipient change invalidates the frozen manifest before provider I/O.
  v:=public.fixture_bulk_prepare_one('22400000-0000-4000-8000-000000000057');
  SELECT review_id INTO v_review FROM public.staff_email_bulk_items WHERE batch_id=v;
  UPDATE public.staff_email_reviews SET recipient_email='changed@example.test' WHERE id=v_review;
  BEGIN
    PERFORM public.fixture_bulk_claim(v);
    RAISE EXCEPTION 'recipient_drift_claim_allowed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='recipient_drift_claim_allowed' THEN RAISE; END IF; END;
  PERFORM public.staff_email_bulk_block(v,1,'staff-one','Recipient changed before provider I/O');
  IF (SELECT state FROM public.staff_email_bulk_items WHERE batch_id=v)<>'blocked'
  THEN RAISE EXCEPTION 'recipient_drift_not_blocked'; END IF;

  -- Archive-first blocks this confirmed batch without weakening restore.
  v:=public.fixture_bulk_prepare_one('22400000-0000-4000-8000-000000000058');
  SELECT review_id INTO v_review FROM public.staff_email_bulk_items WHERE batch_id=v;
  PERFORM public.staff_email_review_archive(v_review,1,'staff-one');
  BEGIN
    PERFORM public.fixture_bulk_claim(v);
    RAISE EXCEPTION 'archived_claim_allowed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='archived_claim_allowed' THEN RAISE; END IF; END;
  IF (SELECT state FROM public.staff_email_bulk_items WHERE batch_id=v)<>'not_attempted'
  THEN RAISE EXCEPTION 'archive_attempted_provider'; END IF;

  -- A changed reviewed version invalidates acknowledgment/confirmation.
  v:=public.fixture_bulk_prepare_one('22400000-0000-4000-8000-000000000060',false);
  SELECT review_id INTO v_review FROM public.staff_email_bulk_items WHERE batch_id=v;
  PERFORM public.staff_email_review_edit(v_review,1,'New subject','New body','staff-one');
  BEGIN
    PERFORM public.staff_email_bulk_confirm(v,(SELECT manifest_sha256 FROM public.staff_email_bulk_batches WHERE id=v),'staff-one');
    RAISE EXCEPTION 'stale_version_confirmed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='stale_version_confirmed' THEN RAISE; END IF; END;

  -- A different staff actor cannot inherit the preparing actor's approval.
  v:=public.fixture_bulk_prepare_one('22400000-0000-4000-8000-000000000061',false);
  BEGIN
    PERFORM public.staff_email_bulk_confirm(v,(SELECT manifest_sha256 FROM public.staff_email_bulk_batches WHERE id=v),'staff-two');
    RAISE EXCEPTION 'other_actor_confirmed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='other_actor_confirmed' THEN RAISE; END IF; END;
END $$;
SQL
echo "recipient, archive, version and actor drift: passed"

# Two independent SQL sessions confirm one saved manifest, then race the same
# source claim. Only the first claim may return start=true.
race_batch="$("${psql[@]}" -Atc "SELECT public.fixture_bulk_prepare_one('22400000-0000-4000-8000-000000000059',false)")"
"${psql[@]}" -Atc "BEGIN; SELECT public.staff_email_bulk_confirm('$race_batch',(SELECT manifest_sha256 FROM public.staff_email_bulk_batches WHERE id='$race_batch'),'staff-one'); SELECT pg_sleep(0.8); COMMIT;" >"$cluster_dir/confirm-first.out" 2>"$cluster_dir/confirm-first.err" &
first_pid=$!
sleep 0.15
"${psql[@]}" -Atc "SELECT public.staff_email_bulk_confirm('$race_batch',(SELECT manifest_sha256 FROM public.staff_email_bulk_batches WHERE id='$race_batch'),'staff-one');" >"$cluster_dir/confirm-second.out" 2>"$cluster_dir/confirm-second.err"
wait "$first_pid"
"${psql[@]}" -Atc "BEGIN; SELECT public.fixture_bulk_claim('$race_batch'); SELECT pg_sleep(0.8); COMMIT;" >"$cluster_dir/claim-first.out" 2>"$cluster_dir/claim-first.err" &
first_pid=$!
sleep 0.15
"${psql[@]}" -Atc "SELECT public.fixture_bulk_claim('$race_batch');" >"$cluster_dir/claim-second.out" 2>"$cluster_dir/claim-second.err"
wait "$first_pid"
if ! grep -q '"start": true' "$cluster_dir/claim-first.out" || ! grep -q '"start": false' "$cluster_dir/claim-second.out"; then
  echo "independent-session claim did not preserve one starter" >&2
  exit 1
fi
"${psql[@]}" -v batch="$race_batch" >/dev/null <<'SQL'
DO $$ DECLARE v uuid; s text; BEGIN
  SELECT batch_id INTO v FROM public.staff_email_bulk_items i JOIN public.staff_email_reviews r ON r.id=i.review_id
    WHERE r.source_operation_id='22400000-0000-4000-8000-000000000059';
  UPDATE public.staff_email_bulk_items SET started_at=now()-interval '3 minutes' WHERE batch_id=v;
  s:=public.staff_email_bulk_reconcile(v,1,'staff-one');
  IF s<>'uncertain' OR (SELECT state FROM public.staff_email_bulk_items WHERE batch_id=v)<>'uncertain'
  THEN RAISE EXCEPTION 'lost_response_not_uncertain'; END IF;
  IF public.fixture_bulk_claim(v)->>'start'<>'false' THEN RAISE EXCEPTION 'lost_response_replayed'; END IF;
END $$;
SQL
echo "independent-session confirmation and claim, lost response and lease: passed"

"${psql[@]}" >/dev/null <<'SQL'
INSERT INTO public.opportunities VALUES
  ('22400000-0000-4000-8000-000000000012',false),
  ('22400000-0000-4000-8000-000000000013',false),
  ('22400000-0000-4000-8000-000000000014',false);
DO $$ DECLARE i integer; v uuid; BEGIN
  FOR i IN 12..14 LOOP
    v:=public.staff_email_review_prepare('ma',('22400000-0000-4000-8000-'||lpad((50+i)::text,12,'0'))::uuid,
      ('22400000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,NULL,NULL,
      '22400000-0000-4000-8000-000000000045','serial'||i||'@example.test','REAL',
      'ma_process_follow_up','copy-v1','Serial fictional '||i,'Complete serial message',
      '[]'::jsonb,'staff-one');
  END LOOP;
END $$;
DO $$ DECLARE v_batch uuid; v_id1 uuid; v_id2 uuid; h text; v_claim jsonb; BEGIN
  SELECT id INTO v_id1 FROM public.staff_email_reviews WHERE source_operation_id='22400000-0000-4000-8000-000000000062';
  SELECT id INTO v_id2 FROM public.staff_email_reviews WHERE source_operation_id='22400000-0000-4000-8000-000000000063';
  v_batch:=public.staff_email_bulk_prepare(ARRAY[v_id1,v_id2],ARRAY[1,1],1,'active','%','all','prepared','desc','staff-one');
  SELECT snapshot_sha256 INTO h FROM public.staff_email_bulk_items WHERE batch_id=v_batch AND ordinal=1;
  PERFORM public.staff_email_bulk_ack(v_batch,1,h,'staff-one');
  SELECT snapshot_sha256 INTO h FROM public.staff_email_bulk_items WHERE batch_id=v_batch AND ordinal=2;
  PERFORM public.staff_email_bulk_ack(v_batch,2,h,'staff-one');
  PERFORM public.staff_email_bulk_confirm(v_batch,(SELECT manifest_sha256 FROM public.staff_email_bulk_batches WHERE id=v_batch),'staff-one');
  v_claim:=public.fixture_bulk_claim(v_batch,1);
  BEGIN
    PERFORM public.fixture_bulk_claim(v_batch,2);
    RAISE EXCEPTION 'second_item_claimed_during_first';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='second_item_claimed_during_first' THEN RAISE; END IF; END;
  IF (SELECT state FROM public.staff_email_bulk_items WHERE batch_id=v_batch AND ordinal=2)<>'not_attempted'
  THEN RAISE EXCEPTION 'partial_second_not_attempted_lost'; END IF;
  PERFORM public.staff_email_bulk_finish(v_batch,1,(v_claim->>'claim_token')::uuid,'uncertain','Lost response','staff-one');
  v_claim:=public.fixture_bulk_claim(v_batch,2);
  IF v_claim->>'start'<>'true' THEN RAISE EXCEPTION 'partial_resume_failed'; END IF;
  BEGIN
    PERFORM public.staff_email_review_archive(v_id2,2,'staff-one');
    RAISE EXCEPTION 'archive_after_claim_allowed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='archive_after_claim_allowed' THEN RAISE; END IF; END;
END $$;
SQL
echo "partial batch, serial continuation and claim-before-archive: passed"

individual_batch="$("${psql[@]}" -Atc "SELECT public.fixture_bulk_prepare_one('22400000-0000-4000-8000-000000000064')")"
"${psql[@]}" -Atc "BEGIN; SELECT public.staff_email_review_reserve(
  (SELECT review_id FROM public.staff_email_bulk_items WHERE batch_id='$individual_batch'),1,
  public.fixture_bulk_payload('$individual_batch'),'staff-one'); SELECT pg_sleep(0.8); COMMIT;" >"$cluster_dir/individual-first.out" 2>"$cluster_dir/individual-first.err" &
first_pid=$!
sleep 0.15
if "${psql[@]}" -Atc "SELECT public.fixture_bulk_claim('$individual_batch');" >"$cluster_dir/bulk-after-individual.out" 2>"$cluster_dir/bulk-after-individual.err"; then
  echo "bulk claim passed an individual reservation" >&2
  exit 1
fi
wait "$first_pid"
"${psql[@]}" -Atc "SELECT CASE WHEN (SELECT state FROM public.staff_email_bulk_items WHERE batch_id='$individual_batch')='not_attempted'
  THEN 'individual-first kept batch unclaimed' ELSE 'invalid' END;" | grep -q 'individual-first kept batch unclaimed'
echo "independent-session individual-first reservation blocks batch claim: passed"
