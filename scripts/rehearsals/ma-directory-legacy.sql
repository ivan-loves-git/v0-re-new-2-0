-- Retained incomplete records exist before the candidate migration.
BEGIN;
INSERT INTO public.ma_firms(id,name,status,created_by) VALUES ('25700000-0000-4000-8000-000000000001','Synthetic active firm','active','fixture');
INSERT INTO public.ma_offices(id,firm_id,name,is_default,created_by) VALUES ('25700000-0000-4000-8000-000000000011','25700000-0000-4000-8000-000000000001','Legacy branch',TRUE,'fixture');
INSERT INTO public.ma_contacts(id,first_name,email,phone,created_by) VALUES ('25700000-0000-4000-8000-000000000021','Synthetic legacy person',NULL,NULL,'fixture');
INSERT INTO public.ma_contact_office_affiliations(id,contact_id,office_id,is_active,created_by) VALUES ('25700000-0000-4000-8000-000000000031','25700000-0000-4000-8000-000000000021','25700000-0000-4000-8000-000000000011',TRUE,'fixture');
INSERT INTO public.ma_contact_office_affiliations(id,contact_id,office_id,is_active,ended_at,created_by) VALUES ('25700000-0000-4000-8000-000000000032','25700000-0000-4000-8000-000000000021','25700000-0000-4000-8000-000000000011',FALSE,'2020-01-01','fixture');
COMMIT;
-- Reserved synthetic context required by the full schema's unrelated source-
-- review invariant. Both retained people have one current office; no real data.
BEGIN;
SET LOCAL session_replication_role=replica;
INSERT INTO public.ma_firms(id,name,status,created_by) VALUES ('25700000-0000-4000-8000-000000000101','Acme Co.','active','fixture');
INSERT INTO public.ma_offices(id,firm_id,name,city,is_default,created_by) VALUES ('25700000-0000-4000-8000-000000000111','25700000-0000-4000-8000-000000000101','Acme Paris','Paris',FALSE,'fixture');
INSERT INTO public.ma_contacts(id,first_name,display_name,email,created_by) VALUES
 ('25700000-0000-4000-8000-000000000121','Schema','TEST-schema-redacted-person','test-schema-redacted-003','fixture'),
 ('25700000-0000-4000-8000-000000000122','Reserved','Synthetic reserved channel','test-schema-redacted-001','fixture');
INSERT INTO public.ma_contact_office_affiliations(id,contact_id,office_id,created_by) VALUES
 ('25700000-0000-4000-8000-000000000131','25700000-0000-4000-8000-000000000121','25700000-0000-4000-8000-000000000111','fixture'),
 ('25700000-0000-4000-8000-000000000132','25700000-0000-4000-8000-000000000122','25700000-0000-4000-8000-000000000111','fixture');
INSERT INTO public.app_user_roles(id,email,role) VALUES ('25700000-0000-4000-8000-000000000141','test-schema-redacted-002','staff');
INSERT INTO public.ma_provisional_source_contexts(context_key,firm_id,office_id,contact_id,affiliation_id) VALUES ('acme_co_paris','25700000-0000-4000-8000-000000000101','25700000-0000-4000-8000-000000000111','25700000-0000-4000-8000-000000000121','25700000-0000-4000-8000-000000000131');
COMMIT;
CREATE TABLE public.fixture_directory_retained AS
 SELECT 'firm'::TEXT AS entity,id,to_jsonb(f) AS row FROM public.ma_firms f
 UNION ALL SELECT 'office',id,to_jsonb(o) FROM public.ma_offices o
 UNION ALL SELECT 'contact',id,to_jsonb(c) FROM public.ma_contacts c
 UNION ALL SELECT 'affiliation',id,to_jsonb(a) FROM public.ma_contact_office_affiliations a;
