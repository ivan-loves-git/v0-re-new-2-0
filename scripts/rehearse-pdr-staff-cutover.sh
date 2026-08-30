#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"; bin=/opt/homebrew/opt/postgresql@16/bin; dir="$(mktemp -d /private/tmp/renew-pdr43.XXXXXX)"; port=55449
cleanup(){ [ -f "$dir/postmaster.pid" ] && "$bin/pg_ctl" -D "$dir" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$dir"; }; trap cleanup EXIT
"$bin/initdb" -D "$dir" --no-locale --auth-local=trust >/dev/null; "$bin/pg_ctl" -D "$dir" -o "-p $port" -w start >/dev/null; "$bin/createdb" -p "$port" pdr43
p=("$bin/psql" -v ON_ERROR_STOP=1 -p "$port" -d pdr43)
"${p[@]}" <<'SQL'
CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions; CREATE SCHEMA storage;
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE TABLE storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
INSERT INTO storage.buckets VALUES('pdr-attachments','pdr-attachments',true,20971520,NULL);
CREATE TABLE storage.objects(id uuid primary key default extensions.gen_random_uuid(),bucket_id text not null,name text not null,owner_id text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO anon,authenticated,service_role;
CREATE POLICY deliberately_permissive ON storage.objects FOR ALL TO anon,authenticated USING (true) WITH CHECK (true);
INSERT INTO storage.objects(bucket_id,name) VALUES('pdr-attachments','legacy-object');
CREATE TABLE pdr_proposals(id uuid primary key default extensions.gen_random_uuid(), requester_actor text default 'Dev team', attachments jsonb default '[]', original_text text default '', conversation jsonb default '[]', proposal_type text default '', problem_statement text default '', ai_rationale text default '', status text default '', created_by text default '', reviewer_note text default '', created_at timestamptz default now(),updated_at timestamptz default now());
CREATE TABLE pdr_work_cards(id uuid primary key default extensions.gen_random_uuid(), attachments jsonb default '[]');
CREATE TABLE pdr_requests(id uuid primary key default extensions.gen_random_uuid()); CREATE TABLE pdr_feedback(id uuid primary key default extensions.gen_random_uuid()); CREATE TABLE pdr_goals(id uuid primary key default extensions.gen_random_uuid()); CREATE TABLE pdr_milestones(id uuid primary key default extensions.gen_random_uuid());
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon,authenticated;
SQL
"${p[@]}" -f "$root/supabase/migrations/20260830113000_wave_pdr_staff_intake_foundation.sql" >/dev/null
"${p[@]}" -f "$root/supabase/migrations/20260830113000_wave_pdr_staff_intake_foundation.sql" >/dev/null
"${p[@]}" <<'SQL'
INSERT INTO wave_pdr_governance_capabilities(singleton,actor_user_id,granted_by) VALUES(true,'ivan','test');
DO $$ BEGIN BEGIN INSERT INTO wave_pdr_governance_capabilities(singleton,actor_user_id,granted_by) VALUES(true,'other','test'); RAISE EXCEPTION 'singleton allowed'; EXCEPTION WHEN unique_violation THEN NULL; END; END $$;
WITH p AS (INSERT INTO pdr_proposals(attachments) VALUES ('[{"url":"https://example.invalid/a","name":"a.pdf"}]') RETURNING id) INSERT INTO wave_pdr_history_attachments(proposal_id,storage_path,original_filename,content_type,size_bytes,uploaded_by_user_id,legacy_source_fingerprint) SELECT id,'legacy/a.pdf','a.pdf','application/pdf',1,'cutover',encode(extensions.digest(convert_to('proposal:' || id::text || ':https://example.invalid/a','UTF8'),'sha256'),'hex') FROM p;
WITH w AS (INSERT INTO pdr_work_cards(attachments) VALUES ('[{"url":"https://example.invalid/b","name":"b.pdf"}]') RETURNING id) INSERT INTO wave_pdr_history_attachments(work_card_id,storage_path,original_filename,content_type,size_bytes,uploaded_by_user_id,legacy_source_fingerprint) SELECT id,'legacy/b.pdf','b.pdf','application/pdf',1,'cutover',encode(extensions.digest(convert_to('work_card:' || id::text || ':https://example.invalid/b','UTF8'),'sha256'),'hex') FROM w;
SQL
"${p[@]}" -f "$root/supabase/migrations/20260830113100_wave_pdr_final_retirement.sql" >/dev/null
"${p[@]}" -f "$root/supabase/migrations/20260830113100_wave_pdr_final_retirement.sql" >/dev/null
"${p[@]}" <<'SQL'
DO $$ DECLARE t text; r text; BEGIN
FOREACH t IN ARRAY ARRAY['pdr_feedback','pdr_goals','pdr_milestones','pdr_proposals','pdr_requests','pdr_work_cards'] LOOP FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF has_table_privilege(r,'public.'||t,'SELECT') THEN RAISE EXCEPTION 'legacy grant remained'; END IF; END LOOP; END LOOP;
IF (SELECT public FROM storage.buckets WHERE id='pdr-attachments') THEN RAISE EXCEPTION 'bucket remained public'; END IF;
BEGIN INSERT INTO pdr_work_cards DEFAULT VALUES; RAISE EXCEPTION 'insert allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='insert allowed' THEN RAISE; END IF; END;
BEGIN UPDATE pdr_work_cards SET id=id; RAISE EXCEPTION 'update allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='update allowed' THEN RAISE; END IF; END;
BEGIN DELETE FROM pdr_work_cards; RAISE EXCEPTION 'delete allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='delete allowed' THEN RAISE; END IF; END;
BEGIN TRUNCATE pdr_work_cards CASCADE; RAISE EXCEPTION 'truncate allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='truncate allowed' THEN RAISE; END IF; END;
END $$;
SQL
"${p[@]}" -c "SET ROLE anon; SELECT count(*) FROM storage.objects WHERE bucket_id='pdr-attachments'; RESET ROLE;" | grep -q '^ *0$'
"${p[@]}" -c "SET ROLE authenticated; SELECT count(*) FROM storage.objects WHERE bucket_id='pdr-attachments'; RESET ROLE;" | grep -q '^ *0$'
"${p[@]}" -c "SET ROLE service_role; SELECT count(*) FROM storage.objects WHERE bucket_id='pdr-attachments'; RESET ROLE;" | grep -q '^ *1$'
"${p[@]}" -f "$root/scripts/rollback-pdr-final-retirement.sql" >/dev/null
"${p[@]}" -c "DO \$\$ BEGIN IF NOT has_table_privilege('anon','pdr_proposals','SELECT') OR NOT (SELECT public FROM storage.buckets WHERE id='pdr-attachments') OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='wave_pdr_historical_work_cards_read_only') OR (SELECT count(*) FROM wave_pdr_history_attachments) <> 2 THEN RAISE EXCEPTION 'rollback retention failed'; END IF; END \$\$;" >/dev/null
"${p[@]}" -c "SET ROLE anon; SELECT count(*) FROM storage.objects WHERE bucket_id='pdr-attachments'; RESET ROLE;" | grep -q '^ *1$'
echo 'PDR #43 disposable migration and rollback rehearsal passed'
