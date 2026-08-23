#!/usr/bin/env bash
set -euo pipefail

# This creates a disposable local full-schema cluster. It never loads project
# credentials and never connects to a remote database.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
if [ ! -x "$pg_bin/initdb" ]; then pg_bin="/opt/homebrew/opt/postgresql@16/bin"; fi
cluster_dir="$(mktemp -d /private/tmp/renew-w128-draft-activation.XXXXXX)"
port="${W128_DRAFT_ACTIVATION_REHEARSAL_PORT:-55447}"
cleanup() {
  [ ! -f "$cluster_dir/postmaster.pid" ] || "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$cluster_dir"
}
trap cleanup EXIT

for binary in initdb pg_ctl createdb psql; do
  [ -x "$pg_bin/$binary" ] || { echo "Missing PostgreSQL binary: $pg_bin/$binary" >&2; exit 1; }
done

"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 --auth-local=trust --auth-host=trust >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -o "-p $port -h 127.0.0.1" -w start >/dev/null
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" w128_rehearsal
psql=("$pg_bin/psql" -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -d w128_rehearsal)

"${psql[@]}" -c "CREATE ROLE postgres NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN; CREATE SCHEMA extensions; CREATE SCHEMA auth; CREATE TABLE auth.users (id UUID PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS 'SELECT NULL::UUID';" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/schema/771_extensions.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/schema/771_public_schema.sql" >/dev/null
"${psql[@]}" --file "$repo_root/scripts/112_demo_opportunity_quarantine.sql" >/dev/null
"${psql[@]}" --file "$repo_root/scripts/115_w128_draft_opportunity_activation.sql" >/dev/null

# The baseline includes a singleton Acme provisional-source guard unrelated to
# this synthetic W-128 fixture. Keep the full schema and all activation guards,
# but disable that one context-specific trigger only inside this disposable DB.
"${psql[@]}" -c "ALTER TABLE public.opportunities DISABLE TRIGGER enforce_ma_provisional_source_review_on_opportunity;" >/dev/null

"${psql[@]}" <<'SQL'
BEGIN;
INSERT INTO public.ma_firms(id, name, status, created_by)
VALUES ('00000000-0000-4000-8000-000000001128', 'W128 Fixture Firm', 'active', 'w128-rehearsal');
INSERT INTO public.ma_offices(id, firm_id, name, status, is_default, created_by)
VALUES ('00000000-0000-4000-8000-000000001129', '00000000-0000-4000-8000-000000001128', 'Paris', 'active', FALSE, 'w128-rehearsal');
COMMIT;
INSERT INTO public.ma_contacts(id, first_name, display_name, status, email, created_by)
VALUES ('00000000-0000-4000-8000-000000001130', 'Ada', 'Ada Contact', 'active', 'ada@example.test', 'w128-rehearsal');
INSERT INTO public.ma_contact_office_affiliations(id, contact_id, office_id, is_active, created_by)
VALUES ('00000000-0000-4000-8000-000000001131', '00000000-0000-4000-8000-000000001130', '00000000-0000-4000-8000-000000001129', TRUE, 'w128-rehearsal');
INSERT INTO public.repreneurs(id, email, first_name, last_name, created_by)
VALUES ('00000000-0000-4000-8000-000000001138', 'w128-repreneur@example.test', 'W128', 'Repreneur', 'w128-rehearsal');
INSERT INTO public.opportunities(id, reference, status, source_office_id, description, repreneur_exposure, source_visibility, is_demo, created_by)
VALUES
  ('00000000-0000-4000-8000-000000001132', 'W128-VALID', 'draft', '00000000-0000-4000-8000-000000001129', 'Valid fixture', 'staff_only', 'staff_only', FALSE, 'w128-rehearsal'),
  ('00000000-0000-4000-8000-000000001133', 'W128-DEMO', 'draft', '00000000-0000-4000-8000-000000001129', 'Demo fixture', 'staff_only', 'staff_only', TRUE, 'w128-rehearsal'),
  ('00000000-0000-4000-8000-000000001136', 'W128-DRIFT', 'draft', '00000000-0000-4000-8000-000000001129', 'Drift fixture', 'staff_only', 'staff_only', FALSE, 'w128-rehearsal');
INSERT INTO public.opportunity_ma_contacts(id, opportunity_id, affiliation_id, is_primary, is_active, linked_by)
VALUES
  ('00000000-0000-4000-8000-000000001134', '00000000-0000-4000-8000-000000001132', '00000000-0000-4000-8000-000000001131', TRUE, TRUE, 'w128-rehearsal'),
  ('00000000-0000-4000-8000-000000001135', '00000000-0000-4000-8000-000000001133', '00000000-0000-4000-8000-000000001131', TRUE, TRUE, 'w128-rehearsal'),
  ('00000000-0000-4000-8000-000000001137', '00000000-0000-4000-8000-000000001136', '00000000-0000-4000-8000-000000001131', TRUE, TRUE, 'w128-rehearsal');
INSERT INTO public.ma_interactions(
  id, office_id, affiliation_id, opportunity_id, channel, direction, occurred_at,
  owner_staff_user_id, summary, recipient_email_snapshot, delivery_status,
  client_operation_key, provider_idempotency_key, provider_request_fingerprint, created_by
)
VALUES (
  '00000000-0000-4000-8000-000000001140',
  '00000000-0000-4000-8000-000000001129',
  '00000000-0000-4000-8000-000000001131',
  '00000000-0000-4000-8000-000000001136',
  'email', 'outbound', CLOCK_TIMESTAMP(), 'w128-rehearsal',
  'Pre-existing pending outreach', 'ada@example.test', 'pending',
  '00000000-0000-4000-8000-000000001141',
  'w128-pre-existing-outreach', REPEAT('a', 64), 'w128-rehearsal'
);

-- Model the production-style timestamp behavior. The exact post-activation
-- timestamp must be recorded and enforced before a rollback can proceed.
CREATE OR REPLACE FUNCTION public.w128_rehearsal_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := CLOCK_TIMESTAMP();
  RETURN NEW;
END;
$$;
CREATE TRIGGER w128_rehearsal_touch_updated_at
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.w128_rehearsal_touch_updated_at();

DO $$
DECLARE manifest JSONB; digest TEXT; result RECORD; rollback_result RECORD;
BEGIN
  -- A self-digested eligible subset is still unauthorized: Gate 2 is the
  -- complete fresh eligible set.
  SELECT JSONB_AGG(JSONB_BUILD_OBJECT('ordinal', ordinal, 'id', id, 'reference', reference, 'updated_at', updated_at, 'fingerprint', fingerprint) ORDER BY ordinal)
  INTO manifest FROM public.w128_draft_activation_preflight() WHERE eligible AND reference='W128-VALID';
  SELECT ENCODE(extensions.digest(CONVERT_TO(STRING_AGG(CONCAT_WS('|', ordinal, id, reference, TO_CHAR(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), fingerprint), E'\n' ORDER BY ordinal), 'UTF8'), 'sha256'), 'hex')
  INTO digest FROM public.w128_draft_activation_preflight() WHERE eligible AND reference='W128-VALID';
  BEGIN
    PERFORM public.apply_w128_draft_activation(manifest, digest, 'w128-rehearsal');
    RAISE EXCEPTION 'w128_subset_activation_was_allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'w128_activation_manifest_set_mismatch' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.w128_draft_activation_runs) <> 0 THEN RAISE EXCEPTION 'w128_subset_left_audit'; END IF;

  SELECT JSONB_AGG(JSONB_BUILD_OBJECT('ordinal', ordinal, 'id', id, 'reference', reference, 'updated_at', updated_at, 'fingerprint', fingerprint) ORDER BY ordinal)
  INTO manifest FROM public.w128_draft_activation_preflight() WHERE eligible;
  SELECT ENCODE(extensions.digest(CONVERT_TO(STRING_AGG(CONCAT_WS('|', ordinal, id, reference, TO_CHAR(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), fingerprint), E'\n' ORDER BY ordinal), 'UTF8'), 'sha256'), 'hex')
  INTO digest FROM public.w128_draft_activation_preflight() WHERE eligible;
  SELECT * INTO result FROM public.apply_w128_draft_activation(manifest, digest, 'w128-rehearsal');
  IF result.activated_count <> 2 THEN RAISE EXCEPTION 'w128_activation_count_mismatch'; END IF;
  IF (SELECT count(*) FROM public.opportunities WHERE reference IN ('W128-VALID','W128-DRIFT') AND status='active') <> 2 THEN RAISE EXCEPTION 'w128_valid_rows_not_activated'; END IF;
  IF (SELECT status FROM public.opportunities WHERE reference='W128-DEMO') <> 'draft' THEN RAISE EXCEPTION 'w128_demo_row_changed'; END IF;
  IF (SELECT count(*) FROM public.opportunities WHERE reference IN ('W128-VALID','W128-DRIFT') AND repreneur_exposure='staff_only' AND source_visibility='staff_only') <> 2 THEN RAISE EXCEPTION 'w128_visibility_changed'; END IF;
  IF (SELECT count(*) FROM public.w128_draft_activation_runs) <> 1 THEN RAISE EXCEPTION 'w128_audit_missing'; END IF;

  IF has_table_privilege('service_role', 'public.w128_draft_activation_runs', 'INSERT')
    OR has_table_privilege('service_role', 'public.w128_draft_activation_runs', 'UPDATE')
    OR has_table_privilege('service_role', 'public.w128_draft_activation_runs', 'DELETE')
    OR has_table_privilege('service_role', 'public.w128_draft_activation_runs', 'TRUNCATE')
    OR has_table_privilege('service_role', 'public.w128_draft_activation_rollbacks', 'INSERT')
    OR has_table_privilege('service_role', 'public.w128_draft_activation_rollbacks', 'UPDATE')
    OR has_table_privilege('service_role', 'public.w128_draft_activation_rollbacks', 'DELETE')
    OR has_table_privilege('service_role', 'public.w128_draft_activation_rollbacks', 'TRUNCATE')
  THEN RAISE EXCEPTION 'w128_direct_audit_mutation_allowed'; END IF;

  BEGIN
    TRUNCATE public.w128_draft_activation_runs, public.w128_draft_activation_rollbacks;
    RAISE EXCEPTION 'w128_run_audit_truncate_was_allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'w128_draft_activation_runs_are_immutable' THEN RAISE; END IF;
  END;

  -- A canonical staff interaction created after activation is operational use
  -- of the live opportunity and must make rollback fail closed.
  BEGIN
    INSERT INTO public.ma_interactions(
      id, office_id, affiliation_id, opportunity_id, channel, direction,
      occurred_at, owner_staff_user_id, summary, created_by
    )
    VALUES (
      '00000000-0000-4000-8000-000000001143',
      '00000000-0000-4000-8000-000000001129',
      '00000000-0000-4000-8000-000000001131',
      '00000000-0000-4000-8000-000000001132',
      'call', 'outbound', CLOCK_TIMESTAMP(), 'w128-rehearsal',
      'Post-activation staff outreach', 'w128-rehearsal'
    );
    PERFORM public.rollback_w128_draft_activation(result.run_id, 'w128-rollback-rehearsal');
    RAISE EXCEPTION 'w128_staff_outreach_rollback_was_allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'w128_rollback_manifest_drift' THEN RAISE; END IF;
  END;

  -- Delivery evidence can advance without changing the interaction or parent
  -- opportunity row. It is independently lifecycle-significant.
  BEGIN
    INSERT INTO public.ma_interaction_delivery_events(
      id, interaction_id, event_kind, actor, provider_idempotency_key
    )
    VALUES (
      '00000000-0000-4000-8000-000000001142',
      '00000000-0000-4000-8000-000000001140',
      'pending', 'w128-rehearsal', 'w128-pre-existing-outreach'
    );
    PERFORM public.rollback_w128_draft_activation(result.run_id, 'w128-rollback-rehearsal');
    RAISE EXCEPTION 'w128_delivery_evidence_rollback_was_allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'w128_rollback_manifest_drift' THEN RAISE; END IF;
  END;

  -- A new downstream match does not touch opportunities.updated_at. It must
  -- still make the whole rollback fail closed; the subtransaction removes the
  -- synthetic drift after proving the rejection.
  BEGIN
    INSERT INTO public.opportunity_matches(id, opportunity_id, repreneur_id, status, created_by)
    VALUES ('00000000-0000-4000-8000-000000001139', '00000000-0000-4000-8000-000000001136', '00000000-0000-4000-8000-000000001138', 'interested', 'w128-rehearsal');
    PERFORM public.rollback_w128_draft_activation(result.run_id, 'w128-rollback-rehearsal');
    RAISE EXCEPTION 'w128_dependency_drift_rollback_was_allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'w128_rollback_manifest_drift' THEN RAISE; END IF;
  END;

  SELECT * INTO rollback_result FROM public.rollback_w128_draft_activation(result.run_id, 'w128-rollback-rehearsal');
  IF rollback_result.rolled_back_count <> 2 THEN RAISE EXCEPTION 'w128_rollback_count_mismatch'; END IF;
  IF (SELECT count(*) FROM public.opportunities WHERE reference IN ('W128-VALID','W128-DRIFT') AND status='draft') <> 2 THEN RAISE EXCEPTION 'w128_valid_rows_not_rolled_back'; END IF;
  IF (SELECT count(*) FROM public.w128_draft_activation_rollbacks) <> 1 THEN RAISE EXCEPTION 'w128_rollback_audit_missing'; END IF;
  BEGIN
    TRUNCATE public.w128_draft_activation_rollbacks;
    RAISE EXCEPTION 'w128_rollback_audit_truncate_was_allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'w128_draft_activation_runs_are_immutable' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.apply_w128_draft_activation(manifest, digest, 'w128-second-run');
    RAISE EXCEPTION 'w128_second_activation_was_allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'w128_activation_already_completed' THEN RAISE; END IF;
  END;
END $$;
SQL

"${psql[@]}" --file "$repo_root/scripts/run-w128-draft-activation-preflight.sql" >/dev/null

echo "W-128 Draft activation full-schema rehearsal passed"
