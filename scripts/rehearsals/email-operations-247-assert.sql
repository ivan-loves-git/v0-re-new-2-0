CREATE FUNCTION public.assert_email_denied(p_sql text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN BEGIN EXECUTE p_sql; EXCEPTION WHEN OTHERS THEN RETURN; END; RAISE EXCEPTION 'expected_denial: %',p_sql; END $$;
DO $$ DECLARE old_id uuid; future_id uuid; v_token uuid; v jsonb; v_policy jsonb; BEGIN
 v:=public.email_business_prepare('welcome:one','welcome','22300000-0000-4000-8000-000000000003',
 'rep@example.test','Prepared subject','Prepared personal body https://example.test/portal','<p>Prepared personal body</p>',
 '{"idempotencyKey":"welcome:one","kind":"intake"}','["https://example.test/portal"]');
 old_id:=(v->>'id')::uuid;
 IF (v->'prepared_policy'->>'auto_send')::boolean THEN RAISE EXCEPTION 'business_not_review_default'; END IF;
 IF v->>'state'<>'pending' OR v->>'provider_message_id' IS NOT NULL THEN RAISE EXCEPTION 'queue_claimed_sent'; END IF;
 PERFORM public.assert_email_denied(format('SELECT public.email_business_reserve(%L,1,NULL)',old_id));
 PERFORM public.assert_email_denied('SELECT public.email_policy_set(''welcome'',true,''rep-one'')');
 PERFORM public.email_policy_set('welcome',true,'staff-one');
 PERFORM public.assert_email_denied(format('SELECT public.email_business_reserve(%L,1,NULL)',old_id));
 IF public.email_review_claim_future_auto(old_id) THEN RAISE EXCEPTION 'old_draft_auto_released'; END IF;
 v:=public.email_business_prepare('welcome:two','welcome','22300000-0000-4000-8000-000000000003',
 'rep@example.test','Future subject','Future body','<p>Future body</p>','{"idempotencyKey":"welcome:two"}','[]');
 future_id:=(v->>'id')::uuid;
 v_token:=public.email_business_reserve(future_id,1,NULL);
 PERFORM public.email_policy_set('welcome',false,'staff-one');
 IF public.email_business_authorize_attempt(future_id,v_token) THEN RAISE EXCEPTION 'disabled_auto_started_provider'; END IF;
 PERFORM public.email_business_finish(future_id,v_token,'failed',NULL,'Policy now requires review','system','[]',false);
 PERFORM public.assert_email_denied(format('SELECT public.staff_email_review_edit(%L,1,''Changed'',''lost protected link'',''staff-one'')',old_id));
 PERFORM public.staff_email_review_edit(old_id,1,'My subject','My words https://example.test/portal','staff-one');
 -- Saving reusable copy uses the same staff-only RPC as the actual Next action,
 -- against the baseline table rather than a synthetic column superset.
 SELECT jsonb_build_object('active',is_active,'auto',auto_send,'version',policy_version)
 INTO v_policy FROM public.email_templates WHERE template_key='welcome';
 PERFORM public.email_template_words_set('welcome','{"subject":"New reusable subject"}','staff-one');
 IF NOT EXISTS(SELECT 1 FROM public.email_templates WHERE template_key='welcome'
 AND subject='New reusable subject' AND body_markdown='Original body') THEN RAISE EXCEPTION 'subject_only_copy_not_retained'; END IF;
 PERFORM public.email_template_words_set('welcome','{"body_markdown":"New reusable body"}','staff-one');
 IF NOT EXISTS(SELECT 1 FROM public.email_templates WHERE template_key='welcome'
 AND subject='New reusable subject' AND body_markdown='New reusable body'
 AND jsonb_build_object('active',is_active,'auto',auto_send,'version',policy_version)=v_policy)
 THEN RAISE EXCEPTION 'body_copy_changed_policy_or_subject'; END IF;
 IF (SELECT count(*) FROM public.email_policy_events WHERE template_key='welcome' AND actor='staff-one'
 AND old_policy ? 'copy_sha' AND new_policy ? 'copy_sha')<>2
 OR NOT EXISTS(SELECT 1 FROM public.email_policy_events WHERE template_key='welcome' AND actor='staff-one'
 AND old_policy->>'copy_sha'=md5('Original subject|Original body')
 AND new_policy->>'copy_sha'=md5('New reusable subject|Original body'))
 OR NOT EXISTS(SELECT 1 FROM public.email_policy_events WHERE template_key='welcome' AND actor='staff-one'
 AND old_policy->>'copy_sha'=md5('New reusable subject|Original body')
 AND new_policy->>'copy_sha'=md5('New reusable subject|New reusable body'))
 THEN RAISE EXCEPTION 'copy_audit_missing_actual_actor_or_hash'; END IF;
 PERFORM public.assert_email_denied('SELECT public.email_template_words_set(''welcome'',''{"subject":"Denied"}'',''rep-one'')');
 PERFORM public.assert_email_denied('SELECT public.email_template_words_set(''welcome'',''{"subject":"Denied"}'','''')');
 PERFORM public.assert_email_denied('SELECT public.email_template_words_set(''welcome'',''{"subject":"  "}'',''staff-one'')');
 PERFORM public.assert_email_denied('SELECT public.email_template_words_set(''welcome'',''{"preview_text":"Unsupported"}'',''staff-one'')');
 PERFORM public.assert_email_denied('SELECT public.email_template_words_set(''welcome'',''{"auto_send":true}'',''staff-one'')');
 PERFORM public.assert_email_denied('SELECT public.email_template_words_set(''welcome'',''[]'',''staff-one'')');
 PERFORM public.assert_email_denied('SELECT public.email_template_words_set(''opportunity_memo_available'',''{"subject":"Denied"}'',''staff-one'')');
 UPDATE public.email_templates SET body_editable=false WHERE template_key='inactive';
 PERFORM public.assert_email_denied('SELECT public.email_template_words_set(''inactive'',''{"body_markdown":"Denied"}'',''staff-one'')');
 IF NOT EXISTS(SELECT 1 FROM public.email_templates WHERE template_key='welcome'
 AND subject='New reusable subject' AND body_markdown='New reusable body'
 AND jsonb_build_object('active',is_active,'auto',auto_send,'version',policy_version)=v_policy)
 OR (SELECT count(*) FROM public.email_policy_events WHERE template_key='welcome' AND old_policy ? 'copy_sha')<>2
 THEN RAISE EXCEPTION 'denied_copy_mutated_template_or_audit'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.staff_email_reviews WHERE id=old_id
 AND subject='My subject' AND body_text='My words https://example.test/portal'
 AND protected_links='["https://example.test/portal"]'::jsonb)
 THEN RAISE EXCEPTION 'template_overwrote_draft'; END IF;
 PERFORM public.assert_email_denied(format('SELECT public.email_business_reserve(%L,1,''staff-one'')',old_id));
 v_token:=public.email_business_reserve(old_id,2,'staff-one');
 IF NOT public.email_business_authorize_attempt(old_id,v_token) THEN RAISE EXCEPTION 'template_edit_blocked_retained_words'; END IF;
 PERFORM public.email_business_finish(old_id,v_token,'sent','provider-one',NULL,'staff-one','["cc@example.test"]',true);
 PERFORM public.assert_email_denied(format('SELECT public.staff_email_review_edit(%L,3,''Changed'',''other words'',''staff-one'')',old_id));
 PERFORM public.assert_email_denied(format('SELECT public.email_business_prepare(''inactive:one'',''inactive'',NULL,''staff@example.test'',''Dormant'',''Dormant'',''<p>Dormant</p>'',''{}'',''[]'')'));
 PERFORM public.assert_email_denied('SELECT public.email_business_prepare(''missing:one'',''missing'',NULL,''staff@example.test'',''Missing'',''Missing'',''<p>Missing</p>'',''{}'',''[]'')');
END $$;
-- An email identifies a stored account only after resolution from its exact
-- authenticated ID. It is never itself accepted as the service RPC actor.
DO $$ BEGIN
 BEGIN
  PERFORM public.email_policy_set_active('welcome',true,'one@example.test');
  RAISE EXCEPTION 'email_actor_accepted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'staff_email_review_requires_staff_actor' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.email_template_words_set('welcome','{"subject":"Denied email actor"}','one@example.test');
  RAISE EXCEPTION 'email_actor_copy_accepted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'staff_email_review_requires_staff_actor' THEN RAISE; END IF;
 END;
END $$;
INSERT INTO public.email_logs(repreneur_id,template_key,resend_id,to_email,subject,status,sent_at,idempotency_key)
 VALUES('22300000-0000-4000-8000-000000000003','welcome','provider-one','rep@example.test','My subject','sent',now(),'welcome:one');
SELECT public.email_provider_record_event('evt-bounce','provider-one','email.bounced',now(),'primary','Recorded primary bounce');
SELECT public.email_provider_record_event('evt-delivery','provider-one','email.delivered',now()-interval '1 minute','primary',NULL);
SELECT public.email_provider_record_event('evt-delivery','provider-one','email.delivered',now()-interval '1 minute','primary',NULL);
SELECT public.email_provider_record_event('evt-open','provider-one','email.opened',now(),'copy',NULL);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.email_operations_history WHERE provider_message_id='provider-one')<>1 THEN RAISE EXCEPTION 'history_duplicate_dispatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.email_operations_history WHERE provider_message_id='provider-one' AND delivered AND bounced AND opened AND tracking_verified) THEN RAISE EXCEPTION 'independent_facts_lost'; END IF;
 IF (SELECT count(*) FROM public.email_provider_events WHERE id='evt-delivery')<>1 THEN RAISE EXCEPTION 'duplicate_event'; END IF;
 IF (SELECT delivered_at FROM public.email_logs WHERE resend_id='provider-one') IS NULL THEN RAISE EXCEPTION 'late_delivery_fact_lost'; END IF;
 IF (SELECT status FROM public.email_logs WHERE resend_id='provider-one')<>'bounced' THEN RAISE EXCEPTION 'bounce_terminal_overwritten'; END IF;
 IF has_table_privilege('anon','public.email_operations_history','SELECT') OR has_table_privilege('authenticated','public.email_provider_events','SELECT')
 OR has_function_privilege('authenticated','public.email_policy_set(text,boolean,text)','EXECUTE')
 OR has_function_privilege('authenticated','public.email_template_words_set(text,jsonb,text)','EXECUTE')
 OR has_function_privilege('anon','public.email_template_words_set(text,jsonb,text)','EXECUTE')
 THEN RAISE EXCEPTION 'private_email_permission'; END IF;
END $$;
-- More than 150 retained accepted messages: search older evidence before paging;
-- the Sent cap is presentation only and unknown timestamps remain null.
INSERT INTO public.email_logs(repreneur_id,template_key,resend_id,to_email,subject,status,sent_at)
 SELECT '22300000-0000-4000-8000-000000000003','welcome','history-'||i,'rep@example.test',
 CASE WHEN i=151 THEN 'Older searchable receipt' ELSE 'Synthetic '||i END,'sent',now()-i*interval '1 hour' FROM generate_series(1,151)i;
DO $$ DECLARE a jsonb; BEGIN
 IF (SELECT count(*) FROM public.email_operations_history WHERE search_text ILIKE '%older searchable%')<>1 THEN RAISE EXCEPTION 'older_history_missing'; END IF;
 IF (SELECT count(*) FROM (SELECT id FROM public.email_operations_history WHERE sent_at IS NOT NULL ORDER BY sent_at DESC,id DESC LIMIT 150)x)<>150 THEN RAISE EXCEPTION 'sent_limit'; END IF;
 a:=public.email_operations_analytics(now()-interval '30 days',now()+interval '1 second');
 IF (a->>'totalSent')::integer<>152 OR (a->>'totalDelivered')::integer<>1 OR (a->>'coveredDelivered')::integer<>1 THEN RAISE EXCEPTION 'cohort_wrong: %',a; END IF;
 IF EXISTS(SELECT 1 FROM public.email_operations_history WHERE provider_message_id IS NULL AND sent_at IS NOT NULL) THEN RAISE EXCEPTION 'invented_send_time'; END IF;
END $$;

-- Complete public staff bulk workflow for a newly covered business source.
DO $$ DECLARE r jsonb; v_id uuid; v_batch uuid; v_item public.staff_email_bulk_items%ROWTYPE; v_claim jsonb; BEGIN
 r:=public.email_business_prepare('bulk:one','welcome','22300000-0000-4000-8000-000000000003',
 'rep@example.test','Bulk personal subject','Bulk personal words','<p>Bulk personal words</p>',
 '{"idempotencyKey":"bulk:one","kind":"manual","preparedBy":"staff-one"}','[]'); v_id:=(r->>'id')::uuid;
 v_batch:=public.staff_email_bulk_prepare(ARRAY[v_id],ARRAY[1],1,'active','%','all','prepared','desc','staff-one');
 SELECT * INTO v_item FROM public.staff_email_bulk_items WHERE batch_id=v_batch AND ordinal=1;
 PERFORM public.staff_email_bulk_ack(v_batch,1,v_item.snapshot_sha256,'staff-one');
 PERFORM public.staff_email_bulk_confirm(v_batch,(SELECT manifest_sha256 FROM public.staff_email_bulk_batches WHERE id=v_batch),'staff-one');
 v_claim:=public.staff_email_bulk_claim(v_batch,1,'staff-one',jsonb_build_object('to',jsonb_build_array('rep@example.test'),
 'subject','Bulk personal subject','text','Bulk personal words','attachments','[]'::jsonb),repeat('a',64));
 IF v_claim->>'start'<>'true' THEN RAISE EXCEPTION 'business_bulk_not_started'; END IF;
 IF (public.staff_email_bulk_claim(v_batch,1,'staff-one','{}',repeat('a',64))->>'start')::boolean THEN RAISE EXCEPTION 'bulk_double_start'; END IF;
 PERFORM public.email_business_finish(v_id,(v_claim->>'review_attempt_token')::uuid,'sent','bulk-provider',NULL,'staff-one','[]',false);
 PERFORM public.staff_email_bulk_finish(v_batch,1,(v_claim->>'claim_token')::uuid,'accepted','Provider accepted','staff-one');
 IF public.staff_email_bulk_reconcile(v_batch,1,'staff-one')<>'accepted' THEN RAISE EXCEPTION 'business_bulk_receipt_not_accepted'; END IF;
END $$;

-- A signed event arriving before acceptance remains attributable only after
-- the exact immutable primary recipient appears; copy/unknown cannot bounce it.
DO $$ BEGIN
 BEGIN PERFORM public.email_provider_record_event('early-delivery','early-provider','email.delivered',now(),'unknown',NULL,'rep@example.test');
 RAISE EXCEPTION 'orphan_event_retained'; EXCEPTION WHEN raise_exception THEN
 IF SQLERRM<>'email_provider_parent_not_yet_retained' THEN RAISE; END IF; END;
END $$;
INSERT INTO public.email_logs(repreneur_id,template_key,resend_id,to_email,subject,status,sent_at)
 VALUES('22300000-0000-4000-8000-000000000003','welcome','early-provider','rep@example.test','Early synthetic receipt','sent',now());
SELECT public.email_provider_record_event('early-delivery','early-provider','email.delivered',now(),'primary',NULL,'rep@example.test');
SELECT public.email_provider_record_event('unknown-bounce','early-provider','email.bounced',now(),'unknown','Unclassified recipient');
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.email_operations_history WHERE provider_message_id='early-provider' AND delivered AND NOT bounced AND status='delivered') THEN RAISE EXCEPTION 'early_event_lost_or_unknown_bounce'; END IF;
END $$;

-- New staff notices share their business parent's deletion boundary. No old
-- records are rewritten; only the new parent-owned candidate rows cascade.
INSERT INTO public.opportunity_matches VALUES ('24700000-0000-4000-8000-000000000009',
 '22300000-0000-4000-8000-000000000001','22300000-0000-4000-8000-000000000003');
INSERT INTO public.opportunity_interest_events VALUES ('24700000-0000-4000-8000-000000000008','24700000-0000-4000-8000-000000000009');
DO $$ DECLARE r jsonb; v_id uuid; BEGIN
 r:=public.email_business_prepare('delete:interest','locked_opportunity_interest',NULL,'staff@example.test',
 'Synthetic staff notice','Synthetic staff words','<p>Synthetic</p>',
 '{"kind":"interest","eventId":"24700000-0000-4000-8000-000000000008"}','[]');
 v_id:=(r->>'id')::uuid;
 IF (SELECT business_match_id FROM public.staff_email_reviews WHERE id=v_id) IS DISTINCT FROM '24700000-0000-4000-8000-000000000009'::uuid
 THEN RAISE EXCEPTION 'new_staff_notice_parent_missing'; END IF;
 UPDATE public.staff_email_reviews SET provider_message_id='parent-owned-provider' WHERE id=v_id;
 PERFORM public.email_provider_record_event('parent-owned-fact','parent-owned-provider','email.delivered',now(),'primary',NULL);
 DELETE FROM public.opportunity_matches WHERE id='24700000-0000-4000-8000-000000000009';
 IF EXISTS(SELECT 1 FROM public.staff_email_reviews WHERE id=v_id) OR EXISTS(SELECT 1 FROM public.email_provider_events WHERE provider_message_id='parent-owned-provider')
 THEN RAISE EXCEPTION 'new_staff_notice_retention_extended'; END IF;
END $$;
DO $$ DECLARE a jsonb; BEGIN
 a:=public.email_operations_analytics('2000-01-01','2000-02-01');
 IF (a->>'totalSent')::integer<>0 OR (a->>'coveredDelivered')::integer<>0 OR a->'daily'<>'[]'::jsonb THEN RAISE EXCEPTION 'empty_cohort_invented'; END IF;
END $$;

-- All four source ledgers participate in the same source-backed projection.
-- A shared M&A/E4/generic receipt stays one message with the actual M&A body;
-- an E6-only historical receipt retains its actual recipient and missing body.
INSERT INTO public.ma_interactions(id,opportunity_id,template_key,recipient_email_snapshot,title,body_markdown,
 channel,direction,delivery_status,provider_message_id,sent_at)
 VALUES('24700000-0000-4000-8000-000000000021','22300000-0000-4000-8000-000000000001',
 'ma_process_follow_up','contact@example.test','Historical M&A source','Actual retained intermediary words',
 'email','outbound','sent','mixed-ledger-247',NULL);
INSERT INTO public.email_logs(repreneur_id,template_key,resend_id,to_email,subject,status,sent_at)
 VALUES('22300000-0000-4000-8000-000000000003','ma_process_follow_up','mixed-ledger-247','contact@example.test','Duplicate source log','sent',NULL);
INSERT INTO public.opportunity_pursuit_handoff_deliveries(upstream_evidence_id,match_id,handoff_type,delivery_status,
 provider_message_id,ma_interaction_id,sent_at) VALUES
 ('22300000-0000-4000-8000-000000000005','22300000-0000-4000-8000-000000000004','e4','sent',
 'mixed-ledger-247','24700000-0000-4000-8000-000000000021',NULL),
 ('22300000-0000-4000-8000-000000000005','22300000-0000-4000-8000-000000000004','e6','sent','e6-history-247',NULL,NULL);
SELECT public.email_provider_record_event('mixed-ledger-delivery','mixed-ledger-247','email.delivered',now(),'primary',NULL,'contact@example.test');
DO $$ BEGIN
 IF (SELECT count(*) FROM public.email_operations_history WHERE provider_message_id='mixed-ledger-247')<>1
 OR NOT EXISTS(SELECT 1 FROM public.email_operations_history WHERE provider_message_id='mixed-ledger-247'
 AND id='ma:24700000-0000-4000-8000-000000000021' AND body_text='Actual retained intermediary words'
 AND recipient_email='contact@example.test' AND delivered AND sent_at IS NULL)
 THEN RAISE EXCEPTION 'mixed_sources_dedup_body_or_date'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.email_operations_history WHERE provider_message_id='e6-history-247'
 AND recipient_email='rep@example.test' AND body_text IS NULL AND sent_at IS NULL)
 THEN RAISE EXCEPTION 'historical_handoff_invented_evidence'; END IF;
 IF (SELECT count(*) FROM public.email_operations_history WHERE id LIKE 'review:%')=0
 OR (SELECT count(*) FROM public.email_operations_history WHERE id LIKE 'log:%')<151
 THEN RAISE EXCEPTION 'missing_source_coverage'; END IF;
 DELETE FROM public.ma_interactions WHERE id='24700000-0000-4000-8000-000000000021';
 IF NOT EXISTS(SELECT 1 FROM public.email_provider_events WHERE id='mixed-ledger-delivery') THEN RAISE EXCEPTION 'retained_parent_fact_purged'; END IF;
 DELETE FROM public.email_logs WHERE resend_id='mixed-ledger-247';
 DELETE FROM public.opportunity_pursuit_handoff_deliveries WHERE provider_message_id='mixed-ledger-247';
 IF EXISTS(SELECT 1 FROM public.email_provider_events WHERE id='mixed-ledger-delivery') THEN RAISE EXCEPTION 'last_parent_fact_not_deleted'; END IF;
END $$;
