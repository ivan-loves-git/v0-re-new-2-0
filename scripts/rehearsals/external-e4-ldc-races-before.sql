-- Native metadata-only race setup; actual bytes are separate public-action /
-- physical-file proof and the protected Supabase/browser fixture.
UPDATE public.pursuit_external_handoff_settings SET enabled=true;
UPDATE public.repreneurs SET ldc_url='cvs/76000000-0000-4000-8000-000000000004/ldc/race-C.pdf' WHERE id='76000000-0000-4000-8000-000000000004';
INSERT INTO storage.objects(bucket_id,name,version,metadata)
VALUES('cvs','cvs/76000000-0000-4000-8000-000000000004/ldc/race-C.pdf','source-C',jsonb_build_object('size',100,'mimetype','application/pdf'));
CREATE TABLE public.synthetic_ldc_races(kind text PRIMARY KEY,match_id uuid,opportunity_id uuid,context jsonb,operation_key uuid,stage_id uuid);
DO $$ DECLARE label text; opportunity_id uuid; match_id uuid; operation_key uuid; context jsonb; stage jsonb; counter integer:=300;
BEGIN
  FOREACH label IN ARRAY ARRAY['record-first','cleanup-first','source-first','pause-first','drop-first'] LOOP
    counter:=counter+1;
    opportunity_id:=('25400000-0000-4000-8000-'||lpad(counter::text,12,'0'))::uuid;
    match_id:=('25400000-0000-4000-8000-'||lpad((counter+100)::text,12,'0'))::uuid;
    INSERT INTO public.opportunities(id,reference,status,is_demo,source_office_id,public_title,description,created_by)
    VALUES(opportunity_id,'QA-NATIVE-LDC-RACE-'||counter,'active',false,'76000000-0000-4000-8000-000000000002','Synthetic native LDC race','Synthetic partial Storage metadata','w173-staff');
    INSERT INTO public.opportunity_ma_contacts(opportunity_id,affiliation_id,contact_name_snapshot,is_primary,linked_by)
    VALUES(opportunity_id,'25400000-0000-4000-8000-000000000092','Synthetic source',true,'w173-staff');
    INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,created_by)
    VALUES(match_id,opportunity_id,'76000000-0000-4000-8000-000000000004','interested','w173-staff');
    PERFORM public.journey_start_pursuit(match_id,'w173-staff@example.test','ldc-race-'||label);
    operation_key:=gen_random_uuid();
    context:=jsonb_set(public.journey_external_handoff_context(match_id,'e4'),'{ldc,content_sha256}',to_jsonb(repeat('c',64)));
    stage:=public.journey_stage_external_ldc(match_id,context,operation_key,'w173-staff','w173-staff@example.test');
    INSERT INTO storage.objects(bucket_id,name,version,metadata,user_metadata)
    VALUES('cvs',stage->>'storage_path',gen_random_uuid()::text,jsonb_build_object('size',100,'mimetype','application/pdf'),jsonb_build_object('sha256',repeat('c',64)));
    INSERT INTO public.synthetic_ldc_races VALUES(label,match_id,opportunity_id,context,operation_key,(stage->>'stage_id')::uuid);
  END LOOP;
  SET CONSTRAINTS ALL IMMEDIATE;
END $$;
CREATE FUNCTION public.synthetic_ldc_race_record(p_kind text) RETURNS uuid LANGUAGE sql AS $$
  SELECT public.journey_record_external_handoff(match_id,context,operation_key,current_date-1,NULL,'phone','Synthetic independent LDC race','w173-staff','w173-staff@example.test') FROM public.synthetic_ldc_races WHERE kind=p_kind;
$$;
