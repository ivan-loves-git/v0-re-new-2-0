#!/usr/bin/env bash
set -euo pipefail

# Isolated PostgreSQL proof for #265: the additive OAuth migration and the
# real Better Auth staff connection flow. No project credentials, provider or
# customer records are used.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
if [ ! -x "$pg_bin/initdb" ]; then pg_bin="/opt/homebrew/opt/postgresql@16/bin"; fi
cluster_dir="$(mktemp -d "${TMPDIR:-/tmp}/renew-staff-mcp.XXXXXX")"
port="${STAFF_MCP_REHEARSAL_PORT:-55265}"
cleanup() {
  if [ -f "$cluster_dir/postmaster.pid" ]; then "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true; fi
  case "$cluster_dir" in */renew-staff-mcp.*) rm -rf "$cluster_dir" ;; esac
}
trap cleanup EXIT

for binary in initdb pg_ctl createdb psql; do
  [ -x "$pg_bin/$binary" ] || { echo "Missing PostgreSQL binary: $pg_bin/$binary" >&2; exit 1; }
done
"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 --auth-local=trust --auth-host=trust --username=renew_rehearsal_admin >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -l "$cluster_dir/postgres.log" -o "-p $port -h 127.0.0.1 -k $cluster_dir" -w start >/dev/null
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" -U renew_rehearsal_admin staff_mcp
psql=("$pg_bin/psql" -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -U renew_rehearsal_admin -d staff_mcp)

# The released Better Auth tables this migration references, as in build 771.
"${psql[@]}" >/dev/null <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE TABLE public."user" ("id" text PRIMARY KEY, "name" text, "email" text NOT NULL UNIQUE,
  "emailVerified" boolean DEFAULT false, "image" text,
  "createdAt" timestamp DEFAULT now(), "updatedAt" timestamp DEFAULT now());
CREATE TABLE public."session" ("id" text PRIMARY KEY, "userId" text NOT NULL REFERENCES public."user"("id") ON DELETE CASCADE,
  "token" text NOT NULL UNIQUE, "expiresAt" timestamp NOT NULL, "ipAddress" text, "userAgent" text,
  "createdAt" timestamp DEFAULT now(), "updatedAt" timestamp DEFAULT now());
CREATE TABLE public."account" ("id" text PRIMARY KEY, "userId" text NOT NULL REFERENCES public."user"("id") ON DELETE CASCADE,
  "accountId" text NOT NULL, "providerId" text NOT NULL, "accessToken" text, "refreshToken" text,
  "accessTokenExpiresAt" timestamp, "refreshTokenExpiresAt" timestamp, "scope" text, "idToken" text,
  "password" text, "createdAt" timestamp DEFAULT now(), "updatedAt" timestamp DEFAULT now());
CREATE TABLE public."verification" ("id" text PRIMARY KEY, "identifier" text NOT NULL, "value" text NOT NULL,
  "expiresAt" timestamp NOT NULL, "createdAt" timestamp DEFAULT now(), "updatedAt" timestamp DEFAULT now());
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
-- Production grants service_role every new public table by default (W-147),
-- so the migration's REVOKE is what keeps the token tables out of reach.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
SQL
"${psql[@]}" --file "$repo_root/supabase/migrations/20261016120000_staff_mcp_oauth_clients.sql" >/dev/null

# Tokens stay out of every API role, and row security stays on.
"${psql[@]}" >/dev/null <<'SQL'
DO $$
DECLARE api_role text; table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['oauthApplication', 'oauthAccessToken', 'oauthConsent'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = format('public.%I', table_name)::regclass) THEN
      RAISE EXCEPTION 'rls_disabled_on_%', table_name;
    END IF;
    FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF has_table_privilege(api_role, format('public.%I', table_name), 'SELECT')
         OR has_table_privilege(api_role, format('public.%I', table_name), 'INSERT') THEN
        RAISE EXCEPTION '% can reach %', api_role, table_name;
      END IF;
    END LOOP;
  END LOOP;
END $$;
SQL

STAFF_MCP_REHEARSAL_DATABASE_URL="postgresql://renew_rehearsal_admin@127.0.0.1:$port/staff_mcp" \
  node --import tsx "$repo_root/scripts/rehearsals/staff-mcp-oauth-proof.ts"

# describe_table reads keys and relations through the real pg driver.
STAFF_MCP_REHEARSAL_DATABASE_URL="postgresql://renew_rehearsal_admin@127.0.0.1:$port/staff_mcp" \
  node --import tsx "$repo_root/scripts/rehearsals/staff-mcp-catalog-proof.ts"

# Removing a person removes their connection.
"${psql[@]}" >/dev/null <<'SQL'
DO $$
BEGIN
  IF (SELECT count(*) FROM public."oauthAccessToken") = 0 THEN RAISE EXCEPTION 'no_tokens_issued'; END IF;
  DELETE FROM public."user";
  IF (SELECT count(*) FROM public."oauthAccessToken") <> 0 THEN RAISE EXCEPTION 'tokens_survived_user_removal'; END IF;
END $$;
SQL
echo 'Staff MCP OAuth disposable persistence checks passed.'
