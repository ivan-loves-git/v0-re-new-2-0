#!/usr/bin/env bash
set -euo pipefail

# Synthetic PG17 only. No project env, Supabase endpoint, or provider is read.
repo_root="${RENEW_W173_REPO_ROOT:-}"
if [[ -z "$repo_root" ]]; then
  repo_root="$(git -C "$PWD" rev-parse --show-toplevel 2>/dev/null || true)"
fi
if [[ -z "$repo_root" || ! -d "$repo_root/supabase/schema" ]]; then
  echo "Set RENEW_W173_REPO_ROOT to the platform repository." >&2
  exit 1
fi
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
port="${RENEW_W173_REHEARSAL_PORT:-55498}"
database_name="renew_w173_rehearsal"
database_superuser="renew_w173_rehearsal_admin"
temp_base="${TMPDIR:-/tmp}"
if [[ "$temp_base" != /* || ! -d "$temp_base" ]]; then
  echo "TMPDIR must be an existing absolute directory." >&2
  exit 1
fi
cluster_dir="$(mktemp -d "$temp_base/renew-w173-rehearsal.XXXXXX")"

cleanup() {
  if [[ ! -d "$cluster_dir" || "$cluster_dir" != "$temp_base"/renew-w173-rehearsal.* ]]; then
    echo "Refusing cleanup outside generated TMPDIR cluster: $cluster_dir" >&2
    return
  fi
  if [[ -f "$cluster_dir/postmaster.pid" ]]; then
    "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true
  fi
  if [[ "${RENEW_W173_RETAIN_CLUSTER:-0}" == "1" ]]; then
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
  -o "-p $port -h 127.0.0.1 -k $cluster_dir" -w start >/dev/null
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" -U "$database_superuser" "$database_name"
psql=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -U "$database_superuser" -d "$database_name")

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
"${psql[@]}" --file "$repo_root/scripts/rehearsals/w173-interest-decisions-after.sql"
"${psql[@]}" --file "$repo_root/supabase/migrations/20260922142227_w175_recommendation_cycle_notifications.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/migrations/20260923173503_w196_attributed_staff_assistance.sql" >/dev/null
"${psql[@]}" -c "INSERT INTO public.staff_portal_workspaces(id,staff_user_id,staff_email,selected_repreneur_id,generation) VALUES ('76000000-0000-4000-8000-000000000090','w173-staff','w173-staff@example.test','76000000-0000-4000-8000-000000000004','76000000-0000-4000-8000-000000000089')" >/dev/null
"${psql[@]}" -c "INSERT INTO public.staff_portal_workspaces(id,staff_user_id,staff_email,selected_repreneur_id,generation) VALUES ('76000000-0000-4000-8000-000000000088','w173-staff','w173-staff@example.test','76000000-0000-4000-8000-000000000007','76000000-0000-4000-8000-000000000087')" >/dev/null
"${psql[@]}" --file "$repo_root/scripts/rehearsals/w196-staff-responses.sql"
"${psql[@]}" --file "$repo_root/scripts/rehearsals/w196-staff-thesis.sql"
"${psql[@]}" --file "$repo_root/scripts/rehearsals/w196-staff-selection-cleanup.sql"

# Two actual sessions: an owner response commits while a staff form still
# carries the old exact-match timestamp. The staff call must wait, then reject.
race_ids='76000000-0000-4000-8000-000000000011'
IFS='|' read -r race_owner race_opp race_opp_updated race_match_updated <<< "$(${psql[@]} -AtF '|' -c "
  SELECT m.repreneur_id,m.opportunity_id,o.updated_at,m.updated_at
  FROM public.opportunity_matches m JOIN public.opportunities o ON o.id=m.opportunity_id
  WHERE m.id='$race_ids'")"
"${psql[@]}" -q -c "BEGIN;
  SELECT public.update_repreneur_opportunity_response('$race_ids','$race_owner','interested');
  SELECT pg_sleep(1);
  COMMIT;" >/dev/null &
owner_race_pid=$!
sleep 0.2
set +e
race_result="$("${psql[@]}" -At -c "SELECT public.w196_record_staff_opportunity_response(
  '$race_owner','$race_opp','$race_ids',
  '$race_opp_updated','$race_match_updated',NULL,
  'declined',ARRAY['sector'],'Synthetic concurrent decline',
  'w173-staff','w173-staff@example.test','76000000-0000-4000-8000-000000000098',
  '76000000-0000-4000-8000-000000000090','76000000-0000-4000-8000-000000000089');" 2>&1)"
race_status=$?
set -e
wait "$owner_race_pid"
if [[ "$race_status" -eq 0 || "$race_result" != *staff_assistance_stale_response* ]]; then
  echo "W196 concurrent owner/staff stale-form guard failed: $race_result" >&2
  exit 1
fi
# A write holds a SHARE lock on this one browser workspace until commit. A
# concurrent selector cannot rotate A to B midway through its transaction.
"${psql[@]}" -q -c "BEGIN;
  SELECT public.w196_assert_staff_portal_workspace(
    '76000000-0000-4000-8000-000000000090','76000000-0000-4000-8000-000000000089',
    '76000000-0000-4000-8000-000000000004','w173-staff','w173-staff@example.test');
  SELECT pg_sleep(1);
  COMMIT;" >/dev/null &
selection_guard_pid=$!
sleep 0.2
set +e
switch_race_result="$("${psql[@]}" -At -c "BEGIN; SET LOCAL lock_timeout='100ms';
  SELECT public.w196_select_staff_portal_workspace(
    '76000000-0000-4000-8000-000000000090',
    '76000000-0000-4000-8000-000000000007','w173-staff','w173-staff@example.test');
  ROLLBACK;" 2>&1)"
switch_race_status=$?
set -e
wait "$selection_guard_pid"
if [[ "$switch_race_status" -eq 0 || "$switch_race_result" != *lock\ timeout* ]]; then
  echo "W196 in-flight workspace switch was not serialized: $switch_race_result" >&2
  exit 1
fi
"${psql[@]}" --file "$repo_root/scripts/rehearsals/w196-staff-received-nda.sql"
"${psql[@]}" -q -c "BEGIN;
  SELECT id FROM public.opportunities WHERE id='76000000-0000-4000-8000-000000000003' FOR UPDATE;
  SELECT pg_sleep(1);
  SET session_replication_role=replica;
  SELECT public.pause_opportunity_with_reason('76000000-0000-4000-8000-000000000003','paused_cabinet','w173-staff');
  RESET session_replication_role;
  COMMIT;" >/dev/null &
pause_race_pid=$!
sleep 0.2
set +e
nda_race_result="$("${psql[@]}" -At -c "SELECT public.w196_finalize_staff_portal_upload(
  '76000000-0000-4000-8000-000000000079','staff:w173-staff:',repeat('b',64),repeat('d',64));" 2>&1)"
nda_race_status=$?
set -e
wait "$pause_race_pid"
if [[ "$nda_race_status" -eq 0 || "$nda_race_result" != *w196_staff_nda_pursuit_stale* ]]; then
  echo "W196 concurrent Pause/received-NDA guard failed: $nda_race_result" >&2
  exit 1
fi
nda_race_state="$("${psql[@]}" -At -c "SELECT CASE WHEN
  (SELECT status FROM public.private_upload_intents WHERE id='76000000-0000-4000-8000-000000000079')='pending'
  AND NOT EXISTS (SELECT 1 FROM public.staff_received_nda_receipts
    WHERE intent_id='76000000-0000-4000-8000-000000000079')
  THEN 'safe' ELSE 'unsafe' END")"
if [[ "$nda_race_state" != "safe" ]]; then
  echo "W196 concurrent Pause left a committed received NDA: $nda_race_state" >&2
  exit 1
fi
"${psql[@]}" --file "$repo_root/supabase/migrations/20260926120000_w192_withdrawn_status.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/migrations/20260926120100_w192_exact_interest_withdrawal.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/migrations/20260920140000_repreneur_opportunity_review_state.sql" >/dev/null
"${psql[@]}" --file "$repo_root/scripts/rehearsals/w192-interest-withdrawal.sql"
IFS='|' read -r withdraw_token withdraw_version <<< "$(${psql[@]} -AtF '|' -c "
  SELECT interest_expressed_at,updated_at FROM public.opportunity_matches
  WHERE id='97000000-0000-4000-8000-000000000084'")"
"${psql[@]}" -q -c "BEGIN;
  SELECT public.w192_withdraw_exact_interest(
    '97000000-0000-4000-8000-000000000084','97000000-0000-4000-8000-000000000074',
    '76000000-0000-4000-8000-000000000004','w173-repreneur-interest','interested@example.test',
    '$withdraw_token','$withdraw_version','Race withdrawn first');
  SELECT pg_sleep(1); COMMIT;" >/dev/null &
withdraw_winner_pid=$!
sleep 0.2
set +e
validation_loser="$(${psql[@]} -At -c "SELECT public.w173_validate_exact_interest(
  '97000000-0000-4000-8000-000000000084','97000000-0000-4000-8000-000000000074',
  'w173-staff','$withdraw_token','$withdraw_version','w192-race-withdraw-first');" 2>&1)"
validation_loser_status=$?
set -e
wait "$withdraw_winner_pid"
if [[ "$validation_loser_status" -eq 0 || "$validation_loser" != *validation_interest_stale* ]]; then
  echo "W192 withdrawal-first race did not reject validation: $validation_loser" >&2
  exit 1
fi
withdraw_race_state="$(${psql[@]} -At -c "SELECT status FROM public.opportunity_matches
  WHERE id='97000000-0000-4000-8000-000000000084'")"
if [[ "$withdraw_race_state" != "withdrawn" ]]; then
  echo "W192 withdrawal-first race left $withdraw_race_state" >&2
  exit 1
fi

IFS='|' read -r validation_token validation_version <<< "$(${psql[@]} -AtF '|' -c "
  SELECT interest_expressed_at,updated_at FROM public.opportunity_matches
  WHERE id='97000000-0000-4000-8000-000000000085'")"
"${psql[@]}" -q -c "BEGIN;
  SELECT public.w173_validate_exact_interest(
    '97000000-0000-4000-8000-000000000085','97000000-0000-4000-8000-000000000075',
    'w173-staff','$validation_token','$validation_version','w192-race-validation-first');
  SELECT pg_sleep(1); COMMIT;" >/dev/null &
validation_winner_pid=$!
sleep 0.2
set +e
withdraw_loser="$(${psql[@]} -At -c "SELECT public.w192_withdraw_exact_interest(
  '97000000-0000-4000-8000-000000000085','97000000-0000-4000-8000-000000000075',
  '76000000-0000-4000-8000-000000000004','w173-repreneur-interest','interested@example.test',
  '$validation_token','$validation_version','Race validation first');" 2>&1)"
withdraw_loser_status=$?
set -e
wait "$validation_winner_pid"
if [[ "$withdraw_loser_status" -eq 0 || "$withdraw_loser" != *withdrawal_requires_staff_drop* ]]; then
  echo "W192 validation-first race did not direct to staff Drop: $withdraw_loser" >&2
  exit 1
fi
validation_race_state="$(${psql[@]} -At -c "SELECT status FROM public.opportunity_matches
  WHERE id='97000000-0000-4000-8000-000000000085'")"
if [[ "$validation_race_state" != "active_pursuit" ]]; then
  echo "W192 validation-first race left $validation_race_state" >&2
  exit 1
fi
echo "W173/W196/W192 exact-interest and attributed assistance rehearsal passed"
