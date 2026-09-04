-- Ticket #94 rollback. Run this first, then restore the prior application, so
-- that application never reaches a missing endpoint. This intentionally
-- reopens the temporary 117 compatibility path.
BEGIN;

ALTER FUNCTION public.create_opportunity_with_office_context_legacy_118(
  TEXT,UUID,UUID[],UUID,TEXT,public.opportunity_status,TEXT,JSONB
) RENAME TO create_opportunity_with_office_context;
ALTER FUNCTION public.convert_external_pursuit_to_opportunity_legacy_118(
  UUID,TEXT,UUID,UUID,UUID,TEXT,TEXT
) RENAME TO convert_external_pursuit_to_opportunity;

REVOKE ALL ON FUNCTION public.create_opportunity_with_office_context(
  TEXT,UUID,UUID[],UUID,TEXT,public.opportunity_status,TEXT,JSONB
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_opportunity_with_office_context(
  TEXT,UUID,UUID[],UUID,TEXT,public.opportunity_status,TEXT,JSONB
) TO service_role;
REVOKE ALL ON FUNCTION public.convert_external_pursuit_to_opportunity(
  UUID,TEXT,UUID,UUID,UUID,TEXT,TEXT
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.convert_external_pursuit_to_opportunity(
  UUID,TEXT,UUID,UUID,UUID,TEXT,TEXT
) TO service_role;

-- Keep the strict candidate endpoint coherent if a rollback is later reversed.
CREATE OR REPLACE FUNCTION public.create_opportunity_with_office_context_v2(
  p_reference TEXT, p_source_office_id UUID DEFAULT NULL, p_affiliation_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_primary_affiliation_id UUID DEFAULT NULL, p_description TEXT DEFAULT NULL,
  p_target_status public.opportunity_status DEFAULT 'draft', p_actor TEXT DEFAULT NULL,
  p_opportunity_fields JSONB DEFAULT '{}'::JSONB
) RETURNS public.opportunities LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE saved public.opportunities%ROWTYPE; initial_is_demo BOOLEAN;
BEGIN
  IF NOT (p_opportunity_fields ? 'is_demo') OR JSONB_TYPEOF(p_opportunity_fields -> 'is_demo') <> 'boolean' THEN
    RAISE EXCEPTION 'opportunity_demo_classification_required';
  END IF;
  initial_is_demo := (p_opportunity_fields ->> 'is_demo')::BOOLEAN;
  saved := public.create_opportunity_with_office_context(
    p_reference,p_source_office_id,p_affiliation_ids,p_primary_affiliation_id,
    p_description,p_target_status,p_actor,p_opportunity_fields - 'is_demo'
  );
  UPDATE public.opportunities SET is_demo=initial_is_demo,demo_classification_created_by=NULLIF(BTRIM(p_actor),''),demo_classification_created_at=clock_timestamp(),updated_by=NULLIF(BTRIM(p_actor),''),updated_at=NOW() WHERE id=saved.id RETURNING * INTO saved;
  RETURN saved;
END $$;

COMMIT;
