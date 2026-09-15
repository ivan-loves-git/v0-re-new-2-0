\set ON_ERROR_STOP on
BEGIN;
INSERT INTO public.geography_nodes(id,stable_key,code,label,node_level) VALUES ('24000000-0000-4000-8000-000000000007','synthetic-france','FR','Synthetic France','country');
INSERT INTO public.app_user_roles(user_id,email,role) VALUES ('description-staff','staff@example.invalid','staff');
INSERT INTO public.ma_firms(id,name,status,created_by) VALUES ('24000000-0000-4000-8000-000000000001','Synthetic description firm','active','description-staff');
INSERT INTO public.ma_offices(id,firm_id,name,status,is_default,created_by) VALUES ('24000000-0000-4000-8000-000000000002','24000000-0000-4000-8000-000000000001','Synthetic office','active',false,'description-staff');
INSERT INTO public.ma_contacts(id,first_name,display_name,status,email,created_by) VALUES ('24000000-0000-4000-8000-000000000003','Synthetic','Synthetic contact','active','contact@example.invalid','description-staff');
INSERT INTO public.ma_contact_office_affiliations(id,contact_id,office_id,is_active,created_by) VALUES ('24000000-0000-4000-8000-000000000004','24000000-0000-4000-8000-000000000003','24000000-0000-4000-8000-000000000002',true,'description-staff');
INSERT INTO public.repreneurs(id,email,first_name,last_name,created_by,is_demo) VALUES
('24000000-0000-4000-8000-000000000005','buyer@example.invalid','Synthetic','Buyer','description-staff',false),
('24000000-0000-4000-8000-000000000006','demo@example.invalid','Synthetic','Demo','description-staff',true);
COMMIT;

-- Actual strict create -> public save -> all office/contact invariants, with
-- no second description and no confidential-access evidence.
SET ROLE service_role;
DO $$ DECLARE saved public.opportunities%ROWTYPE; public_text TEXT; BEGIN
  saved := public.create_opportunity_with_office_context_v2(
    'SYNTHETIC-PUBLIC-124','24000000-0000-4000-8000-000000000002',
    ARRAY['24000000-0000-4000-8000-000000000004']::UUID[],
    '24000000-0000-4000-8000-000000000004','IGNORE SUBMITTED LEGACY PROSE','active','description-staff',
    '{"is_demo":false,"geography_node_id":"24000000-0000-4000-8000-000000000007","public_title":"Synthetic business","teaser_summary":"Independent engineering business.","public_description_approved":true}');
  IF saved.description IS NOT NULL OR saved.public_description_approved_by <> 'description-staff'
    OR saved.public_description_approved_at IS NULL THEN RAISE EXCEPTION 'single_public_create_failed'; END IF;
  SELECT teaser_summary INTO public_text FROM public.w164_repreneur_live_inventory('24000000-0000-4000-8000-000000000005',saved.id);
  IF public_text IS DISTINCT FROM 'Independent engineering business.' THEN RAISE EXCEPTION 'approved_description_not_visible'; END IF;
  IF EXISTS(SELECT 1 FROM public.w164_repreneur_live_inventory('24000000-0000-4000-8000-000000000006',saved.id)) THEN RAISE EXCEPTION 'cross_namespace_visible'; END IF;
END $$;
RESET ROLE;

-- Retain a synthetic legacy equal pair. Migration/save must never overwrite
-- the original or its private notes just to obtain a public description.
UPDATE public.opportunities SET description=teaser_summary,internal_notes='PRIVATE NEVER PUBLISH'
WHERE public_title='Synthetic business';

SET ROLE service_role;
DO $$ DECLARE saved public.opportunities%ROWTYPE; previous public.opportunities%ROWTYPE; payload JSONB; BEGIN
  SELECT * INTO previous FROM public.opportunities WHERE public_title='Synthetic business';
  saved := public.save_opportunity_office_context(previous.id,previous.source_office_id,
    ARRAY['24000000-0000-4000-8000-000000000004']::UUID[],'24000000-0000-4000-8000-000000000004',
    'DO NOT OVERWRITE ORIGINAL','active','description-staff',
    jsonb_build_object('teaser_summary',previous.teaser_summary,'public_description_approved',false,'revenue_meur',4.2));
  IF saved.description IS DISTINCT FROM previous.description OR saved.internal_notes IS DISTINCT FROM previous.internal_notes
    OR saved.public_description_approved_at IS DISTINCT FROM previous.public_description_approved_at
    OR saved.revenue_meur <> 4.2 THEN RAISE EXCEPTION 'ordinary_edit_lost_original_or_approval'; END IF;
  IF (SELECT teaser_summary FROM public.w164_repreneur_live_inventory('24000000-0000-4000-8000-000000000005',saved.id))
    IS DISTINCT FROM previous.teaser_summary THEN RAISE EXCEPTION 'approved_equal_text_hidden'; END IF;

  BEGIN
    PERFORM public.save_opportunity_office_context(previous.id,previous.source_office_id,
      ARRAY['24000000-0000-4000-8000-000000000004']::UUID[],'24000000-0000-4000-8000-000000000004',NULL,'active','description-staff',
      '{"teaser_summary":"Changed without approval","public_description_approved":false}');
    RAISE EXCEPTION 'unconfirmed_description_accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'opportunity_public_description_approval_required' THEN RAISE; END IF; END;

  BEGIN
    PERFORM public.save_opportunity_office_context(previous.id,previous.source_office_id,
      ARRAY['24000000-0000-4000-8000-000000000004']::UUID[],'24000000-0000-4000-8000-000000000004',NULL,'active','not-staff',
      '{"teaser_summary":"Spoofed staff","public_description_approved":true}');
    RAISE EXCEPTION 'nonstaff_description_accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'opportunity_public_description_approval_invalid' THEN RAISE; END IF; END;

  -- A later contact failure rolls back BOTH new text and approval.
  BEGIN
    PERFORM public.save_opportunity_office_context(previous.id,previous.source_office_id,
      '{}'::UUID[],NULL,NULL,'active','description-staff',
      '{"teaser_summary":"Approved but invalid contact context","public_description_approved":true}');
    RAISE EXCEPTION 'invalid_contact_save_accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'opportunity_activation_requires_contact' THEN RAISE; END IF; END;
  SELECT * INTO saved FROM public.opportunities WHERE id=previous.id;
  IF saved.teaser_summary IS DISTINCT FROM previous.teaser_summary OR saved.public_description_approved_at IS DISTINCT FROM previous.public_description_approved_at THEN
    RAISE EXCEPTION 'failed_save_partially_persisted'; END IF;

  -- New recommendation payload uses the same exact approved text and contains
  -- neither original/private metadata nor new access or historical evidence.
  INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,created_by)
  VALUES('24000000-0000-4000-8000-000000000008',saved.id,'24000000-0000-4000-8000-000000000005','proposed','description-staff');
  payload := public.get_recommendation_assignment_notification('24000000-0000-4000-8000-000000000008','description-staff');
  IF payload ->> 'teaser_summary' IS DISTINCT FROM saved.teaser_summary OR payload::TEXT LIKE '%PRIVATE%'
    OR payload ? 'public_description_approved_by' THEN RAISE EXCEPTION 'unsafe_or_missing_assignment_description'; END IF;

  -- Old service callers remain valid, but changing text invalidates any prior
  -- approval; copying the internal original is still hidden until confirmed.
  saved := public.save_opportunity_office_context(previous.id,previous.source_office_id,
    ARRAY['24000000-0000-4000-8000-000000000004']::UUID[],'24000000-0000-4000-8000-000000000004',NULL,'active','description-staff',
    '{"teaser_summary":"Legacy curated summary"}');
  IF saved.public_description_approved_hash IS NOT NULL THEN RAISE EXCEPTION 'old_text_approval_reused'; END IF;
  IF public.get_recommendation_assignment_notification('24000000-0000-4000-8000-000000000008','description-staff') IS NOT NULL THEN RAISE EXCEPTION 'stale_assignment_payload_sendable'; END IF;
  UPDATE public.opportunities SET teaser_summary=description WHERE id=saved.id;
  IF (SELECT teaser_summary FROM public.w164_repreneur_live_inventory('24000000-0000-4000-8000-000000000005',saved.id)) IS NOT NULL THEN
    RAISE EXCEPTION 'unapproved_equal_pair_published'; END IF;
  saved := public.save_opportunity_office_context(previous.id,previous.source_office_id,
    ARRAY['24000000-0000-4000-8000-000000000004']::UUID[],'24000000-0000-4000-8000-000000000004',NULL,'active','description-staff',
    jsonb_build_object('teaser_summary',previous.teaser_summary,'public_description_approved',true));
  IF saved.public_description_approved_hash IS NULL THEN RAISE EXCEPTION 'explicit_unchanged_confirmation_missing'; END IF;
  saved := public.save_opportunity_office_context(previous.id,previous.source_office_id,
    ARRAY['24000000-0000-4000-8000-000000000004']::UUID[],'24000000-0000-4000-8000-000000000004',NULL,'active','description-staff',
    '{"teaser_summary":null,"public_description_approved":false}');
  IF saved.teaser_summary IS NOT NULL OR saved.public_description_approved_hash IS NOT NULL OR saved.description IS NULL THEN RAISE EXCEPTION 'clear_lost_original_or_approval'; END IF;
  IF (SELECT teaser_summary FROM public.w164_repreneur_live_inventory('24000000-0000-4000-8000-000000000005',saved.id)) IS NOT NULL THEN RAISE EXCEPTION 'private_fallback_after_clear'; END IF;
END $$;
RESET ROLE;

DO $$ BEGIN
  IF public.safe_public_opportunity_description('Stale','Original',repeat('a',64),now(),'description-staff') IS NOT NULL
    OR public.safe_public_opportunity_description('Partial','Original',NULL,now(),NULL) IS NOT NULL
    OR public.safe_public_opportunity_description('ＦＯＯ','foo',NULL,NULL,NULL) IS NOT NULL THEN RAISE EXCEPTION 'unsafe_projection'; END IF;
  IF has_function_privilege('anon','public.save_opportunity_office_context(uuid,uuid,uuid[],uuid,text,public.opportunity_status,text,jsonb)','EXECUTE')
    OR has_function_privilege('authenticated','public.safe_public_opportunity_description(text,text,text,timestamptz,text)','EXECUTE') THEN RAISE EXCEPTION 'public_role_permission_leak'; END IF;
  IF EXISTS(SELECT 1 FROM public.opportunity_pursuit_evidence)
    OR EXISTS(SELECT 1 FROM public.opportunity_pursuit_events)
    OR EXISTS(SELECT 1 FROM public.opportunity_pursuit_confidential_grants)
    OR EXISTS(SELECT 1 FROM public.opportunity_nda_artifacts)
    OR EXISTS(SELECT 1 FROM public.email_logs) THEN RAISE EXCEPTION 'description_created_unrelated_evidence_or_send'; END IF;
  IF (SELECT count(*) FROM public.opportunity_recommendation_assignment_notifications) <> 1 THEN RAISE EXCEPTION 'description_replayed_assignment'; END IF;
END $$;
