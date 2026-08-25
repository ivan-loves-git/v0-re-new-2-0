#!/usr/bin/env bash
set -euo pipefail

# W-157 full-schema rehearsal. It uses only deterministic synthetic records in
# a disposable local PostgreSQL cluster and never reads project credentials.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
if [ ! -x "$pg_bin/initdb" ]; then pg_bin="/opt/homebrew/opt/postgresql@16/bin"; fi
cluster_dir="$(mktemp -d "${TMPDIR:-/tmp}/renew-w157-single-office.XXXXXX")"
port="${W157_SINGLE_OFFICE_REHEARSAL_PORT:-55457}"
database_superuser="renew_w157_rehearsal_admin"

cleanup() {
  [ ! -f "$cluster_dir/postmaster.pid" ] || "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$cluster_dir"
}
trap cleanup EXIT

for binary in initdb pg_ctl createdb psql; do
  [ -x "$pg_bin/$binary" ] || { echo "Missing PostgreSQL binary: $pg_bin/$binary" >&2; exit 1; }
done

"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 --auth-local=trust --auth-host=trust --username="$database_superuser" >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -l "$cluster_dir/postgres.log" -o "-p $port -h 127.0.0.1 -k $cluster_dir" -w start >/dev/null
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" -U "$database_superuser" w157_rehearsal
psql=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -U "$database_superuser" -d w157_rehearsal)

"${psql[@]}" -c "CREATE ROLE postgres NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS; CREATE SCHEMA extensions; CREATE SCHEMA auth; CREATE TABLE auth.users (id UUID PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS 'SELECT NULL::UUID';" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/schema/771_extensions.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/schema/771_public_schema.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/schema/823_staff_ma_relationship_corrections.sql" >/dev/null

# The sanitized baseline retains a singleton Acme production-context invariant
# unrelated to this synthetic contact fixture.
"${psql[@]}" -c "ALTER TABLE public.opportunities DISABLE TRIGGER enforce_ma_provisional_source_review_on_opportunity;" >/dev/null

"${psql[@]}" <<'SQL' >/dev/null
BEGIN;
INSERT INTO public.ma_firms(id, name, status, created_by) VALUES
  ('15700000-0000-4000-8000-000000000001', 'W157 Network', 'prospect', 'w157-fixture'),
  ('15700000-0000-4000-8000-000000000002', 'W157 Active Firm', 'active', 'w157-fixture');
INSERT INTO public.ma_offices(id, firm_id, name, status, is_default, created_by) VALUES
  ('15700000-0000-4000-8000-000000000011', '15700000-0000-4000-8000-000000000001', 'W157 Network', 'active', FALSE, 'w157-fixture'),
  ('15700000-0000-4000-8000-000000000012', '15700000-0000-4000-8000-000000000001', 'W157 Network — North', 'active', FALSE, 'w157-fixture'),
  ('15700000-0000-4000-8000-000000000013', '15700000-0000-4000-8000-000000000001', 'W157 Network — South', 'active', FALSE, 'w157-fixture'),
  ('15700000-0000-4000-8000-000000000014', '15700000-0000-4000-8000-000000000002', 'W157 Active Office', 'active', FALSE, 'w157-fixture');
INSERT INTO public.ma_contacts(id, first_name, last_name, display_name, status, email, created_by, archived_by, archived_at) VALUES
  ('15700000-0000-4000-8000-000000000021', 'Central', 'Choice', 'Central Choice', 'active', 'central@example.test', 'w157-fixture', NULL, NULL),
  ('15700000-0000-4000-8000-000000000022', 'Active', 'Firm', 'Active Firm', 'active', 'active@example.test', 'w157-fixture', NULL, NULL),
  ('15700000-0000-4000-8000-000000000023', 'Live', 'Opportunity', 'Live Opportunity', 'active', 'live@example.test', 'w157-fixture', NULL, NULL),
  ('15700000-0000-4000-8000-000000000024', 'Single', 'Office', 'Single Office', 'active', 'single@example.test', 'w157-fixture', NULL, NULL),
  ('15700000-0000-4000-8000-000000000025', 'Historical', 'Person', 'Historical Person', 'archived', 'historical@example.test', 'w157-fixture', 'w157-fixture', CLOCK_TIMESTAMP());
INSERT INTO public.ma_contact_office_affiliations(id, contact_id, office_id, job_title, is_active, ended_at, created_by) VALUES
  ('15700000-0000-4000-8000-000000000031', '15700000-0000-4000-8000-000000000021', '15700000-0000-4000-8000-000000000011', 'Advisor', TRUE, NULL, 'w157-fixture'),
  ('15700000-0000-4000-8000-000000000032', '15700000-0000-4000-8000-000000000021', '15700000-0000-4000-8000-000000000012', 'Advisor', TRUE, NULL, 'w157-fixture'),
  ('15700000-0000-4000-8000-000000000033', '15700000-0000-4000-8000-000000000021', '15700000-0000-4000-8000-000000000013', 'Advisor', TRUE, NULL, 'w157-fixture'),
  ('15700000-0000-4000-8000-000000000034', '15700000-0000-4000-8000-000000000022', '15700000-0000-4000-8000-000000000011', NULL, TRUE, NULL, 'w157-fixture'),
  ('15700000-0000-4000-8000-000000000035', '15700000-0000-4000-8000-000000000022', '15700000-0000-4000-8000-000000000014', NULL, TRUE, NULL, 'w157-fixture'),
  ('15700000-0000-4000-8000-000000000036', '15700000-0000-4000-8000-000000000023', '15700000-0000-4000-8000-000000000011', NULL, TRUE, NULL, 'w157-fixture'),
  ('15700000-0000-4000-8000-000000000037', '15700000-0000-4000-8000-000000000023', '15700000-0000-4000-8000-000000000012', NULL, TRUE, NULL, 'w157-fixture'),
  ('15700000-0000-4000-8000-000000000038', '15700000-0000-4000-8000-000000000024', '15700000-0000-4000-8000-000000000013', NULL, TRUE, NULL, 'w157-fixture'),
  ('15700000-0000-4000-8000-000000000039', '15700000-0000-4000-8000-000000000025', '15700000-0000-4000-8000-000000000011', NULL, FALSE, CURRENT_DATE - 1, 'w157-fixture');
INSERT INTO public.opportunities(id, reference, status, source_office_id, created_by) VALUES
  ('15700000-0000-4000-8000-000000000041', 'W157-LIVE', 'draft', '15700000-0000-4000-8000-000000000012', 'w157-fixture');
INSERT INTO public.opportunity_ma_contacts(id, opportunity_id, affiliation_id, is_primary, is_active, linked_by) VALUES
  ('15700000-0000-4000-8000-000000000042', '15700000-0000-4000-8000-000000000041', '15700000-0000-4000-8000-000000000037', TRUE, TRUE, 'w157-fixture');
COMMIT;
SQL

"${psql[@]}" --single-transaction --file "$repo_root/supabase/migrations/20260825072313_w157_single_office_per_contact.sql" >/dev/null

"${psql[@]}" <<'SQL'
DO $$
DECLARE
  saved RECORD;
BEGIN
  IF (SELECT office_id FROM public.ma_contact_office_affiliations WHERE contact_id='15700000-0000-4000-8000-000000000021' AND is_active)
    <> '15700000-0000-4000-8000-000000000011'::UUID THEN
    RAISE EXCEPTION 'w157_central_office_preference_failed';
  END IF;
  IF (SELECT office_id FROM public.ma_contact_office_affiliations WHERE contact_id='15700000-0000-4000-8000-000000000022' AND is_active)
    <> '15700000-0000-4000-8000-000000000014'::UUID THEN
    RAISE EXCEPTION 'w157_active_firm_preference_failed';
  END IF;
  IF (SELECT office_id FROM public.ma_contact_office_affiliations WHERE contact_id='15700000-0000-4000-8000-000000000023' AND is_active)
    <> '15700000-0000-4000-8000-000000000012'::UUID THEN
    RAISE EXCEPTION 'w157_live_opportunity_preference_failed';
  END IF;
  IF (SELECT COUNT(*) FROM public.ma_contact_office_affiliations WHERE ended_by='w157-normalization:evidence-first-v1') <> 4 THEN
    RAISE EXCEPTION 'w157_normalization_history_count_failed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ma_contacts contact
    LEFT JOIN public.ma_contact_office_affiliations affiliation
      ON affiliation.contact_id=contact.id AND affiliation.is_active
    GROUP BY contact.id, contact.status
    HAVING (contact.status='active' AND COUNT(affiliation.id)<>1)
      OR (contact.status<>'active' AND COUNT(affiliation.id)<>0)
  ) THEN
    RAISE EXCEPTION 'w157_post_migration_invariant_failed';
  END IF;

  SET LOCAL ROLE service_role;
  SELECT * INTO saved
  FROM public.update_ma_contact_with_office_correction(
    '15700000-0000-4000-8000-000000000021',
    '15700000-0000-4000-8000-000000000031',
    '15700000-0000-4000-8000-000000000013',
    'Corrected', 'Choice', 'corrected@example.test', '+33 1 23 45 67 89',
    'https://example.test/profile', 'Retained staff context', 'Partner', 'w157-staff'
  );
  RESET ROLE;

  IF saved.office_id <> '15700000-0000-4000-8000-000000000013'::UUID
    OR saved.affiliation_id = '15700000-0000-4000-8000-000000000031'::UUID THEN
    RAISE EXCEPTION 'w157_atomic_move_result_failed';
  END IF;
  IF (SELECT is_active OR ended_by <> 'w157-staff' FROM public.ma_contact_office_affiliations WHERE id='15700000-0000-4000-8000-000000000031') THEN
    RAISE EXCEPTION 'w157_old_affiliation_history_failed';
  END IF;
  IF (SELECT display_name FROM public.ma_contacts WHERE id='15700000-0000-4000-8000-000000000021') <> 'Corrected Choice' THEN
    RAISE EXCEPTION 'w157_profile_correction_failed';
  END IF;

  BEGIN
    INSERT INTO public.ma_contact_office_affiliations(contact_id, office_id, created_by)
    VALUES ('15700000-0000-4000-8000-000000000021', '15700000-0000-4000-8000-000000000014', 'forged-second-office');
    RAISE EXCEPTION 'w157_direct_second_office_was_allowed';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  BEGIN
    SET LOCAL ROLE service_role;
    PERFORM public.create_or_affiliate_ma_contact(
      '15700000-0000-4000-8000-000000000014',
      '15700000-0000-4000-8000-000000000021',
      NULL, NULL, NULL, NULL, NULL, 'w157-staff'
    );
    RAISE EXCEPTION 'w157_existing_contact_second_office_was_allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ma_contact_already_has_active_office' THEN RAISE; END IF;
  END;
  RESET ROLE;

  BEGIN
    SET LOCAL ROLE service_role;
    PERFORM public.update_ma_contact_with_office_correction(
      '15700000-0000-4000-8000-000000000023',
      '15700000-0000-4000-8000-000000000037',
      '15700000-0000-4000-8000-000000000011',
      'Live', 'Opportunity', 'live@example.test', NULL, NULL, NULL, NULL, 'w157-staff'
    );
    RAISE EXCEPTION 'w157_live_opportunity_move_was_allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ma_contact_move_blocked_by_current_opportunity' THEN RAISE; END IF;
  END;
  RESET ROLE;

  IF (SELECT office_id FROM public.ma_contact_office_affiliations WHERE contact_id='15700000-0000-4000-8000-000000000023' AND is_active)
    <> '15700000-0000-4000-8000-000000000012'::UUID THEN
    RAISE EXCEPTION 'w157_blocked_move_changed_contact';
  END IF;
END;
$$;

BEGIN;
INSERT INTO public.ma_contacts(id, first_name, display_name, status, created_by)
VALUES ('15700000-0000-4000-8000-000000000051', 'Orphan', 'Orphan', 'active', 'w157-fixture');
DO $$
BEGIN
  BEGIN
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'w157_orphan_active_contact_was_allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ma_active_contact_requires_exactly_one_active_office' THEN RAISE; END IF;
  END;
END;
$$;
ROLLBACK;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.update_ma_contact_with_office_correction(uuid,uuid,uuid,text,text,text,text,text,text,text,text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.update_ma_contact_with_office_correction(uuid,uuid,uuid,text,text,text,text,text,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'w157_browser_execute_privilege_leaked';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.update_ma_contact_with_office_correction(uuid,uuid,uuid,text,text,text,text,text,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'w157_service_execute_privilege_missing';
  END IF;
END;
$$;
SQL

echo "W-157 single-office normalization and correction rehearsal passed"
