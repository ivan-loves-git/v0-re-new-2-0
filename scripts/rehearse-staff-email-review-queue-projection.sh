#!/usr/bin/env bash
set -euo pipefail

# Disposable PostgreSQL proof for #221/#222. No application credentials or customer data.
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
pg_bin="/opt/homebrew/opt/postgresql@17/bin"
cluster_dir="$(mktemp -d "/tmp/renew-email-queue-projection.XXXXXX")"
port=$((55000 + RANDOM % 9000))
cleanup() {
  if [ -f "$cluster_dir/postmaster.pid" ]; then "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true; fi
  case "$cluster_dir" in */renew-email-queue-projection.*) rm -rf "$cluster_dir" ;; esac
}
trap cleanup EXIT

"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 --auth-local=trust --username=renew_queue_admin >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -l "$cluster_dir/postgres.log" -o "-c listen_addresses='' -k $cluster_dir -p $port" -w start >/dev/null
"$pg_bin/createdb" -h "$cluster_dir" -p "$port" -U renew_queue_admin renew_queue_fixture
psql=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h "$cluster_dir" -p "$port" -U renew_queue_admin -d renew_queue_fixture)

"$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h "$cluster_dir" -p "$port" -U renew_queue_admin -d renew_queue_fixture -f "$repo_root/scripts/rehearsals/staff-email-review-queue-projection.sql" >/dev/null
"$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h "$cluster_dir" -p "$port" -U renew_queue_admin -d renew_queue_fixture -f "$repo_root/scripts/130_staff_email_review_queue_projection.sql" >/dev/null

"$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h "$cluster_dir" -p "$port" -U renew_queue_admin -d renew_queue_fixture -f "$repo_root/scripts/rehearsals/staff-email-review-queue-projection-assert.sql" >/dev/null
if "${psql[@]}" -c "SET ROLE anon; SELECT id FROM public.staff_email_review_queue LIMIT 1" >/dev/null 2>&1; then
  echo "Anonymous role read the private email queue" >&2
  exit 1
fi
if "${psql[@]}" -c "SET ROLE authenticated; SELECT id FROM public.staff_email_review_queue LIMIT 1" >/dev/null 2>&1; then
  echo "Authenticated browser role read the private email queue" >&2
  exit 1
fi
"${psql[@]}" -c "SET ROLE service_role; SELECT count(*) FROM public.staff_email_review_queue" >/dev/null
echo "#221/#222 disposable queue SQL: canonical joins, all purpose types, pre-page search/sorts, stable ties and role denial passed"
