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
        'w126_demo_opportunity_manifest',
        'apply_w126_demo_opportunity_quarantine',
        'rollback_w126_demo_opportunity_quarantine',
        'express_opportunity_interest',
        'update_repreneur_opportunity_response',
        'journey_repreneur_can_access_confidential',
        'journey_repreneur_authorized_template',
        'journey_submit_repreneur_signed_copy',
        'claim_opportunity_memo_notification'
      )
  ) <> 9 THEN RAISE EXCEPTION 'w126_full_schema_rpc_mismatch'; END IF;
END $$;
SQL

# Execute the exact portal response function against the smallest disposable
# schema that exercises its write path. Compiling the function is insufficient:
# PL/pgSQL can defer ambiguous column errors until the first invocation.
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" w126_response_rehearsal
response_psql=("$pg_bin/psql" -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -d w126_response_rehearsal)
"${response_psql[@]}" <<'SQL'
CREATE TABLE public.opportunities (
  id UUID PRIMARY KEY,
  status TEXT NOT NULL,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE public.opportunity_matches (
  id UUID PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id),
  repreneur_id UUID NOT NULL,
  status TEXT NOT NULL,
  decline_reason_categories TEXT[] NOT NULL DEFAULT '{}',
  decline_reason_text TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ
);
INSERT INTO public.opportunities(id,status,is_demo)
VALUES ('20000000-0000-4000-8000-000000000126','active',FALSE);
INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status)
VALUES (
  '30000000-0000-4000-8000-000000000126',
  '20000000-0000-4000-8000-000000000126',
  '10000000-0000-4000-8000-000000000126',
  'proposed'
);
SQL
awk '
  /^CREATE OR REPLACE FUNCTION public\.update_repreneur_opportunity_response\(/ { capture=1 }
  capture { print }
  capture && /^END \$\$;$/ { exit }
' "$repo_root/scripts/112_demo_opportunity_quarantine.sql" | "${response_psql[@]}"
"${response_psql[@]}" -c "SELECT * FROM public.update_repreneur_opportunity_response('30000000-0000-4000-8000-000000000126','10000000-0000-4000-8000-000000000126','interested');" >/dev/null
"${response_psql[@]}" -Atq -c "SELECT status FROM public.opportunity_matches WHERE id='30000000-0000-4000-8000-000000000126';" | grep -qx interested || {
  echo 'w126_portal_response_write_failed' >&2
  exit 1
}

if rg -n -i '^\s*(BEGIN|COMMIT|ROLLBACK)(\s+TRANSACTION)?\s*;\s*$|^\s*SAVEPOINT\s+\S+\s*;\s*$' "$repo_root/scripts/112_demo_opportunity_quarantine.sql"; then
  echo 'w126_migration_transaction_control_forbidden' >&2
  exit 1
fi

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
CREATE FUNCTION public.rehearsal_opportunity_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := clock_timestamp(); RETURN NEW; END $$;
CREATE TRIGGER rehearsal_opportunity_updated_at BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.rehearsal_opportunity_updated_at();
SQL

# Install the isolated W-126 helpers only. The fixture imports its values from
# the one shared manifest function, so apply and rollback cannot silently split.
awk '/^ALTER TABLE public.opportunities/{print; getline; print} /^CREATE OR REPLACE FUNCTION public.w126_demo_opportunity_manifest/{on=1} /^-- The latest exact-match/{exit} on{print}' "$repo_root/scripts/112_demo_opportunity_quarantine.sql" | "${psql_base[@]}"
"${psql_base[@]}" <<'SQL'
CREATE TABLE public.rehearsal_manifest AS SELECT * FROM public.w126_demo_opportunity_manifest();
ALTER TABLE public.rehearsal_manifest ADD PRIMARY KEY (id);
SQL
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
"${psql_base[@]}" <<'SQL'
DO $$
DECLARE result RECORD; manifest_id UUID; deleted_match_id UUID; deleted_match_opportunity_id UUID; deleted_match_status TEXT;
BEGIN
  SELECT * INTO result FROM public.apply_w126_demo_opportunity_quarantine('local-rehearsal');
  IF result.classified_rows <> 24 OR result.active_pursuit_rows <> 9 THEN RAISE EXCEPTION 'w126_success_result_mismatch'; END IF;
  IF (SELECT count(*) FROM public.opportunities WHERE is_demo) <> 24 THEN RAISE EXCEPTION 'w126_exact_classification_failed'; END IF;
  IF (SELECT count(*) FROM public.opportunities WHERE is_demo AND updated_by='local-rehearsal') <> 24 THEN RAISE EXCEPTION 'w126_apply_actor_missing'; END IF;
  -- The real-style trigger changed updated_at; retry must return success without
  -- reapplying or treating the expected timestamp shift as manifest drift.
  SELECT * INTO result FROM public.apply_w126_demo_opportunity_quarantine('local-rehearsal');
  IF result.classified_rows <> 24 THEN RAISE EXCEPTION 'w126_retry_not_idempotent'; END IF;
  DELETE FROM public.opportunity_matches
  WHERE id=(SELECT id FROM public.opportunity_matches ORDER BY id LIMIT 1)
  RETURNING id,opportunity_id,status INTO deleted_match_id,deleted_match_opportunity_id,deleted_match_status;
  BEGIN PERFORM public.apply_w126_demo_opportunity_quarantine('local-rehearsal'); RAISE EXCEPTION 'w126_retry_dependent_drift_accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%w126_demo_quarantine_retry_manifest_drift%' THEN RAISE; END IF; END;
  INSERT INTO public.opportunity_matches(id,opportunity_id,status) VALUES(deleted_match_id,deleted_match_opportunity_id,deleted_match_status);
  BEGIN PERFORM public.apply_w126_demo_opportunity_quarantine('wrong-apply-actor'); RAISE EXCEPTION 'w126_apply_actor_drift_accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%w126_demo_quarantine_apply_actor_drift%' THEN RAISE; END IF; END;
  IF (SELECT is_demo FROM public.opportunities WHERE id='ffffffff-ffff-4fff-8fff-ffffffffffff') THEN RAISE EXCEPTION 'w126_label_inference_detected'; END IF;
  IF (SELECT count(*) FROM public.opportunity_matches) <> 45 OR (SELECT count(*) FROM public.opportunity_documents) <> 17 OR (SELECT count(*) FROM public.opportunity_nda_artifacts) <> 11 THEN RAISE EXCEPTION 'w126_lifecycle_history_changed'; END IF;
  SELECT id INTO manifest_id FROM public.rehearsal_manifest ORDER BY id LIMIT 1;
  UPDATE public.opportunities SET is_demo=FALSE WHERE id=manifest_id;
  BEGIN PERFORM public.apply_w126_demo_opportunity_quarantine('local-mixed'); RAISE EXCEPTION 'w126_mixed_was_accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%w126_demo_quarantine_mixed_state%' THEN RAISE; END IF; END;
  IF (SELECT count(*) FROM public.opportunities WHERE is_demo) <> 23 THEN RAISE EXCEPTION 'w126_mixed_was_not_atomic'; END IF;
  UPDATE public.opportunities SET is_demo=TRUE, updated_by='local-rehearsal' WHERE id=manifest_id;
  SELECT * INTO result FROM public.rollback_w126_demo_opportunity_quarantine('local-rehearsal','local-rollback');
  IF result.rolled_back_rows <> 24 OR (SELECT count(*) FROM public.opportunities WHERE is_demo) <> 0 THEN RAISE EXCEPTION 'w126_rollback_failed'; END IF;
  SELECT * INTO result FROM public.rollback_w126_demo_opportunity_quarantine('local-rehearsal','local-rollback');
  IF result.rolled_back_rows <> 24 THEN RAISE EXCEPTION 'w126_rollback_not_idempotent'; END IF;
  BEGIN PERFORM public.rollback_w126_demo_opportunity_quarantine('local-rehearsal','wrong-rollback-actor'); RAISE EXCEPTION 'w126_rollback_state_drift_accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%w126_demo_quarantine_rollback_state_drift%' THEN RAISE; END IF; END;
  UPDATE public.opportunities SET is_demo=TRUE, updated_by='local-rehearsal';
  UPDATE public.opportunities SET updated_by='wrong-actor' WHERE id=manifest_id;
  BEGIN PERFORM public.rollback_w126_demo_opportunity_quarantine('local-rehearsal','local-rollback'); RAISE EXCEPTION 'w126_rollback_actor_drift_accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%w126_demo_quarantine_rollback_apply_actor_drift%' THEN RAISE; END IF; END;
  IF NOT (SELECT is_demo FROM public.opportunities WHERE id=manifest_id) THEN RAISE EXCEPTION 'w126_rollback_actor_drift_not_atomic'; END IF;
  UPDATE public.opportunities SET updated_by='local-rehearsal' WHERE id=manifest_id;
  DELETE FROM public.opportunity_matches
  WHERE id=(SELECT id FROM public.opportunity_matches ORDER BY id LIMIT 1)
  RETURNING id,opportunity_id,status INTO deleted_match_id,deleted_match_opportunity_id,deleted_match_status;
  BEGIN PERFORM public.rollback_w126_demo_opportunity_quarantine('local-rehearsal','local-rollback'); RAISE EXCEPTION 'w126_rollback_dependent_drift_accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%w126_demo_quarantine_rollback_manifest_drift%' THEN RAISE; END IF; END;
  INSERT INTO public.opportunity_matches(id,opportunity_id,status) VALUES(deleted_match_id,deleted_match_opportunity_id,deleted_match_status);
  UPDATE public.opportunities SET reference='drifted-reference' WHERE id=manifest_id;
  BEGIN PERFORM public.rollback_w126_demo_opportunity_quarantine('local-rehearsal','local-rollback'); RAISE EXCEPTION 'w126_rollback_manifest_drift_accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%w126_demo_quarantine_rollback_manifest_drift%' THEN RAISE; END IF; END;
  IF NOT (SELECT is_demo FROM public.opportunities WHERE id=manifest_id) THEN RAISE EXCEPTION 'w126_rollback_manifest_drift_not_atomic'; END IF;
  UPDATE public.opportunities SET reference=manifest.reference FROM public.rehearsal_manifest manifest WHERE manifest.id=public.opportunities.id;
  UPDATE public.opportunities SET is_demo=FALSE WHERE id=manifest_id;
  IF (SELECT is_demo FROM public.opportunities WHERE id=manifest_id) THEN RAISE EXCEPTION 'w126_rollback_mixed_fixture_not_set'; END IF;
  BEGIN PERFORM public.rollback_w126_demo_opportunity_quarantine('local-rehearsal','local-rollback'); RAISE EXCEPTION 'w126_rollback_mixed_accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%w126_demo_quarantine_rollback_mixed_state%' THEN RAISE; END IF; END;
  UPDATE public.opportunities SET is_demo=FALSE;
  -- Restore pinned timestamps so the all-false path reaches fingerprint drift.
  ALTER TABLE public.opportunities DISABLE TRIGGER rehearsal_opportunity_updated_at;
  UPDATE public.opportunities opportunity SET updated_at=manifest.updated_at FROM public.rehearsal_manifest manifest WHERE manifest.id=opportunity.id;
  ALTER TABLE public.opportunities ENABLE TRIGGER rehearsal_opportunity_updated_at;
  UPDATE public.opportunities SET updated_at=updated_at+INTERVAL '1 second' WHERE id=manifest_id;
  BEGIN PERFORM public.apply_w126_demo_opportunity_quarantine('local-drift'); RAISE EXCEPTION 'w126_drift_was_accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%w126_demo_quarantine_manifest_drift%' THEN RAISE; END IF; END;
  IF EXISTS(SELECT 1 FROM public.opportunities WHERE is_demo) THEN RAISE EXCEPTION 'w126_drift_was_not_atomic'; END IF;
  UPDATE public.opportunities opportunity SET updated_at=manifest.updated_at FROM public.rehearsal_manifest manifest WHERE manifest.id=opportunity.id;
  DELETE FROM public.opportunities WHERE id=(SELECT id FROM public.rehearsal_manifest WHERE expected_matches=0 LIMIT 1);
  BEGIN PERFORM public.apply_w126_demo_opportunity_quarantine('local-cardinality'); RAISE EXCEPTION 'w126_cardinality_was_accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%w126_demo_quarantine_identity_mismatch%' THEN RAISE; END IF; END;
END $$;
SQL
rg -q "concat_ws\('|',o.id,o.reference,COALESCE\(o.public_title,''\)" "$repo_root/scripts/112_demo_opportunity_quarantine.sql"
echo "W-126 DEMO quarantine local rehearsal passed"
