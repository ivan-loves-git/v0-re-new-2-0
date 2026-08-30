#!/usr/bin/env bash
set -euo pipefail

# Disposable #40 migration, privilege and admission rehearsal. It creates an
# isolated local cluster and never reads project credentials or Supabase data.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
if [ ! -x "$pg_bin/initdb" ]; then pg_bin="/opt/homebrew/opt/postgresql@16/bin"; fi
cluster_dir="$(mktemp -d /private/tmp/renew-pdr-screening.XXXXXX)"
port="${PDR_SCREENING_REHEARSAL_PORT:-55446}"
cleanup() { if [ -f "$cluster_dir/postmaster.pid" ]; then "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true; fi; rm -rf "$cluster_dir"; }
trap cleanup EXIT
for binary in initdb pg_ctl createdb psql; do [ -x "$pg_bin/$binary" ] || { echo "Missing PostgreSQL binary: $pg_bin/$binary" >&2; exit 1; }; done

"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 --auth-local=trust --auth-host=trust >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -o "-p $port -h 127.0.0.1" -w start >/dev/null
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" pdr_screening_rehearsal
psql=("$pg_bin/psql" -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -d pdr_screening_rehearsal)

# Production-shaped baseline: exact tracked schema followed by each additive
# migration in its release order. No historical object is rewritten.
"${psql[@]}" -c "CREATE ROLE postgres NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN; CREATE SCHEMA extensions; CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE TABLE auth.users (id uuid primary key); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT NULL::uuid'; CREATE TABLE storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/schema/771_extensions.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/schema/771_public_schema.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/migrations/20260830113000_wave_pdr_staff_intake_foundation.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/migrations/20260830113050_wave_pdr_intake_provenance.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/migrations/20260830130000_wave_pdr_screening_records.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/migrations/20260830130010_wave_ai_pdr_screening_feature.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/migrations/20260830130020_wave_ai_atomic_admission.sql" >/dev/null

"${psql[@]}" <<'SQL' >/dev/null
DO $$
DECLARE p jsonb := jsonb_build_object('initiated_by_user_id','actor-a','app_role','staff','feature','pdr_screening','workflow','test','surface','/test','prompt_version','v1','output_schema_version','v1','provider','openai','model','gpt-5.6-luna','reasoning_effort','max','pricing_version','v1','environment','test','release','','is_test',true);
BEGIN
  IF has_table_privilege('anon','public.wave_pdr_screening_records','select') OR has_table_privilege('anon','public.wave_pdr_screening_records','insert') OR has_table_privilege('anon','public.wave_pdr_screening_records','update') OR has_table_privilege('anon','public.wave_pdr_screening_records','delete') OR has_table_privilege('authenticated','public.wave_pdr_screening_records','select') OR has_table_privilege('authenticated','public.wave_pdr_screening_records','insert') OR has_table_privilege('authenticated','public.wave_pdr_screening_records','update') OR has_table_privilege('authenticated','public.wave_pdr_screening_records','delete') THEN RAISE EXCEPTION 'browser_role_screening_access'; END IF;
  IF NOT has_table_privilege('service_role','public.wave_pdr_screening_records','select') OR NOT has_table_privilege('service_role','public.wave_pdr_screening_records','insert') OR has_table_privilege('service_role','public.wave_pdr_screening_records','update') OR has_table_privilege('service_role','public.wave_pdr_screening_records','delete') THEN RAISE EXCEPTION 'service_role_screening_grants'; END IF;
  IF has_function_privilege('anon','public.admit_wave_ai_run(jsonb,timestamptz,integer)','execute') OR has_function_privilege('authenticated','public.admit_wave_ai_run(jsonb,timestamptz,integer)','execute') OR NOT has_function_privilege('service_role','public.admit_wave_ai_run(jsonb,timestamptz,integer)','execute') THEN RAISE EXCEPTION 'rpc_permissions'; END IF;
  SET LOCAL ROLE service_role;
  PERFORM public.admit_wave_ai_run(p || jsonb_build_object('initiated_by_user_id','actor-sequential'),clock_timestamp() - interval '1 hour',2);
  PERFORM public.admit_wave_ai_run(p || jsonb_build_object('initiated_by_user_id','actor-sequential'),clock_timestamp() - interval '1 hour',2);
  BEGIN PERFORM public.admit_wave_ai_run(p || jsonb_build_object('initiated_by_user_id','actor-sequential'),clock_timestamp() - interval '1 hour',2); RAISE EXCEPTION 'rate_limit_not_enforced'; EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
END $$;
SQL
# A rehearsal-only trigger keeps the first INSERT inside the function long
# enough that separately launched clients demonstrably overlap at its actor
# lock. It is never part of a tracked migration or production schema.
"${psql[@]}" -c "CREATE FUNCTION public.rehearsal_hold_ai_admission() RETURNS trigger LANGUAGE plpgsql AS \$\$ BEGIN PERFORM pg_sleep(0.35); RETURN NEW; END \$\$; CREATE TRIGGER rehearsal_hold_ai_admission BEFORE INSERT ON public.ai_generation_runs FOR EACH ROW EXECUTE FUNCTION public.rehearsal_hold_ai_admission();" >/dev/null
admission_sql="SET ROLE service_role; SELECT * FROM public.admit_wave_ai_run(jsonb_build_object('initiated_by_user_id','actor-concurrent','app_role','staff','feature','pdr_screening','workflow','test','surface','/test','prompt_version','v1','output_schema_version','v1','provider','openai','model','gpt-5.6-luna','reasoning_effort','max','pricing_version','v1','environment','test','release','','is_test',true),clock_timestamp() - interval '1 hour',2);"
concurrent_outputs=()
for index in 1 2 3 4; do output_file="$(mktemp /private/tmp/renew-pdr-admission.XXXXXX)"; concurrent_outputs+=("$output_file"); "${psql[@]}" -c "$admission_sql" >"$output_file" 2>&1 & done
independent_output="$(mktemp /private/tmp/renew-pdr-admission.XXXXXX)"
"${psql[@]}" -c "SET ROLE service_role; SELECT * FROM public.admit_wave_ai_run(jsonb_build_object('initiated_by_user_id','actor-independent','app_role','staff','feature','pdr_screening','workflow','test','surface','/test','prompt_version','v1','output_schema_version','v1','provider','openai','model','gpt-5.6-luna','reasoning_effort','max','pricing_version','v1','environment','test','release','','is_test',true),clock_timestamp() - interval '1 hour',2);" >"$independent_output" 2>&1 &
for pid in $(jobs -p); do wait "$pid" || true; done
successes=0; failures=0
for output_file in "${concurrent_outputs[@]}"; do if rg -q 'wave_ai_rate_limited' "$output_file"; then failures=$((failures + 1)); elif rg -q '[0-9a-f]{8}-[0-9a-f-]{27}' "$output_file"; then successes=$((successes + 1)); else cat "$output_file" >&2; exit 1; fi; rm -f "$output_file"; done
if [ "$successes" -ne 2 ] || [ "$failures" -ne 2 ]; then echo "Concurrent admission did not admit exactly limit N" >&2; exit 1; fi
if ! rg -q '[0-9a-f]{8}-[0-9a-f-]{27}' "$independent_output"; then cat "$independent_output" >&2; exit 1; fi
rm -f "$independent_output"
"${psql[@]}" -Atc "SELECT count(*) FROM public.ai_generation_runs WHERE initiated_by_user_id='actor-concurrent'" | rg -x '2' >/dev/null
"${psql[@]}" -Atc "SELECT count(*) FROM public.ai_generation_runs WHERE initiated_by_user_id='actor-independent'" | rg -x '1' >/dev/null
"${psql[@]}" -c "DROP TRIGGER rehearsal_hold_ai_admission ON public.ai_generation_runs; DROP FUNCTION public.rehearsal_hold_ai_admission();" >/dev/null
"${psql[@]}" <<'SQL' >/dev/null
INSERT INTO public.pdr_proposals(id, original_text, created_by, requester_actor, problem_statement, status) VALUES ('11111111-1111-4111-8111-111111111111','fixture request','rehearsal','Staff','fixture','draft');
INSERT INTO public.wave_pdr_screening_records(proposal_id,generation_id,created_by_user_id,output,governance_snapshot_id,governance_snapshot_digest,registry_revision,governance_snapshot_at,freshness,prompt_version,output_schema_version) SELECT '11111111-1111-4111-8111-111111111111',generation_id,'actor-sequential','{}','22222222-2222-4222-8222-222222222222',repeat('a',64),'r1',clock_timestamp(),'fresh','v1','v1' FROM public.ai_generation_runs WHERE initiated_by_user_id='actor-sequential' LIMIT 1;
DO $$ DECLARE g uuid; BEGIN SELECT generation_id INTO g FROM public.wave_pdr_screening_records LIMIT 1; BEGIN INSERT INTO public.wave_pdr_screening_records(proposal_id,generation_id,created_by_user_id,output,governance_snapshot_id,governance_snapshot_digest,registry_revision,governance_snapshot_at,freshness,prompt_version,output_schema_version) VALUES ('11111111-1111-4111-8111-111111111111',g,'actor-a','{}','22222222-2222-4222-8222-222222222222',repeat('a',64),'r1',clock_timestamp(),'fresh','v1','v1'); RAISE EXCEPTION 'generation_replay_allowed'; EXCEPTION WHEN unique_violation THEN NULL; END; END $$;
SQL
echo "PDR screening migration, privilege, replay and atomic-admission rehearsal passed"
