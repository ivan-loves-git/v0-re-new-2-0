#!/usr/bin/env bash
# Disposable W-109 two-client race rehearsal. It intentionally leaves its
# fixture in the supplied disposable database because conversion evidence is
# immutable by design. Never point this at production.
set -euo pipefail

db="${W109_REHEARSAL_DATABASE_URL:-postgresql://localhost:55439/renew_m21_w109}"
root="$(cd "$(dirname "$0")" && pwd)"
tmpdir="$(mktemp -d /tmp/w109-conversion-race.XXXXXX)"
trap 'rm -rf "$tmpdir"' EXIT
psql_run() { psql -X "$db" -v ON_ERROR_STOP=1 "$@"; }
wait_for_advisory_lock() {
  local application_name="$1"
  local held
  for _ in {1..80}; do
    held="$(psql_run -Atq -c "
      SELECT EXISTS (
        SELECT 1
        FROM pg_locks lock
        JOIN pg_stat_activity activity ON activity.pid = lock.pid
        WHERE activity.application_name = '${application_name}'
          AND lock.locktype = 'advisory'
          AND lock.granted
      );")"
    if [[ "$held" == "t" ]]; then return 0; fi
    sleep 0.05
  done
  echo "Timed out waiting for ${application_name} to own its advisory lock" >&2
  return 1
}

# The compact temporary clone used by this rehearsal may not contain the
# production Acme fixture. Seed only the existing canonical identity that W-064
# requires, then let its migration create and validate the fixed context.
psql_run -c "
  DROP TRIGGER IF EXISTS guard_ma_provisional_acme_firm_identity ON public.ma_firms;
  DROP TRIGGER IF EXISTS guard_ma_provisional_acme_office_identity ON public.ma_offices;
  DROP TRIGGER IF EXISTS guard_ma_provisional_bertrand_contact_identity ON public.ma_contacts;
  INSERT INTO public.app_user_roles (user_id,email,role,repreneur_id)
  SELECT 'w109-acme-foundation-staff','bertrand.galas@edu.escp.eu','staff',NULL
  WHERE NOT EXISTS (SELECT 1 FROM public.app_user_roles WHERE role='staff' AND LOWER(BTRIM(email))='bertrand.galas@edu.escp.eu');
  INSERT INTO public.ma_contacts (id,first_name,last_name,display_name,status,email,created_by,updated_by)
  SELECT '00000000-0000-4000-8000-000000010990','Bertrand','Galas','Bertrand Galas','active','bertrand.galas@edu.escp.eu','w109-acme-foundation-staff','w109-acme-foundation-staff'
  WHERE NOT EXISTS (SELECT 1 FROM public.ma_contacts WHERE LOWER(BTRIM(display_name))='bertrand galas' OR LOWER(BTRIM(email))='bertrand.galas@edu.escp.eu');" >/dev/null
psql_run -f "$root/079_provisional_acme_source_foundation.sql" >/dev/null
psql_run -f "$root/092_france_geography_and_mandate_references.sql" >/dev/null
psql_run -f "$root/098_external_pursuit_opportunity_conversion.sql" >/dev/null
psql_run -f "$root/117_explicit_demo_real_creation.sql" >/dev/null
psql_run -c "
  INSERT INTO public.repreneurs (id,first_name,last_name,email) VALUES ('00000000-0000-4000-8000-000000010991','Race','Owner','w109-race-owner@example.test') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.app_user_roles (user_id,email,role,repreneur_id) VALUES ('w109-race-owner','w109-race-owner@example.test','repreneur','00000000-0000-4000-8000-000000010991'),('w109-race-staff-a','w109-race-staff-a@example.test','staff',NULL),('w109-race-staff-b','w109-race-staff-b@example.test','staff',NULL) ON CONFLICT DO NOTHING;
  INSERT INTO public.ma_firms (id,name,status,created_by,updated_by) VALUES ('00000000-0000-4000-8000-000000010992','W109 Race Advisory','active','w109-race-staff-a','w109-race-staff-a') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.ma_offices (id,firm_id,name,status,is_default,created_by,updated_by) VALUES ('00000000-0000-4000-8000-000000010993','00000000-0000-4000-8000-000000010992','Paris','active',FALSE,'w109-race-staff-a','w109-race-staff-a') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.ma_contacts (id,first_name,last_name,display_name,status,created_by,updated_by) VALUES ('00000000-0000-4000-8000-000000010994','Race','Contact','Race Contact','active','w109-race-staff-a','w109-race-staff-a') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.ma_contact_office_affiliations (id,contact_id,office_id,is_active,created_by) VALUES ('00000000-0000-4000-8000-000000010995','00000000-0000-4000-8000-000000010994','00000000-0000-4000-8000-000000010993',TRUE,'w109-race-staff-a') ON CONFLICT (id) DO NOTHING;" >/dev/null

dossier="$(psql_run -Atq -c "SELECT public.create_external_pursuit('00000000-0000-4000-8000-000000010991','Race source dossier','meetings','available',NULL,NULL,NULL,'w109-race-staff-a','w109-race-create');")"
lock="hashtextextended('${dossier}', 0)"

psql_run -Atq -c "BEGIN; SELECT pg_advisory_xact_lock(${lock}); SELECT pg_sleep(1); SELECT opportunity_id FROM public.convert_external_pursuit_to_opportunity('${dossier}','Race-safe anonymous title','00000000-0000-4092-8000-000000000001','00000000-0000-4000-8000-000000010993','00000000-0000-4000-8000-000000010995',FALSE,'w109-race-staff-a','w109-race-convert-a'); COMMIT;" >"$tmpdir/a" &
a=$!
sleep 0.2
if psql_run -Atq -c "SELECT opportunity_id FROM public.convert_external_pursuit_to_opportunity('${dossier}','Second conversion must fail','00000000-0000-4092-8000-000000000001','00000000-0000-4000-8000-000000010993','00000000-0000-4000-8000-000000010995',FALSE,'w109-race-staff-b','w109-race-convert-b');" >"$tmpdir/b" 2>"$tmpdir/b.err"; then
  echo "W-109 race incorrectly allowed a second conversion" >&2
  exit 1
fi
wait "$a"

opportunity="$(awk 'NF { line=$0 } END { print line }' "$tmpdir/a")"
test -n "$opportunity"
test "$(psql_run -Atq -c "SELECT count(*) FROM public.external_pursuit_opportunity_conversions WHERE external_pursuit_id='${dossier}';")" = "1"
test "$(psql_run -Atq -c "SELECT count(*) FROM public.opportunities WHERE id='${opportunity}' AND status='draft' AND repreneur_exposure='staff_only';")" = "1"
grep -q "external_pursuit_already_converted" "$tmpdir/b.err"

# Conversion wins the exact shared lock: the waiting owner deletion request
# sees immutable conversion evidence and cannot change dossier state.
conversion_wins="$(psql_run -Atq -c "SELECT public.create_external_pursuit('00000000-0000-4000-8000-000000010991','Conversion wins','meetings','available',NULL,NULL,NULL,'w109-race-staff-a','w109-conversion-wins-create');")"
# Hold the FR reference-counter row so the real conversion function pauses
# after taking its own dossier advisory lock.
PGAPPNAME="w109-counter-blocker" psql -X "$db" -v ON_ERROR_STOP=1 -Atq -c "BEGIN; SELECT reference_code FROM public.opportunity_mandate_reference_counters WHERE reference_code='FR' FOR UPDATE; SELECT pg_advisory_xact_lock(hashtextextended('w109-counter-blocker-ready',0)); SELECT pg_sleep(3); COMMIT;" >"$tmpdir/counter-blocker" &
counter_blocker_pid=$!
wait_for_advisory_lock "w109-counter-blocker"
PGAPPNAME="w109-conversion-wins" psql -X "$db" -v ON_ERROR_STOP=1 -Atq -c "SELECT opportunity_id FROM public.convert_external_pursuit_to_opportunity('${conversion_wins}','Conversion-wins title','00000000-0000-4092-8000-000000000001','00000000-0000-4000-8000-000000010993','00000000-0000-4000-8000-000000010995',FALSE,'w109-race-staff-a','w109-conversion-wins-key');" >"$tmpdir/conversion-wins" &
conversion_pid=$!
wait_for_advisory_lock "w109-conversion-wins"
if psql_run -Atq -c "SELECT public.request_external_pursuit_deletion('${conversion_wins}','w109-race-owner','w109-delete-loses-key');" >"$tmpdir/delete-loses" 2>"$tmpdir/delete-loses.err"; then
  echo "W-109 conversion/delete race incorrectly allowed deletion after conversion" >&2
  exit 1
fi
wait "$conversion_pid"
wait "$counter_blocker_pid"
grep -q "external_pursuit_already_converted" "$tmpdir/delete-loses.err"
test "$(psql_run -Atq -c "SELECT deletion_status || '|' || (SELECT count(*) FROM public.external_pursuit_opportunity_conversions WHERE external_pursuit_id='${conversion_wins}') FROM public.external_pursuits WHERE id='${conversion_wins}';")" = "active|1"

# Deletion request wins the same lock: the waiting conversion sees the durable
# delete_requested state and cannot allocate an opportunity.
deletion_wins="$(psql_run -Atq -c "SELECT public.create_external_pursuit('00000000-0000-4000-8000-000000010991','Deletion wins','meetings','available',NULL,NULL,NULL,'w109-race-staff-a','w109-deletion-wins-create');")"
# Hold the dossier row so the real deletion function pauses after taking the
# exact shared advisory lock and before it can persist delete_requested.
PGAPPNAME="w109-dossier-row-blocker" psql -X "$db" -v ON_ERROR_STOP=1 -Atq -c "BEGIN; SELECT id FROM public.external_pursuits WHERE id='${deletion_wins}' FOR UPDATE; SELECT pg_advisory_xact_lock(hashtextextended('w109-dossier-row-blocker-ready',0)); SELECT pg_sleep(3); COMMIT;" >"$tmpdir/dossier-row-blocker" &
dossier_blocker_pid=$!
wait_for_advisory_lock "w109-dossier-row-blocker"
PGAPPNAME="w109-deletion-wins" psql -X "$db" -v ON_ERROR_STOP=1 -Atq -c "SELECT public.request_external_pursuit_deletion('${deletion_wins}','w109-race-owner','w109-deletion-wins-key');" >"$tmpdir/deletion-wins" &
deletion_pid=$!
wait_for_advisory_lock "w109-deletion-wins"
if psql_run -Atq -c "SELECT opportunity_id FROM public.convert_external_pursuit_to_opportunity('${deletion_wins}','Conversion must lose','00000000-0000-4092-8000-000000000001','00000000-0000-4000-8000-000000010993','00000000-0000-4000-8000-000000010995',FALSE,'w109-race-staff-a','w109-conversion-loses-key');" >"$tmpdir/conversion-loses" 2>"$tmpdir/conversion-loses.err"; then
  echo "W-109 conversion/delete race incorrectly converted a delete-requested dossier" >&2
  exit 1
fi
wait "$deletion_pid"
wait "$dossier_blocker_pid"
grep -q "external_pursuit_conversion_requires_active_dossier" "$tmpdir/conversion-loses.err"
test "$(psql_run -Atq -c "SELECT deletion_status || '|' || (SELECT count(*) FROM public.external_pursuit_opportunity_conversions WHERE external_pursuit_id='${deletion_wins}') FROM public.external_pursuits WHERE id='${deletion_wins}';")" = "delete_requested|0"

echo "W-109 conversion retry and conversion/delete race rehearsals passed"
