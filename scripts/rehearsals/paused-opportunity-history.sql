\set ON_ERROR_STOP on
-- Actual protected E4/E6/E7 services have qualified this disposable pursuit.
-- Approve a retained synthetic IM through the existing native grant service.
INSERT INTO public.opportunity_documents(id,opportunity_id,title,document_type,visibility,storage_path,file_name,mime_type,size_bytes,uploaded_by)
VALUES('25600000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000003','Synthetic retained memo','deal_book','staff_only',
  '76000000-0000-4000-8000-000000000003/256-memo.pdf','256-memo.pdf','application/pdf',100,'w173-staff');
SELECT public.journey_grant_confidential_access('76000000-0000-4000-8000-000000000011','25600000-0000-4000-8000-000000000001','w173-staff','256-native-approval',clock_timestamp()+interval '1 day');
SELECT * FROM public.record_repreneur_opportunity_review('76000000-0000-4000-8000-000000000004','76000000-0000-4000-8000-000000000003');
SELECT * FROM public.record_repreneur_opportunity_review('76000000-0000-4000-8000-000000000004','76000000-0000-4000-8000-000000000003',true,false);
DO $$ BEGIN
  IF NOT public.journey_repreneur_can_access_confidential('76000000-0000-4000-8000-000000000011','76000000-0000-4000-8000-000000000004','25600000-0000-4000-8000-000000000001')
    OR NOT EXISTS(SELECT 1 FROM public.journey_repreneur_authorized_template('76000000-0000-4000-8000-000000000011','76000000-0000-4000-8000-000000000004'))
  THEN RAISE EXCEPTION 'active_document_positive_control_failed'; END IF;
END $$;
-- Genuine own visit-only history: opening creates a private marker, never a match.
SET session_replication_role=replica;
INSERT INTO public.opportunities(id,reference,status,source_office_id,created_by,is_demo,public_title,description) VALUES
 ('25600000-0000-4000-8000-000000000010','256-VISIT','active','76000000-0000-4000-8000-000000000002','fixture',false,'Synthetic visit-only','Synthetic disposable description'),
 ('25600000-0000-4000-8000-000000000011','256-OTHER','active','76000000-0000-4000-8000-000000000002','fixture',false,'Synthetic other owner','Synthetic disposable description'),
 ('25600000-0000-4000-8000-000000000012','256-UNOPENED','active','76000000-0000-4000-8000-000000000002','fixture',false,'Synthetic unopened','Synthetic disposable description'),
 ('25600000-0000-4000-8000-000000000015','256-OPEN-FIRST','active','76000000-0000-4000-8000-000000000002','fixture',false,'Synthetic opening first','Synthetic disposable description'),
 ('25600000-0000-4000-8000-000000000016','256-PAUSE-FIRST','active','76000000-0000-4000-8000-000000000002','fixture',false,'Synthetic pause first','Synthetic disposable description');
RESET session_replication_role;
INSERT INTO public.opportunity_ma_contacts(opportunity_id,affiliation_id,contact_name_snapshot,is_primary,linked_by)
SELECT id,'25400000-0000-4000-8000-000000000092','Synthetic source contact',true,'w173-staff'
FROM public.opportunities WHERE reference LIKE '256-%';
SELECT * FROM public.record_repreneur_opportunity_review('76000000-0000-4000-8000-000000000004','25600000-0000-4000-8000-000000000010');
SELECT * FROM public.record_repreneur_opportunity_review('76000000-0000-4000-8000-000000000007','25600000-0000-4000-8000-000000000011');
SELECT public.pause_opportunity_with_reason('76000000-0000-4000-8000-000000000003','seller_paused_sale','w173-staff',NULL);
SELECT public.pause_opportunity_with_reason('25600000-0000-4000-8000-000000000010','seller_paused_sale','w173-staff',NULL);
SELECT public.pause_opportunity_with_reason('25600000-0000-4000-8000-000000000011','seller_paused_sale','w173-staff',NULL);
SELECT public.pause_opportunity_with_reason('25600000-0000-4000-8000-000000000012','seller_paused_sale','w173-staff',NULL);

-- Capture complete retained rows, including private timestamp/review, business
-- clocks, approvals, attempts, deliveries, grants and immutable external evidence.
CREATE FUNCTION public.synthetic_256_snapshot() RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb:='{}'; relation text; rows jsonb;
BEGIN
  FOREACH relation IN ARRAY ARRAY['opportunities','opportunity_matches','opportunity_pause_history',
    'repreneur_opportunity_review_state','opportunity_documents','opportunity_nda_artifacts',
    'opportunity_pursuit_evidence','opportunity_pursuit_confidential_grants','opportunity_pursuit_external_handoffs',
    'opportunity_pursuit_handoff_deliveries','opportunity_interest_events','opportunity_interest_notification_deliveries',
    'staff_email_reviews','staff_email_review_events','ma_source_email_send_reservations','ma_contact_email_policy_events','ma_interactions'] LOOP
    EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(record) ORDER BY to_jsonb(record)::text),''[]'') FROM public.%I record',relation) INTO rows;
    result:=result||jsonb_build_object(relation,rows);
  END LOOP;
  RETURN result;
END $$;
CREATE TABLE public.synthetic_256_before AS SELECT public.synthetic_256_snapshot() AS snapshot;
DO $$ DECLARE history uuid[]; BEGIN
  SELECT array_agg(marker.opportunity_id ORDER BY marker.opportunity_id) INTO history
    FROM public.repreneur_opportunity_review_state marker JOIN public.opportunities opportunity ON opportunity.id=marker.opportunity_id
    WHERE marker.repreneur_id='76000000-0000-4000-8000-000000000004' AND NOT marker.is_demo AND NOT opportunity.is_demo AND opportunity.status='paused';
  IF history IS DISTINCT FROM ARRAY['25600000-0000-4000-8000-000000000010','76000000-0000-4000-8000-000000000003']::uuid[]
    OR EXISTS(SELECT 1 FROM public.opportunity_matches WHERE opportunity_id='25600000-0000-4000-8000-000000000010')
    OR EXISTS(SELECT 1 FROM public.repreneur_opportunity_review_state WHERE opportunity_id='25600000-0000-4000-8000-000000000012')
  THEN RAISE EXCEPTION 'private_history_owner_or_visit_provenance_failed'; END IF;
  IF public.journey_repreneur_can_access_confidential('76000000-0000-4000-8000-000000000011','76000000-0000-4000-8000-000000000004','25600000-0000-4000-8000-000000000001')
    OR EXISTS(SELECT 1 FROM public.journey_repreneur_authorized_template('76000000-0000-4000-8000-000000000011','76000000-0000-4000-8000-000000000004'))
  THEN RAISE EXCEPTION 'paused_old_document_authorization_survived'; END IF;
  BEGIN PERFORM public.record_repreneur_opportunity_review('76000000-0000-4000-8000-000000000004','25600000-0000-4000-8000-000000000010'); RAISE EXCEPTION 'paused_opening_allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'review_not_available' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_repreneur_opportunity_review('76000000-0000-4000-8000-000000000004','76000000-0000-4000-8000-000000000003',false,true); RAISE EXCEPTION 'paused_review_allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'review_not_available' THEN RAISE; END IF; END;
  BEGIN PERFORM public.express_opportunity_interest('25600000-0000-4000-8000-000000000010','76000000-0000-4000-8000-000000000004','w173-repreneur-interest'); RAISE EXCEPTION 'paused_interest_allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'interest_not_available' THEN RAISE; END IF; END;
  BEGIN PERFORM public.journey_grant_confidential_access('76000000-0000-4000-8000-000000000011','25600000-0000-4000-8000-000000000001','w173-staff','256-stale-approval',clock_timestamp()+interval '1 day'); RAISE EXCEPTION 'paused_grant_restored';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'An active pursuit on an active opportunity is required.' THEN RAISE; END IF; END;
  IF has_table_privilege('authenticated','public.repreneur_opportunity_review_state','SELECT')
    OR has_table_privilege('anon','public.repreneur_opportunity_review_state','SELECT')
    OR has_table_privilege('service_role','public.repreneur_opportunity_review_state','INSERT')
    OR has_table_privilege('service_role','public.repreneur_opportunity_review_state','UPDATE')
    OR has_table_privilege('service_role','public.repreneur_opportunity_review_state','DELETE')
    OR has_function_privilege('authenticated','public.record_repreneur_opportunity_review(uuid,uuid,boolean,boolean)','EXECUTE')
    OR NOT has_table_privilege('service_role','public.repreneur_opportunity_review_state','SELECT')
  THEN RAISE EXCEPTION 'private_history_acl_failed'; END IF;
  IF public.synthetic_256_snapshot() IS DISTINCT FROM (SELECT snapshot FROM public.synthetic_256_before)
  THEN RAISE EXCEPTION 'paused_reads_or_denials_mutated_retained_state'; END IF;
END $$;
\echo 'PASS: actual active opening provenance; own visit-only, other owner and unopened exclusion; private ACL; native positive memo/NDA controls then Paused denials; complete persisted snapshot unchanged.'
