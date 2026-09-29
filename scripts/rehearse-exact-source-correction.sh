#!/usr/bin/env bash
set -euo pipefail

# Isolated, synthetic PostgreSQL proof for #191. No project URL, credentials,
# customer row, provider or Storage account enters this process.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
cluster_dir="$(mktemp -d "${TMPDIR:-/tmp}/renew-exact-source.XXXXXX")"
port="${EXACT_SOURCE_REHEARSAL_PORT:-55491}"
cleanup() {
  if [ -f "$cluster_dir/postmaster.pid" ]; then "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true; fi
  case "$cluster_dir" in */renew-exact-source.*) rm -rf "$cluster_dir" ;; esac
}
trap cleanup EXIT
for binary in initdb pg_ctl createdb psql; do
  [ -x "$pg_bin/$binary" ] || { echo "Missing PostgreSQL binary: $pg_bin/$binary" >&2; exit 1; }
done
"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 --auth-local=trust --auth-host=trust --username=renew_rehearsal_admin >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -l "$cluster_dir/postgres.log" -o "-p $port -h 127.0.0.1 -k $cluster_dir" -w start >/dev/null
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" -U renew_rehearsal_admin renew_exact_source_rehearsal
psql=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -U renew_rehearsal_admin -d renew_exact_source_rehearsal)

"${psql[@]}" --file "$repo_root/scripts/rehearsals/exact-source-correction-fixture.sql" >/dev/null

# Execute the released table definitions and actual 076/080 guard functions,
# then migration 089's SECURITY DEFINER hardening, not a mock of the guard.
sed -n '13,123p' "$repo_root/scripts/080_ma_interaction_persistence.sql" | "${psql[@]}" >/dev/null
function_from() {
  local name="$1" source="$2"
  awk -v name="$name" '
    $0 ~ "^CREATE OR REPLACE FUNCTION public\\." name "\\(" { on=1 }
    on { print }
    on && /^\$\$;$/ { exit }
  ' "$source" | "${psql[@]}" >/dev/null
}
function_from capture_opportunity_ma_contact_snapshot "$repo_root/scripts/076_ma_office_identity_and_activation_foundation.sql"
function_from assert_opportunity_office_context "$repo_root/scripts/076_ma_office_identity_and_activation_foundation.sql"
function_from enforce_ma_interaction_office_context "$repo_root/scripts/080_ma_interaction_persistence.sql"
function_from guard_ma_interaction_mutation "$repo_root/scripts/080_ma_interaction_persistence.sql"
function_from guard_ma_interaction_opportunity_source_office "$repo_root/scripts/080_ma_interaction_persistence.sql"
function_from wave_journey_is_enabled "$repo_root/scripts/088_canonical_pursuit_evidence_and_confidentiality.sql"
function_from journey_current_cycle_event "$repo_root/scripts/088_canonical_pursuit_evidence_and_confidentiality.sql"
function_from journey_current_template_id "$repo_root/scripts/088_canonical_pursuit_evidence_and_confidentiality.sql"
function_from journey_current_gate_1_event "$repo_root/scripts/088_canonical_pursuit_evidence_and_confidentiality.sql"
function_from journey_current_signed_validation_event "$repo_root/scripts/088_canonical_pursuit_evidence_and_confidentiality.sql"
function_from journey_current_gate_2_event "$repo_root/scripts/088_canonical_pursuit_evidence_and_confidentiality.sql"
function_from journey_current_dispatch_event "$repo_root/scripts/088_canonical_pursuit_evidence_and_confidentiality.sql"
function_from journey_repreneur_authorized_template "$repo_root/scripts/112_demo_opportunity_quarantine.sql"
function_from journey_repreneur_can_access_confidential "$repo_root/scripts/124_recipient_information_memos.sql"
"${psql[@]}" >/dev/null <<'SQL'
CREATE TRIGGER capture_opportunity_ma_contact_snapshot BEFORE INSERT ON public.opportunity_ma_contacts
  FOR EACH ROW EXECUTE FUNCTION public.capture_opportunity_ma_contact_snapshot();
CREATE TRIGGER enforce_ma_interaction_office_context BEFORE INSERT OR UPDATE ON public.ma_interactions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ma_interaction_office_context();
CREATE TRIGGER guard_ma_interaction_mutation BEFORE UPDATE OR DELETE ON public.ma_interactions
  FOR EACH ROW EXECUTE FUNCTION public.guard_ma_interaction_mutation();
CREATE TRIGGER guard_ma_interaction_opportunity_source_office BEFORE UPDATE OF source_office_id ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.guard_ma_interaction_opportunity_source_office();
INSERT INTO public.ma_interactions(office_id,affiliation_id,opportunity_id,channel,direction,occurred_at,
  owner_staff_user_id,owner_verification_state,owner_verified_by,owner_verified_at,title,body_markdown,
  recipient_email_snapshot,delivery_status,provider_idempotency_key,delivery_finalized_at,sent_at,created_by)
VALUES
  ('19100000-0000-4000-8000-000000000011','19100000-0000-4000-8000-000000000031','19100000-0000-4000-8000-000000000041','email','outbound',NOW(),
   'staff-191','provisional',NULL,NULL,'Synthetic sent history','Already sent','original@example.test','sent','synthetic-191-a',NOW(),NOW(),'staff-191'),
  ('19100000-0000-4000-8000-000000000011','19100000-0000-4000-8000-000000000031','19100000-0000-4000-8000-000000000042','email','outbound',NOW(),
   'staff-191','verified','staff-191',NOW(),'Synthetic pursuit history','Already sent','original@example.test','sent','synthetic-191-b',NOW(),NOW(),'staff-191');
SQL
"${psql[@]}" --file "$repo_root/scripts/089_opportunity_source_guard_execution_context.sql" >/dev/null
"${psql[@]}" --file "$repo_root/scripts/125_exact_source_correction.sql" >/dev/null

# Also install the candidate against the saved full public schema plus only
# the later additive surfaces it reads. This catches real relation/column and
# trigger-definition drift without replaying a production snapshot.
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" -U renew_rehearsal_admin renew_exact_source_compatibility
compat_psql=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -U renew_rehearsal_admin -d renew_exact_source_compatibility)
"${compat_psql[@]}" -c "CREATE SCHEMA extensions; CREATE SCHEMA auth;
  CREATE TABLE auth.users(id UUID PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS 'SELECT NULL::UUID';" >/dev/null
"${compat_psql[@]}" --file "$repo_root/supabase/schema/771_extensions.sql" >/dev/null
"${compat_psql[@]}" --file "$repo_root/supabase/schema/771_public_schema.sql" >/dev/null
"${compat_psql[@]}" -c "ALTER TABLE public.opportunities ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE public.opportunities ADD COLUMN source_identity_to_verify BOOLEAN NOT NULL DEFAULT FALSE;
  CREATE TABLE public.opportunity_pursuit_handoff_deliveries(id UUID PRIMARY KEY,match_id UUID NOT NULL REFERENCES public.opportunity_matches(id));
  CREATE TABLE public.staff_email_reviews(id UUID PRIMARY KEY,opportunity_id UUID NOT NULL REFERENCES public.opportunities(id),state TEXT NOT NULL);
  CREATE TABLE public.staff_email_review_events(id UUID PRIMARY KEY,review_id UUID NOT NULL REFERENCES public.staff_email_reviews(id));
  CREATE TABLE public.recipient_im_cleanup(document_id UUID PRIMARY KEY,opportunity_id UUID NOT NULL REFERENCES public.opportunities(id));" >/dev/null
"${compat_psql[@]}" --file "$repo_root/scripts/089_opportunity_source_guard_execution_context.sql" >/dev/null
"${compat_psql[@]}" --file "$repo_root/scripts/125_exact_source_correction.sql" >/dev/null

"$pg_bin/createdb" -h 127.0.0.1 -p "$port" -U renew_rehearsal_admin \
  --template=renew_exact_source_rehearsal renew_exact_source_races
race_psql=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -U renew_rehearsal_admin -d renew_exact_source_races)

expect_denied() {
  local query="$1" expected="$2"
  if "${psql[@]}" -Atc "$query" >"$cluster_dir/denied.log" 2>&1; then
    echo "Unauthorized exact-source operation succeeded" >&2; exit 1
  fi
  grep -q "$expected" "$cluster_dir/denied.log" || {
    echo "Unauthorized operation failed for the wrong reason" >&2; exit 1;
  }
}
expect_denied "SET ROLE service_role; SELECT public.register_exact_source_correction(gen_random_uuid(),'staff-191','[]'::jsonb)" 'permission denied'
expect_denied "SET ROLE authenticated; SELECT public.apply_exact_source_correction(gen_random_uuid(),'staff-191')" 'permission denied'
expect_denied "SET ROLE service_role; SELECT * FROM renew_private.exact_source_manifests" 'permission denied'
expect_denied "SET ROLE authenticated; SELECT * FROM renew_private.exact_source_events" 'permission denied'
expect_denied "SET ROLE service_role; UPDATE renew_private.exact_source_manifests SET actor='other-191'" 'permission denied'
expect_denied "SET ROLE service_role; DELETE FROM renew_private.exact_source_events" 'permission denied'
expect_denied "SET ROLE service_role; UPDATE public.ma_interactions SET summary='tampered'" 'permission denied'

"${psql[@]}" --file "$repo_root/scripts/rehearsals/exact-source-correction-acceptance.sql" >/dev/null
"${race_psql[@]}" --file "$repo_root/scripts/rehearsals/exact-source-correction-register.sql" >/dev/null

wait_for_advisory() {
  local key="$1" ready=""
  for _ in {1..60}; do
    if [ "$("${race_psql[@]}" -Atc "SELECT NOT pg_try_advisory_lock($key)")" = t ]; then ready=yes; break; fi
    sleep 0.05
  done
  [ "$ready" = yes ] || { echo "Independent session did not reach its row lock" >&2; exit 1; }
}
wait_for_sql_lock() {
  local function_name="$1" observed=""
  for _ in {1..60}; do
    if [ "$("${race_psql[@]}" -Atc "SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%$function_name%')")" = t ]; then observed=yes; break; fi
    sleep 0.05
  done
  [ "$observed" = yes ] || { echo "Independent correction session did not block on a database lock" >&2; exit 1; }
}
expect_race_failure() {
  local expected="$1"
  if wait "$race_b_pid"; then echo "Drifted correction unexpectedly succeeded" >&2; exit 1; fi
  grep -q "$expected" "$cluster_dir/race-b.log" || {
    echo "Drifted correction failed for the wrong reason" >&2; exit 1;
  }
}

# A source reservation commits while apply waits on the opportunity row.
"${race_psql[@]}" -Atc "BEGIN;
  SELECT id FROM public.opportunities WHERE reference='SYN-191-A' FOR UPDATE;
  SELECT pg_advisory_lock(19101);
  INSERT INTO public.ma_source_email_send_reservations VALUES
    ('19100000-0000-4000-8000-000000000041',gen_random_uuid(),NOW()+INTERVAL '1 hour');
  SELECT pg_sleep(4); COMMIT;" >"$cluster_dir/race-a.log" 2>&1 & race_a_pid=$!
wait_for_advisory 19101
"${race_psql[@]}" -Atc "SET ROLE service_role; SELECT public.apply_exact_source_correction('19100000-0000-4000-8000-000000000099','staff-191')" >"$cluster_dir/race-b.log" 2>&1 & race_b_pid=$!
wait_for_sql_lock apply_exact_source_correction
wait "$race_a_pid"
expect_race_failure exact_source_correction_stale_manifest
"${race_psql[@]}" -Atc "DELETE FROM public.ma_source_email_send_reservations WHERE opportunity_id='19100000-0000-4000-8000-000000000041'" >/dev/null

# A normal context edit commits while apply waits; all three remain untouched.
"${race_psql[@]}" -Atc "BEGIN;
  UPDATE public.opportunities SET description='Concurrent source context edit' WHERE reference='SYN-191-B';
  SELECT pg_advisory_lock(19102); SELECT pg_sleep(4); COMMIT;" >"$cluster_dir/race-a.log" 2>&1 & race_a_pid=$!
wait_for_advisory 19102
"${race_psql[@]}" -Atc "SET ROLE service_role; SELECT public.apply_exact_source_correction('19100000-0000-4000-8000-000000000099','staff-191')" >"$cluster_dir/race-b.log" 2>&1 & race_b_pid=$!
wait_for_sql_lock apply_exact_source_correction
wait "$race_a_pid"
expect_race_failure exact_source_correction_stale_manifest
[ "$("${race_psql[@]}" -Atc "SELECT COUNT(*) FROM public.opportunities WHERE source_identity_to_verify")" = 3 ] || {
  echo "Concurrent context drift caused a partial correction" >&2; exit 1;
}
"${race_psql[@]}" -Atc "UPDATE public.opportunities SET description='Synthetic B' WHERE reference='SYN-191-B'" >/dev/null

# Two independent sessions attempt the same manifest. The second waits for
# commit and returns the one immutable receipt, never another correction.
"${race_psql[@]}" -Atc "BEGIN; SET ROLE service_role;
  SELECT public.apply_exact_source_correction('19100000-0000-4000-8000-000000000099','staff-191');
  SELECT pg_advisory_lock(19103); SELECT pg_sleep(4); COMMIT;" >"$cluster_dir/race-a.log" 2>&1 & race_a_pid=$!
wait_for_advisory 19103
"${race_psql[@]}" -Atc "SET ROLE service_role; SELECT public.apply_exact_source_correction('19100000-0000-4000-8000-000000000099','staff-191')" >"$cluster_dir/race-b.log" 2>&1 & race_b_pid=$!
wait_for_sql_lock apply_exact_source_correction
wait "$race_a_pid"
wait "$race_b_pid"
[ "$("${race_psql[@]}" -Atc "SELECT COUNT(*) FROM renew_private.exact_source_events")" = 2 ] || {
  echo "Simultaneous apply created duplicate evidence" >&2; exit 1;
}

# A new current-office interaction commits while inverse waits; inverse then
# rejects changed dependencies and retains both sent-history generations.
"${race_psql[@]}" -Atc "BEGIN;
  SELECT id FROM public.opportunities WHERE reference='SYN-191-A' FOR UPDATE;
  SELECT pg_advisory_lock(19104);
  INSERT INTO public.ma_interactions(office_id,affiliation_id,opportunity_id,channel,direction,occurred_at,
    owner_staff_user_id,summary,recipient_email_snapshot,delivery_status,provider_idempotency_key,delivery_finalized_at,sent_at)
  VALUES('19100000-0000-4000-8000-000000000012','19100000-0000-4000-8000-000000000032',
    '19100000-0000-4000-8000-000000000041','email','outbound',NOW(),'staff-191',
    'Later synthetic send','target-a@example.test','sent','inverse-race',NOW(),NOW());
  SELECT pg_sleep(4); COMMIT;" >"$cluster_dir/race-a.log" 2>&1 & race_a_pid=$!
wait_for_advisory 19104
"${race_psql[@]}" -Atc "SELECT public.rollback_exact_source_correction('19100000-0000-4000-8000-000000000099','staff-191')" >"$cluster_dir/race-b.log" 2>&1 & race_b_pid=$!
wait_for_sql_lock rollback_exact_source_correction
wait "$race_a_pid"
expect_race_failure exact_source_rollback_compare_and_swap_failed
[ "$("${race_psql[@]}" -Atc "SELECT COUNT(*) FROM public.ma_interactions WHERE opportunity_id='19100000-0000-4000-8000-000000000041'")" = 2 ] || {
  echo "Inverse race lost retained interaction history" >&2; exit 1;
}

echo "#191 exact source correction local PG17 rehearsal passed"
