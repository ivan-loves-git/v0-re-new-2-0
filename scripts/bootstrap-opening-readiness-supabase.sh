#!/usr/bin/env bash
set -euo pipefail

require_exact() {
  local name="$1"
  local expected="$2"
  local actual="${!name-}"
  if [[ "$actual" != "$expected" ]]; then
    echo "Opening fixture refused: ${name} must equal ${expected}." >&2
    exit 1
  fi
}

require_exact CI true
require_exact GITHUB_ACTIONS true
require_exact QA_FIXTURE_MODE local
require_exact QA_CONTRACT_MODE protected
require_exact QA_MAIL_MODE allowlist

if [[ -n "${RESEND_API_KEY-}" ]]; then
  echo "Opening fixture refused: outbound provider credentials are present." >&2
  exit 1
fi

case "${OPENING_FIXTURE_DATABASE_URL-}" in
  postgresql://postgres:*@127.0.0.1:54322/postgres | postgres://postgres:*@127.0.0.1:54322/postgres) ;;
  *)
    echo "Opening fixture refused: database is not the fixed loopback Supabase database." >&2
    exit 1
    ;;
esac

if [[ "${NEXT_PUBLIC_SUPABASE_URL-}" != "http://127.0.0.1:54321" ]]; then
  echo "Opening fixture refused: API is not the fixed loopback Supabase API." >&2
  exit 1
fi

psql_safe=(psql -X -v ON_ERROR_STOP=1 "${OPENING_FIXTURE_DATABASE_URL}")

"${psql_safe[@]}" -f supabase/schema/771_extensions.sql
"${psql_safe[@]}" -f supabase/schema/771_preview_cleanup.sql
"${psql_safe[@]}" -f supabase/schema/771_public_schema.sql

# Build 771 predates three shipped application overlays that production already
# had before the first retained additive migration. Replaying these immutable,
# data-free schema inputs reconstructs that release boundary; it does not
# restore the retired persistent-QA control plane that once consumed them.
"${psql_safe[@]}" -f supabase/schema/822_demo_opportunity_quarantine.sql
"${psql_safe[@]}" -f supabase/schema/823_staff_ma_relationship_corrections.sql
"${psql_safe[@]}" -f supabase/schema/824_w128_draft_opportunity_activation.sql

"${psql_safe[@]}" <<'SQL'
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('cvs', 'cvs', false),
  ('opportunity-documents', 'opportunity-documents', false),
  ('external-pursuit-attachments', 'external-pursuit-attachments', false)
ON CONFLICT (id) DO UPDATE SET public = false;
SQL

while IFS= read -r migration; do
  "${psql_safe[@]}" -f "$migration"
done < <(
  find supabase/migrations -maxdepth 1 -type f -name '*.sql' -print \
    | LC_ALL=C sort \
    | awk -F/ '$NF >= "20260824093456" && $NF < "20260830113100"'
)

# The final PDR-retirement migration deliberately fails unless this exact
# restrictive policy is already staged by Supabase Storage. Local Supabase
# exposes that provider owner as a separate login on the same fixed loopback
# database; change only the username and preserve the ephemeral local password.
case "$OPENING_FIXTURE_DATABASE_URL" in
  postgresql://postgres:*)
    storage_owner_url="postgresql://supabase_storage_admin:${OPENING_FIXTURE_DATABASE_URL#postgresql://postgres:}"
    ;;
  postgres://postgres:*)
    storage_owner_url="postgres://supabase_storage_admin:${OPENING_FIXTURE_DATABASE_URL#postgres://postgres:}"
    ;;
  *)
    echo "Opening fixture refused: local storage-owner URL could not be derived." >&2
    exit 1
    ;;
esac
case "$storage_owner_url" in
  postgresql://supabase_storage_admin:*@127.0.0.1:54322/postgres | postgres://supabase_storage_admin:*@127.0.0.1:54322/postgres) ;;
  *)
    echo "Opening fixture refused: storage owner is not the fixed loopback database." >&2
    exit 1
    ;;
esac
psql -X -v ON_ERROR_STOP=1 "$storage_owner_url" \
  -f scripts/prestage-pdr-storage-guard.sql

"${psql_safe[@]}" <<'SQL'
DO $$
BEGIN
  IF (
    SELECT pg_get_userbyid(relation.relowner)
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace
    WHERE namespace.nspname='storage' AND relation.relname='objects'
  ) IS DISTINCT FROM 'supabase_storage_admin' THEN
    RAISE EXCEPTION 'opening_fixture_storage_owner_mismatch';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage'
      AND tablename='objects'
      AND policyname='wave_pdr_retire_legacy_attachment_browser_access'
      AND permissive='RESTRICTIVE'
      AND roles=ARRAY['anon','authenticated']::name[]
      AND cmd='ALL'
      AND qual='(bucket_id <> ''pdr-attachments''::text)'
      AND with_check='(bucket_id <> ''pdr-attachments''::text)'
  ) THEN
    RAISE EXCEPTION 'opening_fixture_storage_guard_mismatch';
  END IF;
END
$$;
SQL

while IFS= read -r migration; do
  "${psql_safe[@]}" -f "$migration"
done < <(
  find supabase/migrations -maxdepth 1 -type f -name '*.sql' -print \
    | LC_ALL=C sort \
    | awk -F/ '$NF >= "20260830113100"'
)

# The sanitized structure snapshot deliberately contains no real Acme/Bertrand
# singleton row, while this production-specific trigger requires that private
# row on every opportunity write. The opening fixture exercises only its own
# non-Acme synthetic offices, so disable exactly this unrelated trigger in the
# disposable loopback database. All general lifecycle and source-office guards
# remain enabled.
"${psql_safe[@]}" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger trigger
    JOIN pg_class relation ON relation.oid=trigger.tgrelid
    JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace
    WHERE namespace.nspname='public'
      AND relation.relname='opportunities'
      AND trigger.tgname='enforce_ma_provisional_source_review_on_opportunity'
      AND NOT trigger.tgisinternal
      AND trigger.tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION 'opening_fixture_acme_trigger_missing_or_disabled';
  END IF;
END
$$;
ALTER TABLE public.opportunities
  DISABLE TRIGGER enforce_ma_provisional_source_review_on_opportunity;
SQL

"${psql_safe[@]}" <<'SQL'
NOTIFY pgrst, 'reload schema';
DO $$
BEGIN
  IF current_database() <> 'postgres'
    OR EXISTS (SELECT 1 FROM public.repreneurs)
    OR EXISTS (SELECT 1 FROM public.opportunities)
    OR EXISTS (SELECT 1 FROM public."user")
    OR EXISTS (SELECT 1 FROM storage.objects)
  THEN
    RAISE EXCEPTION 'opening_fixture_bootstrap_not_empty_or_not_local';
  END IF;
END
$$;
SQL

for _ in $(seq 1 30); do
  status=$(curl --silent --output /dev/null --write-out '%{http_code}' \
    "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}")
  if [[ "$status" == "200" ]]; then
    exit 0
  fi
  sleep 1
done

echo "Opening fixture refused: PostgREST did not reload the reconstructed schema." >&2
exit 1
