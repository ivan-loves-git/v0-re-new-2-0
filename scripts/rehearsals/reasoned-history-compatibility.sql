\set ON_ERROR_STOP on
-- This disposable database contains only the preceding synthetic V4 fixture.
-- Bind two fictional V3 rows to the unchanged source/digest validator.
TRUNCATE public.historical_pursuit_import_source_bindings;
CREATE TEMP TABLE history_252_rows(item JSONB);
DO $$
DECLARE i INTEGER; item JSONB; buyer UUID; fingerprint TEXT; payload TEXT; approval TEXT;
BEGIN
 SELECT data INTO item FROM v4_test_rows WHERE source_row=3;
 FOR i IN 1..2 LOOP
   buyer:=CASE WHEN i=1 THEN (item->>'repreneurId')::UUID ELSE '13400000-0000-4000-8000-000000000002'::UUID END;
   IF i=2 THEN INSERT INTO public.repreneurs(id,first_name,last_name,email,is_demo,created_by) VALUES(buyer,'Synthetic','V3 buyer','v3-252@example.invalid',FALSE,'fixture'); END IF;
   fingerprint:=encode(sha256(convert_to('synthetic-v3-'||i,'UTF8')),'hex');
   item:=item||jsonb_build_object('sourceRow',i+2,'repreneurId',buyer,'repreneurName','Synthetic V3 buyer '||i,'fingerprint',fingerprint);
   payload:=public.historical_pursuit_import_source_payload_digest(item->>'repreneurName',item->>'offerLabel',item->>'opportunityReference',ARRAY['interest_confirmed'],ARRAY(SELECT jsonb_array_elements_text(item->'notApplicableSourceStages')),item->>'dropReason',item->'sourceCells');
   approval:=public.historical_pursuit_import_approval_digest(fingerprint,payload,buyer,(item->>'opportunityId')::UUID,ARRAY[]::TEXT[],ARRAY[]::TEXT[]);
   INSERT INTO public.historical_pursuit_import_source_bindings VALUES('6fa8b640dfcd385c2bd6dabf571ee01a4f51d09a53122f65c422c047ddb3f60f','Synthese',i+2,'b25008e1dfcc7c9e8f21f0f2aad5d757e54ed508243a89595fd5e231feb907b7',fingerprint,payload,approval);
   INSERT INTO history_252_rows VALUES(item||jsonb_build_object('approvalDigest',approval));
 END LOOP;
END $$;
GRANT SELECT ON history_252_rows TO service_role;
SET ROLE service_role;
DO $$
DECLARE item JSONB; result JSONB; replay JSONB; saved_match_id UUID; before_count INTEGER;
BEGIN
 SELECT count(*) INTO before_count FROM public.opportunity_pursuit_evidence;
 FOR item IN SELECT r.item FROM history_252_rows r LOOP
   result:=public.apply_historical_pursuit_import_row(
     '6fa8b640dfcd385c2bd6dabf571ee01a4f51d09a53122f65c422c047ddb3f60f','Synthese',(item->>'sourceRow')::INTEGER,
     (item->>'repreneurId')::UUID,(item->>'opportunityId')::UUID,ARRAY['interest_confirmed'],ARRAY(SELECT jsonb_array_elements_text(item->'notApplicableSourceStages')),
     item->>'dropReason',TRUE,'v4-synthetic-staff',item->>'repreneurName',item->>'offerLabel',item->>'opportunityReference',item->>'fingerprint',
     'b25008e1dfcc7c9e8f21f0f2aad5d757e54ed508243a89595fd5e231feb907b7',ARRAY[]::TEXT[],ARRAY[]::TEXT[],item->'sourceCells',item->>'approvalDigest');
   saved_match_id:=(result->>'match_id')::UUID;
   IF result->>'outcome' NOT IN ('merged','created') OR NOT EXISTS(SELECT 1 FROM public.opportunity_matches WHERE id=saved_match_id AND status='dropped' AND pursuit_stage IS NULL AND nda_status='not_required') THEN RAISE EXCEPTION 'historical_import_compatibility_failed'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.historical_pursuit_import_rows_for_staff((item->>'repreneurId')::UUID) WHERE match_id=saved_match_id AND event_dates_unknown AND raw_drop_reason=item->>'dropReason') THEN RAISE EXCEPTION 'historical_source_facts_lost'; END IF;
   replay:=public.apply_historical_pursuit_import_row(
     '6fa8b640dfcd385c2bd6dabf571ee01a4f51d09a53122f65c422c047ddb3f60f','Synthese',(item->>'sourceRow')::INTEGER,
     (item->>'repreneurId')::UUID,(item->>'opportunityId')::UUID,ARRAY['interest_confirmed'],ARRAY(SELECT jsonb_array_elements_text(item->'notApplicableSourceStages')),
     item->>'dropReason',TRUE,'v4-synthetic-staff',item->>'repreneurName',item->>'offerLabel',item->>'opportunityReference',item->>'fingerprint',
     'b25008e1dfcc7c9e8f21f0f2aad5d757e54ed508243a89595fd5e231feb907b7',ARRAY[]::TEXT[],ARRAY[]::TEXT[],item->'sourceCells',item->>'approvalDigest');
   IF replay->>'outcome'<>'replay' THEN RAISE EXCEPTION 'historical_import_replay_failed'; END IF;
 END LOOP;
 IF (SELECT count(*) FROM public.opportunity_pursuit_evidence)<>before_count OR EXISTS(SELECT 1 FROM public.opportunity_pursuit_confidential_grants) THEN RAISE EXCEPTION 'historical_import_fabricated_current_evidence'; END IF;
 IF COALESCE(current_setting('wave.pursuit_history_import',TRUE),'')<>'' THEN RAISE EXCEPTION 'historical_import_capability_leaked'; END IF;
 BEGIN
   PERFORM public.apply_historical_pursuit_import_row('not-approved',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'not-staff',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
   RAISE EXCEPTION 'historical_import_nonstaff_allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'staff_outcome_actor_required' THEN RAISE; END IF; END;
 BEGIN
   PERFORM public.apply_historical_pursuit_import_row('not-approved',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'v4-synthetic-staff',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
   RAISE EXCEPTION 'historical_import_bad_source_allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'historical_pursuit_source_hash_not_approved' THEN RAISE; END IF; END;
 IF COALESCE(current_setting('wave.pursuit_history_import',TRUE),'')<>'' THEN RAISE EXCEPTION 'failed_history_import_capability_leaked'; END IF;
 BEGIN
   UPDATE public.opportunity_matches SET status='dropped' WHERE id='13300000-0000-4000-8000-000000000002';
   RAISE EXCEPTION 'historical_import_left_direct_bypass';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'pursuit_drop_requires_reasoned_transition' THEN RAISE; END IF; END;
 BEGIN
   INSERT INTO public.opportunity_matches(opportunity_id,repreneur_id,status) VALUES('13200000-0000-4000-8000-000000000001','13100000-0000-4000-8000-000000000002','dropped');
   RAISE EXCEPTION 'historical_import_left_direct_insert_bypass';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'pursuit_drop_requires_reasoned_transition' THEN RAISE; END IF; END;
 IF has_function_privilege('service_role','public.apply_pursuit_workbook_v4_bound_rows(jsonb,text)','EXECUTE')
   OR has_function_privilege('service_role','public.apply_historical_pursuit_import_row_bound(text,text,integer,uuid,uuid,text[],text[],text,boolean,text,text,text,text,text,text,text[],text[],jsonb,text)','EXECUTE') THEN RAISE EXCEPTION 'historical_import_private_writer_exposed'; END IF;
END $$;
RESET ROLE;
