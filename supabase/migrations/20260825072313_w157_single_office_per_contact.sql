-- W-157: one current office per active canonical M&A contact.
--
-- Historical affiliations remain immutable relationship evidence. This
-- migration ends only surplus active rows, using a deterministic evidence-
-- first choice, then makes one active office a database invariant. Staff can
-- correct a placement through one atomic service that ends the current row and
-- creates a new one without rewriting opportunity or interaction history.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.ma_contacts contact
    LEFT JOIN public.ma_contact_office_affiliations affiliation
      ON affiliation.contact_id = contact.id
      AND affiliation.is_active
    WHERE contact.status = 'active'
    GROUP BY contact.id
    HAVING COUNT(affiliation.id) = 0
  ) THEN
    RAISE EXCEPTION 'w157_active_contact_without_office_preflight';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ma_contacts contact
    JOIN public.ma_contact_office_affiliations affiliation
      ON affiliation.contact_id = contact.id
      AND affiliation.is_active
    WHERE contact.status <> 'active'
  ) THEN
    RAISE EXCEPTION 'w157_inactive_contact_with_active_office_preflight';
  END IF;
END;
$$;

CREATE TEMP TABLE w157_contact_office_winners AS
WITH affiliation_evidence AS (
  SELECT
    affiliation.id,
    affiliation.contact_id,
    affiliation.office_id,
    affiliation.created_at,
    office.is_default,
    CASE firm.status
      WHEN 'active' THEN 2
      WHEN 'prospect' THEN 1
      ELSE 0
    END AS firm_status_rank,
    CASE
      WHEN LOWER(BTRIM(office.name)) = LOWER(BTRIM(firm.name)) THEN 1
      ELSE 0
    END AS central_office_rank,
    (
      SELECT COUNT(*)
      FROM public.opportunity_ma_contacts link
      JOIN public.opportunities opportunity
        ON opportunity.id = link.opportunity_id
      WHERE link.affiliation_id = affiliation.id
        AND link.is_active
        AND opportunity.status NOT IN ('closed', 'archived')
    ) AS live_opportunity_links,
    (
      SELECT COUNT(*)
      FROM public.opportunity_ma_contacts link
      WHERE link.affiliation_id = affiliation.id
        AND link.is_active
    ) AS active_opportunity_links,
    (
      SELECT COUNT(*)
      FROM public.ma_interactions interaction
      WHERE interaction.affiliation_id = affiliation.id
    ) AS interaction_count,
    (
      SELECT COUNT(*)
      FROM public.ma_source_contacts legacy_contact
      WHERE legacy_contact.office_affiliation_id = affiliation.id
    ) AS legacy_contact_links
  FROM public.ma_contact_office_affiliations affiliation
  JOIN public.ma_offices office ON office.id = affiliation.office_id
  JOIN public.ma_firms firm ON firm.id = office.firm_id
  WHERE affiliation.is_active
), ranked AS (
  SELECT
    evidence.*,
    ROW_NUMBER() OVER (
      PARTITION BY evidence.contact_id
      ORDER BY
        evidence.live_opportunity_links DESC,
        evidence.active_opportunity_links DESC,
        evidence.interaction_count DESC,
        evidence.firm_status_rank DESC,
        evidence.central_office_rank DESC,
        evidence.legacy_contact_links DESC,
        evidence.is_default ASC,
        evidence.created_at DESC,
        evidence.id
    ) AS preference_rank,
    COUNT(*) OVER (PARTITION BY evidence.contact_id) AS active_office_count
  FROM affiliation_evidence evidence
)
SELECT
  contact_id,
  id AS affiliation_id,
  office_id
FROM ranked
WHERE active_office_count > 1
  AND preference_rank = 1;

DO $$
BEGIN
  -- A current opportunity may not silently lose its contact context. If live
  -- data drifts after preflight, fail the whole migration for human review.
  IF EXISTS (
    SELECT 1
    FROM public.ma_contact_office_affiliations affiliation
    JOIN w157_contact_office_winners winner
      ON winner.contact_id = affiliation.contact_id
      AND winner.affiliation_id <> affiliation.id
    JOIN public.opportunity_ma_contacts link
      ON link.affiliation_id = affiliation.id
      AND link.is_active
    JOIN public.opportunities opportunity
      ON opportunity.id = link.opportunity_id
    WHERE affiliation.is_active
      AND opportunity.status NOT IN ('closed', 'archived')
  ) THEN
    RAISE EXCEPTION 'w157_multi_office_contact_has_live_opportunity_conflict';
  END IF;
END;
$$;

UPDATE public.ma_contact_office_affiliations affiliation
SET
  is_active = FALSE,
  ended_at = CURRENT_DATE,
  ended_by = 'w157-normalization:evidence-first-v1',
  updated_by = 'w157-normalization:evidence-first-v1',
  updated_at = CLOCK_TIMESTAMP()
FROM w157_contact_office_winners winner
WHERE affiliation.contact_id = winner.contact_id
  AND affiliation.id <> winner.affiliation_id
  AND affiliation.is_active;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.ma_contacts contact
    LEFT JOIN public.ma_contact_office_affiliations affiliation
      ON affiliation.contact_id = contact.id
      AND affiliation.is_active
    GROUP BY contact.id, contact.status
    HAVING
      (contact.status = 'active' AND COUNT(affiliation.id) <> 1)
      OR (contact.status <> 'active' AND COUNT(affiliation.id) <> 0)
  ) THEN
    RAISE EXCEPTION 'w157_single_office_normalization_failed';
  END IF;
END;
$$;

-- The normalization update queues the existing deferred opportunity-context
-- triggers. Flush those validations before creating an index on the same
-- table, then restore deferred mode for the new transaction-level invariant.
-- This keeps the migration compatible with Supabase's single-transaction
-- execution while still rolling everything back on any invalid relationship.
SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ma_contact_office_affiliations_one_active_contact
  ON public.ma_contact_office_affiliations(contact_id)
  WHERE is_active;

CREATE OR REPLACE FUNCTION public.assert_ma_contact_single_active_office(
  p_contact_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  contact_status TEXT;
  active_office_count INTEGER;
BEGIN
  SELECT contact.status
  INTO contact_status
  FROM public.ma_contacts contact
  WHERE contact.id = p_contact_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COUNT(*)
  INTO active_office_count
  FROM public.ma_contact_office_affiliations affiliation
  WHERE affiliation.contact_id = p_contact_id
    AND affiliation.is_active;

  IF contact_status = 'active' AND active_office_count <> 1 THEN
    RAISE EXCEPTION 'ma_active_contact_requires_exactly_one_active_office';
  END IF;

  IF contact_status <> 'active' AND active_office_count <> 0 THEN
    RAISE EXCEPTION 'ma_inactive_contact_cannot_have_active_office';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_ma_contact_single_active_office()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_TABLE_NAME = 'ma_contact_office_affiliations' THEN
    IF TG_OP <> 'INSERT' THEN
      PERFORM public.assert_ma_contact_single_active_office(OLD.contact_id);
    END IF;
    IF TG_OP <> 'DELETE'
      AND (TG_OP = 'INSERT' OR NEW.contact_id IS DISTINCT FROM OLD.contact_id) THEN
      PERFORM public.assert_ma_contact_single_active_office(NEW.contact_id);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.assert_ma_contact_single_active_office(OLD.id);
  ELSE
    PERFORM public.assert_ma_contact_single_active_office(NEW.id);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_ma_contact_single_active_office_on_affiliation
  ON public.ma_contact_office_affiliations;
CREATE CONSTRAINT TRIGGER enforce_ma_contact_single_active_office_on_affiliation
  AFTER INSERT OR UPDATE OR DELETE
  ON public.ma_contact_office_affiliations
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_ma_contact_single_active_office();

DROP TRIGGER IF EXISTS enforce_ma_contact_single_active_office_on_contact
  ON public.ma_contacts;
CREATE CONSTRAINT TRIGGER enforce_ma_contact_single_active_office_on_contact
  AFTER INSERT OR UPDATE OR DELETE
  ON public.ma_contacts
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_ma_contact_single_active_office();

CREATE OR REPLACE FUNCTION public.create_or_affiliate_ma_contact(
  p_office_id UUID,
  p_existing_contact_id UUID DEFAULT NULL,
  p_contact_first_name TEXT DEFAULT NULL,
  p_contact_last_name TEXT DEFAULT NULL,
  p_contact_email TEXT DEFAULT NULL,
  p_contact_phone TEXT DEFAULT NULL,
  p_contact_job_title TEXT DEFAULT NULL,
  p_actor TEXT DEFAULT NULL
)
RETURNS TABLE (contact_id UUID, affiliation_id UUID)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  actor TEXT;
  contact_first_name TEXT;
  contact_last_name TEXT;
  contact_email TEXT;
  contact_phone TEXT;
  office_row public.ma_offices%ROWTYPE;
  firm_row public.ma_firms%ROWTYPE;
  contact_row public.ma_contacts%ROWTYPE;
  resolved_contact_id UUID;
  created_affiliation_id UUID;
  current_affiliation_id UUID;
  current_office_id UUID;
BEGIN
  actor := NULLIF(BTRIM(p_actor), '');
  contact_first_name := NULLIF(BTRIM(p_contact_first_name), '');
  contact_last_name := NULLIF(BTRIM(p_contact_last_name), '');
  contact_email := NULLIF(BTRIM(p_contact_email), '');
  contact_phone := NULLIF(BTRIM(p_contact_phone), '');

  IF actor IS NULL THEN
    RAISE EXCEPTION 'ma_contact_affiliation_actor_required';
  END IF;

  SELECT *
  INTO office_row
  FROM public.ma_offices
  WHERE id = p_office_id
  FOR UPDATE;

  IF office_row.id IS NULL THEN
    RAISE EXCEPTION 'ma_contact_affiliation_office_not_found';
  END IF;
  IF office_row.status <> 'active' THEN
    RAISE EXCEPTION 'ma_contact_affiliation_requires_active_office';
  END IF;

  SELECT *
  INTO firm_row
  FROM public.ma_firms
  WHERE id = office_row.firm_id
  FOR SHARE;

  IF firm_row.id IS NULL OR firm_row.status = 'archived' THEN
    RAISE EXCEPTION 'ma_contact_affiliation_requires_non_archived_firm';
  END IF;

  IF p_existing_contact_id IS NOT NULL THEN
    IF contact_first_name IS NOT NULL
      OR contact_last_name IS NOT NULL
      OR contact_email IS NOT NULL
      OR contact_phone IS NOT NULL THEN
      RAISE EXCEPTION 'ma_existing_contact_affiliation_must_not_supply_identity_fields';
    END IF;

    SELECT *
    INTO contact_row
    FROM public.ma_contacts
    WHERE id = p_existing_contact_id
    FOR UPDATE;

    IF contact_row.id IS NULL THEN
      RAISE EXCEPTION 'ma_contact_not_found';
    END IF;
    IF contact_row.status <> 'active' THEN
      RAISE EXCEPTION 'ma_contact_affiliation_requires_active_contact';
    END IF;

    resolved_contact_id := contact_row.id;

    SELECT affiliation.id, affiliation.office_id
    INTO current_affiliation_id, current_office_id
    FROM public.ma_contact_office_affiliations affiliation
    WHERE affiliation.contact_id = resolved_contact_id
      AND affiliation.is_active
    FOR UPDATE;

    IF current_affiliation_id IS NOT NULL THEN
      IF current_office_id = office_row.id THEN
        RAISE EXCEPTION 'ma_contact_office_affiliation_already_active';
      END IF;
      RAISE EXCEPTION 'ma_contact_already_has_active_office';
    END IF;
  ELSE
    IF contact_first_name IS NULL AND contact_last_name IS NULL THEN
      RAISE EXCEPTION 'ma_contact_requires_name_component';
    END IF;

    INSERT INTO public.ma_contacts (
      first_name,
      last_name,
      email,
      phone,
      created_by,
      updated_by
    ) VALUES (
      contact_first_name,
      contact_last_name,
      contact_email,
      contact_phone,
      actor,
      actor
    )
    RETURNING id INTO resolved_contact_id;
  END IF;

  INSERT INTO public.ma_contact_office_affiliations (
    contact_id,
    office_id,
    job_title,
    created_by,
    updated_by
  ) VALUES (
    resolved_contact_id,
    office_row.id,
    NULLIF(BTRIM(p_contact_job_title), ''),
    actor,
    actor
  )
  RETURNING id INTO created_affiliation_id;

  RETURN QUERY
  SELECT resolved_contact_id, created_affiliation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_ma_contact_with_office_correction(
  p_contact_id UUID,
  p_current_affiliation_id UUID,
  p_target_office_id UUID,
  p_first_name TEXT,
  p_last_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_linkedin_url TEXT,
  p_internal_notes TEXT,
  p_job_title TEXT,
  p_actor TEXT
)
RETURNS TABLE (
  contact_id UUID,
  affiliation_id UUID,
  office_id UUID,
  updated_at TIMESTAMPTZ,
  updated_by TEXT
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_first_name TEXT := NULLIF(BTRIM(p_first_name), '');
  v_last_name TEXT := NULLIF(BTRIM(p_last_name), '');
  v_email TEXT := NULLIF(LOWER(BTRIM(p_email)), '');
  v_actor TEXT := NULLIF(BTRIM(p_actor), '');
  target_office public.ma_offices%ROWTYPE;
  contact_row public.ma_contacts%ROWTYPE;
  current_affiliation public.ma_contact_office_affiliations%ROWTYPE;
  saved_affiliation_id UUID;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'ma_identity_actor_required';
  END IF;
  IF p_contact_id IS NULL OR (v_first_name IS NULL AND v_last_name IS NULL) THEN
    RAISE EXCEPTION 'ma_contact_name_required';
  END IF;
  IF v_email IS NOT NULL
    AND v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'ma_email_invalid';
  END IF;
  IF p_linkedin_url IS NOT NULL
    AND BTRIM(p_linkedin_url) <> ''
    AND BTRIM(p_linkedin_url) !~* '^https?://[^[:space:]]+$' THEN
    RAISE EXCEPTION 'ma_linkedin_url_invalid';
  END IF;

  SELECT *
  INTO target_office
  FROM public.ma_offices office
  WHERE office.id = p_target_office_id
  FOR UPDATE;

  IF target_office.id IS NULL THEN
    RAISE EXCEPTION 'ma_contact_target_office_not_found';
  END IF;
  IF target_office.status <> 'active' THEN
    RAISE EXCEPTION 'ma_contact_target_office_must_be_active';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.ma_firms firm
    WHERE firm.id = target_office.firm_id
      AND firm.status <> 'archived'
  ) THEN
    RAISE EXCEPTION 'ma_contact_target_firm_must_be_current';
  END IF;

  SELECT *
  INTO contact_row
  FROM public.ma_contacts contact
  WHERE contact.id = p_contact_id
  FOR UPDATE;

  IF contact_row.id IS NULL THEN
    RAISE EXCEPTION 'ma_contact_not_found';
  END IF;
  IF contact_row.status <> 'active' THEN
    RAISE EXCEPTION 'ma_contact_correction_requires_active_contact';
  END IF;

  SELECT *
  INTO current_affiliation
  FROM public.ma_contact_office_affiliations affiliation
  WHERE affiliation.id = p_current_affiliation_id
    AND affiliation.contact_id = p_contact_id
    AND affiliation.is_active
  FOR UPDATE;

  IF current_affiliation.id IS NULL THEN
    RAISE EXCEPTION 'ma_contact_current_affiliation_changed';
  END IF;

  IF v_email IS NULL AND EXISTS (
    SELECT 1
    FROM public.opportunity_ma_contacts link
    JOIN public.opportunities opportunity ON opportunity.id = link.opportunity_id
    JOIN public.ma_contact_office_affiliations affiliation
      ON affiliation.id = link.affiliation_id
    WHERE affiliation.contact_id = p_contact_id
      AND link.is_active
      AND link.is_primary
      AND opportunity.status IN ('active', 'paused')
  ) THEN
    RAISE EXCEPTION 'ma_primary_contact_email_required';
  END IF;

  IF current_affiliation.office_id <> target_office.id THEN
    IF EXISTS (
      SELECT 1
      FROM public.opportunity_ma_contacts link
      JOIN public.opportunities opportunity ON opportunity.id = link.opportunity_id
      WHERE link.affiliation_id = current_affiliation.id
        AND link.is_active
        AND opportunity.status NOT IN ('closed', 'archived')
    ) THEN
      RAISE EXCEPTION 'ma_contact_move_blocked_by_current_opportunity';
    END IF;

    UPDATE public.ma_contact_office_affiliations affiliation
    SET
      is_active = FALSE,
      ended_at = CURRENT_DATE,
      ended_by = v_actor,
      updated_by = v_actor,
      updated_at = CLOCK_TIMESTAMP()
    WHERE affiliation.id = current_affiliation.id;

    INSERT INTO public.ma_contact_office_affiliations (
      contact_id,
      office_id,
      job_title,
      created_by,
      updated_by
    ) VALUES (
      p_contact_id,
      target_office.id,
      NULLIF(BTRIM(p_job_title), ''),
      v_actor,
      v_actor
    )
    RETURNING id INTO saved_affiliation_id;
  ELSE
    UPDATE public.ma_contact_office_affiliations affiliation
    SET
      job_title = NULLIF(BTRIM(p_job_title), ''),
      updated_by = v_actor,
      updated_at = CLOCK_TIMESTAMP()
    WHERE affiliation.id = current_affiliation.id
    RETURNING id INTO saved_affiliation_id;
  END IF;

  UPDATE public.ma_contacts contact
  SET
    first_name = v_first_name,
    last_name = v_last_name,
    display_name = CONCAT_WS(' ', v_first_name, v_last_name),
    email = v_email,
    phone = NULLIF(BTRIM(p_phone), ''),
    linkedin_url = NULLIF(BTRIM(p_linkedin_url), ''),
    internal_notes = NULLIF(BTRIM(p_internal_notes), ''),
    updated_by = v_actor
  WHERE contact.id = p_contact_id;

  RETURN QUERY
  SELECT
    contact.id,
    saved_affiliation_id,
    target_office.id,
    contact.updated_at,
    contact.updated_by
  FROM public.ma_contacts contact
  WHERE contact.id = p_contact_id;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_ma_contact_single_active_office(UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_ma_contact_single_active_office()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_ma_contact_with_office_correction(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.assert_ma_contact_single_active_office(UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.update_ma_contact_with_office_correction(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;
