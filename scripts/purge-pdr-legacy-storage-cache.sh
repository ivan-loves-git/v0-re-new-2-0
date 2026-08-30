#!/usr/bin/env bash
set -euo pipefail

: "${NEXT_PUBLIC_SUPABASE_URL:?NEXT_PUBLIC_SUPABASE_URL is required}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY is required}"

command -v curl >/dev/null || {
  echo "Missing required command: curl" >&2
  exit 1
}

supabase_origin="${NEXT_PUBLIC_SUPABASE_URL%/}"
curl --silent --show-error --fail-with-body \
  --request DELETE \
  --header "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  --header "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  --output /dev/null \
  "$supabase_origin/storage/v1/cdn/pdr-attachments"

echo "Legacy PDR bucket CDN invalidation queued; require the HTTP verifier to pass"
