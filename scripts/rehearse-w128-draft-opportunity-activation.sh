#!/usr/bin/env bash
set -euo pipefail

# This creates a disposable local full-schema cluster. It never loads project
# credentials and never connects to a remote database.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
if [ ! -x "$pg_bin/initdb" ]; then pg_bin="/opt/homebrew/opt/postgresql@16/bin"; fi
cluster_dir="$(mktemp -d /private/tmp/renew-w128-draft-activation.XXXXXX)"
port="${W128_DRAFT_ACTIVATION_REHEARSAL_PORT:-55447}"

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
"${psql[@]}" --file "$repo_root/scripts/113_w128_draft_opportunity_activation.sql" >/dev/null

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
INSERT INTO public.opportunities(id, reference, status, source_office_id, description, repreneur_exposure, source_visibility, is_demo, created_by)
VALUES
  ('00000000-0000-4000-8000-000000001132', 'W128-VALID', 'draft', '00000000-0000-4000-8000-000000001129', 'Valid fixture', 'staff_only', 'staff_only', FALSE, 'w128-rehearsal'),
  ('00000000-0000-4000-8000-000000001133', 'W128-DEMO', 'draft', '00000000-0000-4000-8000-000000001129', 'Demo fixture', 'staff_only', 'staff_only', TRUE, 'w128-rehearsal');
INSERT INTO public.opportunity_ma_contacts(id, opportunity_id, affiliation_id, is_primary, is_active, linked_by)
VALUES
  ('00000000-0000-4000-8000-000000001134', '00000000-0000-4000-8000-000000001132', '00000000-0000-4000-8000-000000001131', TRUE, TRUE, 'w128-rehearsal'),
  ('00000000-0000-4000-8000-000000001135', '00000000-0000-4000-8000-000000001133', '00000000-0000-4000-8000-000000001131', TRUE, TRUE, 'w128-rehearsal');

DO $$
DECLARE manifest JSONB; digest TEXT; result RECORD;
BEGIN
  SELECT JSONB_AGG(JSONB_BUILD_OBJECT('ordinal', ordinal, 'id', id, 'reference', reference, 'updated_at', updated_at, 'fingerprint', fingerprint) ORDER BY ordinal)
  INTO manifest FROM public.w128_draft_activation_preflight() WHERE eligible;
  SELECT ENCODE(extensions.digest(CONVERT_TO(STRING_AGG(CONCAT_WS('|', ordinal, id, reference, TO_CHAR(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), fingerprint), E'\n' ORDER BY ordinal), 'UTF8'), 'sha256'), 'hex')
  INTO digest FROM public.w128_draft_activation_preflight() WHERE eligible;
  SELECT * INTO result FROM public.apply_w128_draft_activation(manifest, digest, 'w128-rehearsal');
  IF result.activated_count <> 1 THEN RAISE EXCEPTION 'w128_activation_count_mismatch'; END IF;
  IF (SELECT status FROM public.opportunities WHERE id='00000000-0000-4000-8000-000000001132') <> 'active' THEN RAISE EXCEPTION 'w128_valid_row_not_activated'; END IF;
  IF (SELECT status FROM public.opportunities WHERE id='00000000-0000-4000-8000-000000001133') <> 'draft' THEN RAISE EXCEPTION 'w128_demo_row_changed'; END IF;
  IF (SELECT repreneur_exposure FROM public.opportunities WHERE id='00000000-0000-4000-8000-000000001132') <> 'staff_only' THEN RAISE EXCEPTION 'w128_exposure_changed'; END IF;
  IF (SELECT count(*) FROM public.opportunity_matches) <> 0 THEN RAISE EXCEPTION 'w128_match_state_changed'; END IF;
  IF (SELECT count(*) FROM public.w128_draft_activation_runs) <> 1 THEN RAISE EXCEPTION 'w128_audit_missing'; END IF;
END $$;
SQL

"${psql[@]}" --file "$repo_root/scripts/run-w128-draft-activation-preflight.sql" >/dev/null

"$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null
echo "W-128 Draft activation full-schema rehearsal passed"
