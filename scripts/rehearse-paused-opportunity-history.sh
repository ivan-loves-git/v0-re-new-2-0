#!/usr/bin/env bash
set -euo pipefail
# The shared bootstrap owns explicit-root, PG17, socket-only and whole-cluster
# cleanup guards. It reads no project environment or provider credentials.
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
RENEW_PAUSED_HISTORY_REHEARSAL=1 bash "$script_dir/rehearse-external-pursuit-handoffs.sh"
