-- W-109: a staff-only, one-way conversion boundary from an External Pursuit
-- into a new canonical Re-New opportunity.  The source dossier remains a
-- separate record: no dossier title, notes, contacts, files, owner, stage or
-- availability is copied into the opportunity.

BEGIN;

-- Conversion must never offer a synthetic/default office. Add the canonical
-- flag to the existing staff-only projection; it is appended to preserve the
-- established view column order for current consumers.
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
  firm.status AS firm_status,
  office.is_default AS office_is_default
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

CREATE TABLE IF NOT EXISTS public.external_pursuit_opportunity_conversions (
  external_pursuit_id UUID PRIMARY KEY
    REFERENCES public.external_pursuits(id) ON DELETE RESTRICT,
  opportunity_id UUID NOT NULL UNIQUE
    REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  converted_by TEXT NOT NULL CHECK (NULLIF(BTRIM(converted_by), '') IS NOT NULL),
  converted_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  idempotency_key TEXT NOT NULL CHECK (NULLIF(BTRIM(idempotency_key), '') IS NOT NULL),
  UNIQUE (converted_by, idempotency_key)
);

CREATE OR REPLACE FUNCTION public.reject_external_pursuit_conversion_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'External Pursuit conversion evidence is immutable.';
END $$;

DROP TRIGGER IF EXISTS external_pursuit_opportunity_conversions_immutable
  ON public.external_pursuit_opportunity_conversions;
CREATE TRIGGER external_pursuit_opportunity_conversions_immutable
  BEFORE UPDATE OR DELETE ON public.external_pursuit_opportunity_conversions
  FOR EACH ROW EXECUTE FUNCTION public.reject_external_pursuit_conversion_mutation();

CREATE OR REPLACE FUNCTION public.convert_external_pursuit_to_opportunity(
  p_dossier_id UUID,
  p_public_title TEXT,
  p_geography_node_id UUID,
  p_source_office_id UUID,
  p_primary_affiliation_id UUID,
  p_actor_user_id TEXT,
  p_idempotency_key TEXT
)
RETURNS TABLE (opportunity_id UUID, opportunity_reference TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor TEXT := NULLIF(BTRIM(p_actor_user_id), '');
  actor_role public.app_user_role;
  dossier public.external_pursuits%ROWTYPE;
  existing public.external_pursuit_opportunity_conversions%ROWTYPE;
  source_office public.ma_offices%ROWTYPE;
  node public.geography_nodes%ROWTYPE;
  saved public.opportunities%ROWTYPE;
  safe_title TEXT := NULLIF(BTRIM(p_public_title), '');
BEGIN
  IF actor IS NULL OR NULLIF(BTRIM(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'external_pursuit_conversion_actor_and_key_required';
  END IF;
  IF p_dossier_id IS NULL OR p_geography_node_id IS NULL
     OR p_source_office_id IS NULL OR p_primary_affiliation_id IS NULL
     OR safe_title IS NULL THEN
    RAISE EXCEPTION 'external_pursuit_conversion_fields_required';
  END IF;
  IF char_length(safe_title) > 240 THEN
    RAISE EXCEPTION 'external_pursuit_conversion_public_title_too_long';
  END IF;

  SELECT role INTO actor_role FROM public.external_pursuit_actor_context(actor);
  IF actor_role <> 'staff' THEN
    RAISE EXCEPTION 'External Pursuit access denied.';
  END IF;

  -- Use the exact dossier lock already owned by update and deletion. This
  -- makes conversion, edit and delete mutually exclusive before either a
  -- mandate number or an opportunity row can be allocated.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_dossier_id::TEXT, 0));

  SELECT * INTO existing
  FROM public.external_pursuit_opportunity_conversions
  WHERE external_pursuit_id = p_dossier_id;
  IF FOUND THEN
    IF existing.converted_by = actor
       AND existing.idempotency_key = p_idempotency_key THEN
      RETURN QUERY
      SELECT existing.opportunity_id, opportunity.reference
      FROM public.opportunities opportunity
      WHERE opportunity.id = existing.opportunity_id;
      RETURN;
    END IF;
    RAISE EXCEPTION 'external_pursuit_already_converted';
  END IF;

  dossier := public.assert_external_pursuit_access(p_dossier_id, actor, TRUE);
  IF dossier.deletion_status <> 'active'
     OR dossier.stage IN ('completed', 'dropped_archived') THEN
    RAISE EXCEPTION 'external_pursuit_conversion_requires_active_dossier';
  END IF;

  SELECT * INTO source_office
  FROM public.ma_offices
  WHERE id = p_source_office_id;
  IF source_office.id IS NULL OR source_office.status <> 'active'
     OR source_office.is_default
     OR NOT EXISTS (
       SELECT 1 FROM public.ma_firms firm
       WHERE firm.id = source_office.firm_id AND firm.status = 'active'
     ) THEN
    RAISE EXCEPTION 'external_pursuit_conversion_requires_active_real_office';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ma_provisional_source_contexts provisional
    WHERE provisional.context_key = 'acme_co_paris'
      AND provisional.office_id = source_office.id
  ) THEN
    RAISE EXCEPTION 'external_pursuit_conversion_rejects_acme_source';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.ma_contact_office_affiliations affiliation
    JOIN public.ma_contacts contact ON contact.id = affiliation.contact_id
    WHERE affiliation.id = p_primary_affiliation_id
      AND affiliation.office_id = source_office.id
      AND affiliation.is_active
      AND contact.status = 'active'
      AND NULLIF(BTRIM(contact.display_name), '') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'external_pursuit_conversion_requires_active_named_primary_contact';
  END IF;

  -- W-039 owns the canonical geography validation. Passing it to the existing
  -- creation RPC also allocates the immutable reference in this transaction.
  node := public.resolve_w039_geography_node(p_geography_node_id::TEXT);
  saved := public.create_opportunity_with_office_context(
    '',
    source_office.id,
    ARRAY[p_primary_affiliation_id],
    p_primary_affiliation_id,
    NULL,
    'draft',
    actor,
    jsonb_build_object(
      'geography_node_id', node.id,
      'public_title', safe_title
    )
  );

  INSERT INTO public.external_pursuit_opportunity_conversions (
    external_pursuit_id,
    opportunity_id,
    converted_by,
    idempotency_key
  ) VALUES (
    dossier.id,
    saved.id,
    actor,
    p_idempotency_key
  );

  RETURN QUERY SELECT saved.id, saved.reference;
END;
$$;

-- Explicitly fail closed if an owner deletion request races with conversion or
-- if staff later tries to fulfil deletion of a linked dossier.  W-108's file
-- wrapper must perform this check before deleting storage objects.
CREATE OR REPLACE FUNCTION public.assert_external_pursuit_not_converted(
  p_dossier_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.external_pursuit_opportunity_conversions conversion
    WHERE conversion.external_pursuit_id = p_dossier_id
  ) THEN
    RAISE EXCEPTION 'external_pursuit_already_converted';
  END IF;
END;
$$;

-- W-108 calls this staff-only primitive before removing any storage object.
-- The durable delete_requested state means conversion remains impossible after
-- this transaction releases the shared dossier lock.
CREATE OR REPLACE FUNCTION public.prepare_external_pursuit_deletion_fulfillment(
  p_dossier_id UUID,
  p_actor_user_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor TEXT := NULLIF(BTRIM(p_actor_user_id), '');
  actor_role public.app_user_role;
  dossier public.external_pursuits%ROWTYPE;
BEGIN
  SELECT role INTO actor_role FROM public.external_pursuit_actor_context(actor);
  IF actor_role <> 'staff' THEN
    RAISE EXCEPTION 'External Pursuit access denied.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_dossier_id::TEXT, 0));
  PERFORM public.assert_external_pursuit_not_converted(p_dossier_id);
  dossier := public.assert_external_pursuit_access(p_dossier_id, actor, TRUE);
  IF dossier.deletion_status <> 'delete_requested' THEN
    RAISE EXCEPTION 'External Pursuit deletion was not requested.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.fulfill_external_pursuit_deletion(
  p_dossier_id UUID,
  p_actor_user_id TEXT,
  p_idempotency_key TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.external_pursuits%ROWTYPE; actor TEXT := NULLIF(BTRIM(p_actor_user_id), ''); request_actor TEXT; request_at TIMESTAMPTZ; actor_role public.app_user_role; stored_key TEXT;
BEGIN
  IF NULLIF(BTRIM(p_idempotency_key),'') IS NULL THEN RAISE EXCEPTION 'An idempotency key is required.'; END IF;
  SELECT role INTO actor_role FROM public.external_pursuit_actor_context(actor);
  IF actor_role <> 'staff' THEN RAISE EXCEPTION 'External Pursuit access denied.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_dossier_id::TEXT, 0));
  SELECT fulfillment_idempotency_key INTO stored_key FROM public.external_pursuit_deletion_tombstones WHERE former_dossier_id=p_dossier_id;
  IF stored_key IS NOT NULL THEN
    IF stored_key = p_idempotency_key THEN RETURN; END IF;
    RAISE EXCEPTION 'External Pursuit deletion fulfillment idempotency conflict.';
  END IF;
  PERFORM public.prepare_external_pursuit_deletion_fulfillment(p_dossier_id, actor);
  p := public.assert_external_pursuit_access(p_dossier_id,actor,TRUE);
  IF p.deletion_status <> 'delete_requested' THEN RAISE EXCEPTION 'External Pursuit deletion was not requested.'; END IF;
  SELECT actor_user_id,occurred_at INTO request_actor,request_at FROM public.external_pursuit_audit_events WHERE external_pursuit_id=p_dossier_id AND event_type='delete_requested' ORDER BY occurred_at DESC LIMIT 1;
  IF request_actor IS NULL THEN RAISE EXCEPTION 'External Pursuit deletion evidence is missing.'; END IF;
  DELETE FROM public.external_pursuit_contacts WHERE external_pursuit_id=p_dossier_id;
  DELETE FROM public.external_pursuit_notes WHERE external_pursuit_id=p_dossier_id;
  DELETE FROM public.external_pursuit_staff_notes WHERE external_pursuit_id=p_dossier_id;
  INSERT INTO public.external_pursuit_deletion_tombstones (former_dossier_id,owner_repreneur_id,deletion_requested_by,deletion_requested_at,deletion_fulfilled_by,deletion_fulfilled_at,fulfillment_idempotency_key) VALUES (p.id,p.owner_repreneur_id,request_actor,request_at,actor,clock_timestamp(),p_idempotency_key);
  PERFORM set_config('wave.external_pursuit_delete_purge','on',TRUE);
  DELETE FROM public.external_pursuit_audit_events WHERE external_pursuit_id=p_dossier_id;
  DELETE FROM public.external_pursuits WHERE id=p_dossier_id;
END $$;

CREATE OR REPLACE FUNCTION public.request_external_pursuit_deletion(
  p_dossier_id UUID,
  p_actor_user_id TEXT,
  p_idempotency_key TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.external_pursuits%ROWTYPE; actor TEXT := NULLIF(BTRIM(p_actor_user_id), ''); actor_role public.app_user_role;
BEGIN
  SELECT role INTO actor_role FROM public.external_pursuit_actor_context(actor);
  IF actor_role <> 'repreneur' THEN RAISE EXCEPTION 'Only the owner repreneur may request deletion.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_dossier_id::text, 0));
  PERFORM public.assert_external_pursuit_not_converted(p_dossier_id);
  IF EXISTS (SELECT 1 FROM public.external_pursuit_audit_events a WHERE a.external_pursuit_id=p_dossier_id AND a.event_type='delete_requested' AND a.actor_user_id=actor AND a.idempotency_key=p_idempotency_key) THEN RETURN; END IF;
  p := public.assert_external_pursuit_access(p_dossier_id,actor,FALSE);
  IF p.deletion_status <> 'active' OR NULLIF(BTRIM(p_idempotency_key),'') IS NULL THEN RAISE EXCEPTION 'External Pursuit deletion request is invalid.'; END IF;
  UPDATE public.external_pursuits SET deletion_status='delete_requested',updated_by=actor,updated_at=clock_timestamp() WHERE id=p_dossier_id;
  PERFORM public.external_pursuit_append_audit(p_dossier_id,'delete_requested',actor,p_idempotency_key);
END $$;

ALTER TABLE public.external_pursuit_opportunity_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_pursuit_opportunity_conversions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.external_pursuit_opportunity_conversions
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.external_pursuit_opportunity_conversions TO service_role;
REVOKE ALL ON FUNCTION
  public.convert_external_pursuit_to_opportunity(UUID,TEXT,UUID,UUID,UUID,TEXT,TEXT),
  public.assert_external_pursuit_not_converted(UUID),
  public.prepare_external_pursuit_deletion_fulfillment(UUID,TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
  public.convert_external_pursuit_to_opportunity(UUID,TEXT,UUID,UUID,UUID,TEXT,TEXT),
  public.prepare_external_pursuit_deletion_fulfillment(UUID,TEXT)
  TO service_role;

COMMENT ON TABLE public.external_pursuit_opportunity_conversions IS
  'W-109 immutable one-way staff conversion evidence. It retains only dossier and canonical opportunity identities, actor, time and opaque retry key; no dossier content is copied.';
COMMENT ON FUNCTION public.convert_external_pursuit_to_opportunity(UUID,TEXT,UUID,UUID,UUID,TEXT,TEXT) IS
  'W-109 staff-only atomic External Pursuit conversion. It creates one staff-only Draft through canonical opportunity intake with a staff-written safe title, W-039 geography, real office and named primary contact.';
COMMENT ON FUNCTION public.prepare_external_pursuit_deletion_fulfillment(UUID,TEXT) IS
  'W-109 staff-only serialized conversion-state preflight. W-108 must call it before removing attachment storage objects.';

COMMIT;
