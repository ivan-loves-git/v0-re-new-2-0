CREATE TABLE public.synthetic_255_context AS SELECT public.journey_external_memo_context('76000000-0000-4000-8000-000000000011','25500000-0000-4000-8000-000000000001',now()+interval '30 days') AS context;
CREATE FUNCTION public.synthetic_255_record(p_key uuid DEFAULT '25500000-0000-4000-8000-000000000002',p_time time DEFAULT NULL) RETURNS uuid LANGUAGE sql AS $$
 SELECT public.journey_approve_memo_external_notice('76000000-0000-4000-8000-000000000011',(SELECT context FROM public.synthetic_255_context),repeat('a',64),p_key,current_date-1,p_time,'email','Synthetic completed memo notice','w173-staff','w173-staff@example.test')
$$;
-- Schema before app: the actual OLD public approval and six-field claimant work
-- without a global EmailOps pause or the new versioned application function.
SELECT public.journey_grant_confidential_access('76000000-0000-4000-8000-000000000011','25500000-0000-4000-8000-000000000001','w173-staff','255-schema-old-code',(SELECT (context->>'nda_expires_at')::timestamptz FROM public.synthetic_255_context));
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.claim_opportunity_memo_notification('76000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000011',now())) THEN RAISE EXCEPTION 'ordinary_schema_before_app_claim_lost'; END IF;
 BEGIN PERFORM public.synthetic_255_record(); RAISE EXCEPTION 'legacy_inflight_promoted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'external_memo_reconciliation_required' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM public.opportunity_memo_grant_snapshots) THEN RAISE EXCEPTION 'legacy_grant_mapping_fabricated'; END IF;
END $$;
-- A genuine old claimant acceptance updates only its unversioned historical fact.
SELECT public.complete_opportunity_memo_notification('76000000-0000-4000-8000-000000000011',now(),'synthetic-legacy-accepted');
CREATE TABLE public.synthetic_255_pending_review AS SELECT public.email_business_prepare('synthetic-255-legacy-review','opportunity_memo_available','76000000-0000-4000-8000-000000000004',(SELECT email FROM public.repreneurs WHERE id='76000000-0000-4000-8000-000000000004'),'Synthetic memo available','Synthetic body','<p>Synthetic body</p>',jsonb_build_object('kind','memo_available','opportunityId','76000000-0000-4000-8000-000000000003','matchId','76000000-0000-4000-8000-000000000011'),'[]') AS review;
SELECT public.journey_revoke_confidential_access('76000000-0000-4000-8000-000000000011','w173-staff','replacement','255-legacy-revoke');
-- Authentic staff, civil precision, expiry and exact owner/document context all
-- deny before the four effects, never accepting external email as a file.
DO $$ DECLARE context jsonb:=(SELECT context FROM public.synthetic_255_context); events bigint; BEGIN
 SELECT count(*) INTO events FROM public.opportunity_pursuit_evidence;
 BEGIN PERFORM public.journey_approve_memo_external_notice('76000000-0000-4000-8000-000000000011',context,repeat('a',64),gen_random_uuid(),current_date-1,NULL,'email','Synthetic wrong actor','w173-staff','other@example.test'); RAISE EXCEPTION 'wrong_staff_allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'external_memo_staff_denied' THEN RAISE; END IF; END;
 BEGIN PERFORM public.journey_approve_memo_external_notice('76000000-0000-4000-8000-000000000011',context,repeat('a',64),gen_random_uuid(),current_date+1,NULL,'email','Synthetic future date','w173-staff','w173-staff@example.test'); RAISE EXCEPTION 'future_date_allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'external_handoff_metadata_invalid' THEN RAISE; END IF; END;
 BEGIN PERFORM public.journey_approve_memo_external_notice('76000000-0000-4000-8000-000000000011',context,repeat('a',64),gen_random_uuid(),current_date-1,'12:00:01','email','Synthetic seconds precision','w173-staff','w173-staff@example.test'); RAISE EXCEPTION 'false_time_precision_allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'external_handoff_metadata_invalid' THEN RAISE; END IF; END;
 BEGIN PERFORM public.journey_approve_memo_external_notice('76000000-0000-4000-8000-000000000011',context||'{"is_demo":true}',repeat('a',64),gen_random_uuid(),current_date-1,NULL,'email','Synthetic wrong namespace','w173-staff','w173-staff@example.test'); RAISE EXCEPTION 'wrong_context_allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'external_memo_context_changed' THEN RAISE; END IF; END;
 BEGIN PERFORM public.journey_approve_memo_external_notice('76000000-0000-4000-8000-000000000011',context||jsonb_build_object('repreneur_id','76000000-0000-4000-8000-000000000007'),repeat('a',64),gen_random_uuid(),current_date-1,NULL,'email','Synthetic wrong owner','w173-staff','w173-staff@example.test'); RAISE EXCEPTION 'wrong_owner_allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'external_memo_context_changed' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM public.opportunity_pursuit_evidence)<>events OR EXISTS(SELECT 1 FROM public.opportunity_memo_grant_snapshots) THEN RAISE EXCEPTION 'invalid_external_request_wrote'; END IF;
END $$;
-- Mid-transaction fault after the platform approval/grant/E8 must roll ALL back.
CREATE FUNCTION public.synthetic_255_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic_atomic_failure'; END $$;
CREATE TRIGGER synthetic_notice_fault BEFORE INSERT ON public.opportunity_memo_external_notices FOR EACH ROW EXECUTE FUNCTION public.synthetic_255_fault();
DO $$ DECLARE before_events bigint; before_grant jsonb; BEGIN
 SELECT count(*) INTO before_events FROM public.opportunity_pursuit_evidence;
 SELECT to_jsonb(g) INTO before_grant FROM public.opportunity_pursuit_confidential_grants g;
 BEGIN PERFORM public.synthetic_255_record(); RAISE EXCEPTION 'fault_not_injected'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'synthetic_atomic_failure' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM public.opportunity_pursuit_evidence)<>before_events OR (SELECT to_jsonb(g) FROM public.opportunity_pursuit_confidential_grants g) IS DISTINCT FROM before_grant
 OR EXISTS(SELECT 1 FROM public.opportunity_memo_grant_snapshots) OR EXISTS(SELECT 1 FROM public.opportunity_memo_grant_notices) OR EXISTS(SELECT 1 FROM public.opportunity_memo_external_notices)
 THEN RAISE EXCEPTION 'atomic_fault_left_partial_completion'; END IF;
END $$;
DROP TRIGGER synthetic_notice_fault ON public.opportunity_memo_external_notices;
SELECT public.synthetic_255_record();
DO $$ DECLARE grant_a uuid; events bigint; BEGIN
 SELECT grant_evidence_id INTO grant_a FROM public.opportunity_memo_external_notices;
 SELECT count(*) INTO events FROM public.opportunity_pursuit_evidence;
 IF public.synthetic_255_record()<>grant_a OR (SELECT count(*) FROM public.opportunity_pursuit_evidence)<>events
 OR (SELECT count(*) FROM public.opportunity_pursuit_evidence WHERE event_type='e8_memo_enabled_completed' AND metadata->>'grant_evidence_id'=grant_a::text)<>1
 OR NOT public.journey_memo_grant_is_current(grant_a) OR (SELECT state FROM public.opportunity_memo_grant_notices WHERE grant_evidence_id=grant_a)<>'external'
 OR EXISTS(SELECT 1 FROM public.claim_opportunity_memo_grant_notice('76000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000011',grant_a,now()))
 OR EXISTS(SELECT 1 FROM public.claim_opportunity_memo_notification('76000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000011',now()))
 THEN RAISE EXCEPTION 'exact_external_A_not_once_or_suppressed'; END IF;
 BEGIN PERFORM public.synthetic_255_record('25500000-0000-4000-8000-000000000003'); RAISE EXCEPTION 'duplicate_external_notice_accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'external_memo_already_completed_or_uncertain' THEN RAISE; END IF; END;
 BEGIN PERFORM public.assert_memo_notice_source(jsonb_build_object('kind','memo_available','opportunityId','76000000-0000-4000-8000-000000000003','matchId','76000000-0000-4000-8000-000000000011','grantEvidenceId',grant_a)); RAISE EXCEPTION 'external_source_authorized'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'memo_notice_source_stale' THEN RAISE; END IF; END;
 IF has_table_privilege('service_role','public.opportunity_memo_external_notices','INSERT') OR has_table_privilege('authenticated','public.opportunity_memo_grant_snapshots','SELECT') OR has_function_privilege('anon','public.journey_approve_memo_external_notice(uuid,jsonb,text,uuid,date,time,text,text,text,text,uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'memo_notice_private_boundary_failed'; END IF;
END $$;
-- Actual individual reservation order denies the old queued legacy source before
-- policy, review/event/attempt/source changes. Automatic preparation also denies A.
DO $$ DECLARE before_review jsonb; before_events bigint; before_reviews bigint; review_id uuid:=(SELECT (review->>'id')::uuid FROM public.synthetic_255_pending_review); BEGIN
 SELECT to_jsonb(r) INTO before_review FROM public.staff_email_reviews r WHERE id=review_id;
 SELECT count(*) INTO before_events FROM public.staff_email_review_events;
 SELECT count(*) INTO before_reviews FROM public.staff_email_reviews;
 BEGIN PERFORM public.email_business_prepare('synthetic-255-external-A','opportunity_memo_available','76000000-0000-4000-8000-000000000004',(SELECT email FROM public.repreneurs WHERE id='76000000-0000-4000-8000-000000000004'),'Synthetic A memo','Synthetic A body','<p>Synthetic A</p>',jsonb_build_object('kind','memo_available','opportunityId','76000000-0000-4000-8000-000000000003','matchId','76000000-0000-4000-8000-000000000011','grantEvidenceId',(SELECT grant_evidence_id FROM public.opportunity_memo_external_notices)),'[]'); RAISE EXCEPTION 'external_A_prepared'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'memo_notice_source_stale' THEN RAISE; END IF; END;
 BEGIN PERFORM public.email_business_reserve_manual(review_id,(before_review->>'version')::integer,'w173-staff'); RAISE EXCEPTION 'external_legacy_review_reserved'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'memo_notice_source_stale' THEN RAISE; END IF; END;
 BEGIN PERFORM public.email_business_authorize_attempt(review_id,gen_random_uuid()); RAISE EXCEPTION 'external_legacy_attempt_authorized'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'memo_notice_source_stale' THEN RAISE; END IF; END;
 IF (SELECT to_jsonb(r) FROM public.staff_email_reviews r WHERE id=review_id) IS DISTINCT FROM before_review OR (SELECT count(*) FROM public.staff_email_review_events)<>before_events OR (SELECT count(*) FROM public.staff_email_reviews)<>before_reviews THEN RAISE EXCEPTION 'external_memo_reservation_denial_wrote'; END IF;
END $$;
-- Recording disable/retained schema old-code readers still deny A and keep access.
UPDATE public.pursuit_external_handoff_settings SET enabled=false;
DO $$ BEGIN
 IF NOT public.journey_memo_grant_is_current((SELECT grant_evidence_id FROM public.opportunity_memo_external_notices)) THEN RAISE EXCEPTION 'disable_lost_exact_access'; END IF;
 BEGIN PERFORM public.synthetic_255_record(); RAISE EXCEPTION 'disabled_recording_allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'external_handoff_recording_disabled' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM public.claim_opportunity_memo_notification('76000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000011',now())) THEN RAISE EXCEPTION 'old_code_revert_claimed_external'; END IF;
END $$;
UPDATE public.pursuit_external_handoff_settings SET enabled=true;
-- An old app's legitimate B has a new immutable identity/E8 after versioned A.
-- Its old claimant is scoped out; compatible code can process B independently.
SELECT public.journey_revoke_confidential_access('76000000-0000-4000-8000-000000000011','w173-staff','new disclosure','255-A-revoke');
CREATE TABLE public.synthetic_255_B AS SELECT public.journey_grant_confidential_access('76000000-0000-4000-8000-000000000011','25500000-0000-4000-8000-000000000001','w173-staff','255-B',(SELECT (context->>'nda_expires_at')::timestamptz+interval '1 day' FROM public.synthetic_255_context)) AS grant_id;
-- The public manual business order commits marking+reservation together.
-- A reservation fault AFTER marking must roll back prepared_policy and events.
DO $$ DECLARE review_id uuid; before_review jsonb; before_events bigint; definition text; reservation_token uuid; BEGIN
 review_id:=(public.email_business_prepare('synthetic-255-B-review','opportunity_memo_available','76000000-0000-4000-8000-000000000004',(SELECT email FROM public.repreneurs WHERE id='76000000-0000-4000-8000-000000000004'),'Synthetic B memo','Synthetic B body','<p>Synthetic B</p>',jsonb_build_object('kind','memo_available','opportunityId','76000000-0000-4000-8000-000000000003','matchId','76000000-0000-4000-8000-000000000011','grantEvidenceId',(SELECT grant_id FROM public.synthetic_255_B)),'[]')->>'id')::uuid;
 UPDATE public.staff_email_reviews SET prepared_policy=prepared_policy||jsonb_build_object('auto_claimed_at',clock_timestamp()) WHERE id=review_id;
 SELECT to_jsonb(r) INTO before_review FROM public.staff_email_reviews r WHERE id=review_id;
 SELECT count(*) INTO before_events FROM public.staff_email_review_events;
 definition:=pg_get_functiondef('public.email_review_mark_manual(uuid,integer,text)'::regprocedure);
 EXECUTE $fault$CREATE OR REPLACE FUNCTION public.email_review_mark_manual(p_review_id uuid,p_version integer,p_actor text) RETURNS void LANGUAGE plpgsql AS $body$ BEGIN RAISE EXCEPTION 'synthetic_mark_failure'; END $body$;$fault$;
 BEGIN PERFORM public.email_business_reserve_manual(review_id,(before_review->>'version')::integer,'w173-staff'); RAISE EXCEPTION 'manual_mark_fault_not_seen'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'synthetic_mark_failure' THEN RAISE; END IF; END;
 IF (SELECT to_jsonb(r) FROM public.staff_email_reviews r WHERE id=review_id) IS DISTINCT FROM before_review OR (SELECT count(*) FROM public.staff_email_review_events)<>before_events THEN RAISE EXCEPTION 'manual_mark_fault_partial_write'; END IF;
 EXECUTE definition;
 definition:=pg_get_functiondef('public.email_business_reserve(uuid,integer,text)'::regprocedure);
 EXECUTE $fault$CREATE OR REPLACE FUNCTION public.email_business_reserve(p_review_id uuid,p_version integer,p_actor text) RETURNS uuid LANGUAGE plpgsql AS $body$ BEGIN RAISE EXCEPTION 'synthetic_reservation_failure'; END $body$;$fault$;
 BEGIN PERFORM public.email_business_reserve_manual(review_id,(before_review->>'version')::integer,'w173-staff'); RAISE EXCEPTION 'reservation_fault_not_seen'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'synthetic_reservation_failure' THEN RAISE; END IF; END;
 IF (SELECT to_jsonb(r) FROM public.staff_email_reviews r WHERE id=review_id) IS DISTINCT FROM before_review OR (SELECT count(*) FROM public.staff_email_review_events)<>before_events THEN RAISE EXCEPTION 'manual_business_fault_partial_write'; END IF;
 EXECUTE definition;
 reservation_token:=public.email_business_reserve_manual(review_id,(before_review->>'version')::integer,'w173-staff');
 IF reservation_token IS NULL OR NOT EXISTS(SELECT 1 FROM public.staff_email_reviews WHERE id=review_id AND state='sending' AND NOT prepared_policy ? 'auto_claimed_at') THEN RAISE EXCEPTION 'successful_manual_business_policy_lost'; END IF;
END $$;
CREATE TABLE public.synthetic_255_B_claim AS SELECT * FROM public.claim_opportunity_memo_grant_notice('76000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000011',(SELECT grant_id FROM public.synthetic_255_B),now());
DO $$ DECLARE grant_b uuid:=(SELECT grant_id FROM public.synthetic_255_B); BEGIN
 IF (SELECT count(*) FROM public.synthetic_255_B_claim)<>1 OR NOT public.journey_memo_grant_is_current(grant_b)
 OR (SELECT count(*) FROM public.opportunity_pursuit_evidence WHERE event_type='e8_memo_enabled_completed' AND metadata->>'grant_evidence_id'=grant_b::text)<>1
 OR EXISTS(SELECT 1 FROM public.claim_opportunity_memo_notification('76000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000011',now())) THEN RAISE EXCEPTION 'future_B_not_independent'; END IF;
 BEGIN PERFORM public.synthetic_255_record(); RAISE EXCEPTION 'stale_A_retry_allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'external_memo_retry_conflict' THEN RAISE; END IF; END;
END $$;
SELECT public.complete_opportunity_memo_notification('76000000-0000-4000-8000-000000000011',now(),'synthetic-old-delayed-callback');
DO $$ BEGIN
 IF (SELECT state FROM public.opportunity_memo_grant_notices WHERE grant_evidence_id=(SELECT grant_id FROM public.synthetic_255_B))<>'sending'
 OR (SELECT provider_id FROM public.opportunity_memo_notifications)<>'synthetic-legacy-accepted' THEN RAISE EXCEPTION 'legacy_callback_consumed_future_B'; END IF;
END $$;
SELECT public.finish_opportunity_memo_grant_notice(grant_evidence_id,attempt_token,'uncertain',NULL,now(),'Synthetic interrupted provider request') FROM public.synthetic_255_B_claim;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.claim_opportunity_memo_grant_notice('76000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000011',(SELECT grant_id FROM public.synthetic_255_B),now()+interval '1 day')) THEN RAISE EXCEPTION 'uncertainty_blind_retry_allowed'; END IF;
END $$;
-- Pause, owner/mode and changed retained document are all stale access/notice gates.
BEGIN;
SELECT public.pause_opportunity_with_reason('76000000-0000-4000-8000-000000000003','seller_paused_sale','w173-staff',NULL);
DO $$ BEGIN IF public.journey_memo_grant_is_current((SELECT grant_id FROM public.synthetic_255_B)) THEN RAISE EXCEPTION 'paused_memo_access_allowed'; END IF; END $$;
SET CONSTRAINTS ALL IMMEDIATE;
ROLLBACK;
BEGIN;
SELECT public.journey_transition_terminal('76000000-0000-4000-8000-000000000011','drop','w173-staff@example.test','255-access-drop','buyer_search_paused');
DO $$ BEGIN IF public.journey_memo_grant_is_current((SELECT grant_id FROM public.synthetic_255_B)) THEN RAISE EXCEPTION 'dropped_memo_access_allowed'; END IF; END $$;
SET CONSTRAINTS ALL IMMEDIATE;
ROLLBACK;
BEGIN;
UPDATE public.opportunity_pursuit_confidential_grants SET nda_expires_at=clock_timestamp()-interval '1 second' WHERE match_id='76000000-0000-4000-8000-000000000011';
DO $$ BEGIN IF public.journey_memo_grant_is_current((SELECT grant_id FROM public.synthetic_255_B)) THEN RAISE EXCEPTION 'expired_memo_access_allowed'; END IF; END $$;
SET CONSTRAINTS ALL IMMEDIATE;
ROLLBACK;
BEGIN;
SET LOCAL session_replication_role=replica;
UPDATE public.opportunities SET is_demo=true WHERE id='76000000-0000-4000-8000-000000000003';
DO $$ BEGIN IF public.journey_memo_grant_is_current((SELECT grant_id FROM public.synthetic_255_B)) THEN RAISE EXCEPTION 'mode_changed_access_allowed'; END IF; END $$;
SET CONSTRAINTS ALL IMMEDIATE;
ROLLBACK;
SELECT 'PASS: actual schema-before-app ordinary claim; atomic approval+grant+E8+external notice, immutable exact retry, A suppression, B identity, stale legacy callbacks, uncertainty and retained-schema disable.';

BEGIN;
UPDATE public.opportunity_documents SET storage_path='76000000-0000-4000-8000-000000000003/replaced-memo.pdf' WHERE id='25500000-0000-4000-8000-000000000001';
DO $$ BEGIN IF public.journey_repreneur_can_access_confidential('76000000-0000-4000-8000-000000000011','76000000-0000-4000-8000-000000000004','25500000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'replacement_under_old_grant_accessible'; END IF; END $$;
SET CONSTRAINTS ALL IMMEDIATE;
ROLLBACK;
-- Leave a pending fresh disclosure for the independent-session delivery races.
SELECT public.journey_revoke_confidential_access('76000000-0000-4000-8000-000000000011','w173-staff','race setup','255-B-revoke');
UPDATE public.synthetic_255_context SET context=public.journey_external_memo_context('76000000-0000-4000-8000-000000000011','25500000-0000-4000-8000-000000000001',now()+interval '40 days');
SELECT public.journey_grant_confidential_access_v2('76000000-0000-4000-8000-000000000011','25500000-0000-4000-8000-000000000001','w173-staff','255-race-C',(SELECT (context->>'nda_expires_at')::timestamptz FROM public.synthetic_255_context));
-- A later actual provider correlation settles B's own uncertainty only, even
-- after C exists. The original unknown result remains retained in the attempt.
SELECT public.finish_opportunity_memo_grant_notice(grant_evidence_id,attempt_token,'sent','synthetic-B-correlated-acceptance',now(),NULL) FROM public.synthetic_255_B_claim;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.opportunity_memo_grant_attempts WHERE grant_evidence_id=(SELECT grant_id FROM public.synthetic_255_B) AND outcome='uncertain' AND reconciled_outcome='sent' AND reconciled_provider_id='synthetic-B-correlated-acceptance')
 OR NOT EXISTS(SELECT 1 FROM public.opportunity_memo_grant_notices WHERE grant_evidence_id=(SELECT grant_evidence_id FROM public.opportunity_pursuit_confidential_grants WHERE match_id='76000000-0000-4000-8000-000000000011') AND state='pending' AND provider_id IS NULL)
 THEN RAISE EXCEPTION 'old_uncertainty_correlation_consumed_C'; END IF;
END $$;
