-- W-130: narrow, audited staff corrections for canonical M&A relationships.
-- This deliberately has no generic JSON patch endpoint: each function exposes
-- the approved field matrix only and cannot change relationship ownership.

BEGIN;

CREATE OR REPLACE FUNCTION public.update_ma_firm_correction(
  p_firm_id UUID,
  p_name TEXT,
  p_category TEXT,
  p_network_label TEXT,
  p_website_url TEXT,
  p_internal_notes TEXT,
  p_actor TEXT
)
RETURNS TABLE (id UUID, updated_at TIMESTAMPTZ, updated_by TEXT)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_name TEXT := NULLIF(BTRIM(p_name), '');
  v_actor TEXT := NULLIF(BTRIM(p_actor), '');
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'ma_identity_actor_required'; END IF;
  IF p_firm_id IS NULL OR v_name IS NULL THEN RAISE EXCEPTION 'ma_firm_name_required'; END IF;
  IF p_website_url IS NOT NULL AND BTRIM(p_website_url) <> ''
    AND BTRIM(p_website_url) !~* '^https?://[^[:space:]]+$' THEN
    RAISE EXCEPTION 'ma_website_url_invalid';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('ma_firm:' || lower(v_name), 113));
  PERFORM 1 FROM public.ma_firms firm WHERE firm.id = p_firm_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ma_firm_not_found'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.ma_firms f
    WHERE f.id <> p_firm_id AND f.status <> 'archived' AND lower(BTRIM(f.name)) = lower(v_name)
  ) THEN RAISE EXCEPTION 'ma_firm_name_already_exists'; END IF;
  RETURN QUERY
  UPDATE public.ma_firms f SET
    name = v_name,
    category = NULLIF(BTRIM(p_category), ''),
    network_label = NULLIF(BTRIM(p_network_label), ''),
    website_url = NULLIF(BTRIM(p_website_url), ''),
    internal_notes = NULLIF(BTRIM(p_internal_notes), ''),
    updated_by = v_actor
  WHERE f.id = p_firm_id
  RETURNING f.id, f.updated_at, f.updated_by;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_ma_office_correction(
  p_office_id UUID,
  p_name TEXT,
  p_city TEXT,
  p_address TEXT,
  p_coverage_note TEXT,
  p_website_url TEXT,
  p_general_email TEXT,
  p_general_phone TEXT,
  p_internal_notes TEXT,
  p_actor TEXT
)
RETURNS TABLE (id UUID, updated_at TIMESTAMPTZ, updated_by TEXT)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_name TEXT := NULLIF(BTRIM(p_name), '');
  v_actor TEXT := NULLIF(BTRIM(p_actor), '');
  v_firm_id UUID;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'ma_identity_actor_required'; END IF;
  IF p_office_id IS NULL OR v_name IS NULL THEN RAISE EXCEPTION 'ma_office_name_required'; END IF;
  IF p_general_email IS NOT NULL AND BTRIM(p_general_email) <> ''
    AND BTRIM(p_general_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'ma_email_invalid';
  END IF;
  IF p_website_url IS NOT NULL AND BTRIM(p_website_url) <> ''
    AND BTRIM(p_website_url) !~* '^https?://[^[:space:]]+$' THEN
    RAISE EXCEPTION 'ma_website_url_invalid';
  END IF;
  SELECT office.firm_id INTO v_firm_id FROM public.ma_offices office WHERE office.id = p_office_id FOR UPDATE;
  IF v_firm_id IS NULL THEN RAISE EXCEPTION 'ma_office_not_found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('ma_office:' || v_firm_id::TEXT || ':' || lower(v_name), 113));
  IF EXISTS (
    SELECT 1 FROM public.ma_offices o
    WHERE o.id <> p_office_id AND o.firm_id = v_firm_id AND o.status <> 'archived'
      AND lower(BTRIM(o.name)) = lower(v_name)
  ) THEN RAISE EXCEPTION 'ma_office_name_already_exists'; END IF;
  RETURN QUERY
  UPDATE public.ma_offices o SET
    name = v_name,
    city = NULLIF(BTRIM(p_city), ''),
    address = NULLIF(BTRIM(p_address), ''),
    coverage_note = NULLIF(BTRIM(p_coverage_note), ''),
    website_url = NULLIF(BTRIM(p_website_url), ''),
    general_email = NULLIF(BTRIM(p_general_email), ''),
    general_phone = NULLIF(BTRIM(p_general_phone), ''),
    internal_notes = NULLIF(BTRIM(p_internal_notes), ''),
    updated_by = v_actor
  WHERE o.id = p_office_id
  RETURNING o.id, o.updated_at, o.updated_by;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_ma_contact_correction(
  p_contact_id UUID,
  p_affiliation_id UUID,
  p_first_name TEXT,
  p_last_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_linkedin_url TEXT,
  p_internal_notes TEXT,
  p_job_title TEXT,
  p_actor TEXT
)
RETURNS TABLE (id UUID, updated_at TIMESTAMPTZ, updated_by TEXT)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_first_name TEXT := NULLIF(BTRIM(p_first_name), '');
  v_last_name TEXT := NULLIF(BTRIM(p_last_name), '');
  v_email TEXT := NULLIF(lower(BTRIM(p_email)), '');
  v_actor TEXT := NULLIF(BTRIM(p_actor), '');
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'ma_identity_actor_required'; END IF;
  IF p_contact_id IS NULL OR (v_first_name IS NULL AND v_last_name IS NULL) THEN RAISE EXCEPTION 'ma_contact_name_required'; END IF;
  IF v_email IS NOT NULL AND v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'ma_email_invalid'; END IF;
  IF p_linkedin_url IS NOT NULL AND BTRIM(p_linkedin_url) <> '' AND BTRIM(p_linkedin_url) !~* '^https?://[^[:space:]]+$' THEN RAISE EXCEPTION 'ma_linkedin_url_invalid'; END IF;
  PERFORM 1 FROM public.ma_contacts contact WHERE contact.id = p_contact_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ma_contact_not_found'; END IF;
  IF p_affiliation_id IS NOT NULL THEN
    PERFORM 1 FROM public.ma_contact_office_affiliations affiliation
    WHERE affiliation.id = p_affiliation_id AND affiliation.contact_id = p_contact_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'ma_contact_affiliation_not_found'; END IF;
  END IF;
  -- Do not make an Active/Paused opportunity lose its usable primary contact.
  IF v_email IS NULL AND EXISTS (
    SELECT 1 FROM public.opportunity_ma_contacts link
    JOIN public.opportunities opportunity ON opportunity.id = link.opportunity_id
    JOIN public.ma_contact_office_affiliations affiliation ON affiliation.id = link.affiliation_id
    WHERE affiliation.contact_id = p_contact_id AND link.is_active AND link.is_primary
      AND opportunity.status IN ('active', 'paused')
  ) THEN RAISE EXCEPTION 'ma_primary_contact_email_required'; END IF;
  UPDATE public.ma_contacts contact SET
    first_name = v_first_name,
    last_name = v_last_name,
    display_name = concat_ws(' ', v_first_name, v_last_name),
    email = v_email,
    phone = NULLIF(BTRIM(p_phone), ''),
    linkedin_url = NULLIF(BTRIM(p_linkedin_url), ''),
    internal_notes = NULLIF(BTRIM(p_internal_notes), ''),
    updated_by = v_actor
  WHERE contact.id = p_contact_id;
  IF p_affiliation_id IS NOT NULL THEN
    UPDATE public.ma_contact_office_affiliations affiliation
    SET job_title = NULLIF(BTRIM(p_job_title), ''), updated_at = clock_timestamp()
    WHERE affiliation.id = p_affiliation_id;
  END IF;
  RETURN QUERY SELECT contact.id, contact.updated_at, contact.updated_by FROM public.ma_contacts contact WHERE contact.id = p_contact_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_ma_firm_correction(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT), public.update_ma_office_correction(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT), public.update_ma_contact_correction(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_ma_firm_correction(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT), public.update_ma_office_correction(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT), public.update_ma_contact_correction(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO service_role;

COMMIT;
