#!/usr/bin/env bash
set -euo pipefail

# Runs the exact migration-092 profile-sync function and trigger in a fresh
# local PostgreSQL cluster. It proves existing profiles are untouched while a
# later profile write is synchronized. It never reads project credentials.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@16/bin}"
cluster_dir="$(mktemp -d /private/tmp/renew-w039-profile-sync.XXXXXX)"
port="${W039_PROFILE_REHEARSAL_PORT:-55439}"

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
"$pg_bin/createdb" -h 127.0.0.1 -p "$port" w039_profile_sync
psql_base=("$pg_bin/psql" -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -d w039_profile_sync)

"${psql_base[@]}" <<'SQL'
CREATE TABLE public.geography_nodes (
  id UUID PRIMARY KEY,
  stable_key TEXT NOT NULL UNIQUE
);
CREATE TABLE public.repreneurs (
  id UUID PRIMARY KEY,
  q12_geo_zones JSONB,
  target_location JSONB
);
CREATE TABLE public.repreneur_geography_targets (
  repreneur_id UUID NOT NULL REFERENCES public.repreneurs(id),
  geography_node_id UUID NOT NULL REFERENCES public.geography_nodes(id),
  PRIMARY KEY (repreneur_id, geography_node_id)
);
INSERT INTO public.geography_nodes (id, stable_key) VALUES
  ('00000000-0000-4092-8000-000000000001', 'france'),
  ('00000000-0000-4092-8000-000000000201', 'fr-region-idf');
INSERT INTO public.repreneurs (id, q12_geo_zones, target_location) VALUES
  ('00000000-0000-4092-8000-000000009001', '["all-france"]', '["all-france"]');
SQL

awk '
  /^CREATE OR REPLACE FUNCTION public.sync_repreneur_geography_targets_from_legacy\(\)/ { found = 1 }
  found { print }
  found && $0 == "END $$;" { exit }
' "$repo_root/scripts/092_france_geography_and_mandate_references.sql" | "${psql_base[@]}"

awk '
  /^DROP TRIGGER IF EXISTS sync_repreneur_geography_targets_from_legacy ON public.repreneurs;/ { found = 1 }
  found { print }
  found && /FOR EACH ROW EXECUTE FUNCTION public.sync_repreneur_geography_targets_from_legacy\(\);/ { exit }
' "$repo_root/scripts/092_france_geography_and_mandate_references.sql" | "${psql_base[@]}"

"${psql_base[@]}" <<'SQL'
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.repreneur_geography_targets) THEN
    RAISE EXCEPTION 'w039_rehearsal_existing_profile_was_backfilled';
  END IF;

  UPDATE public.repreneurs
  SET q12_geo_zones = q12_geo_zones
  WHERE id = '00000000-0000-4092-8000-000000009001';

  IF NOT EXISTS (
    SELECT 1
    FROM public.repreneur_geography_targets target
    JOIN public.geography_nodes node ON node.id = target.geography_node_id
    WHERE target.repreneur_id = '00000000-0000-4092-8000-000000009001'
      AND node.stable_key = 'france'
  ) THEN
    RAISE EXCEPTION 'w039_rehearsal_future_profile_write_not_synchronized';
  END IF;

  UPDATE public.repreneurs
  SET q12_geo_zones = '["Northern Italy"]'
  WHERE id = '00000000-0000-4092-8000-000000009001';

  IF EXISTS (SELECT 1 FROM public.repreneur_geography_targets) THEN
    RAISE EXCEPTION 'w039_rehearsal_unknown_target_was_inferred';
  END IF;
END $$;
SQL

echo "W-039 future-profile geography sync rehearsal passed"
