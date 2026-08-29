#!/usr/bin/env bash
set -euo pipefail

# W-169 full-schema rehearsal. Synthetic records run in a disposable local
# PostgreSQL cluster; project credentials and production data are never read.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
if [ ! -x "$pg_bin/initdb" ]; then pg_bin="/opt/homebrew/opt/postgresql@16/bin"; fi
cluster_dir="$(mktemp -d "${TMPDIR:-/tmp}/renew-w169-rehearsal.XXXXXX")"
port="${W169_REHEARSAL_PORT:-55474}"
database_superuser="renew_w169_rehearsal_admin"

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
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" -U "$database_superuser" w169_rehearsal
psql=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -U "$database_superuser" -d w169_rehearsal)

"${psql[@]}" -c "CREATE ROLE postgres NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS; CREATE SCHEMA extensions; CREATE SCHEMA auth; CREATE TABLE auth.users (id UUID PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS 'SELECT NULL::UUID';" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/schema/771_extensions.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/schema/771_public_schema.sql" >/dev/null

# Seed immutable pre-W-169 history before the migration to prove that the
# additive release neither rewrites nor reclassifies it.
"${psql[@]}" <<'SQL' >/dev/null
SET session_replication_role = replica;
INSERT INTO public.ma_firms (id, name, status, created_by) VALUES
  ('16900000-0000-4000-8000-000000000051', 'W169 Firm', 'active', 'w169-fixture'),
  ('16900000-0000-4000-8000-000000000061', 'Acme Co.', 'active', 'w169-fixture');
INSERT INTO public.ma_offices (id, firm_id, name, status, is_default, city, created_by) VALUES
  ('16900000-0000-4000-8000-000000000052', '16900000-0000-4000-8000-000000000051', 'W169 Office', 'active', FALSE, NULL, 'w169-fixture'),
  ('16900000-0000-4000-8000-000000000062', '16900000-0000-4000-8000-000000000061', 'Acme Paris', 'active', FALSE, 'Paris', 'w169-fixture');
INSERT INTO public.ma_contacts (id, first_name, display_name, status, email, created_by) VALUES
  ('16900000-0000-4000-8000-000000000053', 'W169', 'W169 lifecycle fixture', 'active', 'w169-source@example.test', 'w169-fixture'),
  ('16900000-0000-4000-8000-000000000063', 'Schema', 'TEST-schema-redacted-person', 'active', 'test-schema-redacted-003', 'w169-fixture'),
  ('16900000-0000-4000-8000-000000000064', 'Email', 'W169 schema email fixture', 'active', 'test-schema-redacted-001', 'w169-fixture');
INSERT INTO public.ma_contact_office_affiliations (
  id, contact_id, office_id, is_active, created_by
) VALUES
  (
    '16900000-0000-4000-8000-000000000054',
    '16900000-0000-4000-8000-000000000053',
    '16900000-0000-4000-8000-000000000052',
    TRUE,
    'w169-fixture'
  ),
  (
    '16900000-0000-4000-8000-000000000065',
    '16900000-0000-4000-8000-000000000063',
    '16900000-0000-4000-8000-000000000062',
    TRUE,
    'w169-fixture'
  );
INSERT INTO public.ma_provisional_source_contexts (
  context_key, firm_id, office_id, contact_id, affiliation_id
) VALUES (
  'acme_co_paris',
  '16900000-0000-4000-8000-000000000061',
  '16900000-0000-4000-8000-000000000062',
  '16900000-0000-4000-8000-000000000063',
  '16900000-0000-4000-8000-000000000065'
);
INSERT INTO public.app_user_roles (id, email, role) VALUES
  ('16900000-0000-4000-8000-000000000066', 'test-schema-redacted-002', 'staff');
INSERT INTO public.opportunities (id, reference, status, source_office_id, description, created_by) VALUES
  ('16900000-0000-4000-8000-000000000001', 'W169-HISTORY', 'closed', NULL, 'Historical fixture', 'w169-fixture'),
  ('16900000-0000-4000-8000-000000000002', 'W169-PAUSE', 'active', '16900000-0000-4000-8000-000000000052', 'Pause fixture', 'w169-fixture'),
  ('16900000-0000-4000-8000-000000000003', 'W169-CLOSE', 'active', '16900000-0000-4000-8000-000000000052', 'Close fixture', 'w169-fixture'),
  ('16900000-0000-4000-8000-000000000004', 'W169-DROP', 'active', '16900000-0000-4000-8000-000000000052', 'Drop fixture', 'w169-fixture'),
  ('16900000-0000-4000-8000-000000000005', 'W169-BYPASS', 'active', '16900000-0000-4000-8000-000000000052', 'Bypass fixture', 'w169-fixture'),
  ('16900000-0000-4000-8000-000000000006', 'W169-CROSS-CLOSE', 'active', '16900000-0000-4000-8000-000000000052', 'Cross-category fixture', 'w169-fixture');
INSERT INTO public.opportunity_ma_contacts (
  id, opportunity_id, affiliation_id, is_primary, is_active, linked_by
) VALUES
  ('16900000-0000-4000-8000-000000000071', '16900000-0000-4000-8000-000000000002', '16900000-0000-4000-8000-000000000054', TRUE, TRUE, 'w169-fixture'),
  ('16900000-0000-4000-8000-000000000072', '16900000-0000-4000-8000-000000000003', '16900000-0000-4000-8000-000000000054', TRUE, TRUE, 'w169-fixture'),
  ('16900000-0000-4000-8000-000000000073', '16900000-0000-4000-8000-000000000004', '16900000-0000-4000-8000-000000000054', TRUE, TRUE, 'w169-fixture'),
  ('16900000-0000-4000-8000-000000000074', '16900000-0000-4000-8000-000000000005', '16900000-0000-4000-8000-000000000054', TRUE, TRUE, 'w169-fixture'),
  ('16900000-0000-4000-8000-000000000075', '16900000-0000-4000-8000-000000000006', '16900000-0000-4000-8000-000000000054', TRUE, TRUE, 'w169-fixture');
INSERT INTO public.repreneurs (id, email, first_name, last_name, created_by) VALUES
  ('16900000-0000-4000-8000-000000000011', 'w169-history@example.test', 'History', 'Test', 'w169-fixture'),
  ('16900000-0000-4000-8000-000000000012', 'w169-drop@example.test', 'Drop', 'Test', 'w169-fixture');
INSERT INTO public.opportunity_matches (id, opportunity_id, repreneur_id, status, pursuit_stage, created_by) VALUES
  ('16900000-0000-4000-8000-000000000021', '16900000-0000-4000-8000-000000000001', '16900000-0000-4000-8000-000000000011', 'dropped', 'dropped', 'w169-fixture'),
  ('16900000-0000-4000-8000-000000000022', '16900000-0000-4000-8000-000000000004', '16900000-0000-4000-8000-000000000012', 'active_pursuit', 'interest', 'w169-fixture');
INSERT INTO public.opportunity_closure_history (id, opportunity_id, reason, closed_by, closed_at) VALUES
  ('16900000-0000-4000-8000-000000000031', '16900000-0000-4000-8000-000000000001', 'paused_cabinet', 'historic-staff', '2026-08-01T10:00:00Z');
INSERT INTO public.opportunity_pursuit_evidence (
  id, match_id, opportunity_id, repreneur_id, event_type, actor,
  evidence_reference, idempotency_key, recorded_at
) VALUES (
  '16900000-0000-4000-8000-000000000041',
  '16900000-0000-4000-8000-000000000021',
  '16900000-0000-4000-8000-000000000001',
  '16900000-0000-4000-8000-000000000011',
  'dropped',
  'historic-staff',
  NULL,
  'historic:drop',
  '2026-08-01T11:00:00Z'
);
RESET session_replication_role;
INSERT INTO public.wave_journey_settings (singleton, enabled, updated_by)
VALUES (TRUE, TRUE, 'w169-fixture')
ON CONFLICT (singleton) DO UPDATE
SET enabled = EXCLUDED.enabled, updated_by = EXCLUDED.updated_by, updated_at = NOW();
SQL

"${psql[@]}" --single-transaction --file "$repo_root/supabase/migrations/20260829180000_w169_lifecycle_outcome_separation.sql" >/dev/null
"${psql[@]}" --single-transaction --file "$repo_root/supabase/migrations/20260829203000_w169_pause_guard_scope.sql" >/dev/null

"${psql[@]}" <<'SQL'
DO $$
BEGIN
  IF NOT has_function_privilege('service_role', 'public.pause_opportunity_with_reason(uuid,text,text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.pause_opportunity_with_reason(uuid,text,text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.close_opportunity_with_reason(uuid,public.opportunity_closure_reason,text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.journey_transition_terminal(uuid,text,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'w169_non_service_role_execute_allowed';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.opportunity_closure_history
    WHERE id = '16900000-0000-4000-8000-000000000031'
      AND reason = 'paused_cabinet'
      AND closed_by = 'historic-staff'
      AND closed_at = '2026-08-01T10:00:00Z'
  ) THEN
    RAISE EXCEPTION 'w169_historical_closure_changed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.opportunity_pursuit_evidence
    WHERE id = '16900000-0000-4000-8000-000000000041'
      AND event_type = 'dropped'
      AND evidence_reference IS NULL
      AND idempotency_key = 'historic:drop'
      AND recorded_at = '2026-08-01T11:00:00Z'
  ) THEN
    RAISE EXCEPTION 'w169_historical_drop_changed';
  END IF;
END;
$$;

DO $$
BEGIN
  BEGIN
    PERFORM public.close_opportunity_with_reason(
      '16900000-0000-4000-8000-000000000006',
      'paused_cabinet',
      'staff@example.test'
    );
    RAISE EXCEPTION 'w169_cross_category_close_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'w169_cross_category_close_allowed' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%opportunity_closure_reason_not_permanent%' THEN RAISE; END IF;
  END;
END;
$$;

DO $$
BEGIN
  BEGIN
    PERFORM public.pause_opportunity_with_reason(
      '16900000-0000-4000-8000-000000000002',
      NULL,
      'staff@example.test'
    );
    RAISE EXCEPTION 'w169_unreasoned_pause_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'w169_unreasoned_pause_allowed' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%opportunity_pause_reason_required%' THEN RAISE; END IF;
  END;

  BEGIN
    UPDATE public.opportunities
    SET status = 'paused'
    WHERE id = '16900000-0000-4000-8000-000000000005';
    RAISE EXCEPTION 'w169_direct_pause_bypass_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'w169_direct_pause_bypass_allowed' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%opportunity_pause_reason_required%' THEN RAISE; END IF;
  END;

  BEGIN
    INSERT INTO public.opportunities (
      id, reference, status, source_office_id, description, created_by
    ) VALUES (
      '16900000-0000-4000-8000-000000000007',
      'W169-DIRECT-PAUSED',
      'paused',
      '16900000-0000-4000-8000-000000000052',
      'Direct paused insert fixture',
      'w169-fixture'
    );
    RAISE EXCEPTION 'w169_direct_paused_insert_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'w169_direct_paused_insert_allowed' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%opportunity_pause_reason_required%' THEN RAISE; END IF;
  END;
END;
$$;

SET ROLE service_role;
SELECT public.pause_opportunity_with_reason(
  '16900000-0000-4000-8000-000000000002',
  'paused_cabinet',
  'staff@example.test'
);
RESET ROLE;

DO $$
BEGIN
  IF (SELECT status FROM public.opportunities WHERE id = '16900000-0000-4000-8000-000000000002') <> 'paused'
    OR (SELECT count(*) FROM public.opportunity_pause_history WHERE opportunity_id = '16900000-0000-4000-8000-000000000002') <> 1
    OR NOT EXISTS (
      SELECT 1 FROM public.opportunity_pause_history
      WHERE opportunity_id = '16900000-0000-4000-8000-000000000002'
        AND reason = 'paused_cabinet'
        AND previous_status = 'active'
        AND paused_by = 'staff@example.test'
    ) THEN
    RAISE EXCEPTION 'w169_pause_not_recorded_once';
  END IF;
END;
$$;

DO $$
BEGIN
  BEGIN
    UPDATE public.opportunities
    SET status = 'paused'
    WHERE id = '16900000-0000-4000-8000-000000000005';
    RAISE EXCEPTION 'w169_pause_guard_leaked_after_service';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'w169_pause_guard_leaked_after_service' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%opportunity_pause_reason_required%' THEN RAISE; END IF;
  END;
END;
$$;

DO $$
BEGIN
  BEGIN
    PERFORM public.pause_opportunity_with_reason(
      '16900000-0000-4000-8000-000000000002',
      'paused_cabinet',
      'staff@example.test'
    );
    RAISE EXCEPTION 'w169_pause_not_recorded_once';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'w169_pause_not_recorded_once' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%opportunity_not_active_for_pause%' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.opportunity_pause_history WHERE opportunity_id = '16900000-0000-4000-8000-000000000002') <> 1 THEN
    RAISE EXCEPTION 'w169_pause_not_recorded_once';
  END IF;
END;
$$;

DO $$
BEGIN
  BEGIN
    PERFORM public.journey_transition_terminal(
      '16900000-0000-4000-8000-000000000022',
      'drop',
      'staff@example.test',
      'w169:missing-drop',
      NULL
    );
    RAISE EXCEPTION 'w169_unreasoned_drop_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'w169_unreasoned_drop_allowed' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%pursuit_drop_reason_required%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.journey_transition_terminal(
      '16900000-0000-4000-8000-000000000022',
      'drop',
      'staff@example.test',
      'w169:invalid-drop',
      'staff drop'
    );
    RAISE EXCEPTION 'w169_invalid_drop_reason_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'w169_invalid_drop_reason_allowed' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%pursuit_drop_reason_invalid%' THEN RAISE; END IF;
  END;
END;
$$;

SET ROLE service_role;
SELECT public.journey_transition_terminal(
  '16900000-0000-4000-8000-000000000022',
  'drop',
  'staff@example.test',
  'w169:valid-drop',
  'no_viable_match'
);
SELECT public.journey_transition_terminal(
  '16900000-0000-4000-8000-000000000022',
  'drop',
  'staff@example.test',
  'w169:valid-drop',
  'no_viable_match'
);
RESET ROLE;

DO $$
BEGIN
  IF (SELECT status FROM public.opportunities WHERE id = '16900000-0000-4000-8000-000000000004') <> 'active' THEN
    RAISE EXCEPTION 'w169_drop_changed_opportunity';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.opportunity_matches
    WHERE id = '16900000-0000-4000-8000-000000000022'
      AND status = 'dropped'
      AND pursuit_stage = 'dropped'
  ) THEN
    RAISE EXCEPTION 'w169_drop_changed_opportunity';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.opportunity_pursuit_evidence
    WHERE match_id = '16900000-0000-4000-8000-000000000022'
      AND event_type = 'dropped'
      AND evidence_reference = 'no_viable_match'
      AND idempotency_key = 'w169:valid-drop'
  ) THEN
    RAISE EXCEPTION 'w169_drop_reason_not_recorded';
  END IF;
  IF (
    SELECT count(*) FROM public.opportunity_pursuit_evidence
    WHERE match_id = '16900000-0000-4000-8000-000000000022'
      AND event_type = 'dropped'
      AND idempotency_key = 'w169:valid-drop'
  ) <> 1 THEN
    RAISE EXCEPTION 'w169_drop_retry_duplicated';
  END IF;
END;
$$;

SET ROLE service_role;
SELECT public.close_opportunity_with_reason(
  '16900000-0000-4000-8000-000000000003',
  'dd_disqualified',
  'staff@example.test'
);
RESET ROLE;

DO $$
BEGIN
  IF (SELECT status FROM public.opportunities WHERE id = '16900000-0000-4000-8000-000000000003') <> 'closed'
    OR NOT EXISTS (
      SELECT 1 FROM public.opportunity_closure_history
      WHERE opportunity_id = '16900000-0000-4000-8000-000000000003'
        AND reason = 'dd_disqualified'
    ) THEN
    RAISE EXCEPTION 'w169_permanent_close_not_recorded';
  END IF;
  IF (SELECT count(*) FROM public.opportunity_closure_history WHERE id = '16900000-0000-4000-8000-000000000031') <> 1 THEN
    RAISE EXCEPTION 'w169_historical_closure_changed';
  END IF;
  IF (SELECT count(*) FROM public.opportunity_pursuit_evidence WHERE id = '16900000-0000-4000-8000-000000000041') <> 1 THEN
    RAISE EXCEPTION 'w169_historical_drop_changed';
  END IF;
END;
$$;
SQL

echo "W-169 full-schema lifecycle outcome rehearsal passed"
