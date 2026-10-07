#!/usr/bin/env bash
set -euo pipefail

# Disposable #247 SQL proof. No application credentials or provider are loaded.
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
fixture_root="${TMPDIR:-/tmp}"
cluster_dir="$(mktemp -d "$fixture_root/renew-email-operations.XXXXXX")"
port=$((56000 + RANDOM % 7000))
cleanup() {
  if [[ -f "$cluster_dir/postmaster.pid" ]]; then "$pg_bin/pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true; fi
  case "$cluster_dir" in "$fixture_root"/renew-email-operations.*) rm -rf "$cluster_dir" ;; esac
}
trap cleanup EXIT

"$pg_bin/initdb" -D "$cluster_dir" --no-locale --encoding=UTF8 --auth-local=trust --username=renew_operations_admin >/dev/null
"$pg_bin/pg_ctl" -D "$cluster_dir" -l "$cluster_dir/postgres.log" -o "-c listen_addresses='' -k $cluster_dir -p $port" -w start >/dev/null
"$pg_bin/createdb" -h "$cluster_dir" -p "$port" -U renew_operations_admin renew_operations_fixture
psql=("$pg_bin/psql" -X -v ON_ERROR_STOP=1 -h "$cluster_dir" -p "$port" -U renew_operations_admin -d renew_operations_fixture)

"${psql[@]}" >/dev/null <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE TABLE public.opportunities(id uuid PRIMARY KEY, is_demo boolean NOT NULL);
CREATE TABLE public.repreneurs(id uuid PRIMARY KEY, first_name text, last_name text, avatar_url text);
CREATE TABLE public.opportunity_matches(id uuid PRIMARY KEY, opportunity_id uuid REFERENCES public.opportunities(id), repreneur_id uuid REFERENCES public.repreneurs(id));
CREATE TABLE public.opportunity_pursuit_evidence(id uuid PRIMARY KEY, match_id uuid REFERENCES public.opportunity_matches(id) ON DELETE CASCADE);
CREATE TABLE public.ma_firms(id uuid PRIMARY KEY, name text);
CREATE TABLE public.ma_offices(id uuid PRIMARY KEY, firm_id uuid REFERENCES public.ma_firms(id), name text);
CREATE TABLE public.ma_contacts(id uuid PRIMARY KEY, display_name text);
CREATE TABLE public.ma_contact_office_affiliations(id uuid PRIMARY KEY, contact_id uuid REFERENCES public.ma_contacts(id), office_id uuid REFERENCES public.ma_offices(id));
CREATE TABLE public.opportunity_ma_contacts(id uuid PRIMARY KEY, affiliation_id uuid REFERENCES public.ma_contact_office_affiliations(id));
CREATE TABLE public."user"(id text PRIMARY KEY, email text NOT NULL);
CREATE TABLE public.app_user_roles(user_id text, email text, role text);
CREATE TABLE public.ma_source_email_send_reservations(opportunity_id uuid PRIMARY KEY REFERENCES public.opportunities(id), expires_at timestamptz);
CREATE TABLE public.ma_interactions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),client_operation_key uuid,
  opportunity_id uuid,template_key text,recipient_email_snapshot text,title text,body_markdown text,
  channel text,direction text,delivery_status text,provider_message_id text);
CREATE TABLE public.ma_interaction_delivery_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),interaction_id uuid REFERENCES public.ma_interactions(id),event_kind text);
CREATE TABLE public.opportunity_pursuit_handoff_deliveries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),upstream_evidence_id uuid,
  match_id uuid,handoff_type text,delivery_status text,provider_message_id text,attempt_count integer DEFAULT 1,last_attempt_at timestamptz);
CREATE TABLE public.opportunity_freshness_deliveries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),review_id uuid,
  delivery_status text,provider_message_id text,attempted_at timestamptz);
INSERT INTO public.opportunities VALUES
  ('22300000-0000-4000-8000-000000000001',false),('22300000-0000-4000-8000-000000000002',false),
  ('22300000-0000-4000-8000-000000000031',false),('22300000-0000-4000-8000-000000000032',false),
  ('22300000-0000-4000-8000-000000000033',false),('22300000-0000-4000-8000-000000000034',false);
INSERT INTO public.repreneurs VALUES ('22300000-0000-4000-8000-000000000003','Alex','Example',NULL);
INSERT INTO public.opportunity_matches VALUES
  ('22300000-0000-4000-8000-000000000004','22300000-0000-4000-8000-000000000001','22300000-0000-4000-8000-000000000003');
INSERT INTO public.opportunity_pursuit_evidence VALUES
  ('22300000-0000-4000-8000-000000000005','22300000-0000-4000-8000-000000000004');
INSERT INTO public.ma_firms VALUES ('22300000-0000-4000-8000-000000000006','Fictional firm');
INSERT INTO public.ma_offices VALUES ('22300000-0000-4000-8000-000000000007','22300000-0000-4000-8000-000000000006','Fictional office');
INSERT INTO public.ma_contacts VALUES ('22300000-0000-4000-8000-000000000008','Fictional contact');
INSERT INTO public.ma_contact_office_affiliations VALUES
  ('22300000-0000-4000-8000-000000000009','22300000-0000-4000-8000-000000000008','22300000-0000-4000-8000-000000000007');
INSERT INTO public.opportunity_ma_contacts VALUES
  ('22300000-0000-4000-8000-000000000010','22300000-0000-4000-8000-000000000009');
INSERT INTO public."user" VALUES ('staff-one','one@example.test'),('rep-one','rep@example.test');
INSERT INTO public.app_user_roles VALUES ('staff-one','one@example.test','staff'),('rep-one','rep@example.test','repreneur');
SQL

"${psql[@]}" -f "$repo_root/scripts/121_staff_email_review_queue.sql" >/dev/null
"${psql[@]}" >/dev/null <<'SQL'
ALTER TABLE public.staff_email_reviews DROP CONSTRAINT staff_email_reviews_source_kind_check;
ALTER TABLE public.staff_email_reviews ADD CONSTRAINT staff_email_reviews_source_kind_check
  CHECK (source_kind IN ('ma','e4','e6','e7','freshness'));
ALTER TABLE public.staff_email_reviews DROP CONSTRAINT staff_email_reviews_handoff_binding;
ALTER TABLE public.staff_email_reviews ADD CONSTRAINT staff_email_reviews_handoff_binding CHECK (
  (source_kind IN ('ma','freshness') AND match_id IS NULL AND upstream_evidence_id IS NULL AND contact_link_id IS NOT NULL)
  OR (source_kind='e6' AND match_id IS NOT NULL AND upstream_evidence_id=source_operation_id AND contact_link_id IS NULL)
  OR (source_kind IN ('e4','e7') AND match_id IS NOT NULL AND upstream_evidence_id=source_operation_id AND contact_link_id IS NOT NULL));
ALTER TABLE public.staff_email_review_events DROP CONSTRAINT staff_email_review_events_event_kind_check;
ALTER TABLE public.staff_email_review_events ADD CONSTRAINT staff_email_review_events_event_kind_check
  CHECK (event_kind IN ('prepared','edited','refreshed','approved','sending','sent','failed','uncertain','cancelled'));
CREATE TABLE public.opportunity_freshness_members(review_id uuid REFERENCES public.staff_email_reviews(id) ON DELETE CASCADE,
  opportunity_id uuid,episode_key text,PRIMARY KEY(review_id,opportunity_id),UNIQUE(opportunity_id,episode_key));
ALTER TABLE public.opportunity_freshness_deliveries ADD CONSTRAINT archive_fixture_freshness_review_fk
  FOREIGN KEY(review_id) REFERENCES public.staff_email_reviews(id) ON DELETE RESTRICT;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO service_role;
SQL
"${psql[@]}" -f "$repo_root/scripts/130_staff_email_review_queue_projection.sql" >/dev/null
"${psql[@]}" -f "$repo_root/supabase/migrations/20260929230707_reversible_staff_email_archive.sql" >/dev/null
"${psql[@]}" >/dev/null <<'SQL'
ALTER TABLE public.repreneurs ADD COLUMN email text,ADD COLUMN is_demo boolean NOT NULL DEFAULT false;
UPDATE public.repreneurs SET email='rep@example.test';
CREATE TABLE public.email_templates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),template_key text UNIQUE,
 subject text,preview_text text,description text,is_active boolean,requires_consent boolean,body_markdown text,body_editable boolean,updated_at timestamptz DEFAULT now());
INSERT INTO public.email_templates(template_key,subject,is_active,requires_consent,body_markdown,body_editable)
 VALUES('welcome','Original subject',true,false,'Original body',true),('inactive','Dormant',false,false,'Dormant body',true);
CREATE TABLE public.opportunity_interest_events(id uuid PRIMARY KEY,match_id uuid);
CREATE TABLE public.opportunity_recommendation_cycles(id uuid PRIMARY KEY,match_id uuid);
CREATE TABLE public.email_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),repreneur_id uuid,template_key text,resend_id text,to_email text,
 subject text,status text,sent_at timestamptz,delivered_at timestamptz,opened_at timestamptz,clicked_at timestamptz,
 error_message text,created_at timestamptz DEFAULT now(),idempotency_key text);
ALTER TABLE public.ma_interactions ADD COLUMN created_at timestamptz DEFAULT now(),ADD COLUMN delivery_error text,ADD COLUMN sent_at timestamptz;
ALTER TABLE public.opportunity_pursuit_handoff_deliveries ADD COLUMN ma_interaction_id uuid,ADD COLUMN sent_at timestamptz,ADD COLUMN created_at timestamptz DEFAULT now(),ADD COLUMN delivery_error text;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO service_role;
SQL
"${psql[@]}" >/dev/null <<'SQL'
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
SQL
"${psql[@]}" -f "$repo_root/supabase/migrations/20260929235619_bounded_staff_email_bulk_send.sql" >/dev/null
"${psql[@]}" -f "$repo_root/supabase/migrations/20261007123000_email_operations_policy.sql" >/dev/null
"${psql[@]}" -f "$repo_root/scripts/rehearsals/email-operations-247-assert.sql" >/dev/null
echo "#247 disposable PostgreSQL: policy, frozen wording, future-only automatic claims, archive/version fences, private history and event facts passed"
