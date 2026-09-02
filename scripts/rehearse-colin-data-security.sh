#!/usr/bin/env bash
set -euo pipefail

# Disposable-only rehearsal for the Colin data/security migration. It never
# reads project environment files or connects to a remote database.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
if [ ! -x "$pg_bin/initdb" ]; then pg_bin="/opt/homebrew/opt/postgresql@16/bin"; fi
cluster_dir="$(mktemp -d "${TMPDIR:-/tmp}/renew-colin-data-security.XXXXXX")"
port="${COLIN_DATA_SECURITY_REHEARSAL_PORT:-55492}"

cleanup() {
  [ ! -f "$cluster_dir/postmaster.pid" ] || "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$cluster_dir"
}
trap cleanup EXIT

for binary in initdb pg_ctl createdb psql; do
  [ -x "$pg_bin/$binary" ] || { echo "Missing PostgreSQL binary: $pg_bin/$binary" >&2; exit 1; }
done

"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 --auth-local=trust --auth-host=trust --username=renew_rehearsal_admin >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -l "$cluster_dir/postgres.log" -o "-p $port -h 127.0.0.1 -k $cluster_dir" -w start >/dev/null
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" -U renew_rehearsal_admin colin_data_security_rehearsal
psql=("$pg_bin/psql" -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -U renew_rehearsal_admin -d colin_data_security_rehearsal)

"${psql[@]}" -c "CREATE ROLE postgres NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN; CREATE SCHEMA extensions; CREATE SCHEMA auth; CREATE TABLE auth.users (id UUID PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS 'SELECT NULL::UUID';" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/schema/771_extensions.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/schema/771_public_schema.sql" >/dev/null
"${psql[@]}" --file "$repo_root/scripts/112_demo_opportunity_quarantine.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/migrations/20260825190000_w021_controlled_opportunity_publication.sql" >/dev/null
"${psql[@]}" --file "$repo_root/scripts/115_w128_draft_opportunity_activation.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/migrations/20260902202154_colin_data_security_corrections.sql" >/dev/null

"${psql[@]}" <<'SQL'
DO $$
BEGIN
  IF COALESCE(current_setting('renew.colin_data_correction_apply', true), '') = '2026-09-02-apply'
     OR COALESCE(current_setting('renew.colin_data_correction_rollback', true), '') = '2026-09-02-rollback' THEN
    RAISE EXCEPTION 'colin_default_mode_is_not_safe';
  END IF;
END;
$$;

SQL

"${psql[@]}" -c "ALTER TABLE public.opportunities DISABLE TRIGGER enforce_ma_provisional_source_review_on_opportunity; INSERT INTO public.opportunities(reference, status, description, source_identity_to_verify) VALUES ('COLIN-FLAGGED-REHEARSAL', 'draft', 'Synthetic rehearsal only', TRUE), ('COLIN-UNFLAGGED-REHEARSAL', 'draft', 'Synthetic rehearsal only', FALSE);" >/dev/null
"${psql[@]}" -c "ALTER TABLE public.opportunities ENABLE TRIGGER enforce_ma_provisional_source_review_on_opportunity;" >/dev/null

"${psql[@]}" <<'SQL'
DO $$
DECLARE flagged UUID;
BEGIN
  SELECT id INTO flagged FROM public.opportunities WHERE reference = 'COLIN-FLAGGED-REHEARSAL';

  IF NOT public.ma_opportunity_source_review_required(flagged) THEN
    RAISE EXCEPTION 'colin_generic_source_flag_did_not_gate';
  END IF;

  BEGIN
    UPDATE public.opportunities SET status = 'closed' WHERE id = flagged;
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'colin_flagged_lifecycle_exit_was_allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ma_provisional_source_review_blocks_opportunity_lifecycle_exit' THEN RAISE; END IF;
  END;
END;
$$;

DO $$
DECLARE missing_rls INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_rls
  FROM pg_class relation
  JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname IN ('w021_opportunity_publication_events','w021_opportunity_publication_runs','w021_opportunity_publication_rollbacks','w128_draft_activation_runs','w128_draft_activation_rollbacks')
    AND NOT relation.relrowsecurity;
  IF missing_rls <> 0 THEN RAISE EXCEPTION 'colin_audit_rls_missing:%', missing_rls; END IF;
END;
$$;
SQL

echo "Colin data/security disposable rehearsal passed."
