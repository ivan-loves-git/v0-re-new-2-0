CREATE FUNCTION public.rehearsal_expect_error(p_sql TEXT, p_message TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_error TEXT;
BEGIN
  BEGIN
    EXECUTE p_sql;
    RAISE EXCEPTION 'rehearsal_unexpected_success: %', p_sql;
  EXCEPTION WHEN OTHERS THEN
    v_error := SQLERRM;
    IF v_error LIKE 'rehearsal_unexpected_success:%' OR POSITION(p_message IN v_error)=0 THEN
      RAISE EXCEPTION 'rehearsal_wrong_error: expected %, got %', p_message, v_error;
    END IF;
  END;
END;
$$;

DO $$ BEGIN
  IF NOT (SELECT prosecdef AND ARRAY_TO_STRING(proconfig, ',') LIKE 'search_path=%'
          FROM pg_proc WHERE oid='public.guard_ma_interaction_opportunity_source_office()'::REGPROCEDURE)
  THEN RAISE EXCEPTION 'migration_089_guard_security_regressed'; END IF;
END $$;

SELECT public.rehearsal_expect_error(
  $$UPDATE public.opportunities SET source_office_id='19100000-0000-4000-8000-000000000012'
    WHERE reference='SYN-191-A'$$,
  'ma_interaction_history_blocks_source_office_change');
SELECT SET_CONFIG('renew.exact_source_correction','true',FALSE);
SELECT public.rehearsal_expect_error(
  $$UPDATE public.opportunities SET source_office_id='19100000-0000-4000-8000-000000000012'
    WHERE reference='SYN-191-A'$$,
  'ma_interaction_history_blocks_source_office_change');
SELECT SET_CONFIG('renew.exact_source_correction','',FALSE);

\ir exact-source-correction-register.sql

SELECT public.rehearsal_expect_error(
  $$SELECT renew_private.assert_actual_staff('rep-191')$$,
  'exact_source_correction_requires_actual_staff_actor');

-- A stale third row must leave every row and ledger untouched.
UPDATE public.opportunities SET description='Concurrent synthetic edit' WHERE reference='SYN-191-C';
SELECT public.rehearsal_expect_error(
  $$SELECT public.apply_exact_source_correction('19100000-0000-4000-8000-000000000099','staff-191')$$,
  'exact_source_correction_stale_manifest');
DO $$ BEGIN
  IF (SELECT COUNT(*) FROM public.opportunities WHERE source_office_id='19100000-0000-4000-8000-000000000011')<>3
    OR EXISTS (SELECT 1 FROM renew_private.exact_source_events) THEN
    RAISE EXCEPTION 'stale_apply_not_all_or_none';
  END IF;
END $$;
UPDATE public.opportunities SET description='Synthetic C' WHERE reference='SYN-191-C';

-- Neither a guessed actor nor a guessed manifest can authorize service apply.
SELECT public.rehearsal_expect_error(
  $$SELECT public.apply_exact_source_correction('19100000-0000-4000-8000-000000000099','other-191')$$,
  'exact_source_manifest_or_actor_not_authorized');
SELECT public.rehearsal_expect_error(
  $$SELECT public.apply_exact_source_correction('19100000-0000-4000-8000-000000000098','staff-191')$$,
  'exact_source_manifest_or_actor_not_authorized');

CREATE TEMP TABLE rehearsal_receipt AS
  SELECT public.apply_exact_source_correction('19100000-0000-4000-8000-000000000099','staff-191') AS id;
DO $$ BEGIN
  IF (SELECT COUNT(*) FROM public.opportunities WHERE status='paused' AND NOT is_demo
      AND NOT source_identity_to_verify AND source_office_id IN (
        '19100000-0000-4000-8000-000000000012','19100000-0000-4000-8000-000000000013'))<>3
    OR (SELECT COUNT(*) FROM public.opportunity_ma_contacts WHERE is_active)<>3
    OR (SELECT COUNT(*) FROM public.opportunity_ma_contacts WHERE NOT is_active)<>4
    OR (SELECT COUNT(*) FROM public.ma_interactions WHERE office_id='19100000-0000-4000-8000-000000000011')<>2
    OR (SELECT COUNT(*) FROM public.opportunity_matches WHERE status='active_pursuit')<>1
    OR (SELECT COUNT(*) FROM public.opportunity_documents)<>1
    OR (SELECT COUNT(*) FROM public.opportunity_pursuit_evidence WHERE event_type='qualification_requested')<>1
    OR EXISTS (SELECT 1 FROM public.opportunity_pursuit_confidential_grants)
    OR public.journey_current_gate_1_event('19100000-0000-4000-8000-000000000061') IS NOT NULL
    OR public.journey_current_gate_2_event('19100000-0000-4000-8000-000000000061') IS NOT NULL
    OR (SELECT COUNT(*) FROM renew_private.exact_source_events)<>2 THEN
    RAISE EXCEPTION 'apply_or_history_invariant_failed';
  END IF;
END $$;
DO $$
DECLARE item JSONB; post JSONB;
BEGIN
  FOR item IN SELECT value FROM renew_private.exact_source_manifests m,
    JSONB_ARRAY_ELEMENTS(m.items) AS x(value) LOOP
    SELECT value INTO post FROM renew_private.exact_source_events e,
      JSONB_ARRAY_ELEMENTS(e.context) AS x(value)
    WHERE e.phase='receipt' AND e.operation='apply'
      AND value->>'opportunity_id'=item->>'opportunity_id';
    IF post->>'dependency_hash' IS DISTINCT FROM item->>'dependency_hash'
      OR (SELECT source_label FROM public.opportunities WHERE id=(item->>'opportunity_id')::UUID)
        IS DISTINCT FROM 'legacy-' || RIGHT(item->>'reference',1)
    THEN RAISE EXCEPTION 'apply_changed_dependency_or_legacy_source'; END IF;
  END LOOP;
END $$;
DO $$
DECLARE v_error TEXT;
BEGIN
  BEGIN
    PERFORM SET_CONFIG('app.ma_interaction_owner_verification','true',TRUE);
    UPDATE public.ma_interactions SET owner_verification_state='verified',
      owner_verified_by='staff-191',owner_verified_at=NOW()
      WHERE provider_idempotency_key='synthetic-191-a';
    IF (SELECT owner_verification_state FROM public.ma_interactions
        WHERE provider_idempotency_key='synthetic-191-a')<>'verified' THEN
      RAISE EXCEPTION 'historical_owner_verification_not_available';
    END IF;
    RAISE EXCEPTION 'rehearsal_rollback_historical_verification';
  EXCEPTION WHEN OTHERS THEN
    v_error:=SQLERRM;
    IF v_error<>'rehearsal_rollback_historical_verification' THEN RAISE; END IF;
  END;
END $$;
DO $$ BEGIN
  IF (SELECT id FROM rehearsal_receipt) IS DISTINCT FROM
     public.apply_exact_source_correction('19100000-0000-4000-8000-000000000099','staff-191') THEN
    RAISE EXCEPTION 'apply_replay_changed_receipt';
  END IF;
END $$;

-- A new interaction still needs the corrected current office. A retained old
-- office sent row never becomes a current Gate, grant, contact or recipient.
SELECT public.rehearsal_expect_error(
  $$INSERT INTO public.ma_interactions(office_id,opportunity_id,channel,direction,occurred_at,
      owner_staff_user_id,summary,delivery_status,provider_idempotency_key,delivery_finalized_at,sent_at)
    VALUES('19100000-0000-4000-8000-000000000011','19100000-0000-4000-8000-000000000041',
      'email','outbound',NOW(),'staff-191','Wrong old office','sent','wrong-office',NOW(),NOW())$$,
  'ma_interaction_opportunity_must_match_office');
SELECT public.rehearsal_expect_error(
  $$UPDATE public.opportunities SET source_office_id='19100000-0000-4000-8000-000000000011'
    WHERE reference='SYN-191-A'$$,
  'exact_source_correction_requires_inverse');

-- Test dependent drift without retaining that synthetic row: the exception
-- subtransaction rolls the new interaction back, then the clean inverse runs.
DO $$
DECLARE v_error TEXT;
BEGIN
  BEGIN
    INSERT INTO public.ma_interactions(office_id,affiliation_id,opportunity_id,channel,direction,occurred_at,
      owner_staff_user_id,summary,recipient_email_snapshot,delivery_status,provider_idempotency_key,delivery_finalized_at,sent_at)
    VALUES('19100000-0000-4000-8000-000000000012','19100000-0000-4000-8000-000000000032',
      '19100000-0000-4000-8000-000000000041','email','outbound',NOW(),'staff-191',
      'New synthetic contact','target-a@example.test','sent','new-dependency',NOW(),NOW());
    PERFORM public.rollback_exact_source_correction('19100000-0000-4000-8000-000000000099','staff-191');
    RAISE EXCEPTION 'inverse_accepted_new_interaction';
  EXCEPTION WHEN OTHERS THEN
    v_error:=SQLERRM;
    IF POSITION('exact_source_rollback_compare_and_swap_failed' IN v_error)=0 THEN RAISE; END IF;
  END;
END $$;
SELECT public.rehearsal_expect_error(
  $$UPDATE public.ma_interactions SET summary='Rewritten historical content'
    WHERE provider_idempotency_key='synthetic-191-a'$$,
  'ma_interactions_are_append_only');
SELECT public.rehearsal_expect_error(
  $$UPDATE renew_private.exact_source_manifests SET actor='other-191'
    WHERE id='19100000-0000-4000-8000-000000000099'$$,
  'exact_source_evidence_is_immutable');
SELECT public.rehearsal_expect_error(
  $$DELETE FROM renew_private.exact_source_events$$,
  'exact_source_evidence_is_immutable');

CREATE TEMP TABLE rehearsal_rollback AS
  SELECT public.rollback_exact_source_correction('19100000-0000-4000-8000-000000000099','staff-191') AS id;
DO $$ BEGIN
  IF (SELECT COUNT(*) FROM public.opportunities WHERE status='paused' AND NOT is_demo
      AND source_identity_to_verify AND source_office_id='19100000-0000-4000-8000-000000000011')<>3
    OR (SELECT COUNT(*) FROM public.opportunity_ma_contacts WHERE is_active AND affiliation_id='19100000-0000-4000-8000-000000000031')<>3
    OR (SELECT COUNT(*) FROM public.opportunity_ma_contacts WHERE id='19100000-0000-4000-8000-000000000054' AND is_active AND NOT is_primary)<>1
    OR (SELECT COUNT(*) FROM public.opportunity_ma_contacts WHERE NOT is_active)<>3
    OR (SELECT COUNT(*) FROM public.opportunity_ma_contacts WHERE id IN
         ('19100000-0000-4000-8000-000000000051','19100000-0000-4000-8000-000000000052',
          '19100000-0000-4000-8000-000000000053') AND is_active)<>3
    OR (SELECT COUNT(*) FROM public.ma_interactions WHERE office_id='19100000-0000-4000-8000-000000000011')<>2
    OR (SELECT COUNT(*) FROM renew_private.exact_source_events)<>4 THEN
    RAISE EXCEPTION 'inverse_or_evidence_retention_failed';
  END IF;
  IF (SELECT id FROM rehearsal_rollback) IS DISTINCT FROM
     public.rollback_exact_source_correction('19100000-0000-4000-8000-000000000099','staff-191') THEN
    RAISE EXCEPTION 'inverse_replay_changed_receipt';
  END IF;
END $$;
SELECT public.rehearsal_expect_error(
  $$SELECT public.apply_exact_source_correction('19100000-0000-4000-8000-000000000099','staff-191')$$,
  'exact_source_correction_replay_state_drifted');
