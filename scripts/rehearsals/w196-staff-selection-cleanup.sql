\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE v_id uuid; v_generation uuid; v_intent_id uuid;
BEGIN
  v_id := (public.w196_selected_external_operation(
    '76000000-0000-4000-8000-000000000090','76000000-0000-4000-8000-000000000089',
    '76000000-0000-4000-8000-000000000004','w173-staff','w173-staff@example.test',
    'create',NULL,jsonb_build_object('ownerRepreneurId','76000000-0000-4000-8000-000000000004',
      'title','Selected owner A synthetic dossier','availability','available'),'w196-a-create')->>'pursuitId')::uuid;
  IF v_id IS NULL OR (SELECT created_by FROM public.external_pursuits WHERE id=v_id)<>'w173-staff'
    OR (SELECT staff_internal_notes FROM public.external_pursuit_staff_notes WHERE external_pursuit_id=v_id) IS NOT NULL
  THEN RAISE EXCEPTION 'w196_external_create_attribution'; END IF;
  PERFORM public.w196_selected_external_operation(
    '76000000-0000-4000-8000-000000000090','76000000-0000-4000-8000-000000000089',
    '76000000-0000-4000-8000-000000000004','w173-staff','w173-staff@example.test',
    'confirm',v_id,'{}','w196-a-confirm');
  IF (SELECT last_confirmed_by FROM public.external_pursuits WHERE id=v_id)<>'w173-staff'
    OR NOT EXISTS (SELECT 1 FROM public.external_pursuit_audit_events
      WHERE external_pursuit_id=v_id AND actor_user_id='w173-staff'
        AND metadata->>'confirmation'='current')
  THEN RAISE EXCEPTION 'w196_external_confirmation_not_attributed'; END IF;

  PERFORM public.w196_select_staff_portal_workspace('76000000-0000-4000-8000-000000000090',
    '76000000-0000-4000-8000-000000000007','w173-staff','w173-staff@example.test');
  SELECT generation INTO v_generation FROM public.staff_portal_workspaces
    WHERE id='76000000-0000-4000-8000-000000000090';
  IF v_generation='76000000-0000-4000-8000-000000000089' THEN RAISE EXCEPTION 'w196_selection_not_rotated'; END IF;
  INSERT INTO public.private_upload_intents
    (id,actor_kind,actor_key,actor_user_id,actor_email,upload_kind,resource_id,related_id,
      bucket_id,storage_path,original_filename,content_type,declared_size,metadata,
      idempotency_key,finalize_secret_hash,expires_at)
  VALUES
    ('76000000-0000-4000-8000-000000000085','staff','staff:w173-staff:',
      'w173-staff','w173-staff@example.test','repreneur_document',
      '76000000-0000-4000-8000-000000000004',NULL,'cvs',
      'cvs/76000000-0000-4000-8000-000000000004/ldc/76000000-0000-4000-8000-000000000085.pdf',
      'ldc.pdf','application/pdf',100,
      jsonb_build_object('document_type','ldc','selected_owner_id','76000000-0000-4000-8000-000000000004',
        'staff_portal_workspace_id','76000000-0000-4000-8000-000000000090',
        'staff_portal_generation','76000000-0000-4000-8000-000000000089'),
      '76000000-0000-4000-8000-000000000085',repeat('b',64),clock_timestamp()+interval '1 hour'),
    ('76000000-0000-4000-8000-000000000086','staff','staff:w173-staff:',
      'w173-staff','w173-staff@example.test','external_pursuit_attachment',
      v_id,NULL,'external-pursuit-attachments',
      v_id::text||'/'||repeat('e',64)||'.pdf',
      'attachment.pdf','application/pdf',100,
      jsonb_build_object('selected_owner_id','76000000-0000-4000-8000-000000000004',
        'staff_portal_workspace_id','76000000-0000-4000-8000-000000000090',
        'staff_portal_generation','76000000-0000-4000-8000-000000000089'),
      '76000000-0000-4000-8000-000000000086',repeat('b',64),clock_timestamp()+interval '1 hour');
  FOR v_intent_id IN SELECT id FROM public.private_upload_intents
    WHERE id IN ('76000000-0000-4000-8000-000000000085','76000000-0000-4000-8000-000000000086') LOOP
    BEGIN
      PERFORM public.w196_finalize_staff_portal_upload(v_intent_id,'staff:w173-staff:',repeat('b',64),repeat('c',64));
      RAISE EXCEPTION 'w196_old_a_upload_capability_accepted';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM <> 'staff_portal_selection_changed' THEN RAISE; END IF;
    END;
  END LOOP;
  BEGIN
    PERFORM public.w196_selected_external_operation(
      '76000000-0000-4000-8000-000000000090','76000000-0000-4000-8000-000000000089',
      '76000000-0000-4000-8000-000000000004','w173-staff','w173-staff@example.test',
      'confirm',v_id,'{}','w196-stale-confirm');
    RAISE EXCEPTION 'w196_old_a_external_capability_accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'staff_portal_selection_changed' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.w196_record_staff_opportunity_response(
      '76000000-0000-4000-8000-000000000004','76000000-0000-4000-8000-000000000003',
      '76000000-0000-4000-8000-000000000011',
      (SELECT updated_at FROM public.opportunities WHERE id='76000000-0000-4000-8000-000000000003'),
      (SELECT updated_at FROM public.opportunity_matches WHERE id='76000000-0000-4000-8000-000000000011'),
      NULL,'interested','{}',NULL,'w173-staff','w173-staff@example.test',
      '76000000-0000-4000-8000-000000000083',
      '76000000-0000-4000-8000-000000000090','76000000-0000-4000-8000-000000000089');
    RAISE EXCEPTION 'w196_old_a_response_accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'staff_portal_selection_changed' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.w196_update_staff_target_thesis(
      '76000000-0000-4000-8000-000000000004',
      (SELECT updated_at FROM public.repreneurs WHERE id='76000000-0000-4000-8000-000000000004'),
      '{}'::jsonb,'w173-staff','w173-staff@example.test',
      '76000000-0000-4000-8000-000000000084',
      '76000000-0000-4000-8000-000000000090','76000000-0000-4000-8000-000000000089');
    RAISE EXCEPTION 'w196_old_a_thesis_accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'staff_portal_selection_changed' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.w196_selected_external_operation(
      '76000000-0000-4000-8000-000000000090',v_generation,
      '76000000-0000-4000-8000-000000000007','w173-staff','w173-staff@example.test',
      'confirm',v_id,'{}','w196-b-on-a');
    RAISE EXCEPTION 'w196_b_context_changed_a_dossier';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'staff_portal_external_target_changed' THEN RAISE; END IF;
  END;
  v_id := (public.w196_selected_external_operation(
    '76000000-0000-4000-8000-000000000090',v_generation,
    '76000000-0000-4000-8000-000000000007','w173-staff','w173-staff@example.test',
    'create',NULL,jsonb_build_object('ownerRepreneurId','76000000-0000-4000-8000-000000000007',
      'title','Selected owner B synthetic dossier'),'w196-b-create')->>'pursuitId')::uuid;
  IF (SELECT owner_repreneur_id FROM public.external_pursuits WHERE id=v_id)
    IS DISTINCT FROM '76000000-0000-4000-8000-000000000007'::uuid
  THEN RAISE EXCEPTION 'w196_new_b_context_denied'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET session_replication_role=replica;
INSERT INTO public.repreneurs(id,email,first_name,last_name,created_by,is_demo)
VALUES ('76000000-0000-4000-8000-000000000080','cleanup@example.test','Cleanup','Fixture','fixture',false);
INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,created_by)
VALUES ('76000000-0000-4000-8000-000000000081','76000000-0000-4000-8000-000000000003',
  '76000000-0000-4000-8000-000000000080','proposed','fixture');
RESET session_replication_role;
INSERT INTO public.staff_assisted_match_responses
  (match_id,opportunity_id,repreneur_id,staff_user_id,staff_email,response,
    match_updated_at,operation_key,request_fingerprint)
VALUES ('76000000-0000-4000-8000-000000000081','76000000-0000-4000-8000-000000000003',
  '76000000-0000-4000-8000-000000000080','w173-staff','w173-staff@example.test',
  'declined',clock_timestamp(),'76000000-0000-4000-8000-000000000082',repeat('a',32));
INSERT INTO public.staff_assisted_profile_changes
  (repreneur_id,staff_user_id,staff_email,previous_updated_at,resulting_updated_at,
    operation_key,request_fingerprint)
VALUES ('76000000-0000-4000-8000-000000000080','w173-staff','w173-staff@example.test',
  clock_timestamp(),clock_timestamp(),'76000000-0000-4000-8000-000000000083',repeat('b',32));
DO $$ BEGIN
  BEGIN
    DELETE FROM public.staff_assisted_match_responses
      WHERE match_id='76000000-0000-4000-8000-000000000081';
    RAISE EXCEPTION 'w196_direct_match_history_delete_accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'staff_assisted_response_immutable' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM public.staff_assisted_profile_changes
      WHERE repreneur_id='76000000-0000-4000-8000-000000000080';
    RAISE EXCEPTION 'w196_direct_profile_history_delete_accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'staff_assisted_profile_history_immutable' THEN RAISE; END IF;
  END;
END $$;
DELETE FROM public.opportunity_matches WHERE id='76000000-0000-4000-8000-000000000081';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.staff_assisted_match_responses
    WHERE match_id='76000000-0000-4000-8000-000000000081')
  THEN RAISE EXCEPTION 'w196_match_cascade_blocked'; END IF;
END $$;
DELETE FROM public.repreneurs WHERE id='76000000-0000-4000-8000-000000000080';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.staff_assisted_profile_changes
    WHERE repreneur_id='76000000-0000-4000-8000-000000000080')
  THEN RAISE EXCEPTION 'w196_profile_cascade_blocked'; END IF;
END $$;
ROLLBACK;
