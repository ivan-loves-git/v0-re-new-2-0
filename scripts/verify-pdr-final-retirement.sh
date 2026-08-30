#!/usr/bin/env bash
set -euo pipefail

: "${DIRECT_URL:?DIRECT_URL is required}"
: "${NEXT_PUBLIC_SUPABASE_URL:?NEXT_PUBLIC_SUPABASE_URL is required}"
: "${NEXT_PUBLIC_SUPABASE_ANON_KEY:?NEXT_PUBLIC_SUPABASE_ANON_KEY is required}"

for command_name in curl jq psql; do
  command -v "$command_name" >/dev/null || {
    echo "Missing required command: $command_name" >&2
    exit 1
  }
done

supabase_origin="${NEXT_PUBLIC_SUPABASE_URL%/}"
object_name="$(psql "$DIRECT_URL" --no-psqlrc --tuples-only --no-align --set=ON_ERROR_STOP=1 --command "SELECT name FROM storage.objects WHERE bucket_id='pdr-attachments' ORDER BY name LIMIT 1;")"
if [[ -z "$object_name" ]]; then
  echo "No legacy object is available for the public Storage HTTP proof" >&2
  exit 1
fi

encoded_object="$(jq -nr --arg value "$object_name" '$value | @uri')"
public_status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' "$supabase_origin/storage/v1/object/public/pdr-attachments/$encoded_object")"
case "$public_status" in
  4??) ;;
  *)
    echo "Legacy public object endpoint returned an unexpected status: HTTP $public_status" >&2
    exit 1
    ;;
esac

anonymous_object_status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
  --header "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  --header "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  "$supabase_origin/storage/v1/object/authenticated/pdr-attachments/$encoded_object")"
case "$anonymous_object_status" in
  4??) ;;
  *)
    echo "Anonymous legacy object endpoint returned an unexpected status: HTTP $anonymous_object_status" >&2
    exit 1
    ;;
esac

for table_name in pdr_proposals pdr_work_cards; do
  table_status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
    --header "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
    --header "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
    "$supabase_origin/rest/v1/$table_name?select=id&limit=1")"
  case "$table_status" in
    4??) ;;
    *)
      echo "Anonymous $table_name read returned an unexpected status: HTTP $table_status" >&2
      exit 1
      ;;
  esac
  echo "$table_name anonymous read: HTTP $table_status"
done

echo "Legacy public object endpoint: HTTP $public_status"
echo "Anonymous legacy object endpoint: HTTP $anonymous_object_status"
echo "PDR final-retirement HTTP verification passed"
