#!/usr/bin/env bash
set -euo pipefail
db="${W105_REHEARSAL_DATABASE_URL:-postgresql://localhost:55439/renew_m21a}"
root="$(cd "$(dirname "$0")" && pwd)"
tmpdir="$(mktemp -d /tmp/w105-concurrency.XXXXXX)"
psql_run() { psql -X "$db" -v ON_ERROR_STOP=1 "$@"; }
cleanup_database() {
  psql_run -c "SELECT set_config('wave.external_pursuit_delete_purge','on',false); DELETE FROM public.external_pursuit_audit_events WHERE actor_user_id IN ('race-owner','race-staff'); DELETE FROM public.external_pursuit_contacts WHERE created_by IN ('race-owner','race-staff'); DELETE FROM public.external_pursuit_notes WHERE updated_by IN ('race-owner','race-staff'); DELETE FROM public.external_pursuit_staff_notes WHERE updated_by IN ('race-owner','race-staff'); DELETE FROM public.external_pursuits WHERE created_by IN ('race-owner','race-staff'); DELETE FROM public.external_pursuit_deletion_tombstones WHERE owner_repreneur_id='00000000-0000-4000-8000-000000010451'; DELETE FROM public.app_user_roles WHERE user_id IN ('race-owner','race-staff'); DELETE FROM public.repreneurs WHERE id='00000000-0000-4000-8000-000000010451';" >/dev/null || true
}
cleanup() { cleanup_database; rm -rf "$tmpdir"; }
trap cleanup EXIT
cleanup_database
psql_run -f "$root/093_external_pursuit_foundation.sql" >/dev/null
psql_run -c "INSERT INTO public.repreneurs (id,first_name,last_name,email) VALUES ('00000000-0000-4000-8000-000000010451','Race','Owner','race-owner@example.test') ON CONFLICT (id) DO NOTHING; INSERT INTO public.app_user_roles (user_id,email,role,repreneur_id) VALUES ('race-owner','race-owner@example.test','repreneur','00000000-0000-4000-8000-000000010451'),('race-staff','race-staff@example.test','staff',NULL) ON CONFLICT DO NOTHING;" >/dev/null

create_lock="hashtextextended('race-owner:00000000-0000-4000-8000-000000010451:race-create',0)"
psql_run -Atq -c "BEGIN; SELECT pg_advisory_xact_lock($create_lock); SELECT pg_sleep(1); SELECT public.create_external_pursuit('00000000-0000-4000-8000-000000010451','Race dossier','identified','unknown',NULL,NULL,NULL,'race-owner','race-create'); COMMIT;" >"$tmpdir/create-a" & a=$!
sleep 0.2
psql_run -Atq -c "SELECT public.create_external_pursuit('00000000-0000-4000-8000-000000010451','Conflicting race title','identified','unknown',NULL,NULL,NULL,'race-owner','race-create');" >"$tmpdir/create-b" & b=$!
wait "$a"; wait "$b"
dossier="$(awk 'NF { print; exit }' "$tmpdir/create-a")"
test "$dossier" = "$(awk 'NF { print; exit }' "$tmpdir/create-b")"
test "$(psql_run -Atq -c "SELECT count(*) || '|' || min(title) || '|' || count(*) FILTER (WHERE event_type='created') FROM public.external_pursuits p JOIN public.external_pursuit_audit_events a ON a.external_pursuit_id=p.id WHERE p.id='$dossier' GROUP BY p.id;")" = "1|Race dossier|1"

lock="hashtextextended('$dossier',0)"
psql_run -Atq -c "BEGIN; SELECT pg_advisory_xact_lock($lock); SELECT pg_sleep(1); SELECT public.update_external_pursuit('$dossier','Race updated',NULL,FALSE,NULL,FALSE,NULL,FALSE,NULL,FALSE,NULL,FALSE,'race-owner','race-update'); COMMIT;" >"$tmpdir/update-a" & a=$!
sleep 0.2
psql_run -Atq -c "SELECT public.update_external_pursuit('$dossier','Conflicting update',NULL,FALSE,NULL,FALSE,NULL,FALSE,NULL,FALSE,NULL,FALSE,'race-owner','race-update');" >"$tmpdir/update-b" & b=$!
wait "$a"; wait "$b"
test "$(psql_run -Atq -c "SELECT title || '|' || (SELECT count(*) FROM public.external_pursuit_audit_events WHERE external_pursuit_id='$dossier' AND event_type='updated' AND idempotency_key='race-update') FROM public.external_pursuits WHERE id='$dossier';")" = "Race updated|1"

psql_run -Atq -c "BEGIN; SELECT pg_advisory_xact_lock($lock); SELECT pg_sleep(1); SELECT public.save_external_pursuit_contact('$dossier',NULL,'Race contact',NULL,NULL,NULL,NULL,'race-owner','race-contact'); COMMIT;" >"$tmpdir/contact-a" & a=$!
sleep 0.2
psql_run -Atq -c "SELECT public.save_external_pursuit_contact('$dossier',NULL,'Conflicting contact',NULL,NULL,NULL,NULL,'race-owner','race-contact');" >"$tmpdir/contact-b" & b=$!
wait "$a"; wait "$b"
test "$(awk 'NF { print; exit }' "$tmpdir/contact-a")" = "$(awk 'NF { print; exit }' "$tmpdir/contact-b")"
test "$(psql_run -Atq -c "SELECT count(*) || '|' || min(name) || '|' || (SELECT count(*) FROM public.external_pursuit_audit_events WHERE external_pursuit_id='$dossier' AND event_type='contact_created' AND idempotency_key='race-contact') FROM public.external_pursuit_contacts WHERE external_pursuit_id='$dossier';")" = "1|Race contact|1"

psql_run -Atq -c "SELECT public.request_external_pursuit_deletion('$dossier','race-owner','race-delete'); SELECT public.request_external_pursuit_deletion('$dossier','race-owner','race-delete'); SELECT public.fulfill_external_pursuit_deletion('$dossier','race-staff','race-fulfill'); SELECT public.fulfill_external_pursuit_deletion('$dossier','race-staff','race-fulfill');" >/dev/null
if psql_run -Atq -c "SELECT public.fulfill_external_pursuit_deletion('$dossier','race-staff','different-key')" >/dev/null 2>&1; then exit 1; fi
if psql_run -Atq -c "SELECT public.fulfill_external_pursuit_deletion('$dossier','race-owner','race-fulfill')" >/dev/null 2>&1; then exit 1; fi
echo "W-105 two-client concurrency rehearsal passed: $dossier"
