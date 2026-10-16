-- Extend the existing disposable lifecycle snapshot with the later mail seams.
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS auto_send boolean NOT NULL DEFAULT false;
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS body_markdown text;
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS body_editable boolean NOT NULL DEFAULT false;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS public_title text;
CREATE TABLE IF NOT EXISTS public.opportunity_interest_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),match_id uuid NOT NULL REFERENCES public.opportunity_matches(id),
 event_type text NOT NULL,interest_expressed_at timestamptz
);
SET session_replication_role=replica;
INSERT INTO public.repreneurs(id,email,first_name,last_name,is_demo) VALUES
 ('26000000-0000-4000-8000-000000000011','pause-interest@re-new.invalid','Interested','Synthetic',false),
 ('26000000-0000-4000-8000-000000000012','pause-pursuit@re-new.invalid','Pursuing','Synthetic',false),
 ('26000000-0000-4000-8000-000000000013','pause-proposed@re-new.invalid','Proposed','Synthetic',false),
 ('26000000-0000-4000-8000-000000000014','pause-rejected@re-new.invalid','Rejected','Synthetic',false),
 ('26000000-0000-4000-8000-000000000015','pause-declined@re-new.invalid','Declined','Synthetic',false),
 ('26000000-0000-4000-8000-000000000016','pause-demo@re-new.invalid','Demo','Synthetic',true);
INSERT INTO public.opportunities(id,reference,status,source_office_id,description,public_title,is_demo,created_by)
SELECT id,'PRIVATE INTERNAL REFERENCE '||id::text,'active','25200000-0000-4000-8000-000000000031','PRIVATE INTERNAL DESCRIPTION','Public project',false,'fixture'
FROM unnest(ARRAY['26000000-0000-4000-8000-000000000101'::uuid,'26000000-0000-4000-8000-000000000102'::uuid]) id;
INSERT INTO public.opportunity_ma_contacts(opportunity_id,affiliation_id,is_primary,is_active,linked_by)
SELECT id,'25200000-0000-4000-8000-000000000041',true,true,'fixture' FROM public.opportunities WHERE id IN
 ('26000000-0000-4000-8000-000000000101','26000000-0000-4000-8000-000000000102');
INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,pursuit_stage,created_by) VALUES
 ('26000000-0000-4000-8000-000000000201','26000000-0000-4000-8000-000000000101','26000000-0000-4000-8000-000000000011','interested',null,'fixture'),
 ('26000000-0000-4000-8000-000000000202','26000000-0000-4000-8000-000000000101','26000000-0000-4000-8000-000000000012','active_pursuit','interest','fixture'),
 ('26000000-0000-4000-8000-000000000203','26000000-0000-4000-8000-000000000101','26000000-0000-4000-8000-000000000013','proposed',null,'fixture'),
 ('26000000-0000-4000-8000-000000000204','26000000-0000-4000-8000-000000000101','26000000-0000-4000-8000-000000000014','interested',null,'fixture'),
 ('26000000-0000-4000-8000-000000000205','26000000-0000-4000-8000-000000000101','26000000-0000-4000-8000-000000000015','declined',null,'fixture'),
 ('26000000-0000-4000-8000-000000000206','26000000-0000-4000-8000-000000000101','26000000-0000-4000-8000-000000000016','interested',null,'fixture');
INSERT INTO public.opportunity_interest_events(match_id,event_type) VALUES ('26000000-0000-4000-8000-000000000204','rejected');
SET session_replication_role=origin;
-- A real old pause event precedes the new migration and must not be replayed.
SELECT public.pause_opportunity_with_reason('26000000-0000-4000-8000-000000000102','paused_cabinet','staff-252',null);
