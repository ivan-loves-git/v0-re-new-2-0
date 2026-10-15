-- Entirely synthetic #257 / #260 behavioral proof on the real service boundary.
CREATE FUNCTION public.fixture_directory_reject(statement TEXT, expected TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN IF POSITION(expected IN SQLERRM)>0 THEN RETURN; END IF; RAISE; END;
  RAISE EXCEPTION 'accepted_invalid_directory_request: %',expected;
END $$;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.fixture_directory_retained r WHERE
    (CASE WHEN r.entity='firm' AND r.row->>'status'='prospect' THEN r.row||'{"status":"active"}'::jsonb ELSE r.row END)
    IS DISTINCT FROM CASE r.entity
    WHEN 'firm' THEN (SELECT to_jsonb(f) FROM public.ma_firms f WHERE f.id=r.id)
    WHEN 'office' THEN (SELECT to_jsonb(o) FROM public.ma_offices o WHERE o.id=r.id)
    WHEN 'contact' THEN (SELECT to_jsonb(c) FROM public.ma_contacts c WHERE c.id=r.id)
    WHEN 'affiliation' THEN (SELECT to_jsonb(a) FROM public.ma_contact_office_affiliations a WHERE a.id=r.id)
    WHEN 'opportunity' THEN (SELECT to_jsonb(o) FROM public.opportunities o WHERE o.id=r.id)
    WHEN 'opportunity_contact' THEN (SELECT to_jsonb(c) FROM public.opportunity_ma_contacts c WHERE c.id=r.id)
    WHEN 'interaction' THEN (SELECT to_jsonb(i) FROM public.ma_interactions i WHERE i.id=r.id) END)
  THEN RAISE EXCEPTION 'migration_rewrote_retained_history'; END IF;
END $$;
-- The released cutover writer still supplies the retired creation value.
-- Compatibility must persist the new state rather than break that writer.
DO $$ DECLARE firm UUID; BEGIN
  SET LOCAL ROLE service_role;
  INSERT INTO public.ma_firms(name,status,created_by,updated_by)
    VALUES('Synthetic legacy creation input','prospect','staff-262','staff-262') RETURNING id INTO firm;
  INSERT INTO public.ma_offices(firm_id,name,city,is_default,created_by,updated_by)
    VALUES(firm,'Legacy writer real office','Paris',FALSE,'staff-262','staff-262');
  IF (SELECT status FROM public.ma_firms WHERE id=firm)<>'active'
    THEN RAISE EXCEPTION 'legacy_creation_reintroduced_prospect'; END IF;
END $$;
SELECT public.fixture_directory_reject($q$SELECT public.create_ma_office_for_existing_firm('26200000-0000-4000-8000-000000000002','Blocked archived office','Paris','staff-262')$q$,'ma_existing_firm_archived');
SELECT public.fixture_directory_reject($q$UPDATE public.ma_firms SET status='prospect' WHERE id='26200000-0000-4000-8000-000000000001'$q$,'ma_firms_status_check');
SELECT public.fixture_directory_reject($q$UPDATE public.ma_firms SET status='unknown' WHERE id='26200000-0000-4000-8000-000000000001'$q$,'ma_firms_status_check');
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.ma_offices WHERE firm_id='26200000-0000-4000-8000-000000000002')
    OR (SELECT to_jsonb(f) FROM public.ma_firms f WHERE id='26200000-0000-4000-8000-000000000001')
      IS DISTINCT FROM ((SELECT row FROM public.fixture_directory_retained WHERE entity='firm' AND id='26200000-0000-4000-8000-000000000001')||'{"status":"active"}'::jsonb)
  THEN RAISE EXCEPTION 'rejected_status_or_archived_write_changed_graph'; END IF;
END $$;
DO $$ DECLARE saved RECORD; BEGIN
  SET LOCAL ROLE service_role;
  SELECT * INTO saved FROM public.create_ma_firm_with_first_office('Synthetic Directory Firm','Central office','Lyon',FALSE,NULL,NULL,NULL,NULL,NULL,'staff-257');
  IF NOT EXISTS(SELECT 1 FROM public.ma_firms WHERE id=saved.firm_id AND name='Synthetic Directory Firm' AND status='active' AND created_by='staff-257' AND updated_by='staff-257' AND created_at IS NOT NULL)
    OR NOT EXISTS(SELECT 1 FROM public.ma_offices WHERE id=saved.office_id AND firm_id=saved.firm_id AND name='Central office' AND city='Lyon' AND NOT is_default AND created_by='staff-257' AND updated_by='staff-257')
    OR saved.contact_id IS NOT NULL OR saved.affiliation_id IS NOT NULL
    OR EXISTS(SELECT 1 FROM public.ma_contact_office_affiliations WHERE office_id=saved.office_id)
    OR EXISTS(SELECT 1 FROM public.opportunities WHERE source_office_id=saved.office_id)
  THEN RAISE EXCEPTION 'standalone_firm_office_readback_failed'; END IF;
  PERFORM * FROM public.create_ma_office_for_existing_firm(saved.firm_id,'Second real office','Marseille','staff-257');
  IF (SELECT count(*) FROM public.ma_offices WHERE firm_id=saved.firm_id)<>2
    THEN RAISE EXCEPTION 'new_firm_second_office_failed'; END IF;
  SELECT * INTO saved FROM public.create_ma_office_for_existing_firm('26200000-0000-4000-8000-000000000001','Former prospect second office','Lille','staff-262');
  IF NOT EXISTS(SELECT 1 FROM public.ma_offices WHERE id=saved.office_id AND city='Lille' AND NOT is_default)
    OR EXISTS(SELECT 1 FROM public.ma_contact_office_affiliations WHERE office_id=saved.office_id)
    OR EXISTS(SELECT 1 FROM public.opportunities WHERE source_office_id=saved.office_id)
    THEN RAISE EXCEPTION 'normalized_firm_second_office_failed'; END IF;
  SELECT * INTO saved FROM public.create_ma_office_for_existing_firm('25700000-0000-4000-8000-000000000001','Synthetic North','Lille','staff-257');
  IF NOT EXISTS(SELECT 1 FROM public.ma_offices WHERE id=saved.office_id AND city='Lille' AND NOT is_default AND created_by='staff-257')
    OR EXISTS(SELECT 1 FROM public.ma_contact_office_affiliations WHERE office_id=saved.office_id)
  THEN RAISE EXCEPTION 'new_office_city_readback_failed'; END IF;
END $$;
SELECT public.fixture_directory_reject($q$SELECT public.create_ma_firm_with_first_office(' ', 'Central','Lyon',FALSE,NULL,NULL,NULL,NULL,NULL,'staff-257')$q$,'ma_firm_name_required');
SELECT public.fixture_directory_reject($q$SELECT public.create_ma_firm_with_first_office('Synthetic blank office',' ','Lyon',FALSE,NULL,NULL,NULL,NULL,NULL,'staff-257')$q$,'ma_real_office_name_required');
SELECT public.fixture_directory_reject($q$SELECT public.create_ma_firm_with_first_office('Synthetic whitespace','Central',E'\t\n',FALSE,NULL,NULL,NULL,NULL,NULL,'staff-257')$q$,'ma_office_city_required');
SELECT public.fixture_directory_reject($q$SELECT public.create_ma_firm_with_first_office('Synthetic missing channel','Central','Lyon',TRUE,'Synthetic',NULL,NULL,NULL,NULL,'staff-257')$q$,'ma_contact_channel_required');
SELECT public.fixture_directory_reject($q$SELECT public.create_ma_firm_with_first_office('Synthetic missing name','Central','Lyon',TRUE,NULL,NULL,'synthetic@example.invalid',NULL,NULL,'staff-257')$q$,'ma_contact_requires_name_component');
SELECT public.fixture_directory_reject($q$SELECT public.create_ma_firm_with_first_office('Synthetic invalid email','Central','Lyon',TRUE,'Synthetic',NULL,'invalid','+33 1 00 00 00 00',NULL,'staff-257')$q$,'ma_email_invalid');
SELECT public.fixture_directory_reject($q$SELECT public.create_ma_firm_with_first_office('Synthetic unselected contact','Central','Lyon',FALSE,'Synthetic',NULL,'synthetic@example.invalid',NULL,NULL,'staff-257')$q$,'ma_optional_contact_must_be_explicit');
SELECT public.fixture_directory_reject($q$SELECT public.create_ma_office_for_existing_firm('25700000-0000-4000-8000-000000000001','Missing city',NULL,'staff-257')$q$,'ma_office_city_required');
SELECT public.fixture_directory_reject($q$SELECT public.create_ma_office_for_existing_firm('25700000-0000-4000-8000-000000000001',' synthetic north ','Lille','staff-257')$q$,'ma_real_office_name_already_exists');
DO $$ DECLARE saved RECORD; channel TEXT; BEGIN
  SET LOCAL ROLE service_role;
  FOREACH channel IN ARRAY ARRAY['email','phone'] LOOP
    SELECT * INTO saved FROM public.create_ma_firm_with_first_office('Synthetic first '||channel,'Central','Lyon',TRUE,'Synthetic',NULL,CASE WHEN channel='email' THEN 'synthetic@example.invalid' END,CASE WHEN channel='phone' THEN '+33 1 00 00 00 00' END,'Advisor','staff-257');
    IF NOT EXISTS(SELECT 1 FROM public.ma_contacts c JOIN public.ma_contact_office_affiliations a ON a.contact_id=c.id WHERE c.id=saved.contact_id AND a.id=saved.affiliation_id AND a.office_id=saved.office_id AND a.is_active AND c.created_by='staff-257' AND a.updated_by='staff-257') THEN RAISE EXCEPTION 'first_contact_readback_failed'; END IF;
  END LOOP;
END $$;
DO $$ DECLARE first_person RECORD; second_person RECORD; BEGIN
  SET LOCAL ROLE service_role;
  SELECT * INTO first_person FROM public.create_or_affiliate_ma_contact('25700000-0000-4000-8000-000000000011',NULL,'Shared','One',' SHARED@example.invalid ',NULL,NULL,'staff-257');
  SELECT * INTO second_person FROM public.create_or_affiliate_ma_contact('25700000-0000-4000-8000-000000000011',NULL,'Shared','Two','shared@EXAMPLE.invalid',NULL,NULL,'staff-257');
  IF first_person.contact_id=second_person.contact_id OR NOT public.ma_contact_email_collision(second_person.contact_id) THEN RAISE EXCEPTION 'email_collision_merged_or_unreported'; END IF;
END $$;
SELECT public.fixture_directory_reject($q$SELECT public.create_or_affiliate_ma_contact('25700000-0000-4000-8000-000000000011',NULL,'Synthetic',NULL,NULL,E'\t\n',NULL,'staff-257')$q$,'ma_contact_channel_required');
SELECT public.fixture_directory_reject($q$SELECT public.create_or_affiliate_ma_contact('25700000-0000-4000-8000-000000000099',NULL,'Synthetic',NULL,'synthetic@example.invalid',NULL,NULL,'staff-257')$q$,'ma_contact_affiliation_office_not_found');
SELECT public.fixture_directory_reject($q$SELECT public.update_ma_office_correction('25700000-0000-4000-8000-000000000011','Changed legacy branch',NULL,NULL,NULL,NULL,NULL,NULL,'Changed notes','staff-257')$q$,'ma_office_city_required');
SELECT public.fixture_directory_reject($q$SELECT public.update_ma_office_notes('25700000-0000-4000-8000-000000000011','Notes without completion',NULL,'staff-257')$q$,'ma_office_city_required');
SELECT public.fixture_directory_reject($q$SELECT public.update_ma_contact_with_office_correction('25700000-0000-4000-8000-000000000021','25700000-0000-4000-8000-000000000031','25700000-0000-4000-8000-000000000011','Changed person',NULL,NULL,NULL,NULL,'Changed notes','Changed title','staff-257')$q$,'ma_contact_channel_required');
DO $$ BEGIN
  IF (SELECT to_jsonb(c) FROM public.ma_contacts c WHERE id='25700000-0000-4000-8000-000000000021') IS DISTINCT FROM (SELECT row FROM public.fixture_directory_retained WHERE entity='contact' AND id='25700000-0000-4000-8000-000000000021')
    OR (SELECT to_jsonb(o) FROM public.ma_offices o WHERE id='25700000-0000-4000-8000-000000000011') IS DISTINCT FROM (SELECT row FROM public.fixture_directory_retained WHERE entity='office' AND id='25700000-0000-4000-8000-000000000011')
  THEN RAISE EXCEPTION 'rejected_correction_changed_a_record'; END IF;
  IF EXISTS(SELECT 1 FROM public.ma_firms WHERE name IN ('Synthetic blank office','Synthetic whitespace','Synthetic missing channel','Synthetic missing name','Synthetic invalid email','Synthetic unselected contact')) THEN RAISE EXCEPTION 'partial_graph_left_after_rejection'; END IF;
END $$;
SELECT public.update_ma_firm_correction('25700000-0000-4000-8000-000000000001','Synthetic active firm',NULL,NULL,NULL,'Parent notes','staff-257');
DO $$ BEGIN
  IF (SELECT city FROM public.ma_offices WHERE id='25700000-0000-4000-8000-000000000011') IS NOT NULL OR (SELECT email FROM public.ma_contacts WHERE id='25700000-0000-4000-8000-000000000021') IS NOT NULL THEN RAISE EXCEPTION 'firm_edit_recursively_changed_children'; END IF;
END $$;
SELECT public.update_ma_office_notes('25700000-0000-4000-8000-000000000011','Completed notes','Paris','staff-257');
SELECT public.update_ma_office_notes('25700000-0000-4000-8000-000000000011','Second notes','Stale supplied city','staff-257');
SELECT public.update_ma_contact_with_office_correction('25700000-0000-4000-8000-000000000021','25700000-0000-4000-8000-000000000031','25700000-0000-4000-8000-000000000011','Synthetic legacy person',NULL,NULL,'+33 1 00 00 00 00',NULL,'Completed notes','Advisor','staff-257');
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.ma_offices WHERE id='25700000-0000-4000-8000-000000000011' AND city='Paris' AND is_default AND updated_by='staff-257')
    OR NOT EXISTS(SELECT 1 FROM public.ma_contacts WHERE id='25700000-0000-4000-8000-000000000021' AND phone='+33 1 00 00 00 00' AND updated_by='staff-257')
    OR (SELECT to_jsonb(a) FROM public.ma_contact_office_affiliations a WHERE id='25700000-0000-4000-8000-000000000032') IS DISTINCT FROM (SELECT row FROM public.fixture_directory_retained WHERE entity='affiliation' AND id='25700000-0000-4000-8000-000000000032')
    OR EXISTS(SELECT 1 FROM public.staff_ma_office_intake_projection WHERE office_id='25700000-0000-4000-8000-000000000011')
  THEN RAISE EXCEPTION 'completion_lost_identity_history_audit_or_synthetic_restriction'; END IF;
END $$;
CREATE TABLE public.fixture_directory_corrected AS SELECT to_jsonb(c) AS contact,to_jsonb(a) AS affiliation FROM public.ma_contacts c JOIN public.ma_contact_office_affiliations a ON a.contact_id=c.id WHERE c.id='25700000-0000-4000-8000-000000000021' AND a.is_active;
CREATE FUNCTION public.fixture_directory_fail() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN IF NEW.first_name='Synthetic induced failure' THEN RAISE EXCEPTION 'fixture_induced_persistence_failure'; END IF; RETURN NEW; END $$;
CREATE TRIGGER fixture_directory_fail BEFORE INSERT OR UPDATE ON public.ma_contacts FOR EACH ROW EXECUTE FUNCTION public.fixture_directory_fail();
SELECT public.fixture_directory_reject($q$SELECT public.create_ma_firm_with_first_office('Synthetic atomic failure','Central','Lyon',TRUE,'Synthetic induced failure',NULL,'synthetic@example.invalid',NULL,NULL,'staff-257')$q$,'fixture_induced_persistence_failure');
SELECT public.fixture_directory_reject($q$SELECT public.update_ma_contact_with_office_correction('25700000-0000-4000-8000-000000000021','25700000-0000-4000-8000-000000000031','25700000-0000-4000-8000-000000000011','Synthetic induced failure',NULL,NULL,'+33 1 00 00 00 00',NULL,'Lost notes','Lost title','staff-257')$q$,'fixture_induced_persistence_failure');
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.ma_firms WHERE name='Synthetic atomic failure')
    OR (SELECT to_jsonb(c) FROM public.ma_contacts c WHERE id='25700000-0000-4000-8000-000000000021') IS DISTINCT FROM (SELECT contact FROM public.fixture_directory_corrected)
    OR (SELECT to_jsonb(a) FROM public.ma_contact_office_affiliations a WHERE id='25700000-0000-4000-8000-000000000031') IS DISTINCT FROM (SELECT affiliation FROM public.fixture_directory_corrected)
  THEN RAISE EXCEPTION 'persistence_error_left_partial_graph_or_correction'; END IF;
END $$;
DROP TRIGGER fixture_directory_fail ON public.ma_contacts;
SELECT public.fixture_directory_reject($q$SELECT public.create_or_affiliate_ma_contact((SELECT id FROM public.ma_offices WHERE name='Synthetic North'),'25700000-0000-4000-8000-000000000021',NULL,NULL,NULL,NULL,NULL,'staff-257')$q$,'ma_contact_already_has_active_office');
-- The actual opportunity service still rejects a directory-valid phone-only
-- primary. A referenced primary email and current placement remain guarded.
DO $$ DECLARE office UUID; phone_person RECORD; primary_person RECORD; snapshot JSONB; target_status public.opportunity_status; BEGIN
  SELECT id INTO office FROM public.ma_offices WHERE name='Synthetic North';
  SELECT * INTO phone_person FROM public.create_or_affiliate_ma_contact(office,NULL,'Synthetic phone primary',NULL,NULL,'+33 4 00 00 00 00',NULL,'staff-257');
  INSERT INTO public.opportunities(id,reference,description,created_by) VALUES ('25700000-0000-4000-8000-000000000051','SYNTHETIC-257-PRIMARY','Synthetic directory opportunity exception.','fixture');
  PERFORM public.fixture_directory_reject(FORMAT('SELECT public.save_opportunity_office_context(%L,%L,ARRAY[%L::uuid],%L,%L,%L,%L)','25700000-0000-4000-8000-000000000051',office,phone_person.affiliation_id,phone_person.affiliation_id,'Synthetic directory opportunity exception.','active','staff-257'),'opportunity_activation_requires_usable_primary_email');
  IF (SELECT status FROM public.opportunities WHERE id='25700000-0000-4000-8000-000000000051')<>'draft' OR EXISTS(SELECT 1 FROM public.opportunity_ma_contacts WHERE opportunity_id='25700000-0000-4000-8000-000000000051') THEN RAISE EXCEPTION 'phone_primary_rejection_partially_saved'; END IF;
  SELECT * INTO primary_person FROM public.create_or_affiliate_ma_contact(office,NULL,'Synthetic emailed primary',NULL,'primary@example.invalid',NULL,NULL,'staff-257');
  PERFORM public.save_opportunity_office_context('25700000-0000-4000-8000-000000000051',office,ARRAY[primary_person.affiliation_id],primary_person.affiliation_id,'Synthetic directory opportunity exception.','active','staff-257');
  SELECT to_jsonb(l) INTO snapshot FROM public.opportunity_ma_contacts l WHERE l.opportunity_id='25700000-0000-4000-8000-000000000051';
  FOREACH target_status IN ARRAY ARRAY['active'::public.opportunity_status,'paused'::public.opportunity_status] LOOP
    UPDATE public.opportunities SET status=target_status WHERE id='25700000-0000-4000-8000-000000000051';
    PERFORM public.fixture_directory_reject(FORMAT('SELECT public.update_ma_contact_with_office_correction(%L,%L,%L,%L,NULL,NULL,%L,NULL,NULL,NULL,%L)',primary_person.contact_id,primary_person.affiliation_id,office,'Synthetic emailed primary','+33 4 00 00 00 00','staff-257'),'ma_primary_contact_email_required');
  END LOOP;
  PERFORM public.fixture_directory_reject(FORMAT('SELECT public.update_ma_contact_with_office_correction(%L,%L,%L,%L,NULL,%L,NULL,NULL,NULL,NULL,%L)',primary_person.contact_id,primary_person.affiliation_id,'25700000-0000-4000-8000-000000000011','Synthetic emailed primary','primary@example.invalid','staff-257'),'ma_contact_move_blocked_by_current_opportunity');
  PERFORM public.update_ma_contact_with_office_correction(primary_person.contact_id,primary_person.affiliation_id,office,'Synthetic renamed primary',NULL,'primary@example.invalid',NULL,NULL,'Profile notes','Advisor','staff-257');
  IF snapshot IS DISTINCT FROM (SELECT to_jsonb(l) FROM public.opportunity_ma_contacts l WHERE opportunity_id='25700000-0000-4000-8000-000000000051') OR (SELECT source_office_id FROM public.opportunities WHERE id='25700000-0000-4000-8000-000000000051')<>office THEN RAISE EXCEPTION 'profile_correction_rewrote_opportunity_snapshots_or_source'; END IF;
END $$;

DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.ma_contacts c LEFT JOIN public.ma_contact_office_affiliations a ON a.contact_id=c.id AND a.is_active GROUP BY c.id,c.status HAVING (c.status='active' AND COUNT(a.id)<>1) OR (c.status<>'active' AND COUNT(a.id)<>0)) THEN RAISE EXCEPTION 'directory_single_current_office_invariant_failed'; END IF;
  IF EXISTS(SELECT 1 FROM public.email_logs) THEN RAISE EXCEPTION 'directory_save_created_email'; END IF;
  IF has_function_privilege('anon','public.create_ma_firm_with_first_office(text,text,text,boolean,text,text,text,text,text,text)','EXECUTE')
    OR has_function_privilege('anon','public.normalize_ma_firm_legacy_creation_status()','EXECUTE')
    OR has_function_privilege('authenticated','public.create_ma_office_for_existing_firm(uuid,text,text,text)','EXECUTE')
    OR has_function_privilege('authenticated','public.update_ma_office_notes(uuid,text,text,text)','EXECUTE')
    OR has_function_privilege('service_role','public.create_ma_office_for_existing_firm(uuid,text,text)','EXECUTE')
    OR has_function_privilege('service_role','public.create_ma_firm_with_default_office(text,text,text,text,boolean,text,text,text,text)','EXECUTE')
    OR has_function_privilege('service_role','public.update_ma_contact_correction(uuid,uuid,text,text,text,text,text,text,text,text)','EXECUTE')
  THEN RAISE EXCEPTION 'directory_privilege_or_retired_shortcut_bypass'; END IF;
END $$;
