\set ON_ERROR_STOP on
-- Prospective-only boundary: this synthetic Proposed row predates the new
-- cycle trigger and deliberately has no publication clock.
SET session_replication_role=replica;
INSERT INTO public.ma_firms(id,name,status,created_by)
VALUES('75000000-0000-4000-8000-000000000001','W175 synthetic firm','active','fixture');
INSERT INTO public.ma_offices(id,firm_id,name,status,is_default,created_by)
VALUES('75000000-0000-4000-8000-000000000002','75000000-0000-4000-8000-000000000001','W175 synthetic office','active',true,'fixture');
INSERT INTO public.opportunities(id,reference,status,source_office_id,created_by,is_demo,public_title,teaser_summary,description)
VALUES('75000000-0000-4000-8000-000000000003','W175-REAL','active','75000000-0000-4000-8000-000000000002','fixture',false,'Synthetic public opportunity','Public approved teaser','PRIVATE SOURCE MUST NOT SEND');
INSERT INTO public.repreneurs(id,email,first_name,last_name,created_by,is_demo)
VALUES('75000000-0000-4000-8000-000000000004','w175-old@example.test','Old','Fixture','fixture',false),
  ('75000000-0000-4000-8000-000000000005','w175-new@example.test','New','Fixture','fixture',false),
  ('75000000-0000-4000-8000-000000000006','w175-status@example.test','Status','Fixture','fixture',false);
INSERT INTO public.app_user_roles(user_id,email,role)
VALUES('w175-staff','w175-staff@example.test','staff'),
  ('w175-renewer','w175-renewer@example.test','staff');
INSERT INTO public.app_user_roles(user_id,email,role,repreneur_id)
VALUES('w175-old-portal','w175-old@example.test','repreneur','75000000-0000-4000-8000-000000000004'),
  ('w175-new-portal','w175-new@example.test','repreneur','75000000-0000-4000-8000-000000000005'),
  ('w175-status-portal','w175-status@example.test','repreneur','75000000-0000-4000-8000-000000000006');
INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,created_by)
VALUES('75000000-0000-4000-8000-000000000010','75000000-0000-4000-8000-000000000003','75000000-0000-4000-8000-000000000004','proposed','w175-staff');
RESET session_replication_role;
