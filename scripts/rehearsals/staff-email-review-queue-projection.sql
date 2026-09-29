-- Synthetic schema and rows for the #221/#222 read projection only.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE TABLE public.ma_firms (id uuid PRIMARY KEY, name text);
CREATE TABLE public.ma_offices (id uuid PRIMARY KEY, firm_id uuid, name text);
CREATE TABLE public.ma_contacts (id uuid PRIMARY KEY, display_name text);
CREATE TABLE public.ma_contact_office_affiliations (id uuid PRIMARY KEY, contact_id uuid, office_id uuid);
CREATE TABLE public.opportunity_ma_contacts (id uuid PRIMARY KEY, affiliation_id uuid);
CREATE TABLE public.repreneurs (id uuid PRIMARY KEY, first_name text, last_name text, avatar_url text);
CREATE TABLE public.opportunity_matches (id uuid PRIMARY KEY, repreneur_id uuid);
CREATE TABLE public.staff_email_reviews (
  id uuid PRIMARY KEY, source_kind text, template_key text, subject text, body_text text,
  recipient_email text, namespace text, state text, version integer, created_at timestamptz,
  contact_link_id uuid, match_id uuid
);
ALTER TABLE public.staff_email_reviews ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO service_role;

INSERT INTO public.ma_firms VALUES ('22100000-0000-4000-8000-000000000001','Atlas Example');
INSERT INTO public.ma_offices VALUES ('22100000-0000-4000-8000-000000000002','22100000-0000-4000-8000-000000000001','Paris');
INSERT INTO public.ma_contacts VALUES ('22100000-0000-4000-8000-000000000003','Mira Example');
INSERT INTO public.ma_contact_office_affiliations VALUES
  ('22100000-0000-4000-8000-000000000004','22100000-0000-4000-8000-000000000003','22100000-0000-4000-8000-000000000002');
INSERT INTO public.opportunity_ma_contacts VALUES ('22100000-0000-4000-8000-000000000005','22100000-0000-4000-8000-000000000004');
INSERT INTO public.repreneurs VALUES
  ('22100000-0000-4000-8000-000000000006','Alex','Example','https://example.invalid/avatar.png');
INSERT INTO public.opportunity_matches VALUES
  ('22100000-0000-4000-8000-000000000007','22100000-0000-4000-8000-000000000006');

INSERT INTO public.staff_email_reviews
  (id,source_kind,template_key,subject,body_text,recipient_email,namespace,state,version,created_at,contact_link_id,match_id)
VALUES
  ('22200000-0000-4000-8000-000000000001','ma','ma_opportunity_validity_check','Validity','Check status','mira@example.invalid','REAL','pending',1,'2026-09-24T10:00:00Z','22100000-0000-4000-8000-000000000005',NULL),
  ('22200000-0000-4000-8000-000000000002','ma','ma_request_more_information','Information','More detail','mira@example.invalid','REAL','pending',1,'2026-09-24T10:00:01Z','22100000-0000-4000-8000-000000000005',NULL),
  ('22200000-0000-4000-8000-000000000003','ma','ma_repreneur_interest_feedback','Interest','Response','mira@example.invalid','REAL','sent',2,'2026-09-24T10:00:02Z','22100000-0000-4000-8000-000000000005',NULL),
  ('22200000-0000-4000-8000-000000000004','ma','ma_nda_info_memo_request','NDA and memo','Documents','mira@example.invalid','REAL','pending',1,'2026-09-24T10:00:03Z','22100000-0000-4000-8000-000000000005',NULL),
  ('22200000-0000-4000-8000-000000000005','ma','ma_process_follow_up','Follow-up','Timeline','mira@example.invalid','REAL','pending',1,'2026-09-24T10:00:04Z','22100000-0000-4000-8000-000000000005',NULL),
  ('22200000-0000-4000-8000-000000000006','e4','ma_nda_info_memo_request','E4','Qualification','mira@example.invalid','REAL','pending',1,'2026-09-24T10:00:05Z','22100000-0000-4000-8000-000000000005',NULL),
  ('22200000-0000-4000-8000-000000000007','e6','code:e6_nda_ready','E6','Ready','alex@example.invalid','REAL','pending',1,'2026-09-24T10:00:06Z',NULL,'22100000-0000-4000-8000-000000000007'),
  ('22200000-0000-4000-8000-000000000008','e7','ma_nda_info_memo_request','E7','Copies','mira@example.invalid','REAL','pending',1,'2026-09-24T10:00:07Z','22100000-0000-4000-8000-000000000005',NULL),
  ('22200000-0000-4000-8000-000000000009','freshness','ma_opportunity_validity_check','Freshness','Group contact','mira@example.invalid','REAL','pending',1,'2026-09-24T10:00:08Z','22100000-0000-4000-8000-000000000005',NULL),
  ('22200000-0000-4000-8000-000000000010','ma','ma_process_follow_up','Tie','One','mira@example.invalid','REAL','pending',1,'2026-09-24T11:00:00Z','22100000-0000-4000-8000-000000000005',NULL),
  ('22200000-0000-4000-8000-000000000011','ma','ma_process_follow_up','Tie','Two','mira@example.invalid','REAL','pending',1,'2026-09-24T11:00:00Z','22100000-0000-4000-8000-000000000005',NULL);

INSERT INTO public.staff_email_reviews
  (id,source_kind,template_key,subject,body_text,recipient_email,namespace,state,version,created_at,contact_link_id)
SELECT ('22300000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  'ma','ma_process_follow_up','Needle ' || n,'Body ' || n,
  'mira@example.invalid','REAL','pending',1,
  '2026-09-25T10:00:00Z'::timestamptz + n * interval '1 second',
  '22100000-0000-4000-8000-000000000005'::uuid
FROM generate_series(1,30) n;
