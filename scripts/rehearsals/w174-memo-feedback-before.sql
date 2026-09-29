\set ON_ERROR_STOP on
-- Disposable pre-cutover history. Replica mode is confined to fixture seeding;
-- all post-migration workflow assertions run with business triggers enabled.
SET session_replication_role=replica;
INSERT INTO public.ma_firms(id,name,status,created_by) VALUES
('74000000-0000-4000-8000-000000000001','W174 synthetic firm','active','fixture');
INSERT INTO public.ma_offices(id,firm_id,name,status,is_default,created_by) VALUES
('74000000-0000-4000-8000-000000000002','74000000-0000-4000-8000-000000000001','W174 synthetic office','active',true,'fixture');
INSERT INTO public.opportunities(id,reference,status,source_office_id,created_by,is_demo,public_title,teaser_summary,description) VALUES
('74000000-0000-4000-8000-000000000003','W174-REAL','active','74000000-0000-4000-8000-000000000002','fixture',false,'Synthetic public title','Synthetic approved teaser','PRIVATE SOURCE MUST NOT SEND'),
('74000000-0000-4000-8000-000000000004','W174-DEMO','active','74000000-0000-4000-8000-000000000002','fixture',true,'Synthetic demo title','Synthetic demo teaser','PRIVATE DEMO SOURCE');
INSERT INTO public.repreneurs(id,email,first_name,last_name,created_by,is_demo) VALUES
('74000000-0000-4000-8000-000000000005','memo-real@example.test','Memo','Real','fixture',false),
('74000000-0000-4000-8000-000000000006','memo-demo@example.test','Memo','Demo','fixture',true);
INSERT INTO public.app_user_roles(user_id,email,role) VALUES
('w174-staff','w174-staff@example.test','staff');
INSERT INTO public.app_user_roles(user_id,email,role,repreneur_id) VALUES
('w174-repreneur-real','memo-real@example.test','repreneur','74000000-0000-4000-8000-000000000005');
INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,created_by) VALUES
('74000000-0000-4000-8000-000000000007','74000000-0000-4000-8000-000000000003','74000000-0000-4000-8000-000000000005','active_pursuit','fixture'),
('74000000-0000-4000-8000-000000000008','74000000-0000-4000-8000-000000000004','74000000-0000-4000-8000-000000000006','active_pursuit','fixture');
INSERT INTO public.opportunity_documents(id,opportunity_id,title,document_type,visibility,storage_bucket,storage_path,file_name,mime_type,size_bytes) VALUES
('74000000-0000-4000-8000-000000000009','74000000-0000-4000-8000-000000000003','Synthetic retained memo','deal_book','staff_only','opportunity-documents','74000000-0000-4000-8000-000000000003/memo.pdf','memo.pdf','application/pdf',100),
('74000000-0000-4000-8000-000000000010','74000000-0000-4000-8000-000000000004','Synthetic demo memo','deal_book','staff_only','opportunity-documents','74000000-0000-4000-8000-000000000004/memo.pdf','memo.pdf','application/pdf',100);
INSERT INTO public.opportunity_pursuit_evidence(id,match_id,opportunity_id,repreneur_id,event_type,actor,idempotency_key,document_id,metadata,recorded_at) VALUES
('74000000-0000-4000-8000-000000000011','74000000-0000-4000-8000-000000000007','74000000-0000-4000-8000-000000000003','74000000-0000-4000-8000-000000000005','confidential_access_granted','w174-staff','historical-grant','74000000-0000-4000-8000-000000000009','{}','2026-09-01 12:00+00');
RESET session_replication_role;
