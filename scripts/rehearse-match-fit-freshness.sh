#!/usr/bin/env bash
set -euo pipefail

# Ticket #121: synthetic PostgreSQL 17 only. No project credentials or mail.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
cluster_dir="$(mktemp -d "${TMPDIR:-/private/tmp}/renew-match-freshness.XXXXXX")"
port=$((56000 + RANDOM % 7000))
cleanup() {
  if [[ -f "$cluster_dir/postmaster.pid" ]]; then "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true; fi
  rm -rf "$cluster_dir"
}
trap cleanup EXIT
"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 --auth-local=trust --username=match_admin >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -l "$cluster_dir/postgres.log" -o "-c listen_addresses='' -k $cluster_dir -p $port" -w start >/dev/null
"$pg_bin/createdb" -h "$cluster_dir" -p "$port" -U match_admin match_fixture
psql=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h "$cluster_dir" -p "$port" -U match_admin -d match_fixture)

"${psql[@]}" -q <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE TYPE public.opportunity_match_recommendation AS ENUM ('not_evaluated','strong_fit','possible_fit','weak_fit','not_fit');
CREATE TABLE public.repreneurs (
  id uuid PRIMARY KEY, is_demo boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now(),
  q12_geo_zones jsonb, q13_target_sectors_v2 jsonb, sector_preferences jsonb, target_location jsonb,
  target_revenue_min_meur numeric, target_revenue_max_meur numeric,
  target_ebitda_min_keur numeric, target_ebitda_max_keur numeric,
  target_ebitda_margin_min_pct numeric, target_staff_size_min integer, target_staff_size_max integer
);
CREATE TABLE public.opportunities (
  id uuid PRIMARY KEY, is_demo boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now(),
  sector text, activity text, location text, revenue_meur numeric, ebitda_keur numeric,
  headcount integer, geography_node_id uuid
);
CREATE TABLE public.opportunity_matches (
  id uuid PRIMARY KEY, repreneur_id uuid NOT NULL REFERENCES public.repreneurs(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  platform_score integer, platform_recommendation public.opportunity_match_recommendation NOT NULL DEFAULT 'not_evaluated',
  platform_reasons text[] NOT NULL DEFAULT '{}', human_notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.geography_nodes (id uuid PRIMARY KEY, stable_key text NOT NULL UNIQUE, parent_id uuid REFERENCES public.geography_nodes(id));
CREATE TABLE public.repreneur_geography_targets (
  repreneur_id uuid NOT NULL REFERENCES public.repreneurs(id) ON DELETE CASCADE,
  geography_node_id uuid NOT NULL REFERENCES public.geography_nodes(id),
  PRIMARY KEY(repreneur_id,geography_node_id)
);
CREATE FUNCTION public.sync_repreneur_geography_targets_from_legacy()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
CREATE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER update_opportunity_matches_updated_at BEFORE UPDATE ON public.opportunity_matches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
GRANT SELECT ON public.opportunity_matches TO anon, authenticated;
SQL

"${psql[@]}" -q -f "$repo_root/supabase/migrations/20260930020751_guarded_match_fit_freshness.sql"

"${psql[@]}" -q <<'SQL'
INSERT INTO public.geography_nodes VALUES
  ('00000000-0000-4000-8000-000000000001','france',NULL),
  ('00000000-0000-4000-8000-000000000002','fr-region-idf','00000000-0000-4000-8000-000000000001');
INSERT INTO public.repreneurs(id,q12_geo_zones,q13_target_sectors_v2,target_revenue_min_meur)
  VALUES('00000000-0000-4000-8000-000000000011','["ile-de-france"]','["industry"]',1);
INSERT INTO public.opportunities(id,sector,location,revenue_meur,geography_node_id)
  VALUES('00000000-0000-4000-8000-000000000021','industry','Paris',2,'00000000-0000-4000-8000-000000000002');
INSERT INTO public.opportunity_matches(id,repreneur_id,opportunity_id,updated_at)
  VALUES('00000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000021','2020-01-01T00:00:00Z');
DO $$ BEGIN
  IF public.match_score_source_snapshot('00000000-0000-4000-8000-000000000031')->'match'->>'id'
     <> '00000000-0000-4000-8000-000000000031' THEN RAISE EXCEPTION 'snapshot_failed'; END IF;
END $$;
SQL

"${psql[@]}" -q <<'SQL'
DO $$
#variable_conflict use_variable
DECLARE
  match_id uuid := '00000000-0000-4000-8000-000000000031';
  snapshot jsonb := public.match_score_source_snapshot('00000000-0000-4000-8000-000000000031');
  rejected boolean;
BEGIN
  rejected := false;
  BEGIN
    INSERT INTO matching_private.match_score_provenance(match_id,platform_scoring_version,platform_inputs_hmac,platform_scored_at)
      VALUES (match_id,'2.2-gaussian-2026-09-11',NULL,NOW());
  EXCEPTION WHEN check_violation THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'null_hmac_partial_tuple_accepted'; END IF;
  rejected := false;
  BEGIN
    INSERT INTO matching_private.match_score_provenance(match_id,platform_scoring_version,platform_inputs_hmac,platform_scored_at)
      VALUES (match_id,NULL,repeat('a',64),NOW());
  EXCEPTION WHEN check_violation THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'null_version_partial_tuple_accepted'; END IF;
  rejected := false;
  BEGIN
    PERFORM public.match_score_commit_guarded(match_id,
      (snapshot->'repreneur'->>'revision')::bigint,
      (snapshot->'opportunity'->>'revision')::bigint,
      (snapshot->'match'->>'revision')::bigint,
      (snapshot->'repreneur'->>'target_revision')::bigint,
      (snapshot->>'taxonomy_revision')::bigint,
      '2.2-gaussian-2026-09-11',NULL,80,'strong_fit',ARRAY['fictional evidence']);
  EXCEPTION WHEN raise_exception THEN
    rejected := SQLERRM = 'match_score_payload_invalid';
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'null_hmac_guarded_commit_accepted'; END IF;
  rejected := false;
  BEGIN
    PERFORM public.match_score_commit_guarded(match_id,
      (snapshot->'repreneur'->>'revision')::bigint,
      (snapshot->'opportunity'->>'revision')::bigint,
      (snapshot->'match'->>'revision')::bigint,
      (snapshot->'repreneur'->>'target_revision')::bigint,
      (snapshot->>'taxonomy_revision')::bigint,
      '2.2-gaussian-2026-09-11',repeat('a',64),NULL,'strong_fit',ARRAY['fictional evidence']);
  EXCEPTION WHEN raise_exception THEN
    rejected := SQLERRM = 'match_score_payload_invalid';
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'null_score_guarded_commit_accepted'; END IF;
  IF EXISTS (SELECT 1 FROM matching_private.match_score_provenance WHERE match_score_provenance.match_id=match_id)
    THEN RAISE EXCEPTION 'invalid_payload_created_provenance'; END IF;
END $$;
SQL

"${psql[@]}" -q <<'SQL'
DO $$
#variable_conflict use_variable
DECLARE
  match_id uuid := '00000000-0000-4000-8000-000000000031';
  before_clock timestamptz;
  result text;
  old_snapshot jsonb;
  taxonomy bigint;
BEGIN
  SELECT updated_at INTO before_clock FROM public.opportunity_matches WHERE id=match_id;
  old_snapshot := public.match_score_source_snapshot(match_id);
  taxonomy := (old_snapshot->>'taxonomy_revision')::bigint;
  result := public.match_score_commit_guarded(match_id,
    (old_snapshot->'repreneur'->>'revision')::bigint,
    (old_snapshot->'opportunity'->>'revision')::bigint,
    (old_snapshot->'match'->>'revision')::bigint,
    (old_snapshot->'repreneur'->>'target_revision')::bigint,
    taxonomy, '2.2-gaussian-2026-09-11', repeat('a',64), 80,
    'strong_fit', ARRAY['fictional evidence']);
  IF result <> 'committed' THEN RAISE EXCEPTION 'guarded_commit_failed'; END IF;
  IF (SELECT updated_at FROM public.opportunity_matches WHERE id=match_id) IS DISTINCT FROM before_clock
    THEN RAISE EXCEPTION 'score_advanced_human_clock'; END IF;
  IF NOT EXISTS (SELECT 1 FROM matching_private.match_score_provenance p
    WHERE p.match_id=match_id AND platform_inputs_hmac=repeat('a',64) AND platform_scored_at IS NOT NULL)
    THEN RAISE EXCEPTION 'private_tuple_missing'; END IF;
  IF (SELECT TO_JSONB(m) ? 'platform_inputs_hmac' FROM public.opportunity_matches m WHERE id=match_id)
    THEN RAISE EXCEPTION 'public_wildcard_exposed_hmac'; END IF;
  UPDATE public.opportunity_matches SET human_notes='fictional staff note' WHERE id=match_id;
  IF (SELECT updated_at FROM public.opportunity_matches WHERE id=match_id) <= before_clock
    THEN RAISE EXCEPTION 'human_clock_not_advanced'; END IF;
  IF NOT EXISTS (SELECT 1 FROM matching_private.match_score_provenance p WHERE p.match_id=match_id)
    THEN RAISE EXCEPTION 'human_update_erased_tuple'; END IF;
  UPDATE public.opportunity_matches SET platform_score=80 WHERE id=match_id;
  IF NOT EXISTS (SELECT 1 FROM matching_private.match_score_provenance p WHERE p.match_id=match_id)
    THEN RAISE EXCEPTION 'same_value_update_erased_tuple'; END IF;
  UPDATE public.opportunity_matches SET platform_score=60 WHERE id=match_id;
  IF EXISTS (SELECT 1 FROM matching_private.match_score_provenance p WHERE p.match_id=match_id)
    THEN RAISE EXCEPTION 'legacy_platform_update_kept_tuple'; END IF;
  IF (SELECT match_row_revision FROM public.opportunity_matches WHERE id=match_id) <> 4
    THEN RAISE EXCEPTION 'match_revision_not_monotonic'; END IF;
  UPDATE public.repreneurs SET q13_target_sectors_v2='["tech"]' WHERE id='00000000-0000-4000-8000-000000000011';
  result := public.match_score_commit_guarded(match_id,
    (old_snapshot->'repreneur'->>'revision')::bigint,
    (old_snapshot->'opportunity'->>'revision')::bigint,
    (old_snapshot->'match'->>'revision')::bigint,
    (old_snapshot->'repreneur'->>'target_revision')::bigint,
    taxonomy, '2.2-gaussian-2026-09-11', repeat('b',64), 88,
    'strong_fit', ARRAY['obsolete']);
  IF result <> 'conflict' OR (SELECT platform_score FROM public.opportunity_matches WHERE id=match_id) <> 60
    THEN RAISE EXCEPTION 'old_profile_snapshot_committed'; END IF;
  old_snapshot := public.match_score_source_snapshot(match_id);
  UPDATE public.opportunities SET revenue_meur=3 WHERE id='00000000-0000-4000-8000-000000000021';
  result := public.match_score_commit_guarded(match_id,
    (old_snapshot->'repreneur'->>'revision')::bigint,
    (old_snapshot->'opportunity'->>'revision')::bigint,
    (old_snapshot->'match'->>'revision')::bigint,
    (old_snapshot->'repreneur'->>'target_revision')::bigint,
    (old_snapshot->>'taxonomy_revision')::bigint,
    '2.2-gaussian-2026-09-11', repeat('b',64), 88, 'strong_fit', ARRAY['obsolete']);
  IF result <> 'conflict' THEN RAISE EXCEPTION 'old_opportunity_snapshot_committed'; END IF;
  old_snapshot := public.match_score_source_snapshot(match_id);
  PERFORM public.replace_repreneur_geography_targets('00000000-0000-4000-8000-000000000011', ARRAY['fr-region-idf']);
  result := public.match_score_commit_guarded(match_id,
    (old_snapshot->'repreneur'->>'revision')::bigint,
    (old_snapshot->'opportunity'->>'revision')::bigint,
    (old_snapshot->'match'->>'revision')::bigint,
    (old_snapshot->'repreneur'->>'target_revision')::bigint,
    (old_snapshot->>'taxonomy_revision')::bigint,
    '2.2-gaussian-2026-09-11', repeat('b',64), 88, 'strong_fit', ARRAY['obsolete']);
  IF result <> 'conflict' OR (public.match_score_source_snapshot(match_id)->'target_node_ids')='[]'::jsonb
    THEN RAISE EXCEPTION 'old_target_snapshot_committed'; END IF;
  old_snapshot := public.match_score_source_snapshot(match_id);
  UPDATE public.geography_nodes SET stable_key='fr-region-ile-de-france'
    WHERE id='00000000-0000-4000-8000-000000000002';
  result := public.match_score_commit_guarded(match_id,
    (old_snapshot->'repreneur'->>'revision')::bigint,
    (old_snapshot->'opportunity'->>'revision')::bigint,
    (old_snapshot->'match'->>'revision')::bigint,
    (old_snapshot->'repreneur'->>'target_revision')::bigint,
    (old_snapshot->>'taxonomy_revision')::bigint,
    '2.2-gaussian-2026-09-11', repeat('b',64), 88, 'strong_fit', ARRAY['obsolete']);
  IF result <> 'conflict' THEN RAISE EXCEPTION 'old_taxonomy_snapshot_committed'; END IF;
END $$;
SQL

# Store only fictional revisions in this disposable cluster so each following
# psql invocation is a genuinely independent database session.
"${psql[@]}" -q <<'SQL'
CREATE TABLE public.fixture_saved_snapshot(payload jsonb NOT NULL);
CREATE FUNCTION public.fixture_try_saved_commit() RETURNS text LANGUAGE plpgsql AS $$
DECLARE source jsonb;
BEGIN
  SELECT payload INTO source FROM public.fixture_saved_snapshot LIMIT 1;
  RETURN public.match_score_commit_guarded(
    (source->'match'->>'id')::uuid,
    (source->'repreneur'->>'revision')::bigint,
    (source->'opportunity'->>'revision')::bigint,
    (source->'match'->>'revision')::bigint,
    (source->'repreneur'->>'target_revision')::bigint,
    (source->>'taxonomy_revision')::bigint,
    '2.2-gaussian-2026-09-11',repeat('c',64),87,'strong_fit',ARRAY['current fictional evidence']
  );
END $$;
SQL
save_snapshot() {
  "${psql[@]}" -q -c "TRUNCATE public.fixture_saved_snapshot; INSERT INTO public.fixture_saved_snapshot SELECT public.match_score_source_snapshot('00000000-0000-4000-8000-000000000031');" >/dev/null
}
expect_saved_conflict() {
  local result
  result="$("${psql[@]}" -At -c 'SELECT public.fixture_try_saved_commit();')"
  if [[ "$result" != 'conflict' ]]; then echo "Expected guarded conflict for $1, got $result" >&2; exit 1; fi
}
save_snapshot
for lock_sql in \
  "SELECT id FROM public.repreneurs WHERE id='00000000-0000-4000-8000-000000000011' FOR UPDATE" \
  "SELECT id FROM public.opportunities WHERE id='00000000-0000-4000-8000-000000000021' FOR UPDATE" \
  "SELECT id FROM public.opportunity_matches WHERE id='00000000-0000-4000-8000-000000000031' FOR UPDATE" \
  "SELECT revision FROM matching_private.geography_taxonomy_revision WHERE singleton FOR UPDATE"; do
  "${psql[@]}" -q -c "BEGIN; $lock_sql; SELECT pg_sleep(1); COMMIT;" >/dev/null &
  holder=$!
  sleep 0.2
  expect_saved_conflict 'independent-session NOWAIT lock'
  wait "$holder"
done
"${psql[@]}" -q -c "BEGIN; SELECT public.fixture_try_saved_commit(); SELECT pg_sleep(1); COMMIT;" >/dev/null &
holder=$!
sleep 0.2
expect_saved_conflict 'second scorer while first score transaction owns match'
wait "$holder"
expect_saved_conflict 'old scorer after first scorer committed'
save_snapshot
if [[ "$("${psql[@]}" -At -c 'SELECT public.fixture_try_saved_commit();')" != 'committed' ]]; then
  echo 'Uncontested guarded scorer did not commit after fresh snapshot' >&2; exit 1
fi
if [[ "$("${psql[@]}" -At -c "SELECT COUNT(*)=1 FROM matching_private.match_score_provenance WHERE platform_inputs_hmac=repeat('c',64);")" != 't' ]]; then
  echo 'Uncontested guarded commit left no complete private tuple' >&2; exit 1
fi
"${psql[@]}" -q -c "CREATE TABLE public.fixture_human_clock AS SELECT updated_at AS before_clock FROM public.opportunity_matches WHERE id='00000000-0000-4000-8000-000000000031';" >/dev/null
"${psql[@]}" -q -c "UPDATE public.opportunity_matches SET human_notes=human_notes WHERE id='00000000-0000-4000-8000-000000000031';" >/dev/null
if [[ "$("${psql[@]}" -At -c "SELECT m.updated_at > c.before_clock AND EXISTS (SELECT 1 FROM matching_private.match_score_provenance p WHERE p.match_id=m.id) FROM public.opportunity_matches m CROSS JOIN public.fixture_human_clock c WHERE m.id='00000000-0000-4000-8000-000000000031';")" != 't' ]]; then
  echo 'Same-valued human save lost its clock advance or private provenance' >&2; exit 1
fi

# Each source writer commits in its own transaction after the saved snapshot.
save_snapshot
"${psql[@]}" -q -c "UPDATE public.repreneurs SET q13_target_sectors_v2='[\"health\"]' WHERE id='00000000-0000-4000-8000-000000000011';" >/dev/null
expect_saved_conflict 'committed repreneur edit'
save_snapshot
"${psql[@]}" -q -c "UPDATE public.opportunities SET headcount=22 WHERE id='00000000-0000-4000-8000-000000000021';" >/dev/null
expect_saved_conflict 'committed opportunity edit'
save_snapshot
"${psql[@]}" -q -c "SELECT public.replace_repreneur_geography_targets('00000000-0000-4000-8000-000000000011',ARRAY['france']);" >/dev/null
expect_saved_conflict 'committed target replacement'
save_snapshot
"${psql[@]}" -q -c "UPDATE public.geography_nodes SET stable_key='fr-region-idf-final' WHERE id='00000000-0000-4000-8000-000000000002';" >/dev/null
expect_saved_conflict 'committed taxonomy edit'
save_snapshot
"${psql[@]}" -q -c "UPDATE public.opportunity_matches SET human_notes='later fictional human decision' WHERE id='00000000-0000-4000-8000-000000000031';" >/dev/null
expect_saved_conflict 'committed human match edit'

# Namespace or FK drift may never receive a cross-namespace signed score.
save_snapshot
"${psql[@]}" -q -c "UPDATE public.opportunities SET is_demo=TRUE WHERE id='00000000-0000-4000-8000-000000000021';" >/dev/null
expect_saved_conflict 'namespace conversion'
"${psql[@]}" -q -c "UPDATE public.opportunities SET is_demo=FALSE WHERE id='00000000-0000-4000-8000-000000000021';" >/dev/null
"${psql[@]}" -q -c "INSERT INTO public.opportunities(id,is_demo) VALUES('00000000-0000-4000-8000-000000000022',FALSE);" >/dev/null
save_snapshot
"${psql[@]}" -q -c "UPDATE public.opportunity_matches SET opportunity_id='00000000-0000-4000-8000-000000000022' WHERE id='00000000-0000-4000-8000-000000000031';" >/dev/null
expect_saved_conflict 'match FK changed'

# A separate session holds the parent first. NOWAIT prevents both a stale CAS
# and target replacement from waiting behind it or acquiring a child first.
"${psql[@]}" -q -c "BEGIN; SELECT 1 FROM public.repreneurs WHERE id='00000000-0000-4000-8000-000000000011' FOR UPDATE; SELECT pg_sleep(2); COMMIT;" >/dev/null &
holder=$!
sleep 0.3
if "${psql[@]}" -q -c "SELECT public.replace_repreneur_geography_targets('00000000-0000-4000-8000-000000000011', ARRAY['france']);" >/dev/null 2>&1; then
  echo 'Target replacement ignored parent NOWAIT lock' >&2; exit 1
fi
wait "$holder"

# Authenticated and anonymous callers may retain the historic public match
# read, but neither the raw snapshot nor private tuple is callable/readable.
for role in anon authenticated; do
  if "${psql[@]}" -q -c "SET ROLE $role; SELECT public.match_score_source_snapshot('00000000-0000-4000-8000-000000000031');" >/dev/null 2>&1; then
    echo "$role unexpectedly executed raw snapshot" >&2; exit 1
  fi
  if "${psql[@]}" -q -c "SET ROLE $role; SELECT * FROM matching_private.match_score_provenance;" >/dev/null 2>&1; then
    echo "$role unexpectedly read private provenance" >&2; exit 1
  fi
  if "${psql[@]}" -q -c "SET ROLE $role; SELECT public.match_score_commit_guarded(NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);" >/dev/null 2>&1; then
    echo "$role unexpectedly executed guarded score commit" >&2; exit 1
  fi
done
if "${psql[@]}" -q -c "SET ROLE service_role; SELECT * FROM matching_private.match_score_provenance;" >/dev/null 2>&1; then
  echo 'Service role unexpectedly read private provenance directly' >&2; exit 1
fi
service_snapshot_result="$("${psql[@]}" -At -c "SET ROLE service_role; SELECT public.match_score_source_snapshot('00000000-0000-4000-8000-000000000031') IS NOT NULL;")"
if [[ "${service_snapshot_result##*$'\n'}" != 't' ]]; then
  echo 'Service role could not read bounded source snapshot' >&2; exit 1
fi

"${psql[@]}" -q -c "DELETE FROM public.opportunity_matches WHERE id='00000000-0000-4000-8000-000000000031';" >/dev/null
"${psql[@]}" -q -c "DO \$\$ BEGIN IF EXISTS (SELECT 1 FROM matching_private.match_score_provenance) THEN RAISE EXCEPTION 'match_delete_left_private_provenance'; END IF; END \$\$;" >/dev/null
expect_saved_conflict 'deleted match'

echo 'Ticket #121 disposable PostgreSQL fixture passed'
