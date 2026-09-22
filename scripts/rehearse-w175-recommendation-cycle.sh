#!/usr/bin/env bash
set -euo pipefail

# Disposable PostgreSQL 17 only. No Supabase project, production record, or
# email provider is read or written by this rehearsal.
repo_root="${RENEW_W175_REPO_ROOT:-}"
if [[ -z "$repo_root" ]]; then
  repo_root="$(git -C "$PWD" rev-parse --show-toplevel 2>/dev/null || true)"
fi
if [[ -z "$repo_root" || ! -d "$repo_root/supabase/schema" ]]; then
  echo "Set RENEW_W175_REPO_ROOT to the platform repository." >&2
  exit 1
fi
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
port="${RENEW_W175_REHEARSAL_PORT:-55515}"
database_name="renew_w175_rehearsal"
database_superuser="renew_w175_rehearsal_admin"
temp_base="${TMPDIR:-/tmp}"
if [[ "$temp_base" != /* || ! -d "$temp_base" ]]; then
  echo "TMPDIR must be an existing absolute directory." >&2
  exit 1
fi
cluster_dir="$(mktemp -d "$temp_base/renew-w175-rehearsal.XXXXXX")"

cleanup() {
  if [[ ! -d "$cluster_dir" || "$cluster_dir" != "$temp_base"/renew-w175-rehearsal.* ]]; then
    echo "Refusing cleanup outside generated TMPDIR cluster: $cluster_dir" >&2
    return
  fi
  if [[ -f "$cluster_dir/postmaster.pid" ]]; then
    "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true
  fi
  if [[ "${RENEW_W175_RETAIN_CLUSTER:-0}" == "1" ]]; then
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
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
" >/dev/null

predecessors=(
  20260827103000_w164_lifecycle_namespace_visibility.sql
  20260829180000_w169_lifecycle_outcome_separation.sql
  20260829203000_w169_pause_guard_scope.sql
  20260905095834_pursuit_delivery_evidence_types.sql
  20260905095841_pursuit_delivery_handoffs.sql
  20260911133000_w172_recommendation_response_window.sql
  20260911150000_w173_booking_request_reminders.sql
  20260911160000_w174_colin_email_default_copy.sql
  20260911180000_w175_recommendation_assignment_notification.sql
  20260922111134_w173_interest_decisions_notifications.sql
  20260922125444_w174_memo_feedback_evidence_type.sql
  20260922125456_w174_memo_feedback_reminder.sql
)
for migration in "${predecessors[@]}"; do
  "${psql[@]}" --file "$repo_root/supabase/migrations/$migration" >/dev/null
done
"${psql[@]}" --file "$repo_root/scripts/rehearsals/w175-cycle-before.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/migrations/20260922142227_w175_recommendation_cycle_notifications.sql" >/dev/null
"${psql[@]}" --file "$repo_root/scripts/rehearsals/w175-cycle-after.sql"
"${psql[@]}" --file "$repo_root/scripts/rehearsals/w175-cycle-contract-after.sql"
"${psql[@]}" --file "$repo_root/scripts/rehearsals/w175-cycle-delivery-after.sql"
"${psql[@]}" --file "$repo_root/scripts/rehearsals/w175-cycle-access-after.sql"
"${psql[@]}" --file "$repo_root/scripts/rehearsals/w175-cycle-acl-after.sql"
echo "W175 recommendation-cycle local PG17 rehearsal passed"
