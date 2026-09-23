#!/usr/bin/env bash
set -euo pipefail

# Synthetic PG17 only. No project env, Supabase endpoint, or provider is read.
repo_root="${RENEW_W173_REPO_ROOT:-}"
if [[ -z "$repo_root" ]]; then
  repo_root="$(git -C "$PWD" rev-parse --show-toplevel 2>/dev/null || true)"
fi
if [[ -z "$repo_root" || ! -d "$repo_root/supabase/schema" ]]; then
  echo "Set RENEW_W173_REPO_ROOT to the platform repository." >&2
  exit 1
fi
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
port="${RENEW_W173_REHEARSAL_PORT:-55498}"
database_name="renew_w173_rehearsal"
database_superuser="renew_w173_rehearsal_admin"
temp_base="${TMPDIR:-/tmp}"
if [[ "$temp_base" != /* || ! -d "$temp_base" ]]; then
  echo "TMPDIR must be an existing absolute directory." >&2
  exit 1
fi
cluster_dir="$(mktemp -d "$temp_base/renew-w173-rehearsal.XXXXXX")"

cleanup() {
  if [[ ! -d "$cluster_dir" || "$cluster_dir" != "$temp_base"/renew-w173-rehearsal.* ]]; then
    echo "Refusing cleanup outside generated TMPDIR cluster: $cluster_dir" >&2
    return
  fi
  if [[ -f "$cluster_dir/postmaster.pid" ]]; then
    "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true
  fi
  if [[ "${RENEW_W173_RETAIN_CLUSTER:-0}" == "1" ]]; then
    echo "Retained stopped local cluster: $cluster_dir" >&2
  else
    rm -rf -- "$cluster_dir"
  fi
}
trap cleanup EXIT

for binary in initdb pg_ctl createdb psql; do
  [[ -x "$pg_bin/$binary" ]] || { echo "Missing PostgreSQL 17 binary: $pg_bin/$binary" >&2; exit 1; }
done

"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 \
  --auth-local=trust --auth-host=trust --username="$database_superuser" >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -l "$cluster_dir/postgres.log" \
  -o "-p $port -h 127.0.0.1 -k $cluster_dir" -w start >/dev/null
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" -U "$database_superuser" "$database_name"
psql=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -U "$database_superuser" -d "$database_name")

"${psql[@]}" -c "
  CREATE ROLE postgres NOLOGIN;
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN BYPASSRLS;
  CREATE SCHEMA extensions;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id UUID PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS 'SELECT NULL::UUID';
" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/schema/771_extensions.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/schema/771_public_schema.sql" >/dev/null
"${psql[@]}" -c "
  ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE public.repreneurs ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
  CREATE SCHEMA storage;
  CREATE TABLE storage.buckets (
    id text PRIMARY KEY, public boolean NOT NULL DEFAULT false,
    file_size_limit bigint, allowed_mime_types text[]
  );
  INSERT INTO storage.buckets(id) VALUES
    ('opportunity-documents'), ('cvs'), ('external-pursuit-attachments');
" >/dev/null

predecessors=(
  20260827103000_w164_lifecycle_namespace_visibility.sql
  20260827113000_w165_private_direct_uploads.sql
  20260829130000_w161_repreneur_target_ebitda_range.sql
  20260829180000_w169_lifecycle_outcome_separation.sql
  20260829203000_w169_pause_guard_scope.sql
  20260905095834_pursuit_delivery_evidence_types.sql
  20260905095841_pursuit_delivery_handoffs.sql
  20260911133000_w172_recommendation_response_window.sql
  20260911150000_w173_booking_request_reminders.sql
  20260911160000_w174_colin_email_default_copy.sql
  20260911180000_w175_recommendation_assignment_notification.sql
)
"${psql[@]}" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role" >/dev/null
for migration in "${predecessors[@]}"; do
  "${psql[@]}" --file "$repo_root/supabase/migrations/$migration" >/dev/null
done
"${psql[@]}" --file "$repo_root/scripts/rehearsals/w173-interest-decisions-before.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/migrations/20260922111134_w173_interest_decisions_notifications.sql" >/dev/null
"${psql[@]}" --file "$repo_root/scripts/rehearsals/w173-interest-decisions-after.sql"
"${psql[@]}" --file "$repo_root/supabase/migrations/20260922142227_w175_recommendation_cycle_notifications.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/migrations/20260923173503_w196_attributed_staff_assistance.sql" >/dev/null
"${psql[@]}" --file "$repo_root/scripts/rehearsals/w196-staff-responses.sql"
"${psql[@]}" --file "$repo_root/scripts/rehearsals/w196-staff-thesis.sql"
"${psql[@]}" --file "$repo_root/scripts/rehearsals/w196-staff-received-nda.sql"

# Two actual sessions: an owner response commits while a staff form still
# carries the old exact-match timestamp. The staff call must wait, then reject.
race_ids='76000000-0000-4000-8000-000000000011'
IFS='|' read -r race_owner race_opp race_opp_updated race_match_updated <<< "$(${psql[@]} -AtF '|' -c "
  SELECT m.repreneur_id,m.opportunity_id,o.updated_at,m.updated_at
  FROM public.opportunity_matches m JOIN public.opportunities o ON o.id=m.opportunity_id
  WHERE m.id='$race_ids'")"
"${psql[@]}" -q -c "BEGIN;
  SELECT public.update_repreneur_opportunity_response('$race_ids','$race_owner','interested');
  SELECT pg_sleep(1);
  COMMIT;" >/dev/null &
owner_race_pid=$!
sleep 0.2
set +e
race_result="$("${psql[@]}" -At -c "SELECT public.w196_record_staff_opportunity_response(
  '$race_owner','$race_opp','$race_ids',
  '$race_opp_updated','$race_match_updated',NULL,
  'declined',ARRAY['sector'],'Synthetic concurrent decline',
  'w173-staff','w173-staff@example.test','76000000-0000-4000-8000-000000000098');" 2>&1)"
race_status=$?
set -e
wait "$owner_race_pid"
if [[ "$race_status" -eq 0 || "$race_result" != *staff_assistance_stale_response* ]]; then
  echo "W196 concurrent owner/staff stale-form guard failed: $race_result" >&2
  exit 1
fi
echo "W173/W196 exact-interest, attributed assistance and two-session race rehearsal passed"
