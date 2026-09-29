DO $$
BEGIN
  IF (SELECT count(DISTINCT purpose_key) FROM public.staff_email_review_queue) <> 9 THEN
    RAISE EXCEPTION 'not_all_sources_and_templates_have_purpose';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.staff_email_review_queue
    WHERE source_kind='ma' AND subject='Validity'
      AND recipient_name='Mira Example' AND company_name='Atlas Example'
      AND purpose_key='ma_validity_check'
  ) THEN RAISE EXCEPTION 'canonical_ma_contact_join_failed'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.staff_email_review_queue
    WHERE source_kind='freshness' AND purpose_key='source_freshness'
      AND recipient_name='Mira Example' AND company_name='Atlas Example'
  ) THEN RAISE EXCEPTION 'group_anchor_contact_join_failed'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.staff_email_review_queue
    WHERE source_kind='e6' AND purpose_key='e6_nda_ready'
      AND recipient_name='Alex Example' AND company_name IS NULL
      AND recipient_avatar_url='https://example.invalid/avatar.png'
  ) THEN RAISE EXCEPTION 'e6_repreneur_identity_or_truthful_company_failed'; END IF;
  IF (SELECT count(*) FROM public.staff_email_review_queue
      WHERE purpose_key='ma_process_follow_up' AND search_text ILIKE '%needle%') <> 30 THEN
    RAISE EXCEPTION 'whole_backlog_filter_failed';
  END IF;
  IF (SELECT count(*) FROM (
    SELECT id FROM public.staff_email_review_queue
    WHERE purpose_key='ma_process_follow_up' AND search_text ILIKE '%needle%'
    ORDER BY created_at DESC, id DESC LIMIT 25 OFFSET 25
  ) page_two) <> 5 THEN RAISE EXCEPTION 'filter_before_pagination_failed'; END IF;
  IF (SELECT id FROM public.staff_email_review_queue WHERE subject='Tie'
      ORDER BY message_sort ASC, created_at DESC, id DESC LIMIT 1)
      <> '22200000-0000-4000-8000-000000000011'::uuid THEN
    RAISE EXCEPTION 'stable_tie_break_failed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.staff_email_review_queue
    WHERE message_sort IS NULL OR purpose_sort IS NULL
       OR recipient_sort IS NULL OR company_sort IS NULL OR created_at IS NULL
  ) THEN RAISE EXCEPTION 'five_sort_keys_incomplete'; END IF;
  IF has_table_privilege('anon','public.staff_email_review_queue','SELECT')
     OR has_table_privilege('authenticated','public.staff_email_review_queue','SELECT')
     OR NOT has_table_privilege('service_role','public.staff_email_review_queue','SELECT') THEN
    RAISE EXCEPTION 'view_acl_failed';
  END IF;
END $$;
