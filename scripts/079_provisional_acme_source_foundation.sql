-- Migration: provisional Acme source foundation and immutable review evidence
--
-- W-064 provisions one shared, operational Acme Co. / Acme Paris source
-- context. It is deliberately not fixture data and it is never a placeholder
-- identity that may be renamed into an intermediary. The only mutable source
-- fact remains opportunities.source_office_id; review-required is computed
-- from that fact plus append-only correction evidence.
--
-- This migration adds no browser route, repreneur projection, external email
-- path, recurring import behaviour or mutable review status. W-065 owns the
-- staff review surface; it can call the narrow resolution primitive below.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ma_provisional_source_contexts (
  context_key TEXT PRIMARY KEY,
  firm_id UUID NOT NULL REFERENCES public.ma_firms(id) ON DELETE RESTRICT,
  office_id UUID NOT NULL UNIQUE REFERENCES public.ma_offices(id) ON DELETE RESTRICT,
  contact_id UUID NOT NULL REFERENCES public.ma_contacts(id) ON DELETE RESTRICT,
  affiliation_id UUID NOT NULL UNIQUE REFERENCES public.ma_contact_office_affiliations(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (context_key = 'acme_co_paris')
);

CREATE TABLE IF NOT EXISTS public.ma_provisional_source_review_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  provisional_office_id UUID NOT NULL REFERENCES public.ma_offices(id) ON DELETE RESTRICT,
  event_kind TEXT NOT NULL CHECK (event_kind IN ('assigned', 'resolved')),
  related_assignment_id UUID REFERENCES public.ma_provisional_source_review_events(id) ON DELETE RESTRICT,
  prior_source_office_id UUID REFERENCES public.ma_offices(id) ON DELETE RESTRICT,
  resulting_source_office_id UUID NOT NULL REFERENCES public.ma_offices(id) ON DELETE RESTRICT,
  prior_source_snapshot JSONB NOT NULL CHECK (JSONB_TYPEOF(prior_source_snapshot) = 'object'),
  prior_contact_snapshot JSONB NOT NULL CHECK (JSONB_TYPEOF(prior_contact_snapshot) = 'array'),
  resulting_source_snapshot JSONB NOT NULL CHECK (JSONB_TYPEOF(resulting_source_snapshot) = 'object'),
  resulting_contact_snapshot JSONB NOT NULL CHECK (JSONB_TYPEOF(resulting_contact_snapshot) = 'array'),
  actor TEXT NOT NULL,
  reason TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (NULLIF(BTRIM(actor), '') IS NOT NULL),
  CHECK (NULLIF(BTRIM(reason), '') IS NOT NULL),
  CHECK (CHAR_LENGTH(reason) <= 4096),
  CHECK (
    (event_kind = 'assigned' AND related_assignment_id IS NULL)
    OR (event_kind = 'resolved' AND related_assignment_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_ma_provisional_source_review_events_opportunity
  ON public.ma_provisional_source_review_events (opportunity_id, occurred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_ma_provisional_source_review_events_related_assignment
  ON public.ma_provisional_source_review_events (related_assignment_id)
  WHERE related_assignment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ma_provisional_source_review_events_one_resolution
  ON public.ma_provisional_source_review_events (related_assignment_id)
  WHERE event_kind = 'resolved';

-- The preflight established exactly one canonical contact and staff identity.
-- A rerun validates the already provisioned context; a new name collision is
-- deliberately a hard stop rather than an automatic merge or reinterpretation.
DO $$
DECLARE
  existing_context public.ma_provisional_source_contexts%ROWTYPE;
  canonical_contact_id UUID;
  staff_identity_count INTEGER;
  matching_contact_count INTEGER;
  matching_firm_count INTEGER;
  matching_office_count INTEGER;
  acme_firm_id UUID;
  acme_office_id UUID;
  acme_affiliation_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('ma-provisional-source-context:acme_co_paris', 76064)
  );

  SELECT *
  INTO existing_context
  FROM public.ma_provisional_source_contexts
  WHERE context_key = 'acme_co_paris'
  FOR KEY SHARE;

  IF existing_context.context_key IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.ma_firms firm
      JOIN public.ma_offices office ON office.id = existing_context.office_id
      JOIN public.ma_contacts contact ON contact.id = existing_context.contact_id
      JOIN public.ma_contact_office_affiliations affiliation
        ON affiliation.id = existing_context.affiliation_id
      WHERE firm.id = existing_context.firm_id
        AND BTRIM(firm.name) = 'Acme Co.'
        AND office.firm_id = firm.id
        AND BTRIM(office.name) = 'Acme Paris'
        AND office.city = 'Paris'
        AND office.status = 'active'
        AND NOT office.is_default
        AND affiliation.contact_id = contact.id
        AND affiliation.office_id = office.id
        AND affiliation.is_active
        AND LOWER(BTRIM(contact.display_name)) = 'bertrand galas'
        AND LOWER(BTRIM(contact.email)) = 'bertrand.galas@edu.escp.eu'
    ) THEN
      RAISE EXCEPTION 'ma_provisional_acme_context_integrity_mismatch';
    END IF;
    RETURN;
  END IF;

  SELECT COUNT(*)
  INTO staff_identity_count
  FROM public.app_user_roles role
  WHERE role.role = 'staff'
    AND LOWER(BTRIM(role.email)) = 'bertrand.galas@edu.escp.eu';

  IF staff_identity_count <> 1 THEN
    RAISE EXCEPTION 'ma_provisional_acme_requires_one_bertrand_staff_identity';
  END IF;

  SELECT COUNT(*)
  INTO matching_contact_count
  FROM public.ma_contacts contact
  WHERE contact.status = 'active'
    AND LOWER(BTRIM(contact.display_name)) = 'bertrand galas'
    AND LOWER(BTRIM(contact.email)) = 'bertrand.galas@edu.escp.eu';

  IF matching_contact_count <> 1 THEN
    RAISE EXCEPTION 'ma_provisional_acme_requires_one_bertrand_contact';
  END IF;

  SELECT contact.id
  INTO canonical_contact_id
  FROM public.ma_contacts contact
  WHERE contact.status = 'active'
    AND LOWER(BTRIM(contact.display_name)) = 'bertrand galas'
    AND LOWER(BTRIM(contact.email)) = 'bertrand.galas@edu.escp.eu';

  SELECT COUNT(*)
  INTO matching_firm_count
  FROM public.ma_firms firm
  WHERE LOWER(BTRIM(firm.name)) = 'acme co.';

  SELECT COUNT(*)
  INTO matching_office_count
  FROM public.ma_offices office
  WHERE LOWER(BTRIM(office.name)) = 'acme paris';

  IF matching_firm_count <> 0 OR matching_office_count <> 0 THEN
    RAISE EXCEPTION 'ma_provisional_acme_identity_collision';
  END IF;

  INSERT INTO public.ma_firms (
    name,
    status,
    created_by,
    updated_by
  ) VALUES (
    'Acme Co.',
    'active',
    'system:w064-acme-foundation',
    'system:w064-acme-foundation'
  )
  RETURNING id INTO acme_firm_id;

  INSERT INTO public.ma_offices (
    firm_id,
    name,
    status,
    is_default,
    city,
    created_by,
    updated_by
  ) VALUES (
    acme_firm_id,
    'Acme Paris',
    'active',
    FALSE,
    'Paris',
    'system:w064-acme-foundation',
    'system:w064-acme-foundation'
  )
  RETURNING id INTO acme_office_id;

  INSERT INTO public.ma_contact_office_affiliations (
    contact_id,
    office_id,
    is_active,
    created_by
  ) VALUES (
    canonical_contact_id,
    acme_office_id,
    TRUE,
    'system:w064-acme-foundation'
  )
  RETURNING id INTO acme_affiliation_id;

  INSERT INTO public.ma_provisional_source_contexts (
    context_key,
    firm_id,
    office_id,
    contact_id,
    affiliation_id
  ) VALUES (
    'acme_co_paris',
    acme_firm_id,
    acme_office_id,
    canonical_contact_id,
    acme_affiliation_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ma_opportunity_source_snapshot(
  p_opportunity_id UUID
)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'source_office_id', opportunity.source_office_id,
    'office_name', office.name,
    'firm_id', firm.id,
    'firm_name', firm.name
  )
  FROM public.opportunities opportunity
  LEFT JOIN public.ma_offices office ON office.id = opportunity.source_office_id
  LEFT JOIN public.ma_firms firm ON firm.id = office.firm_id
  WHERE opportunity.id = p_opportunity_id;
$$;

CREATE OR REPLACE FUNCTION public.ma_opportunity_contact_snapshot(
  p_opportunity_id UUID
)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'opportunity_contact_id', link.id,
        'affiliation_id', affiliation.id,
        'contact_id', contact.id,
        'contact_name', link.contact_name_snapshot,
        'contact_email', link.contact_email_snapshot,
        'contact_phone', link.contact_phone_snapshot,
        'is_primary', link.is_primary
      )
      ORDER BY link.id
    ) FILTER (WHERE link.id IS NOT NULL),
    '[]'::JSONB
  )
  FROM public.opportunities opportunity
  LEFT JOIN public.opportunity_ma_contacts link
    ON link.opportunity_id = opportunity.id
    AND link.is_active
  LEFT JOIN public.ma_contact_office_affiliations affiliation ON affiliation.id = link.affiliation_id
  LEFT JOIN public.ma_contacts contact ON contact.id = affiliation.contact_id
  WHERE opportunity.id = p_opportunity_id;
$$;

CREATE OR REPLACE FUNCTION public.ma_opportunity_source_review_required(
  p_opportunity_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ma_provisional_source_contexts context
    JOIN public.opportunities opportunity ON opportunity.id = p_opportunity_id
    WHERE context.context_key = 'acme_co_paris'
      AND opportunity.source_office_id = context.office_id
  ) OR EXISTS (
    SELECT 1
    FROM public.ma_provisional_source_review_events assignment
    JOIN public.ma_provisional_source_contexts context
      ON context.context_key = 'acme_co_paris'
      AND context.office_id = assignment.provisional_office_id
    WHERE assignment.opportunity_id = p_opportunity_id
      AND assignment.event_kind = 'assigned'
      AND NOT EXISTS (
        SELECT 1
        FROM public.ma_provisional_source_review_events resolution
        WHERE resolution.event_kind = 'resolved'
          AND resolution.related_assignment_id = assignment.id
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.guard_ma_provisional_source_review_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  context_row public.ma_provisional_source_contexts%ROWTYPE;
  assignment_row public.ma_provisional_source_review_events%ROWTYPE;
BEGIN
  SELECT *
  INTO context_row
  FROM public.ma_provisional_source_contexts
  WHERE context_key = 'acme_co_paris'
  FOR KEY SHARE;

  IF context_row.context_key IS NULL
    OR NEW.provisional_office_id <> context_row.office_id THEN
    RAISE EXCEPTION 'ma_provisional_source_review_unknown_context';
  END IF;

  IF NEW.event_kind = 'assigned' THEN
    IF NEW.resulting_source_office_id <> context_row.office_id THEN
      RAISE EXCEPTION 'ma_provisional_source_assignment_requires_acme_office';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.ma_provisional_source_review_events assignment
      WHERE assignment.opportunity_id = NEW.opportunity_id
        AND assignment.provisional_office_id = context_row.office_id
        AND assignment.event_kind = 'assigned'
        AND NOT EXISTS (
          SELECT 1
          FROM public.ma_provisional_source_review_events resolution
          WHERE resolution.event_kind = 'resolved'
            AND resolution.related_assignment_id = assignment.id
        )
    ) THEN
      RAISE EXCEPTION 'ma_provisional_source_assignment_already_unresolved';
    END IF;

    RETURN NEW;
  END IF;

  SELECT *
  INTO assignment_row
  FROM public.ma_provisional_source_review_events assignment
  WHERE assignment.id = NEW.related_assignment_id
    AND assignment.event_kind = 'assigned'
  FOR KEY SHARE;

  IF assignment_row.id IS NULL
    OR assignment_row.opportunity_id <> NEW.opportunity_id
    OR assignment_row.provisional_office_id <> context_row.office_id THEN
    RAISE EXCEPTION 'ma_provisional_source_resolution_requires_matching_assignment';
  END IF;

  IF NEW.resulting_source_office_id = context_row.office_id THEN
    RAISE EXCEPTION 'ma_provisional_source_resolution_requires_real_office';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_ma_provisional_source_review_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'ma_provisional_source_review_events_are_immutable';
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_ma_provisional_source_review_state(
  p_opportunity_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  context_row public.ma_provisional_source_contexts%ROWTYPE;
  opportunity_row public.opportunities%ROWTYPE;
  unresolved_assignment_count INTEGER;
BEGIN
  SELECT *
  INTO context_row
  FROM public.ma_provisional_source_contexts
  WHERE context_key = 'acme_co_paris';

  IF context_row.context_key IS NULL THEN
    RETURN;
  END IF;

  SELECT *
  INTO opportunity_row
  FROM public.opportunities
  WHERE id = p_opportunity_id;

  IF opportunity_row.id IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*)
  INTO unresolved_assignment_count
  FROM public.ma_provisional_source_review_events assignment
  WHERE assignment.opportunity_id = opportunity_row.id
    AND assignment.provisional_office_id = context_row.office_id
    AND assignment.event_kind = 'assigned'
    AND NOT EXISTS (
      SELECT 1
      FROM public.ma_provisional_source_review_events resolution
      WHERE resolution.event_kind = 'resolved'
        AND resolution.related_assignment_id = assignment.id
    );

  IF opportunity_row.source_office_id = context_row.office_id
    AND unresolved_assignment_count <> 1 THEN
    RAISE EXCEPTION 'ma_provisional_source_assignment_requires_immutable_evidence';
  END IF;

  IF opportunity_row.source_office_id IS DISTINCT FROM context_row.office_id
    AND unresolved_assignment_count <> 0 THEN
    RAISE EXCEPTION 'ma_provisional_source_resolution_requires_immutable_evidence';
  END IF;

  IF public.ma_opportunity_source_review_required(opportunity_row.id)
    AND opportunity_row.status IN ('closed', 'archived') THEN
    RAISE EXCEPTION 'ma_provisional_source_review_blocks_opportunity_lifecycle_exit';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_ma_provisional_source_cutover()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IN ('approved', 'activating', 'activated')
    AND EXISTS (
      SELECT 1
      FROM public.opportunities opportunity
      WHERE public.ma_opportunity_source_review_required(opportunity.id)
    ) THEN
    RAISE EXCEPTION 'ma_provisional_source_review_blocks_cutover_treatment';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_ma_provisional_source_review_on_opportunity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  PERFORM public.assert_ma_provisional_source_review_state(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_ma_provisional_source_review_on_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  PERFORM public.assert_ma_provisional_source_review_state(NEW.opportunity_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_acme_provisional_source(
  p_opportunity_id UUID,
  p_actor TEXT,
  p_reason TEXT
)
RETURNS public.opportunities
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  opportunity_row public.opportunities%ROWTYPE;
  context_row public.ma_provisional_source_contexts%ROWTYPE;
  saved_opportunity public.opportunities%ROWTYPE;
  actor TEXT;
  reason TEXT;
  prior_source_snapshot JSONB;
  prior_contact_snapshot JSONB;
BEGIN
  actor := NULLIF(BTRIM(p_actor), '');
  reason := NULLIF(BTRIM(p_reason), '');
  IF actor IS NULL THEN
    RAISE EXCEPTION 'ma_provisional_source_actor_required';
  END IF;
  IF reason IS NULL OR CHAR_LENGTH(reason) > 4096 THEN
    RAISE EXCEPTION 'ma_provisional_source_reason_required';
  END IF;

  -- Preserve the existing office-context lock order: opportunity first, then
  -- the selected office, firm, affiliations and current links inside the W-063 RPC.
  SELECT *
  INTO opportunity_row
  FROM public.opportunities
  WHERE id = p_opportunity_id
  FOR UPDATE;

  IF opportunity_row.id IS NULL THEN
    RAISE EXCEPTION 'opportunity_not_found';
  END IF;
  IF opportunity_row.status NOT IN ('draft', 'active', 'paused') THEN
    RAISE EXCEPTION 'ma_provisional_source_assignment_supports_draft_active_or_paused_only';
  END IF;
  IF public.ma_opportunity_source_review_required(opportunity_row.id) THEN
    RAISE EXCEPTION 'ma_provisional_source_assignment_requires_resolution_first';
  END IF;

  SELECT *
  INTO context_row
  FROM public.ma_provisional_source_contexts
  WHERE context_key = 'acme_co_paris'
  FOR KEY SHARE;

  IF context_row.context_key IS NULL THEN
    RAISE EXCEPTION 'ma_provisional_source_context_missing';
  END IF;

  prior_source_snapshot := public.ma_opportunity_source_snapshot(opportunity_row.id);
  prior_contact_snapshot := public.ma_opportunity_contact_snapshot(opportunity_row.id);

  saved_opportunity := public.save_opportunity_office_context(
    opportunity_row.id,
    context_row.office_id,
    ARRAY[context_row.affiliation_id],
    context_row.affiliation_id,
    NULL,
    opportunity_row.status,
    actor,
    '{}'::JSONB
  );

  INSERT INTO public.ma_provisional_source_review_events (
    opportunity_id,
    provisional_office_id,
    event_kind,
    prior_source_office_id,
    resulting_source_office_id,
    prior_source_snapshot,
    prior_contact_snapshot,
    resulting_source_snapshot,
    resulting_contact_snapshot,
    actor,
    reason
  ) VALUES (
    opportunity_row.id,
    context_row.office_id,
    'assigned',
    opportunity_row.source_office_id,
    saved_opportunity.source_office_id,
    prior_source_snapshot,
    prior_contact_snapshot,
    public.ma_opportunity_source_snapshot(saved_opportunity.id),
    public.ma_opportunity_contact_snapshot(saved_opportunity.id),
    actor,
    reason
  );

  RETURN saved_opportunity;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_acme_provisional_source(
  p_opportunity_id UUID,
  p_replacement_office_id UUID,
  p_affiliation_ids UUID[],
  p_primary_affiliation_id UUID,
  p_actor TEXT,
  p_reason TEXT
)
RETURNS public.opportunities
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  opportunity_row public.opportunities%ROWTYPE;
  context_row public.ma_provisional_source_contexts%ROWTYPE;
  assignment_row public.ma_provisional_source_review_events%ROWTYPE;
  saved_opportunity public.opportunities%ROWTYPE;
  actor TEXT;
  reason TEXT;
  prior_source_snapshot JSONB;
  prior_contact_snapshot JSONB;
BEGIN
  actor := NULLIF(BTRIM(p_actor), '');
  reason := NULLIF(BTRIM(p_reason), '');
  IF actor IS NULL THEN
    RAISE EXCEPTION 'ma_provisional_source_actor_required';
  END IF;
  IF reason IS NULL OR CHAR_LENGTH(reason) > 4096 THEN
    RAISE EXCEPTION 'ma_provisional_source_reason_required';
  END IF;
  IF p_replacement_office_id IS NULL THEN
    RAISE EXCEPTION 'ma_provisional_source_resolution_requires_real_office';
  END IF;

  SELECT *
  INTO opportunity_row
  FROM public.opportunities
  WHERE id = p_opportunity_id
  FOR UPDATE;

  IF opportunity_row.id IS NULL THEN
    RAISE EXCEPTION 'opportunity_not_found';
  END IF;
  IF opportunity_row.status NOT IN ('draft', 'active', 'paused') THEN
    RAISE EXCEPTION 'ma_provisional_source_resolution_supports_draft_active_or_paused_only';
  END IF;

  SELECT *
  INTO context_row
  FROM public.ma_provisional_source_contexts
  WHERE context_key = 'acme_co_paris'
  FOR KEY SHARE;

  IF context_row.context_key IS NULL
    OR opportunity_row.source_office_id IS DISTINCT FROM context_row.office_id THEN
    RAISE EXCEPTION 'ma_provisional_source_resolution_requires_current_acme_source';
  END IF;
  IF p_replacement_office_id = context_row.office_id THEN
    RAISE EXCEPTION 'ma_provisional_source_resolution_requires_real_office';
  END IF;

  SELECT *
  INTO assignment_row
  FROM public.ma_provisional_source_review_events assignment
  WHERE assignment.opportunity_id = opportunity_row.id
    AND assignment.provisional_office_id = context_row.office_id
    AND assignment.event_kind = 'assigned'
    AND NOT EXISTS (
      SELECT 1
      FROM public.ma_provisional_source_review_events resolution
      WHERE resolution.event_kind = 'resolved'
        AND resolution.related_assignment_id = assignment.id
    )
  ORDER BY assignment.occurred_at DESC, assignment.id DESC
  LIMIT 1
  FOR UPDATE;

  IF assignment_row.id IS NULL THEN
    RAISE EXCEPTION 'ma_provisional_source_resolution_requires_assignment_evidence';
  END IF;

  prior_source_snapshot := public.ma_opportunity_source_snapshot(opportunity_row.id);
  prior_contact_snapshot := public.ma_opportunity_contact_snapshot(opportunity_row.id);

  saved_opportunity := public.save_opportunity_office_context(
    opportunity_row.id,
    p_replacement_office_id,
    p_affiliation_ids,
    p_primary_affiliation_id,
    NULL,
    opportunity_row.status,
    actor,
    '{}'::JSONB
  );

  INSERT INTO public.ma_provisional_source_review_events (
    opportunity_id,
    provisional_office_id,
    event_kind,
    related_assignment_id,
    prior_source_office_id,
    resulting_source_office_id,
    prior_source_snapshot,
    prior_contact_snapshot,
    resulting_source_snapshot,
    resulting_contact_snapshot,
    actor,
    reason
  ) VALUES (
    opportunity_row.id,
    context_row.office_id,
    'resolved',
    assignment_row.id,
    opportunity_row.source_office_id,
    saved_opportunity.source_office_id,
    prior_source_snapshot,
    prior_contact_snapshot,
    public.ma_opportunity_source_snapshot(saved_opportunity.id),
    public.ma_opportunity_contact_snapshot(saved_opportunity.id),
    actor,
    reason
  );

  RETURN saved_opportunity;
END;
$$;

ALTER TABLE public.ma_provisional_source_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ma_provisional_source_review_events ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS guard_ma_provisional_source_review_event_insert
  ON public.ma_provisional_source_review_events;
CREATE TRIGGER guard_ma_provisional_source_review_event_insert
  BEFORE INSERT ON public.ma_provisional_source_review_events
  FOR EACH ROW EXECUTE FUNCTION public.guard_ma_provisional_source_review_event();

DROP TRIGGER IF EXISTS prevent_ma_provisional_source_review_event_update
  ON public.ma_provisional_source_review_events;
CREATE TRIGGER prevent_ma_provisional_source_review_event_update
  BEFORE UPDATE ON public.ma_provisional_source_review_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_ma_provisional_source_review_event_mutation();

DROP TRIGGER IF EXISTS prevent_ma_provisional_source_review_event_delete
  ON public.ma_provisional_source_review_events;
CREATE TRIGGER prevent_ma_provisional_source_review_event_delete
  BEFORE DELETE ON public.ma_provisional_source_review_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_ma_provisional_source_review_event_mutation();

DROP TRIGGER IF EXISTS enforce_ma_provisional_source_review_on_opportunity
  ON public.opportunities;
CREATE CONSTRAINT TRIGGER enforce_ma_provisional_source_review_on_opportunity
  AFTER INSERT OR UPDATE OF source_office_id, status ON public.opportunities
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ma_provisional_source_review_on_opportunity();

DROP TRIGGER IF EXISTS enforce_ma_provisional_source_review_on_event
  ON public.ma_provisional_source_review_events;
CREATE CONSTRAINT TRIGGER enforce_ma_provisional_source_review_on_event
  AFTER INSERT ON public.ma_provisional_source_review_events
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ma_provisional_source_review_on_event();

DROP TRIGGER IF EXISTS guard_ma_provisional_source_cutover_on_run
  ON public.ma_cutover_runs;
CREATE CONSTRAINT TRIGGER guard_ma_provisional_source_cutover_on_run
  AFTER UPDATE OF status ON public.ma_cutover_runs
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.guard_ma_provisional_source_cutover();

REVOKE ALL ON TABLE
  public.ma_provisional_source_contexts,
  public.ma_provisional_source_review_events
FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE
  public.ma_provisional_source_contexts,
  public.ma_provisional_source_review_events
TO service_role;

REVOKE ALL ON FUNCTION public.ma_opportunity_source_snapshot(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ma_opportunity_contact_snapshot(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ma_opportunity_source_review_required(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_ma_provisional_source_review_event() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.prevent_ma_provisional_source_review_event_mutation() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.assert_ma_provisional_source_review_state(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_ma_provisional_source_cutover() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.enforce_ma_provisional_source_review_on_opportunity() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.enforce_ma_provisional_source_review_on_event() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.assign_acme_provisional_source(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.resolve_acme_provisional_source(UUID, UUID, UUID[], UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ma_opportunity_source_review_required(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.assign_acme_provisional_source(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_acme_provisional_source(UUID, UUID, UUID[], UUID, TEXT, TEXT) TO service_role;

COMMENT ON TABLE public.ma_provisional_source_contexts IS
  'Staff-only fixed W-064 provisional source context. Acme Co. and Acme Paris are operational context, not test data and never an intermediary alias.';
COMMENT ON TABLE public.ma_provisional_source_review_events IS
  'Staff-only immutable W-064 provisional source assignment and resolution evidence. Review required is computed; no mutable review status exists.';
COMMENT ON FUNCTION public.assign_acme_provisional_source(UUID, TEXT, TEXT) IS
  'Service-role-only W-064 audited Acme assignment. Reuses canonical office/contact validation and creates immutable before/after evidence.';
COMMENT ON FUNCTION public.resolve_acme_provisional_source(UUID, UUID, UUID[], UUID, TEXT, TEXT) IS
  'Service-role-only W-064 resolution primitive for the later W-065 staff workflow. Reuses canonical office/contact validation and appends immutable correction evidence.';

COMMIT;
