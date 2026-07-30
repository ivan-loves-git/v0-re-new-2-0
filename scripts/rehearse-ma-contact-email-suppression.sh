#!/usr/bin/env bash
set -euo pipefail

# Runs only against a fresh local PostgreSQL cluster under /private/tmp. It
# accepts no project environment values and never connects to Supabase.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@16/bin}"
cluster_dir="$(mktemp -d /private/tmp/renew-w072-postgres.XXXXXX)"
port="${W072_REHEARSAL_PORT:-55472}"

cleanup() {
  if [ -f "$cluster_dir/postmaster.pid" ]; then
    "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true
  fi
  rm -rf "$cluster_dir"
}
trap cleanup EXIT

for binary in initdb pg_ctl createdb psql; do
  if [ ! -x "$pg_bin/$binary" ]; then
    echo "Missing PostgreSQL binary: $pg_bin/$binary" >&2
    exit 1
  fi
done

"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 \
  --auth-local=trust --auth-host=trust >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" \
  -o "-p $port -h 127.0.0.1" -w start >/dev/null
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" w072_rehearsal

cd "$repo_root/scripts"
psql_base=(
  "$pg_bin/psql"
  -v ON_ERROR_STOP=1
  -h 127.0.0.1
  -p "$port"
  -d w072_rehearsal
)

"${psql_base[@]}" -f rehearse-ma-contact-email-suppression.sql

# A rerun must not re-enable a flagged contact after a later audited removal.
"${psql_base[@]}" -f 083_ma_contact_email_suppression.sql >/dev/null
rerun_state="$(
  "${psql_base[@]}" -At -c "
    SELECT campaign_email_suppressed::TEXT || ':' ||
      (
        SELECT COUNT(*)::TEXT
        FROM public.ma_contact_email_policy_events event
        WHERE event.contact_id = contact.id
          AND event.source_key = 'w010_import_backfill'
      )
    FROM public.ma_contacts contact
    WHERE contact.display_name = 'Suppressed 1';
  "
)"

if [ "$rerun_state" != "false:1" ]; then
  echo "W-072 rerun changed audited suppression state: $rerun_state" >&2
  exit 1
fi

echo "W-072 clean rerun and policy invariants passed"
