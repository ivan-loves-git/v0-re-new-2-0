\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END
$$;

CREATE TABLE public.ma_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT,
  last_name TEXT,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  email TEXT,
  internal_notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_by TEXT,
  archived_at TIMESTAMPTZ
);

CREATE TABLE public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE
);

CREATE TABLE public.ma_contact_office_affiliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.ma_contacts(id),
  office_id UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ended_at DATE
);

CREATE TABLE public.opportunity_ma_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id),
  affiliation_id UUID NOT NULL
    REFERENCES public.ma_contact_office_affiliations(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  removed_at TIMESTAMPTZ
);

CREATE TABLE public.ma_source_email_send_reservations (
  opportunity_id UUID PRIMARY KEY REFERENCES public.opportunities(id),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE FUNCTION public.rehearsal_deferred_contact_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END
$$;

CREATE CONSTRAINT TRIGGER rehearsal_deferred_contact_integrity
  AFTER INSERT OR UPDATE OR DELETE ON public.ma_contacts
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.rehearsal_deferred_contact_integrity();

GRANT SELECT, INSERT, UPDATE ON public.ma_contacts TO service_role;
GRANT SELECT ON
  public.opportunities,
  public.ma_contact_office_affiliations,
  public.opportunity_ma_contacts,
  public.ma_source_email_send_reservations
TO service_role;

INSERT INTO public.ma_contacts (
  first_name,
  last_name,
  display_name,
  email,
  internal_notes,
  created_by
)
SELECT
  'Suppressed',
  series::TEXT,
  'Suppressed ' || series::TEXT,
  'suppressed-' || series::TEXT || '@example.test',
  'Email suppressed in the W-010 source snapshot; synthetic rehearsal.',
  'Ivan Paudice via Codex W-010'
FROM generate_series(1, 18) AS series;

INSERT INTO public.ma_contacts (
  first_name,
  last_name,
  display_name,
  email,
  internal_notes,
  created_by
)
VALUES (
  'Allowed',
  'Contact',
  'Allowed Contact',
  'allowed@example.test',
  'Ordinary contact.',
  'W-072 rehearsal'
);

INSERT INTO public.opportunities (reference)
VALUES ('W072-LINKED'), ('W072-UNLINKED');

INSERT INTO public.ma_contact_office_affiliations (
  contact_id,
  office_id
)
SELECT
  contact.id,
  '00000000-0000-4000-8000-000000000072'::UUID
FROM public.ma_contacts contact
WHERE contact.display_name = 'Suppressed 1';

INSERT INTO public.opportunity_ma_contacts (
  opportunity_id,
  affiliation_id
)
SELECT opportunity.id, affiliation.id
FROM public.opportunities opportunity
CROSS JOIN public.ma_contact_office_affiliations affiliation
WHERE opportunity.reference = 'W072-LINKED';

\ir 083_ma_contact_email_suppression.sql

DO $$
DECLARE
  linked_contact UUID;
  linked_opportunity UUID;
  unlinked_opportunity UUID;
  allowed_contact UUID;
  inactive_suppressed_contact UUID;
  operation_key UUID := '00000000-0000-4000-8000-000000000722'::UUID;
  row_count INTEGER;
  allowed BOOLEAN;
BEGIN
  SELECT id INTO linked_contact
  FROM public.ma_contacts
  WHERE display_name = 'Suppressed 1';

  SELECT id INTO linked_opportunity
  FROM public.opportunities
  WHERE reference = 'W072-LINKED';

  SELECT id INTO unlinked_opportunity
  FROM public.opportunities
  WHERE reference = 'W072-UNLINKED';

  SELECT id INTO allowed_contact
  FROM public.ma_contacts
  WHERE display_name = 'Allowed Contact';

  SELECT id INTO inactive_suppressed_contact
  FROM public.ma_contacts
  WHERE display_name = 'Suppressed 18';

  SELECT COUNT(*)::INTEGER INTO row_count
  FROM public.ma_contacts
  WHERE campaign_email_suppressed;
  IF row_count <> 18 THEN
    RAISE EXCEPTION 'w072_fixture_exact_backfill_count_missing';
  END IF;

  SELECT COUNT(*)::INTEGER INTO row_count
  FROM public.ma_contact_email_policy_events
  WHERE source_key = 'w010_import_backfill';
  IF row_count <> 18 THEN
    RAISE EXCEPTION 'w072_fixture_exact_backfill_evidence_missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ma_contacts
    WHERE display_name LIKE 'Suppressed %'
      AND internal_notes NOT LIKE
        'Email suppressed in the W-010 source snapshot;%'
  ) THEN
    RAISE EXCEPTION 'w072_fixture_original_warning_note_changed';
  END IF;

  SELECT public.ma_contact_email_is_allowed(
    linked_contact,
    linked_opportunity,
    'opportunity_nda_request'
  )
  INTO allowed;
  IF allowed IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'w072_fixture_linked_nda_exception_missing';
  END IF;

  SELECT public.ma_contact_email_is_allowed(
    linked_contact,
    linked_opportunity,
    'opportunity_general'
  )
  INTO allowed;
  IF allowed IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'w072_fixture_suppressed_general_send_allowed';
  END IF;

  SELECT public.ma_contact_email_is_allowed(
    linked_contact,
    unlinked_opportunity,
    'opportunity_nda_request'
  )
  INTO allowed;
  IF allowed IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'w072_fixture_unlinked_nda_exception_allowed';
  END IF;

  SELECT public.ma_contact_email_is_allowed(
    allowed_contact,
    NULL,
    'campaign'
  )
  INTO allowed;
  IF allowed IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'w072_fixture_unsuppressed_campaign_blocked';
  END IF;

  SELECT public.ma_contact_email_address_is_suppressed(
    ' SUPPRESSED-1@EXAMPLE.TEST '
  )
  INTO allowed;
  IF allowed IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'w072_fixture_direct_address_bypass_not_blocked';
  END IF;

  SELECT public.ma_contact_email_address_is_suppressed(
    'allowed@example.test'
  )
  INTO allowed;
  IF allowed IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'w072_fixture_allowed_direct_address_blocked';
  END IF;

  UPDATE public.ma_contacts
  SET status = 'inactive'
  WHERE id = inactive_suppressed_contact;

  SELECT public.ma_contact_email_address_is_suppressed(
    'suppressed-18@example.test'
  )
  INTO allowed;
  IF allowed IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'w072_fixture_inactive_direct_address_bypass_allowed';
  END IF;

  PERFORM public.authorize_ma_contact_email_send(
    linked_contact,
    linked_opportunity,
    'opportunity_nda_request',
    'fixture-staff',
    operation_key
  );
  PERFORM public.authorize_ma_contact_email_send(
    linked_contact,
    linked_opportunity,
    'opportunity_nda_request',
    'fixture-staff',
    operation_key
  );

  SELECT COUNT(*)::INTEGER INTO row_count
  FROM public.ma_contact_email_policy_events event
  WHERE event.event_type = 'allowlisted_operational_send'
    AND event.operation_key =
      '00000000-0000-4000-8000-000000000722'::UUID;
  IF row_count <> 1 THEN
    RAISE EXCEPTION 'w072_fixture_exception_audit_not_idempotent';
  END IF;

  BEGIN
    UPDATE public.ma_contacts
    SET campaign_email_suppressed = FALSE
    WHERE id = linked_contact;
    RAISE EXCEPTION 'w072_fixture_direct_suppression_update_succeeded';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE
        '%ma_contact_campaign_email_suppression_requires_service%' THEN
        RAISE;
      END IF;
  END;

  BEGIN
    PERFORM public.set_ma_contact_campaign_email_suppression(
      allowed_contact,
      TRUE,
      'No',
      'fixture-staff'
    );
    RAISE EXCEPTION 'w072_fixture_short_policy_reason_succeeded';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE
        '%ma_contact_campaign_email_suppression_requires_state_actor_and_reason%' THEN
        RAISE;
      END IF;
  END;

  BEGIN
    UPDATE public.ma_contact_email_policy_events
    SET reason = 'Changed'
    WHERE contact_id = linked_contact;
    RAISE EXCEPTION 'w072_fixture_policy_event_update_succeeded';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%ma_contact_email_policy_events_are_immutable%' THEN
        RAISE;
      END IF;
  END;

  INSERT INTO public.ma_source_email_send_reservations (
    opportunity_id,
    expires_at
  )
  VALUES (linked_opportunity, NOW() + INTERVAL '2 minutes');

  BEGIN
    PERFORM public.set_ma_contact_campaign_email_suppression(
      linked_contact,
      FALSE,
      'Fixture removal while delivery is reserved.',
      'fixture-staff'
    );
    RAISE EXCEPTION 'w072_fixture_concurrent_policy_change_succeeded';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE
        '%ma_contact_campaign_email_suppression_change_blocked_during_send%' THEN
        RAISE;
      END IF;
  END;

  DELETE FROM public.ma_source_email_send_reservations
  WHERE opportunity_id = linked_opportunity;

  PERFORM public.set_ma_contact_campaign_email_suppression(
    linked_contact,
    FALSE,
    'Fixture staff confirmed outreach can resume.',
    'fixture-staff'
  );

  SELECT COUNT(*)::INTEGER INTO row_count
  FROM public.ma_contact_email_policy_events
  WHERE contact_id = linked_contact
    AND event_type = 'suppression_removed'
    AND actor = 'fixture-staff'
    AND reason = 'Fixture staff confirmed outreach can resume.';
  IF row_count <> 1 THEN
    RAISE EXCEPTION 'w072_fixture_removal_evidence_missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = 'ma_contact_email_policy_events'
      AND grantee IN ('anon', 'authenticated')
  ) THEN
    RAISE EXCEPTION 'w072_fixture_browser_policy_event_privilege_found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.role_routine_grants
    WHERE routine_schema = 'public'
      AND routine_name IN (
        'ma_contact_email_is_allowed',
        'ma_contact_email_address_is_suppressed',
        'authorize_ma_contact_email_send',
        'set_ma_contact_campaign_email_suppression'
      )
      AND grantee IN ('anon', 'authenticated')
  ) THEN
    RAISE EXCEPTION 'w072_fixture_browser_policy_service_privilege_found';
  END IF;
END
$$;

SELECT 'W-072 disposable rehearsal passed' AS result;
