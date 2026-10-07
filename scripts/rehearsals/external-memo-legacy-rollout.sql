-- This actual old six-field claim committed BEFORE the additive schema.
DO $$ BEGIN
 IF (SELECT count(*) FROM public.synthetic_255_inflight_claim)<>1
 OR NOT EXISTS(SELECT 1 FROM public.opportunity_memo_notifications WHERE status='sending' AND attempt_count=1)
 OR EXISTS(SELECT 1 FROM public.opportunity_memo_grant_snapshots)
 OR EXISTS(SELECT 1 FROM public.opportunity_pursuit_confidential_grants WHERE grant_evidence_id IS NOT NULL)
 THEN RAISE EXCEPTION 'schema_changed_old_inflight_truth'; END IF;
END $$;
SELECT public.complete_opportunity_memo_notification('76000000-0000-4000-8000-000000000011',now(),'synthetic-pre-schema-acceptance');
SELECT public.journey_revoke_confidential_access('76000000-0000-4000-8000-000000000011','w173-staff','next exact grant','255-rollout-revoke');
CREATE TABLE public.synthetic_255_rollout_B AS SELECT public.journey_grant_confidential_access_v2('76000000-0000-4000-8000-000000000011','25500000-0000-4000-8000-000000000001','w173-staff','255-rollout-B',now()+interval '40 days') AS grant_id;
CREATE TABLE public.synthetic_255_rollout_claim AS SELECT * FROM public.claim_opportunity_memo_grant_notice('76000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000011',(SELECT grant_id FROM public.synthetic_255_rollout_B),now());
SELECT public.complete_opportunity_memo_notification('76000000-0000-4000-8000-000000000011',now(),'synthetic-delayed-pre-schema-callback');
DO $$ BEGIN
 IF (SELECT count(*) FROM public.synthetic_255_rollout_claim)<>1
 OR NOT EXISTS(SELECT 1 FROM public.opportunity_memo_grant_notices WHERE grant_evidence_id=(SELECT grant_id FROM public.synthetic_255_rollout_B) AND state='sending' AND provider_id IS NULL)
 OR NOT EXISTS(SELECT 1 FROM public.opportunity_memo_notifications WHERE status='sent' AND provider_id='synthetic-pre-schema-acceptance')
 THEN RAISE EXCEPTION 'old_inflight_callback_consumed_new_B'; END IF;
END $$;
SELECT 'PASS: actual old claim survives schema application; old acceptance stays unattributed and its delayed callback cannot consume new B.';
