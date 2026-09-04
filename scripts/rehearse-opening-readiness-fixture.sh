#!/usr/bin/env bash
set -euo pipefail

bash scripts/bootstrap-opening-readiness-supabase.sh

evidence_dir="${RUNNER_TEMP:-/tmp}/opening-readiness-evidence"
mkdir -p "$evidence_dir"

pnpm tsx scripts/verify-opening-readiness-mail.ts \
  | tee "$evidence_dir/mail-boundary.jsonl"
pnpm tsx scripts/create-opening-readiness-inputs.ts \
  | tee "$evidence_dir/document-inputs.jsonl"

pnpm tsx scripts/opening-readiness-fixture.ts setup \
  | tee "$evidence_dir/setup.jsonl"
pnpm tsx scripts/opening-readiness-fixture.ts readback \
  | tee "$evidence_dir/readback.jsonl"

service_code=$(curl --silent --output "$evidence_dir/service-role-readback.json" --write-out '%{http_code}' \
  "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/repreneurs?id=in.(93000000-0000-4000-8000-000000000011,93000000-0000-4000-8000-000000000012)&select=id,is_demo" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}")
if [[ "$service_code" != "200" ]] \
  || [[ "$(jq 'length' "$evidence_dir/service-role-readback.json")" != "2" ]]; then
  echo "Opening fixture service-role readback failed." >&2
  exit 1
fi

anon_code=$(curl --silent --output "$evidence_dir/anon-readback.json" --write-out '%{http_code}' \
  "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/repreneurs?select=id" \
  -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${NEXT_PUBLIC_SUPABASE_ANON_KEY}")
if [[ "$anon_code" == "200" ]] && [[ "$(jq 'length' "$evidence_dir/anon-readback.json")" != "0" ]]; then
  echo "Opening fixture anonymous product-data denial failed." >&2
  exit 1
fi

pnpm tsx scripts/opening-readiness-fixture.ts cleanup \
  | tee "$evidence_dir/cleanup-first.jsonl"
pnpm tsx scripts/opening-readiness-fixture.ts cleanup \
  | tee "$evidence_dir/cleanup-rerun.jsonl"

# Leave a fresh copy in place for the browser/product harness. The final
# cleanup boundary is whole-stack destruction, because that later journey may
# create immutable evidence which must never be row-deleted.
pnpm tsx scripts/opening-readiness-fixture.ts setup \
  | tee "$evidence_dir/browser-setup.jsonl"

jq -n \
  --arg releaseSha "$OPENING_FIXTURE_RELEASE_SHA" \
  --arg serviceRoleStatus "$service_code" \
  --arg anonymousStatus "$anon_code" \
  '{releaseSha: $releaseSha, serviceRoleStatus: $serviceRoleStatus, anonymousStatus: $anonymousStatus, productionCredentials: false, productionData: false, outboundProvider: false, cleanupRerunnable: true, finalCleanupBoundary: "whole disposable stack"}' \
  | tee "$evidence_dir/authority.json"
