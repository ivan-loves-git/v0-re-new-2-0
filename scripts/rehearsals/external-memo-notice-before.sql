-- A retained memo is an actual stored PDF metadata row, not an external URL.
INSERT INTO public.opportunity_documents(id,opportunity_id,title,document_type,visibility,storage_bucket,storage_path,file_name,mime_type,size_bytes,uploaded_by)
VALUES('25500000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000003','Synthetic IM','deal_book','staff_only','opportunity-documents','76000000-0000-4000-8000-000000000003/synthetic-memo.pdf','memo.pdf','application/pdf',100,'w173-staff');
BEGIN;
SELECT public.journey_grant_confidential_access('76000000-0000-4000-8000-000000000011','25500000-0000-4000-8000-000000000001','w173-staff','255-before-schema',now()+interval '30 days');
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.claim_opportunity_memo_notification('76000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000011',now())) THEN RAISE EXCEPTION 'ordinary_before_schema_claim_lost'; END IF;
END $$;
SET CONSTRAINTS ALL IMMEDIATE;
ROLLBACK;
