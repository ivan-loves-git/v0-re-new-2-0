#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
cluster_dir="$(mktemp -d "${TMPDIR:-/tmp}/renew-freshness-187.XXXXXX")"
port="${FRESHNESS_REHEARSAL_PORT:-55487}"
cleanup() {
  if [ -f "$cluster_dir/postmaster.pid" ]; then "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true; fi
  case "$cluster_dir" in */renew-freshness-187.*) rm -rf "$cluster_dir" ;; esac
}
trap cleanup EXIT
"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 --auth-local=trust --auth-host=trust --username=renew_freshness_admin >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -l "$cluster_dir/postgres.log" -o "-p $port -h 127.0.0.1 -k $cluster_dir" -w start >/dev/null
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" -U renew_freshness_admin renew_freshness_rehearsal
psql=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -U renew_freshness_admin -d renew_freshness_rehearsal)
"${psql[@]}" -f "$repo_root/scripts/rehearsals/opportunity-freshness-fixture.sql" >/dev/null
"${psql[@]}" -f "$repo_root/scripts/121_staff_email_review_queue.sql" >/dev/null
"${psql[@]}" -f "$repo_root/scripts/129_opportunity_freshness_reviews.sql" >/dev/null
"${psql[@]}" <<'SQL'
DO $$ BEGIN
  IF (SELECT count(*) FROM public.opportunity_freshness_candidates(NULL,now(),true,NULL))<>3
    OR (SELECT count(*) FROM public.opportunity_freshness_candidates('18700000-0000-4000-8000-000000000003',now(),true,NULL))<>2
    OR (SELECT count(*) FROM public.opportunity_freshness_due_contacts(30))<>2 THEN
    RAISE EXCEPTION 'freshness_44_45_legacy_or_identity_grouping_failed';
  END IF;
  IF EXISTS(SELECT 1 FROM public.opportunity_freshness_candidates(NULL,now(),true,NULL) candidate
    WHERE candidate->>'opportunity_id'='18700000-0000-4000-8000-000000000008'
      AND candidate->>'basis'<>'older_inventory_no_confirmation') THEN
    RAISE EXCEPTION 'legacy_basis_was_mislabelled'; END IF;
  IF has_table_privilege('anon','public.opportunity_freshness_members','SELECT')
    OR has_table_privilege('authenticated','public.opportunity_freshness_replies','SELECT')
    OR has_function_privilege('anon','public.opportunity_freshness_prepare(uuid,jsonb,text,text,text)','EXECUTE')
    OR has_function_privilege('authenticated','public.opportunity_freshness_latest_confirmations(uuid[])','EXECUTE')
    OR has_table_privilege('service_role','public.opportunity_freshness_members','UPDATE') THEN
    RAISE EXCEPTION 'freshness_acl_failed'; END IF;
END $$;
BEGIN;
UPDATE public.opportunities SET status='paused' WHERE id='18700000-0000-4000-8000-000000000007';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM public.opportunity_freshness_candidates(NULL,now(),true,NULL) candidate
  WHERE candidate->>'opportunity_id'='18700000-0000-4000-8000-000000000007') THEN RAISE EXCEPTION 'paused_opportunity_eligible'; END IF; END $$;
ROLLBACK;
BEGIN;
UPDATE public.opportunities SET is_demo=true WHERE id='18700000-0000-4000-8000-000000000007';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM public.opportunity_freshness_candidates(NULL,now(),true,NULL) candidate
  WHERE candidate->>'opportunity_id'='18700000-0000-4000-8000-000000000007') THEN RAISE EXCEPTION 'demo_opportunity_eligible'; END IF; END $$;
ROLLBACK;
BEGIN;
UPDATE public.opportunities SET source_identity_to_verify=true WHERE id='18700000-0000-4000-8000-000000000007';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM public.opportunity_freshness_candidates(NULL,now(),true,NULL) candidate
  WHERE candidate->>'opportunity_id'='18700000-0000-4000-8000-000000000007') THEN RAISE EXCEPTION 'unverified_source_eligible'; END IF; END $$;
ROLLBACK;
BEGIN;
INSERT INTO public.ma_interactions(id,opportunity_id,channel,direction,delivery_status,occurred_at)
VALUES(gen_random_uuid(),'18700000-0000-4000-8000-000000000007','email','outbound','pending',now()-interval '90 days');
DO $$ BEGIN IF EXISTS (SELECT 1 FROM public.opportunity_freshness_candidates(NULL,now(),true,NULL) candidate
  WHERE candidate->>'opportunity_id'='18700000-0000-4000-8000-000000000007') THEN RAISE EXCEPTION 'old_unresolved_outbound_eligible'; END IF; END $$;
ROLLBACK;
BEGIN;
UPDATE public.ma_contacts SET campaign_email_suppressed=true WHERE id='18700000-0000-4000-8000-000000000004';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM public.opportunity_freshness_candidates(NULL,now(),true,NULL))
  THEN RAISE EXCEPTION 'shared_address_suppression_not_respected'; END IF; END $$;
ROLLBACK;
BEGIN;
INSERT INTO public.opportunity_matches VALUES
  ('18700000-0000-4000-8000-0000000000f2','18700000-0000-4000-8000-000000000007','18700000-0000-4000-8000-0000000000f1','active_pursuit');
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM public.opportunity_freshness_candidates(NULL,now(),true,NULL) candidate
  WHERE candidate->>'opportunity_id'='18700000-0000-4000-8000-000000000007') THEN RAISE EXCEPTION 'demo_pursuit_excluded_real_opportunity'; END IF; END $$;
INSERT INTO public.opportunity_matches VALUES
  ('18700000-0000-4000-8000-0000000000f3','18700000-0000-4000-8000-000000000007','18700000-0000-4000-8000-0000000000f0','active_pursuit');
DO $$ BEGIN IF EXISTS (SELECT 1 FROM public.opportunity_freshness_candidates(NULL,now(),true,NULL) candidate
  WHERE candidate->>'opportunity_id'='18700000-0000-4000-8000-000000000007') THEN RAISE EXCEPTION 'real_active_pursuit_eligible'; END IF; END $$;
ROLLBACK;
SQL
"${psql[@]}" -Atc "INSERT INTO public.ma_interactions(id,opportunity_id,channel,direction,delivery_status,occurred_at) VALUES('18700000-0000-4000-8000-0000000000f4','18700000-0000-4000-8000-000000000007','email','outbound','failed',now()-interval '90 days')" >/dev/null
review_id="$("${psql[@]}" -Atc "SELECT public.opportunity_freshness_prepare('18700000-0000-4000-8000-000000000003',(SELECT jsonb_agg(candidate ORDER BY candidate->>'opportunity_id') FROM public.opportunity_freshness_candidates('18700000-0000-4000-8000-000000000003',now(),true,NULL) candidate),'Subject','Body','copy-v1')")"
"${psql[@]}" -Atc "SELECT public.opportunity_freshness_reserve('$review_id',1,'{\"to\":[\"source@example.test\"]}'::jsonb,repeat('a',64),'staff-1'); SELECT pg_sleep(1)" >"$cluster_dir/first.out" 2>&1 &
first_pid=$!
sleep 0.2
if "${psql[@]}" -Atc "UPDATE public.ma_contacts SET email='changed@example.test' WHERE id='18700000-0000-4000-8000-000000000003'" >"$cluster_dir/contact.out" 2>&1; then
  echo "Contact changed across grouped send lease" >&2; exit 1
fi
if "${psql[@]}" -Atc "SELECT public.opportunity_freshness_edit('$review_id',1,'Racing subject','Racing body','staff-1')" >/dev/null 2>&1; then
  echo "Edit crossed an independent grouped send reservation" >&2; exit 1
fi
if "${psql[@]}" -Atc "INSERT INTO public.opportunity_matches VALUES(gen_random_uuid(),'18700000-0000-4000-8000-000000000008','18700000-0000-4000-8000-000000000003','active_pursuit')" >"$cluster_dir/pursuit.out" 2>&1; then
  echo "Pursuit activated across grouped send lease" >&2; exit 1
fi
if "${psql[@]}" -Atc "UPDATE public.opportunities SET source_identity_to_verify=true WHERE id='18700000-0000-4000-8000-000000000008'" >/dev/null 2>&1; then
  echo "Source verification changed across grouped send lease" >&2; exit 1
fi
if "${psql[@]}" -Atc "UPDATE public.ma_contacts SET campaign_email_suppressed=true WHERE id='18700000-0000-4000-8000-000000000004'" >/dev/null 2>&1; then
  echo "Shared-address suppression changed across grouped send lease" >&2; exit 1
fi
if "${psql[@]}" -Atc "UPDATE public.email_templates SET is_active=false WHERE template_key='ma_opportunity_validity_check'" >/dev/null 2>&1; then
  echo "Template changed across grouped send lease" >&2; exit 1
fi
if "${psql[@]}" -Atc "UPDATE public.ma_interactions SET delivery_status='pending' WHERE id='18700000-0000-4000-8000-0000000000f4'" >/dev/null 2>&1; then
  echo "Existing outbound status changed across grouped send lease" >&2; exit 1
fi
wait "$first_pid"
first_token="$(sed -n '1p' "$cluster_dir/first.out")"
"${psql[@]}" <<SQL
DO \$\$ BEGIN
 IF (SELECT count(*) FROM public.opportunity_freshness_members WHERE review_id='$review_id')<>2
    OR (SELECT created_by FROM public.staff_email_reviews WHERE id='$review_id')<>'system:opportunity-freshness'
 THEN RAISE EXCEPTION 'frozen_group_or_system_origin_missing'; END IF;
 IF (SELECT count(*) FROM public.opportunity_freshness_candidates('18700000-0000-4000-8000-000000000003',now(),true,NULL))<>0
 THEN RAISE EXCEPTION 'episode_dedupe_failed'; END IF;
END \$\$;
SQL
"${psql[@]}" -Atc "SELECT public.opportunity_freshness_finish('$review_id','$first_token','sent','provider-accepted-1',NULL,'staff-1')" >/dev/null
"${psql[@]}" -Atc "SELECT public.opportunity_freshness_record_reply('$review_id','18700000-0000-4000-8000-000000000007','confirmed_open',now(),'Source email confirms still open','staff-1')" >/dev/null
"${psql[@]}" <<'SQL'
DO $$ BEGIN
 IF (SELECT count(*) FROM public.opportunity_freshness_deliveries WHERE delivery_status='sent')<>1
   OR (SELECT count(*) FROM public.opportunity_freshness_members member
       JOIN public.opportunity_freshness_deliveries delivery ON delivery.review_id=member.review_id
       WHERE delivery.delivery_status='sent')<>2
 THEN RAISE EXCEPTION 'single_receipt_exact_group_coverage_failed'; END IF;
 IF (SELECT count(*) FROM public.opportunity_freshness_latest_confirmations(
      ARRAY['18700000-0000-4000-8000-000000000007','18700000-0000-4000-8000-000000000008']::uuid[]))<>1
 THEN RAISE EXCEPTION 'exact_latest_confirmation_projection_failed'; END IF;
 IF (SELECT count(*) FROM public.opportunity_freshness_candidates('18700000-0000-4000-8000-000000000003',now()+interval '46 days',true,NULL) candidate
      WHERE candidate->>'opportunity_id'='18700000-0000-4000-8000-000000000007'
        AND candidate->>'basis'='confirmed_open')<>1
    OR EXISTS (SELECT 1 FROM public.opportunity_freshness_candidates('18700000-0000-4000-8000-000000000003',now()+interval '46 days',true,NULL) candidate
      WHERE candidate->>'opportunity_id'='18700000-0000-4000-8000-000000000008')
 THEN RAISE EXCEPTION 'exact_member_positive_reply_clock_failed'; END IF;
END $$;
SQL

# Two independent generators race the same different-contact episode. Only
# one review can be created; the losing call cannot overwrite the winner.
"${psql[@]}" -Atc "SELECT public.opportunity_freshness_prepare('18700000-0000-4000-8000-000000000004',(SELECT jsonb_agg(candidate ORDER BY candidate->>'opportunity_id') FROM public.opportunity_freshness_candidates('18700000-0000-4000-8000-000000000004',now(),true,NULL) candidate),'Subject','Body','copy-v1'); SELECT pg_sleep(1)" >"$cluster_dir/generator-first.out" 2>&1 &
generator_pid=$!
sleep 0.2
if "${psql[@]}" -Atc "SELECT public.opportunity_freshness_prepare('18700000-0000-4000-8000-000000000004',(SELECT jsonb_agg(candidate ORDER BY candidate->>'opportunity_id') FROM public.opportunity_freshness_candidates('18700000-0000-4000-8000-000000000004',now(),true,NULL) candidate),'Subject','Body','copy-v1')" >"$cluster_dir/generator-second.out" 2>&1; then
  echo "Concurrent generator duplicated an episode" >&2; exit 1
fi
wait "$generator_pid"
second_review="$(sed -n '1p' "$cluster_dir/generator-first.out")"
"${psql[@]}" -Atc "BEGIN; UPDATE public.ma_contacts SET email='held@example.test' WHERE id='18700000-0000-4000-8000-000000000004'; SELECT pg_sleep(1); COMMIT" >"$cluster_dir/source-first.out" 2>&1 &
source_first_pid=$!
sleep 0.2
if "${psql[@]}" -Atc "SELECT public.opportunity_freshness_reserve('$second_review',1,'{\"to\":[\"source@example.test\"]}'::jsonb,repeat('b',64),'staff-1')" >/dev/null 2>&1; then
  echo "Source-first independent edit did not veto grouped send" >&2; exit 1
fi
wait "$source_first_pid"
"${psql[@]}" -Atc "UPDATE public.ma_contacts SET email='source@example.test' WHERE id='18700000-0000-4000-8000-000000000004'" >/dev/null
"${psql[@]}" -Atc "UPDATE public.email_templates SET is_active=false WHERE template_key='ma_opportunity_validity_check'" >/dev/null
if "${psql[@]}" -Atc "SELECT public.opportunity_freshness_reserve('$second_review',1,'{\"to\":[\"source@example.test\"]}'::jsonb,repeat('b',64),'staff-1')" >/dev/null 2>&1; then
  echo "Disabled template unexpectedly sent" >&2; exit 1
fi
"${psql[@]}" -Atc "UPDATE public.email_templates SET is_active=true WHERE template_key='ma_opportunity_validity_check'" >/dev/null
second_token="$("${psql[@]}" -Atc "SELECT public.opportunity_freshness_reserve('$second_review',1,'{\"to\":[\"source@example.test\"]}'::jsonb,repeat('b',64),'staff-1')")"
"${psql[@]}" -Atc "SELECT public.opportunity_freshness_finish('$second_review','$second_token','uncertain',NULL,'Provider timeout','staff-1')" >/dev/null
if "${psql[@]}" -Atc "SELECT public.opportunity_freshness_reserve('$second_review',3,'{\"to\":[\"source@example.test\"]}'::jsonb,repeat('b',64),'staff-1')" >/dev/null 2>&1; then
  echo "Uncertain review ignored two-minute lease" >&2; exit 1
fi
"${psql[@]}" -Atc "UPDATE public.staff_email_reviews SET attempted_at=now()-interval '3 minutes' WHERE id='$second_review'" >/dev/null
"${psql[@]}" -Atc "UPDATE public.opportunity_freshness_deliveries SET attempted_at=now()-interval '3 minutes' WHERE review_id='$second_review'" >/dev/null
retry_token="$("${psql[@]}" -Atc "SELECT public.opportunity_freshness_reserve('$second_review',3,'{\"to\":[\"source@example.test\"]}'::jsonb,repeat('b',64),'staff-1')")"
if "${psql[@]}" -Atc "UPDATE public.ma_contacts SET email='retry-drift@example.test' WHERE id='18700000-0000-4000-8000-000000000004'" >/dev/null 2>&1; then
  echo "Latest retry lease did not fence member mutation" >&2; exit 1
fi
if "${psql[@]}" -Atc "UPDATE public.email_templates SET is_active=false WHERE template_key='ma_opportunity_validity_check'" >/dev/null 2>&1; then
  echo "Latest retry lease did not fence template mutation" >&2; exit 1
fi
if "${psql[@]}" -Atc "SELECT public.opportunity_freshness_finish('$second_review','$retry_token','failed',NULL,'Rejection after prior timeout','staff-1')" >/dev/null 2>&1; then
  echo "Prior provider uncertainty was erased by a later failure" >&2; exit 1
fi
"${psql[@]}" -Atc "SELECT public.opportunity_freshness_finish('$second_review','$retry_token','sent','provider-accepted-2',NULL,'staff-1')" >/dev/null
"${psql[@]}" <<SQL
DO \$\$ BEGIN
 IF (SELECT count(*) FROM public.opportunity_freshness_deliveries WHERE review_id='$second_review')<>1
   OR (SELECT provider_idempotency_key FROM public.opportunity_freshness_deliveries WHERE review_id='$second_review')<>'$second_review'
 THEN RAISE EXCEPTION 'uncertain_retry_minted_new_provider_key'; END IF;
END \$\$;
SQL

# Stale review text and exact-recipient drift cannot silently cross into send.
"${psql[@]}" -Atc "UPDATE public.opportunities SET date_added=current_date-45 WHERE id='18700000-0000-4000-8000-00000000000a'" >/dev/null
third_review="$("${psql[@]}" -Atc "SELECT public.opportunity_freshness_prepare('18700000-0000-4000-8000-000000000003',(SELECT jsonb_agg(candidate ORDER BY candidate->>'opportunity_id') FROM public.opportunity_freshness_candidates('18700000-0000-4000-8000-000000000003',now(),true,NULL) candidate),'Subject','Body','copy-v1')")"
"${psql[@]}" -Atc "BEGIN; SELECT public.opportunity_freshness_edit('$third_review',1,'Edited subject','Edited body','staff-1'); SELECT pg_sleep(1); COMMIT" >"$cluster_dir/edit-first.out" 2>&1 &
edit_first_pid=$!
sleep 0.2
if "${psql[@]}" -Atc "SELECT public.opportunity_freshness_reserve('$third_review',1,'{\"to\":[\"source@example.test\"]}'::jsonb,repeat('c',64),'staff-1')" >/dev/null 2>&1; then
  echo "Edit-first independent review race accepted a stale send" >&2; exit 1
fi
wait "$edit_first_pid"
"${psql[@]}" -Atc "UPDATE public.ma_contacts SET email='updated@example.test' WHERE id='18700000-0000-4000-8000-000000000003'" >/dev/null
if "${psql[@]}" -Atc "SELECT public.opportunity_freshness_reserve('$third_review',2,'{\"to\":[\"source@example.test\"]}'::jsonb,repeat('c',64),'staff-1')" >/dev/null 2>&1; then
  echo "Recipient drift crossed into grouped send" >&2; exit 1
fi
"${psql[@]}" -Atc "SELECT public.opportunity_freshness_refresh('$third_review',2,'copy-v1','staff-1')" >/dev/null
"${psql[@]}" <<SQL
DO \$\$ BEGIN
 IF (SELECT body_text FROM public.staff_email_reviews WHERE id='$third_review')<>'Edited body'
   OR (SELECT recipient_email FROM public.staff_email_reviews WHERE id='$third_review')<>'updated@example.test'
 THEN RAISE EXCEPTION 'explicit_refresh_overwrote_copy_or_kept_stale_recipient'; END IF;
END \$\$;
SQL
"${psql[@]}" -Atc "SELECT public.staff_email_review_cancel('$third_review',3,'Staff discarded this episode','staff-1')" >/dev/null
"${psql[@]}" <<'SQL'
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.opportunity_freshness_candidates('18700000-0000-4000-8000-000000000003',now(),true,NULL) candidate
   WHERE candidate->>'opportunity_id'='18700000-0000-4000-8000-00000000000a')
 THEN RAISE EXCEPTION 'discarded_episode_resurrected'; END IF;
END $$;
SQL
echo "#187 disposable SQL: 44/45/legacy, identity, ACL, grouped receipt, exact reply, independent generation/source/pursuit races, version/recipient drift, discard, template switch and uncertain retry passed"
