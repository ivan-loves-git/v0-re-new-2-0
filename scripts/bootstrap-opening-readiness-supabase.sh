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
require_exact QA_EXECUTION_MODE github-runner

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

# The sanitized structure snapshot deliberately omits the real Acme/Bertrand
# singleton while retaining its redacted integrity function. Reconstruct the
# established synthetic support context used by the W-169 rehearsal so every
# opportunity trigger remains enabled without copying private production data.
"${psql_safe[@]}" <<'SQL'
SET session_replication_role = replica;
INSERT INTO public.ma_firms(id,name,status,created_by) VALUES
  ('93000000-0000-4000-8000-000000000081','Acme Co.','active','qa-opening-schema-support');
INSERT INTO public.ma_offices(id,firm_id,name,status,is_default,city,created_by) VALUES
  ('93000000-0000-4000-8000-000000000082','93000000-0000-4000-8000-000000000081','Acme Paris','active',false,'Paris','qa-opening-schema-support');
INSERT INTO public.ma_contacts(id,first_name,display_name,status,email,created_by) VALUES
  ('93000000-0000-4000-8000-000000000083','Schema','TEST-schema-redacted-person','active','test-schema-redacted-003','qa-opening-schema-support'),
  ('93000000-0000-4000-8000-000000000084','Email','QA OPENING SCHEMA EMAIL — SYNTHETIC','active','test-schema-redacted-001','qa-opening-schema-support');
INSERT INTO public.ma_contact_office_affiliations(
  id,contact_id,office_id,is_active,created_by
) VALUES (
  '93000000-0000-4000-8000-000000000085',
  '93000000-0000-4000-8000-000000000083',
  '93000000-0000-4000-8000-000000000082',
  true,
  'qa-opening-schema-support'
);
INSERT INTO public.ma_provisional_source_contexts(
  context_key,firm_id,office_id,contact_id,affiliation_id
) VALUES (
  'acme_co_paris',
  '93000000-0000-4000-8000-000000000081',
  '93000000-0000-4000-8000-000000000082',
  '93000000-0000-4000-8000-000000000083',
  '93000000-0000-4000-8000-000000000085'
);
INSERT INTO public.app_user_roles(id,email,role) VALUES
  ('93000000-0000-4000-8000-000000000086','test-schema-redacted-002','staff');
RESET session_replication_role;

DO $$
BEGIN
  PERFORM public.assert_ma_provisional_source_context_integrity();
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger trigger
    JOIN pg_class relation ON relation.oid=trigger.tgrelid
    JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace
    WHERE namespace.nspname='public'
      AND relation.relname='opportunities'
      AND trigger.tgname='enforce_ma_provisional_source_review_on_opportunity'
      AND NOT trigger.tgisinternal
      AND trigger.tgenabled = 'O'
  ) THEN
    RAISE EXCEPTION 'opening_fixture_acme_trigger_missing_or_disabled';
  END IF;
END
$$;

INSERT INTO public.opportunities(
  id,reference,status,description,source_identity_to_verify,created_by
) VALUES (
  '93000000-0000-4000-8000-000000000087',
  'QA-OPENING-SOURCE-GUARD',
  'draft',
  'Synthetic generic source-review guard proof',
  true,
  'qa-opening-schema-support'
);

DO $$
BEGIN
  IF NOT public.ma_opportunity_source_review_required(
    '93000000-0000-4000-8000-000000000087'
  ) THEN
    RAISE EXCEPTION 'opening_fixture_generic_source_flag_not_gated';
  END IF;

  BEGIN
    UPDATE public.opportunities
    SET status='closed'
    WHERE id='93000000-0000-4000-8000-000000000087';
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'opening_fixture_flagged_close_was_allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ma_provisional_source_review_blocks_opportunity_lifecycle_exit' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    UPDATE public.opportunities
    SET status='archived'
    WHERE id='93000000-0000-4000-8000-000000000087';
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'opening_fixture_flagged_archive_was_allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ma_provisional_source_review_blocks_opportunity_lifecycle_exit' THEN
      RAISE;
    END IF;
  END;
END
$$;

DELETE FROM public.opportunities
WHERE id='93000000-0000-4000-8000-000000000087';
SQL

# The structure snapshot intentionally contains no business rows. Add only the
# public France root needed to exercise the released canonical-geography create
# path, and make the database release control agree with the GitHub-runner UI.
"${psql_safe[@]}" <<'SQL'
INSERT INTO public.geography_nodes(
  id,stable_key,code,label,node_level,parent_id
) VALUES (
  '00000000-0000-4092-8000-000000000001','france','FR','France','country',NULL
);
INSERT INTO public.ma_w039_release_control(
  singleton,enforce_new_opportunity_geography,activated_by,activated_at
) VALUES (
  TRUE,TRUE,'qa-opening-schema-support',clock_timestamp()
);
SQL

# The sanitized snapshot and additive migrations predate the final ordered
# Ticket #94 cutover. Reconstruct the same strict creation endpoint used by the
# current application: the additive v2 writer must exist, while its omission-
# capable predecessor remains private for rollback only.
"${psql_safe[@]}" -f scripts/117_explicit_demo_real_creation.sql
"${psql_safe[@]}" -f scripts/118_ticket_94_strict_creation_cutover.sql
"${psql_safe[@]}" -f scripts/120_ticket_95_safe_classification_conversion.sql

# Script 119 is a sealed, manifest-bound production data treatment. The
# disposable database contains no historical cross-namespace rows, so replaying
# that one-time authority surface would add scope without improving this
# current-runtime lifecycle proof.

"${psql_safe[@]}" <<'SQL'
INSERT INTO public.wave_journey_settings(
  singleton,enabled,updated_at,updated_by
) VALUES (
  TRUE,FALSE,clock_timestamp(),'qa-opening-schema-support'
)
ON CONFLICT (singleton) DO NOTHING;

NOTIFY pgrst, 'reload schema';
DO $$
BEGIN
  IF (SELECT count(*) FROM public.wave_journey_settings WHERE singleton) <> 1
    OR (SELECT enabled FROM public.wave_journey_settings WHERE singleton)
  THEN
    RAISE EXCEPTION 'opening_fixture_journey_baseline_mismatch';
  END IF;
  IF to_regprocedure(
    'public.create_opportunity_with_office_context_v2(text,uuid,uuid[],uuid,text,public.opportunity_status,text,jsonb)'
  ) IS NULL
    OR to_regprocedure(
      'public.create_opportunity_with_office_context_legacy_118(text,uuid,uuid[],uuid,text,public.opportunity_status,text,jsonb)'
    ) IS NULL
    OR to_regprocedure(
      'public.create_opportunity_with_office_context(text,uuid,uuid[],uuid,text,public.opportunity_status,text,jsonb)'
    ) IS NOT NULL
  THEN
    RAISE EXCEPTION 'opening_fixture_strict_opportunity_creator_missing';
  END IF;
  IF NOT has_function_privilege(
      'service_role',
      'public.create_opportunity_with_office_context_v2(text,uuid,uuid[],uuid,text,public.opportunity_status,text,jsonb)',
      'EXECUTE'
    )
    OR has_function_privilege(
      'anon',
      'public.create_opportunity_with_office_context_v2(text,uuid,uuid[],uuid,text,public.opportunity_status,text,jsonb)',
      'EXECUTE'
    )
    OR has_function_privilege(
      'authenticated',
      'public.create_opportunity_with_office_context_v2(text,uuid,uuid[],uuid,text,public.opportunity_status,text,jsonb)',
      'EXECUTE'
    )
    OR has_function_privilege(
      'service_role',
      'public.create_opportunity_with_office_context_legacy_118(text,uuid,uuid[],uuid,text,public.opportunity_status,text,jsonb)',
      'EXECUTE'
    )
  THEN
    RAISE EXCEPTION 'opening_fixture_strict_opportunity_creator_authority_mismatch';
  END IF;
  IF to_regprocedure(
      'public.set_zero_match_demo_classification(text,uuid,boolean,text)'
    ) IS NULL
    OR NOT has_function_privilege(
      'service_role',
      'public.set_zero_match_demo_classification(text,uuid,boolean,text)',
      'EXECUTE'
    )
    OR has_function_privilege(
      'anon',
      'public.set_zero_match_demo_classification(text,uuid,boolean,text)',
      'EXECUTE'
    )
    OR has_function_privilege(
      'authenticated',
      'public.set_zero_match_demo_classification(text,uuid,boolean,text)',
      'EXECUTE'
    )
  THEN
    RAISE EXCEPTION 'opening_fixture_classification_correction_authority_mismatch';
  END IF;
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
