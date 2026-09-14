-- Ticket #124 / Decision #123. Additive, no prose backfill or automatic approval.
BEGIN;
ALTER TABLE public.opportunities
  ADD COLUMN public_description_approved_hash TEXT,
  ADD COLUMN public_description_approved_at TIMESTAMPTZ,
  ADD COLUMN public_description_approved_by TEXT,
  ADD CONSTRAINT public_description_approval_complete CHECK (
    (public_description_approved_hash IS NULL AND public_description_approved_at IS NULL AND public_description_approved_by IS NULL)
    OR (public_description_approved_hash ~ '^[0-9a-f]{64}$' AND public_description_approved_hash IS NOT NULL
      AND public_description_approved_at IS NOT NULL AND NULLIF(BTRIM(public_description_approved_by),'') IS NOT NULL)
  );

CREATE FUNCTION public.has_approved_public_description(p_text TEXT,p_hash TEXT,p_at TIMESTAMPTZ,p_by TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT COALESCE(NULLIF(BTRIM(p_text),'') IS NOT NULL AND p_at IS NOT NULL
    AND NULLIF(BTRIM(p_by),'') IS NOT NULL
    AND p_hash=encode(sha256(convert_to(p_text,'UTF8')),'hex'),FALSE)
$$;

CREATE FUNCTION public.safe_public_opportunity_description(p_text TEXT,p_original TEXT,p_hash TEXT,p_at TIMESTAMPTZ,p_by TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT CASE
    WHEN NULLIF(BTRIM(p_text),'') IS NULL THEN NULL
    WHEN p_hash IS NOT NULL OR p_at IS NOT NULL OR p_by IS NOT NULL THEN
      CASE WHEN public.has_approved_public_description(p_text,p_hash,p_at,p_by) THEN p_text ELSE NULL END
    ELSE public.w175_safe_assignment_teaser(p_text,p_original)
  END
$$;

-- Any old/import/direct edit invalidates the previous text-specific approval.
-- The canonical save below records a new confirmation after changing the text.
CREATE FUNCTION public.invalidate_public_description_approval()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW.teaser_summary IS DISTINCT FROM OLD.teaser_summary THEN
    NEW.public_description_approved_hash := NULL;
    NEW.public_description_approved_at := NULL;
    NEW.public_description_approved_by := NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER invalidate_public_description_approval BEFORE UPDATE OF teaser_summary ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_public_description_approval();

CREATE OR REPLACE FUNCTION public.save_opportunity_office_context(
  p_opportunity_id UUID, p_source_office_id UUID DEFAULT NULL, p_affiliation_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_primary_affiliation_id UUID DEFAULT NULL, p_description TEXT DEFAULT NULL,
  p_target_status public.opportunity_status DEFAULT 'draft', p_actor TEXT DEFAULT NULL,
  p_opportunity_fields JSONB DEFAULT '{}'::JSONB
) RETURNS public.opportunities LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  node public.geography_nodes%ROWTYPE;
  saved public.opportunities%ROWTYPE;
  legacy_fields JSONB;
  confirm_day BOOLEAN;
  public_text TEXT;
  approve_public BOOLEAN;
BEGIN
  IF p_opportunity_fields ? 'is_demo' THEN RAISE EXCEPTION 'opportunity_demo_classification_create_only'; END IF;
  IF p_opportunity_fields ? 'public_description_approved' THEN
    IF JSONB_TYPEOF(p_opportunity_fields -> 'public_description_approved') IS DISTINCT FROM 'boolean'
      OR NOT (p_opportunity_fields ? 'teaser_summary')
      OR (SELECT count(*) FROM public.app_user_roles WHERE role='staff' AND user_id=p_actor) <> 1 THEN
      RAISE EXCEPTION 'opportunity_public_description_approval_invalid';
    END IF;
    SELECT * INTO saved FROM public.opportunities WHERE id=p_opportunity_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'opportunity_not_found'; END IF;
    approve_public := (p_opportunity_fields ->> 'public_description_approved')::BOOLEAN;
    public_text := NULLIF(BTRIM(p_opportunity_fields ->> 'teaser_summary'),'');
    IF public_text IS NOT NULL AND public_text IS DISTINCT FROM NULLIF(BTRIM(saved.teaser_summary),'') AND NOT approve_public THEN
      RAISE EXCEPTION 'opportunity_public_description_approval_required';
    END IF;
    -- Both updates are inside the same locked transaction as the source save.
    -- Any lifecycle/contact/history failure below rolls them back together.
    IF public_text IS DISTINCT FROM saved.teaser_summary THEN
      UPDATE public.opportunities SET teaser_summary=public_text WHERE id=p_opportunity_id;
    END IF;
    IF public_text IS NOT NULL AND approve_public THEN
      UPDATE public.opportunities SET
        public_description_approved_hash=encode(sha256(convert_to(public_text,'UTF8')),'hex'),
        public_description_approved_at=clock_timestamp(),public_description_approved_by=p_actor
      WHERE id=p_opportunity_id;
    END IF;
    p_description := NULL; -- retained source text is not part of the new editor
    p_opportunity_fields := jsonb_set(p_opportunity_fields,'{teaser_summary}',COALESCE(to_jsonb(public_text),'null'::JSONB));
  END IF;
  confirm_day := public.validate_w098_date_precision_write(p_opportunity_id,p_opportunity_fields);
  legacy_fields := p_opportunity_fields - ARRAY['geography_node_id','date_added_confirm_day','public_description_approved'];
  saved := public.save_opportunity_office_context_legacy(p_opportunity_id,p_source_office_id,p_affiliation_ids,p_primary_affiliation_id,p_description,p_target_status,p_actor,legacy_fields);
  IF p_opportunity_fields ? 'geography_node_id' THEN
    node := public.resolve_w039_geography_node(p_opportunity_fields ->> 'geography_node_id');
    UPDATE public.opportunities SET geography_node_id=node.id,updated_by=NULLIF(BTRIM(p_actor),''),updated_at=NOW() WHERE id=saved.id RETURNING * INTO saved;
  END IF;
  IF confirm_day THEN
    UPDATE public.opportunities SET date_added_precision='day',updated_by=NULLIF(BTRIM(p_actor),''),updated_at=NOW() WHERE id=saved.id RETURNING * INTO saved;
  END IF;
  RETURN saved;
END $$;

-- Strict creation also ignores legacy prose before its underlying insert.
-- Old clients without the new Boolean control keep their released behavior.
CREATE OR REPLACE FUNCTION public.create_opportunity_with_office_context_v2(
  p_reference TEXT, p_source_office_id UUID DEFAULT NULL, p_affiliation_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_primary_affiliation_id UUID DEFAULT NULL, p_description TEXT DEFAULT NULL,
  p_target_status public.opportunity_status DEFAULT 'draft', p_actor TEXT DEFAULT NULL,
  p_opportunity_fields JSONB DEFAULT '{}'::JSONB
) RETURNS public.opportunities LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE saved public.opportunities%ROWTYPE; initial_is_demo BOOLEAN;
BEGIN
  IF NOT (p_opportunity_fields ? 'is_demo') OR JSONB_TYPEOF(p_opportunity_fields -> 'is_demo') IS DISTINCT FROM 'boolean' THEN
    RAISE EXCEPTION 'opportunity_demo_classification_required';
  END IF;
  initial_is_demo := (p_opportunity_fields ->> 'is_demo')::BOOLEAN;
  IF p_opportunity_fields ? 'public_description_approved' THEN p_description := NULL; END IF;
  saved := public.create_opportunity_with_office_context_legacy_118(
    p_reference,p_source_office_id,p_affiliation_ids,p_primary_affiliation_id,
    p_description,p_target_status,p_actor,p_opportunity_fields - 'is_demo');
  UPDATE public.opportunities SET is_demo=initial_is_demo,demo_classification_created_by=NULLIF(BTRIM(p_actor),''),demo_classification_created_at=clock_timestamp(),updated_by=NULLIF(BTRIM(p_actor),''),updated_at=NOW() WHERE id=saved.id RETURNING * INTO saved;
  RETURN saved;
END $$;
REVOKE ALL ON FUNCTION public.create_opportunity_with_office_context_v2(TEXT,UUID,UUID[],UUID,TEXT,public.opportunity_status,TEXT,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_opportunity_with_office_context_v2(TEXT,UUID,UUID[],UUID,TEXT,public.opportunity_status,TEXT,JSONB) TO service_role;

REVOKE ALL ON FUNCTION public.has_approved_public_description(TEXT,TEXT,TIMESTAMPTZ,TEXT),
  public.safe_public_opportunity_description(TEXT,TEXT,TEXT,TIMESTAMPTZ,TEXT),
  public.invalidate_public_description_approval() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.has_approved_public_description(TEXT,TEXT,TIMESTAMPTZ,TEXT),
  public.safe_public_opportunity_description(TEXT,TEXT,TEXT,TIMESTAMPTZ,TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.save_opportunity_office_context(UUID,UUID,UUID[],UUID,TEXT,public.opportunity_status,TEXT,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_opportunity_office_context(UUID,UUID,UUID[],UUID,TEXT,public.opportunity_status,TEXT,JSONB) TO service_role;

-- Preserve all existing source/contact/history invariants; only the description
-- alternative changes. Public projection schemas and email snapshots stay fixed.
CREATE OR REPLACE FUNCTION public.assert_opportunity_office_context(
  p_opportunity_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  opportunity_row public.opportunities%ROWTYPE;
  office_row public.ma_offices%ROWTYPE;
  active_contact_count INTEGER;
  primary_contact_count INTEGER;
  primary_has_usable_email BOOLEAN;
BEGIN
  SELECT *
  INTO opportunity_row
  FROM public.opportunities
  WHERE id = p_opportunity_id;

  IF opportunity_row.id IS NULL THEN
    RETURN;
  END IF;

  IF opportunity_row.source_office_id IS NULL THEN
    IF opportunity_row.status IN ('active', 'paused') THEN
      RAISE EXCEPTION 'opportunity_activation_requires_source_office';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.opportunity_ma_contacts link
      WHERE link.opportunity_id = opportunity_row.id
        AND link.is_active
    ) THEN
      RAISE EXCEPTION 'opportunity_contact_requires_source_office';
    END IF;

    RETURN;
  END IF;

  SELECT *
  INTO office_row
  FROM public.ma_offices
  WHERE id = opportunity_row.source_office_id;

  IF office_row.id IS NULL THEN
    RAISE EXCEPTION 'opportunity_source_office_not_found';
  END IF;

  -- source_id and source_label are pre-076 compatibility evidence only. They
  -- do not determine or validate the canonical current source office, because
  -- an old opportunity may later be moved through the office model without
  -- rewriting its legacy history.

  IF EXISTS (
    SELECT 1
    FROM public.opportunity_ma_contacts link
    JOIN public.ma_contact_office_affiliations affiliation
      ON affiliation.id = link.affiliation_id
    WHERE link.opportunity_id = opportunity_row.id
      AND link.is_active
      AND affiliation.office_id <> opportunity_row.source_office_id
  ) THEN
    RAISE EXCEPTION 'opportunity_contact_affiliation_office_mismatch';
  END IF;

  -- Closed and archived records retain their source and contact attribution.
  -- Their linked affiliation/contact may later end or archive without
  -- blocking that historical lifecycle. Office/link consistency remains above.
  IF opportunity_row.status IN ('closed', 'archived') THEN
    RETURN;
  END IF;

  -- The view and save RPC hide/reject this already. Keeping the same rule in
  -- the invariant blocks a direct service mutation from selecting a synthetic
  -- default once a real active office exists for that firm.
  IF office_row.is_default
    AND EXISTS (
      SELECT 1
      FROM public.ma_offices real_office
      WHERE real_office.firm_id = office_row.firm_id
        AND real_office.status = 'active'
        AND NOT real_office.is_default
    ) THEN
    RAISE EXCEPTION 'opportunity_source_office_requires_real_office_selection';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.opportunity_ma_contacts link
    JOIN public.ma_contact_office_affiliations affiliation
      ON affiliation.id = link.affiliation_id
    JOIN public.ma_contacts contact ON contact.id = affiliation.contact_id
    WHERE link.opportunity_id = opportunity_row.id
      AND link.is_active
      AND (
        NOT affiliation.is_active
        OR contact.status <> 'active'
      )
  ) THEN
    RAISE EXCEPTION 'opportunity_active_contact_affiliation_must_be_active';
  END IF;

  IF opportunity_row.status NOT IN ('active', 'paused') THEN
    RETURN;
  END IF;

  IF office_row.status <> 'active' THEN
    RAISE EXCEPTION 'opportunity_activation_requires_active_source_office';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.ma_firms firm
    WHERE firm.id = office_row.firm_id
      AND firm.status <> 'archived'
  ) THEN
    RAISE EXCEPTION 'opportunity_activation_requires_non_archived_source_firm';
  END IF;

  IF NULLIF(BTRIM(opportunity_row.description), '') IS NULL
    AND NOT public.has_approved_public_description(opportunity_row.teaser_summary,
      opportunity_row.public_description_approved_hash,opportunity_row.public_description_approved_at,
      opportunity_row.public_description_approved_by) THEN
    RAISE EXCEPTION 'opportunity_activation_requires_description';
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE link.is_primary),
    COALESCE(
      BOOL_OR(
        link.is_primary
        AND affiliation.is_active
        AND contact.status = 'active'
        AND (
          NULLIF(BTRIM(contact.first_name), '') IS NOT NULL
          OR NULLIF(BTRIM(contact.last_name), '') IS NOT NULL
        )
        AND NULLIF(BTRIM(contact.email), '') IS NOT NULL
        AND BTRIM(contact.email) ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      ),
      FALSE
    )
  INTO active_contact_count, primary_contact_count, primary_has_usable_email
  FROM public.opportunity_ma_contacts link
  JOIN public.ma_contact_office_affiliations affiliation
    ON affiliation.id = link.affiliation_id
  JOIN public.ma_contacts contact ON contact.id = affiliation.contact_id
  WHERE link.opportunity_id = opportunity_row.id
    AND link.is_active;

  IF active_contact_count = 0 THEN
    RAISE EXCEPTION 'opportunity_activation_requires_contact';
  END IF;

  IF primary_contact_count <> 1 THEN
    RAISE EXCEPTION 'opportunity_activation_requires_exactly_one_primary_contact';
  END IF;

  IF NOT primary_has_usable_email THEN
    RAISE EXCEPTION 'opportunity_activation_requires_usable_primary_email';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.w164_repreneur_live_inventory(
  p_repreneur_id UUID,
  p_opportunity_id UUID DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  is_demo BOOLEAN,
  reference TEXT,
  public_title TEXT,
  teaser_summary TEXT,
  sector TEXT,
  activity TEXT,
  location TEXT,
  revenue_meur NUMERIC,
  ebitda_keur NUMERIC,
  headcount INTEGER,
  geography_node_id UUID,
  headcount_range TEXT,
  date_added DATE,
  date_added_precision TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT
    opportunity.id,
    opportunity.is_demo,
    'Confidential opportunity'::TEXT,
    COALESCE(NULLIF(BTRIM(opportunity.public_title),''),'Confidential acquisition opportunity'),
    public.safe_public_opportunity_description(opportunity.teaser_summary,opportunity.description,
      opportunity.public_description_approved_hash,opportunity.public_description_approved_at,
      opportunity.public_description_approved_by),
    opportunity.sector,
    opportunity.activity,
    opportunity.location,
    opportunity.revenue_meur,
    opportunity.ebitda_keur,
    opportunity.headcount,
    opportunity.geography_node_id,
    opportunity.headcount_range,
    opportunity.date_added,
    opportunity.date_added_precision,
    opportunity.updated_at
  FROM public.repreneurs repreneur
  JOIN public.opportunities opportunity ON opportunity.is_demo=repreneur.is_demo
  WHERE repreneur.id=p_repreneur_id
    AND opportunity.status='active'
    AND (p_opportunity_id IS NULL OR opportunity.id=p_opportunity_id)
  ORDER BY opportunity.updated_at DESC,opportunity.id
$$;

CREATE OR REPLACE FUNCTION public.w175_record_assignment_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_email TEXT; v_first_name TEXT; v_title TEXT; v_teaser TEXT;
BEGIN
  IF NEW.status <> 'proposed' THEN RETURN NEW; END IF;
  IF (SELECT count(*) FROM public.app_user_roles WHERE role='staff' AND user_id=NEW.created_by) <> 1 THEN
    RAISE EXCEPTION 'recommendation_assignment_staff_required';
  END IF;
  SELECT public.w175_assignment_recipient_email(r.email), COALESCE(NULLIF(BTRIM(r.first_name),''),'Bonjour'),
    COALESCE(NULLIF(BTRIM(o.public_title),''),'Confidential acquisition opportunity'),
    public.safe_public_opportunity_description(o.teaser_summary,o.description,o.public_description_approved_hash,o.public_description_approved_at,o.public_description_approved_by)
  INTO v_email,v_first_name,v_title,v_teaser
  FROM public.opportunities o JOIN public.repreneurs r ON r.id=NEW.repreneur_id
  WHERE o.id=NEW.opportunity_id AND o.status='active' AND o.is_demo=false AND r.is_demo=false;
  IF NOT FOUND THEN RETURN NEW; END IF; -- DEMO never requests external delivery.
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'recommendation_assignment_valid_email_required';
  END IF;
  INSERT INTO public.opportunity_recommendation_assignment_notifications
    (match_id,created_by,recipient_email,recipient_first_name,public_title,teaser_summary)
  VALUES(NEW.id,NEW.created_by,v_email,v_first_name,v_title,v_teaser);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.get_recommendation_assignment_notification(p_match_id UUID,p_actor TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_payload JSONB;
BEGIN
  IF (SELECT count(*) FROM public.app_user_roles WHERE role='staff' AND user_id=p_actor) <> 1 THEN
    RAISE EXCEPTION 'recommendation_assignment_staff_required';
  END IF;
  SELECT jsonb_build_object('id',n.id,'repreneur_id',m.repreneur_id,'recipient_email',n.recipient_email,
    'recipient_first_name',n.recipient_first_name,'public_title',n.public_title,
    'teaser_summary',n.teaser_summary,'email_subject',n.email_subject,'copy_version',n.copy_version)
  INTO v_payload
  FROM public.opportunity_recommendation_assignment_notifications n
  JOIN public.opportunity_matches m ON m.id=n.match_id
  JOIN public.opportunities o ON o.id=m.opportunity_id
  JOIN public.repreneurs r ON r.id=m.repreneur_id
  WHERE n.match_id=p_match_id AND m.status='proposed' AND o.status='active'
    AND o.is_demo=false AND r.is_demo=false
    AND public.w175_assignment_recipient_email(r.email)=n.recipient_email
    AND COALESCE(NULLIF(BTRIM(o.public_title),''),'Confidential acquisition opportunity')=n.public_title
    AND public.safe_public_opportunity_description(o.teaser_summary,o.description,o.public_description_approved_hash,o.public_description_approved_at,o.public_description_approved_by) IS NOT DISTINCT FROM n.teaser_summary
    AND NOT EXISTS(SELECT 1 FROM public.opportunity_matches active
      WHERE active.opportunity_id=o.id AND active.status='active_pursuit');
  RETURN v_payload;
END $$;

COMMIT;
