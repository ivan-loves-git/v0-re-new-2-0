#!/usr/bin/env bash
set -euo pipefail

# Runs the canonical pursuit journey on a brand-new local PostgreSQL 17
# cluster. It uses only deterministic TEST records and removes the cluster on
# exit; it never reads project environment values or contacts Supabase.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
cluster_dir="$(mktemp -d /private/tmp/renew-canonical-pursuit.XXXXXX)"
port="${W090_REHEARSAL_PORT:-55490}"

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

"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 --auth-local=trust --auth-host=trust >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -o "-p $port -h 127.0.0.1" -w start >/dev/null
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" canonical_pursuit_rehearsal

cd "$repo_root/scripts"
"$pg_bin/psql" -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -d canonical_pursuit_rehearsal -f rehearse-canonical-pursuit-evidence.sql
echo "Canonical pursuit lifecycle rehearsal passed with zero persistent residue"
