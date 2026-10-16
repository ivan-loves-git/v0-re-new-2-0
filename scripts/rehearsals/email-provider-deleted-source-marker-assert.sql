-- Disposable proof for deletion-origin markers. The marker has no customer or
-- provider identifier in clear text, event payload, address, or timestamp.
DO $$
BEGIN
  IF public.email_provider_was_deleted('never-retained-provider') THEN
    RAISE EXCEPTION 'unknown_provider_marked_deleted';
  END IF;

  INSERT INTO public.email_logs(repreneur_id, template_key, resend_id, to_email, subject, status, sent_at)
  VALUES ('22300000-0000-4000-8000-000000000003', 'welcome', 'shared-marker-provider',
    'rep@example.test', 'Shared parent fixture', 'sent', now());
  INSERT INTO public.ma_interactions(
    id, opportunity_id, template_key, recipient_email_snapshot, title, body_markdown,
    channel, direction, delivery_status, provider_message_id
  ) VALUES (
    '24700000-0000-4000-8000-000000000031',
    '22300000-0000-4000-8000-000000000001', 'ma_info_request', 'contact@example.test',
    'Shared parent fixture', 'Fixture', 'email', 'outbound', 'sent', 'shared-marker-provider'
  );
  DELETE FROM public.email_logs WHERE resend_id = 'shared-marker-provider';
  IF public.email_provider_was_deleted('shared-marker-provider') THEN
    RAISE EXCEPTION 'retained_shared_parent_marked_deleted';
  END IF;
  DELETE FROM public.ma_interactions WHERE id = '24700000-0000-4000-8000-000000000031';
  IF NOT public.email_provider_was_deleted('shared-marker-provider') THEN
    RAISE EXCEPTION 'final_parent_not_marked_deleted';
  END IF;

  -- A provider callback after known final deletion is a no-op: no event is
  -- retained and no status can be changed after the parent is gone.
  PERFORM public.email_provider_record_event(
    'deleted-source-callback', 'shared-marker-provider', 'email.opened', now(), 'unknown', NULL
  );
  IF EXISTS (SELECT 1 FROM public.email_provider_events WHERE id = 'deleted-source-callback') THEN
    RAISE EXCEPTION 'deleted_source_callback_retained';
  END IF;

  BEGIN
    PERFORM public.email_provider_record_event(
      'unknown-source-callback', 'unknown-marker-provider', 'email.opened', now(), 'unknown', NULL
    );
    RAISE EXCEPTION 'unknown_missing_parent_acknowledged';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'email_provider_parent_not_yet_retained' THEN
      RAISE;
    END IF;
  END;

  IF (SELECT array_agg(column_name::text ORDER BY ordinal_position)
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'email_provider_deleted_source_markers')
    IS DISTINCT FROM ARRAY['provider_message_hash']::text[] THEN
    RAISE EXCEPTION 'deleted_marker_schema_retains_more_than_hash';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.email_provider_deleted_source_markers
    WHERE provider_message_hash = 'shared-marker-provider'
  ) THEN
    RAISE EXCEPTION 'raw_provider_identifier_retained';
  END IF;
  IF has_table_privilege('anon', 'public.email_provider_deleted_source_markers', 'SELECT')
    OR has_table_privilege('authenticated', 'public.email_provider_deleted_source_markers', 'SELECT')
    OR has_function_privilege('anon', 'public.email_provider_was_deleted(text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.email_provider_was_deleted(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'deleted_marker_private_boundary_missing';
  END IF;
  IF (SELECT count(*) FROM information_schema.triggers
      WHERE trigger_schema = 'public'
        AND trigger_name = 'email_provider_source_delete_lock'
        AND event_manipulation = 'DELETE'
        AND event_object_table IN (
          'email_logs', 'staff_email_reviews', 'ma_interactions', 'opportunity_pursuit_handoff_deliveries'
        )
        AND action_timing = 'BEFORE'
        AND action_orientation = 'STATEMENT') <> 4 THEN
    RAISE EXCEPTION 'source_delete_statement_locks_missing';
  END IF;

  -- A retained parent always wins over an existing old marker. This keeps a
  -- repaired or fixture provider ID fully attributable.
  INSERT INTO public.email_provider_deleted_source_markers(provider_message_hash)
  VALUES (encode(extensions.digest('retained-parent-precedence', 'sha256'), 'hex'));
  INSERT INTO public.email_logs(repreneur_id, template_key, resend_id, to_email, subject, status, sent_at)
  VALUES ('22300000-0000-4000-8000-000000000003', 'welcome', 'retained-parent-precedence',
    'rep@example.test', 'Retained parent precedence', 'sent', now());
  IF public.email_provider_was_deleted('retained-parent-precedence') THEN
    RAISE EXCEPTION 'marker_overrode_retained_parent';
  END IF;
  PERFORM public.email_provider_record_event(
    'retained-parent-precedence-event', 'retained-parent-precedence', 'email.delivered', now(), 'primary', NULL, 'rep@example.test'
  );
  IF NOT EXISTS (SELECT 1 FROM public.email_provider_events WHERE id = 'retained-parent-precedence-event') THEN
    RAISE EXCEPTION 'retained_parent_event_not_recorded';
  END IF;

  -- A non-normalized M&A row is not an operational email parent, even if a
  -- fixture happens to contain a provider-shaped value.
  INSERT INTO public.ma_interactions(
    id, opportunity_id, template_key, recipient_email_snapshot, title, body_markdown,
    channel, direction, delivery_status, provider_message_id
  ) VALUES (
    '24700000-0000-4000-8000-000000000032',
    '22300000-0000-4000-8000-000000000001', 'ma_info_request', 'contact@example.test',
    'Non-email fixture', 'Fixture', 'note', 'outbound', 'sent', 'nonqualifying-ma-provider'
  );
  DELETE FROM public.ma_interactions WHERE id = '24700000-0000-4000-8000-000000000032';
  IF public.email_provider_was_deleted('nonqualifying-ma-provider') THEN
    RAISE EXCEPTION 'nonqualifying_ma_row_marked_deleted';
  END IF;
  BEGIN
    PERFORM public.email_provider_record_event(
      'nonqualifying-ma-event', 'nonqualifying-ma-provider', 'email.delivered', now(), 'primary', NULL, 'contact@example.test'
    );
    RAISE EXCEPTION 'nonqualifying_ma_callback_acknowledged';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'email_provider_parent_not_yet_retained' THEN
      RAISE;
    END IF;
  END;
END $$;
