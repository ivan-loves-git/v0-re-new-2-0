#!/usr/bin/env bash
set -euo pipefail

# Disposable local concurrency proof for migration 111. The target database
# must be empty; no production credentials or data are used.
db_url="${W111_REHEARSAL_DATABASE_URL:-postgresql://localhost:55483/renew_w111}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
result_a="$(mktemp)"
result_b="$(mktemp)"
trap 'rm -f "$result_a" "$result_b"' EXIT

psql "$db_url" -v ON_ERROR_STOP=1 -f "$script_dir/rehearse-express-opportunity-interest.sql" >/dev/null

call_interest() {
  local timestamp="$1"
  psql "$db_url" -v ON_ERROR_STOP=1 -Atq \
    -c "SET ROLE service_role; SELECT expressed_at FROM public.express_opportunity_interest('20000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000001', 'repreneur-user-1', '${timestamp}'::timestamptz);"
}

call_interest '2026-08-21 08:00:00+00' >"$result_a" &
pid_a=$!
call_interest '2026-08-21 08:00:01+00' >"$result_b" &
pid_b=$!
wait "$pid_a"
wait "$pid_b"

test "$(sort -u "$result_a" "$result_b" | sed '/^$/d' | wc -l | tr -d ' ')" = "1"
test "$(psql "$db_url" -Atq -c "SELECT count(*) FROM public.opportunity_matches WHERE opportunity_id='20000000-0000-4000-8000-000000000014' AND repreneur_id='10000000-0000-4000-8000-000000000001' AND status='interested' AND interest_expressed_at IS NOT NULL;")" = "1"

echo 'W-111 exact staff-only interest concurrency rehearsal passed'
