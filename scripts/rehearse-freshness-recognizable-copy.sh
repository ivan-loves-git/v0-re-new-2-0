#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
cluster_dir="$(mktemp -d "${TMPDIR:-/tmp}/renew-freshness-copy.XXXXXX")"
port="${FRESHNESS_REHEARSAL_PORT:-55488}"
cleanup() {
  if [ -f "$cluster_dir/postmaster.pid" ]; then "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true; fi
  case "$cluster_dir" in */renew-freshness-copy.*) rm -rf "$cluster_dir" ;; esac
}
trap cleanup EXIT
"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 --auth-local=trust --auth-host=trust --username=renew_freshness_admin >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -l "$cluster_dir/postgres.log" -o "-p $port -h 127.0.0.1 -k $cluster_dir" -w start >/dev/null
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" -U renew_freshness_admin renew_freshness_rehearsal
psql=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -U renew_freshness_admin -d renew_freshness_rehearsal)
"${psql[@]}" -f "$repo_root/scripts/rehearsals/opportunity-freshness-fixture.sql" >/dev/null
"${psql[@]}" -f "$repo_root/scripts/121_staff_email_review_queue.sql" >/dev/null
# Use migration 079's real helper body, not a permissive duplicate that could
# accidentally conflate its provisional-source review with the independent
# source_identity_to_verify flag.
sed -n '/^CREATE OR REPLACE FUNCTION public.ma_opportunity_source_review_required(/,/^\$\$;/p' \
  "$repo_root/scripts/079_provisional_acme_source_foundation.sql" | "${psql[@]}" >/dev/null
awk '
  /^CREATE OR REPLACE FUNCTION public\.(reserve|refresh|release)_ma_source_email_send\(/ { inside=1 }
  inside { print }
  inside && /^\$\$;/ { inside=0 }
' "$repo_root/scripts/079_provisional_acme_source_foundation.sql" | "${psql[@]}" >/dev/null
"${psql[@]}" -f "$repo_root/scripts/129_opportunity_freshness_reviews.sql" >/dev/null
"${psql[@]}" -c "ALTER TABLE public.opportunities ADD COLUMN revenue_meur numeric; UPDATE public.opportunities SET revenue_meur=3.2 WHERE reference='A-01';" >/dev/null
"${psql[@]}" -f "$repo_root/supabase/migrations/20261008160000_freshness_recognizable_copy.sql" >/dev/null
"${psql[@]}" -f "$repo_root/scripts/rehearsals/freshness-recognizable-copy.sql"
review_id="$("${psql[@]}" -Atc "SELECT public.opportunity_freshness_prepare('18700000-0000-4000-8000-000000000003',(SELECT jsonb_agg(c) FROM public.opportunity_freshness_candidates('18700000-0000-4000-8000-000000000003',now(),true,NULL) c),'Statut','Alpine (CA : 3,2 M€) et Bay','copy-v1')")"
# Independent editors: a stale version may not overwrite the first staff edit.
"${psql[@]}" -Atc "BEGIN; SELECT public.opportunity_freshness_edit('$review_id',1,'Statut','Alpine (CA : 3,2 M€) et Bay — first staff edit','staff-1'); SELECT pg_sleep(1); COMMIT" >"$cluster_dir/edit-first.out" 2>&1 &
first_pid=$!
sleep 0.2
if "${psql[@]}" -Atc "SELECT public.opportunity_freshness_replace_words('$review_id',1,'Statut','Alpine (CA : 3,2 M€) et Bay — stale replacement','copy-v2','staff-1')" >/dev/null 2>&1; then
 echo "Concurrent replacement overwrote a newer staff version" >&2; exit 1
fi
wait "$first_pid"
"${psql[@]}" -Atc "SELECT public.opportunity_freshness_acknowledge_copy('$review_id',2,'staff-1')" >/dev/null
# Reservation first: the new revenue field must wait and then be rejected.
"${psql[@]}" -Atc "BEGIN; SELECT public.opportunity_freshness_reserve('$review_id',2,'{\"subject\":\"Statut\",\"text\":\"Alpine (CA : 3,2 M€) et Bay — first staff edit\"}'::jsonb,repeat('a',64),'staff-1'); SELECT pg_sleep(1); COMMIT" >"$cluster_dir/reserve-first.out" 2>&1 &
reserve_pid=$!
sleep 0.2
if "${psql[@]}" -Atc "UPDATE public.opportunities SET revenue_meur=9 WHERE reference='A-01'" >/dev/null 2>&1; then
 echo "Revenue update crossed a reserved send lease" >&2; exit 1
fi
wait "$reserve_pid"
echo "Freshness recognizable-copy: draft updates, exact revenue, history and independent-session races passed"
