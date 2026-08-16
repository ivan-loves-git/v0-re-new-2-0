-- W-110: staff-only capacity and freshness read model for External Pursuits.
-- This is deliberately separate from Re-New opportunity KPIs, exports,
-- matching and lifecycle state. The only mutable freshness evidence is a
-- deliberate confirmation by the owner or authorised staff.

ALTER TABLE public.external_pursuits
  ADD COLUMN IF NOT EXISTS last_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_confirmed_by TEXT;

ALTER TABLE public.external_pursuits
  DROP CONSTRAINT IF EXISTS external_pursuits_last_confirmation_actor_check;
ALTER TABLE public.external_pursuits
  ADD CONSTRAINT external_pursuits_last_confirmation_actor_check
  CHECK (
    (last_confirmed_at IS NULL AND last_confirmed_by IS NULL)
    OR (
      last_confirmed_at IS NOT NULL
      AND NULLIF(BTRIM(last_confirmed_by), '') IS NOT NULL
    )
  );

CREATE INDEX IF NOT EXISTS external_pursuits_open_capacity_idx
  ON public.external_pursuits (availability, due_at, last_confirmed_at)
  WHERE deletion_status = 'active'
    AND stage NOT IN ('completed', 'dropped_archived');

CREATE OR REPLACE FUNCTION public.confirm_external_pursuit_current(
  p_dossier_id UUID,
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
  actor TEXT := NULLIF(BTRIM(p_actor_user_id), '');
BEGIN
  IF actor IS NULL OR NULLIF(BTRIM(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'An actor and idempotency key are required.';
  END IF;

  -- Migration 099 must follow the corrected migration 098. This is the same
  -- dossier lock used by edit, deletion and conversion, so confirmation can
  -- never race a terminal or converted-state transition.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_dossier_id::TEXT, 0));
  IF EXISTS (
    SELECT 1
    FROM public.external_pursuit_audit_events event
    WHERE event.external_pursuit_id = p_dossier_id
      AND event.event_type = 'updated'
      AND event.actor_user_id = actor
      AND event.idempotency_key = p_idempotency_key
      AND event.metadata->>'confirmation' = 'current'
  ) THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.external_pursuit_audit_events event
    WHERE event.external_pursuit_id = p_dossier_id
      AND event.event_type = 'updated'
      AND event.actor_user_id = actor
      AND event.idempotency_key = p_idempotency_key
  ) THEN
    RAISE EXCEPTION 'External Pursuit confirmation idempotency conflict.';
  END IF;

  -- Staff may confirm any authorised dossier; a repreneur is restricted by
  -- this shared assertion to their own active dossier.
  dossier := public.assert_external_pursuit_access(p_dossier_id, actor, FALSE);
  IF dossier.deletion_status <> 'active'
     OR dossier.stage IN ('completed', 'dropped_archived')
     OR EXISTS (
       SELECT 1
       FROM public.external_pursuit_opportunity_conversions conversion
       WHERE conversion.external_pursuit_id = dossier.id
     ) THEN
    RAISE EXCEPTION 'External Pursuit is not open capacity.';
  END IF;

  UPDATE public.external_pursuits
  SET last_confirmed_at = clock_timestamp(),
      last_confirmed_by = actor,
      updated_at = clock_timestamp(),
      updated_by = actor
  WHERE id = dossier.id;

  PERFORM public.external_pursuit_append_audit(
    dossier.id,
    'updated',
    actor,
    p_idempotency_key,
    jsonb_build_object('confirmation', 'current')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.external_pursuit_capacity_for_staff(
  p_actor_user_id TEXT,
  p_as_of TIMESTAMPTZ DEFAULT clock_timestamp()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor TEXT := NULLIF(BTRIM(p_actor_user_id), '');
  actor_role public.app_user_role;
  as_of_value TIMESTAMPTZ := COALESCE(p_as_of, clock_timestamp());
  paris_today DATE;
  paris_offset_minutes INTEGER;
  paris_timestamp TEXT;
  payload JSONB;
BEGIN
  SELECT role INTO actor_role FROM public.external_pursuit_actor_context(actor);
  IF actor_role <> 'staff' THEN
    RAISE EXCEPTION 'External Pursuit access denied.';
  END IF;

  paris_today := (as_of_value AT TIME ZONE 'Europe/Paris')::DATE;
  paris_offset_minutes := (
    EXTRACT(EPOCH FROM (
      (as_of_value AT TIME ZONE 'Europe/Paris')
      - (as_of_value AT TIME ZONE 'UTC')
    )) / 60
  )::INTEGER;
  paris_timestamp :=
    to_char(as_of_value AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD"T"HH24:MI:SS')
    || CASE WHEN paris_offset_minutes >= 0 THEN '+' ELSE '-' END
    || lpad((ABS(paris_offset_minutes) / 60)::TEXT, 2, '0')
    || ':'
    || lpad((ABS(paris_offset_minutes) % 60)::TEXT, 2, '0');

  WITH open_dossiers AS (
    SELECT
      dossier.id,
      dossier.owner_repreneur_id,
      dossier.title,
      dossier.stage::TEXT AS stage,
      dossier.availability::TEXT AS availability,
      dossier.due_at,
      dossier.last_confirmed_at,
      CASE
        WHEN dossier.last_confirmed_at IS NULL THEN 'unknown'
        WHEN paris_today - (dossier.last_confirmed_at AT TIME ZONE 'Europe/Paris')::DATE <= 30 THEN 'fresh'
        ELSE 'stale'
      END AS freshness,
      CASE
        WHEN dossier.due_at IS NULL THEN 'none'
        WHEN dossier.due_at < paris_today THEN 'overdue'
        WHEN dossier.due_at = paris_today THEN 'today'
        ELSE 'upcoming'
      END AS due_state
    FROM public.external_pursuits dossier
    LEFT JOIN public.external_pursuit_opportunity_conversions conversion
      ON conversion.external_pursuit_id = dossier.id
    WHERE dossier.deletion_status = 'active'
      AND dossier.stage NOT IN ('completed', 'dropped_archived')
      AND conversion.external_pursuit_id IS NULL
  ),
  linked_dossiers AS (
    SELECT
      dossier.id,
      dossier.title,
      dossier.stage::TEXT AS stage,
      conversion.opportunity_id,
      opportunity.reference AS opportunity_reference,
      conversion.converted_at
    FROM public.external_pursuit_opportunity_conversions conversion
    JOIN public.external_pursuits dossier ON dossier.id = conversion.external_pursuit_id
    JOIN public.opportunities opportunity ON opportunity.id = conversion.opportunity_id
  )
  SELECT jsonb_build_object(
    'as_of_paris_date', paris_today,
    'as_of_paris_timestamp', paris_timestamp,
    'open_capacity', jsonb_build_object(
      'total', (SELECT count(*) FROM open_dossiers),
      'stage', jsonb_build_object(
        'identified', (SELECT count(*) FROM open_dossiers WHERE stage = 'identified'),
        'contact_qualification', (SELECT count(*) FROM open_dossiers WHERE stage = 'contact_qualification'),
        'information', (SELECT count(*) FROM open_dossiers WHERE stage = 'information'),
        'meetings', (SELECT count(*) FROM open_dossiers WHERE stage = 'meetings'),
        'negotiation', (SELECT count(*) FROM open_dossiers WHERE stage = 'negotiation'),
        'loi', (SELECT count(*) FROM open_dossiers WHERE stage = 'loi'),
        'due_diligence_financing', (SELECT count(*) FROM open_dossiers WHERE stage = 'due_diligence_financing'),
        'completed', (SELECT count(*) FROM open_dossiers WHERE stage = 'completed'),
        'dropped_archived', (SELECT count(*) FROM open_dossiers WHERE stage = 'dropped_archived')
      ),
      'availability', jsonb_build_object(
        'available', (SELECT count(*) FROM open_dossiers WHERE availability = 'available'),
        'limited', (SELECT count(*) FROM open_dossiers WHERE availability = 'limited'),
        'unavailable', (SELECT count(*) FROM open_dossiers WHERE availability = 'unavailable'),
        'unknown', (SELECT count(*) FROM open_dossiers WHERE availability = 'unknown')
      ),
      'freshness', jsonb_build_object(
        'fresh', (SELECT count(*) FROM open_dossiers WHERE freshness = 'fresh'),
        'stale', (SELECT count(*) FROM open_dossiers WHERE freshness = 'stale'),
        'unknown', (SELECT count(*) FROM open_dossiers WHERE freshness = 'unknown')
      ),
      'due', jsonb_build_object(
        'overdue', (SELECT count(*) FROM open_dossiers WHERE due_state = 'overdue'),
        'today', (SELECT count(*) FROM open_dossiers WHERE due_state = 'today'),
        'upcoming', (SELECT count(*) FROM open_dossiers WHERE due_state = 'upcoming'),
        'none', (SELECT count(*) FROM open_dossiers WHERE due_state = 'none')
      )
    ),
    'open_dossiers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'owner_repreneur_id', owner_repreneur_id,
        'title', title,
        'stage', stage,
        'availability', availability,
        'due_at', due_at,
        'due_state', due_state,
        'last_confirmed_at', last_confirmed_at,
        'freshness', freshness
      ) ORDER BY
        CASE due_state WHEN 'overdue' THEN 0 WHEN 'today' THEN 1 WHEN 'upcoming' THEN 2 ELSE 3 END,
        due_at NULLS LAST,
        title
      ) FROM open_dossiers
    ), '[]'::JSONB),
    'linked_dossiers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'title', title,
        'stage', stage,
        'opportunity_id', opportunity_id,
        'opportunity_reference', opportunity_reference,
        'converted_at', converted_at
      ) ORDER BY converted_at DESC) FROM linked_dossiers
    ), '[]'::JSONB)
  ) INTO payload;

  RETURN payload;
END;
$$;

REVOKE ALL ON FUNCTION
  public.confirm_external_pursuit_current(UUID, TEXT, TEXT),
  public.external_pursuit_capacity_for_staff(TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.confirm_external_pursuit_current(UUID, TEXT, TEXT),
  public.external_pursuit_capacity_for_staff(TEXT, TIMESTAMPTZ)
  TO service_role;

COMMENT ON FUNCTION public.confirm_external_pursuit_current(UUID, TEXT, TEXT) IS
  'W-110 owner-or-authorised-staff explicit freshness evidence for one open, unconverted External Pursuit. Owners are restricted to their own dossier. It uses the corrected W-109 shared dossier lock and changes no Re-New opportunity, matching, canonical pursuit, Gate, export or KPI state.';
COMMENT ON FUNCTION public.external_pursuit_capacity_for_staff(TEXT, TIMESTAMPTZ) IS
  'W-110 staff-only External Pursuit capacity read model. Paris civil dates: fresh through day 30, stale day 31+, today is not overdue. Converted dossiers are reported separately and excluded from open capacity.';
