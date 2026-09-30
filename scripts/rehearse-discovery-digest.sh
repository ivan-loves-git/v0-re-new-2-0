#!/usr/bin/env bash
set -euo pipefail

# Ticket #136: disposable PostgreSQL 17 only. Never connect to production or a provider.
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
fixture_root="${TMPDIR:-/private/tmp}"
fixture_root="${fixture_root%/}"
cluster_dir="$(mktemp -d "$fixture_root/renew-digest136.XXXXXX")"
port=$((56000 + RANDOM % 7000))
cleanup() {
  if [[ -f "$cluster_dir/postmaster.pid" ]]; then "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true; fi
  case "$cluster_dir" in "$fixture_root"/renew-digest136.*) rm -rf -- "$cluster_dir" ;; esac
}
trap cleanup EXIT
"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 --auth-local=trust --username=renew_digest_admin >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -l "$cluster_dir/postgres.log" -o "-c listen_addresses='' -k $cluster_dir -p $port" -w start >/dev/null
"$pg_bin/createdb" -h "$cluster_dir" -p "$port" -U renew_digest_admin renew_digest_fixture
psql=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h "$cluster_dir" -p "$port" -U renew_digest_admin -d renew_digest_fixture)
"${psql[@]}" >/dev/null <<'SQL'
CREATE ROLE postgres LOGIN SUPERUSER;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA extensions;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT NULL::uuid';
SQL
"${psql[@]}" -f "$repo_root/supabase/schema/771_extensions.sql" >/dev/null
"${psql[@]}" -f "$repo_root/supabase/schema/771_public_schema.sql" >/dev/null
"${psql[@]}" >/dev/null <<'SQL'
ALTER TABLE public.opportunities ADD COLUMN is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.opportunities ADD COLUMN public_description_approved_hash text;
ALTER TABLE public.opportunities ADD COLUMN public_description_approved_at timestamptz;
ALTER TABLE public.opportunities ADD COLUMN public_description_approved_by text;
ALTER TABLE public.repreneurs ADD COLUMN is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.opportunities DROP CONSTRAINT opportunities_active_or_paused_requires_source_office;
-- This fixture has no M&A source network; keep the unrelated deferred review
-- trigger from treating fictional opportunities as provisional source imports.
ALTER TABLE public.opportunities DISABLE TRIGGER enforce_ma_provisional_source_review_on_opportunity;
ALTER TABLE public.opportunities DISABLE TRIGGER enforce_opportunity_office_context_on_opportunity;
CREATE FUNCTION public.w175_assignment_recipient_email(p_email text) RETURNS text
  LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT CASE WHEN lower(btrim(p_email)) ~ '^[a-z0-9._%+-]+@[a-z0-9.-]+[.][a-z]{2,}$'
    THEN lower(btrim(p_email)) ELSE NULL END $$;
CREATE FUNCTION public.has_approved_public_description(p_text text,p_hash text,p_at timestamptz,p_by text)
  RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT coalesce(nullif(btrim(p_text),'') IS NOT NULL AND p_at IS NOT NULL
    AND nullif(btrim(p_by),'') IS NOT NULL
    AND p_hash=encode(sha256(convert_to(p_text,'UTF8')),'hex'),false) $$;
CREATE FUNCTION public.create_opportunity_with_office_context_v2(
  p_reference text,p_source_office_id uuid DEFAULT NULL,p_affiliation_ids uuid[] DEFAULT ARRAY[]::uuid[],
  p_primary_affiliation_id uuid DEFAULT NULL,p_description text DEFAULT NULL,
  p_target_status public.opportunity_status DEFAULT 'draft',p_actor text DEFAULT NULL,
  p_opportunity_fields jsonb DEFAULT '{}'::jsonb
) RETURNS public.opportunities LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.opportunities%ROWTYPE;
BEGIN
  IF jsonb_typeof(p_opportunity_fields->'is_demo') IS DISTINCT FROM 'boolean' THEN
    RAISE EXCEPTION 'classification_required'; END IF;
  INSERT INTO public.opportunities(reference,status,created_by,is_demo,public_title,teaser_summary,repreneur_exposure)
  VALUES(p_reference,p_target_status,p_actor,(p_opportunity_fields->>'is_demo')::boolean,
    p_opportunity_fields->>'public_title',p_opportunity_fields->>'teaser_summary',
    CASE WHEN p_target_status='active' THEN 'anonymized'::public.opportunity_visibility
      ELSE 'staff_only'::public.opportunity_visibility END)
  RETURNING * INTO v;
  RETURN v;
END $$;
SQL
"${psql[@]}" -f "$repo_root/supabase/migrations/20260930040401_future_discovery_digest.sql" >/dev/null
for denied_role in anon authenticated service_role; do
  if "${psql[@]}" -At -c "SET ROLE $denied_role; SELECT public.d136_initialize_cutover('staff-d136','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')" >"$cluster_dir/release-denial.txt" 2>&1; then
    echo "$denied_role could invoke privileged cutover" >&2; exit 1
  fi
  if ! grep -q 'permission denied for function d136_initialize_cutover' "$cluster_dir/release-denial.txt"; then
    echo "$denied_role cutover denial was not an EXECUTE ACL denial" >&2; exit 1
  fi
done
"${psql[@]}" -f "$repo_root/scripts/rehearsals/discovery-digest-after.sql" >/dev/null

# Actual database-role denial, beyond catalogue privilege introspection.
if "${psql[@]}" -At -c 'SET ROLE anon; SELECT count(*) FROM public.discovery_digest_deliveries' >/dev/null 2>&1; then
  echo 'anon read private digest deliveries' >&2; exit 1
fi
if "${psql[@]}" -At -c 'SET ROLE authenticated; SELECT public.d136_claim(gen_random_uuid())' >/dev/null 2>&1; then
  echo 'authenticated role claimed digest delivery' >&2; exit 1
fi

# Two independent PostgreSQL sessions race the same durable delivery. Session
# B must wait for session A's row lock and then observe its committed claim.
race_id="$("${psql[@]}" -At -c "SELECT d.id FROM public.discovery_digest_deliveries d JOIN public.discovery_digest_windows w ON w.id=d.window_id JOIN public.discovery_digest_epochs e ON e.id=w.epoch_id WHERE e.deactivated_at IS NULL AND d.repreneur_id='13600000-0000-4000-8000-000000000001'")"
[[ "$race_id" =~ ^[0-9a-f-]{36}$ ]] || { echo 'fictional race delivery missing' >&2; exit 1; }
"${psql[@]}" -At >"$cluster_dir/claim-a.txt" <<SQL &
BEGIN;
SELECT id FROM public.discovery_digest_deliveries WHERE id='$race_id' FOR UPDATE;
SELECT pg_sleep(2);
SELECT public.d136_claim('$race_id')->>'status';
COMMIT;
SQL
claim_pid=$!
locked=0
for _ in {1..40}; do
  if [[ "$("${psql[@]}" -At -c "SELECT count(*) FROM pg_stat_activity WHERE query LIKE 'SELECT pg_sleep(2)%' AND state='active'")" == 1 ]]; then
    locked=1; break
  fi
  sleep 0.05
done
[[ "$locked" == 1 ]] || { echo 'claim race row lock was not observed' >&2; wait "$claim_pid"; exit 1; }
race_b="$("${psql[@]}" -At -c "SELECT public.d136_claim('$race_id')->>'status'")"
wait "$claim_pid"
if ! grep -qx 'claimed' "$cluster_dir/claim-a.txt" || [[ "$race_b" != busy ]]; then
  echo 'independent session duplicate claim was not fenced' >&2; exit 1
fi
echo "Ticket #136 disposable PG17 rehearsal passed"
