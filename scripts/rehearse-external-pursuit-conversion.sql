-- Disposable W-109 rehearsal. Run against a temporary database with the
-- released schema through 094 and W-039/W-099 migration 092 applied.
\set ON_ERROR_STOP on
\ir 098_external_pursuit_opportunity_conversion.sql
BEGIN;

INSERT INTO public.repreneurs (id,first_name,last_name,email)
VALUES ('00000000-0000-4000-8000-000000010981','Conversion','Owner','conversion-owner@example.test')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.app_user_roles (user_id,email,role,repreneur_id) VALUES
  ('conversion-owner-user','conversion-owner@example.test','repreneur','00000000-0000-4000-8000-000000010981'),
  ('conversion-staff-user','conversion-staff@example.test','staff',NULL),
  ('conversion-other-staff-user','conversion-other-staff@example.test','staff',NULL)
ON CONFLICT DO NOTHING;
INSERT INTO public.ma_firms (id,name,status,created_by,updated_by)
VALUES ('00000000-0000-4000-8000-000000010982','Conversion Advisory','active','conversion-staff-user','conversion-staff-user')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.ma_offices (id,firm_id,name,status,is_default,created_by,updated_by)
VALUES ('00000000-0000-4000-8000-000000010983','00000000-0000-4000-8000-000000010982','Paris','active',FALSE,'conversion-staff-user','conversion-staff-user')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.ma_contacts (id,first_name,last_name,display_name,status,created_by,updated_by)
VALUES ('00000000-0000-4000-8000-000000010984','Case','Contact','Case Contact','active','conversion-staff-user','conversion-staff-user')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.ma_contact_office_affiliations (id,contact_id,office_id,is_active,created_by)
VALUES ('00000000-0000-4000-8000-000000010985','00000000-0000-4000-8000-000000010984','00000000-0000-4000-8000-000000010983',TRUE,'conversion-staff-user')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.ma_offices (id,firm_id,name,status,is_default,created_by,updated_by)
VALUES ('00000000-0000-4000-8000-000000010986','00000000-0000-4000-8000-000000010982','Conversion Advisory','active',TRUE,'conversion-staff-user','conversion-staff-user')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.ma_contacts (id,first_name,last_name,display_name,status,created_by,updated_by)
VALUES ('00000000-0000-4000-8000-000000010987','Synthetic','Contact','Synthetic Contact','active','conversion-staff-user','conversion-staff-user')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.ma_contact_office_affiliations (id,contact_id,office_id,is_active,created_by)
VALUES ('00000000-0000-4000-8000-000000010988','00000000-0000-4000-8000-000000010987','00000000-0000-4000-8000-000000010986',TRUE,'conversion-staff-user')
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE dossier UUID; default_dossier UUID; acme_dossier UUID; deletion_dossier UUID; acme_office UUID; acme_affiliation UUID; converted UUID; repeated UUID; opportunity public.opportunities%ROWTYPE; before_matches BIGINT; before_pursuits BIGINT; before_ndas BIGINT;
BEGIN
  IF NOT has_function_privilege('service_role','public.convert_external_pursuit_to_opportunity(uuid,text,uuid,uuid,uuid,text,text)','EXECUTE')
     OR NOT has_function_privilege('service_role','public.prepare_external_pursuit_deletion_fulfillment(uuid,text)','EXECUTE')
     OR has_function_privilege('authenticated','public.convert_external_pursuit_to_opportunity(uuid,text,uuid,uuid,uuid,text,text)','EXECUTE')
     OR has_function_privilege('authenticated','public.prepare_external_pursuit_deletion_fulfillment(uuid,text)','EXECUTE')
     OR has_function_privilege('service_role','public.assert_external_pursuit_not_converted(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'w109_direct_api_privilege_boundary_failed';
  END IF;
  IF (SELECT count(*) FROM public.staff_ma_office_intake_projection WHERE office_id='00000000-0000-4000-8000-000000010986'::UUID) <> 0 THEN
    RAISE EXCEPTION 'w109_default_office_projection_failed';
  END IF;
  SELECT count(*) INTO before_matches FROM public.opportunity_matches;
  SELECT count(*) INTO before_pursuits FROM public.opportunity_pursuit_evidence;
  SELECT count(*) INTO before_ndas FROM public.opportunity_nda_artifacts;
  dossier := public.create_external_pursuit('00000000-0000-4000-8000-000000010981','Never copy this dossier title','meetings','available',NULL,'Never copy this note','Never copy staff note','conversion-staff-user','conversion-fixture-create');
  SELECT opportunity_id INTO converted FROM public.convert_external_pursuit_to_opportunity(
    dossier,'Anonymous regional industrial specialist','00000000-0000-4092-8000-000000000001','00000000-0000-4000-8000-000000010983','00000000-0000-4000-8000-000000010985','conversion-staff-user','conversion-fixture-convert');
  SELECT opportunity_id INTO repeated FROM public.convert_external_pursuit_to_opportunity(
    dossier,'Changed title must be ignored','00000000-0000-4092-8000-000000000211','00000000-0000-4000-8000-000000010983','00000000-0000-4000-8000-000000010985','conversion-staff-user','conversion-fixture-convert');
  IF converted <> repeated THEN RAISE EXCEPTION 'w109_exact_replay_failed'; END IF;
  SELECT * INTO opportunity FROM public.opportunities WHERE id=converted;
  IF opportunity.status <> 'draft' OR opportunity.repreneur_exposure <> 'staff_only' OR opportunity.public_title <> 'Anonymous regional industrial specialist' OR opportunity.geography_node_id <> '00000000-0000-4092-8000-000000000001'::UUID OR opportunity.reference !~ '^Re-New - FR - [0-9]+$' THEN RAISE EXCEPTION 'w109_canonical_draft_fields_failed'; END IF;
  IF opportunity.description IS NOT NULL OR opportunity.internal_notes IS NOT NULL OR opportunity.source_office_id <> '00000000-0000-4000-8000-000000010983'::UUID OR (SELECT count(*) FROM public.opportunity_ma_contacts WHERE opportunity_id=converted AND is_active AND is_primary) <> 1 THEN RAISE EXCEPTION 'w109_copy_or_contact_boundary_failed'; END IF;
  IF (SELECT count(*) FROM public.external_pursuit_opportunity_conversions WHERE external_pursuit_id=dossier AND opportunity_id=converted) <> 1 THEN RAISE EXCEPTION 'w109_immutable_link_missing'; END IF;
  IF (SELECT count(*) FROM public.opportunity_matches) <> before_matches OR (SELECT count(*) FROM public.opportunity_pursuit_evidence) <> before_pursuits OR (SELECT count(*) FROM public.opportunity_nda_artifacts) <> before_ndas THEN RAISE EXCEPTION 'w109_match_or_gate_changed'; END IF;
  BEGIN PERFORM public.convert_external_pursuit_to_opportunity(dossier,'Second copy','00000000-0000-4092-8000-000000000001','00000000-0000-4000-8000-000000010983','00000000-0000-4000-8000-000000010985','conversion-other-staff-user','different-key'); RAISE EXCEPTION 'w109_second_conversion_was_allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'external_pursuit_already_converted' THEN RAISE; END IF; END;
  BEGIN PERFORM public.convert_external_pursuit_to_opportunity(dossier,'Owner conversion','00000000-0000-4092-8000-000000000001','00000000-0000-4000-8000-000000010983','00000000-0000-4000-8000-000000010985','conversion-owner-user','owner-key'); RAISE EXCEPTION 'w109_owner_conversion_was_allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'External Pursuit access denied.' THEN RAISE; END IF; END;
  BEGIN PERFORM public.prepare_external_pursuit_deletion_fulfillment(dossier,'conversion-staff-user'); RAISE EXCEPTION 'w109_converted_preflight_was_allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'external_pursuit_already_converted' THEN RAISE; END IF; END;
  BEGIN PERFORM public.request_external_pursuit_deletion(dossier,'conversion-staff-user','staff-cannot-request'); RAISE EXCEPTION 'w109_staff_delete_request_was_allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'Only the owner repreneur may request deletion.' THEN RAISE; END IF; END;
  BEGIN PERFORM public.request_external_pursuit_deletion(dossier,'conversion-owner-user','conversion-delete-request'); RAISE EXCEPTION 'w109_converted_delete_request_was_allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'external_pursuit_already_converted' THEN RAISE; END IF; END;
  BEGIN PERFORM public.fulfill_external_pursuit_deletion(dossier,'conversion-staff-user','conversion-delete-fulfill'); RAISE EXCEPTION 'w109_converted_deletion_was_allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'external_pursuit_already_converted' THEN RAISE; END IF; END;

  default_dossier := public.create_external_pursuit('00000000-0000-4000-8000-000000010981','Default-office rejection','meetings','available',NULL,NULL,NULL,'conversion-staff-user','conversion-default-create');
  BEGIN PERFORM public.convert_external_pursuit_to_opportunity(default_dossier,'Default office must fail','00000000-0000-4092-8000-000000000001','00000000-0000-4000-8000-000000010986','00000000-0000-4000-8000-000000010988','conversion-staff-user','conversion-default-convert'); RAISE EXCEPTION 'w109_default_office_was_allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'external_pursuit_conversion_requires_active_real_office' THEN RAISE; END IF; END;

  SELECT office_id, affiliation_id INTO acme_office, acme_affiliation
  FROM public.ma_provisional_source_contexts WHERE context_key='acme_co_paris';
  acme_dossier := public.create_external_pursuit('00000000-0000-4000-8000-000000010981','Acme rejection','meetings','available',NULL,NULL,NULL,'conversion-staff-user','conversion-acme-create');
  BEGIN PERFORM public.convert_external_pursuit_to_opportunity(acme_dossier,'Acme must fail','00000000-0000-4092-8000-000000000001',acme_office,acme_affiliation,'conversion-staff-user','conversion-acme-convert'); RAISE EXCEPTION 'w109_acme_office_was_allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'external_pursuit_conversion_rejects_acme_source' THEN RAISE; END IF; END;

  deletion_dossier := public.create_external_pursuit('00000000-0000-4000-8000-000000010981','Deletion preflight','meetings','available',NULL,NULL,NULL,'conversion-staff-user','conversion-preflight-create');
  PERFORM public.request_external_pursuit_deletion(deletion_dossier,'conversion-owner-user','conversion-preflight-request');
  PERFORM public.prepare_external_pursuit_deletion_fulfillment(deletion_dossier,'conversion-staff-user');
  BEGIN PERFORM public.prepare_external_pursuit_deletion_fulfillment(deletion_dossier,'conversion-owner-user'); RAISE EXCEPTION 'w109_owner_preflight_was_allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'External Pursuit access denied.' THEN RAISE; END IF; END;
END $$;

ROLLBACK;
