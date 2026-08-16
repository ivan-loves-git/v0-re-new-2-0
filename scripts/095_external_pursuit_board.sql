-- W-106: progressive External Pursuit intake and role-safe board projection.
-- This extends the standalone dossier only. It intentionally has no M&A
-- foreign key, source, match, canonical pursuit, Gate or export side effect.

ALTER TABLE public.external_pursuits
  ADD COLUMN IF NOT EXISTS external_url TEXT,
  ADD COLUMN IF NOT EXISTS target_company TEXT,
  ADD COLUMN IF NOT EXISTS source_channel TEXT,
  ADD COLUMN IF NOT EXISTS revenue_meur NUMERIC,
  ADD COLUMN IF NOT EXISTS ebitda_keur NUMERIC,
  ADD COLUMN IF NOT EXISTS headcount INTEGER;

ALTER TABLE public.external_pursuits
  DROP CONSTRAINT IF EXISTS external_pursuits_revenue_meur_nonnegative,
  DROP CONSTRAINT IF EXISTS external_pursuits_ebitda_keur_nonnegative,
  DROP CONSTRAINT IF EXISTS external_pursuits_headcount_nonnegative;
ALTER TABLE public.external_pursuits
  ADD CONSTRAINT external_pursuits_revenue_meur_nonnegative CHECK (revenue_meur IS NULL OR revenue_meur >= 0),
  ADD CONSTRAINT external_pursuits_ebitda_keur_nonnegative CHECK (ebitda_keur IS NULL OR ebitda_keur >= 0),
  ADD CONSTRAINT external_pursuits_headcount_nonnegative CHECK (headcount IS NULL OR headcount >= 0);

CREATE OR REPLACE FUNCTION public.create_external_pursuit_v2(
  p_owner_repreneur_id UUID, p_title TEXT, p_stage TEXT, p_availability TEXT,
  p_due_at DATE, p_shared_notes TEXT, p_staff_internal_notes TEXT,
  p_external_url TEXT, p_target_company TEXT, p_source_channel TEXT,
  p_revenue_meur NUMERIC, p_ebitda_keur NUMERIC, p_headcount INTEGER,
  p_actor_user_id TEXT, p_idempotency_key TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor TEXT := NULLIF(BTRIM(p_actor_user_id), ''); actor_role public.app_user_role; actor_owner UUID; v_dossier_id UUID;
BEGIN
  IF actor IS NULL OR NULLIF(BTRIM(p_title), '') IS NULL OR NULLIF(BTRIM(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'External Pursuit title and idempotency key are required.';
  END IF;
  SELECT role, repreneur_id INTO actor_role, actor_owner FROM public.external_pursuit_actor_context(actor);
  IF actor_role IS NULL OR (actor_role = 'repreneur' AND actor_owner <> p_owner_repreneur_id) THEN
    RAISE EXCEPTION 'External Pursuit access denied.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(actor || ':' || p_owner_repreneur_id::text || ':' || p_idempotency_key, 0));
  SELECT ep.id INTO v_dossier_id FROM public.external_pursuits ep
    WHERE ep.created_by = actor AND ep.owner_repreneur_id = p_owner_repreneur_id AND ep.create_idempotency_key = p_idempotency_key;
  IF v_dossier_id IS NOT NULL THEN RETURN v_dossier_id; END IF;
  INSERT INTO public.external_pursuits AS inserted_dossier (
    owner_repreneur_id, title, stage, availability, due_at, external_url, target_company, source_channel,
    revenue_meur, ebitda_keur, headcount, create_idempotency_key, created_by, updated_by
  ) VALUES (
    p_owner_repreneur_id, BTRIM(p_title), COALESCE(NULLIF(BTRIM(p_stage), ''), 'identified')::public.external_pursuit_stage,
    COALESCE(NULLIF(BTRIM(p_availability), ''), 'unknown')::public.external_pursuit_availability, p_due_at,
    NULLIF(BTRIM(p_external_url), ''), NULLIF(BTRIM(p_target_company), ''), NULLIF(BTRIM(p_source_channel), ''),
    p_revenue_meur, p_ebitda_keur, p_headcount, p_idempotency_key, actor, actor
  ) ON CONFLICT (created_by, owner_repreneur_id, create_idempotency_key) DO NOTHING
    RETURNING inserted_dossier.id INTO v_dossier_id;
  IF v_dossier_id IS NULL THEN
    SELECT ep.id INTO v_dossier_id FROM public.external_pursuits ep
      WHERE ep.created_by = actor AND ep.owner_repreneur_id = p_owner_repreneur_id AND ep.create_idempotency_key = p_idempotency_key;
    RETURN v_dossier_id;
  END IF;
  INSERT INTO public.external_pursuit_notes (external_pursuit_id, shared_notes, updated_by)
    VALUES (v_dossier_id, NULLIF(BTRIM(p_shared_notes), ''), actor);
  IF actor_role = 'staff' THEN
    INSERT INTO public.external_pursuit_staff_notes (external_pursuit_id, staff_internal_notes, updated_by)
      VALUES (v_dossier_id, NULLIF(BTRIM(p_staff_internal_notes), ''), actor);
  END IF;
  PERFORM public.external_pursuit_append_audit(v_dossier_id, 'created', actor, p_idempotency_key,
    jsonb_build_object('owner_repreneur_id', p_owner_repreneur_id));
  RETURN v_dossier_id;
END $$;

CREATE OR REPLACE FUNCTION public.update_external_pursuit_v2(
  p_dossier_id UUID, p_title TEXT, p_stage TEXT, p_stage_provided BOOLEAN,
  p_availability TEXT, p_availability_provided BOOLEAN, p_due_at DATE, p_due_at_provided BOOLEAN,
  p_shared_notes TEXT, p_shared_notes_provided BOOLEAN, p_staff_internal_notes TEXT, p_staff_notes_provided BOOLEAN,
  p_external_url TEXT, p_external_url_provided BOOLEAN, p_target_company TEXT, p_target_company_provided BOOLEAN,
  p_source_channel TEXT, p_source_channel_provided BOOLEAN, p_revenue_meur NUMERIC, p_revenue_meur_provided BOOLEAN,
  p_ebitda_keur NUMERIC, p_ebitda_keur_provided BOOLEAN, p_headcount INTEGER, p_headcount_provided BOOLEAN,
  p_actor_user_id TEXT, p_idempotency_key TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.external_pursuits%ROWTYPE; actor TEXT := NULLIF(BTRIM(p_actor_user_id), ''); actor_role public.app_user_role;
BEGIN
  IF actor IS NULL OR NULLIF(BTRIM(p_title), '') IS NULL OR NULLIF(BTRIM(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'External Pursuit title and idempotency key are required.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_dossier_id::text, 0));
  p := public.assert_external_pursuit_access(p_dossier_id, actor, FALSE);
  IF p.deletion_status <> 'active' THEN RAISE EXCEPTION 'External Pursuit is not editable.'; END IF;
  SELECT role INTO actor_role FROM public.external_pursuit_actor_context(actor);
  IF EXISTS (SELECT 1 FROM public.external_pursuit_audit_events a WHERE a.external_pursuit_id = p_dossier_id AND a.event_type = 'updated' AND a.actor_user_id = actor AND a.idempotency_key = p_idempotency_key) THEN RETURN; END IF;
  IF actor_role <> 'staff' AND p_staff_notes_provided THEN RAISE EXCEPTION 'External Pursuit access denied.'; END IF;
  UPDATE public.external_pursuits SET
    title = BTRIM(p_title),
    stage = CASE WHEN p_stage_provided THEN NULLIF(BTRIM(p_stage), '')::public.external_pursuit_stage ELSE stage END,
    availability = CASE WHEN p_availability_provided THEN NULLIF(BTRIM(p_availability), '')::public.external_pursuit_availability ELSE availability END,
    due_at = CASE WHEN p_due_at_provided THEN p_due_at ELSE due_at END,
    external_url = CASE WHEN p_external_url_provided THEN NULLIF(BTRIM(p_external_url), '') ELSE external_url END,
    target_company = CASE WHEN p_target_company_provided THEN NULLIF(BTRIM(p_target_company), '') ELSE target_company END,
    source_channel = CASE WHEN p_source_channel_provided THEN NULLIF(BTRIM(p_source_channel), '') ELSE source_channel END,
    revenue_meur = CASE WHEN p_revenue_meur_provided THEN p_revenue_meur ELSE revenue_meur END,
    ebitda_keur = CASE WHEN p_ebitda_keur_provided THEN p_ebitda_keur ELSE ebitda_keur END,
    headcount = CASE WHEN p_headcount_provided THEN p_headcount ELSE headcount END,
    updated_by = actor, updated_at = clock_timestamp()
    WHERE id = p_dossier_id;
  IF p_shared_notes_provided THEN
    INSERT INTO public.external_pursuit_notes (external_pursuit_id, shared_notes, updated_by, updated_at)
      VALUES (p_dossier_id, NULLIF(BTRIM(p_shared_notes), ''), actor, clock_timestamp())
      ON CONFLICT (external_pursuit_id) DO UPDATE SET shared_notes = EXCLUDED.shared_notes, updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at;
  END IF;
  IF p_staff_notes_provided THEN
    INSERT INTO public.external_pursuit_staff_notes (external_pursuit_id, staff_internal_notes, updated_by, updated_at)
      VALUES (p_dossier_id, NULLIF(BTRIM(p_staff_internal_notes), ''), actor, clock_timestamp())
      ON CONFLICT (external_pursuit_id) DO UPDATE SET staff_internal_notes = EXCLUDED.staff_internal_notes, updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at;
  END IF;
  PERFORM public.external_pursuit_append_audit(p_dossier_id, 'updated', actor, p_idempotency_key);
END $$;

CREATE OR REPLACE FUNCTION public.move_external_pursuit_stage(
  p_dossier_id UUID, p_stage TEXT, p_actor_user_id TEXT, p_idempotency_key TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE dossier public.external_pursuits%ROWTYPE; actor TEXT := NULLIF(BTRIM(p_actor_user_id), '');
BEGIN
  IF actor IS NULL OR NULLIF(BTRIM(p_stage), '') IS NULL OR NULLIF(BTRIM(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'External Pursuit stage and idempotency key are required.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_dossier_id::text, 0));
  dossier := public.assert_external_pursuit_access(p_dossier_id, actor, FALSE);
  IF dossier.deletion_status <> 'active' THEN RAISE EXCEPTION 'External Pursuit is not editable.'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.external_pursuit_audit_events audit
    WHERE audit.external_pursuit_id = p_dossier_id AND audit.event_type = 'updated'
      AND audit.actor_user_id = actor AND audit.idempotency_key = p_idempotency_key
  ) THEN RETURN; END IF;
  UPDATE public.external_pursuits
    SET stage = NULLIF(BTRIM(p_stage), '')::public.external_pursuit_stage,
        updated_by = actor, updated_at = clock_timestamp()
    WHERE external_pursuits.id = p_dossier_id;
  PERFORM public.external_pursuit_append_audit(
    p_dossier_id, 'updated', actor, p_idempotency_key,
    jsonb_build_object('field', 'stage', 'stage', p_stage)
  );
END $$;

CREATE OR REPLACE FUNCTION public.external_pursuit_board_for_actor(p_actor_user_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor TEXT := NULLIF(BTRIM(p_actor_user_id), ''); actor_role public.app_user_role; actor_owner UUID;
BEGIN
  SELECT role, repreneur_id INTO actor_role, actor_owner FROM public.external_pursuit_actor_context(actor);
  IF actor_role IS NULL THEN RAISE EXCEPTION 'External Pursuit access denied.'; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', p.id, 'owner_repreneur_id', p.owner_repreneur_id,
      'owner_name', NULLIF(BTRIM(CONCAT_WS(' ', r.first_name, r.last_name)), ''),
      'title', p.title, 'stage', p.stage, 'availability', p.availability, 'deletion_status', p.deletion_status,
      'external_url', p.external_url, 'target_company', p.target_company, 'source_channel', p.source_channel,
      'revenue_meur', p.revenue_meur, 'ebitda_keur', p.ebitda_keur, 'headcount', p.headcount,
      'contacts', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'organisation', c.organisation, 'role_title', c.role_title, 'email', c.email, 'phone', c.phone) ORDER BY c.created_at) FROM public.external_pursuit_contacts c WHERE c.external_pursuit_id = p.id), '[]'::jsonb),
      'updated_at', p.updated_at
    ) ORDER BY p.updated_at DESC)
    FROM public.external_pursuits p
    JOIN public.repreneurs r ON r.id = p.owner_repreneur_id
    WHERE (actor_role = 'staff' OR (p.owner_repreneur_id = actor_owner AND p.deletion_status = 'active'))
  ), '[]'::jsonb);
END $$;

REVOKE ALL ON FUNCTION public.create_external_pursuit_v2(UUID,TEXT,TEXT,TEXT,DATE,TEXT,TEXT,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,INTEGER,TEXT,TEXT), public.update_external_pursuit_v2(UUID,TEXT,TEXT,BOOLEAN,TEXT,BOOLEAN,DATE,BOOLEAN,TEXT,BOOLEAN,TEXT,BOOLEAN,TEXT,BOOLEAN,TEXT,BOOLEAN,TEXT,BOOLEAN,NUMERIC,BOOLEAN,NUMERIC,BOOLEAN,INTEGER,BOOLEAN,TEXT,TEXT), public.move_external_pursuit_stage(UUID,TEXT,TEXT,TEXT), public.external_pursuit_board_for_actor(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_external_pursuit_v2(UUID,TEXT,TEXT,TEXT,DATE,TEXT,TEXT,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,INTEGER,TEXT,TEXT), public.update_external_pursuit_v2(UUID,TEXT,TEXT,BOOLEAN,TEXT,BOOLEAN,DATE,BOOLEAN,TEXT,BOOLEAN,TEXT,BOOLEAN,TEXT,BOOLEAN,TEXT,BOOLEAN,TEXT,BOOLEAN,NUMERIC,BOOLEAN,NUMERIC,BOOLEAN,INTEGER,BOOLEAN,TEXT,TEXT), public.move_external_pursuit_stage(UUID,TEXT,TEXT,TEXT), public.external_pursuit_board_for_actor(TEXT) TO service_role;

COMMENT ON FUNCTION public.external_pursuit_board_for_actor(TEXT) IS 'W-106 role-safe External Pursuit board projection. Pending deletion is staff-only; no canonical M&A record is read or changed.';
