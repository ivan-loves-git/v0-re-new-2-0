-- W-082 / W-088: deterministic staff opportunity intake and real offices.
-- Adds only the narrow write boundary needed to place a real office beneath
-- an existing active firm. Existing firm, office and opportunity history stays
-- intact; no synthetic office is reassigned or deleted.

BEGIN;

-- Preflight instead of allowing CREATE UNIQUE INDEX to fail with an opaque
-- duplicate-key error on a historical dataset. No existing record is merged,
-- renamed or archived by this release.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.ma_offices office
    WHERE office.status = 'active' AND NOT office.is_default
    GROUP BY office.firm_id, LOWER(BTRIM(office.name))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'migration_086_duplicate_active_real_office_names';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ma_offices_active_real_name_per_firm
  ON public.ma_offices (firm_id, LOWER(BTRIM(name)))
  WHERE status = 'active' AND NOT is_default;

-- Expose the firm lifecycle only to the existing staff-only projection so the
-- browser does not offer prospect firms to the real-office creation action.
CREATE OR REPLACE VIEW public.staff_ma_office_intake_projection
WITH (security_invoker = true) AS
SELECT
  office.id AS office_id,
  firm.id AS firm_id,
  firm.name AS firm_name,
  office.name AS office_name,
  CASE
    WHEN BTRIM(office.name) = BTRIM(firm.name) THEN firm.name
    ELSE firm.name || ' — ' || office.name
  END AS office_label,
  contact_context.affiliation_id,
  contact_context.contact_id,
  contact_context.contact_name,
  contact_context.contact_email,
  contact_context.job_title,
  firm.status AS firm_status
FROM public.ma_offices office
JOIN public.ma_firms firm ON firm.id = office.firm_id
LEFT JOIN LATERAL (
  SELECT
    affiliation.id AS affiliation_id,
    contact.id AS contact_id,
    contact.display_name AS contact_name,
    contact.email AS contact_email,
    affiliation.job_title
  FROM public.ma_contact_office_affiliations affiliation
  JOIN public.ma_contacts contact ON contact.id = affiliation.contact_id
  WHERE affiliation.office_id = office.id
    AND affiliation.is_active
    AND contact.status = 'active'
) contact_context ON TRUE
WHERE firm.status <> 'archived'
  AND office.status = 'active'
  AND (
    NOT office.is_default
    OR NOT EXISTS (
      SELECT 1
      FROM public.ma_offices real_office
      WHERE real_office.firm_id = office.firm_id
        AND real_office.status = 'active'
        AND NOT real_office.is_default
    )
  );

CREATE OR REPLACE FUNCTION public.create_ma_office_for_existing_firm(
  p_firm_id UUID,
  p_office_name TEXT,
  p_actor TEXT DEFAULT NULL
)
RETURNS TABLE (
  firm_id UUID,
  firm_name TEXT,
  office_id UUID,
  office_name TEXT
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  actor TEXT;
  office_name_value TEXT;
  normalized_office_name TEXT;
  firm_row public.ma_firms%ROWTYPE;
  created_office_id UUID;
BEGIN
  actor := NULLIF(BTRIM(p_actor), '');
  office_name_value := NULLIF(BTRIM(p_office_name), '');

  IF actor IS NULL THEN
    RAISE EXCEPTION 'ma_identity_actor_required';
  END IF;
  IF p_firm_id IS NULL THEN
    RAISE EXCEPTION 'ma_existing_firm_not_found';
  END IF;
  IF office_name_value IS NULL THEN
    RAISE EXCEPTION 'ma_real_office_name_required';
  END IF;

  -- Serialize all real-office additions for this firm/name pair before the
  -- duplicate check. The partial unique index remains the final guard.
  normalized_office_name := LOWER(BTRIM(office_name_value));
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_firm_id::TEXT || ':' || normalized_office_name, 76082)
  );

  SELECT * INTO firm_row
  FROM public.ma_firms
  WHERE id = p_firm_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ma_existing_firm_not_found';
  END IF;
  IF firm_row.status <> 'active' THEN
    RAISE EXCEPTION 'ma_existing_firm_not_active';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ma_offices office
    WHERE office.firm_id = firm_row.id
      AND office.status = 'active'
      AND NOT office.is_default
      AND LOWER(BTRIM(office.name)) = normalized_office_name
  ) THEN
    RAISE EXCEPTION 'ma_real_office_name_already_exists';
  END IF;

  INSERT INTO public.ma_offices (
    firm_id,
    name,
    status,
    is_default,
    created_by,
    updated_by
  ) VALUES (
    firm_row.id,
    office_name_value,
    'active',
    FALSE,
    actor,
    actor
  )
  RETURNING id INTO created_office_id;

  -- A synthetic default remains immutable historical attribution. The intake
  -- projection already removes it once this real office exists.
  RETURN QUERY
  SELECT firm_row.id, firm_row.name, created_office_id, office_name_value;
END;
$$;

REVOKE ALL ON FUNCTION public.create_ma_office_for_existing_firm(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_ma_office_for_existing_firm(UUID, TEXT, TEXT)
  TO service_role;

COMMENT ON FUNCTION public.create_ma_office_for_existing_firm(UUID, TEXT, TEXT) IS
  'Service-role-only audited real-office creation for one existing active canonical M&A firm. It serializes duplicate names, preserves synthetic defaults for historical attribution and never creates a contact or legacy source row.';

COMMIT;
