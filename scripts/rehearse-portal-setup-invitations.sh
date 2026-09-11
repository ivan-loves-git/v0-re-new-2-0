#!/usr/bin/env bash
set -euo pipefail
export TZ=UTC

# A local disposable PG17 database only. No project environment file is read.
repo_root="$(git rev-parse --show-toplevel)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
port="${PORTAL_SETUP_REHEARSAL_PORT:-55519}"
cluster_dir="$(mktemp -d /private/tmp/renew-portal-setup-rehearsal.XXXXXX)"
database_name="renew_portal_setup_rehearsal"
database_user="renew_portal_setup_rehearsal_admin"

cleanup() {
  if [[ -d "$cluster_dir" && "$cluster_dir" == /private/tmp/renew-portal-setup-rehearsal.* ]]; then
    if [[ -f "$cluster_dir/postmaster.pid" ]]; then
      "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true
    fi
    rm -rf -- "$cluster_dir"
  fi
}
trap cleanup EXIT

"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 --auth-local=trust --auth-host=trust --username="$database_user" >/dev/null
# Exercise the unchanged application TLS transport, rather than enabling a
# QA transport bypass or pretending this local run is protected GitHub CI.
openssl req -new -x509 -nodes -days 1 -subj '/CN=localhost' -keyout "$cluster_dir/server.key" -out "$cluster_dir/server.crt" >/dev/null 2>&1
chmod 600 "$cluster_dir/server.key"
"$pg_bin/pg_ctl" -D "$cluster_dir" -l "$cluster_dir/postgres.log" -o "-p $port -h 127.0.0.1 -k $cluster_dir -c ssl=on -c ssl_cert_file=$cluster_dir/server.crt -c ssl_key_file=$cluster_dir/server.key" -w start >/dev/null
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" -U "$database_user" "$database_name"
psql=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -U "$database_user" -d "$database_name")
"${psql[@]}" -c "CREATE ROLE postgres NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS; CREATE SCHEMA extensions; CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS 'SELECT NULL::UUID';" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/schema/771_extensions.sql" >/dev/null
"${psql[@]}" --file "$repo_root/supabase/schema/771_public_schema.sql" >/dev/null

export PORTAL_SETUP_REHEARSAL=1
export DATABASE_URL="postgresql://$database_user@127.0.0.1:$port/$database_name"
export NEXT_PUBLIC_SUPABASE_URL="https://supabase.test.invalid"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="test-anon-key"
export SUPABASE_SERVICE_ROLE_KEY="test-service-role-key"
export BETTER_AUTH_SECRET="test-only-portal-setup-secret-that-is-long-enough"
export BETTER_AUTH_URL="http://localhost:3000"
export RESEND_API_KEY="test-not-a-provider-credential"
export RESEND_FROM_EMAIL="onboarding@resend.dev"
export CRON_SECRET="test-only-cron-secret"
export QA_MAIL_MODE="allowlist"
export QA_EMAIL_FROM="onboarding@resend.dev"
export QA_EMAIL_RECIPIENT="delivered+test-portal-setup@resend.dev"
NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--conditions=react-server" pnpm exec tsx scripts/rehearsals/portal-setup-invitations.ts
