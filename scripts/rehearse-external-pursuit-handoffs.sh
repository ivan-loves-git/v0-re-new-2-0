#!/usr/bin/env bash
set -euo pipefail

# Synthetic PG17 only. No project env, Supabase endpoint, or provider is read.
repo_root="${RENEW_EXTERNAL_HANDOFF_REPO_ROOT:-}"
if [[ -z "$repo_root" ]]; then
  repo_root="$(git -C "$PWD" rev-parse --show-toplevel 2>/dev/null || true)"
fi
if [[ -z "$repo_root" || ! -d "$repo_root/supabase/schema" ]]; then
  echo "Set RENEW_EXTERNAL_HANDOFF_REPO_ROOT to the platform repository." >&2
  exit 1
fi
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
port="${RENEW_EXTERNAL_HANDOFF_REHEARSAL_PORT:-$((57000 + RANDOM % 5000))}"
database_name="renew_external_handoff"
database_superuser="renew_external_handoff_admin"
temp_base="${TMPDIR:-/tmp}"
if [[ "$temp_base" != /* || ! -d "$temp_base" ]]; then
  echo "TMPDIR must be an existing absolute directory." >&2
  exit 1
fi
cluster_dir="$(mktemp -d "$temp_base/renew-external-handoff.XXXXXX")"

cleanup() {
  if [[ ! -d "$cluster_dir" || "$cluster_dir" != "$temp_base"/renew-external-handoff.* ]]; then
    echo "Refusing cleanup outside generated TMPDIR cluster: $cluster_dir" >&2
    return
  fi
  if [[ -f "$cluster_dir/postmaster.pid" ]]; then
    "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true
  fi
  if [[ "${RENEW_EXTERNAL_HANDOFF_RETAIN_CLUSTER:-0}" == "1" ]]; then
    echo "Retained stopped local cluster: $cluster_dir" >&2
  else
    rm -rf -- "$cluster_dir"
  fi
}
trap cleanup EXIT

for binary in initdb pg_ctl createdb psql; do
  [[ -x "$pg_bin/$binary" ]] || { echo "Missing PostgreSQL 17 binary: $pg_bin/$binary" >&2; exit 1; }
done

"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 \
  --auth-local=trust --auth-host=trust --username="$database_superuser" >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -l "$cluster_dir/postgres.log" \
  -o "-p $port -c listen_addresses='' -k $cluster_dir" -w start >/dev/null
"$pg_bin/createdb" -h "$cluster_dir" -p "$port" -U "$database_superuser" "$database_name"
psql=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h "$cluster_dir" -p "$port" -U "$database_superuser" -d "$database_name")

"${psql[@]}" -c "
  CREATE ROLE postgres NOLOGIN;
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN BYPASSRLS;
  CREATE SCHEMA extensions;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id UUID PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS 'SELECT NULL::UUID';
" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/schema/771_extensions.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/schema/771_public_schema.sql" >/dev/null
"${psql[@]}" -c "
  ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE public.repreneurs ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
  CREATE SCHEMA storage;
  CREATE TABLE storage.buckets (
    id text PRIMARY KEY, name text, public boolean NOT NULL DEFAULT false,
    file_size_limit bigint, allowed_mime_types text[]
  );
  INSERT INTO storage.buckets(id) VALUES
    ('opportunity-documents'), ('cvs'), ('external-pursuit-attachments');
" >/dev/null

predecessors=(
  20260827103000_w164_lifecycle_namespace_visibility.sql
  20260827113000_w165_private_direct_uploads.sql
  20260829123000_w170_unused_retained_document_correction.sql
  20260829130000_w161_repreneur_target_ebitda_range.sql
  20260829180000_w169_lifecycle_outcome_separation.sql
  20260829203000_w169_pause_guard_scope.sql
  20260905095834_pursuit_delivery_evidence_types.sql
  20260905095841_pursuit_delivery_handoffs.sql
  20260911133000_w172_recommendation_response_window.sql
  20260911150000_w173_booking_request_reminders.sql
  20260911160000_w174_colin_email_default_copy.sql
  20260911180000_w175_recommendation_assignment_notification.sql
)
"${psql[@]}" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role" >/dev/null
for migration in "${predecessors[@]}"; do
  "${psql[@]}" --file "$repo_root/supabase/migrations/$migration" >/dev/null
done
for external_migration in 093 094 095 096 097 098 099; do
  external_script=("$repo_root"/scripts/"${external_migration}"_external_pursuit_*.sql)
  "${psql[@]}" --file "${external_script[0]}" >/dev/null
done
"${psql[@]}" --file "$repo_root/scripts/rehearsals/w173-interest-decisions-before.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/migrations/20260922111134_w173_interest_decisions_notifications.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/migrations/20260923173503_w196_attributed_staff_assistance.sql" >/dev/null
"${psql[@]}" --file "$repo_root/scripts/116_historical_pursuit_ledger.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/migrations/20260914230430_pursuit_workbook_v4.sql" >/dev/null
"${psql[@]}" --file "$repo_root/scripts/121_staff_email_review_queue.sql" >/dev/null
"${psql[@]}" --file "$repo_root/scripts/122_staff_email_ma_source_actor_alignment.sql" >/dev/null
"${psql[@]}" --file "$repo_root/scripts/123_staff_email_handoff_source_actor_alignment.sql" >/dev/null
"${psql[@]}" --file "$repo_root/scripts/124_recipient_information_memos.sql" >/dev/null
# The current freshness projection uses Colin's actual predicate/column.
"${psql[@]}" -c "ALTER TABLE public.opportunities ADD COLUMN source_identity_to_verify BOOLEAN NOT NULL DEFAULT FALSE" >/dev/null
sed -n '/^CREATE OR REPLACE FUNCTION public.ma_opportunity_source_review_required(/,/^\$\$;/p' "$repo_root/supabase/migrations/20260902202154_colin_data_security_corrections.sql" | "${psql[@]}" >/dev/null
"${psql[@]}" --file "$repo_root/scripts/129_opportunity_freshness_reviews.sql" >/dev/null
"${psql[@]}" --file "$repo_root/scripts/130_staff_email_review_queue_projection.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/migrations/20260929230707_reversible_staff_email_archive.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/migrations/20260929235619_bounded_staff_email_bulk_send.sql" >/dev/null
# Seed valid synthetic relationships before #252 initializes its current clock.
"${psql[@]}" --file "$repo_root/scripts/rehearsals/external-pursuit-handoffs-before.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/migrations/20261007100000_reasoned_staff_lifecycle.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/migrations/20261007123000_email_operations_policy.sql" >/dev/null
if [[ "${RENEW_EXTERNAL_HANDOFF_RED:-0}" != "1" ]]; then
  "${psql[@]}" --file "$repo_root/supabase/migrations/20261007150000_external_pursuit_handoffs.sql" >/dev/null
fi
"${psql[@]}" --file "$repo_root/scripts/rehearsals/external-pursuit-handoffs.sql"
echo "External handoff protected-service behavior passed."
if [[ "${RENEW_MEMO_NOTICE_REHEARSAL:-0}" == "1" ]]; then
  # The legacy public RPC's actual released body/shape is used during rollout.
  sed -n '/^CREATE OR REPLACE FUNCTION public.claim_opportunity_memo_notification(/,/^END \$\$;/p' "$repo_root/supabase/migrations/20260826170000_w160_demo_repreneur_reporting.sql" | "${psql[@]}" >/dev/null
  "${psql[@]}" --file "$repo_root/scripts/rehearsals/external-memo-notice-before.sql"
  # A second database in the same disposable cluster keeps an actual old claim
  # committed across schema application, independent of the normal first claim.
  "$pg_bin/createdb" -h "$cluster_dir" -p "$port" -U "$database_superuser" -T "$database_name" renew_memo_legacy_rollout
  rollout_psql=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h "$cluster_dir" -p "$port" -U "$database_superuser" -d renew_memo_legacy_rollout)
  "${rollout_psql[@]}" -q -c "SELECT public.journey_grant_confidential_access('76000000-0000-4000-8000-000000000011','25500000-0000-4000-8000-000000000001','w173-staff','255-old-inflight',now()+interval '30 days'); CREATE TABLE public.synthetic_255_inflight_claim AS SELECT * FROM public.claim_opportunity_memo_notification('76000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000011',now());" >/dev/null
  "${rollout_psql[@]}" --file "$repo_root/supabase/migrations/20261007170000_grant_specific_external_memo_notice.sql" >/dev/null
  "${rollout_psql[@]}" --file "$repo_root/scripts/rehearsals/external-memo-legacy-rollout.sql"
  "${psql[@]}" --file "$repo_root/supabase/migrations/20261007170000_grant_specific_external_memo_notice.sql" >/dev/null
  "${psql[@]}" --file "$repo_root/scripts/rehearsals/external-memo-notice.sql"
  memo_record="SELECT public.synthetic_255_record('25500000-0000-4000-8000-000000000010','12:34');"
  # External completion wins; a separately committed ordinary claimant sees no C.
  "${psql[@]}" -q -c "BEGIN; $memo_record SELECT pg_sleep(1); COMMIT;" > "$cluster_dir/memo-external-first.log" 2>&1 &
  memo_pid=$!
  sleep 0.2
  if "${psql[@]}" -q -c "BEGIN; SET LOCAL lock_timeout='100ms'; SELECT public.pause_opportunity_with_reason('76000000-0000-4000-8000-000000000003','seller_paused_sale','w173-staff',NULL); COMMIT;" > "$cluster_dir/memo-pause-second.log" 2>&1; then echo "Pause crossed the external memo transaction" >&2; exit 1; fi
  grep 'lock timeout' "$cluster_dir/memo-pause-second.log" >/dev/null
  "${psql[@]}" -q -c "DO \$\$ BEGIN IF EXISTS(SELECT 1 FROM public.claim_opportunity_memo_grant_notice('76000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000011',NULL,now())) THEN RAISE EXCEPTION 'external_winner_claimed'; END IF; END \$\$;" >/dev/null
  wait "$memo_pid"
  # Normal processing wins on a later grant; external completion must keep its
  # Sending uncertainty unchanged and cannot replace that provider attempt.
  "${psql[@]}" -q -c "SELECT public.journey_revoke_confidential_access('76000000-0000-4000-8000-000000000011','w173-staff','race D','255-C-revoke'); UPDATE public.synthetic_255_context SET context=public.journey_external_memo_context('76000000-0000-4000-8000-000000000011','25500000-0000-4000-8000-000000000001',now()+interval '45 days'); SELECT public.journey_grant_confidential_access_v2('76000000-0000-4000-8000-000000000011','25500000-0000-4000-8000-000000000001','w173-staff','255-race-D',(SELECT (context->>'nda_expires_at')::timestamptz FROM public.synthetic_255_context));" >/dev/null
  "${psql[@]}" -q -c "BEGIN; SELECT * FROM public.claim_opportunity_memo_grant_notice('76000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000011',NULL,now()); SELECT pg_sleep(1); COMMIT;" > "$cluster_dir/memo-claim-first.log" 2>&1 &
  memo_pid=$!
  sleep 0.2
  if "${psql[@]}" -q -c "SELECT public.synthetic_255_record('25500000-0000-4000-8000-000000000011');" > "$cluster_dir/memo-external-second.log" 2>&1; then echo "External notice overwrote an in-flight claimant" >&2; exit 1; fi
  grep 'external_memo_already_completed_or_uncertain' "$cluster_dir/memo-external-second.log" >/dev/null
  wait "$memo_pid"
  "${psql[@]}" -q -c "BEGIN; SELECT public.pause_opportunity_with_reason('76000000-0000-4000-8000-000000000003','seller_paused_sale','w173-staff',NULL); SELECT pg_sleep(1); COMMIT;" > "$cluster_dir/memo-pause-first.log" 2>&1 &
  memo_pid=$!
  sleep 0.2
  if "${psql[@]}" -q -c "SELECT public.synthetic_255_record('25500000-0000-4000-8000-000000000012');" > "$cluster_dir/memo-record-after-pause.log" 2>&1; then echo "External memo committed after Pause" >&2; exit 1; fi
  wait "$memo_pid"
  "${psql[@]}" -q -c "DO \$\$ BEGIN IF public.journey_repreneur_can_access_confidential('76000000-0000-4000-8000-000000000011','76000000-0000-4000-8000-000000000004','25500000-0000-4000-8000-000000000001') OR (SELECT count(*) FROM public.opportunity_memo_external_notices)<>2 THEN RAISE EXCEPTION 'memo_pause_race_history_failed'; END IF; END \$\$;" >/dev/null
  echo "Independent-session external-first / claimant-first / Pause exact grant fences passed."
  echo "Exact-grant external memo notice rollout, atomicity and stale delivery proof passed."
  exit 0
fi
if [[ "${RENEW_PAUSED_HISTORY_REHEARSAL:-0}" == "1" ]]; then
  # Reuse this disposable schema and actual E4/E6/E7 prerequisites. The #256
  # lane tests the existing private opening store and released lifecycle guards;
  # it does not introduce a migration or a substitute authorization predicate.
  "${psql[@]}" --file "$repo_root/supabase/migrations/20260914223836_single_public_opportunity_description.sql" >/dev/null
  "${psql[@]}" --file "$repo_root/supabase/migrations/20260920140000_repreneur_opportunity_review_state.sql" >/dev/null
  "${psql[@]}" --file "$repo_root/scripts/rehearsals/paused-opportunity-history.sql"
  echo "Paused history real persistence, authorization and unchanged-state proof passed."
  "${psql[@]}" -q -c "BEGIN; SELECT * FROM public.record_repreneur_opportunity_review('76000000-0000-4000-8000-000000000004','25600000-0000-4000-8000-000000000015'); SELECT pg_sleep(1); COMMIT;" > "$cluster_dir/open-first.log" 2>&1 &
  open_pid=$!
  sleep 0.2
  if "${psql[@]}" -q -c "BEGIN; SET LOCAL lock_timeout='100ms'; SELECT public.pause_opportunity_with_reason('25600000-0000-4000-8000-000000000015','seller_paused_sale','w173-staff',NULL); COMMIT;" > "$cluster_dir/pause-second.log" 2>&1; then echo "Pause crossed an active opening lock" >&2; exit 1; fi
  grep 'lock timeout' "$cluster_dir/pause-second.log" >/dev/null
  wait "$open_pid"
  "${psql[@]}" -q -c "SELECT public.pause_opportunity_with_reason('25600000-0000-4000-8000-000000000015','seller_paused_sale','w173-staff',NULL);" >/dev/null
  "${psql[@]}" -q -c "BEGIN; SELECT public.pause_opportunity_with_reason('25600000-0000-4000-8000-000000000016','seller_paused_sale','w173-staff',NULL); SELECT pg_sleep(1); COMMIT;" > "$cluster_dir/pause-first.log" 2>&1 &
  pause_pid=$!
  sleep 0.2
  if "${psql[@]}" -q -c "SELECT * FROM public.record_repreneur_opportunity_review('76000000-0000-4000-8000-000000000004','25600000-0000-4000-8000-000000000016');" > "$cluster_dir/open-second.log" 2>&1; then echo "Opening wrote after canonical Pause" >&2; exit 1; fi
  grep 'review_not_available' "$cluster_dir/open-second.log" >/dev/null
  wait "$pause_pid"
  "${psql[@]}" -q -c "DO \$\$ BEGIN IF (SELECT count(*) FROM public.repreneur_opportunity_review_state WHERE opportunity_id='25600000-0000-4000-8000-000000000015')<>1 OR EXISTS(SELECT 1 FROM public.repreneur_opportunity_review_state WHERE opportunity_id='25600000-0000-4000-8000-000000000016') THEN RAISE EXCEPTION 'opening_pause_race_provenance_failed'; END IF; END \$\$;" >/dev/null
  echo "Independent-session opening/Pause provenance fences passed; no backfill after Pause."
  exit 0
fi
# Independent sessions exercise the actual write's transaction locks. Current
# E6 retry context is frozen in the fixture; it must never survive a stale gate.
record_retry="SELECT public.journey_record_external_handoff('76000000-0000-4000-8000-000000000011',(SELECT context FROM public.synthetic_254_context),'25400000-0000-4000-8000-000000000002',current_date-1,NULL,'email','Synthetic external NDA notice','w173-staff','w173-staff@example.test');"
# External write wins: Pause cannot cross its transaction-held opportunity lock.
"${psql[@]}" -q -c "BEGIN; $record_retry SELECT pg_sleep(1); COMMIT;" > "$cluster_dir/record-first.log" 2>&1 &
record_pid=$!
sleep 0.2
if "${psql[@]}" -q -c "BEGIN; SET LOCAL lock_timeout='100ms'; UPDATE public.opportunities SET status='paused' WHERE id='76000000-0000-4000-8000-000000000003'; ROLLBACK;" > "$cluster_dir/pause-second.log" 2>&1; then
  echo "Pause crossed the external recording lock" >&2; exit 1
fi
grep 'lock timeout' "$cluster_dir/pause-second.log" >/dev/null
wait "$record_pid"
# Queue/source order inversion is nonblocking: its existing opportunity-first
# lock makes external NOWAIT fail, rather than deadlock on its held match row.
"${psql[@]}" -q -c "BEGIN; SELECT 1 FROM public.opportunities WHERE id='76000000-0000-4000-8000-000000000003' FOR UPDATE; SELECT pg_sleep(1); COMMIT;" > "$cluster_dir/queue-first.log" 2>&1 &
queue_pid=$!
sleep 0.2
if "${psql[@]}" -q -c "$record_retry" > "$cluster_dir/inversion.log" 2>&1; then echo "Inversion unexpectedly passed" >&2; exit 1; fi
grep 'could not obtain lock' "$cluster_dir/inversion.log" >/dev/null
wait "$queue_pid"
# Drop wins its match lock, commits canonical reason/event and denies old retry.
"${psql[@]}" -q -c "BEGIN; SELECT public.journey_transition_terminal('76000000-0000-4000-8000-000000000011','drop','w173-staff@example.test','254-concurrent-drop','buyer_search_paused'); SELECT pg_sleep(1); COMMIT;" > "$cluster_dir/drop-first.log" 2>&1 &
drop_pid=$!
sleep 0.2
if "${psql[@]}" -q -c "$record_retry" > "$cluster_dir/drop-retry.log" 2>&1; then echo "Dropped retry passed" >&2; exit 1; fi
grep 'external_handoff_pursuit_stale' "$cluster_dir/drop-retry.log" >/dev/null
wait "$drop_pid"
# Restore only the synthetic fixture status, not a product resume operation.
"${psql[@]}" -q -c "SET session_replication_role=replica; UPDATE public.opportunity_matches SET status='active_pursuit' WHERE id='76000000-0000-4000-8000-000000000011'; RESET session_replication_role;" >/dev/null
# Replacement blank template uses the real canonical registration service.
"${psql[@]}" -q -c "BEGIN; SELECT * FROM public.register_opportunity_nda_artifact('76000000-0000-4000-8000-000000000003',NULL,'blank_template','Synthetic replacement NDA','76000000-0000-4000-8000-000000000003/nda-artifacts/blank_template/254-replacement.pdf','replacement.pdf',101,repeat('e',64),'w173-staff@example.test'); SELECT pg_sleep(1); COMMIT;" > "$cluster_dir/document-first.log" 2>&1 &
document_pid=$!
sleep 0.2
if "${psql[@]}" -q -c "$record_retry" > "$cluster_dir/document-retry.log" 2>&1; then echo "Document replacement retry passed" >&2; exit 1; fi
grep 'could not obtain lock' "$cluster_dir/document-retry.log" >/dev/null
wait "$document_pid"
if "${psql[@]}" -q -c "$record_retry" > "$cluster_dir/document-stale.log" 2>&1; then echo "Stale template retry passed" >&2; exit 1; fi
grep 'external_handoff_approval_not_ready' "$cluster_dir/document-stale.log" >/dev/null
"${psql[@]}" -q -c "DO \$\$ BEGIN IF (SELECT count(*) FROM public.opportunity_pursuit_external_handoffs)<>3 OR (SELECT count(*) FROM public.opportunity_pursuit_external_handoffs WHERE handoff_type='e6')<>1 THEN RAISE EXCEPTION 'concurrency_created_stale_completion'; END IF; END \$\$;" >/dev/null
echo "Independent-session recording/Pause, queue inversion, Drop and document replacement fences passed."
# The real individual reservation wins a new cycle's match/opportunity fence.
# A simultaneous external record observes that committed sending review and
# refuses, preserving uncertainty rather than creating competing completion.
"${psql[@]}" -q <<'SQL'
BEGIN;
SELECT public.journey_transition_terminal('76000000-0000-4000-8000-000000000011','drop','w173-staff@example.test','254-race-drop','buyer_search_paused');
SELECT public.journey_transition_terminal('76000000-0000-4000-8000-000000000011','reopen','w173-staff@example.test','254-race-reopen');
SELECT public.journey_start_pursuit('76000000-0000-4000-8000-000000000011','w173-staff@example.test','254-race-validation');
CREATE TABLE public.synthetic_254_future_context AS
SELECT public.journey_external_handoff_context('76000000-0000-4000-8000-000000000011','e4') AS context,NULL::uuid AS review_id;
UPDATE public.synthetic_254_future_context SET review_id=public.staff_email_review_prepare('e4',(context->>'upstream_id')::uuid,
  '76000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000011',(context->>'upstream_id')::uuid,
  '25400000-0000-4000-8000-000000000093','source@example.invalid','REAL','ma_nda_info_memo_request','synthetic-copy',
  'Synthetic concurrent request','Synthetic body','[]','w173-staff');
COMMIT;
SQL
"${psql[@]}" -q -c "BEGIN; SELECT public.staff_email_review_reserve((SELECT review_id FROM public.synthetic_254_future_context),1,'{\"subject\":\"Synthetic concurrent request\"}','w173-staff'); SELECT pg_sleep(1); COMMIT;" > "$cluster_dir/individual-first.log" 2>&1 &
individual_pid=$!
sleep 0.2
if "${psql[@]}" -q -c "SELECT public.journey_record_external_handoff('76000000-0000-4000-8000-000000000011',(SELECT context FROM public.synthetic_254_future_context),'25400000-0000-4000-8000-000000000094',current_date-1,NULL,'phone','Synthetic simultaneous completion','w173-staff','w173-staff@example.test');" > "$cluster_dir/external-second.log" 2>&1; then
  echo "External completion crossed an individual sending reservation" >&2; exit 1
fi
grep 'external_handoff_provider_reconciliation_required' "$cluster_dir/external-second.log" >/dev/null
wait "$individual_pid"
"${psql[@]}" -q -c "DO \$\$ BEGIN IF (SELECT count(*) FROM public.opportunity_pursuit_external_handoffs)<>3 OR NOT EXISTS(SELECT 1 FROM public.staff_email_reviews WHERE id=(SELECT review_id FROM public.synthetic_254_future_context) AND state='sending' AND version=2 AND provider_message_id IS NULL) OR EXISTS(SELECT 1 FROM public.ma_interactions) OR EXISTS(SELECT 1 FROM public.ma_contact_email_policy_events) THEN RAISE EXCEPTION 'individual_reservation_truth_changed'; END IF; END \$\$;" >/dev/null
echo "Independent-session individual reservation/external recording fence passed."
