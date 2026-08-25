-- W-021: controlled broad publication of active, real opportunities.
--
-- Lifecycle and broad discovery deliberately remain separate.  New records
-- stay staff_only.  This migration only installs service-role guarded controls;
-- it contains no production candidate manifest and changes no opportunity.

CREATE TABLE IF NOT EXISTS public.w021_opportunity_publication_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id),
  action TEXT NOT NULL CHECK (action IN ('publish', 'withdraw')),
  actor TEXT NOT NULL CHECK (NULLIF(BTRIM(actor), '') IS NOT NULL),
  previous_exposure public.opportunity_visibility NOT NULL,
  resulting_exposure public.opportunity_visibility NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (
    (action = 'publish' AND previous_exposure = 'staff_only' AND resulting_exposure = 'anonymized')
    OR (action = 'withdraw' AND previous_exposure = 'anonymized' AND resulting_exposure = 'staff_only')
  )
);

CREATE TABLE IF NOT EXISTS public.w021_opportunity_publication_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_key TEXT NOT NULL DEFAULT 'W-021-current-publication' UNIQUE
    CHECK (operation_key = 'W-021-current-publication'),
  actor TEXT NOT NULL CHECK (NULLIF(BTRIM(actor), '') IS NOT NULL),
  manifest_digest TEXT NOT NULL CHECK (manifest_digest ~ '^[0-9a-f]{64}$'),
  manifest JSONB NOT NULL,
  rollback_manifest JSONB NOT NULL,
  published_count INTEGER NOT NULL CHECK (published_count > 0),
  published_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS public.w021_opportunity_publication_rollbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL UNIQUE REFERENCES public.w021_opportunity_publication_runs(id),
  actor TEXT NOT NULL CHECK (NULLIF(BTRIM(actor), '') IS NOT NULL),
  rollback_manifest JSONB NOT NULL,
  rolled_back_count INTEGER NOT NULL CHECK (rolled_back_count > 0),
  rolled_back_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Broad exposure is an explicit staff approval, never an intake default. This
-- closes the legacy column-default escape hatch without altering lifecycle,
-- source confidentiality, documents, NDA state, or exact-match visibility.
CREATE OR REPLACE FUNCTION public.enforce_w021_new_opportunity_staff_only()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  NEW.repreneur_exposure := 'staff_only'::public.opportunity_visibility;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_w021_new_opportunity_staff_only ON public.opportunities;
CREATE TRIGGER enforce_w021_new_opportunity_staff_only
  BEFORE INSERT ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.enforce_w021_new_opportunity_staff_only();

CREATE OR REPLACE FUNCTION public.prevent_w021_opportunity_publication_audit_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN RAISE EXCEPTION 'w021_publication_audit_is_immutable'; END;
$$;

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'w021_opportunity_publication_events',
    'w021_opportunity_publication_runs',
    'w021_opportunity_publication_rollbacks'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS prevent_%I_mutation ON public.%I', table_name, table_name);
    EXECUTE format('CREATE TRIGGER prevent_%I_mutation BEFORE UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_w021_opportunity_publication_audit_mutation()', table_name, table_name);
  END LOOP;
END $$;

-- One stable eligibility function underpins both record-by-record publication
-- and the deliberately one-time current-inventory operation.
CREATE OR REPLACE FUNCTION public.w021_opportunity_publication_preflight()
RETURNS TABLE (
  ordinal INTEGER, id UUID, reference TEXT, updated_at TIMESTAMPTZ,
  fingerprint TEXT, eligible BOOLEAN, exclusion_reasons TEXT[]
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH candidate AS (
    SELECT o.id, o.reference, o.updated_at, o.status, o.is_demo,
      o.repreneur_exposure, o.public_title, o.teaser_summary, o.sector, o.location,
      o.source_office_id, office.status AS office_status, firm.status AS firm_status,
      COALESCE(contacts.active_count, 0) AS active_contact_count,
      COALESCE(contacts.primary_count, 0) AS primary_contact_count,
      COALESCE(contacts.usable_primary_email, FALSE) AS usable_primary_email,
      COALESCE(contacts.invalid_active_contact, FALSE) AS invalid_active_contact,
      COALESCE(contacts.fingerprint, '') AS contact_fingerprint
    FROM public.opportunities o
    LEFT JOIN public.ma_offices office ON office.id = o.source_office_id
    LEFT JOIN public.ma_firms firm ON firm.id = office.firm_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::INTEGER AS active_count,
        COUNT(*) FILTER (WHERE link.is_primary)::INTEGER AS primary_count,
        BOOL_OR(link.is_primary AND affiliation.is_active AND contact.status = 'active'
          AND NULLIF(BTRIM(contact.email), '') IS NOT NULL
          AND BTRIM(contact.email) ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') AS usable_primary_email,
        BOOL_OR(affiliation.office_id IS DISTINCT FROM o.source_office_id
          OR NOT affiliation.is_active OR contact.status <> 'active') AS invalid_active_contact,
        STRING_AGG(CONCAT_WS(':', link.id, link.affiliation_id, link.is_primary, link.is_active,
          affiliation.office_id, affiliation.is_active, contact.status, contact.email), ',' ORDER BY link.id) AS fingerprint
      FROM public.opportunity_ma_contacts link
      JOIN public.ma_contact_office_affiliations affiliation ON affiliation.id = link.affiliation_id
      JOIN public.ma_contacts contact ON contact.id = affiliation.contact_id
      WHERE link.opportunity_id = o.id AND link.is_active
    ) contacts ON TRUE
    WHERE o.status = 'active' AND o.repreneur_exposure = 'staff_only' AND NOT o.is_demo
  ), classified AS (
    SELECT *, ARRAY_REMOVE(ARRAY[
      CASE WHEN NULLIF(BTRIM(public_title), '') IS NULL THEN 'public_title_missing' END,
      CASE WHEN NULLIF(BTRIM(teaser_summary), '') IS NULL THEN 'teaser_summary_missing' END,
      CASE WHEN NULLIF(BTRIM(sector), '') IS NULL THEN 'sector_missing' END,
      CASE WHEN NULLIF(BTRIM(location), '') IS NULL THEN 'location_missing' END,
      CASE WHEN source_office_id IS NULL THEN 'source_office_missing' END,
      CASE WHEN office_status IS DISTINCT FROM 'active' THEN 'source_office_inactive_or_missing' END,
      CASE WHEN firm_status IS DISTINCT FROM 'active' THEN 'source_firm_inactive_or_missing' END,
      CASE WHEN active_contact_count = 0 THEN 'active_contact_missing' END,
      CASE WHEN primary_contact_count <> 1 THEN 'primary_contact_not_exactly_one' END,
      CASE WHEN NOT usable_primary_email THEN 'primary_email_unusable' END,
      CASE WHEN invalid_active_contact THEN 'active_contact_invalid_or_wrong_office' END
    ], NULL) AS exclusion_reasons FROM candidate
  )
  SELECT ROW_NUMBER() OVER (ORDER BY reference, id)::INTEGER, id, reference, updated_at,
    ENCODE(extensions.digest(CONVERT_TO(CONCAT_WS('|', id, reference,
      TO_CHAR(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      status, is_demo, repreneur_exposure, public_title, teaser_summary, sector, location,
      source_office_id, office_status, firm_status, active_contact_count, primary_contact_count,
      usable_primary_email, invalid_active_contact, contact_fingerprint), 'UTF8'), 'sha256'), 'hex'),
    CARDINALITY(exclusion_reasons) = 0, exclusion_reasons
  FROM classified ORDER BY reference, id;
$$;

CREATE OR REPLACE FUNCTION public.w021_publication_manifest_digest(p_manifest JSONB)
RETURNS TEXT LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE(ENCODE(extensions.digest(CONVERT_TO(STRING_AGG(CONCAT_WS('|', ordinal, id, reference,
    TO_CHAR(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), fingerprint), E'\\n' ORDER BY ordinal),
    'UTF8'), 'sha256'), 'hex'), ENCODE(extensions.digest(''::BYTEA, 'sha256'), 'hex'))
  FROM JSONB_TO_RECORDSET(p_manifest) AS x(ordinal INTEGER, id UUID, reference TEXT, updated_at TIMESTAMPTZ, fingerprint TEXT);
$$;

CREATE OR REPLACE FUNCTION public.publish_w021_opportunity(p_opportunity_id UUID, p_actor TEXT)
RETURNS TABLE (event_id UUID, opportunity_id UUID, resulting_exposure public.opportunity_visibility)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor TEXT := NULLIF(BTRIM(p_actor), ''); v_event UUID;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'w021_publication_actor_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('w021:opportunity-publication:' || p_opportunity_id::TEXT, 21));
  LOCK TABLE public.opportunities, public.ma_offices, public.ma_firms, public.opportunity_ma_contacts,
    public.ma_contact_office_affiliations, public.ma_contacts IN SHARE ROW EXCLUSIVE MODE;
  IF NOT EXISTS (SELECT 1 FROM public.w021_opportunity_publication_preflight() WHERE id = p_opportunity_id AND eligible) THEN
    RAISE EXCEPTION 'w021_publication_opportunity_not_eligible';
  END IF;
  UPDATE public.opportunities SET repreneur_exposure = 'anonymized', updated_by = v_actor
    WHERE id = p_opportunity_id AND status = 'active' AND NOT is_demo AND repreneur_exposure = 'staff_only';
  IF NOT FOUND THEN RAISE EXCEPTION 'w021_publication_state_drift'; END IF;
  INSERT INTO public.w021_opportunity_publication_events(opportunity_id, action, actor, previous_exposure, resulting_exposure)
    VALUES (p_opportunity_id, 'publish', v_actor, 'staff_only', 'anonymized') RETURNING id INTO v_event;
  RETURN QUERY SELECT v_event, p_opportunity_id, 'anonymized'::public.opportunity_visibility;
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_w021_opportunity(p_opportunity_id UUID, p_actor TEXT)
RETURNS TABLE (event_id UUID, opportunity_id UUID, resulting_exposure public.opportunity_visibility)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor TEXT := NULLIF(BTRIM(p_actor), ''); v_event UUID;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'w021_withdraw_actor_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('w021:opportunity-publication:' || p_opportunity_id::TEXT, 21));
  UPDATE public.opportunities SET repreneur_exposure = 'staff_only', updated_by = v_actor
    WHERE id = p_opportunity_id AND repreneur_exposure = 'anonymized';
  IF NOT FOUND THEN RAISE EXCEPTION 'w021_withdraw_opportunity_not_published'; END IF;
  INSERT INTO public.w021_opportunity_publication_events(opportunity_id, action, actor, previous_exposure, resulting_exposure)
    VALUES (p_opportunity_id, 'withdraw', v_actor, 'anonymized', 'staff_only') RETURNING id INTO v_event;
  RETURN QUERY SELECT v_event, p_opportunity_id, 'staff_only'::public.opportunity_visibility;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_w021_current_publication(p_manifest JSONB, p_manifest_digest TEXT, p_actor TEXT)
RETURNS TABLE (run_id UUID, published_count INTEGER, rollback_manifest JSONB)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor TEXT := NULLIF(BTRIM(p_actor), ''); v_count INTEGER; v_run UUID; v_rollback JSONB;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'w021_bulk_actor_required'; END IF;
  IF JSONB_TYPEOF(p_manifest) <> 'array' OR JSONB_ARRAY_LENGTH(p_manifest) = 0 THEN RAISE EXCEPTION 'w021_bulk_manifest_required'; END IF;
  IF p_manifest_digest !~ '^[0-9a-f]{64}$' OR public.w021_publication_manifest_digest(p_manifest) IS DISTINCT FROM p_manifest_digest THEN RAISE EXCEPTION 'w021_bulk_manifest_digest_mismatch'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('w021:current-publication', 21));
  IF EXISTS (SELECT 1 FROM public.w021_opportunity_publication_runs) THEN RAISE EXCEPTION 'w021_bulk_already_completed'; END IF;
  LOCK TABLE public.opportunities, public.ma_offices, public.ma_firms, public.opportunity_ma_contacts, public.ma_contact_office_affiliations, public.ma_contacts IN SHARE ROW EXCLUSIVE MODE;
  CREATE TEMP TABLE w021_manifest(ordinal INTEGER UNIQUE NOT NULL, id UUID PRIMARY KEY, reference TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL, fingerprint TEXT NOT NULL) ON COMMIT DROP;
  INSERT INTO w021_manifest SELECT ordinal, id, reference, updated_at, fingerprint FROM JSONB_TO_RECORDSET(p_manifest) AS x(ordinal INTEGER, id UUID, reference TEXT, updated_at TIMESTAMPTZ, fingerprint TEXT);
  IF (SELECT COUNT(*) FROM w021_manifest) <> JSONB_ARRAY_LENGTH(p_manifest) THEN RAISE EXCEPTION 'w021_bulk_manifest_invalid'; END IF;
  IF EXISTS (SELECT 1 FROM w021_manifest m FULL OUTER JOIN (SELECT ordinal,id,reference,updated_at,fingerprint FROM public.w021_opportunity_publication_preflight() WHERE eligible) p ON p.id=m.id WHERE m.id IS NULL OR p.id IS NULL OR (m.ordinal,m.reference,m.updated_at,m.fingerprint) IS DISTINCT FROM (p.ordinal,p.reference,p.updated_at,p.fingerprint)) THEN RAISE EXCEPTION 'w021_bulk_manifest_set_mismatch'; END IF;
  WITH changed AS (
    UPDATE public.opportunities o SET repreneur_exposure='anonymized', updated_by=v_actor FROM w021_manifest m
    WHERE o.id=m.id AND o.status='active' AND NOT o.is_demo AND o.repreneur_exposure='staff_only'
    RETURNING o.id,o.reference,o.updated_at,o.updated_by
  ) SELECT COUNT(*)::INTEGER, JSONB_AGG(JSONB_BUILD_OBJECT('ordinal',m.ordinal,'id',m.id,'reference',m.reference,'publication_updated_at',c.updated_at,'publication_updated_by',c.updated_by,'target_exposure','staff_only') ORDER BY m.ordinal) INTO v_count,v_rollback FROM w021_manifest m JOIN changed c ON c.id=m.id;
  IF v_count <> JSONB_ARRAY_LENGTH(p_manifest) THEN RAISE EXCEPTION 'w021_bulk_state_drift'; END IF;
  INSERT INTO public.w021_opportunity_publication_events(opportunity_id, action, actor, previous_exposure, resulting_exposure) SELECT id,'publish',v_actor,'staff_only','anonymized' FROM w021_manifest;
  INSERT INTO public.w021_opportunity_publication_runs(actor,manifest_digest,manifest,rollback_manifest,published_count) VALUES(v_actor,p_manifest_digest,p_manifest,v_rollback,v_count) RETURNING id INTO v_run;
  RETURN QUERY SELECT v_run,v_count,v_rollback;
END;
$$;

CREATE OR REPLACE FUNCTION public.rollback_w021_current_publication(p_run_id UUID, p_actor TEXT)
RETURNS TABLE (rollback_id UUID, rolled_back_count INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor TEXT := NULLIF(BTRIM(p_actor), ''); v_run public.w021_opportunity_publication_runs%ROWTYPE; v_count INTEGER; v_rollback UUID;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'w021_bulk_rollback_actor_required'; END IF;
  SELECT * INTO v_run FROM public.w021_opportunity_publication_runs WHERE id=p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'w021_bulk_rollback_run_not_found'; END IF;
  IF EXISTS (SELECT 1 FROM public.w021_opportunity_publication_rollbacks WHERE run_id=p_run_id) THEN RAISE EXCEPTION 'w021_bulk_rollback_already_completed'; END IF;
  CREATE TEMP TABLE w021_rollback(ordinal INTEGER, id UUID PRIMARY KEY, reference TEXT, publication_updated_at TIMESTAMPTZ, publication_updated_by TEXT, target_exposure TEXT) ON COMMIT DROP;
  INSERT INTO w021_rollback SELECT ordinal,id,reference,publication_updated_at,publication_updated_by,target_exposure FROM JSONB_TO_RECORDSET(v_run.rollback_manifest) AS x(ordinal INTEGER,id UUID,reference TEXT,publication_updated_at TIMESTAMPTZ,publication_updated_by TEXT,target_exposure TEXT);
  IF (SELECT COUNT(*) FROM w021_rollback) <> v_run.published_count THEN RAISE EXCEPTION 'w021_bulk_rollback_manifest_invalid'; END IF;
  LOCK TABLE public.opportunities IN SHARE ROW EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM public.opportunities o JOIN w021_rollback r ON r.id=o.id WHERE o.reference IS DISTINCT FROM r.reference OR o.updated_at IS DISTINCT FROM r.publication_updated_at OR o.updated_by IS DISTINCT FROM r.publication_updated_by OR o.repreneur_exposure <> 'anonymized' OR r.target_exposure <> 'staff_only') THEN RAISE EXCEPTION 'w021_bulk_rollback_manifest_drift'; END IF;
  WITH changed AS (UPDATE public.opportunities o SET repreneur_exposure='staff_only',updated_by=v_actor FROM w021_rollback r WHERE o.id=r.id RETURNING o.id) SELECT COUNT(*)::INTEGER INTO v_count FROM changed;
  IF v_count <> v_run.published_count THEN RAISE EXCEPTION 'w021_bulk_rollback_state_drift'; END IF;
  INSERT INTO public.w021_opportunity_publication_events(opportunity_id,action,actor,previous_exposure,resulting_exposure) SELECT id,'withdraw',v_actor,'anonymized','staff_only' FROM w021_rollback;
  INSERT INTO public.w021_opportunity_publication_rollbacks(run_id,actor,rollback_manifest,rolled_back_count) VALUES(p_run_id,v_actor,v_run.rollback_manifest,v_count) RETURNING id INTO v_rollback;
  RETURN QUERY SELECT v_rollback,v_count;
END;
$$;

REVOKE ALL ON TABLE public.w021_opportunity_publication_events, public.w021_opportunity_publication_runs, public.w021_opportunity_publication_rollbacks FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.w021_opportunity_publication_events, public.w021_opportunity_publication_runs, public.w021_opportunity_publication_rollbacks TO service_role;
REVOKE ALL ON FUNCTION public.w021_opportunity_publication_preflight(), public.w021_publication_manifest_digest(JSONB), public.publish_w021_opportunity(UUID,TEXT), public.withdraw_w021_opportunity(UUID,TEXT), public.apply_w021_current_publication(JSONB,TEXT,TEXT), public.rollback_w021_current_publication(UUID,TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.w021_opportunity_publication_preflight(), public.publish_w021_opportunity(UUID,TEXT), public.withdraw_w021_opportunity(UUID,TEXT), public.apply_w021_current_publication(JSONB,TEXT,TEXT), public.rollback_w021_current_publication(UUID,TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.enforce_w021_new_opportunity_staff_only(), public.prevent_w021_opportunity_publication_audit_mutation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_w021_new_opportunity_staff_only(), public.prevent_w021_opportunity_publication_audit_mutation() TO service_role;
