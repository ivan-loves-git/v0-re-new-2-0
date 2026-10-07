\set ON_ERROR_STOP on
-- Partial native Storage metadata proof. Actual PDF parser/byte I/O is tested
-- at the public action and protected Supabase fixture, never invented here.
CREATE TABLE public.synthetic_ldc_context(context jsonb,operation_key uuid,stage jsonb,event_id uuid);
INSERT INTO public.synthetic_ldc_context(operation_key) VALUES('25400000-0000-4000-8000-000000000201');
-- New current cycle, using the released lifecycle services; old receipts stay truthful.
SELECT public.journey_transition_terminal('76000000-0000-4000-8000-000000000011','drop','w173-staff@example.test','ldc-cycle-drop','buyer_search_paused');
SELECT public.journey_transition_terminal('76000000-0000-4000-8000-000000000011','reopen','w173-staff@example.test','ldc-cycle-reopen');
SELECT public.journey_start_pursuit('76000000-0000-4000-8000-000000000011','w173-staff@example.test','ldc-cycle-start');
DO $$ BEGIN
  BEGIN PERFORM public.journey_external_handoff_context('76000000-0000-4000-8000-000000000011','e4');
    RAISE EXCEPTION 'missing_ldc_qualified';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'external_ldc_source_missing' THEN RAISE; END IF; END;
  IF (SELECT count(*) FROM public.opportunity_pursuit_external_handoffs)<>3 OR EXISTS(SELECT 1 FROM public.pursuit_ldc_versions)
  THEN RAISE EXCEPTION 'missing_source_wrote_qualifying_effects'; END IF;
END $$;
UPDATE public.repreneurs SET ldc_url='cvs/76000000-0000-4000-8000-000000000004/ldc/source.pdf'
WHERE id='76000000-0000-4000-8000-000000000004';
INSERT INTO storage.objects(id,bucket_id,name,version,metadata)
VALUES('25400000-0000-4000-8000-000000000202','cvs','cvs/76000000-0000-4000-8000-000000000004/ldc/source.pdf','source-A',jsonb_build_object('size',100,'mimetype','application/pdf'));
DO $$ BEGIN
  BEGIN UPDATE public.repreneurs SET ldc_url='cvs/76000000-0000-4000-8000-000000000008/ldc/other.pdf' WHERE id='76000000-0000-4000-8000-000000000004';
    PERFORM public.journey_external_handoff_context('76000000-0000-4000-8000-000000000011','e4'); RAISE EXCEPTION 'wrong_owner_source_allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'external_ldc_source_owner_invalid' THEN RAISE; END IF; END;
  BEGIN UPDATE public.repreneurs SET is_demo=true WHERE id='76000000-0000-4000-8000-000000000004';
    PERFORM public.journey_external_handoff_context('76000000-0000-4000-8000-000000000011','e4'); RAISE EXCEPTION 'wrong_mode_source_allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT IN ('external_handoff_pursuit_stale','external_ldc_owner_or_namespace_invalid','w164_matched_repreneur_reclassification_denied') THEN RAISE; END IF; END;
  BEGIN UPDATE storage.objects SET metadata=jsonb_build_object('size',100,'mimetype','application/msword') WHERE id='25400000-0000-4000-8000-000000000202';
    PERFORM public.journey_external_handoff_context('76000000-0000-4000-8000-000000000011','e4'); RAISE EXCEPTION 'word_source_allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'external_ldc_pdf_version_invalid' THEN RAISE; END IF; END;
END $$;
UPDATE public.synthetic_ldc_context SET context=jsonb_set(public.journey_external_handoff_context('76000000-0000-4000-8000-000000000011','e4'),'{ldc,content_sha256}',to_jsonb(repeat('a',64)));
UPDATE public.synthetic_ldc_context SET stage=public.journey_stage_external_ldc('76000000-0000-4000-8000-000000000011',context,operation_key,'w173-staff','w173-staff@example.test');
INSERT INTO storage.objects(bucket_id,name,version,metadata,user_metadata)
SELECT 'cvs',stage->>'storage_path','retained-A',jsonb_build_object('size',100,'mimetype','application/pdf'),jsonb_build_object('sha256',repeat('a',64)) FROM public.synthetic_ldc_context;
CREATE FUNCTION public.synthetic_ldc_record() RETURNS uuid LANGUAGE sql AS $$
  SELECT public.journey_record_external_handoff('76000000-0000-4000-8000-000000000011',context,operation_key,current_date-1,NULL,'phone','Synthetic current existing LDC','w173-staff','w173-staff@example.test') FROM public.synthetic_ldc_context;
$$;
-- Fault after all inserted qualifying rows rolls the whole operation back.
CREATE FUNCTION public.synthetic_ldc_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced_ldc_link_failure'; END $$;
CREATE TRIGGER synthetic_ldc_late_fault BEFORE INSERT ON public.pursuit_external_ldc_receipts FOR EACH ROW EXECUTE FUNCTION public.synthetic_ldc_fault();
DO $$ BEGIN
  BEGIN PERFORM public.synthetic_ldc_record(); RAISE EXCEPTION 'fault_not_exercised';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'forced_ldc_link_failure' THEN RAISE; END IF; END;
  IF EXISTS(SELECT 1 FROM public.pursuit_ldc_versions) OR (SELECT count(*) FROM public.opportunity_pursuit_external_handoffs)<>3
    OR EXISTS(SELECT 1 FROM public.opportunity_pursuit_confidential_grants WHERE revoked_at IS NULL)
  THEN RAISE EXCEPTION 'late_fault_left_partial_qualifying_state'; END IF;
END $$;
DROP TRIGGER synthetic_ldc_late_fault ON public.pursuit_external_ldc_receipts;
-- Positive rollback must run deferred constraints, then preserve pending stage.
BEGIN;
SELECT public.synthetic_ldc_record();
SET CONSTRAINTS ALL IMMEDIATE;
ROLLBACK;
UPDATE public.synthetic_ldc_context SET event_id=public.synthetic_ldc_record();
DO $$ BEGIN
  IF (SELECT count(*) FROM public.pursuit_ldc_versions)<>1 OR (SELECT count(*) FROM public.pursuit_external_ldc_receipts)<>1
    OR EXISTS(SELECT 1 FROM public.journey_claim_ldc_cleanup((SELECT (stage->>'stage_id')::uuid FROM public.synthetic_ldc_context),
      '25400000-0000-4000-8000-000000000201','w173-staff'))
  THEN RAISE EXCEPTION 'retained_version_cleanup_allowed'; END IF;
  BEGIN UPDATE public.pursuit_ldc_versions SET content_sha256=repeat('b',64); RAISE EXCEPTION 'immutable_version_changed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'external_handoff_immutable' THEN RAISE; END IF; END;
END $$;
-- Shared exact versions can be resolved by another operation without a new
-- object or exposing that retained key to any old cleanup enqueue path.
DO $$ DECLARE reused jsonb; BEGIN
  reused:=public.journey_stage_external_ldc('76000000-0000-4000-8000-000000000011',(SELECT context FROM public.synthetic_ldc_context),
    '25400000-0000-4000-8000-000000000203','w173-staff','w173-staff@example.test');
  IF NOT (reused->>'retained')::boolean OR reused->>'storage_path' IS DISTINCT FROM (SELECT stage->>'storage_path' FROM public.synthetic_ldc_context)
  THEN RAISE EXCEPTION 'exact_version_not_reused'; END IF;
END $$;
INSERT INTO public.private_upload_intents(id,actor_kind,actor_key,actor_user_id,upload_kind,resource_id,bucket_id,storage_path,
  original_filename,content_type,declared_size,metadata,idempotency_key,finalize_secret_hash,expires_at)
VALUES('25400000-0000-4000-8000-000000000204','staff','staff:w173-staff','w173-staff','repreneur_document','76000000-0000-4000-8000-000000000004','cvs',
  'cvs/76000000-0000-4000-8000-000000000004/ldc/old-cleanup-source.pdf','old.pdf','application/pdf',100,'{"document_type":"ldc"}',
  '25400000-0000-4000-8000-000000000204',repeat('d',64),now()+interval '1 hour');
DO $$ BEGIN
  BEGIN INSERT INTO public.private_upload_cleanup_queue(intent_id,bucket_id,storage_path,reason)
    SELECT '25400000-0000-4000-8000-000000000204','cvs',stage->>'storage_path','older app enqueue' FROM public.synthetic_ldc_context;
    RAISE EXCEPTION 'old_enqueue_retained_key_allowed';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE '%private_upload_cleanup_no_retained_ldc%' THEN RAISE; END IF;
  END;
END $$;
DO $$ DECLARE path text:=(SELECT stage->>'storage_path' FROM public.synthetic_ldc_context); BEGIN
  BEGIN UPDATE public.repreneurs SET ldc_url=path WHERE id='76000000-0000-4000-8000-000000000004';
    RAISE EXCEPTION 'old_profile_delete_alias_allowed';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%repreneur_profile_no_retained_ldc_alias%' THEN RAISE; END IF; END;
  BEGIN UPDATE public.repreneurs SET cv_url='https://synthetic.invalid/storage/v1/object/sign/cvs/%70'||substring(path FROM 2) WHERE id='76000000-0000-4000-8000-000000000004';
    RAISE EXCEPTION 'encoded_old_profile_delete_alias_allowed';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%repreneur_profile_no_retained_ldc_alias%' THEN RAISE; END IF; END;
  BEGIN INSERT INTO public.private_upload_intents(id,actor_kind,actor_key,actor_user_id,upload_kind,resource_id,bucket_id,storage_path,
      original_filename,content_type,declared_size,metadata,idempotency_key,finalize_secret_hash,expires_at)
      SELECT '25400000-0000-4000-8000-000000000205',actor_kind,actor_key,actor_user_id,upload_kind,resource_id,bucket_id,path,
        original_filename,content_type,declared_size,metadata,'25400000-0000-4000-8000-000000000205',finalize_secret_hash,expires_at
      FROM public.private_upload_intents WHERE id='25400000-0000-4000-8000-000000000204';
    RAISE EXCEPTION 'old_upload_finalize_alias_allowed';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%private_upload_intent_no_retained_ldc%' THEN RAISE; END IF; END;
END $$;
-- An older queued/read worker deletes cvs only. The retained object remains.
DELETE FROM storage.objects WHERE bucket_id='cvs' AND id='25400000-0000-4000-8000-000000000202';
UPDATE public.repreneurs SET ldc_url='cvs/76000000-0000-4000-8000-000000000004/ldc/replacement.pdf' WHERE id='76000000-0000-4000-8000-000000000004';
DO $$ DECLARE event uuid; BEGIN
  event:=public.synthetic_ldc_record();
  IF event IS DISTINCT FROM (SELECT event_id FROM public.synthetic_ldc_context)
    OR (SELECT count(*) FROM public.pursuit_ldc_versions)<>1
    OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='cvs' AND name=(SELECT stage->>'storage_path' FROM public.synthetic_ldc_context))
  THEN RAISE EXCEPTION 'replacement_or_old_cleanup_lost_receipt'; END IF;
  BEGIN PERFORM public.journey_external_ldc_replay('25400000-0000-4000-8000-000000000201','76000000-0000-4000-8000-000000000011',
    (SELECT context FROM public.synthetic_ldc_context),current_date-1,NULL,'phone','Contradictory reference','w173-staff','w173-staff@example.test');
    RAISE EXCEPTION 'contradictory_replay_allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'external_handoff_retry_conflict' THEN RAISE; END IF; END;
  BEGIN PERFORM public.journey_external_ldc_replay('25400000-0000-4000-8000-000000000201','76000000-0000-4000-8000-000000000011',
    (SELECT context FROM public.synthetic_ldc_context),current_date-1,NULL,'phone','Synthetic current existing LDC','w173-staff','w173-staff@example.test',
    '25400000-0000-4000-8000-000000000206','25400000-0000-4000-8000-000000000207');
    RAISE EXCEPTION 'stale_workspace_replay_allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'staff_portal_selection_changed' THEN RAISE; END IF; END;
END $$;
-- Permissive policies cannot reopen the retained bucket to browser CRUD/list.
CREATE POLICY synthetic_broad_storage ON storage.objects FOR ALL TO anon,authenticated USING(true) WITH CHECK(true);
SET ROLE authenticated;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='cvs' AND name LIKE 'pursuit-ldc-evidence/%') THEN RAISE EXCEPTION 'browser_list_leaked_ldc'; END IF;
  BEGIN INSERT INTO storage.objects(bucket_id,name,version) VALUES('cvs','forged.pdf','forged'); RAISE EXCEPTION 'browser_insert_ldc_allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE storage.objects SET version='overwrite' WHERE bucket_id='cvs';
  IF FOUND THEN RAISE EXCEPTION 'browser_update_ldc_allowed'; END IF;
  DELETE FROM storage.objects WHERE bucket_id='cvs';
  IF FOUND THEN RAISE EXCEPTION 'browser_delete_ldc_allowed'; END IF;
END $$;
RESET ROLE;
-- Disable/older retained app schema keeps evidence and bytes, never replays mail.
UPDATE public.pursuit_external_handoff_settings SET enabled=false;
DO $$ BEGIN
  IF NOT public.journey_handoff_is_qualifying((SELECT event_id FROM public.synthetic_ldc_context))
    OR public.journey_retained_ldc_for_actor((SELECT receipt_id FROM public.pursuit_external_ldc_receipts),'w173-staff','w173-staff@example.test') IS NULL
  THEN RAISE EXCEPTION 'disabled_schema_lost_ldc_truth'; END IF;
END $$;
