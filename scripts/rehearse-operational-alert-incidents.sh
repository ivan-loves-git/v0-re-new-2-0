#!/usr/bin/env bash
set -euo pipefail

# Disposable SQL and two-session concurrency proof. It never reads production
# credentials or reaches Resend/Vercel/Supabase.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
cluster_dir="$(mktemp -d "${TMPDIR:-/tmp}/renew-operational-alerts.XXXXXX")"
port=$((56000 + RANDOM % 7000))
cleanup() {
  if [[ -f "$cluster_dir/postmaster.pid" ]]; then "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true; fi
  case "$cluster_dir" in "${TMPDIR:-/tmp}"/renew-operational-alerts.*) rm -rf "$cluster_dir" ;; esac
}
trap cleanup EXIT
"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 --auth-local=trust --username=renew_alert_admin >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -l "$cluster_dir/postgres.log" -o "-c listen_addresses='' -k $cluster_dir -p $port" -w start >/dev/null
"$pg_bin/createdb" -h "$cluster_dir" -p "$port" -U renew_alert_admin renew_alert_fixture
psql=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h "$cluster_dir" -p "$port" -U renew_alert_admin -d renew_alert_fixture)

"${psql[@]}" >/dev/null <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE EXTENSION pgcrypto;
SQL

# Red seam: the assertions require the absent public RPC and must fail before
# the migration is applied.
if "${psql[@]}" -f "$repo_root/scripts/rehearsals/operational-alert-incidents-assert.sql" >/dev/null 2>&1; then
  echo "Operational-alert assertions unexpectedly passed before migration" >&2
  exit 1
fi
"${psql[@]}" -f "$repo_root/supabase/migrations/20261010120000_operational_alert_incidents.sql" >/dev/null
"${psql[@]}" -f "$repo_root/scripts/rehearsals/operational-alert-incidents-assert.sql" >/dev/null

# Two independent service sessions observe the same incident concurrently;
# locking must leave one active episode and one opening notification.
query="SELECT public.critical_alert_observe('cron.private_upload_cleanup','storage_failed','production','release-z','WAVE <alerts@example.test>','ops@example.test');"
"${psql[@]}" -c "SET ROLE service_role; $query" >"$cluster_dir/observe-one.out" 2>&1 &
one_pid=$!
"${psql[@]}" -c "SET ROLE service_role; $query" >"$cluster_dir/observe-two.out" 2>&1 &
two_pid=$!
wait "$one_pid"
wait "$two_pid"
if [[ "$("${psql[@]}" -Atc "SELECT count(*) FROM public.critical_alert_incidents WHERE operation='cron.private_upload_cleanup' AND state='active'")" != "1" ]]; then
  echo "Concurrent observations created more than one active incident" >&2; exit 1
fi
if [[ "$("${psql[@]}" -Atc "SELECT count(*) FROM public.critical_alert_notifications n JOIN public.critical_alert_incidents i ON i.id=n.incident_id WHERE i.operation='cron.private_upload_cleanup' AND n.kind='opening'")" != "1" ]]; then
  echo "Concurrent observations created more than one opening notification" >&2; exit 1
fi

# Observe and the daily claimer contend on the same expired lease. Both lock
# the episode before notification state, so either may reclaim it but neither
# may deadlock or mint a replacement provider key.
seed="$(${psql[@]} -Atc "SET ROLE service_role; SELECT public.critical_alert_observe('cron.interview_reminders','provider_unavailable','production','release-race','WAVE <alerts@example.test>','ops@example.test')")"
seed_id="$(printf '%s' "$seed" | sed -n 's/.*\"id\": \"\([^\"]*\)\".*/\1/p')"
if [[ -z "$seed_id" ]]; then echo "Could not seed observe-vs-claimer race" >&2; exit 1; fi
"${psql[@]}" -c "UPDATE public.critical_alert_notifications SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id='$seed_id'::uuid" >/dev/null
"${psql[@]}" -c "SET ROLE service_role; SELECT public.critical_alert_observe('cron.interview_reminders','provider_unavailable','production','release-race','WAVE <alerts@example.test>','ops@example.test')" >"$cluster_dir/race-observe.out" 2>&1 &
observe_pid=$!
"${psql[@]}" -c "SET ROLE service_role; SELECT * FROM public.critical_alert_claim_due('WAVE <alerts@example.test>','ops@example.test',8)" >"$cluster_dir/race-claim.out" 2>&1 &
claim_pid=$!
wait "$observe_pid"
wait "$claim_pid"
if [[ "$("${psql[@]}" -Atc "SELECT count(*) FROM public.critical_alert_notifications n JOIN public.critical_alert_incidents i ON i.id=n.incident_id WHERE i.operation='cron.interview_reminders' AND n.kind='opening'")" != "1" ]]; then
  echo "Observe-vs-claimer race minted a replacement opening notification" >&2; exit 1
fi

# The public and authenticated roles cannot read the ledger or invoke its RPCs.
if "${psql[@]}" -c "SET ROLE anon; SELECT * FROM public.critical_alert_incidents" >/dev/null 2>&1; then
  echo "anon could read operational alert incidents" >&2; exit 1
fi
if "${psql[@]}" -c "SET ROLE authenticated; SELECT public.critical_alert_observe('cron.discovery_digest','internal_error','production','r','a','b')" >/dev/null 2>&1; then
  echo "authenticated could invoke operational alert RPC" >&2; exit 1
fi
echo "Operational-alert incident ledger: bounded episodes, frozen retry identity, quiet/reopen behavior, service-only access and concurrent observations passed"
