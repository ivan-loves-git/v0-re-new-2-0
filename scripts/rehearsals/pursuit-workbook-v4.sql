\set ON_ERROR_STOP on
-- Runs only in the local disposable cluster created by the paired shell script.
-- Replace ONLY that synthetic cluster's source bindings; the production migration
-- retains its reviewed 72 hashes. All apply code is the exact candidate function.
BEGIN;
TRUNCATE public.pursuit_workbook_v4_source_bindings;
CREATE TEMP TABLE v4_test_rows(source_row INTEGER,data JSONB);
CREATE TEMP TABLE v4_test_before AS SELECT count(*) AS matches,
  (SELECT count(*) FROM public.opportunity_recommendation_assignment_notifications) AS notifications FROM public.opportunity_matches;
INSERT INTO public.app_user_roles(user_id,email,role) VALUES('v4-synthetic-staff','v4-staff@example.invalid','staff');
SET LOCAL session_replication_role=replica;
DO $$ DECLARE i INTEGER; buyer UUID; opportunity UUID; match_id UUID; terminal BOOLEAN; cells JSONB; completed TEXT[]; unavailable TEXT[]; reason TEXT;
  source_name TEXT; source_ref TEXT; flags TEXT[]; blockers TEXT[]; row_fp TEXT; payload_fp TEXT; approval_fp TEXT; match_fp TEXT; item JSONB;
  stages TEXT[]:=ARRAY['interest_confirmed','nda_received','nda_signed','info_memo_received','qa_with_ma_firm','seller_meeting','valuation','loi_issued','audits','financing','closing'];
BEGIN
  FOR i IN 1..72 LOOP
    buyer:=('13100000-0000-4000-8000-'||lpad(i::TEXT,12,'0'))::UUID;
    opportunity:=CASE WHEN i<=57 THEN ('13200000-0000-4000-8000-'||lpad(i::TEXT,12,'0'))::UUID ELSE NULL END;
    match_id:=CASE WHEN i<=48 THEN ('13300000-0000-4000-8000-'||lpad(i::TEXT,12,'0'))::UUID ELSE NULL END;
    terminal:=NOT(i=10 OR i BETWEEN 49 AND 52);
    source_name:='Synthetic Buyer '||i; source_ref:='Re-New - IDF - '||lpad(i::TEXT,3,'0');
    flags:=CASE WHEN i=9 THEN ARRAY['existing_draft_workflow_preserved'] WHEN i=10 THEN ARRAY['source_active_current_dropped'] ELSE '{}'::TEXT[] END;
    blockers:=CASE WHEN i>57 THEN ARRAY['external_or_missing_opportunity_reference'] ELSE '{}'::TEXT[] END;
    completed:=ARRAY['interest_confirmed']; unavailable:=CASE WHEN terminal THEN stages[2:11] ELSE '{}'::TEXT[] END;
    reason:=CASE WHEN terminal THEN 'Synthetic source withdrawal' ELSE NULL END;
    SELECT jsonb_object_agg(stage,CASE WHEN ordinal=1 THEN 'Oui' WHEN terminal THEN 'N/A' ELSE NULL END) INTO cells FROM unnest(stages) WITH ORDINALITY AS x(stage,ordinal);
    INSERT INTO public.repreneurs(id,first_name,last_name,email,is_demo,created_by) VALUES(buyer,'Synthetic','Buyer '||i,'v4-'||i||'@example.invalid',false,'fixture');
    IF opportunity IS NOT NULL THEN
      INSERT INTO public.opportunities(id,reference,status,is_demo,source_office_id,description,created_by)
      VALUES(opportunity,source_ref,CASE WHEN i=24 THEN 'archived'::public.opportunity_status ELSE 'active'::public.opportunity_status END,false,'24000000-0000-4000-8000-000000000002','Synthetic original','fixture');
    END IF;
    IF match_id IS NOT NULL THEN
      INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,created_by,human_notes)
      VALUES(match_id,opportunity,buyer,CASE WHEN i<=9 THEN 'draft'::public.opportunity_match_status ELSE 'dropped'::public.opportunity_match_status END,'fixture','Preserved synthetic note');
      IF i=9 THEN UPDATE public.opportunity_matches SET interest_expressed_at='2026-08-01T12:00:00Z' WHERE id=match_id; END IF;
      SELECT encode(sha256(convert_to(to_jsonb(m)::TEXT,'UTF8')),'hex') INTO match_fp FROM public.opportunity_matches m WHERE m.id=match_id;
    ELSE match_fp:=NULL; END IF;
    row_fp:=encode(sha256(convert_to('synthetic-row-'||i,'UTF8')),'hex');
    payload_fp:=public.historical_pursuit_import_source_payload_digest(source_name,'Synthetic offer',source_ref,completed,unavailable,reason,cells);
    approval_fp:=public.historical_pursuit_import_approval_digest(row_fp,payload_fp,buyer,opportunity,blockers,flags);
    INSERT INTO public.pursuit_workbook_v4_source_bindings VALUES(i+2,row_fp,payload_fp,approval_fp,match_id IS NOT NULL,match_fp);
    item:=jsonb_build_object('sourceRow',i+2,'repreneurName',source_name,'offerLabel','Synthetic offer','opportunityReference',source_ref,
      'repreneurId',buyer,'opportunityId',opportunity,'completedSourceStages',completed,'notApplicableSourceStages',unavailable,
      'dropReason',reason,'sourceCells',cells,'fingerprint',row_fp,'approvalDigest',approval_fp,'blockers',blockers,'flags',flags);
    INSERT INTO v4_test_rows VALUES(i+2,item);
  END LOOP;
END $$;
RESET session_replication_role;
GRANT SELECT ON v4_test_rows,v4_test_before TO service_role;
COMMIT;

-- Keep one immutable earlier-source row and prove it survives the V4 append.
INSERT INTO public.historical_pursuit_import_rows(source_sha256,source_sheet,source_row,source_repreneur_name,source_cells,
  source_row_fingerprint,manifest_digest,payload_sha256,last_reported_source_stage,source_terminal,apply_outcome,applied_by)
VALUES(repeat('3',64),'Synthetic V3',3,'Prior synthetic source','{}',repeat('a',64),repeat('b',64),repeat('c',64),'none',false,'external_or_missing','fixture');
CREATE TEMP TABLE v4_test_prior AS SELECT to_jsonb(r) AS original FROM public.historical_pursuit_import_rows r;

SET ROLE service_role;
DO $$ DECLARE rows JSONB; changed JSONB; outcome JSONB; BEGIN
  SELECT jsonb_agg(data ORDER BY source_row) INTO rows FROM v4_test_rows;
  BEGIN
    PERFORM public.apply_pursuit_workbook_v4(rows-0,'v4-synthetic-staff');
    RAISE EXCEPTION 'incomplete_batch_accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'pursuit_v4_full_batch_required' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.apply_pursuit_workbook_v4(rows,'not-staff');
    RAISE EXCEPTION 'nonstaff_batch_accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'pursuit_v4_staff_required' THEN RAISE; END IF; END;
  BEGIN
    changed:=jsonb_set(rows,'{71,dropReason}','"Unapproved changed reason"');
    PERFORM public.apply_pursuit_workbook_v4(changed,'v4-synthetic-staff');
    RAISE EXCEPTION 'changed_payload_accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT IN ('historical_pursuit_approval_digest_invalid','pursuit_v4_source_binding_mismatch') THEN RAISE; END IF; END;
  BEGIN
    UPDATE public.opportunity_matches SET human_notes='Later staff work' WHERE id='13300000-0000-4000-8000-000000000040';
    PERFORM public.apply_pursuit_workbook_v4(rows,'v4-synthetic-staff');
    RAISE EXCEPTION 'changed_before_image_accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'pursuit_v4_live_match_changed' THEN RAISE; END IF; END;
  BEGIN
    UPDATE public.opportunities SET is_demo=true WHERE id='13200000-0000-4000-8000-000000000049';
    PERFORM public.apply_pursuit_workbook_v4(rows,'v4-synthetic-staff');
    RAISE EXCEPTION 'namespace_drift_accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'pursuit_v4_new_pair_not_eligible' THEN RAISE; END IF; END;
  IF (SELECT status FROM public.opportunity_matches WHERE id='13300000-0000-4000-8000-000000000001') <> 'draft' THEN RAISE EXCEPTION 'failed_batch_partially_applied'; END IF;
  outcome:=public.apply_pursuit_workbook_v4(rows,'v4-synthetic-staff');
  IF outcome IS DISTINCT FROM '{"created":9,"merged":48,"external_or_missing":15}'::JSONB THEN RAISE EXCEPTION 'v4_outcomes_wrong: %',outcome; END IF;
  IF public.apply_pursuit_workbook_v4(rows,'v4-synthetic-staff') IS DISTINCT FROM '{"replay":72}'::JSONB THEN RAISE EXCEPTION 'v4_replay_mutated'; END IF;
END $$;
RESET ROLE;

DO $$ BEGIN
  IF (SELECT count(*) FROM public.historical_pursuit_import_rows WHERE source_sha256='f527683a09d1e67e2c01479c20529963b7b1760578ff558181cad18c7febfbd3')<>72 THEN RAISE EXCEPTION 'v4_ledger_incomplete'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.historical_pursuit_import_rows r JOIN v4_test_prior p ON to_jsonb(r)=p.original) THEN RAISE EXCEPTION 'v3_history_changed'; END IF;
  IF (SELECT count(*) FROM public.opportunity_matches WHERE id BETWEEN '13300000-0000-4000-8000-000000000001' AND '13300000-0000-4000-8000-000000000008' AND status='dropped')<>8 THEN RAISE EXCEPTION 'v4_draft_drops_wrong'; END IF;
  IF (SELECT status FROM public.opportunity_matches WHERE id='13300000-0000-4000-8000-000000000009') <> 'draft' THEN RAISE EXCEPTION 'v4_existing_workflow_changed'; END IF;
  IF (SELECT count(*) FROM public.opportunity_matches WHERE created_by='v4-synthetic-staff' AND status='draft')<>4
    OR (SELECT count(*) FROM public.opportunity_matches WHERE created_by='v4-synthetic-staff' AND status='dropped')<>5 THEN RAISE EXCEPTION 'v4_created_states_wrong'; END IF;
  IF EXISTS(SELECT 1 FROM public.opportunity_matches WHERE created_by='v4-synthetic-staff' AND (pursuit_stage IS NOT NULL OR nda_status<>'not_required' OR interest_expressed_at IS NOT NULL OR recommendation_published_at IS NOT NULL)) THEN RAISE EXCEPTION 'v4_fabricated_workflow'; END IF;
  IF EXISTS(SELECT 1 FROM public.opportunity_pursuit_evidence) OR EXISTS(SELECT 1 FROM public.opportunity_pursuit_events)
    OR EXISTS(SELECT 1 FROM public.opportunity_pursuit_confidential_grants) OR EXISTS(SELECT 1 FROM public.opportunity_nda_artifacts)
    OR EXISTS(SELECT 1 FROM public.email_logs)
    OR (SELECT count(*) FROM public.opportunity_recommendation_assignment_notifications)<>(SELECT notifications FROM v4_test_before) THEN RAISE EXCEPTION 'v4_created_evidence_or_notification'; END IF;
  IF has_function_privilege('authenticated','public.apply_pursuit_workbook_v4(jsonb,text)','EXECUTE')
    OR has_function_privilege('service_role','public.apply_pursuit_workbook_v4_row(text,text,integer,uuid,uuid,text[],text[],text,boolean,text,text,text,text,text,text,text[],text[],jsonb,text)','EXECUTE') THEN RAISE EXCEPTION 'v4_unscoped_access'; END IF;
END $$;
