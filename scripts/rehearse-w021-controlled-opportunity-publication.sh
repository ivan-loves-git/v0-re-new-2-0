#!/usr/bin/env bash
set -euo pipefail

# Disposable full-schema rehearsal. It never reads project credentials or a
# remote database. PG_BIN may point at the CI PostgreSQL installation.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
if [ ! -x "$pg_bin/initdb" ]; then pg_bin="/opt/homebrew/opt/postgresql@16/bin"; fi
tmp_root="${TMPDIR:-/tmp}"
cluster_dir="$(mktemp -d "${tmp_root%/}/renew-w021-publication.XXXXXX")"
port="${W021_PUBLICATION_REHEARSAL_PORT:-55449}"
cleanup() { [ ! -f "$cluster_dir/postmaster.pid" ] || "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$cluster_dir"; }
trap cleanup EXIT
for binary in initdb pg_ctl createdb psql; do [ -x "$pg_bin/$binary" ] || { echo "Missing PostgreSQL binary: $pg_bin/$binary" >&2; exit 1; }; done
"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 --auth-local=trust --auth-host=trust --username=renew_rehearsal_admin >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -l "$cluster_dir/postgres.log" -o "-p $port -h 127.0.0.1 -k $cluster_dir" -w start >/dev/null
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" -U renew_rehearsal_admin w021_rehearsal
psql=("$pg_bin/psql" -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -U renew_rehearsal_admin -d w021_rehearsal)

"${psql[@]}" -c "CREATE ROLE postgres NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN; CREATE SCHEMA extensions; CREATE SCHEMA auth; CREATE TABLE auth.users (id UUID PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS 'SELECT NULL::UUID';" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/schema/771_extensions.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/schema/771_public_schema.sql" >/dev/null
"${psql[@]}" --file "$repo_root/scripts/112_demo_opportunity_quarantine.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/migrations/20260825190000_w021_controlled_opportunity_publication.sql" >/dev/null
"${psql[@]}" -c "ALTER TABLE public.opportunities DISABLE TRIGGER enforce_ma_provisional_source_review_on_opportunity;" >/dev/null

"${psql[@]}" <<'SQL'
BEGIN;
INSERT INTO public.ma_firms(id,name,status,created_by) VALUES ('00000000-0000-4000-8000-000000002101','Fixture Firm','active','rehearsal');
INSERT INTO public.ma_offices(id,firm_id,name,status,is_default,created_by) VALUES ('00000000-0000-4000-8000-000000002102','00000000-0000-4000-8000-000000002101','Paris','active',FALSE,'rehearsal');
COMMIT;
INSERT INTO public.ma_contacts(id,first_name,display_name,status,email,created_by) VALUES ('00000000-0000-4000-8000-000000002103','Ada','Ada','active','ada@example.test','rehearsal');
INSERT INTO public.ma_contact_office_affiliations(id,contact_id,office_id,is_active,created_by) VALUES ('00000000-0000-4000-8000-000000002104','00000000-0000-4000-8000-000000002103','00000000-0000-4000-8000-000000002102',TRUE,'rehearsal');
INSERT INTO public.repreneurs(id,email,first_name,last_name,created_by) VALUES ('00000000-0000-4000-8000-000000002105','buyer@example.test','Buyer','Fixture','rehearsal');
INSERT INTO public.opportunities(id,reference,status,source_office_id,description,public_title,teaser_summary,sector,location,repreneur_exposure,is_demo,created_by) VALUES
 ('00000000-0000-4000-8000-000000002106','W021-VALID-A','draft','00000000-0000-4000-8000-000000002102','Valid','Anonymous industrial specialist','A real teaser','Industry','France','staff_only',FALSE,'rehearsal'),
 ('00000000-0000-4000-8000-000000002107','W021-VALID-B','draft','00000000-0000-4000-8000-000000002102','Valid','Anonymous services specialist','Another real teaser','Services','France','staff_only',FALSE,'rehearsal'),
 ('00000000-0000-4000-8000-000000002108','W021-DEMO','draft','00000000-0000-4000-8000-000000002102','Demo','Demo','Demo teaser','Industry','France','staff_only',TRUE,'rehearsal'),
 ('00000000-0000-4000-8000-000000002109','W021-INCOMPLETE','draft','00000000-0000-4000-8000-000000002102','Incomplete',NULL,'Missing title','Industry','France','staff_only',FALSE,'rehearsal'),
 ('00000000-0000-4000-8000-000000002110','W021-INACTIVE','draft','00000000-0000-4000-8000-000000002102','Draft','Draft','Draft teaser','Industry','France','staff_only',FALSE,'rehearsal');
SQL
"${psql[@]}" -c "INSERT INTO public.opportunity_ma_contacts(id,opportunity_id,affiliation_id,is_primary,is_active,linked_by) VALUES ('00000000-0000-4000-8000-000000002201','00000000-0000-4000-8000-000000002106','00000000-0000-4000-8000-000000002104',TRUE,TRUE,'rehearsal'), ('00000000-0000-4000-8000-000000002202','00000000-0000-4000-8000-000000002107','00000000-0000-4000-8000-000000002104',TRUE,TRUE,'rehearsal'), ('00000000-0000-4000-8000-000000002203','00000000-0000-4000-8000-000000002108','00000000-0000-4000-8000-000000002104',TRUE,TRUE,'rehearsal'), ('00000000-0000-4000-8000-000000002204','00000000-0000-4000-8000-000000002109','00000000-0000-4000-8000-000000002104',TRUE,TRUE,'rehearsal'), ('00000000-0000-4000-8000-000000002205','00000000-0000-4000-8000-000000002110','00000000-0000-4000-8000-000000002104',TRUE,TRUE,'rehearsal');" >/dev/null
"${psql[@]}" -c "UPDATE public.opportunities SET status='active' WHERE reference IN ('W021-VALID-A','W021-VALID-B','W021-DEMO','W021-INCOMPLETE');" >/dev/null

"${psql[@]}" <<'SQL'
INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,created_by) VALUES ('00000000-0000-4000-8000-000000002211','00000000-0000-4000-8000-000000002106','00000000-0000-4000-8000-000000002105','interested','rehearsal');
DO $$
DECLARE manifest JSONB; digest TEXT; result RECORD; rollback_result RECORD;
BEGIN
  IF (SELECT count(*) FROM public.w021_opportunity_publication_preflight() WHERE eligible) <> 2 THEN RAISE EXCEPTION 'w021_eligibility_classification_failed: %', (SELECT JSONB_AGG(JSONB_BUILD_OBJECT('reference',reference,'reasons',exclusion_reasons)) FROM public.w021_opportunity_publication_preflight()); END IF;
  SELECT JSONB_AGG(JSONB_BUILD_OBJECT('ordinal',ordinal,'id',id,'reference',reference,'updated_at',updated_at,'fingerprint',fingerprint) ORDER BY ordinal) INTO manifest FROM public.w021_opportunity_publication_preflight() WHERE eligible AND reference='W021-VALID-A';
  digest := public.w021_publication_manifest_digest(manifest);
  BEGIN PERFORM public.apply_w021_current_publication(manifest,digest,'rehearsal'); RAISE EXCEPTION 'w021_subset_was_allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'w021_bulk_manifest_set_mismatch' THEN RAISE; END IF; END;
  SELECT JSONB_AGG(JSONB_BUILD_OBJECT('ordinal',ordinal,'id',id,'reference',reference,'updated_at',updated_at,'fingerprint',fingerprint) ORDER BY ordinal) INTO manifest FROM public.w021_opportunity_publication_preflight() WHERE eligible;
  digest := public.w021_publication_manifest_digest(manifest);
  UPDATE public.opportunities SET sector='Changed sector' WHERE reference='W021-VALID-A';
  BEGIN PERFORM public.apply_w021_current_publication(manifest,digest,'rehearsal'); RAISE EXCEPTION 'w021_drift_was_allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'w021_bulk_manifest_set_mismatch' THEN RAISE; END IF; END;
  UPDATE public.opportunities SET sector='Industry' WHERE reference='W021-VALID-A';
  SELECT JSONB_AGG(JSONB_BUILD_OBJECT('ordinal',ordinal,'id',id,'reference',reference,'updated_at',updated_at,'fingerprint',fingerprint) ORDER BY ordinal) INTO manifest FROM public.w021_opportunity_publication_preflight() WHERE eligible;
  digest := public.w021_publication_manifest_digest(manifest);
  SELECT * INTO result FROM public.apply_w021_current_publication(manifest,digest,'rehearsal');
  IF result.published_count <> 2 OR (SELECT count(*) FROM public.opportunities WHERE reference IN ('W021-VALID-A','W021-VALID-B') AND repreneur_exposure='anonymized') <> 2 THEN RAISE EXCEPTION 'w021_bulk_publication_failed'; END IF;
  IF (SELECT count(*) FROM public.opportunity_matches WHERE opportunity_id='00000000-0000-4000-8000-000000002106') <> 1 THEN RAISE EXCEPTION 'w021_match_changed'; END IF;
  UPDATE public.opportunities SET updated_by='drift' WHERE reference='W021-VALID-A';
  BEGIN PERFORM public.rollback_w021_current_publication(result.run_id,'rollback'); RAISE EXCEPTION 'w021_rollback_drift_was_allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'w021_bulk_rollback_manifest_drift' THEN RAISE; END IF; END;
  UPDATE public.opportunities SET updated_by='rehearsal' WHERE reference='W021-VALID-A';
  SELECT * INTO rollback_result FROM public.rollback_w021_current_publication(result.run_id,'rollback');
  IF rollback_result.rolled_back_count <> 2 OR (SELECT count(*) FROM public.opportunities WHERE reference IN ('W021-VALID-A','W021-VALID-B') AND repreneur_exposure='staff_only') <> 2 THEN RAISE EXCEPTION 'w021_bulk_rollback_failed'; END IF;
  BEGIN PERFORM public.apply_w021_current_publication(manifest,digest,'rehearsal'); RAISE EXCEPTION 'w021_replay_was_allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'w021_bulk_already_completed' THEN RAISE; END IF; END;
  SELECT * INTO result FROM public.publish_w021_opportunity('00000000-0000-4000-8000-000000002106','staff');
  IF result.resulting_exposure <> 'anonymized' THEN RAISE EXCEPTION 'w021_single_publish_failed'; END IF;
  SELECT * INTO result FROM public.withdraw_w021_opportunity('00000000-0000-4000-8000-000000002106','staff');
  IF result.resulting_exposure <> 'staff_only' THEN RAISE EXCEPTION 'w021_single_withdraw_failed'; END IF;
END $$;
SQL
echo "W-021 controlled opportunity publication rehearsal passed"
