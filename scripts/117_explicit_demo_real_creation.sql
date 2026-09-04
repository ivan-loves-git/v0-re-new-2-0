-- W-164 / Ticket #94: a staff creator must name the target namespace.
-- Existing rows are deliberately untouched. The create RPC keeps its JSONB
-- arity; `is_demo` is mandatory only for creation and is stripped before the
-- retained legacy writer. The final UPDATE remains in the same transaction.
BEGIN;

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS demo_classification_created_by TEXT,
  ADD COLUMN IF NOT EXISTS demo_classification_created_at TIMESTAMPTZ;

COMMENT ON COLUMN public.opportunities.demo_classification_created_by IS
  'W-164 staff actor that deliberately chose the initial REAL/DEMO classification.';
COMMENT ON COLUMN public.opportunities.demo_classification_created_at IS
  'W-164 time that staff deliberately chose the initial REAL/DEMO classification.';

CREATE OR REPLACE FUNCTION public.save_opportunity_office_context(
  p_opportunity_id UUID, p_source_office_id UUID DEFAULT NULL, p_affiliation_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_primary_affiliation_id UUID DEFAULT NULL, p_description TEXT DEFAULT NULL,
  p_target_status public.opportunity_status DEFAULT 'draft', p_actor TEXT DEFAULT NULL,
  p_opportunity_fields JSONB DEFAULT '{}'::JSONB
) RETURNS public.opportunities LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE node public.geography_nodes%ROWTYPE; saved public.opportunities%ROWTYPE; legacy_fields JSONB; confirm_day BOOLEAN;
BEGIN
  IF p_opportunity_fields ? 'is_demo' THEN RAISE EXCEPTION 'opportunity_demo_classification_create_only'; END IF;
  confirm_day := public.validate_w098_date_precision_write(p_opportunity_id, p_opportunity_fields);
  legacy_fields := p_opportunity_fields - ARRAY['geography_node_id', 'date_added_confirm_day'];
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

CREATE OR REPLACE FUNCTION public.create_opportunity_with_office_context(
  p_reference TEXT, p_source_office_id UUID DEFAULT NULL, p_affiliation_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_primary_affiliation_id UUID DEFAULT NULL, p_description TEXT DEFAULT NULL,
  p_target_status public.opportunity_status DEFAULT 'draft', p_actor TEXT DEFAULT NULL,
  p_opportunity_fields JSONB DEFAULT '{}'::JSONB
) RETURNS public.opportunities LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE node public.geography_nodes%ROWTYPE; allocated BIGINT; initial_sequence BIGINT; generated_reference TEXT; saved public.opportunities%ROWTYPE; enforce_geography BOOLEAN; initial_is_demo BOOLEAN;
BEGIN
  IF NOT (p_opportunity_fields ? 'is_demo') OR JSONB_TYPEOF(p_opportunity_fields -> 'is_demo') <> 'boolean' THEN
    RAISE EXCEPTION 'opportunity_demo_classification_required';
  END IF;
  initial_is_demo := (p_opportunity_fields ->> 'is_demo')::BOOLEAN;
  SELECT enforce_new_opportunity_geography INTO enforce_geography FROM public.ma_w039_release_control WHERE singleton;
  IF NOT enforce_geography AND NOT (p_opportunity_fields ? 'geography_node_id') THEN
    saved := public.create_opportunity_with_office_context_legacy(p_reference,p_source_office_id,p_affiliation_ids,p_primary_affiliation_id,p_description,p_target_status,p_actor,p_opportunity_fields - ARRAY['date_added_confirm_day','is_demo']);
  ELSE
    node := public.resolve_w039_geography_node(p_opportunity_fields ->> 'geography_node_id');
    SELECT COALESCE(MAX((regexp_match(reference, '^Re-New - ' || node.code || ' - ([0-9]+)$', 'i'))[1]::BIGINT),0)+1 INTO initial_sequence FROM public.opportunities WHERE reference ~* ('^Re-New - ' || node.code || ' - [0-9]+$');
    INSERT INTO public.opportunity_mandate_reference_counters(reference_code,next_sequence) VALUES(node.code,initial_sequence+1) ON CONFLICT(reference_code) DO UPDATE SET next_sequence=public.opportunity_mandate_reference_counters.next_sequence+1,updated_at=NOW() RETURNING next_sequence-1 INTO allocated;
    generated_reference := format('Re-New - %s - %s',node.code,CASE WHEN allocated<1000 THEN LPAD(allocated::TEXT,3,'0') ELSE allocated::TEXT END);
    saved := public.create_opportunity_with_office_context_legacy(generated_reference,p_source_office_id,p_affiliation_ids,p_primary_affiliation_id,p_description,p_target_status,p_actor,p_opportunity_fields - ARRAY['geography_node_id','date_added_confirm_day','is_demo']);
    UPDATE public.opportunities SET geography_node_id=node.id,updated_by=NULLIF(BTRIM(p_actor),''),updated_at=NOW() WHERE id=saved.id;
  END IF;
  UPDATE public.opportunities SET is_demo=initial_is_demo,demo_classification_created_by=NULLIF(BTRIM(p_actor),''),demo_classification_created_at=clock_timestamp(),updated_by=NULLIF(BTRIM(p_actor),''),updated_at=NOW() WHERE id=saved.id RETURNING * INTO saved;
  RETURN saved;
END $$;

-- Conversion receives the exact same explicit value and delegates to the
-- canonical creator. Remove the old overload so no caller can omit it.
DROP FUNCTION public.convert_external_pursuit_to_opportunity(UUID,TEXT,UUID,UUID,UUID,TEXT,TEXT);
CREATE FUNCTION public.convert_external_pursuit_to_opportunity(
  p_dossier_id UUID,p_public_title TEXT,p_geography_node_id UUID,p_source_office_id UUID,p_primary_affiliation_id UUID,p_is_demo BOOLEAN,p_actor_user_id TEXT,p_idempotency_key TEXT
) RETURNS TABLE(opportunity_id UUID,opportunity_reference TEXT) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor TEXT:=NULLIF(BTRIM(p_actor_user_id),''); actor_role public.app_user_role; dossier public.external_pursuits%ROWTYPE; existing public.external_pursuit_opportunity_conversions%ROWTYPE; source_office public.ma_offices%ROWTYPE; node public.geography_nodes%ROWTYPE; saved public.opportunities%ROWTYPE; safe_title TEXT:=NULLIF(BTRIM(p_public_title),'');
BEGIN
  IF actor IS NULL OR NULLIF(BTRIM(p_idempotency_key),'') IS NULL THEN RAISE EXCEPTION 'external_pursuit_conversion_actor_and_key_required'; END IF;
  IF p_dossier_id IS NULL OR p_geography_node_id IS NULL OR p_source_office_id IS NULL OR p_primary_affiliation_id IS NULL OR p_is_demo IS NULL OR safe_title IS NULL THEN RAISE EXCEPTION 'external_pursuit_conversion_fields_required'; END IF;
  IF char_length(safe_title)>240 THEN RAISE EXCEPTION 'external_pursuit_conversion_public_title_too_long'; END IF;
  SELECT role INTO actor_role FROM public.external_pursuit_actor_context(actor); IF actor_role IS DISTINCT FROM 'staff' THEN RAISE EXCEPTION 'External Pursuit access denied.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_dossier_id::TEXT,0));
  SELECT * INTO existing FROM public.external_pursuit_opportunity_conversions WHERE external_pursuit_id=p_dossier_id;
  IF FOUND THEN IF existing.converted_by=actor AND existing.idempotency_key=p_idempotency_key THEN RETURN QUERY SELECT existing.opportunity_id,opportunity.reference FROM public.opportunities opportunity WHERE opportunity.id=existing.opportunity_id; RETURN; END IF; RAISE EXCEPTION 'external_pursuit_already_converted'; END IF;
  dossier:=public.assert_external_pursuit_access(p_dossier_id,actor,TRUE); IF dossier.deletion_status<>'active' OR dossier.stage IN ('completed','dropped_archived') THEN RAISE EXCEPTION 'external_pursuit_conversion_requires_active_dossier'; END IF;
  SELECT * INTO source_office FROM public.ma_offices WHERE id=p_source_office_id;
  IF source_office.id IS NULL OR source_office.status<>'active' OR source_office.is_default OR NOT EXISTS(SELECT 1 FROM public.ma_firms firm WHERE firm.id=source_office.firm_id AND firm.status='active') THEN RAISE EXCEPTION 'external_pursuit_conversion_requires_active_real_office'; END IF;
  IF EXISTS(SELECT 1 FROM public.ma_provisional_source_contexts provisional WHERE provisional.context_key='acme_co_paris' AND provisional.office_id=source_office.id) THEN RAISE EXCEPTION 'external_pursuit_conversion_rejects_acme_source'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.ma_contact_office_affiliations affiliation JOIN public.ma_contacts contact ON contact.id=affiliation.contact_id WHERE affiliation.id=p_primary_affiliation_id AND affiliation.office_id=source_office.id AND affiliation.is_active AND contact.status='active' AND NULLIF(BTRIM(contact.display_name),'') IS NOT NULL) THEN RAISE EXCEPTION 'external_pursuit_conversion_requires_active_named_primary_contact'; END IF;
  node:=public.resolve_w039_geography_node(p_geography_node_id::TEXT);
  saved:=public.create_opportunity_with_office_context('',source_office.id,ARRAY[p_primary_affiliation_id],p_primary_affiliation_id,NULL,'draft',actor,jsonb_build_object('geography_node_id',node.id,'public_title',safe_title,'is_demo',p_is_demo));
  INSERT INTO public.external_pursuit_opportunity_conversions(external_pursuit_id,opportunity_id,converted_by,idempotency_key) VALUES(dossier.id,saved.id,actor,p_idempotency_key);
  RETURN QUERY SELECT saved.id,saved.reference;
END $$;

REVOKE ALL ON FUNCTION public.convert_external_pursuit_to_opportunity(UUID,TEXT,UUID,UUID,UUID,BOOLEAN,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.convert_external_pursuit_to_opportunity(UUID,TEXT,UUID,UUID,UUID,BOOLEAN,TEXT,TEXT) TO service_role;
COMMIT;
