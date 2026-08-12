#!/usr/bin/env bash
set -euo pipefail

# Runs the actual W-098/W-039 RPC definitions against a fresh local cluster.
# It never reads a project environment file or contacts Supabase.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@16/bin}"
cluster_dir="$(mktemp -d /private/tmp/renew-w098-precision.XXXXXX)"
port="${W098_REHEARSAL_PORT:-55498}"

cleanup() {
  if [ -f "$cluster_dir/postmaster.pid" ]; then
    "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true
  fi
  rm -rf "$cluster_dir"
}
trap cleanup EXIT

for binary in initdb pg_ctl createdb psql; do
  if [ ! -x "$pg_bin/$binary" ]; then
    echo "Missing PostgreSQL binary: $pg_bin/$binary" >&2
    exit 1
  fi
done

"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 --auth-local=trust --auth-host=trust >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -o "-p $port -h 127.0.0.1" -w start >/dev/null
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" w098_precision_rehearsal

psql_base=("$pg_bin/psql" -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -d w098_precision_rehearsal)
"${psql_base[@]}" <<'SQL'
CREATE EXTENSION pgcrypto;
CREATE TYPE public.opportunity_status AS ENUM ('draft', 'active', 'paused', 'closed', 'archived');
CREATE TABLE public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE,
  status public.opportunity_status NOT NULL DEFAULT 'draft',
  date_added DATE,
  date_added_precision TEXT,
  geography_node_id UUID,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE public.geography_nodes (
  id UUID PRIMARY KEY,
  stable_key TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL
);
CREATE TABLE public.ma_w039_release_control (
  singleton BOOLEAN PRIMARY KEY,
  enforce_new_opportunity_geography BOOLEAN NOT NULL
);
INSERT INTO public.ma_w039_release_control VALUES (TRUE, FALSE);
CREATE TABLE public.opportunity_mandate_reference_counters (
  reference_code TEXT PRIMARY KEY,
  next_sequence BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO public.geography_nodes VALUES
  ('00000000-0000-4092-8000-000000000001', 'france', 'FR');

CREATE OR REPLACE FUNCTION public.resolve_w039_geography_node(p_value TEXT)
RETURNS public.geography_nodes LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE node public.geography_nodes%ROWTYPE;
BEGIN
  SELECT * INTO node FROM public.geography_nodes WHERE id = p_value::UUID;
  IF node.id IS NULL THEN RAISE EXCEPTION 'opportunity_geography_not_found'; END IF;
  RETURN node;
END $$;

CREATE OR REPLACE FUNCTION public.save_opportunity_office_context_legacy(
  p_opportunity_id UUID, p_source_office_id UUID DEFAULT NULL, p_affiliation_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_primary_affiliation_id UUID DEFAULT NULL, p_description TEXT DEFAULT NULL,
  p_target_status public.opportunity_status DEFAULT 'draft', p_actor TEXT DEFAULT NULL,
  p_opportunity_fields JSONB DEFAULT '{}'::JSONB
) RETURNS public.opportunities LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE saved public.opportunities%ROWTYPE;
BEGIN
  UPDATE public.opportunities
  SET date_added = CASE WHEN p_opportunity_fields ? 'date_added'
                    THEN NULLIF(BTRIM(p_opportunity_fields ->> 'date_added'), '')::DATE
                    ELSE date_added END,
      updated_by = p_actor, updated_at = NOW()
  WHERE id = p_opportunity_id
  RETURNING * INTO saved;
  IF NOT FOUND THEN RAISE EXCEPTION 'fixture_opportunity_missing'; END IF;
  RETURN saved;
END $$;

CREATE OR REPLACE FUNCTION public.create_opportunity_with_office_context_legacy(
  p_reference TEXT, p_source_office_id UUID DEFAULT NULL, p_affiliation_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_primary_affiliation_id UUID DEFAULT NULL, p_description TEXT DEFAULT NULL,
  p_target_status public.opportunity_status DEFAULT 'draft', p_actor TEXT DEFAULT NULL,
  p_opportunity_fields JSONB DEFAULT '{}'::JSONB
) RETURNS public.opportunities LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE saved public.opportunities%ROWTYPE;
BEGIN
  INSERT INTO public.opportunities (reference, status, date_added, updated_by)
  VALUES (p_reference, p_target_status,
    NULLIF(BTRIM(p_opportunity_fields ->> 'date_added'), '')::DATE, p_actor)
  RETURNING * INTO saved;
  RETURN saved;
END $$;
SQL

# Extract and execute the exact checked-in implementations, not copies. Some
# migrations place the closing `END` on the preceding line, others do not.
extract_function() {
  local name="$1"
  local file="$2"
  awk -v start="CREATE OR REPLACE FUNCTION public.${name}" '
    index($0, start) == 1 { found = 1 }
    found { print }
    found && ($0 == "$$;" || $0 == "END $$;") { exit }
  ' "$file"
}

extract_function "sync_opportunity_date_added_precision()" "$repo_root/scripts/091_w098_legacy_opportunity_date_reconciliation.sql" | "${psql_base[@]}"
"${psql_base[@]}" -c 'DROP TRIGGER IF EXISTS sync_opportunity_date_added_precision ON public.opportunities; CREATE TRIGGER sync_opportunity_date_added_precision BEFORE INSERT OR UPDATE OF date_added ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.sync_opportunity_date_added_precision();'
extract_function "validate_w098_date_precision_write(" "$repo_root/scripts/092_france_geography_and_mandate_references.sql" | "${psql_base[@]}"
extract_function "save_opportunity_office_context(" "$repo_root/scripts/092_france_geography_and_mandate_references.sql" | "${psql_base[@]}"
extract_function "create_opportunity_with_office_context(" "$repo_root/scripts/092_france_geography_and_mandate_references.sql" | "${psql_base[@]}"

"${psql_base[@]}" <<'SQL'
INSERT INTO public.opportunities (id, reference, date_added, date_added_precision)
VALUES ('00000000-0000-4098-8000-000000000001', 'W098-MONTH', DATE '2026-01-01', 'month');

DO $$
DECLARE saved public.opportunities%ROWTYPE; created public.opportunities%ROWTYPE;
BEGIN
  -- An unrelated save omits the date and cannot invent a day.
  saved := public.save_opportunity_office_context(
    '00000000-0000-4098-8000-000000000001', NULL, ARRAY[]::UUID[], NULL, NULL, 'draft', 'qa', '{}'::JSONB);
  IF saved.date_added <> DATE '2026-01-01' OR saved.date_added_precision <> 'month' THEN
    RAISE EXCEPTION 'w098_rehearsal_month_not_preserved';
  END IF;
  -- The underlying first-of-month value is not enough: confirmation is mandatory.
  BEGIN
    PERFORM public.save_opportunity_office_context(
      saved.id, NULL, ARRAY[]::UUID[], NULL, NULL, 'draft', 'qa',
      '{"date_added":"2026-01-01"}'::JSONB);
    RAISE EXCEPTION 'w098_rehearsal_month_change_without_confirmation_accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%opportunity_date_added_month_precision_requires_confirmation%' THEN RAISE; END IF;
  END;
  -- Confirmation turns even that same technical first-of-month value into a day.
  saved := public.save_opportunity_office_context(
    saved.id, NULL, ARRAY[]::UUID[], NULL, NULL, 'draft', 'qa',
    '{"date_added":"2026-01-01","date_added_confirm_day":true}'::JSONB);
  IF saved.date_added <> DATE '2026-01-01' OR saved.date_added_precision <> 'day' THEN
    RAISE EXCEPTION 'w098_rehearsal_confirmed_day_not_atomic';
  END IF;
  -- Restore a month value only to prove clearing clears the pair through the real trigger.
  UPDATE public.opportunities SET date_added_precision = 'month' WHERE id = saved.id;
  saved := public.save_opportunity_office_context(
    saved.id, NULL, ARRAY[]::UUID[], NULL, NULL, 'draft', 'qa', '{"date_added":null}'::JSONB);
  IF saved.date_added IS NOT NULL OR saved.date_added_precision IS NOT NULL THEN
    RAISE EXCEPTION 'w098_rehearsal_clear_not_atomic';
  END IF;
  created := public.create_opportunity_with_office_context(
    'forged-reference', NULL, ARRAY[]::UUID[], NULL, NULL, 'draft', 'qa',
    '{"geography_node_id":"00000000-0000-4092-8000-000000000001","date_added":"2026-02-14"}'::JSONB);
  IF created.date_added <> DATE '2026-02-14' OR created.date_added_precision <> 'day' THEN
    RAISE EXCEPTION 'w098_rehearsal_new_staff_day_not_written';
  END IF;
END $$;
SQL

# Rerunning the exact CREATE OR REPLACE definitions is non-mutating.
extract_function "validate_w098_date_precision_write(" "$repo_root/scripts/092_france_geography_and_mandate_references.sql" | "${psql_base[@]}" >/dev/null
extract_function "save_opportunity_office_context(" "$repo_root/scripts/092_france_geography_and_mandate_references.sql" | "${psql_base[@]}" >/dev/null
extract_function "create_opportunity_with_office_context(" "$repo_root/scripts/092_france_geography_and_mandate_references.sql" | "${psql_base[@]}" >/dev/null

echo "W-098 date precision RPC rehearsal passed"
