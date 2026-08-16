-- W-105: isolated External Pursuit persistence and authorization foundation.
-- It deliberately has no foreign key to opportunities, matches, canonical
-- pursuits, M&A entities, exports, Gate 1 or Gate 2.

DO $$ BEGIN
  CREATE TYPE public.external_pursuit_stage AS ENUM (
    'identified', 'contact_qualification', 'information', 'meetings',
    'negotiation', 'loi', 'due_diligence_financing', 'completed', 'dropped_archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.external_pursuit_availability AS ENUM ('available', 'limited', 'unavailable', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.external_pursuit_deletion_status AS ENUM ('active', 'delete_requested', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.external_pursuit_audit_event_type AS ENUM ('created', 'updated', 'contact_created', 'contact_updated', 'delete_requested', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.external_pursuits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_repreneur_id UUID NOT NULL REFERENCES public.repreneurs(id) ON DELETE RESTRICT,
  title TEXT,
  stage public.external_pursuit_stage NOT NULL DEFAULT 'identified',
  availability public.external_pursuit_availability NOT NULL DEFAULT 'unknown',
  due_at DATE,
  deletion_status public.external_pursuit_deletion_status NOT NULL DEFAULT 'active',
  create_idempotency_key TEXT NOT NULL CHECK (NULLIF(BTRIM(create_idempotency_key), '') IS NOT NULL),
  created_by TEXT NOT NULL CHECK (NULLIF(BTRIM(created_by), '') IS NOT NULL),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_by TEXT NOT NULL CHECK (NULLIF(BTRIM(updated_by), '') IS NOT NULL),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (created_by, owner_repreneur_id, create_idempotency_key),
  CHECK ((deletion_status <> 'deleted' AND NULLIF(BTRIM(title), '') IS NOT NULL) OR deletion_status = 'deleted')
);
CREATE INDEX IF NOT EXISTS external_pursuits_owner_idx ON public.external_pursuits (owner_repreneur_id, updated_at DESC);

-- Owner-visible and staff-only notes are physically separate, so a normal owner
-- projection cannot accidentally select internal content.
CREATE TABLE IF NOT EXISTS public.external_pursuit_notes (
  external_pursuit_id UUID PRIMARY KEY REFERENCES public.external_pursuits(id) ON DELETE RESTRICT,
  shared_notes TEXT,
  updated_by TEXT NOT NULL CHECK (NULLIF(BTRIM(updated_by), '') IS NOT NULL),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS public.external_pursuit_staff_notes (
  external_pursuit_id UUID PRIMARY KEY REFERENCES public.external_pursuits(id) ON DELETE RESTRICT,
  staff_internal_notes TEXT,
  updated_by TEXT NOT NULL CHECK (NULLIF(BTRIM(updated_by), '') IS NOT NULL),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS public.external_pursuit_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_pursuit_id UUID NOT NULL REFERENCES public.external_pursuits(id) ON DELETE RESTRICT,
  name TEXT,
  organisation TEXT,
  role_title TEXT,
  email TEXT,
  phone TEXT,
  created_by TEXT NOT NULL CHECK (NULLIF(BTRIM(created_by), '') IS NOT NULL),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_by TEXT NOT NULL CHECK (NULLIF(BTRIM(updated_by), '') IS NOT NULL),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (NULLIF(BTRIM(name), '') IS NOT NULL OR NULLIF(BTRIM(organisation), '') IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS external_pursuit_contacts_pursuit_idx ON public.external_pursuit_contacts (external_pursuit_id, created_at);

CREATE TABLE IF NOT EXISTS public.external_pursuit_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_pursuit_id UUID NOT NULL REFERENCES public.external_pursuits(id) ON DELETE RESTRICT,
  event_type public.external_pursuit_audit_event_type NOT NULL,
  actor_user_id TEXT NOT NULL CHECK (NULLIF(BTRIM(actor_user_id), '') IS NOT NULL),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  idempotency_key TEXT NOT NULL CHECK (NULLIF(BTRIM(idempotency_key), '') IS NOT NULL),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(metadata) = 'object'),
  UNIQUE (external_pursuit_id, event_type, actor_user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS external_pursuit_audit_events_pursuit_idx ON public.external_pursuit_audit_events (external_pursuit_id, occurred_at);

-- Only this minimum identity survives deletion. It deliberately has no title,
-- notes, contact, file or event payload.
CREATE TABLE IF NOT EXISTS public.external_pursuit_deletion_tombstones (
  former_dossier_id UUID PRIMARY KEY,
  owner_repreneur_id UUID NOT NULL REFERENCES public.repreneurs(id) ON DELETE RESTRICT,
  deletion_requested_by TEXT NOT NULL,
  deletion_requested_at TIMESTAMPTZ NOT NULL,
  deletion_fulfilled_by TEXT NOT NULL,
  deletion_fulfilled_at TIMESTAMPTZ NOT NULL,
  fulfillment_idempotency_key TEXT NOT NULL UNIQUE
);

CREATE OR REPLACE FUNCTION public.reject_external_pursuit_audit_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('wave.external_pursuit_delete_purge', TRUE) = 'on' THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'External Pursuit audit is immutable.';
END $$;
DROP TRIGGER IF EXISTS external_pursuit_audit_events_immutable ON public.external_pursuit_audit_events;
CREATE TRIGGER external_pursuit_audit_events_immutable BEFORE UPDATE OR DELETE ON public.external_pursuit_audit_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_external_pursuit_audit_mutation();

CREATE OR REPLACE FUNCTION public.external_pursuit_actor_context(p_actor_user_id TEXT)
RETURNS TABLE (role public.app_user_role, repreneur_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT r.role, r.repreneur_id FROM public.app_user_roles r
  WHERE r.user_id = NULLIF(BTRIM(p_actor_user_id), '')
  ORDER BY CASE r.role WHEN 'staff' THEN 0 ELSE 1 END LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.assert_external_pursuit_access(p_dossier_id UUID, p_actor_user_id TEXT, p_staff_only BOOLEAN DEFAULT FALSE)
RETURNS public.external_pursuits LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.external_pursuits%ROWTYPE; r public.app_user_role; owner_id UUID;
BEGIN
  SELECT * INTO p FROM public.external_pursuits WHERE id = p_dossier_id;
  IF p.id IS NULL THEN RAISE EXCEPTION 'External Pursuit not found.'; END IF;
  SELECT role, repreneur_id INTO r, owner_id FROM public.external_pursuit_actor_context(p_actor_user_id);
  IF r = 'staff' THEN RETURN p; END IF;
  IF p_staff_only OR r IS DISTINCT FROM 'repreneur' OR owner_id IS NULL OR owner_id <> p.owner_repreneur_id OR p.deletion_status <> 'active' THEN RAISE EXCEPTION 'External Pursuit access denied.'; END IF;
  RETURN p;
END $$;

CREATE OR REPLACE FUNCTION public.external_pursuit_append_audit(p_dossier_id UUID, p_event public.external_pursuit_audit_event_type, p_actor TEXT, p_key TEXT, p_metadata JSONB DEFAULT '{}'::JSONB)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.external_pursuit_audit_events (external_pursuit_id,event_type,actor_user_id,idempotency_key,metadata)
  VALUES (p_dossier_id,p_event,p_actor,p_key,COALESCE(p_metadata,'{}'::jsonb)) ON CONFLICT DO NOTHING
$$;

CREATE OR REPLACE FUNCTION public.create_external_pursuit(p_owner_repreneur_id UUID, p_title TEXT, p_stage TEXT, p_availability TEXT, p_due_at DATE, p_shared_notes TEXT, p_staff_internal_notes TEXT, p_actor_user_id TEXT, p_idempotency_key TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor_role public.app_user_role; actor_owner UUID; id UUID; actor TEXT := NULLIF(BTRIM(p_actor_user_id), '');
BEGIN
  SELECT role, repreneur_id INTO actor_role, actor_owner FROM public.external_pursuit_actor_context(actor);
  IF actor_role IS NULL OR (actor_role <> 'staff' AND (actor_role <> 'repreneur' OR actor_owner <> p_owner_repreneur_id)) THEN RAISE EXCEPTION 'External Pursuit access denied.'; END IF;
  IF NULLIF(BTRIM(p_title), '') IS NULL OR NULLIF(BTRIM(p_idempotency_key), '') IS NULL THEN RAISE EXCEPTION 'A title and idempotency key are required.'; END IF;
  IF actor_role <> 'staff' AND NULLIF(BTRIM(p_staff_internal_notes), '') IS NOT NULL THEN RAISE EXCEPTION 'Only staff may set internal notes.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(actor || ':' || p_owner_repreneur_id::text || ':' || p_idempotency_key, 0));
  SELECT ep.id INTO id FROM public.external_pursuits ep WHERE ep.created_by=actor AND ep.owner_repreneur_id=p_owner_repreneur_id AND ep.create_idempotency_key = p_idempotency_key;
  IF id IS NOT NULL THEN RETURN id; END IF;
  INSERT INTO public.external_pursuits (owner_repreneur_id,title,stage,availability,due_at,create_idempotency_key,created_by,updated_by)
  VALUES (p_owner_repreneur_id,BTRIM(p_title),COALESCE(NULLIF(BTRIM(p_stage), ''),'identified')::public.external_pursuit_stage,COALESCE(NULLIF(BTRIM(p_availability), ''),'unknown')::public.external_pursuit_availability,p_due_at,p_idempotency_key,actor,actor)
  ON CONFLICT (created_by,owner_repreneur_id,create_idempotency_key) DO NOTHING RETURNING external_pursuits.id INTO id;
  IF id IS NULL THEN SELECT ep.id INTO id FROM public.external_pursuits ep WHERE ep.created_by=actor AND ep.owner_repreneur_id=p_owner_repreneur_id AND ep.create_idempotency_key=p_idempotency_key; RETURN id; END IF;
  INSERT INTO public.external_pursuit_notes (external_pursuit_id,shared_notes,updated_by) VALUES (id,NULLIF(BTRIM(p_shared_notes),''),actor);
  IF actor_role = 'staff' THEN INSERT INTO public.external_pursuit_staff_notes (external_pursuit_id,staff_internal_notes,updated_by) VALUES (id,NULLIF(BTRIM(p_staff_internal_notes),''),actor); END IF;
  PERFORM public.external_pursuit_append_audit(id,'created',actor,p_idempotency_key,jsonb_build_object('owner_repreneur_id',p_owner_repreneur_id));
  RETURN id;
END $$;

CREATE OR REPLACE FUNCTION public.update_external_pursuit(p_dossier_id UUID, p_title TEXT, p_stage TEXT, p_stage_provided BOOLEAN, p_availability TEXT, p_availability_provided BOOLEAN, p_due_at DATE, p_due_at_provided BOOLEAN, p_shared_notes TEXT, p_shared_notes_provided BOOLEAN, p_staff_internal_notes TEXT, p_staff_notes_provided BOOLEAN, p_actor_user_id TEXT, p_idempotency_key TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.external_pursuits%ROWTYPE; actor_role public.app_user_role; actor TEXT := NULLIF(BTRIM(p_actor_user_id), '');
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_dossier_id::text, 0));
  p := public.assert_external_pursuit_access(p_dossier_id,actor,FALSE); SELECT role INTO actor_role FROM public.external_pursuit_actor_context(actor);
  IF EXISTS (SELECT 1 FROM public.external_pursuit_audit_events a WHERE a.external_pursuit_id=p_dossier_id AND a.event_type='updated' AND a.actor_user_id=actor AND a.idempotency_key=p_idempotency_key) THEN RETURN; END IF;
  IF p.deletion_status <> 'active' THEN RAISE EXCEPTION 'External Pursuit is not editable.'; END IF;
  IF NULLIF(BTRIM(p_title), '') IS NULL OR NULLIF(BTRIM(p_idempotency_key), '') IS NULL THEN RAISE EXCEPTION 'A title and idempotency key are required.'; END IF;
  IF actor_role <> 'staff' AND p_staff_notes_provided THEN RAISE EXCEPTION 'Only staff may change internal notes.'; END IF;
  UPDATE public.external_pursuits SET title=BTRIM(p_title),stage=CASE WHEN p_stage_provided THEN NULLIF(BTRIM(p_stage),'')::public.external_pursuit_stage ELSE stage END,availability=CASE WHEN p_availability_provided THEN NULLIF(BTRIM(p_availability),'')::public.external_pursuit_availability ELSE availability END,due_at=CASE WHEN p_due_at_provided THEN p_due_at ELSE due_at END,updated_by=actor,updated_at=clock_timestamp() WHERE id=p_dossier_id;
  IF p_shared_notes_provided THEN INSERT INTO public.external_pursuit_notes (external_pursuit_id,shared_notes,updated_by,updated_at) VALUES (p_dossier_id,NULLIF(BTRIM(p_shared_notes),''),actor,clock_timestamp()) ON CONFLICT (external_pursuit_id) DO UPDATE SET shared_notes=EXCLUDED.shared_notes,updated_by=EXCLUDED.updated_by,updated_at=EXCLUDED.updated_at; END IF;
  IF p_staff_notes_provided THEN INSERT INTO public.external_pursuit_staff_notes (external_pursuit_id,staff_internal_notes,updated_by,updated_at) VALUES (p_dossier_id,NULLIF(BTRIM(p_staff_internal_notes),''),actor,clock_timestamp()) ON CONFLICT (external_pursuit_id) DO UPDATE SET staff_internal_notes=EXCLUDED.staff_internal_notes,updated_by=EXCLUDED.updated_by,updated_at=EXCLUDED.updated_at; END IF;
  PERFORM public.external_pursuit_append_audit(p_dossier_id,'updated',actor,p_idempotency_key);
END $$;

CREATE OR REPLACE FUNCTION public.save_external_pursuit_contact(p_dossier_id UUID,p_contact_id UUID,p_name TEXT,p_organisation TEXT,p_role_title TEXT,p_email TEXT,p_phone TEXT,p_actor_user_id TEXT,p_idempotency_key TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.external_pursuits%ROWTYPE; v_contact_id UUID := p_contact_id; actor TEXT := NULLIF(BTRIM(p_actor_user_id), ''); event_type public.external_pursuit_audit_event_type; replay JSONB;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_dossier_id::text, 0));
  p := public.assert_external_pursuit_access(p_dossier_id,actor,FALSE);
  SELECT metadata INTO replay FROM public.external_pursuit_audit_events a WHERE a.external_pursuit_id=p_dossier_id AND a.actor_user_id=actor AND a.idempotency_key=p_idempotency_key AND a.event_type IN ('contact_created','contact_updated') ORDER BY a.occurred_at DESC LIMIT 1;
  IF replay IS NOT NULL THEN RETURN (replay->>'contact_id')::UUID; END IF;
  IF p.deletion_status <> 'active' THEN RAISE EXCEPTION 'External Pursuit is not editable.'; END IF;
  IF (NULLIF(BTRIM(p_name),'') IS NULL AND NULLIF(BTRIM(p_organisation),'') IS NULL) OR NULLIF(BTRIM(p_idempotency_key),'') IS NULL THEN RAISE EXCEPTION 'A contact needs a name or organisation and an idempotency key.'; END IF;
  IF v_contact_id IS NULL THEN INSERT INTO public.external_pursuit_contacts (external_pursuit_id,name,organisation,role_title,email,phone,created_by,updated_by) VALUES (p_dossier_id,NULLIF(BTRIM(p_name),''),NULLIF(BTRIM(p_organisation),''),NULLIF(BTRIM(p_role_title),''),NULLIF(BTRIM(p_email),''),NULLIF(BTRIM(p_phone),''),actor,actor) RETURNING id INTO v_contact_id; event_type := 'contact_created';
  ELSE IF NOT EXISTS (SELECT 1 FROM public.external_pursuit_contacts c WHERE c.id=v_contact_id AND c.external_pursuit_id=p_dossier_id) THEN RAISE EXCEPTION 'External Pursuit contact not found.'; END IF; UPDATE public.external_pursuit_contacts c SET name=NULLIF(BTRIM(p_name),''),organisation=NULLIF(BTRIM(p_organisation),''),role_title=NULLIF(BTRIM(p_role_title),''),email=NULLIF(BTRIM(p_email),''),phone=NULLIF(BTRIM(p_phone),''),updated_by=actor,updated_at=clock_timestamp() WHERE c.id=v_contact_id; event_type := 'contact_updated'; END IF;
  PERFORM public.external_pursuit_append_audit(p_dossier_id,event_type,actor,p_idempotency_key,jsonb_build_object('contact_id',v_contact_id)); RETURN v_contact_id;
END $$;

CREATE OR REPLACE FUNCTION public.request_external_pursuit_deletion(p_dossier_id UUID,p_actor_user_id TEXT,p_idempotency_key TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.external_pursuits%ROWTYPE; actor TEXT := NULLIF(BTRIM(p_actor_user_id), ''); actor_role public.app_user_role;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_dossier_id::text, 0));
  SELECT role INTO actor_role FROM public.external_pursuit_actor_context(actor);
  IF actor_role = 'repreneur' AND EXISTS (SELECT 1 FROM public.external_pursuit_audit_events a WHERE a.external_pursuit_id=p_dossier_id AND a.event_type='delete_requested' AND a.actor_user_id=actor AND a.idempotency_key=p_idempotency_key) THEN RETURN; END IF;
  p := public.assert_external_pursuit_access(p_dossier_id,actor,FALSE);
  IF actor_role <> 'repreneur' THEN RAISE EXCEPTION 'Only the owner repreneur may request deletion.'; END IF;
  IF p.deletion_status <> 'active' OR NULLIF(BTRIM(p_idempotency_key),'') IS NULL THEN RAISE EXCEPTION 'External Pursuit deletion request is invalid.'; END IF;
  UPDATE public.external_pursuits SET deletion_status='delete_requested',updated_by=actor,updated_at=clock_timestamp() WHERE id=p_dossier_id;
  PERFORM public.external_pursuit_append_audit(p_dossier_id,'delete_requested',actor,p_idempotency_key);
END $$;

CREATE OR REPLACE FUNCTION public.fulfill_external_pursuit_deletion(p_dossier_id UUID,p_actor_user_id TEXT,p_idempotency_key TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.external_pursuits%ROWTYPE; actor TEXT := NULLIF(BTRIM(p_actor_user_id), ''); request_actor TEXT; request_at TIMESTAMPTZ; actor_role public.app_user_role; stored_key TEXT;
BEGIN
  IF NULLIF(BTRIM(p_idempotency_key),'') IS NULL THEN RAISE EXCEPTION 'An idempotency key is required.'; END IF;
  SELECT role INTO actor_role FROM public.external_pursuit_actor_context(actor);
  IF actor_role <> 'staff' THEN RAISE EXCEPTION 'External Pursuit access denied.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_dossier_id::text, 0));
  SELECT fulfillment_idempotency_key INTO stored_key FROM public.external_pursuit_deletion_tombstones WHERE former_dossier_id=p_dossier_id;
  IF stored_key IS NOT NULL THEN
    IF stored_key = p_idempotency_key THEN RETURN; END IF;
    RAISE EXCEPTION 'External Pursuit deletion fulfillment idempotency conflict.';
  END IF;
  p := public.assert_external_pursuit_access(p_dossier_id,actor,TRUE);
  IF p.deletion_status <> 'delete_requested' OR NULLIF(BTRIM(p_idempotency_key),'') IS NULL THEN RAISE EXCEPTION 'External Pursuit deletion was not requested.'; END IF;
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

CREATE OR REPLACE FUNCTION public.external_pursuit_for_actor(p_dossier_id UUID,p_actor_user_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.external_pursuits%ROWTYPE; actor_role public.app_user_role; actor TEXT := NULLIF(BTRIM(p_actor_user_id), '');
BEGIN
  p := public.assert_external_pursuit_access(p_dossier_id,actor,FALSE); SELECT role INTO actor_role FROM public.external_pursuit_actor_context(actor);
  IF actor_role='staff' THEN RETURN jsonb_build_object('pursuit',jsonb_build_object('id',p.id,'owner_repreneur_id',p.owner_repreneur_id,'title',p.title,'stage',p.stage,'availability',p.availability,'due_at',p.due_at,'deletion_status',p.deletion_status,'created_by',p.created_by,'created_at',p.created_at,'updated_by',p.updated_by,'updated_at',p.updated_at),'shared_notes',COALESCE((SELECT shared_notes FROM public.external_pursuit_notes WHERE external_pursuit_id=p.id),NULL),'staff_internal_notes',COALESCE((SELECT staff_internal_notes FROM public.external_pursuit_staff_notes WHERE external_pursuit_id=p.id),NULL),'contacts',COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.created_at) FROM public.external_pursuit_contacts c WHERE c.external_pursuit_id=p.id),'[]'::jsonb),'audit',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'event_type',a.event_type,'actor_user_id',a.actor_user_id,'occurred_at',a.occurred_at,'metadata',a.metadata) ORDER BY a.occurred_at) FROM public.external_pursuit_audit_events a WHERE a.external_pursuit_id=p.id),'[]'::jsonb)); END IF;
  RETURN jsonb_build_object('pursuit',jsonb_build_object('id',p.id,'owner_repreneur_id',p.owner_repreneur_id,'title',p.title,'stage',p.stage,'availability',p.availability,'due_at',p.due_at,'deletion_status',p.deletion_status,'created_at',p.created_at,'updated_at',p.updated_at),'shared_notes',COALESCE((SELECT shared_notes FROM public.external_pursuit_notes WHERE external_pursuit_id=p.id),NULL),'contacts',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'organisation',c.organisation,'role_title',c.role_title,'email',c.email,'phone',c.phone,'created_at',c.created_at,'updated_at',c.updated_at) ORDER BY c.created_at) FROM public.external_pursuit_contacts c WHERE c.external_pursuit_id=p.id),'[]'::jsonb));
END $$;

ALTER TABLE public.external_pursuits ENABLE ROW LEVEL SECURITY; ALTER TABLE public.external_pursuits FORCE ROW LEVEL SECURITY;
ALTER TABLE public.external_pursuit_notes ENABLE ROW LEVEL SECURITY; ALTER TABLE public.external_pursuit_notes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.external_pursuit_staff_notes ENABLE ROW LEVEL SECURITY; ALTER TABLE public.external_pursuit_staff_notes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.external_pursuit_contacts ENABLE ROW LEVEL SECURITY; ALTER TABLE public.external_pursuit_contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.external_pursuit_audit_events ENABLE ROW LEVEL SECURITY; ALTER TABLE public.external_pursuit_audit_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.external_pursuit_deletion_tombstones ENABLE ROW LEVEL SECURITY; ALTER TABLE public.external_pursuit_deletion_tombstones FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.external_pursuits,public.external_pursuit_notes,public.external_pursuit_staff_notes,public.external_pursuit_contacts,public.external_pursuit_audit_events,public.external_pursuit_deletion_tombstones FROM PUBLIC,anon,authenticated;
REVOKE ALL ON TABLE public.external_pursuits,public.external_pursuit_notes,public.external_pursuit_staff_notes,public.external_pursuit_contacts,public.external_pursuit_audit_events,public.external_pursuit_deletion_tombstones FROM service_role;
GRANT SELECT ON TABLE public.external_pursuits,public.external_pursuit_notes,public.external_pursuit_staff_notes,public.external_pursuit_contacts,public.external_pursuit_audit_events,public.external_pursuit_deletion_tombstones TO service_role;
REVOKE ALL ON FUNCTION public.external_pursuit_actor_context(TEXT),public.assert_external_pursuit_access(UUID,TEXT,BOOLEAN),public.external_pursuit_append_audit(UUID,public.external_pursuit_audit_event_type,TEXT,TEXT,JSONB),public.create_external_pursuit(UUID,TEXT,TEXT,TEXT,DATE,TEXT,TEXT,TEXT,TEXT),public.update_external_pursuit(UUID,TEXT,TEXT,BOOLEAN,TEXT,BOOLEAN,DATE,BOOLEAN,TEXT,BOOLEAN,TEXT,BOOLEAN,TEXT,TEXT),public.save_external_pursuit_contact(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT),public.request_external_pursuit_deletion(UUID,TEXT,TEXT),public.fulfill_external_pursuit_deletion(UUID,TEXT,TEXT),public.external_pursuit_for_actor(UUID,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_external_pursuit(UUID,TEXT,TEXT,TEXT,DATE,TEXT,TEXT,TEXT,TEXT),public.update_external_pursuit(UUID,TEXT,TEXT,BOOLEAN,TEXT,BOOLEAN,DATE,BOOLEAN,TEXT,BOOLEAN,TEXT,BOOLEAN,TEXT,TEXT),public.save_external_pursuit_contact(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT),public.request_external_pursuit_deletion(UUID,TEXT,TEXT),public.fulfill_external_pursuit_deletion(UUID,TEXT,TEXT),public.external_pursuit_for_actor(UUID,TEXT) TO service_role;

COMMENT ON TABLE public.external_pursuits IS 'W-105 standalone External Pursuit dossiers. Not an opportunity, match, canonical pursuit, M&A relationship, Gate record, export or import target.';
COMMENT ON TABLE public.external_pursuit_deletion_tombstones IS 'Minimum attributed External Pursuit deletion identity. No dossier content, row or ordinary audit event is retained.';
