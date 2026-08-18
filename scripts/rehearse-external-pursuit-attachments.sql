-- Disposable W-108 database/storage-metadata rehearsal. Run only after the
-- W-105 foundation in a temporary Supabase-compatible PostgreSQL database.
\set ON_ERROR_STOP on
\ir 097_external_pursuit_attachments.sql
\ir 100_external_pursuit_attachment_map.sql
BEGIN;

INSERT INTO public.repreneurs (id,first_name,last_name,email) VALUES
  ('00000000-0000-4000-8000-000000010801','Owner','A','w108-owner-a@example.test'),
  ('00000000-0000-4000-8000-000000010802','Owner','B','w108-owner-b@example.test')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.app_user_roles (user_id,email,role,repreneur_id) VALUES
  ('w108-owner-a-user','w108-owner-a@example.test','repreneur','00000000-0000-4000-8000-000000010801'),
  ('w108-owner-b-user','w108-owner-b@example.test','repreneur','00000000-0000-4000-8000-000000010802'),
  ('w108-staff-user','w108-staff@example.test','staff',NULL)
ON CONFLICT DO NOTHING;

DO $$
DECLARE d UUID; d_other UUID; registered JSONB; replay JSONB; attachment UUID; expected_path TEXT; owner_label TEXT; staff_label TEXT; batch_count BIGINT;
BEGIN
  d := public.create_external_pursuit('00000000-0000-4000-8000-000000010801','W-108 fixture','identified','unknown',NULL,NULL,NULL,'w108-owner-a-user','w108-create');
  d_other := public.create_external_pursuit('00000000-0000-4000-8000-000000010802','W-119 other-owner fixture','identified','unknown',NULL,NULL,NULL,'w108-owner-b-user','w119-other-owner-create');
  IF public.external_pursuit_deletion_fulfillment_replay(d,'w108-staff-user','w108-safe-fulfill') THEN RAISE EXCEPTION 'w108_live_dossier_reported_as_fulfilled'; END IF;
  BEGIN PERFORM public.external_pursuit_deletion_fulfillment_replay(d,'w108-owner-a-user','w108-safe-fulfill'); RAISE EXCEPTION 'w108_owner_tombstone_replay_was_allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'External Pursuit access denied.' THEN RAISE; END IF; END;
  BEGIN PERFORM public.register_external_pursuit_attachment(d,'00000000-0000-4000-8000-000000010802/' || repeat('c',64) || '.pdf','Wrong dossier.pdf','application/pdf',1,'w108-owner-a-user','w108-wrong-path-rpc'); RAISE EXCEPTION 'w108_rpc_path_mismatch_was_allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'External Pursuit attachment path is invalid.' THEN RAISE; END IF; END;
  BEGIN INSERT INTO public.external_pursuit_attachments(external_pursuit_id,storage_path,original_filename,content_type,byte_size,created_by) VALUES(d,'00000000-0000-4000-8000-000000010802/' || repeat('d',64) || '.pdf','Wrong dossier.pdf','application/pdf',1,'w108-owner-a-user'); RAISE EXCEPTION 'w108_table_path_mismatch_was_allowed'; EXCEPTION WHEN check_violation THEN NULL; END;
  expected_path := d::TEXT || '/' || repeat('a',64) || '.pdf';
  registered := public.register_external_pursuit_attachment(d,expected_path,'Source memo.pdf','application/pdf',1024,'w108-owner-a-user','w108-upload');
  replay := public.register_external_pursuit_attachment(d,d::TEXT || '/' || repeat('b',64) || '.pdf','Changed.pdf','application/pdf',2,'w108-owner-a-user','w108-upload');
  IF registered <> replay OR registered->>'storage_path' <> expected_path THEN RAISE EXCEPTION 'w108_upload_replay_failed'; END IF;
  attachment := (registered->>'attachment_id')::UUID;
  SELECT uploader_label INTO owner_label FROM public.external_pursuit_attachments_for_actor(d,'w108-owner-a-user') WHERE id=attachment;
  SELECT uploader_label INTO staff_label FROM public.external_pursuit_attachments_for_actor(d,'w108-staff-user') WHERE id=attachment;
  IF owner_label <> 'You' OR staff_label <> 'Dossier owner' THEN RAISE EXCEPTION 'w108_uploader_projection_failed'; END IF;
  SELECT count(*) INTO batch_count FROM public.external_pursuit_attachment_map_for_actor(ARRAY[d,d],'w108-owner-a-user');
  IF batch_count <> 1 THEN RAISE EXCEPTION 'w119_batch_projection_failed'; END IF;
  SELECT uploader_label INTO owner_label FROM public.external_pursuit_attachment_map_for_actor(ARRAY[d],'w108-owner-a-user') WHERE id=attachment;
  SELECT uploader_label INTO staff_label FROM public.external_pursuit_attachment_map_for_actor(ARRAY[d,d_other],'w108-staff-user') WHERE id=attachment;
  IF owner_label <> 'You' OR staff_label <> 'Dossier owner' THEN RAISE EXCEPTION 'w119_batch_uploader_projection_failed'; END IF;
  BEGIN PERFORM public.external_pursuit_attachment_map_for_actor(ARRAY[d,d_other],'w108-owner-a-user'); RAISE EXCEPTION 'w119_mixed_authorization_was_allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'External Pursuit access denied.' THEN RAISE; END IF; END;
  BEGIN PERFORM public.external_pursuit_attachment_map_for_actor(ARRAY[d],'w108-unassigned-user'); RAISE EXCEPTION 'w119_unassigned_was_allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'External Pursuit access denied.' THEN RAISE; END IF; END;
  BEGIN PERFORM public.external_pursuit_attachments_for_actor(d,'w108-owner-b-user'); RAISE EXCEPTION 'w108_other_owner_was_allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'External Pursuit access denied.' THEN RAISE; END IF; END;
  BEGIN PERFORM public.external_pursuit_attachments_for_actor(d,'w108-unassigned-user'); RAISE EXCEPTION 'w108_unassigned_was_allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'External Pursuit access denied.' THEN RAISE; END IF; END;
  PERFORM public.request_external_pursuit_deletion(d,'w108-owner-a-user','w108-delete-request');
  BEGIN PERFORM public.fulfill_external_pursuit_deletion(d,'w108-staff-user','w108-unsafe-fulfill'); RAISE EXCEPTION 'w108_legacy_fulfill_bypassed_attachments'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  IF NOT EXISTS (SELECT 1 FROM public.external_pursuits WHERE id=d) OR NOT EXISTS (SELECT 1 FROM public.external_pursuit_attachments WHERE id=attachment) THEN RAISE EXCEPTION 'w108_failed_fulfill_partially_deleted'; END IF;
  IF (SELECT count(*) FROM public.external_pursuit_attachment_cleanup_for_fulfillment(d,'w108-staff-user')) <> 1 THEN RAISE EXCEPTION 'w108_cleanup_projection_failed'; END IF;
  PERFORM public.clear_external_pursuit_attachment_records_for_fulfillment(d,'w108-staff-user');
  PERFORM public.fulfill_external_pursuit_deletion(d,'w108-staff-user','w108-safe-fulfill');
  IF EXISTS (SELECT 1 FROM public.external_pursuits WHERE id=d) OR EXISTS (SELECT 1 FROM public.external_pursuit_attachments WHERE external_pursuit_id=d) OR NOT EXISTS (SELECT 1 FROM public.external_pursuit_deletion_tombstones WHERE former_dossier_id=d) THEN RAISE EXCEPTION 'w108_safe_fulfill_failed'; END IF;
  IF NOT public.external_pursuit_deletion_fulfillment_replay(d,'w108-staff-user','w108-safe-fulfill') THEN RAISE EXCEPTION 'w108_exact_tombstone_replay_failed'; END IF;
  BEGIN PERFORM public.external_pursuit_deletion_fulfillment_replay(d,'w108-staff-user','w108-different-fulfill'); RAISE EXCEPTION 'w108_mismatched_tombstone_replay_was_allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'External Pursuit deletion fulfillment idempotency conflict.' THEN RAISE; END IF; END;
END $$;

DO $$
DECLARE bucket_limit BIGINT; bucket_public BOOLEAN; bucket_mimes TEXT[]; function_name TEXT;
BEGIN
  SELECT file_size_limit,public,allowed_mime_types INTO bucket_limit,bucket_public,bucket_mimes FROM storage.buckets WHERE id='external-pursuit-attachments';
  IF bucket_public OR bucket_limit <> 20971520 OR NOT bucket_mimes @> ARRAY['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/png']::TEXT[] OR bucket_mimes && ARRAY['application/msword','application/vnd.ms-excel']::TEXT[] THEN RAISE EXCEPTION 'w108_bucket_controls_invalid'; END IF;
  IF has_table_privilege('anon','public.external_pursuit_attachments','select,insert,update,delete,truncate,references,trigger') OR has_table_privilege('authenticated','public.external_pursuit_attachments','select,insert,update,delete,truncate,references,trigger') OR has_table_privilege('service_role','public.external_pursuit_attachments','insert,update,delete,truncate,references,trigger') OR NOT has_table_privilege('service_role','public.external_pursuit_attachments','select') THEN RAISE EXCEPTION 'w108_table_privileges_invalid'; END IF;
  FOREACH function_name IN ARRAY ARRAY[
    'external_pursuit_attachments_for_actor(uuid,text)',
    'external_pursuit_attachment_map_for_actor(uuid[],text)',
    'external_pursuit_attachment_for_actor(uuid,uuid,text)',
    'register_external_pursuit_attachment(uuid,text,text,text,bigint,text,text)',
    'external_pursuit_deletion_fulfillment_replay(uuid,text,text)',
    'external_pursuit_attachment_cleanup_for_fulfillment(uuid,text)',
    'clear_external_pursuit_attachment_records_for_fulfillment(uuid,text)'
  ] LOOP
    IF has_function_privilege('anon','public.'||function_name,'execute') OR has_function_privilege('authenticated','public.'||function_name,'execute') OR NOT has_function_privilege('service_role','public.'||function_name,'execute') THEN RAISE EXCEPTION 'w108_rpc_privilege_invalid:%',function_name; END IF;
  END LOOP;
END $$;

ROLLBACK;
