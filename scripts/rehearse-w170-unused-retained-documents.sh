#!/usr/bin/env bash
set -euo pipefail

# W-170 full-schema rehearsal. It uses deterministic synthetic records in a
# disposable local PostgreSQL cluster and never reads project credentials.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
if [ ! -x "$pg_bin/initdb" ]; then pg_bin="/opt/homebrew/opt/postgresql@16/bin"; fi
cluster_dir="$(mktemp -d "${TMPDIR:-/tmp}/renew-w170-rehearsal.XXXXXX")"
port="${W170_REHEARSAL_PORT:-55473}"
database_superuser="renew_w170_rehearsal_admin"

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
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" -U "$database_superuser" w170_rehearsal
psql=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -U "$database_superuser" -d w170_rehearsal)

"${psql[@]}" -c "CREATE ROLE postgres NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS; CREATE SCHEMA extensions; CREATE SCHEMA auth; CREATE TABLE auth.users (id UUID PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS 'SELECT NULL::UUID';" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/schema/771_extensions.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/schema/771_public_schema.sql" >/dev/null
"${psql[@]}" --single-transaction --file "$repo_root/supabase/migrations/20260829123000_w170_unused_retained_document_correction.sql" >/dev/null

# The fixture is inserted with baseline lifecycle guards suspended; the tested
# delete/update triggers and the W-170 functions remain live for every check.
"${psql[@]}" <<'SQL' >/dev/null
SET session_replication_role = replica;
INSERT INTO public.opportunities (id, reference, status, created_by) VALUES
  ('17000000-0000-4000-8000-000000000001', 'W170-A', 'draft', 'w170-fixture'),
  ('17000000-0000-4000-8000-000000000002', 'W170-B', 'draft', 'w170-fixture');
INSERT INTO public.repreneurs (id, email, first_name, last_name, created_by) VALUES
  ('17000000-0000-4000-8000-000000000011', 'w170@example.test', 'W170', 'Repreneur', 'w170-fixture');
INSERT INTO public.ma_firms (id, name, status, created_by) VALUES
  ('17000000-0000-4000-8000-000000000021', 'W170 Firm', 'active', 'w170-fixture');
INSERT INTO public.ma_offices (id, firm_id, name, status, created_by) VALUES
  ('17000000-0000-4000-8000-000000000022', '17000000-0000-4000-8000-000000000021', 'W170 Office', 'active', 'w170-fixture');
INSERT INTO public.opportunity_matches (id, opportunity_id, repreneur_id, created_by) VALUES
  ('17000000-0000-4000-8000-000000000031', '17000000-0000-4000-8000-000000000001', '17000000-0000-4000-8000-000000000011', 'w170-fixture');
INSERT INTO public.opportunity_documents (id, opportunity_id, title, document_type, visibility, storage_bucket, storage_path, uploaded_by) VALUES
  ('17000000-0000-4000-8000-000000000101', '17000000-0000-4000-8000-000000000001', 'Unused IM', 'deal_book', 'staff_only', 'opportunity-documents', '17000000-0000-4000-8000-000000000001/unused-im.pdf', 'w170-fixture'),
  ('17000000-0000-4000-8000-000000000102', '17000000-0000-4000-8000-000000000001', 'Granted IM', 'deal_book', 'staff_only', 'opportunity-documents', '17000000-0000-4000-8000-000000000001/granted-im.pdf', 'w170-fixture'),
  ('17000000-0000-4000-8000-000000000103', '17000000-0000-4000-8000-000000000001', 'Source teaser', 'source_teaser', 'staff_only', 'opportunity-documents', '17000000-0000-4000-8000-000000000001/source.pdf', 'w170-fixture'),
  ('17000000-0000-4000-8000-000000000104', '17000000-0000-4000-8000-000000000001', 'NDA v1', 'nda', 'staff_only', 'opportunity-documents', '17000000-0000-4000-8000-000000000001/nda-artifacts/blank_template/v1.pdf', 'w170-fixture'),
  ('17000000-0000-4000-8000-000000000105', '17000000-0000-4000-8000-000000000001', 'NDA v2', 'nda', 'staff_only', 'opportunity-documents', '17000000-0000-4000-8000-000000000001/nda-artifacts/blank_template/v2.pdf', 'w170-fixture'),
  ('17000000-0000-4000-8000-000000000106', '17000000-0000-4000-8000-000000000001', 'Evidence IM', 'deal_book', 'staff_only', 'opportunity-documents', '17000000-0000-4000-8000-000000000001/evidence-im.pdf', 'w170-fixture'),
  ('17000000-0000-4000-8000-000000000107', '17000000-0000-4000-8000-000000000001', 'Legacy NDA', 'nda', 'staff_only', 'opportunity-documents', '17000000-0000-4000-8000-000000000001/nda-artifacts/renew_signed_copy/legacy.pdf', 'w170-fixture');
INSERT INTO public.opportunity_nda_artifacts (id, opportunity_id, match_id, document_id, artifact_role, version_number, content_sha256, supersedes_artifact_id, recorded_by) VALUES
  ('17000000-0000-4000-8000-000000000201', '17000000-0000-4000-8000-000000000001', NULL, '17000000-0000-4000-8000-000000000104', 'blank_template', 1, repeat('a', 64), NULL, 'w170-fixture'),
  ('17000000-0000-4000-8000-000000000202', '17000000-0000-4000-8000-000000000001', NULL, '17000000-0000-4000-8000-000000000105', 'blank_template', 2, repeat('b', 64), '17000000-0000-4000-8000-000000000201', 'w170-fixture'),
  ('17000000-0000-4000-8000-000000000203', '17000000-0000-4000-8000-000000000001', '17000000-0000-4000-8000-000000000031', '17000000-0000-4000-8000-000000000107', 'renew_signed_copy', 1, repeat('c', 64), NULL, 'w170-fixture');
UPDATE public.opportunity_matches SET nda_document_id='17000000-0000-4000-8000-000000000107' WHERE id='17000000-0000-4000-8000-000000000031';
INSERT INTO public.opportunity_pursuit_confidential_grants (id, match_id, opportunity_id, information_memo_document_id, source_firm_id, source_firm_name, source_office_id, source_office_name, granted_by) VALUES
  ('17000000-0000-4000-8000-000000000301', '17000000-0000-4000-8000-000000000031', '17000000-0000-4000-8000-000000000001', '17000000-0000-4000-8000-000000000102', '17000000-0000-4000-8000-000000000021', 'W170 Firm', '17000000-0000-4000-8000-000000000022', 'W170 Office', 'w170-fixture');
INSERT INTO public.opportunity_pursuit_evidence (id, match_id, opportunity_id, repreneur_id, event_type, actor, document_id, idempotency_key) VALUES
  ('17000000-0000-4000-8000-000000000401', '17000000-0000-4000-8000-000000000031', '17000000-0000-4000-8000-000000000001', '17000000-0000-4000-8000-000000000011', 'confidential_access_granted', 'w170-fixture', '17000000-0000-4000-8000-000000000106', 'w170-evidence');
RESET session_replication_role;
SQL

"${psql[@]}" <<'SQL'
DO $$
BEGIN
  IF NOT has_function_privilege('service_role', 'public.remove_unused_retained_opportunity_document(uuid,uuid)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.remove_unused_retained_opportunity_document(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'w170_service_role_grant_failed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.opportunity_documents'::regclass AND NOT tgisinternal AND pg_get_triggerdef(oid) LIKE '%BEFORE DELETE OR UPDATE%')
    OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.opportunity_nda_artifacts'::regclass AND NOT tgisinternal AND pg_get_triggerdef(oid) LIKE '%BEFORE DELETE OR UPDATE%') THEN
    RAISE EXCEPTION 'w170_real_delete_update_trigger_configuration_missing';
  END IF;
END;
$$;

DO $$
DECLARE doc_id UUID;
BEGIN
  FOREACH doc_id IN ARRAY ARRAY[
    '17000000-0000-4000-8000-000000000102'::UUID,
    '17000000-0000-4000-8000-000000000103'::UUID,
    '17000000-0000-4000-8000-000000000104'::UUID,
    '17000000-0000-4000-8000-000000000106'::UUID,
    '17000000-0000-4000-8000-000000000107'::UUID
  ] LOOP
    BEGIN
      PERFORM * FROM public.remove_unused_retained_opportunity_document('17000000-0000-4000-8000-000000000001', doc_id);
      RAISE EXCEPTION 'w170_used_or_retained_document_was_removed';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM='w170_used_or_retained_document_was_removed' THEN RAISE; END IF;
    END;
  END LOOP;
END;
$$;

UPDATE public.opportunity_documents SET storage_bucket='wrong-bucket' WHERE id='17000000-0000-4000-8000-000000000101';
DO $$ BEGIN BEGIN PERFORM * FROM public.remove_unused_retained_opportunity_document('17000000-0000-4000-8000-000000000001','17000000-0000-4000-8000-000000000101'); RAISE EXCEPTION 'w170_wrong_bucket_allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='w170_wrong_bucket_allowed' THEN RAISE; END IF; END; END $$;
UPDATE public.opportunity_documents SET storage_bucket='opportunity-documents', storage_path='17000000-0000-4000-8000-000000000002/cross.pdf' WHERE id='17000000-0000-4000-8000-000000000101';
DO $$ BEGIN BEGIN PERFORM * FROM public.remove_unused_retained_opportunity_document('17000000-0000-4000-8000-000000000001','17000000-0000-4000-8000-000000000101'); RAISE EXCEPTION 'w170_cross_path_allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='w170_cross_path_allowed' THEN RAISE; END IF; END; END $$;
UPDATE public.opportunity_documents SET storage_path='17000000-0000-4000-8000-000000000001/unused-im.pdf' WHERE id='17000000-0000-4000-8000-000000000101';
BEGIN;
SELECT set_config('app.allow_unused_retained_document_removal', 'on', true);
UPDATE public.opportunity_documents SET storage_path='17000000-0000-4000-8000-000000000001/nda-artifacts/renew_signed_copy/wrong-role.pdf' WHERE id='17000000-0000-4000-8000-000000000105';
COMMIT;
DO $$ BEGIN BEGIN PERFORM * FROM public.remove_unused_retained_opportunity_document('17000000-0000-4000-8000-000000000001','17000000-0000-4000-8000-000000000105'); RAISE EXCEPTION 'w170_wrong_nda_role_allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='w170_wrong_nda_role_allowed' THEN RAISE; END IF; END; END $$;
BEGIN;
SELECT set_config('app.allow_unused_retained_document_removal', 'on', true);
UPDATE public.opportunity_documents SET storage_path='17000000-0000-4000-8000-000000000001/nda-artifacts/blank_template/v2.pdf' WHERE id='17000000-0000-4000-8000-000000000105';
COMMIT;
DO $$ BEGIN BEGIN PERFORM * FROM public.remove_unused_retained_opportunity_document('17000000-0000-4000-8000-000000000002','17000000-0000-4000-8000-000000000101'); RAISE EXCEPTION 'w170_cross_opportunity_allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='w170_cross_opportunity_allowed' THEN RAISE; END IF; END; END $$;

SET ROLE service_role;
SELECT * FROM public.remove_unused_retained_opportunity_document('17000000-0000-4000-8000-000000000001','17000000-0000-4000-8000-000000000101');
RESET ROLE;

DO $$
DECLARE im_receipt UUID; im_retry UUID; nda_receipt UUID;
BEGIN
  SELECT id INTO im_receipt FROM public.opportunity_document_storage_cleanup_receipts WHERE document_id='17000000-0000-4000-8000-000000000101';
  SELECT cleanup_id INTO im_retry FROM public.remove_unused_retained_opportunity_document('17000000-0000-4000-8000-000000000001','17000000-0000-4000-8000-000000000101');
  IF im_receipt IS NULL OR im_receipt <> im_retry THEN RAISE EXCEPTION 'w170_stale_retry_not_idempotent'; END IF;
  SELECT cleanup_id INTO nda_receipt FROM public.remove_unused_retained_opportunity_document('17000000-0000-4000-8000-000000000001','17000000-0000-4000-8000-000000000105');
  IF EXISTS (SELECT 1 FROM public.opportunity_documents WHERE id IN ('17000000-0000-4000-8000-000000000101','17000000-0000-4000-8000-000000000105'))
    OR NOT EXISTS (SELECT 1 FROM public.opportunity_nda_artifacts WHERE id='17000000-0000-4000-8000-000000000201') THEN
    RAISE EXCEPTION 'w170_eligible_removal_or_latest_fallback_failed';
  END IF;
  PERFORM public.complete_unused_retained_opportunity_document_cleanup(im_receipt, '17000000-0000-4000-8000-000000000001');
  PERFORM public.complete_unused_retained_opportunity_document_cleanup(nda_receipt, '17000000-0000-4000-8000-000000000001');
  IF EXISTS (SELECT 1 FROM public.opportunity_document_storage_cleanup_receipts) THEN RAISE EXCEPTION 'w170_cleanup_receipts_remained'; END IF;
  BEGIN
    PERFORM * FROM public.remove_unused_retained_opportunity_document('17000000-0000-4000-8000-000000000001','17000000-0000-4000-8000-000000000101');
    RAISE EXCEPTION 'w170_completed_stale_retry_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM='w170_completed_stale_retry_allowed' THEN RAISE; END IF;
  END;
END;
$$;
SQL

echo "W-170 full-schema unused retained-document rehearsal passed"
