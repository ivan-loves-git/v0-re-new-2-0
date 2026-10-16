-- #257 / #260, approved Decision #258. Candidate service changes only.
-- Retained incomplete/synthetic records are untouched; no backfill or global
-- non-null constraint. Minimum fields apply when a target profile is saved.
CREATE OR REPLACE FUNCTION public.ma_profile_text(p_value TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT NULLIF(REGEXP_REPLACE(p_value,'^[[:space:]]+|[[:space:]]+$','','g'),'');
$$;
REVOKE ALL ON FUNCTION public.ma_profile_text(TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ma_profile_text(TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.create_ma_firm_with_first_office(
  p_firm_name TEXT,
  p_office_name TEXT,
  p_office_city TEXT,
  p_include_contact BOOLEAN,
  p_contact_first_name TEXT,
  p_contact_last_name TEXT,
  p_contact_email TEXT,
  p_contact_phone TEXT,
  p_contact_job_title TEXT,
  p_actor TEXT
)
RETURNS TABLE (firm_id UUID, office_id UUID, contact_id UUID, affiliation_id UUID)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_actor TEXT := public.ma_profile_text(p_actor);
  v_firm_name TEXT := public.ma_profile_text(p_firm_name);
  v_office_name TEXT := public.ma_profile_text(p_office_name);
  v_city TEXT := public.ma_profile_text(p_office_city);
  v_firm_id UUID;
  v_office_id UUID;
  v_contact_id UUID;
  v_affiliation_id UUID;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'ma_identity_actor_required'; END IF;
  IF v_firm_name IS NULL THEN RAISE EXCEPTION 'ma_firm_name_required'; END IF;
  IF v_office_name IS NULL THEN RAISE EXCEPTION 'ma_real_office_name_required'; END IF;
  IF v_city IS NULL THEN RAISE EXCEPTION 'ma_office_city_required'; END IF;
  -- Same normalized name fence as the existing typed firm correction service.
  PERFORM pg_advisory_xact_lock(hashtextextended('ma_firm:' || LOWER(v_firm_name), 113));
  IF EXISTS (SELECT 1 FROM public.ma_firms firm WHERE LOWER(BTRIM(firm.name))=LOWER(v_firm_name)) THEN
    RAISE EXCEPTION 'ma_firm_name_already_exists';
  END IF;
  INSERT INTO public.ma_firms(name,created_by,updated_by)
    VALUES(v_firm_name,v_actor,v_actor) RETURNING id INTO v_firm_id;
  INSERT INTO public.ma_offices(firm_id,name,city,is_default,created_by,updated_by)
    VALUES(v_firm_id,v_office_name,v_city,FALSE,v_actor,v_actor) RETURNING id INTO v_office_id;
  IF p_include_contact THEN
    SELECT created.contact_id,created.affiliation_id INTO v_contact_id,v_affiliation_id
    FROM public.create_or_affiliate_ma_contact(v_office_id,NULL,p_contact_first_name,p_contact_last_name,p_contact_email,p_contact_phone,p_contact_job_title,v_actor) created;
  ELSIF public.ma_profile_text(p_contact_first_name) IS NOT NULL OR public.ma_profile_text(p_contact_last_name) IS NOT NULL
    OR public.ma_profile_text(p_contact_email) IS NOT NULL OR public.ma_profile_text(p_contact_phone) IS NOT NULL
    OR public.ma_profile_text(p_contact_job_title) IS NOT NULL THEN
    RAISE EXCEPTION 'ma_optional_contact_must_be_explicit';
  END IF;
  RETURN QUERY SELECT v_firm_id,v_office_id,v_contact_id,v_affiliation_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_ma_firm_with_first_office(TEXT,TEXT,TEXT,BOOLEAN,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_ma_firm_with_first_office(TEXT,TEXT,TEXT,BOOLEAN,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO service_role;

-- Retains W-157 sole-current-office and historical-affiliation guards.
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
  actor := public.ma_profile_text(p_actor);
  contact_first_name := public.ma_profile_text(p_contact_first_name);
  contact_last_name := public.ma_profile_text(p_contact_last_name);
  contact_email := LOWER(public.ma_profile_text(p_contact_email));
  contact_phone := public.ma_profile_text(p_contact_phone);

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

    IF public.ma_profile_text(contact_row.first_name) IS NULL AND public.ma_profile_text(contact_row.last_name) IS NULL THEN RAISE EXCEPTION 'ma_contact_requires_name_component'; END IF;
    IF public.ma_profile_text(contact_row.email) IS NULL AND public.ma_profile_text(contact_row.phone) IS NULL THEN RAISE EXCEPTION 'ma_contact_channel_required'; END IF;
    IF public.ma_profile_text(contact_row.email) IS NOT NULL AND public.ma_profile_text(contact_row.email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'ma_email_invalid'; END IF;
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

    IF contact_email IS NULL AND contact_phone IS NULL THEN RAISE EXCEPTION 'ma_contact_channel_required'; END IF;
    IF contact_email IS NOT NULL AND contact_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'ma_email_invalid'; END IF;

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
    public.ma_profile_text(p_contact_job_title),
    actor,
    actor
  )
  RETURNING id INTO created_affiliation_id;

  RETURN QUERY
  SELECT resolved_contact_id, created_affiliation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_ma_office_for_existing_firm(
  p_firm_id UUID,
  p_office_name TEXT,
  p_office_city TEXT,
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
  office_city_value TEXT;
  normalized_office_name TEXT;
  firm_row public.ma_firms%ROWTYPE;
  created_office_id UUID;
BEGIN
  actor := public.ma_profile_text(p_actor);
  office_name_value := public.ma_profile_text(p_office_name);
  office_city_value := public.ma_profile_text(p_office_city);

  IF actor IS NULL THEN
    RAISE EXCEPTION 'ma_identity_actor_required';
  END IF;
  IF p_firm_id IS NULL THEN
    RAISE EXCEPTION 'ma_existing_firm_not_found';
  END IF;
  IF office_name_value IS NULL THEN
    RAISE EXCEPTION 'ma_real_office_name_required';
  END IF;

  IF office_city_value IS NULL THEN RAISE EXCEPTION 'ma_office_city_required'; END IF;

  -- Serialize all real-office additions for this firm/name pair before the
  -- duplicate check. The partial unique index remains the final guard.
  normalized_office_name := LOWER(BTRIM(office_name_value));
  PERFORM pg_advisory_xact_lock(
    hashtextextended('ma_office:' || p_firm_id::TEXT || ':' || normalized_office_name, 113)
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
    city,
    status,
    is_default,
    created_by,
    updated_by
  ) VALUES (
    firm_row.id,
    office_name_value,
    office_city_value,
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

REVOKE ALL ON FUNCTION public.create_ma_office_for_existing_firm(UUID,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_ma_office_for_existing_firm(UUID,TEXT,TEXT,TEXT) TO service_role;
-- Retire the old city-less and synthetic-default manual shortcuts. Rollback
-- may restore these grants, but must never delete legitimate directory rows.
REVOKE ALL ON FUNCTION public.create_ma_office_for_existing_firm(UUID,TEXT,TEXT), public.create_ma_firm_with_default_office(TEXT,TEXT,TEXT,TEXT,BOOLEAN,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated,service_role;

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
  v_name TEXT := public.ma_profile_text(p_name);
  v_city TEXT := public.ma_profile_text(p_city);
  v_actor TEXT := public.ma_profile_text(p_actor);
  v_firm_id UUID;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'ma_identity_actor_required'; END IF;
  IF p_office_id IS NULL OR v_name IS NULL THEN RAISE EXCEPTION 'ma_office_name_required'; END IF;
  IF v_city IS NULL THEN RAISE EXCEPTION 'ma_office_city_required'; END IF;
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
    city = v_city,
    address = public.ma_profile_text(p_address),
    coverage_note = public.ma_profile_text(p_coverage_note),
    website_url = public.ma_profile_text(p_website_url),
    general_email = public.ma_profile_text(p_general_email),
    general_phone = public.ma_profile_text(p_general_phone),
    internal_notes = public.ma_profile_text(p_internal_notes),
    updated_by = v_actor
  WHERE o.id = p_office_id
  RETURNING o.id, o.updated_at, o.updated_by;
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
  v_first_name TEXT := public.ma_profile_text(p_first_name);
  v_last_name TEXT := public.ma_profile_text(p_last_name);
  v_email TEXT := LOWER(public.ma_profile_text(p_email));
  v_actor TEXT := public.ma_profile_text(p_actor);
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
  IF v_email IS NULL AND public.ma_profile_text(p_phone) IS NULL THEN RAISE EXCEPTION 'ma_contact_channel_required'; END IF;
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
      public.ma_profile_text(p_job_title),
      v_actor,
      v_actor
    )
    RETURNING id INTO saved_affiliation_id;
  ELSE
    UPDATE public.ma_contact_office_affiliations affiliation
    SET
      job_title = public.ma_profile_text(p_job_title),
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
    phone = public.ma_profile_text(p_phone),
    linkedin_url = public.ma_profile_text(p_linkedin_url),
    internal_notes = public.ma_profile_text(p_internal_notes),
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

-- The superseded identity-only correction has no current-office guard.
REVOKE ALL ON FUNCTION public.update_ma_contact_correction(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated,service_role;

-- Notes are profile edits too. Lock the target and change only notes plus a
-- deliberately supplied missing city; never copy stale fields from a client.
CREATE OR REPLACE FUNCTION public.update_ma_office_notes(
  p_office_id UUID,p_internal_notes TEXT,p_city TEXT,p_actor TEXT
) RETURNS TABLE(id UUID,updated_at TIMESTAMPTZ,updated_by TEXT)
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE v_office public.ma_offices%ROWTYPE; v_city TEXT; v_actor TEXT:=public.ma_profile_text(p_actor);
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'ma_identity_actor_required'; END IF;
  SELECT * INTO v_office FROM public.ma_offices o WHERE o.id=p_office_id FOR UPDATE;
  IF v_office.id IS NULL THEN RAISE EXCEPTION 'ma_office_not_found'; END IF;
  IF public.ma_profile_text(v_office.name) IS NULL THEN RAISE EXCEPTION 'ma_office_name_required'; END IF;
  v_city:=COALESCE(public.ma_profile_text(v_office.city),public.ma_profile_text(p_city));
  IF v_city IS NULL THEN RAISE EXCEPTION 'ma_office_city_required'; END IF;
  RETURN QUERY UPDATE public.ma_offices o SET city=v_city,internal_notes=public.ma_profile_text(p_internal_notes),updated_by=v_actor
    WHERE o.id=p_office_id RETURNING o.id,o.updated_at,o.updated_by;
END $$;
CREATE OR REPLACE FUNCTION public.update_ma_firm_notes(
  p_firm_id UUID,p_internal_notes TEXT,p_actor TEXT
) RETURNS TABLE(id UUID,updated_at TIMESTAMPTZ,updated_by TEXT)
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE v_name TEXT; v_actor TEXT:=public.ma_profile_text(p_actor);
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'ma_identity_actor_required'; END IF;
  SELECT f.name INTO v_name FROM public.ma_firms f WHERE f.id=p_firm_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ma_firm_not_found'; END IF;
  IF public.ma_profile_text(v_name) IS NULL THEN RAISE EXCEPTION 'ma_firm_name_required'; END IF;
  RETURN QUERY UPDATE public.ma_firms f SET internal_notes=public.ma_profile_text(p_internal_notes),updated_by=v_actor
    WHERE f.id=p_firm_id RETURNING f.id,f.updated_at,f.updated_by;
END $$;
REVOKE ALL ON FUNCTION public.update_ma_office_notes(UUID,TEXT,TEXT,TEXT),public.update_ma_firm_notes(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.update_ma_office_notes(UUID,TEXT,TEXT,TEXT),public.update_ma_firm_notes(UUID,TEXT,TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.ma_contact_email_collision(p_contact_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ma_contacts saved JOIN public.ma_contacts other
      ON other.id<>saved.id AND LOWER(public.ma_profile_text(other.email))=LOWER(public.ma_profile_text(saved.email))
    WHERE saved.id=p_contact_id AND public.ma_profile_text(saved.email) IS NOT NULL
  );
$$;
REVOKE ALL ON FUNCTION public.ma_contact_email_collision(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ma_contact_email_collision(UUID) TO service_role;
