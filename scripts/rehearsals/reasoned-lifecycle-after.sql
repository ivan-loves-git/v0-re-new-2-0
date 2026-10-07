-- Ticket #252: real public services against disposable synthetic records.
CREATE FUNCTION public.fixture_assert_rejected(command TEXT, expected TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE command;
    RAISE EXCEPTION 'fixture_expected_rejection_but_write_succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF POSITION(expected IN SQLERRM)=0 THEN RAISE; END IF;
  END;
END $$;

CREATE FUNCTION public.fixture_active_opportunity(target UUID, reference TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.opportunities(id,reference,status,source_office_id,description,created_by)
  VALUES(target,reference,'draft','25200000-0000-4000-8000-000000000031','Synthetic lifecycle proof','fixture');
  INSERT INTO public.opportunity_ma_contacts(opportunity_id,affiliation_id,is_primary,is_active,linked_by)
  VALUES(target,'25200000-0000-4000-8000-000000000041',TRUE,TRUE,'fixture');
  UPDATE public.opportunities SET status='active' WHERE id=target;
END $$;

DO $$
DECLARE original_id UUID; replay UUID; result JSONB;
BEGIN
  result:=public.opportunity_stale_closure_eligibility('25200000-0000-4000-8000-000000000012');
  IF (result->>'eligible')::boolean OR (result->>'completedDays')::integer<>0
    OR result->>'basis'<>'policy_activation'
    OR (result->>'startedAt')::timestamptz IS DISTINCT FROM (SELECT effective_at FROM public.opportunity_stale_policy) THEN
    RAISE EXCEPTION 'legacy_age_was_inferred_from_source_date';
  END IF;
  SELECT id INTO original_id FROM public.opportunity_pursuit_evidence WHERE idempotency_key='new-drop';
  replay:=public.journey_transition_terminal('25200000-0000-4000-8000-000000000020','drop','staff@re-new.invalid','new-drop','seller_price_expectations_too_high',ARRAY['financing_not_secured'],'Financing was declined.');
  IF replay<>original_id OR (SELECT count(*) FROM public.opportunity_pursuit_evidence WHERE idempotency_key='new-drop')<>1 THEN RAISE EXCEPTION 'drop_retry_duplicated'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_confidential_grants WHERE id='25200000-0000-4000-8000-000000000052' AND revoked_at IS NOT NULL AND revoked_by='staff@re-new.invalid') THEN RAISE EXCEPTION 'drop_grant_not_revoked'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.recipient_im_cleanup WHERE document_id='25200000-0000-4000-8000-000000000050' AND drop_reason='seller_price_expectations_too_high' AND status='pending')
    OR EXISTS(SELECT 1 FROM public.recipient_im_cleanup WHERE document_id='25200000-0000-4000-8000-000000000051') THEN RAISE EXCEPTION 'recipient_cleanup_not_scoped'; END IF;
  IF EXISTS(SELECT 1 FROM public.fixture_original_history original JOIN public.opportunity_pursuit_evidence e USING(id) WHERE original.row IS DISTINCT FROM to_jsonb(e))
    OR EXISTS(SELECT 1 FROM public.fixture_original_closure original JOIN public.opportunity_closure_history e USING(id) WHERE original.row IS DISTINCT FROM to_jsonb(e)) THEN RAISE EXCEPTION 'historical_row_changed'; END IF;
END $$;

SELECT public.fixture_assert_rejected($q$SELECT public.journey_transition_terminal('25200000-0000-4000-8000-000000000020','drop','staff@re-new.invalid','new-drop','financing_not_secured',ARRAY[]::text[],NULL)$q$,'outcome_replay_payload_changed');
SELECT public.fixture_assert_rejected($q$SELECT public.journey_transition_terminal('25200000-0000-4000-8000-000000000020','drop','staff@re-new.invalid','retired','no_viable_match')$q$,'pursuit_drop_reason_invalid');
SELECT public.fixture_assert_rejected($q$SELECT public.journey_transition_terminal('25200000-0000-4000-8000-000000000020','drop','staff@re-new.invalid','retired-dd','dd_disqualified_repreneur')$q$,'pursuit_drop_reason_invalid');
SELECT public.fixture_assert_rejected($q$SELECT public.journey_transition_terminal('25200000-0000-4000-8000-000000000020','drop','buyer@re-new.invalid','wrong-actor','other',ARRAY[]::text[],'Context')$q$,'staff_outcome_actor_required');
SELECT public.fixture_assert_rejected($q$SELECT public.journey_transition_terminal('25200000-0000-4000-8000-000000000020','drop','staff@re-new.invalid','invalid-other','other',ARRAY[]::text[],' ')$q$,'pursuit_drop_other_explanation_required');
SELECT public.fixture_assert_rejected($q$SELECT public.journey_transition_terminal('25200000-0000-4000-8000-000000000020','drop','staff@re-new.invalid','invalid-whitespace-other','other',ARRAY[]::text[],chr(9)||chr(10)||chr(160)||chr(65279))$q$,'pursuit_drop_other_explanation_required');
SELECT public.fixture_assert_rejected($q$SELECT public.journey_transition_terminal('25200000-0000-4000-8000-000000000020','drop','staff@re-new.invalid','invalid-secondary-other','financing_not_secured',ARRAY['other'],NULL)$q$,'pursuit_drop_other_explanation_required');
SELECT public.fixture_assert_rejected($q$SELECT public.journey_transition_terminal('25200000-0000-4000-8000-000000000020','drop','staff@re-new.invalid','invalid-exclusive','reason_not_disclosed',ARRAY['financing_not_secured'],NULL)$q$,'pursuit_drop_reason_not_disclosed_exclusive');
SELECT public.fixture_assert_rejected($q$SELECT public.journey_transition_terminal('25200000-0000-4000-8000-000000000020','drop','staff@re-new.invalid','invalid-exclusive-secondary','financing_not_secured',ARRAY['reason_not_disclosed'],NULL)$q$,'pursuit_drop_reason_not_disclosed_exclusive');
SELECT public.fixture_assert_rejected($q$SELECT public.journey_transition_terminal('25200000-0000-4000-8000-000000000020','drop','staff@re-new.invalid','invalid-duplicate','customer_concentration',ARRAY['other','other'],'Context')$q$,'pursuit_drop_secondary_reasons_invalid');
SELECT public.fixture_assert_rejected($q$SELECT public.journey_transition_terminal('25200000-0000-4000-8000-000000000020','drop','staff@re-new.invalid','invalid-same','financing_not_secured',ARRAY['financing_not_secured'],NULL)$q$,'pursuit_drop_secondary_reasons_invalid');
SELECT public.fixture_assert_rejected($q$SELECT public.journey_transition_terminal('25200000-0000-4000-8000-000000000020','drop','staff@re-new.invalid','invalid-unknown','financing_not_secured',ARRAY['unknown'],NULL)$q$,'pursuit_drop_secondary_reasons_invalid');
SELECT public.fixture_assert_rejected($q$UPDATE public.opportunity_pursuit_evidence SET actor='changed' WHERE idempotency_key='new-drop'$q$,'Canonical pursuit evidence is append-only.');
SELECT public.fixture_assert_rejected($q$DELETE FROM public.opportunity_closure_history WHERE id='25200000-0000-4000-8000-000000000060'$q$,'opportunity_closure_history_is_immutable');
SELECT public.fixture_assert_rejected($q$UPDATE public.opportunity_pause_history SET reason_note='changed'$q$,'opportunity_pause_history_is_immutable');
SELECT public.fixture_assert_rejected($q$UPDATE public.opportunity_stale_policy SET effective_at='2000-01-01'$q$,'opportunity_stale_policy_is_immutable');
SELECT public.fixture_assert_rejected($q$UPDATE public.opportunities SET stale_clock_started_at='2000-01-01' WHERE id='25200000-0000-4000-8000-000000000010'$q$,'opportunity_stale_clock_has_no_manual_refresh');
SELECT public.fixture_assert_rejected($q$UPDATE public.opportunities SET status='closed' WHERE id='25200000-0000-4000-8000-000000000010'$q$,'opportunity_close_requires_reasoned_transition');
SELECT public.fixture_assert_rejected($q$INSERT INTO public.opportunities(reference,status,source_office_id) VALUES('SYNTHETIC-DIRECT-CLOSE','closed','25200000-0000-4000-8000-000000000031')$q$,'opportunity_close_requires_reasoned_transition');
SELECT public.fixture_assert_rejected($q$INSERT INTO public.opportunity_closure_history(opportunity_id,reason,closed_by) VALUES('25200000-0000-4000-8000-000000000010','stale','staff-252')$q$,'closure_evidence_requires_reasoned_transition');
SELECT public.fixture_assert_rejected($q$SELECT public.journey_append_evidence('25200000-0000-4000-8000-000000000020','dropped','staff@re-new.invalid','direct-evidence',NULL,NULL,'other','{"secondary_reasons":[],"reason_note":"Context"}')$q$,'drop_evidence_requires_reasoned_transition');
SELECT public.journey_transition_terminal('25200000-0000-4000-8000-000000000020','reopen','staff@re-new.invalid','fixture-reopen');
SELECT public.fixture_assert_rejected($q$UPDATE public.opportunity_matches SET status='dropped' WHERE id='25200000-0000-4000-8000-000000000020'$q$,'pursuit_drop_requires_reasoned_transition');

-- Email-only legacy staff resolves through the actual Better Auth account ID.
UPDATE public.app_user_roles SET user_id=NULL WHERE email='staff@re-new.invalid';
DO $$
DECLARE reason TEXT; pause_id UUID; before_start TIMESTAMPTZ;
BEGIN
  FOREACH reason IN ARRAY ARRAY['paused_cabinet','seller_paused_sale','exclusivity_another_buyer','waiting_updated_information','other'] LOOP
    SELECT stale_clock_started_at INTO before_start FROM public.opportunities WHERE id='25200000-0000-4000-8000-000000000010';
    pause_id:=public.pause_opportunity_with_reason('25200000-0000-4000-8000-000000000010',reason,'staff-252','Whole sale suspended.');
    IF NOT EXISTS(SELECT 1 FROM public.opportunity_pause_history WHERE id=pause_id AND paused_by='staff-252' AND reason_note='Whole sale suspended.') THEN RAISE EXCEPTION 'pause_note_or_actor_lost'; END IF;
    IF (SELECT stale_clock_started_at FROM public.opportunities WHERE id='25200000-0000-4000-8000-000000000010') IS NOT NULL THEN RAISE EXCEPTION 'pause_did_not_interrupt'; END IF;
    UPDATE public.opportunities SET status='active' WHERE id='25200000-0000-4000-8000-000000000010';
    IF (SELECT stale_clock_started_at FROM public.opportunities WHERE id='25200000-0000-4000-8000-000000000010')<=before_start THEN RAISE EXCEPTION 'active_return_did_not_restart'; END IF;
  END LOOP;
END $$;
SELECT public.fixture_assert_rejected($q$SELECT public.pause_opportunity_with_reason('25200000-0000-4000-8000-000000000010','other','staff-252')$q$,'opportunity_pause_other_explanation_required');
SELECT public.fixture_assert_rejected($q$SELECT public.pause_opportunity_with_reason('25200000-0000-4000-8000-000000000010','other','staff-252',chr(9)||chr(10)||chr(160))$q$,'opportunity_pause_other_explanation_required');
SELECT public.fixture_assert_rejected($q$SELECT public.close_opportunity_with_reason('25200000-0000-4000-8000-000000000010','paused_cabinet','staff-252')$q$,'opportunity_closure_reason_not_permanent');

-- Seed elapsed time only in this disposable superuser fixture. No public clock
-- override or artificial as-of parameter exists in the application service.
SET session_replication_role=replica;
UPDATE public.opportunities SET stale_clock_started_at=clock_timestamp()-interval '2160 hours'+interval '1 second',stale_clock_basis='became_active' WHERE id='25200000-0000-4000-8000-000000000010';
SET session_replication_role=origin;

SELECT public.fixture_active_opportunity('25200000-0000-4000-8000-000000000084','SYNTHETIC-PAUSE-DROP-RACE');
INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,created_by)
VALUES('25200000-0000-4000-8000-000000000086','25200000-0000-4000-8000-000000000084','25200000-0000-4000-8000-000000000002','active_pursuit','fixture');
SET session_replication_role=replica;
INSERT INTO public.opportunity_documents(id,opportunity_id,title,document_type,storage_path)
VALUES('25200000-0000-4000-8000-000000000087','25200000-0000-4000-8000-000000000084','Synthetic race IM','deal_book','synthetic/race-im.pdf');
INSERT INTO public.opportunity_pursuit_confidential_grants(id,match_id,opportunity_id,information_memo_document_id,source_firm_id,source_firm_name,source_office_id,source_office_name,granted_by)
VALUES('25200000-0000-4000-8000-000000000088','25200000-0000-4000-8000-000000000086','25200000-0000-4000-8000-000000000084','25200000-0000-4000-8000-000000000087','25200000-0000-4000-8000-000000000030','Synthetic firm','25200000-0000-4000-8000-000000000031','Synthetic office','fixture');
SET session_replication_role=origin;
-- Pause uses the inherited lifecycle trigger. Revocation must persist when
-- the sale returns to Active; merely hiding access during Pause is insufficient.
SELECT public.pause_opportunity_with_reason('25200000-0000-4000-8000-000000000084','seller_paused_sale','staff-252');
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_confidential_grants WHERE id='25200000-0000-4000-8000-000000000088' AND revoked_at IS NOT NULL AND revoked_reason='opportunity_paused')
   OR NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_evidence WHERE match_id='25200000-0000-4000-8000-000000000086' AND event_type='access_revoked' AND evidence_reference='opportunity status changed to paused') THEN RAISE EXCEPTION 'pause_grant_revocation_not_persisted'; END IF;
 UPDATE public.opportunities SET status='active' WHERE id='25200000-0000-4000-8000-000000000084';
 IF EXISTS(SELECT 1 FROM public.opportunity_pursuit_confidential_grants WHERE id='25200000-0000-4000-8000-000000000088' AND revoked_at IS NULL) THEN RAISE EXCEPTION 'active_return_restored_grant'; END IF;
END $$;
DO $$ BEGIN
 IF (public.opportunity_stale_closure_eligibility('25200000-0000-4000-8000-000000000010')->>'eligible')::boolean THEN RAISE EXCEPTION 'before_90_completed_days_allowed'; END IF;
 PERFORM public.fixture_assert_rejected($q$SELECT public.close_opportunity_with_reason('25200000-0000-4000-8000-000000000010','stale','staff-252')$q$,'opportunity_stale_not_eligible');
END $$;
SET session_replication_role=replica;
UPDATE public.opportunities SET stale_clock_started_at=clock_timestamp()-interval '2160 hours',stale_clock_basis='became_active' WHERE id='25200000-0000-4000-8000-000000000010';
SET session_replication_role=origin;
DO $$ DECLARE start_at TIMESTAMPTZ; BEGIN
 IF NOT (public.opportunity_stale_closure_eligibility('25200000-0000-4000-8000-000000000010')->>'eligible')::boolean THEN RAISE EXCEPTION 'at_90_completed_days_denied'; END IF;
 SELECT stale_clock_started_at INTO start_at FROM public.opportunities WHERE id='25200000-0000-4000-8000-000000000010';
 UPDATE public.opportunities SET description='Ordinary staff edit' WHERE id='25200000-0000-4000-8000-000000000010';
 IF (SELECT stale_clock_started_at FROM public.opportunities WHERE id='25200000-0000-4000-8000-000000000010')<>start_at
   OR (SELECT status FROM public.opportunities WHERE id='25200000-0000-4000-8000-000000000010')<>'active'
   OR EXISTS(SELECT 1 FROM public.opportunity_closure_history WHERE opportunity_id='25200000-0000-4000-8000-000000000010') THEN RAISE EXCEPTION 'clock_automatically_closed_or_reset'; END IF;
END $$;

-- A real confirmed-open source reply changes the source clock only.
SET session_replication_role=replica;
INSERT INTO public.staff_email_reviews(id,source_kind,source_operation_id,opportunity_id,contact_link_id,recipient_email,namespace,template_key,template_version,subject,body_text,state,created_by,created_at)
VALUES('25200000-0000-4000-8000-000000000070','freshness','25200000-0000-4000-8000-000000000071','25200000-0000-4000-8000-000000000010','25200000-0000-4000-8000-000000000042','advisor@re-new.invalid','REAL','ma_opportunity_validity_check','fixture','Synthetic validity check','Synthetic body','sent','staff-252',now()-interval '1 day');
INSERT INTO public.opportunity_freshness_members(review_id,opportunity_id,episode_key,contact_id,contact_link_id,affiliation_id,source_office_id,frozen_member)
VALUES('25200000-0000-4000-8000-000000000070','25200000-0000-4000-8000-000000000010','fixture-252','25200000-0000-4000-8000-000000000040','25200000-0000-4000-8000-000000000042','25200000-0000-4000-8000-000000000041','25200000-0000-4000-8000-000000000031','{}');
SET session_replication_role=origin;
DO $$ DECLARE start_at TIMESTAMPTZ; BEGIN
 SELECT stale_clock_started_at INTO start_at FROM public.opportunities WHERE id='25200000-0000-4000-8000-000000000010';
 PERFORM public.opportunity_freshness_record_reply('25200000-0000-4000-8000-000000000070','25200000-0000-4000-8000-000000000010','confirmed_open',now(),'Synthetic positive reply','staff-252');
 IF (SELECT stale_clock_started_at FROM public.opportunities WHERE id='25200000-0000-4000-8000-000000000010')<>start_at
   OR NOT EXISTS(SELECT 1 FROM public.opportunity_freshness_replies WHERE opportunity_id='25200000-0000-4000-8000-000000000010' AND outcome='confirmed_open') THEN RAISE EXCEPTION 'source_reply_reset_no_pursuit_clock'; END IF;
END $$;

-- Each published primary choice writes the same guarded shape. The final
-- pursuit end starts a new streak rather than restoring the old age.
DO $$ DECLARE reason TEXT; event_id UUID; BEGIN
 FOREACH reason IN ARRAY ARRAY[
  'customer_concentration','owner_family_dependency','no_management_team','lack_recurring_revenue','low_barriers_to_entry','declining_market','deteriorating_performance',
  'insufficient_profitability','unconvincing_ebitda_adjustments','below_buyer_size_criteria','seller_price_expectations_too_high','distressed_financial_position','financing_not_secured',
  'outside_investment_thesis','no_value_creation_angle','location_incompatible','carve_out_risk','assets_premises_not_secured','business_plan_not_credible','quality_hr_red_flags','issues_in_due_diligence','deal_terms_disagreement',
  'deprioritized_another_deal','buyer_search_paused','no_response_buyer','path_stopped_seller_advisor','buyer_rejected_seller','reason_not_disclosed','other'
 ] LOOP
  UPDATE public.opportunity_matches SET status='active_pursuit',pursuit_stage='interest' WHERE id='25200000-0000-4000-8000-000000000020';
  IF (SELECT stale_clock_started_at FROM public.opportunities WHERE id='25200000-0000-4000-8000-000000000010') IS NOT NULL THEN RAISE EXCEPTION 'pursuit_start_did_not_interrupt'; END IF;
  event_id:=public.journey_transition_terminal('25200000-0000-4000-8000-000000000020','drop','staff@re-new.invalid','catalogue-'||reason,reason,ARRAY[]::text[],'Synthetic context');
  IF NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_evidence WHERE id=event_id AND evidence_reference=reason AND actor='staff@re-new.invalid')
    OR (SELECT status FROM public.opportunities WHERE id='25200000-0000-4000-8000-000000000010')<>'active'
    OR (SELECT stale_clock_basis FROM public.opportunities WHERE id='25200000-0000-4000-8000-000000000010')<>'pursuit_ended'
    OR (public.opportunity_stale_closure_eligibility('25200000-0000-4000-8000-000000000010')->>'completedDays')::integer<>0 THEN RAISE EXCEPTION 'reasoned_drop_scope_or_new_streak_failed'; END IF;
 END LOOP;
END $$;

DO $$ DECLARE signature TEXT; role_name TEXT; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
  FOREACH signature IN ARRAY ARRAY['journey_transition_terminal(uuid,text,text,text,text,text[],text)','journey_transition_terminal(uuid,text,text,text,text)','pause_opportunity_with_reason(uuid,text,text,text)','pause_opportunity_with_reason(uuid,text,text)','close_opportunity_with_reason(uuid,opportunity_closure_reason,text)','opportunity_stale_closure_eligibility(uuid)'] LOOP
   IF has_function_privilege(role_name,'public.'||signature,'EXECUTE') THEN RAISE EXCEPTION 'non_service_role_outcome_execute_allowed'; END IF;
  END LOOP;
  IF has_table_privilege(role_name,'public.opportunity_stale_policy','SELECT') OR has_table_privilege(role_name,'public.opportunity_pause_history','SELECT') THEN RAISE EXCEPTION 'staff_policy_or_note_exposed'; END IF;
 END LOOP;
END $$;

-- A complete operation still records the existing signed-repreneur Close.
UPDATE public.opportunity_matches SET status='active_pursuit',pursuit_stage='interest' WHERE id='25200000-0000-4000-8000-000000000020';
SELECT public.journey_append_evidence('25200000-0000-4000-8000-000000000020','mutual_interest_validated','staff@re-new.invalid','fixture-current-cycle');
SELECT public.journey_append_evidence('25200000-0000-4000-8000-000000000020','continued','staff@re-new.invalid','fixture-continued');
SELECT public.journey_transition_terminal('25200000-0000-4000-8000-000000000020','complete','staff@re-new.invalid','fixture-complete','Signed outcome');
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.opportunity_closure_history WHERE opportunity_id='25200000-0000-4000-8000-000000000010' AND reason='signed_repreneur')
   OR (SELECT status FROM public.opportunity_matches WHERE id='25200000-0000-4000-8000-000000000020')<>'completed' THEN RAISE EXCEPTION 'complete_existing_outcome_regressed'; END IF;
 IF coalesce(current_setting('wave.opportunity_close_transition',TRUE),'')<>'' OR coalesce(current_setting('wave.pursuit_drop_transition',TRUE),'')<>'' THEN RAISE EXCEPTION 'outcome_guard_leaked'; END IF;
END $$;

SELECT public.fixture_active_opportunity('25200000-0000-4000-8000-000000000080','SYNTHETIC-RACE-A');
SELECT public.fixture_active_opportunity('25200000-0000-4000-8000-000000000081','SYNTHETIC-RACE-B');
SET session_replication_role=replica;
UPDATE public.opportunities SET stale_clock_started_at=clock_timestamp()-interval '2160 hours',stale_clock_basis='became_active' WHERE id IN ('25200000-0000-4000-8000-000000000080','25200000-0000-4000-8000-000000000081');
INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,created_by) VALUES
 ('25200000-0000-4000-8000-000000000082','25200000-0000-4000-8000-000000000080','25200000-0000-4000-8000-000000000002','interested','fixture'),
 ('25200000-0000-4000-8000-000000000083','25200000-0000-4000-8000-000000000081','25200000-0000-4000-8000-000000000002','interested','fixture');
SET session_replication_role=origin;
