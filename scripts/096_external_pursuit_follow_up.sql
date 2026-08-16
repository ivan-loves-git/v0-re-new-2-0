-- W-107: bounded follow-up controls for the isolated External Pursuit domain.
-- This deliberately changes no opportunity, match, canonical pursuit, Gate,
-- M&A, email, notification, export or import record.

DO $$ BEGIN
  CREATE TYPE public.external_pursuit_responsible_party AS ENUM ('owner', 'staff');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.external_pursuits
  ADD COLUMN IF NOT EXISTS next_action TEXT,
  ADD COLUMN IF NOT EXISTS responsible_party public.external_pursuit_responsible_party;

ALTER TABLE public.external_pursuits
  DROP CONSTRAINT IF EXISTS external_pursuits_next_action_responsible_party_check;
ALTER TABLE public.external_pursuits
  ADD CONSTRAINT external_pursuits_next_action_responsible_party_check CHECK (
    (NULLIF(BTRIM(next_action), '') IS NULL AND responsible_party IS NULL)
    OR (NULLIF(BTRIM(next_action), '') IS NOT NULL AND responsible_party IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION public.update_external_pursuit_follow_up(
  p_dossier_id UUID,
  p_next_action TEXT,
  p_next_action_provided BOOLEAN,
  p_responsible_party TEXT,
  p_responsible_party_provided BOOLEAN,
  p_availability TEXT,
  p_availability_provided BOOLEAN,
  p_due_at DATE,
  p_due_at_provided BOOLEAN,
  p_shared_notes TEXT,
  p_shared_notes_provided BOOLEAN,
  p_staff_internal_notes TEXT,
  p_staff_notes_provided BOOLEAN,
  p_actor_user_id TEXT,
  p_idempotency_key TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  dossier public.external_pursuits%ROWTYPE;
  actor_role public.app_user_role;
  actor TEXT := NULLIF(BTRIM(p_actor_user_id), '');
  normalized_action TEXT := NULLIF(BTRIM(p_next_action), '');
  normalized_responsible TEXT := NULLIF(BTRIM(p_responsible_party), '');
  normalized_availability TEXT := NULLIF(BTRIM(p_availability), '');
BEGIN
  IF NULLIF(BTRIM(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'An idempotency key is required.';
  END IF;
  IF p_next_action_provided IS DISTINCT FROM p_responsible_party_provided THEN
    RAISE EXCEPTION 'Next action and responsible party must be changed together.';
  END IF;
  IF p_next_action_provided AND (
    (normalized_action IS NULL AND normalized_responsible IS NOT NULL)
    OR (normalized_action IS NOT NULL AND normalized_responsible IS NULL)
  ) THEN
    RAISE EXCEPTION 'A next action requires one responsible party.';
  END IF;
  IF p_availability_provided AND normalized_availability IS NULL THEN
    RAISE EXCEPTION 'Availability is required.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_dossier_id::text, 0));
  dossier := public.assert_external_pursuit_access(p_dossier_id, actor, FALSE);
  SELECT role INTO actor_role FROM public.external_pursuit_actor_context(actor);

  IF EXISTS (
    SELECT 1 FROM public.external_pursuit_audit_events audit
    WHERE audit.external_pursuit_id = p_dossier_id
      AND audit.event_type = 'updated'
      AND audit.actor_user_id = actor
      AND audit.idempotency_key = p_idempotency_key
  ) THEN
    RETURN;
  END IF;
  IF dossier.deletion_status <> 'active' THEN
    RAISE EXCEPTION 'External Pursuit is not editable.';
  END IF;
  IF actor_role <> 'staff' AND p_staff_notes_provided THEN
    RAISE EXCEPTION 'Only staff may change internal notes.';
  END IF;

  UPDATE public.external_pursuits pursuit
  SET next_action = CASE WHEN p_next_action_provided THEN normalized_action ELSE pursuit.next_action END,
      responsible_party = CASE
        WHEN p_responsible_party_provided THEN normalized_responsible::public.external_pursuit_responsible_party
        ELSE pursuit.responsible_party
      END,
      availability = CASE
        WHEN p_availability_provided THEN normalized_availability::public.external_pursuit_availability
        ELSE pursuit.availability
      END,
      due_at = CASE WHEN p_due_at_provided THEN p_due_at ELSE pursuit.due_at END,
      updated_by = actor,
      updated_at = clock_timestamp()
  WHERE pursuit.id = p_dossier_id;

  IF p_shared_notes_provided THEN
    INSERT INTO public.external_pursuit_notes (external_pursuit_id, shared_notes, updated_by, updated_at)
    VALUES (p_dossier_id, NULLIF(BTRIM(p_shared_notes), ''), actor, clock_timestamp())
    ON CONFLICT (external_pursuit_id) DO UPDATE
      SET shared_notes = EXCLUDED.shared_notes,
          updated_by = EXCLUDED.updated_by,
          updated_at = EXCLUDED.updated_at;
  END IF;
  IF p_staff_notes_provided THEN
    INSERT INTO public.external_pursuit_staff_notes (external_pursuit_id, staff_internal_notes, updated_by, updated_at)
    VALUES (p_dossier_id, NULLIF(BTRIM(p_staff_internal_notes), ''), actor, clock_timestamp())
    ON CONFLICT (external_pursuit_id) DO UPDATE
      SET staff_internal_notes = EXCLUDED.staff_internal_notes,
          updated_by = EXCLUDED.updated_by,
          updated_at = EXCLUDED.updated_at;
  END IF;

  PERFORM public.external_pursuit_append_audit(
    p_dossier_id,
    'updated',
    actor,
    p_idempotency_key,
    jsonb_build_object(
      'follow_up', TRUE,
      'next_action_changed', p_next_action_provided,
      'responsible_party_changed', p_responsible_party_provided,
      'availability_changed', p_availability_provided,
      'due_at_changed', p_due_at_provided,
      'shared_notes_changed', p_shared_notes_provided,
      'staff_notes_changed', p_staff_notes_provided
    )
  );
END $$;

CREATE OR REPLACE FUNCTION public.external_pursuit_for_actor(p_dossier_id UUID,p_actor_user_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.external_pursuits%ROWTYPE; actor_role public.app_user_role; actor TEXT := NULLIF(BTRIM(p_actor_user_id), '');
BEGIN
  p := public.assert_external_pursuit_access(p_dossier_id,actor,FALSE); SELECT role INTO actor_role FROM public.external_pursuit_actor_context(actor);
  IF actor_role='staff' THEN RETURN jsonb_build_object('pursuit',jsonb_build_object('id',p.id,'owner_repreneur_id',p.owner_repreneur_id,'title',p.title,'stage',p.stage,'availability',p.availability,'next_action',p.next_action,'responsible_party',p.responsible_party,'due_at',p.due_at,'external_url',p.external_url,'target_company',p.target_company,'source_channel',p.source_channel,'revenue_meur',p.revenue_meur,'ebitda_keur',p.ebitda_keur,'headcount',p.headcount,'deletion_status',p.deletion_status,'created_by',p.created_by,'created_at',p.created_at,'updated_by',p.updated_by,'updated_at',p.updated_at),'shared_notes',COALESCE((SELECT shared_notes FROM public.external_pursuit_notes WHERE external_pursuit_id=p.id),NULL),'staff_internal_notes',COALESCE((SELECT staff_internal_notes FROM public.external_pursuit_staff_notes WHERE external_pursuit_id=p.id),NULL),'contacts',COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.created_at) FROM public.external_pursuit_contacts c WHERE c.external_pursuit_id=p.id),'[]'::jsonb),'audit',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'event_type',a.event_type,'actor_user_id',a.actor_user_id,'occurred_at',a.occurred_at,'metadata',a.metadata) ORDER BY a.occurred_at) FROM public.external_pursuit_audit_events a WHERE a.external_pursuit_id=p.id),'[]'::jsonb)); END IF;
  RETURN jsonb_build_object('pursuit',jsonb_build_object('id',p.id,'owner_repreneur_id',p.owner_repreneur_id,'title',p.title,'stage',p.stage,'availability',p.availability,'next_action',p.next_action,'responsible_party',p.responsible_party,'due_at',p.due_at,'external_url',p.external_url,'target_company',p.target_company,'source_channel',p.source_channel,'revenue_meur',p.revenue_meur,'ebitda_keur',p.ebitda_keur,'headcount',p.headcount,'deletion_status',p.deletion_status,'created_at',p.created_at,'updated_at',p.updated_at),'shared_notes',COALESCE((SELECT shared_notes FROM public.external_pursuit_notes WHERE external_pursuit_id=p.id),NULL),'contacts',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'organisation',c.organisation,'role_title',c.role_title,'email',c.email,'phone',c.phone,'created_at',c.created_at,'updated_at',c.updated_at) ORDER BY c.created_at) FROM public.external_pursuit_contacts c WHERE c.external_pursuit_id=p.id),'[]'::jsonb));
END $$;

REVOKE ALL ON FUNCTION public.update_external_pursuit_follow_up(UUID,TEXT,BOOLEAN,TEXT,BOOLEAN,TEXT,BOOLEAN,DATE,BOOLEAN,TEXT,BOOLEAN,TEXT,BOOLEAN,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.update_external_pursuit_follow_up(UUID,TEXT,BOOLEAN,TEXT,BOOLEAN,TEXT,BOOLEAN,DATE,BOOLEAN,TEXT,BOOLEAN,TEXT,BOOLEAN,TEXT,TEXT) TO service_role;

COMMENT ON COLUMN public.external_pursuits.next_action IS 'W-107 optional concrete next action for an isolated External Pursuit. No notification, task or canonical-pursuit effect.';
COMMENT ON COLUMN public.external_pursuits.responsible_party IS 'W-107 owner or Re-New staff responsibility for the paired next action.';
