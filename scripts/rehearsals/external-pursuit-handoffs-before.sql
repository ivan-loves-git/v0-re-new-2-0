\set ON_ERROR_STOP on
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
-- Only synthetic parents are seeded. All qualifying handoffs use the real service.
INSERT INTO public.wave_journey_settings(singleton,enabled,updated_by) VALUES(true,true,'synthetic-254') ON CONFLICT(singleton) DO UPDATE SET enabled=true;
SET session_replication_role=replica;
UPDATE public.opportunity_matches SET status='active_pursuit' WHERE id='76000000-0000-4000-8000-000000000011';
INSERT INTO public.opportunity_pursuit_evidence(id,match_id,opportunity_id,repreneur_id,event_type,actor,idempotency_key,metadata,recorded_at)
VALUES('76000000-0000-4000-8000-000000000072','76000000-0000-4000-8000-000000000011','76000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000004','mutual_interest_validated','w173-staff','external-fixture-cycle',jsonb_build_object('blank_nda_present_at_validation',false),clock_timestamp()-interval '1 hour');
RESET session_replication_role;
INSERT INTO public.staff_portal_workspaces(id,staff_user_id,staff_email,selected_repreneur_id,generation)
VALUES('76000000-0000-4000-8000-000000000090','w173-staff','w173-staff@example.test','76000000-0000-4000-8000-000000000004','76000000-0000-4000-8000-000000000089');
INSERT INTO public.ma_contacts(id,first_name,display_name,status,email,created_by)
VALUES('25400000-0000-4000-8000-000000000091','Synthetic','Synthetic source contact','active','source@example.invalid','synthetic-254');
INSERT INTO public.ma_contact_office_affiliations(id,contact_id,office_id,created_by)
VALUES('25400000-0000-4000-8000-000000000092','25400000-0000-4000-8000-000000000091','76000000-0000-4000-8000-000000000002','synthetic-254');
INSERT INTO public.opportunity_ma_contacts(id,opportunity_id,affiliation_id,contact_name_snapshot,is_primary,linked_by)
VALUES('25400000-0000-4000-8000-000000000093','76000000-0000-4000-8000-000000000003','25400000-0000-4000-8000-000000000092','Synthetic source contact',true,'synthetic-254');
