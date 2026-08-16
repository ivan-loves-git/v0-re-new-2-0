#!/usr/bin/env bash
# Run only against a disposable database that already has migrations 093, 094
# and 098. It applies W-110 then rolls all test data back.
set -euo pipefail

db="${W110_REHEARSAL_DATABASE_URL:-postgresql://localhost:55439/renew_m21a}"
root="$(cd "$(dirname "$0")" && pwd)"
psql -X "$db" -v ON_ERROR_STOP=1 -f "$root/099_external_pursuit_capacity_freshness.sql"
psql -X "$db" -v ON_ERROR_STOP=1 -f "$root/rehearse-external-pursuit-capacity.sql"
echo "W-110 External Pursuit capacity rehearsal passed."
