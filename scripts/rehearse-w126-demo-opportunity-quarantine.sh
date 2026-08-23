#!/usr/bin/env bash
set -euo pipefail

# Runs only against a disposable local PostgreSQL cluster. It never reads from
# or connects to project credentials or production.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
if [ ! -x "$pg_bin/initdb" ]; then pg_bin="/opt/homebrew/opt/postgresql@16/bin"; fi
cluster_dir="$(mktemp -d /private/tmp/renew-w126-demo-quarantine.XXXXXX)"
port="${W126_DEMO_REHEARSAL_PORT:-55442}"

cleanup() {
  if [ -f "$cluster_dir/postmaster.pid" ]; then "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true; fi
  rm -rf "$cluster_dir"
}
trap cleanup EXIT
for binary in initdb pg_ctl createdb psql; do
  [ -x "$pg_bin/$binary" ] || { echo "Missing PostgreSQL binary: $pg_bin/$binary" >&2; exit 1; }
done

"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 --auth-local=trust --auth-host=trust >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -o "-p $port -h 127.0.0.1" -w start >/dev/null
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" w126_demo_rehearsal
psql_base=("$pg_bin/psql" -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -d w126_demo_rehearsal)

# First prove the complete migration compiles against the sanctioned build-771
# schema, including every existing RPC dependency and exact function signature.
"${psql_base[@]}" -c "CREATE ROLE postgres NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;" >/dev/null
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" w126_full_schema
full_psql=("$pg_bin/psql" -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -d w126_full_schema)
"${full_psql[@]}" -c "CREATE SCHEMA extensions; CREATE SCHEMA auth; CREATE TABLE auth.users (id UUID PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS 'SELECT NULL::UUID';" >/dev/null
"${full_psql[@]}" --file "$repo_root/supabase/schema/771_extensions.sql" >/dev/null
"${full_psql[@]}" --file "$repo_root/supabase/schema/771_public_schema.sql" >/dev/null
"${full_psql[@]}" --file "$repo_root/scripts/112_demo_opportunity_quarantine.sql" >/dev/null
"${full_psql[@]}" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='opportunities'
      AND column_name='is_demo' AND is_nullable='NO' AND column_default='false'
  ) THEN RAISE EXCEPTION 'w126_full_schema_column_missing'; END IF;
  IF (
    SELECT COUNT(*)
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid=procedure.pronamespace
    WHERE namespace.nspname='public'
      AND procedure.proname IN (
        'apply_w126_demo_opportunity_quarantine',
        'express_opportunity_interest',
        'update_repreneur_opportunity_response',
        'journey_repreneur_can_access_confidential',
        'journey_repreneur_authorized_template',
        'journey_submit_repreneur_signed_copy',
        'claim_opportunity_memo_notification'
      )
  ) <> 7 THEN RAISE EXCEPTION 'w126_full_schema_rpc_mismatch'; END IF;
END $$;
SQL

"${psql_base[@]}" <<'SQL'
CREATE SCHEMA extensions;
CREATE TABLE public.rehearsal_fingerprints (id UUID PRIMARY KEY, fingerprint TEXT NOT NULL);
-- The disposable fixture has no confidential production titles. This digest
-- adapter maps each manifest identity to its preflight fingerprint, while the
-- migration's real production expression remains structurally asserted below.
CREATE FUNCTION extensions.digest(input BYTEA, algorithm TEXT) RETURNS BYTEA LANGUAGE plpgsql STABLE AS $$
DECLARE fingerprint TEXT;
BEGIN
  SELECT f.fingerprint INTO fingerprint
  FROM public.rehearsal_fingerprints f
  WHERE f.id::TEXT = split_part(convert_from(input, 'UTF8'), '|', 1);
  RETURN decode(COALESCE(fingerprint, repeat('0',64)), 'hex');
END $$;
CREATE TABLE public.opportunities (id UUID PRIMARY KEY, reference TEXT NOT NULL, public_title TEXT, updated_at TIMESTAMPTZ NOT NULL, updated_by TEXT, is_demo BOOLEAN NOT NULL DEFAULT FALSE);
CREATE TABLE public.opportunity_matches (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), opportunity_id UUID NOT NULL REFERENCES public.opportunities(id), status TEXT NOT NULL);
CREATE TABLE public.opportunity_documents (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), opportunity_id UUID NOT NULL REFERENCES public.opportunities(id));
CREATE TABLE public.opportunity_nda_artifacts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), opportunity_id UUID NOT NULL REFERENCES public.opportunities(id));
SQL

# Reuse the exact committed manifest literals; no candidate title/reference
# discovery query is used by the migration or the rehearsal.
"${psql_base[@]}" <<'SQL'
CREATE TABLE public.rehearsal_manifest (id UUID PRIMARY KEY, reference TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL, fingerprint TEXT NOT NULL, expected_matches INTEGER NOT NULL, expected_active_pursuits INTEGER NOT NULL, expected_documents INTEGER NOT NULL, expected_artifacts INTEGER NOT NULL);
SQL
sed -n '/INSERT INTO w126_manifest VALUES/,/;$/p' "$repo_root/scripts/112_demo_opportunity_quarantine.sql" | sed '1s/INSERT INTO w126_manifest VALUES/INSERT INTO public.rehearsal_manifest VALUES/' | "${psql_base[@]}"
"${psql_base[@]}" <<'SQL'
INSERT INTO public.rehearsal_fingerprints SELECT id, fingerprint FROM public.rehearsal_manifest;
INSERT INTO public.opportunities(id,reference,public_title,updated_at)
SELECT id,reference,'fixture title',updated_at FROM public.rehearsal_manifest;
INSERT INTO public.opportunities(id,reference,public_title,updated_at)
VALUES ('ffffffff-ffff-4fff-8fff-ffffffffffff','DEMO text is not a classification','DEMO text is not a classification','2026-08-23T00:00:00Z');
INSERT INTO public.opportunity_matches(opportunity_id,status)
SELECT m.id, CASE WHEN n <= m.expected_active_pursuits THEN 'active_pursuit' ELSE 'completed' END FROM public.rehearsal_manifest m CROSS JOIN LATERAL generate_series(1,m.expected_matches) n;
INSERT INTO public.opportunity_documents(opportunity_id)
SELECT m.id FROM public.rehearsal_manifest m CROSS JOIN LATERAL generate_series(1,m.expected_documents);
INSERT INTO public.opportunity_nda_artifacts(opportunity_id)
SELECT m.id FROM public.rehearsal_manifest m CROSS JOIN LATERAL generate_series(1,m.expected_artifacts);
SQL
awk '/^ALTER TABLE public.opportunities/{print; getline; print} /^CREATE OR REPLACE FUNCTION public.apply_w126_demo_opportunity_quarantine/{on=1} on{print} on && /^\$\$;/{exit}' "$repo_root/scripts/112_demo_opportunity_quarantine.sql" | "${psql_base[@]}"
"${psql_base[@]}" <<'SQL'
DO $$
DECLARE result RECORD;
BEGIN
  SELECT * INTO result FROM public.apply_w126_demo_opportunity_quarantine('local-rehearsal');
  IF result.classified_rows <> 24 OR result.active_pursuit_rows <> 9 THEN RAISE EXCEPTION 'w126_success_result_mismatch'; END IF;
  IF (SELECT count(*) FROM public.opportunities WHERE is_demo) <> 24 THEN RAISE EXCEPTION 'w126_exact_classification_failed'; END IF;
  IF (SELECT is_demo FROM public.opportunities WHERE id='ffffffff-ffff-4fff-8fff-ffffffffffff') THEN RAISE EXCEPTION 'w126_label_inference_detected'; END IF;
  IF (SELECT count(*) FROM public.opportunity_matches) <> 45 OR (SELECT count(*) FROM public.opportunity_documents) <> 17 OR (SELECT count(*) FROM public.opportunity_nda_artifacts) <> 11 THEN RAISE EXCEPTION 'w126_lifecycle_history_changed'; END IF;
  UPDATE public.opportunities SET is_demo=FALSE;
  UPDATE public.opportunities SET updated_at=updated_at+INTERVAL '1 second' WHERE id=(SELECT id FROM public.rehearsal_manifest ORDER BY id LIMIT 1);
  BEGIN PERFORM public.apply_w126_demo_opportunity_quarantine('local-drift'); RAISE EXCEPTION 'w126_drift_was_accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%w126_demo_quarantine_manifest_drift%' THEN RAISE; END IF; END;
  IF EXISTS(SELECT 1 FROM public.opportunities WHERE is_demo) THEN RAISE EXCEPTION 'w126_drift_was_not_atomic'; END IF;
  UPDATE public.opportunities opportunity SET updated_at=manifest.updated_at FROM public.rehearsal_manifest manifest WHERE manifest.id=opportunity.id;
  DELETE FROM public.opportunities WHERE id=(SELECT id FROM public.rehearsal_manifest WHERE expected_matches=0 LIMIT 1);
  BEGIN PERFORM public.apply_w126_demo_opportunity_quarantine('local-cardinality'); RAISE EXCEPTION 'w126_cardinality_was_accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%w126_demo_quarantine_identity_mismatch%' THEN RAISE; END IF; END;
END $$;
SQL
rg -q "concat_ws\('|',o.id,o.reference,COALESCE\(o.public_title,''\)" "$repo_root/scripts/112_demo_opportunity_quarantine.sql"
echo "W-126 DEMO quarantine local rehearsal passed"
