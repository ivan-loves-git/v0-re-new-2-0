\set ON_ERROR_STOP on
-- Local synthetic fixtures created before the new migration prove no replay.
SET session_replication_role=replica;
INSERT INTO public.ma_firms(id,name,status,created_by) VALUES
('76000000-0000-4000-8000-000000000001','W173 synthetic firm','active','fixture');
INSERT INTO public.ma_offices(id,firm_id,name,status,is_default,created_by) VALUES
('76000000-0000-4000-8000-000000000002','76000000-0000-4000-8000-000000000001','W173 synthetic office','active',true,'fixture');
INSERT INTO public.opportunities(id,reference,status,source_office_id,created_by,is_demo,public_title,teaser_summary,description) VALUES
('76000000-0000-4000-8000-000000000003','W173-REAL','active','76000000-0000-4000-8000-000000000002','fixture',false,'Synthetic public title','Synthetic approved teaser','PRIVATE SOURCE MUST NOT SEND');
INSERT INTO public.repreneurs(id,email,first_name,last_name,created_by,is_demo) VALUES
('76000000-0000-4000-8000-000000000004','interested@example.test','Interested','Person','fixture',false),
('76000000-0000-4000-8000-000000000005','historical@example.test','Historical','Person','fixture',false),
('76000000-0000-4000-8000-000000000006','unassigned@example.test','Unassigned','Person','fixture',false),
('76000000-0000-4000-8000-000000000007','rejected@example.test','Rejected','Person','fixture',false),
('76000000-0000-4000-8000-000000000008','second@example.test','Second','Person','fixture',false),
('76000000-0000-4000-8000-000000000009','crash@example.test','Crash','Person','fixture',false),
('76000000-0000-4000-8000-000000000010','blocked-after-crash@example.test','Blocked','Person','fixture',false);
INSERT INTO public.app_user_roles(user_id,email,role) VALUES
('w173-staff','w173-staff@example.test','staff');
INSERT INTO public.app_user_roles(user_id,email,role,repreneur_id) VALUES
('w173-repreneur-interest','interested@example.test','repreneur','76000000-0000-4000-8000-000000000004'),
('w173-repreneur-second','second@example.test','repreneur','76000000-0000-4000-8000-000000000008');
INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,created_by,interest_expressed_at) VALUES
('76000000-0000-4000-8000-000000000011','76000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000004','proposed','w173-staff',NULL),
('76000000-0000-4000-8000-000000000012','76000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000005','interested','w173-staff',NULL),
('76000000-0000-4000-8000-000000000013','76000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000006','declined','fixture',NULL),
('76000000-0000-4000-8000-000000000014','76000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000007','proposed','w173-staff',NULL),
('76000000-0000-4000-8000-000000000015','76000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000008','proposed','w173-staff',NULL),
('76000000-0000-4000-8000-000000000016','76000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000009','proposed','w173-staff',NULL),
('76000000-0000-4000-8000-000000000017','76000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000010','proposed','w173-staff',NULL);
RESET session_replication_role;
INSERT INTO public.email_templates(template_key,subject,description,is_active,requires_consent,body_markdown,body_editable)
VALUES('interest_outcome_validated','Custom staff subject {opportunityTitle}','Pre-existing scoped override',
  false,false,'Custom staff body {firstName}',true);
