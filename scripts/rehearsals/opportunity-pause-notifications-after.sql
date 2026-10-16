DO $$
DECLARE v_pause_id uuid; notice_id uuid; payload jsonb; first_pause uuid;
BEGIN
 IF EXISTS(SELECT 1 FROM public.opportunity_pause_notifications) THEN RAISE EXCEPTION 'pause_backfill_forbidden'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.email_templates WHERE template_key='opportunity_paused' AND is_active AND auto_send AND NOT requires_consent) THEN RAISE EXCEPTION 'pause_template_not_automatic'; END IF;
 v_pause_id:=public.pause_opportunity_with_reason('26000000-0000-4000-8000-000000000101','other','staff-252','PRIVATE STAFF EXPLANATION');
 first_pause:=v_pause_id;
 IF (SELECT count(*) FROM public.opportunity_pause_notifications n WHERE n.pause_id=v_pause_id)<>2 THEN RAISE EXCEPTION 'pause_recipient_selection_wrong'; END IF;
 SELECT id INTO notice_id FROM public.opportunity_pause_notifications WHERE repreneur_id='26000000-0000-4000-8000-000000000011';
 payload:=public.opportunity_pause_notification_payload(notice_id);
 IF payload->>'reason'<>'other' OR payload->>'publicTitle'<>'Public project' OR payload::text LIKE '%PRIVATE%' OR payload ? 'reason_note' THEN RAISE EXCEPTION 'pause_private_data_leaked'; END IF;
 IF (SELECT count(*) FROM public.pending_opportunity_pause_notifications(first_pause,50))<>2 THEN RAISE EXCEPTION 'pause_recovery_not_durable'; END IF;
 PERFORM public.fixture_assert_rejected($q$SELECT public.pause_opportunity_with_reason('26000000-0000-4000-8000-000000000101','other','staff-252','Duplicate')$q$,'opportunity_not_active_for_pause');
 IF (SELECT count(*) FROM public.opportunity_pause_notifications n WHERE n.pause_id=first_pause)<>2 THEN RAISE EXCEPTION 'pause_retry_duplicated'; END IF;
 UPDATE public.opportunities SET status='active' WHERE id='26000000-0000-4000-8000-000000000101';
 IF public.opportunity_pause_notification_payload(notice_id) IS NOT NULL THEN RAISE EXCEPTION 'resumed_pause_was_sendable'; END IF;
 PERFORM public.pause_opportunity_with_reason('26000000-0000-4000-8000-000000000101','seller_paused_sale','staff-252',null);
 IF public.opportunity_pause_notification_payload(notice_id) IS NOT NULL THEN RAISE EXCEPTION 'earlier_pause_was_sendable'; END IF;
 IF (SELECT count(*) FROM public.opportunity_pause_notifications)<>4 THEN RAISE EXCEPTION 'new_pause_not_distinct'; END IF;
 UPDATE public.email_templates SET is_active=false WHERE template_key='opportunity_paused';
 UPDATE public.opportunities SET status='active' WHERE id='26000000-0000-4000-8000-000000000101';
 PERFORM public.pause_opportunity_with_reason('26000000-0000-4000-8000-000000000101','waiting_updated_information','staff-252',null);
 UPDATE public.email_templates SET is_active=true WHERE template_key='opportunity_paused';
 IF (SELECT count(*) FROM public.opportunity_pause_notifications)<>4 OR EXISTS(SELECT 1 FROM public.pending_opportunity_pause_notifications(null,50)) THEN RAISE EXCEPTION 'activation_replayed_old_pause'; END IF;
 IF has_table_privilege('authenticated','public.opportunity_pause_notifications','SELECT') OR has_table_privilege('anon','public.opportunity_pause_notifications','SELECT') OR has_table_privilege('service_role','public.opportunity_pause_notifications','UPDATE')
   OR has_function_privilege('authenticated','public.opportunity_pause_notification_payload(uuid)','EXECUTE') OR has_function_privilege('anon','public.pending_opportunity_pause_notifications(uuid,integer)','EXECUTE')
   OR NOT has_function_privilege('service_role','public.opportunity_pause_notification_payload(uuid)','EXECUTE') THEN RAISE EXCEPTION 'pause_privacy_permissions_wrong'; END IF;
END $$;
BEGIN;
UPDATE public.opportunities SET status='active' WHERE id='26000000-0000-4000-8000-000000000101';
SELECT public.pause_opportunity_with_reason('26000000-0000-4000-8000-000000000101','exclusivity_another_buyer','staff-252',null);
SET CONSTRAINTS ALL IMMEDIATE;
ROLLBACK;
