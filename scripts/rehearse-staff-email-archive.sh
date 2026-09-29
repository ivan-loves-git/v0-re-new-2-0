#!/usr/bin/env bash
set -euo pipefail

# Disposable #223 SQL proof. No application credentials or provider are loaded.
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
cluster_dir="$(mktemp -d /private/tmp/renew-email-archive.XXXXXX)"
port=$((56000 + RANDOM % 7000))
cleanup() {
  if [[ -f "$cluster_dir/postmaster.pid" ]]; then "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true; fi
  case "$cluster_dir" in /private/tmp/renew-email-archive.*) rm -rf "$cluster_dir" ;; esac
}
trap cleanup EXIT

"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 --auth-local=trust --username=renew_archive_admin >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -l "$cluster_dir/postgres.log" -o "-c listen_addresses='' -k $cluster_dir -p $port" -w start >/dev/null
"$pg_bin/createdb" -h "$cluster_dir" -p "$port" -U renew_archive_admin renew_archive_fixture
psql=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h "$cluster_dir" -p "$port" -U renew_archive_admin -d renew_archive_fixture)

"${psql[@]}" >/dev/null <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE TABLE public.opportunities(id uuid PRIMARY KEY, is_demo boolean NOT NULL);
CREATE TABLE public.repreneurs(id uuid PRIMARY KEY, first_name text, last_name text, avatar_url text);
CREATE TABLE public.opportunity_matches(id uuid PRIMARY KEY, opportunity_id uuid REFERENCES public.opportunities(id), repreneur_id uuid REFERENCES public.repreneurs(id));
CREATE TABLE public.opportunity_pursuit_evidence(id uuid PRIMARY KEY, match_id uuid REFERENCES public.opportunity_matches(id) ON DELETE CASCADE);
CREATE TABLE public.ma_firms(id uuid PRIMARY KEY, name text);
CREATE TABLE public.ma_offices(id uuid PRIMARY KEY, firm_id uuid REFERENCES public.ma_firms(id), name text);
CREATE TABLE public.ma_contacts(id uuid PRIMARY KEY, display_name text);
CREATE TABLE public.ma_contact_office_affiliations(id uuid PRIMARY KEY, contact_id uuid REFERENCES public.ma_contacts(id), office_id uuid REFERENCES public.ma_offices(id));
CREATE TABLE public.opportunity_ma_contacts(id uuid PRIMARY KEY, affiliation_id uuid REFERENCES public.ma_contact_office_affiliations(id));
CREATE TABLE public."user"(id text PRIMARY KEY, email text NOT NULL);
CREATE TABLE public.app_user_roles(user_id text, email text, role text);
CREATE TABLE public.ma_source_email_send_reservations(opportunity_id uuid PRIMARY KEY REFERENCES public.opportunities(id), expires_at timestamptz);
CREATE TABLE public.ma_interactions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),client_operation_key uuid,
  opportunity_id uuid,template_key text,recipient_email_snapshot text,title text,body_markdown text,
  channel text,direction text,delivery_status text,provider_message_id text);
CREATE TABLE public.ma_interaction_delivery_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),interaction_id uuid REFERENCES public.ma_interactions(id),event_kind text);
CREATE TABLE public.opportunity_pursuit_handoff_deliveries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),upstream_evidence_id uuid,
  match_id uuid,handoff_type text,delivery_status text,provider_message_id text,attempt_count integer DEFAULT 1,last_attempt_at timestamptz);
CREATE TABLE public.opportunity_freshness_deliveries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),review_id uuid,
  delivery_status text,provider_message_id text,attempted_at timestamptz);
INSERT INTO public.opportunities VALUES
  ('22300000-0000-4000-8000-000000000001',false),('22300000-0000-4000-8000-000000000002',false),
  ('22300000-0000-4000-8000-000000000031',false),('22300000-0000-4000-8000-000000000032',false),
  ('22300000-0000-4000-8000-000000000033',false),('22300000-0000-4000-8000-000000000034',false);
INSERT INTO public.repreneurs VALUES ('22300000-0000-4000-8000-000000000003','Alex','Example',NULL);
INSERT INTO public.opportunity_matches VALUES
  ('22300000-0000-4000-8000-000000000004','22300000-0000-4000-8000-000000000001','22300000-0000-4000-8000-000000000003');
INSERT INTO public.opportunity_pursuit_evidence VALUES
  ('22300000-0000-4000-8000-000000000005','22300000-0000-4000-8000-000000000004');
INSERT INTO public.ma_firms VALUES ('22300000-0000-4000-8000-000000000006','Fictional firm');
INSERT INTO public.ma_offices VALUES ('22300000-0000-4000-8000-000000000007','22300000-0000-4000-8000-000000000006','Fictional office');
INSERT INTO public.ma_contacts VALUES ('22300000-0000-4000-8000-000000000008','Fictional contact');
INSERT INTO public.ma_contact_office_affiliations VALUES
  ('22300000-0000-4000-8000-000000000009','22300000-0000-4000-8000-000000000008','22300000-0000-4000-8000-000000000007');
INSERT INTO public.opportunity_ma_contacts VALUES
  ('22300000-0000-4000-8000-000000000010','22300000-0000-4000-8000-000000000009');
INSERT INTO public."user" VALUES ('staff-one','one@example.test'),('rep-one','rep@example.test');
INSERT INTO public.app_user_roles VALUES ('staff-one','one@example.test','staff'),('rep-one','rep@example.test','repreneur');
SQL

"${psql[@]}" -f "$repo_root/scripts/121_staff_email_review_queue.sql" >/dev/null
"${psql[@]}" >/dev/null <<'SQL'
ALTER TABLE public.staff_email_reviews DROP CONSTRAINT staff_email_reviews_source_kind_check;
ALTER TABLE public.staff_email_reviews ADD CONSTRAINT staff_email_reviews_source_kind_check
  CHECK (source_kind IN ('ma','e4','e6','e7','freshness'));
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
ALTER TABLE public.opportunity_freshness_deliveries ADD CONSTRAINT archive_fixture_freshness_review_fk
  FOREIGN KEY(review_id) REFERENCES public.staff_email_reviews(id) ON DELETE RESTRICT;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO service_role;
SQL
"${psql[@]}" -f "$repo_root/scripts/130_staff_email_review_queue_projection.sql" >/dev/null
"${psql[@]}" -f "$repo_root/supabase/migrations/20260929230707_reversible_staff_email_archive.sql" >/dev/null

"${psql[@]}" >/dev/null <<'SQL'
DO $$ DECLARE v uuid; BEGIN
  v:=public.staff_email_review_prepare('ma','22300000-0000-4000-8000-000000000011',
    '22300000-0000-4000-8000-000000000001',NULL,NULL,'22300000-0000-4000-8000-000000000010',
    'recipient@example.test','REAL','ma_process_follow_up','copy-v1','Fictional subject','Fictional body','[]'::jsonb,'staff-one');
  IF v IS NULL THEN RAISE EXCEPTION 'archive_fixture_prepare_failed'; END IF;
END $$;
DO $$ DECLARE v uuid; BEGIN
  v:=public.staff_email_review_prepare('e6','22300000-0000-4000-8000-000000000005',
    '22300000-0000-4000-8000-000000000001','22300000-0000-4000-8000-000000000004',
    '22300000-0000-4000-8000-000000000005',NULL,
    'rep@example.test','REAL','code:e6_nda_ready','copy-v1','Fictional E6','Fictional body','[]'::jsonb,'staff-one');
  IF v IS NULL THEN RAISE EXCEPTION 'archive_fixture_e6_prepare_failed'; END IF;
END $$;
SQL

"${psql[@]}" >/dev/null <<'SQL'
CREATE FUNCTION public.assert_archive_rejected(p_sql text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql; EXCEPTION WHEN OTHERS THEN RETURN; END;
  RAISE EXCEPTION 'expected_archive_rejection: %',p_sql;
END $$;
DO $$ DECLARE v uuid; v_version integer; v_original text; BEGIN
  SELECT id,subject INTO v,v_original FROM public.staff_email_reviews WHERE source_kind='ma';
  IF (SELECT count(*) FROM public.staff_email_review_queue WHERE archived_at IS NULL)<>2
    OR (SELECT count(*) FROM public.staff_email_review_queue WHERE archive_eligible)<>2
  THEN RAISE EXCEPTION 'default_active_or_eligibility_wrong'; END IF;
  IF has_function_privilege('anon','public.staff_email_review_archive(uuid,integer,text)','EXECUTE')
    OR has_function_privilege('authenticated','public.staff_email_review_restore(uuid,integer,text)','EXECUTE')
    OR has_table_privilege('authenticated','public.staff_email_review_queue','SELECT')
  THEN RAISE EXCEPTION 'public_archive_permission'; END IF;
  IF NOT has_function_privilege('service_role','public.staff_email_review_archive(uuid,integer,text)','EXECUTE')
    OR NOT has_table_privilege('service_role','public.staff_email_review_queue','SELECT')
  THEN RAISE EXCEPTION 'service_archive_permission_missing'; END IF;
  PERFORM public.assert_archive_rejected(format('SELECT public.staff_email_review_archive(%L,1,%L)',v,'rep-one'));
  v_version:=public.staff_email_review_archive(v,1,'staff-one');
  IF v_version<>2 OR (SELECT archived_by FROM public.staff_email_reviews WHERE id=v)<>'staff-one'
    OR (SELECT count(*) FROM public.staff_email_review_events WHERE review_id=v AND event_kind='archived')<>1
    OR (SELECT subject FROM public.staff_email_reviews WHERE id=v)<>v_original
  THEN RAISE EXCEPTION 'archive_metadata_or_history_wrong'; END IF;
  PERFORM public.assert_archive_rejected(format('SELECT public.staff_email_review_archive(%L,1,%L)',v,'staff-one'));
  PERFORM public.assert_archive_rejected(format('SELECT public.staff_email_review_reserve(%L,2,%L::jsonb,%L)',v,'{}','staff-one'));
  PERFORM public.assert_archive_rejected(format('SELECT public.staff_email_review_cancel(%L,2,%L,%L)',v,'reason','staff-one'));
  PERFORM public.assert_archive_rejected(format('UPDATE public.staff_email_reviews SET subject=%L WHERE id=%L','changed',v));
  PERFORM public.assert_archive_rejected(format('INSERT INTO public.ma_interactions(id,client_operation_key,opportunity_id,template_key,recipient_email_snapshot,title,body_markdown,channel,direction,delivery_status) VALUES(gen_random_uuid(),%L,%L,%L,%L,%L,%L,%L,%L,%L)',
    '22300000-0000-4000-8000-000000000011','22300000-0000-4000-8000-000000000001','ma_process_follow_up','recipient@example.test','Fictional subject','Fictional body','email','outbound','pending'));
  v_version:=public.staff_email_review_restore(v,2,'staff-one');
  IF v_version<>3 OR (SELECT archived_at FROM public.staff_email_reviews WHERE id=v) IS NOT NULL
    OR (SELECT restored_by FROM public.staff_email_reviews WHERE id=v)<>'staff-one'
    OR (SELECT count(*) FROM public.staff_email_review_events WHERE review_id=v AND event_kind='restored')<>1
    OR (SELECT subject FROM public.staff_email_reviews WHERE id=v)<>v_original
  THEN RAISE EXCEPTION 'restore_identity_or_history_wrong'; END IF;
  PERFORM public.assert_archive_rejected(format('SELECT public.staff_email_review_restore(%L,2,%L)',v,'staff-one'));
END $$;

-- Every legacy provider-entry record is denied for an archived exact source.
DO $$ DECLARE v uuid; v_kind text; v_op uuid; v_source uuid; BEGIN
  SELECT id INTO v FROM public.staff_email_reviews WHERE source_kind='e6';
  PERFORM public.staff_email_review_archive(v,1,'staff-one');
  PERFORM public.assert_archive_rejected(format('INSERT INTO public.opportunity_pursuit_handoff_deliveries(upstream_evidence_id,match_id,handoff_type,delivery_status) VALUES(%L,%L,%L,%L)',
    '22300000-0000-4000-8000-000000000005','22300000-0000-4000-8000-000000000004','e6','sending'));
  FOREACH v_kind IN ARRAY ARRAY['e4','e7'] LOOP
    v_source:=gen_random_uuid();
    INSERT INTO public.opportunity_pursuit_evidence VALUES(v_source,'22300000-0000-4000-8000-000000000004');
    INSERT INTO public.staff_email_reviews(source_kind,source_operation_id,opportunity_id,match_id,
      upstream_evidence_id,contact_link_id,recipient_email,namespace,template_key,template_version,subject,body_text,created_by)
    VALUES(v_kind,v_source,'22300000-0000-4000-8000-000000000001',
      '22300000-0000-4000-8000-000000000004',v_source,'22300000-0000-4000-8000-000000000010',
      'fictional@example.test','REAL','code:fictional','v1','Fictional','Body','staff-one') RETURNING id INTO v;
    PERFORM public.staff_email_review_archive(v,1,'staff-one');
    PERFORM public.assert_archive_rejected(format('INSERT INTO public.opportunity_pursuit_handoff_deliveries(upstream_evidence_id,match_id,handoff_type,delivery_status) VALUES(%L,%L,%L,%L)',
      v_source,'22300000-0000-4000-8000-000000000004',v_kind,'sending'));
  END LOOP;
  INSERT INTO public.staff_email_reviews(source_kind,source_operation_id,opportunity_id,contact_link_id,
    recipient_email,namespace,template_key,template_version,subject,body_text,created_by)
  VALUES('freshness',gen_random_uuid(),'22300000-0000-4000-8000-000000000001',
    '22300000-0000-4000-8000-000000000010','fictional@example.test','REAL','source_freshness','v1','Fictional','Body','staff-one') RETURNING id INTO v;
  INSERT INTO public.opportunity_freshness_members VALUES(v,'22300000-0000-4000-8000-000000000001','initial');
  PERFORM public.staff_email_review_archive(v,1,'staff-one');
  PERFORM public.assert_archive_rejected(format('INSERT INTO public.opportunity_freshness_deliveries(review_id,delivery_status) VALUES(%L,%L)',v,'pending'));
  IF (SELECT count(*) FROM public.opportunity_freshness_members WHERE review_id=v)<>1
  THEN RAISE EXCEPTION 'freshness_members_changed'; END IF;
END $$;

-- A conclusive failure can be shelved, while sending, unknown, sent and
-- cancelled states cannot. Replay of a failed MA source is still fenced.
DO $$ DECLARE v uuid; v_op uuid:=gen_random_uuid(); v_interaction uuid; v_state text; v_target uuid; v_index integer:=0; BEGIN
  INSERT INTO public.staff_email_reviews(source_kind,source_operation_id,opportunity_id,contact_link_id,
    recipient_email,namespace,template_key,template_version,subject,body_text,created_by,state)
  VALUES('ma',v_op,'22300000-0000-4000-8000-000000000001',
    '22300000-0000-4000-8000-000000000010','failed@example.test','REAL',
    'ma_process_follow_up','v1','Fictional failure','Body','staff-one','failed') RETURNING id INTO v;
  INSERT INTO public.ma_interactions(client_operation_key,opportunity_id,template_key,recipient_email_snapshot,
    title,body_markdown,channel,direction,delivery_status)
  VALUES(v_op,'22300000-0000-4000-8000-000000000001','ma_process_follow_up',
    'failed@example.test','Fictional failure','Body','email','outbound','failed') RETURNING id INTO v_interaction;
  PERFORM public.staff_email_review_archive(v,1,'staff-one');
  PERFORM public.assert_archive_rejected(format('INSERT INTO public.ma_interaction_delivery_events(interaction_id,event_kind) VALUES(%L,%L)',v_interaction,'pending'));
  PERFORM public.assert_archive_rejected(format('UPDATE public.ma_interactions SET delivery_status=%L WHERE id=%L','pending',v_interaction));
  FOREACH v_state IN ARRAY ARRAY['sending','uncertain','sent','cancelled'] LOOP
    v_op:=gen_random_uuid();
    v_index:=v_index+1;
    v_target:=('22300000-0000-4000-8000-00000000003'||v_index)::uuid;
    INSERT INTO public.staff_email_reviews(source_kind,source_operation_id,opportunity_id,contact_link_id,
      recipient_email,namespace,template_key,template_version,subject,body_text,created_by,state)
    VALUES('ma',v_op,v_target,
      '22300000-0000-4000-8000-000000000010','case@example.test','REAL',
      'ma_process_follow_up','v1','Fictional case','Body','staff-one',
      v_state) RETURNING id INTO v;
    PERFORM public.assert_archive_rejected(format('SELECT public.staff_email_review_archive(%L,1,%L)',v,'staff-one'));
  END LOOP;
  v_op:=gen_random_uuid();
  INSERT INTO public.staff_email_reviews(source_kind,source_operation_id,opportunity_id,contact_link_id,
    recipient_email,namespace,template_key,template_version,subject,body_text,created_by,state)
  VALUES('ma',v_op,'22300000-0000-4000-8000-000000000001',
    '22300000-0000-4000-8000-000000000010','unknown@example.test','REAL',
    'ma_process_follow_up','v1','Fictional prior unknown','Body','staff-one','failed') RETURNING id INTO v;
  INSERT INTO public.staff_email_review_events(review_id,event_kind,actor,version)
  VALUES(v,'uncertain','staff-one',1);
  PERFORM public.assert_archive_rejected(format('SELECT public.staff_email_review_archive(%L,1,%L)',v,'staff-one'));
END $$;
SQL

# Use two connections in each direction; the source guard and shelf RPC must
# serialize on the exact review, even when one side is an older dispatch path.
"${psql[@]}" -c "BEGIN; SELECT public.staff_email_review_archive(id,version,'staff-one') FROM public.staff_email_reviews WHERE source_kind='ma' AND source_operation_id='22300000-0000-4000-8000-000000000011'; SELECT pg_sleep(1.5); COMMIT;" >/dev/null 2>"$cluster_dir/archive-first.log" &
archive_pid=$!
sleep 0.2
if "${psql[@]}" -c "INSERT INTO public.ma_interactions(client_operation_key,opportunity_id,template_key,recipient_email_snapshot,title,body_markdown,channel,direction,delivery_status) VALUES('22300000-0000-4000-8000-000000000011','22300000-0000-4000-8000-000000000001','ma_process_follow_up','recipient@example.test','Fictional subject','Fictional body','email','outbound','pending')" >/dev/null 2>"$cluster_dir/archive-first-rejected.log"; then
  echo "archive-first allowed legacy source begin" >&2; exit 1
fi
wait "$archive_pid"

"${psql[@]}" >/dev/null <<'SQL'
INSERT INTO public.staff_email_reviews(source_kind,source_operation_id,opportunity_id,contact_link_id,
  recipient_email,namespace,template_key,template_version,subject,body_text,created_by)
VALUES('ma','22300000-0000-4000-8000-000000000041','22300000-0000-4000-8000-000000000002',
  '22300000-0000-4000-8000-000000000010','other@example.test','REAL',
  'ma_process_follow_up','v1','Fictional race','Body','staff-one');
SQL
"${psql[@]}" -c "BEGIN; INSERT INTO public.ma_interactions(client_operation_key,opportunity_id,template_key,recipient_email_snapshot,title,body_markdown,channel,direction,delivery_status) VALUES('22300000-0000-4000-8000-000000000041','22300000-0000-4000-8000-000000000002','ma_process_follow_up','other@example.test','Fictional race','Body','email','outbound','pending'); SELECT pg_sleep(1.5); COMMIT;" >/dev/null 2>"$cluster_dir/reserve-first.log" &
reserve_pid=$!
sleep 0.2
if "${psql[@]}" -c "SELECT public.staff_email_review_archive(id,version,'staff-one') FROM public.staff_email_reviews WHERE source_kind='ma' AND source_operation_id='22300000-0000-4000-8000-000000000041'" >/dev/null 2>"$cluster_dir/reserve-first-rejected.log"; then
  echo "source-begin-first allowed archive" >&2; exit 1
fi
wait "$reserve_pid"

# MA's older parent reservation is separate from its source interaction.
# Even an uncommitted reservation has to win before an archive can commit.
"${psql[@]}" >/dev/null <<'SQL'
INSERT INTO public.opportunities VALUES('22300000-0000-4000-8000-000000000043',false);
INSERT INTO public.staff_email_reviews(source_kind,source_operation_id,opportunity_id,contact_link_id,
  recipient_email,namespace,template_key,template_version,subject,body_text,created_by)
VALUES('ma','22300000-0000-4000-8000-000000000044','22300000-0000-4000-8000-000000000043',
  '22300000-0000-4000-8000-000000000010','reservation@example.test','REAL',
  'ma_process_follow_up','v1','Fictional reservation','Body','staff-one');
SQL
"${psql[@]}" -c "BEGIN; INSERT INTO public.ma_source_email_send_reservations(opportunity_id,expires_at) VALUES('22300000-0000-4000-8000-000000000043',now()+interval '2 minutes'); SELECT pg_sleep(1.5); COMMIT;" >/dev/null 2>"$cluster_dir/parent-reservation.log" &
reservation_pid=$!
sleep 0.2
if "${psql[@]}" -c "SELECT public.staff_email_review_archive(id,version,'staff-one') FROM public.staff_email_reviews WHERE source_kind='ma' AND source_operation_id='22300000-0000-4000-8000-000000000044'" >/dev/null 2>"$cluster_dir/parent-reservation-rejected.log"; then
  echo "active parent reservation allowed archive" >&2; exit 1
fi
wait "$reservation_pid"

# The existing staff reservation also wins before archive. Conversely, a
# restore merely unblocks the original versioned staff reservation; no source
# operation or provider event is created by restore itself.
"${psql[@]}" >/dev/null <<'SQL'
INSERT INTO public.opportunities VALUES('22300000-0000-4000-8000-000000000045',false);
INSERT INTO public.staff_email_reviews(source_kind,source_operation_id,opportunity_id,contact_link_id,
  recipient_email,namespace,template_key,template_version,subject,body_text,created_by)
VALUES('ma','22300000-0000-4000-8000-000000000046','22300000-0000-4000-8000-000000000045',
  '22300000-0000-4000-8000-000000000010','staff-reserve@example.test','REAL',
  'ma_process_follow_up','v1','Fictional staff reserve','Body','staff-one');
SQL
"${psql[@]}" -c "BEGIN; SELECT public.staff_email_review_reserve(id,version,'{}'::jsonb,'staff-one') FROM public.staff_email_reviews WHERE source_operation_id='22300000-0000-4000-8000-000000000046'; SELECT pg_sleep(1.5); COMMIT;" >/dev/null 2>"$cluster_dir/staff-reserve-first.log" &
staff_reserve_pid=$!
sleep 0.2
if "${psql[@]}" -c "SELECT public.staff_email_review_archive(id,version,'staff-one') FROM public.staff_email_reviews WHERE source_operation_id='22300000-0000-4000-8000-000000000046'" >/dev/null 2>"$cluster_dir/staff-reserve-rejected.log"; then
  echo "staff-review-reserve-first allowed archive" >&2; exit 1
fi
wait "$staff_reserve_pid"

"${psql[@]}" -c "BEGIN; SELECT public.staff_email_review_restore(id,version,'staff-one') FROM public.staff_email_reviews WHERE source_kind='e6'; SELECT pg_sleep(1.5); COMMIT;" >/dev/null 2>"$cluster_dir/restore-first.log" &
restore_pid=$!
sleep 0.2
"${psql[@]}" -c "SELECT public.staff_email_review_reserve(id,3,'{}'::jsonb,'staff-one') FROM public.staff_email_reviews WHERE source_kind='e6'" >/dev/null 2>"$cluster_dir/restore-then-staff-reserve.log"
wait "$restore_pid"
"${psql[@]}" >/dev/null <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.staff_email_reviews WHERE source_kind='e6'
      AND archived_at IS NULL AND restored_by='staff-one' AND state='sending' AND version=4)
    OR (SELECT count(*) FROM public.staff_email_review_events event JOIN public.staff_email_reviews review
        ON review.id=event.review_id WHERE review.source_kind='e6' AND event.event_kind='restored')<>1
    OR EXISTS (SELECT 1 FROM public.opportunity_pursuit_handoff_deliveries WHERE handoff_type='e6')
  THEN RAISE EXCEPTION 'restore_vs_send_did_not_serialize_or_minted_source'; END IF;
END $$;
SQL

"${psql[@]}" >/dev/null <<'SQL'
DO $$ DECLARE v uuid; BEGIN
  INSERT INTO public.opportunities VALUES('22300000-0000-4000-8000-000000000040',false);
  INSERT INTO public.staff_email_reviews(source_kind,source_operation_id,opportunity_id,contact_link_id,
    recipient_email,namespace,template_key,template_version,subject,body_text,created_by)
  VALUES('ma','22300000-0000-4000-8000-000000000042','22300000-0000-4000-8000-000000000040',
    '22300000-0000-4000-8000-000000000010','parent@example.test','REAL',
    'ma_process_follow_up','v1','Fictional parent','Body','staff-one') RETURNING id INTO v;
  PERFORM public.staff_email_review_archive(v,1,'staff-one');
  DELETE FROM public.opportunities WHERE id='22300000-0000-4000-8000-000000000040';
  IF EXISTS (SELECT 1 FROM public.staff_email_reviews WHERE id=v)
    OR EXISTS (SELECT 1 FROM public.staff_email_review_events WHERE review_id=v)
  THEN RAISE EXCEPTION 'parent_retention_rule_changed'; END IF;
END $$;
SQL

echo "#221/#223 disposable archive ACL, five sources, both race orders, parent retention passed"
