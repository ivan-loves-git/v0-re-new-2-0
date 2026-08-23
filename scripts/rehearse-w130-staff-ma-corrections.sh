#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
cluster_dir="$(mktemp -d /private/tmp/renew-w130-postgres.XXXXXX)"
port="${W130_REHEARSAL_PORT:-55470}"
cleanup() { [ ! -f "$cluster_dir/postmaster.pid" ] || "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$cluster_dir"; }
trap cleanup EXIT
"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 --auth-local=trust --auth-host=trust >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -o "-p $port -h 127.0.0.1" -w start >/dev/null
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" w130_rehearsal
cd "$repo_root/scripts"
"$pg_bin/psql" -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -d w130_rehearsal -f rehearse-w130-staff-ma-corrections.sql
for role in anon authenticated; do
  if "$pg_bin/psql" -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -d w130_rehearsal -c "SET ROLE $role; SELECT * FROM public.update_ma_firm_correction('00000000-0000-4000-8000-000000000001','Denied',NULL,NULL,NULL,NULL,'$role');" >/dev/null 2>&1; then
    echo "W-130 $role unexpectedly executed a correction RPC" >&2
    exit 1
  fi
done
echo "W-130 isolated migration rehearsal passed"
