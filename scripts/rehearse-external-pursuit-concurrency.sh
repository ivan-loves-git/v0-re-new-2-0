#!/usr/bin/env bash
set -euo pipefail
db="${W105_REHEARSAL_DATABASE_URL:-postgresql://localhost:55439/renew_m21a}"
root="$(cd "$(dirname "$0")" && pwd)"
cleanup() { psql "$db" -v ON_ERROR_STOP=1 -c "SELECT set_config('wave.external_pursuit_delete_purge','on',false); DELETE FROM public.external_pursuit_audit_events WHERE actor_user_id IN ('race-owner','race-staff'); DELETE FROM public.external_pursuit_contacts WHERE created_by IN ('race-owner','race-staff'); DELETE FROM public.external_pursuit_notes WHERE updated_by IN ('race-owner','race-staff'); DELETE FROM public.external_pursuit_staff_notes WHERE updated_by IN ('race-owner','race-staff'); DELETE FROM public.external_pursuits WHERE created_by IN ('race-owner','race-staff'); DELETE FROM public.external_pursuit_deletion_tombstones WHERE owner_repreneur_id='00000000-0000-4000-8000-000000010451'; DELETE FROM public.app_user_roles WHERE user_id IN ('race-owner','race-staff'); DELETE FROM public.repreneurs WHERE id='00000000-0000-4000-8000-000000010451';" >/dev/null || true; rm -f /tmp/w105-create-a /tmp/w105-create-b /tmp/w105-contact-a /tmp/w105-contact-b; }
trap cleanup EXIT
cleanup
psql "$db" -v ON_ERROR_STOP=1 -f "$root/093_external_pursuit_foundation.sql" >/dev/null
psql "$db" -v ON_ERROR_STOP=1 -c "INSERT INTO public.repreneurs (id,first_name,last_name,email) VALUES ('00000000-0000-4000-8000-000000010451','Race','Owner','race-owner@example.test') ON CONFLICT (id) DO NOTHING; INSERT INTO public.app_user_roles (user_id,email,role,repreneur_id) VALUES ('race-owner','race-owner@example.test','repreneur','00000000-0000-4000-8000-000000010451'),('race-staff','race-staff@example.test','staff',NULL) ON CONFLICT DO NOTHING;" >/dev/null
create="SELECT public.create_external_pursuit('00000000-0000-4000-8000-000000010451','Race dossier','identified','unknown',NULL,NULL,NULL,'race-owner','race-create');"
printf '%s\n' "$create" | psql "$db" -Atq > /tmp/w105-create-a & a=$!
printf '%s\n' "${create/Race dossier/Conflicting race title}" | psql "$db" -Atq > /tmp/w105-create-b & b=$!
wait "$a"; wait "$b"
dossier="$(head -1 /tmp/w105-create-a)"; test "$dossier" = "$(head -1 /tmp/w105-create-b)"
update="SELECT public.update_external_pursuit('$dossier','Race updated',NULL,FALSE,NULL,FALSE,NULL,FALSE,NULL,FALSE,NULL,FALSE,'race-owner','race-update');"
printf '%s\n' "$update" | psql "$db" -Atq & a=$!
printf '%s\n' "${update/Race updated/Conflicting update}" | psql "$db" -Atq & b=$!
wait "$a"; wait "$b"
contact="SELECT public.save_external_pursuit_contact('$dossier',NULL,'Race contact',NULL,NULL,NULL,NULL,'race-owner','race-contact');"
printf '%s\n' "$contact" | psql "$db" -Atq > /tmp/w105-contact-a & a=$!
printf '%s\n' "${contact/Race contact/Conflicting contact}" | psql "$db" -Atq > /tmp/w105-contact-b & b=$!
wait "$a"; wait "$b"; test "$(head -1 /tmp/w105-contact-a)" = "$(head -1 /tmp/w105-contact-b)"
psql "$db" -v ON_ERROR_STOP=1 -Atq -c "SELECT public.request_external_pursuit_deletion('$dossier','race-owner','race-delete'); SELECT public.request_external_pursuit_deletion('$dossier','race-owner','race-delete'); SELECT public.fulfill_external_pursuit_deletion('$dossier','race-staff','race-fulfill'); SELECT public.fulfill_external_pursuit_deletion('$dossier','race-staff','race-fulfill');" >/dev/null
if psql "$db" -Atqc "SELECT public.fulfill_external_pursuit_deletion('$dossier','race-staff','different-key')" >/dev/null 2>&1; then exit 1; fi
echo "W-105 two-client concurrency rehearsal passed: $dossier"
