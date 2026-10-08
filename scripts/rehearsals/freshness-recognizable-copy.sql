BEGIN;
-- Synthetic public-function acceptance for #263/#264. Never production data.
DO $$ DECLARE members jsonb; review_id uuid; version integer; blocked boolean := false; BEGIN
 SELECT jsonb_agg(candidate) INTO members FROM public.opportunity_freshness_candidates('18700000-0000-4000-8000-000000000003',now(),true,NULL) candidate;
 review_id := public.opportunity_freshness_prepare('18700000-0000-4000-8000-000000000003',members,'Statut des process','Alpine (CA : 3,2 M€) et Bay','copy-v1');
 BEGIN
  PERFORM public.opportunity_freshness_edit(review_id,1,'Statut A-01','Alpine et Bay','staff-1');
 EXCEPTION WHEN raise_exception THEN blocked := true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'internal_reference_edit_was_allowed'; END IF;
END $$;

SET CONSTRAINTS ALL IMMEDIATE;
ROLLBACK;
BEGIN;
DO $$ DECLARE members jsonb; r uuid; blocked boolean; v integer; before_words text; old_payload jsonb := '{"subject":"A-01","text":"old exact words"}'; BEGIN
 SELECT jsonb_agg(c) INTO members FROM public.opportunity_freshness_candidates('18700000-0000-4000-8000-000000000003',now(),true,NULL) c;
 r := public.opportunity_freshness_prepare('18700000-0000-4000-8000-000000000003',members,'Statut des process','Alpine (CA : 3,2 M€) et Bay','copy-v1');
 blocked:=false;
 BEGIN PERFORM public.opportunity_freshness_assert_current(r); EXCEPTION WHEN raise_exception THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'unconfirmed_recognizability_and_neutrality_were_sent'; END IF;
 PERFORM public.opportunity_freshness_acknowledge_copy(r,1,'staff-1');
 PERFORM public.opportunity_freshness_assert_current(r);
 blocked:=false;
 BEGIN PERFORM public.opportunity_freshness_edit(r,1,'Statut','Alpine (CA : 3,2 M€) et Bay (CA : 99 M€)','staff-1');
 EXCEPTION WHEN raise_exception THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'invented_missing_revenue_was_allowed'; END IF;
 -- Simulate an existing legacy unattempted snapshot without rewriting its words.
 UPDATE public.opportunity_freshness_members SET frozen_member=(SELECT c FROM public.opportunity_freshness_candidates_pre263(contact_id,now(),false,r) c WHERE c->>'opportunity_id'=opportunity_id::text) WHERE review_id=r;
 blocked := false;
 BEGIN PERFORM public.opportunity_freshness_replace_words(r,1,'Statut','Alpine (CA : 3,2 M€) et Bay','copy-v2','staff-1');
 EXCEPTION WHEN raise_exception THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'legacy_copy_replaced_without_evidence_refresh'; END IF;
 SELECT body_text INTO before_words FROM public.staff_email_reviews WHERE id=r;
 v:=public.opportunity_freshness_refresh(r,1,'copy-v2','staff-1');
 IF (SELECT body_text FROM public.staff_email_reviews WHERE id=r) IS DISTINCT FROM before_words OR
  (SELECT count(*) FROM public.opportunity_freshness_members WHERE review_id=r)<>2 THEN RAISE EXCEPTION 'refresh_overwrote_words_or_members'; END IF;
 v:=public.opportunity_freshness_replace_words(r,v,'Statut','Alpine (CA : 3,2 M€) et Bay — mots choisis par le staff','copy-v2','staff-1');
 PERFORM public.opportunity_freshness_acknowledge_copy(r,v,'staff-1');
 PERFORM public.opportunity_freshness_assert_current(r);
 blocked:=false;
 BEGIN PERFORM public.opportunity_freshness_replace_words(r,v-1,'Statut','Alpine (CA : 3,2 M€) et Bay','copy-v2','staff-1');
 EXCEPTION WHEN raise_exception THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'stale_version_overwrote_staff_words'; END IF;
 -- Revenue changes invalidate the exact reviewed snapshot.
 UPDATE public.opportunities SET revenue_meur=4.5 WHERE reference='A-01';
 blocked:=false;
 BEGIN PERFORM public.opportunity_freshness_assert_current(r); EXCEPTION WHEN raise_exception THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'revenue_drift_did_not_block'; END IF;
 v:=public.opportunity_freshness_refresh(r,v,'copy-v2','staff-1');
 blocked:=false;
 BEGIN PERFORM public.opportunity_freshness_assert_current(r); EXCEPTION WHEN raise_exception THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'old_revenue_words_survived_refresh'; END IF;
 v:=public.opportunity_freshness_replace_words(r,v,'Statut','Alpine (CA : 4,5 M€) et Bay','copy-v2','staff-1');
 PERFORM public.opportunity_freshness_acknowledge_copy(r,v,'staff-1');
 PERFORM public.opportunity_freshness_assert_current(r);
 UPDATE public.opportunities SET public_title=NULL WHERE reference='B-02';
 v:=public.opportunity_freshness_refresh(r,v,'copy-v2','staff-1');
 blocked:=false;
 BEGIN PERFORM public.opportunity_freshness_assert_current(r); EXCEPTION WHEN raise_exception THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'missing_title_sent_with_fallback'; END IF;
 -- Attempted historical copy remains immutable and retains legacy eligibility.
 UPDATE public.opportunities SET public_title='Bay',revenue_meur=3.2 WHERE reference='B-02';
 UPDATE public.opportunity_freshness_members SET frozen_member=(SELECT c FROM public.opportunity_freshness_candidates_pre263(contact_id,now(),false,r) c WHERE c->>'opportunity_id'=opportunity_id::text) WHERE review_id=r;
 UPDATE public.staff_email_reviews SET attempted_payload=old_payload,state='uncertain',attempted_at=now() WHERE id=r;
 PERFORM public.opportunity_freshness_assert_current(r);
 blocked:=false;
 BEGIN PERFORM public.opportunity_freshness_replace_words(r,v,'New','Alpine (CA : 4,5 M€) et Bay','copy-v2','staff-1'); EXCEPTION WHEN raise_exception THEN blocked:=true; END;
 IF NOT blocked OR (SELECT attempted_payload FROM public.staff_email_reviews WHERE id=r) IS DISTINCT FROM old_payload THEN RAISE EXCEPTION 'historic_attempt_was_mutated'; END IF;
END $$;
SET CONSTRAINTS ALL IMMEDIATE;
ROLLBACK;

-- Exercise the real reservation/version boundary for a single member and a group.
BEGIN;
DO $$ DECLARE members jsonb; r uuid; token uuid; v integer; contact uuid; BEGIN
 FOREACH contact IN ARRAY ARRAY['18700000-0000-4000-8000-000000000004'::uuid,'18700000-0000-4000-8000-000000000003'::uuid] LOOP
  SELECT jsonb_agg(c) INTO members FROM public.opportunity_freshness_candidates(contact,now(),true,NULL) c;
  r:=public.opportunity_freshness_prepare(contact,members,'Statut',CASE WHEN contact='18700000-0000-4000-8000-000000000004'::uuid THEN 'Cove' ELSE 'Alpine (CA : 3,2 M€) et Bay' END,'copy-v1');
  PERFORM public.opportunity_freshness_acknowledge_copy(r,1,'staff-1');
  token:=public.opportunity_freshness_reserve(r,1,jsonb_build_object('subject','Statut','text',(SELECT body_text FROM public.staff_email_reviews WHERE id=r)),repeat('b',64),'staff-1');
  SELECT version INTO v FROM public.staff_email_reviews WHERE id=r;
  IF token IS NULL OR v<>2 OR (SELECT attempted_payload FROM public.staff_email_reviews WHERE id=r) IS NULL THEN RAISE EXCEPTION 'reservation_did_not_freeze_confirmed_payload'; END IF;
  -- This is the same last assertion used by both single and bulk provider paths.
  PERFORM public.opportunity_freshness_assert_current(r);
 END LOOP;
END $$;
SET CONSTRAINTS ALL IMMEDIATE;
ROLLBACK;
