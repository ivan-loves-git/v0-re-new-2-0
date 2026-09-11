#!/usr/bin/env bash
set -euo pipefail

# Local-only W172/W173/W174/W175 rehearsal. It creates a new PG17 cluster beneath
# /private/tmp, reads no project environment files, and never contacts
# Supabase. Invoke with `bash scripts/rehearse-sep11-recommendation-booking.sh` from the
# platform repository, or set RENEW_SEP11_REPO_ROOT to that repository.

repo_root="${RENEW_SEP11_REPO_ROOT:-}"
if [[ -z "$repo_root" ]]; then
  repo_root="$(git -C "$PWD" rev-parse --show-toplevel 2>/dev/null || true)"
fi
if [[ -z "$repo_root" || ! -d "$repo_root/supabase/schema" ]]; then
  echo "Set RENEW_SEP11_REPO_ROOT to the platform repository." >&2
  exit 1
fi

pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
port="${RENEW_SEP11_REHEARSAL_PORT:-55497}"
database_name="renew_sep11_rehearsal"
database_superuser="renew_sep11_rehearsal_admin"
cluster_dir="$(mktemp -d /private/tmp/renew-sep11-rehearsal.XXXXXX)"

validate_cluster_dir() {
  [[ -d "$cluster_dir" && "$cluster_dir" == /private/tmp/renew-sep11-rehearsal.* ]]
}

cleanup() {
  if ! validate_cluster_dir; then
    echo "Refusing rehearsal cleanup outside its generated /private/tmp directory: $cluster_dir" >&2
    return
  fi

  if [[ -f "$cluster_dir/postmaster.pid" ]]; then
    "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true
  fi

  if [[ "${RENEW_SEP11_RETAIN_CLUSTER:-0}" == "1" ]]; then
    echo "Retained stopped local rehearsal cluster: $cluster_dir" >&2
    return
  fi

  rm -rf -- "$cluster_dir"
}
trap cleanup EXIT

for binary in initdb pg_ctl createdb psql; do
  if [[ ! -x "$pg_bin/$binary" ]]; then
    echo "Missing PostgreSQL 17 binary: $pg_bin/$binary" >&2
    exit 1
  fi
done

schema_inputs=(
  "$repo_root/supabase/schema/771_extensions.sql"
  "$repo_root/supabase/schema/771_public_schema.sql"
  "$repo_root/supabase/migrations/20260827103000_w164_lifecycle_namespace_visibility.sql"
  "$repo_root/supabase/migrations/20260829180000_w169_lifecycle_outcome_separation.sql"
  "$repo_root/supabase/migrations/20260829203000_w169_pause_guard_scope.sql"
  "$repo_root/supabase/migrations/20260911133000_w172_recommendation_response_window.sql"
  "$repo_root/supabase/migrations/20260911150000_w173_booking_request_reminders.sql"
  "$repo_root/scripts/rehearsals/w172-recommendation-response-window.sql"
  "$repo_root/scripts/rehearsals/w173-booking-request-reminders.sql"
  "$repo_root/scripts/rehearsals/w174-colin-email-default-copy.sql"
  "$repo_root/supabase/migrations/20260911160000_w174_colin_email_default_copy.sql"
  "$repo_root/scripts/rehearsals/w175-recommendation-assignment.sql"
  "$repo_root/supabase/migrations/20260911180000_w175_recommendation_assignment_notification.sql"
)
for input in "${schema_inputs[@]}"; do
  if [[ ! -r "$input" ]]; then
    echo "Missing required local rehearsal input: $input" >&2
    exit 1
  fi
done

"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 \
  --auth-local=trust --auth-host=trust --username="$database_superuser" >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -l "$cluster_dir/postgres.log" \
  -o "-p $port -h 127.0.0.1 -k $cluster_dir" -w start >/dev/null
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" -U "$database_superuser" "$database_name"

psql=(
  "$pg_bin/psql" -X -v ON_ERROR_STOP=1
  -h 127.0.0.1 -p "$port" -U "$database_superuser" -d "$database_name"
)

# Schema 771 is intentionally sanitized: this is the minimal local role/auth
# bootstrap it expects. service_role has the same RLS bypass semantics used by
# the server-only SQL paths exercised by the fixtures.
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

# `is_demo` was introduced after this sanitized schema snapshot. W164 needs
# it on both sides of a match; IF NOT EXISTS keeps the wrapper usable once the
# snapshot is refreshed.
"${psql[@]}" -c "
  ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE public.repreneurs ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
" >/dev/null

# Apply real predecessor overlays in dependency order, then the two changes
# under rehearsal. No production reconciliation or provider operation occurs.
"${psql[@]}" --file "$repo_root/supabase/migrations/20260827103000_w164_lifecycle_namespace_visibility.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/migrations/20260829180000_w169_lifecycle_outcome_separation.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/migrations/20260829203000_w169_pause_guard_scope.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/migrations/20260911133000_w172_recommendation_response_window.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/migrations/20260911150000_w173_booking_request_reminders.sql" >/dev/null

"${psql[@]}" --file "$repo_root/scripts/rehearsals/w172-recommendation-response-window.sql"
"${psql[@]}" --file "$repo_root/scripts/rehearsals/w173-booking-request-reminders.sql"
"${psql[@]}" --file "$repo_root/scripts/rehearsals/w174-colin-email-default-copy.sql"
"${psql[@]}" --file "$repo_root/scripts/rehearsals/w175-recommendation-assignment.sql"

echo "W172/W173/W174/W175 local PG17 rehearsals passed"
