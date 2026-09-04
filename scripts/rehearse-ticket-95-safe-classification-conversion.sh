#!/usr/bin/env bash
set -euo pipefail

# Disposable full-schema proof for Ticket #95. It uses only synthetic rows and
# never reads project credentials or production data.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
cluster_dir="$(mktemp -d /tmp/renew-ticket-95.XXXXXX)"
port="${TICKET_95_REHEARSAL_PORT:-55497}"
database_superuser="renew_ticket_95_admin"

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
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" -U "$database_superuser" ticket95
psql=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -U "$database_superuser" -d ticket95)

"${psql[@]}" -c "CREATE ROLE postgres NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS; CREATE ROLE ticket_95_public_probe NOLOGIN; CREATE SCHEMA extensions; CREATE SCHEMA auth; CREATE TABLE auth.users (id UUID PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS 'SELECT NULL::UUID';" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/schema/771_extensions.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/schema/771_public_schema.sql" >/dev/null

# The checked-in schema snapshot predates W-160/W-164. Install only their
# additive prerequisites before applying the actual W-164 authority migration.
"${psql[@]}" -c "ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE; ALTER TABLE public.repreneurs ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN IF NOT EXISTS demo_classification_updated_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS demo_classification_updated_by TEXT;" >/dev/null
"${psql[@]}" --single-transaction --file "$repo_root/supabase/migrations/20260827103000_w164_lifecycle_namespace_visibility.sql" >/dev/null
"${psql[@]}" --file "$repo_root/scripts/120_ticket_95_safe_classification_conversion.sql" >/dev/null

"${psql[@]}" <<'SQL' >/dev/null
SET session_replication_role = replica;
INSERT INTO public.opportunities (
  id, reference, status, repreneur_exposure, is_demo, created_by, updated_by, updated_at
) VALUES
  ('95000000-0000-4000-8000-000000000001', 'T95-ZERO', 'draft', 'staff_only', FALSE, 'fixture', 'fixture', '2026-09-04T13:00:00Z'),
  ('95000000-0000-4000-8000-000000000002', 'T95-MATCHED-REAL', 'draft', 'staff_only', FALSE, 'fixture', 'fixture', '2026-09-04T13:00:00Z'),
  ('95000000-0000-4000-8000-000000000003', 'T95-MATCHED-DEMO', 'draft', 'staff_only', TRUE, 'fixture', 'fixture', '2026-09-04T13:00:00Z');

INSERT INTO public.repreneurs (
  id, email, first_name, last_name, is_demo, created_by, updated_at
) VALUES
  ('95100000-0000-4000-8000-000000000001', 'zero@example.test', 'Zero', 'Match', FALSE, 'fixture', '2026-09-04T13:00:00Z'),
  ('95100000-0000-4000-8000-000000000002', 'real@example.test', 'Matched', 'Real', FALSE, 'fixture', '2026-09-04T13:00:00Z'),
  ('95100000-0000-4000-8000-000000000003', 'demo@example.test', 'Matched', 'Demo', TRUE, 'fixture', '2026-09-04T13:00:00Z');

INSERT INTO public.opportunity_matches (
  id, opportunity_id, repreneur_id, status, created_by, updated_at
) VALUES
  ('95200000-0000-4000-8000-000000000002', '95000000-0000-4000-8000-000000000002', '95100000-0000-4000-8000-000000000002', 'proposed', 'fixture', '2026-09-04T13:00:00Z'),
  ('95200000-0000-4000-8000-000000000003', '95000000-0000-4000-8000-000000000003', '95100000-0000-4000-8000-000000000003', 'dropped', 'fixture', '2026-09-04T13:00:00Z');

INSERT INTO public.opportunity_pursuit_events (
  match_id, opportunity_id, repreneur_id, stage, note, created_by
) VALUES
  ('95200000-0000-4000-8000-000000000002', '95000000-0000-4000-8000-000000000002', '95100000-0000-4000-8000-000000000002', 'interest', 'retained real evidence', 'fixture'),
  ('95200000-0000-4000-8000-000000000003', '95000000-0000-4000-8000-000000000003', '95100000-0000-4000-8000-000000000003', 'interest', 'retained demo evidence', 'fixture');
RESET session_replication_role;
SQL

"${psql[@]}" <<'SQL'
DO $$
BEGIN
  IF NOT has_function_privilege(
    'service_role',
    'public.set_zero_match_demo_classification(text,uuid,boolean,text)',
    'EXECUTE'
  ) OR has_function_privilege(
    'anon',
    'public.set_zero_match_demo_classification(text,uuid,boolean,text)',
    'EXECUTE'
  ) OR has_function_privilege(
    'authenticated',
    'public.set_zero_match_demo_classification(text,uuid,boolean,text)',
    'EXECUTE'
  ) OR has_function_privilege(
    'ticket_95_public_probe',
    'public.set_zero_match_demo_classification(text,uuid,boolean,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'ticket_95_function_privilege_mismatch';
  END IF;
END;
$$;

SET ROLE service_role;

DO $$
DECLARE
  result RECORD;
  first_change_at TIMESTAMPTZ;
  second_change_at TIMESTAMPTZ;
BEGIN
  SELECT * INTO result FROM public.set_zero_match_demo_classification(
    'opportunity', '95000000-0000-4000-8000-000000000001', TRUE, 'staff-95'
  );
  IF NOT result.changed OR NOT result.is_demo OR result.changed_by <> 'staff-95' OR result.changed_at IS NULL THEN
    RAISE EXCEPTION 'ticket_95_opportunity_real_to_demo_failed';
  END IF;
  first_change_at := result.changed_at;

  SELECT * INTO result FROM public.set_zero_match_demo_classification(
    'opportunity', '95000000-0000-4000-8000-000000000001', FALSE, 'staff-95'
  );
  IF NOT result.changed OR result.is_demo OR result.changed_by <> 'staff-95' OR result.changed_at < first_change_at THEN
    RAISE EXCEPTION 'ticket_95_opportunity_demo_to_real_failed';
  END IF;
  second_change_at := result.changed_at;

  SELECT * INTO result FROM public.set_zero_match_demo_classification(
    'opportunity', '95000000-0000-4000-8000-000000000001', FALSE, 'different-staff'
  );
  IF result.changed OR result.is_demo OR result.changed_at IS DISTINCT FROM second_change_at OR result.changed_by <> 'staff-95' THEN
    RAISE EXCEPTION 'ticket_95_opportunity_noop_changed_audit';
  END IF;

  SELECT * INTO result FROM public.set_zero_match_demo_classification(
    'repreneur', '95100000-0000-4000-8000-000000000001', TRUE, 'staff-95'
  );
  IF NOT result.changed OR NOT result.is_demo OR result.changed_by <> 'staff-95' OR result.changed_at IS NULL THEN
    RAISE EXCEPTION 'ticket_95_repreneur_real_to_demo_failed';
  END IF;

  SELECT * INTO result FROM public.set_zero_match_demo_classification(
    'repreneur', '95100000-0000-4000-8000-000000000001', FALSE, 'staff-95'
  );
  IF NOT result.changed OR result.is_demo OR result.changed_by <> 'staff-95' OR result.changed_at IS NULL THEN
    RAISE EXCEPTION 'ticket_95_repreneur_demo_to_real_failed';
  END IF;
END;
$$;

DO $$
BEGIN
  BEGIN
    PERFORM public.set_zero_match_demo_classification(
      'opportunity', '95000000-0000-4000-8000-000000000002', TRUE, 'staff-95'
    );
    RAISE EXCEPTION 'ticket_95_matched_real_opportunity_changed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'ticket_95_matched_real_opportunity_changed' THEN RAISE; END IF;
    IF SQLERRM <> 'ticket_95_classification_locked' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.set_zero_match_demo_classification(
      'opportunity', '95000000-0000-4000-8000-000000000003', FALSE, 'staff-95'
    );
    RAISE EXCEPTION 'ticket_95_matched_demo_opportunity_changed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'ticket_95_matched_demo_opportunity_changed' THEN RAISE; END IF;
    IF SQLERRM <> 'ticket_95_classification_locked' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.set_zero_match_demo_classification(
      'repreneur', '95100000-0000-4000-8000-000000000002', TRUE, 'staff-95'
    );
    RAISE EXCEPTION 'ticket_95_matched_real_repreneur_changed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'ticket_95_matched_real_repreneur_changed' THEN RAISE; END IF;
    IF SQLERRM <> 'ticket_95_classification_locked' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.set_zero_match_demo_classification(
      'repreneur', '95100000-0000-4000-8000-000000000003', FALSE, 'staff-95'
    );
    RAISE EXCEPTION 'ticket_95_matched_demo_repreneur_changed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'ticket_95_matched_demo_repreneur_changed' THEN RAISE; END IF;
    IF SQLERRM <> 'ticket_95_classification_locked' THEN RAISE; END IF;
  END;
END;
$$;

RESET ROLE;

DO $$
BEGIN
  BEGIN
    UPDATE public.opportunities
    SET is_demo = TRUE
    WHERE id = '95000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'ticket_95_direct_matched_opportunity_update_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'ticket_95_direct_matched_opportunity_update_allowed' THEN RAISE; END IF;
    IF SQLERRM <> 'w164_matched_opportunity_reclassification_denied' THEN RAISE; END IF;
  END;

  BEGIN
    UPDATE public.repreneurs
    SET is_demo = TRUE
    WHERE id = '95100000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'ticket_95_direct_matched_repreneur_update_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'ticket_95_direct_matched_repreneur_update_allowed' THEN RAISE; END IF;
    IF SQLERRM <> 'w164_matched_repreneur_reclassification_denied' THEN RAISE; END IF;
  END;
END;
$$;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.opportunity_matches) <> 2
    OR (SELECT count(*) FROM public.opportunity_pursuit_events) <> 2
    OR EXISTS (
      SELECT 1 FROM public.opportunities
      WHERE id IN (
        '95000000-0000-4000-8000-000000000002',
        '95000000-0000-4000-8000-000000000003'
      ) AND is_demo IS DISTINCT FROM (id = '95000000-0000-4000-8000-000000000003')
    )
    OR EXISTS (
      SELECT 1 FROM public.repreneurs
      WHERE id IN (
        '95100000-0000-4000-8000-000000000002',
        '95100000-0000-4000-8000-000000000003'
      ) AND is_demo IS DISTINCT FROM (id = '95100000-0000-4000-8000-000000000003')
    ) THEN
    RAISE EXCEPTION 'ticket_95_matched_history_changed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.opportunities
    WHERE id = '95000000-0000-4000-8000-000000000001'
      AND (is_demo OR demo_classification_updated_by <> 'staff-95' OR demo_classification_updated_at IS NULL)
  ) OR EXISTS (
    SELECT 1 FROM public.repreneurs
    WHERE id = '95100000-0000-4000-8000-000000000001'
      AND (is_demo OR demo_classification_updated_by <> 'staff-95' OR demo_classification_updated_at IS NULL)
  ) THEN
    RAISE EXCEPTION 'ticket_95_zero_match_readback_failed';
  END IF;
END;
$$;
SQL

"${psql[@]}" --file "$repo_root/scripts/120_ticket_95_safe_classification_conversion.sql" >/dev/null

echo "Ticket #95 rehearsal passed: zero-match REAL/DEMO conversion, idempotent no-op, attribution, matched lock, direct-write denial, history preservation, privilege boundary and migration replay proved."
