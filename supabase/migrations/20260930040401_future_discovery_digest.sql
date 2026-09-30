-- Ticket #136: future-only, default-OFF discovery digest. No business-row
-- backfill, recipient enrollment, activation, cutover initialization or send.
BEGIN;

CREATE TABLE public.discovery_digest_cutover (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  initialized_at timestamptz NOT NULL,
  initialized_by text NOT NULL CHECK (nullif(btrim(initialized_by),'') IS NOT NULL),
  release_sha text NOT NULL CHECK (release_sha ~ '^[0-9a-f]{40}$')
);
CREATE TABLE public.discovery_digest_epochs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activated_at timestamptz NOT NULL,
  activated_by text NOT NULL,
  deactivated_at timestamptz,
  deactivated_by text,
  next_window_index integer NOT NULL DEFAULT 0 CHECK (next_window_index >= 0),
  CHECK ((deactivated_at IS NULL AND deactivated_by IS NULL)
    OR (deactivated_at >= activated_at AND nullif(btrim(deactivated_by),'') IS NOT NULL))
);
CREATE UNIQUE INDEX discovery_digest_one_active_epoch ON public.discovery_digest_epochs ((true)) WHERE deactivated_at IS NULL;
CREATE TABLE public.discovery_digest_origins (
  opportunity_id uuid PRIMARY KEY REFERENCES public.opportunities(id) ON DELETE CASCADE,
  origin_kind text NOT NULL DEFAULT 'ordinary_staff_create' CHECK (origin_kind='ordinary_staff_create'),
  registered_at timestamptz NOT NULL,
  registered_by text NOT NULL
);
CREATE TABLE public.discovery_digest_first_availability (
  opportunity_id uuid PRIMARY KEY REFERENCES public.discovery_digest_origins(opportunity_id) ON DELETE CASCADE,
  available_at timestamptz NOT NULL,
  epoch_id uuid REFERENCES public.discovery_digest_epochs(id)
);
CREATE INDEX discovery_digest_available_epoch_time ON public.discovery_digest_first_availability(epoch_id,available_at,opportunity_id)
  WHERE epoch_id IS NOT NULL;
CREATE TABLE public.discovery_digest_copy_approvals (
  opportunity_id uuid PRIMARY KEY REFERENCES public.opportunities(id) ON DELETE CASCADE,
  public_title text NOT NULL CHECK (nullif(btrim(public_title),'') IS NOT NULL),
  teaser_summary text NOT NULL CHECK (nullif(btrim(teaser_summary),'') IS NOT NULL),
  pair_sha256 text NOT NULL CHECK (pair_sha256 ~ '^[0-9a-f]{64}$'),
  approved_at timestamptz NOT NULL,
  approved_by text NOT NULL
);
CREATE TABLE public.discovery_digest_optouts (
  repreneur_id uuid PRIMARY KEY REFERENCES public.repreneurs(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  opted_out_at timestamptz NOT NULL
);
CREATE TABLE public.discovery_digest_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  epoch_id uuid NOT NULL REFERENCES public.discovery_digest_epochs(id),
  window_index integer NOT NULL CHECK (window_index >= 0),
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('ready','empty','review_required')),
  item_count integer NOT NULL DEFAULT 0 CHECK (item_count >= 0),
  recipient_count integer NOT NULL DEFAULT 0 CHECK (recipient_count >= 0),
  materialized_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (epoch_id,window_index),
  CHECK (window_end = window_start + interval '3 days')
);
CREATE TABLE public.discovery_digest_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  window_id uuid NOT NULL REFERENCES public.discovery_digest_windows(id),
  repreneur_id uuid NOT NULL REFERENCES public.repreneurs(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload)='object'
    AND jsonb_typeof(payload->'items')='array'
    AND jsonb_array_length(payload->'items') BETWEEN 1 AND 20),
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','claimed','failed','sent','suppressed','review_required')),
  lease_token uuid,
  lease_expires_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  provider_started_at timestamptz,
  provider_outcome text CHECK (provider_outcome IS NULL OR provider_outcome IN ('attempting','accepted','rejected','uncertain')),
  provider_message_id text,
  sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (window_id,repreneur_id),
  CHECK ((lease_token IS NULL)=(lease_expires_at IS NULL))
);
CREATE INDEX discovery_digest_due ON public.discovery_digest_deliveries(updated_at,id)
  WHERE status IN ('pending','failed');
CREATE TABLE public.discovery_digest_attempts (
  delivery_id uuid NOT NULL REFERENCES public.discovery_digest_deliveries(id) ON DELETE CASCADE,
  attempt_no integer NOT NULL CHECK (attempt_no >= 1),
  lease_token uuid NOT NULL UNIQUE,
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  claimed_at timestamptz NOT NULL,
  provider_started_at timestamptz,
  outcome text NOT NULL CHECK (outcome IN
    ('claimed','attempting','accepted','rejected','uncertain','deferred','blocked')),
  provider_message_id text,
  resolved_at timestamptz,
  PRIMARY KEY (delivery_id,attempt_no)
);
CREATE TABLE public.discovery_digest_reconciliations (
  delivery_id uuid NOT NULL,
  attempt_no integer NOT NULL,
  actor text NOT NULL CHECK (nullif(btrim(actor),'') IS NOT NULL),
  reconciled_at timestamptz NOT NULL,
  decision text NOT NULL CHECK (decision IN ('accepted','rejected')),
  provider_message_id text,
  rejection_evidence_reference text,
  PRIMARY KEY (delivery_id,attempt_no),
  FOREIGN KEY (delivery_id,attempt_no)
    REFERENCES public.discovery_digest_attempts(delivery_id,attempt_no) ON DELETE CASCADE,
  CHECK ((decision='accepted' AND provider_message_id IS NOT NULL
    AND nullif(btrim(provider_message_id),'') IS NOT NULL
    AND rejection_evidence_reference IS NULL)
    OR (decision='rejected' AND provider_message_id IS NULL
      AND rejection_evidence_reference IS NOT NULL
      AND nullif(btrim(rejection_evidence_reference),'') IS NOT NULL
      AND length(rejection_evidence_reference)<=200))
);

DO $guard$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'discovery_digest_cutover','discovery_digest_epochs','discovery_digest_origins',
    'discovery_digest_first_availability','discovery_digest_copy_approvals',
    'discovery_digest_optouts','discovery_digest_windows','discovery_digest_deliveries',
    'discovery_digest_attempts','discovery_digest_reconciliations'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',table_name);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',table_name);
    EXECUTE format('GRANT SELECT ON public.%I TO service_role',table_name);
  END LOOP;
END $guard$;

-- One source of attempt history for every status transition, including OFF,
-- copy withdrawal and lease rollover paths outside the delivery adapter.
CREATE FUNCTION public.d136_track_attempt() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
  IF OLD.lease_token IS NOT NULL AND NEW.lease_token IS DISTINCT FROM OLD.lease_token THEN
    UPDATE public.discovery_digest_attempts SET
      outcome=CASE WHEN NEW.status='sent' THEN 'accepted'
        WHEN NEW.status='failed' THEN 'rejected'
        WHEN NEW.status='review_required' THEN 'uncertain'
        WHEN NEW.status='suppressed' THEN 'blocked' ELSE 'deferred' END,
      provider_message_id=CASE WHEN NEW.status='sent' THEN NEW.provider_message_id ELSE provider_message_id END,
      resolved_at=clock_timestamp()
    WHERE lease_token=OLD.lease_token;
    IF NOT FOUND THEN RAISE EXCEPTION 'discovery_digest_attempt_missing'; END IF;
  ELSIF NEW.lease_token IS NOT NULL
    AND NEW.provider_started_at IS DISTINCT FROM OLD.provider_started_at
    AND NEW.provider_outcome='attempting' THEN
    UPDATE public.discovery_digest_attempts SET
      provider_started_at=NEW.provider_started_at,outcome='attempting'
    WHERE lease_token=NEW.lease_token;
    IF NOT FOUND THEN RAISE EXCEPTION 'discovery_digest_attempt_missing'; END IF;
  ELSIF NEW.lease_token IS NOT NULL AND NEW.status='review_required'
    AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.discovery_digest_attempts SET outcome='uncertain',resolved_at=clock_timestamp()
    WHERE lease_token=NEW.lease_token;
    IF NOT FOUND THEN RAISE EXCEPTION 'discovery_digest_attempt_missing'; END IF;
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER d136_track_attempt AFTER UPDATE ON public.discovery_digest_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.d136_track_attempt();

INSERT INTO public.email_templates(template_key,subject,description,is_active,requires_consent,body_editable)
VALUES ('opportunity_discovery_digest','De nouvelles opportunités à découvrir',
  'Future-only three-day public-opportunity digest. Staff activation required; generic/manual sends unavailable.',
  false,true,false)
ON CONFLICT(template_key) DO NOTHING;
DO $guard$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.email_templates
    WHERE template_key='opportunity_discovery_digest' AND is_active IS FALSE
      AND requires_consent IS TRUE AND body_editable IS FALSE) THEN
    RAISE EXCEPTION 'discovery_digest_template_must_start_off';
  END IF;
END $guard$;

CREATE FUNCTION public.d136_template_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.template_key='opportunity_discovery_digest' THEN RAISE EXCEPTION 'discovery_digest_guarded_toggle_only'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.template_key='opportunity_discovery_digest' THEN RAISE EXCEPTION 'discovery_digest_template_already_seeded'; END IF;
    RETURN NEW;
  END IF;
  IF OLD.template_key='opportunity_discovery_digest' OR NEW.template_key='opportunity_discovery_digest' THEN
    IF OLD.template_key <> NEW.template_key OR OLD.subject IS DISTINCT FROM NEW.subject
      OR OLD.description IS DISTINCT FROM NEW.description
      OR OLD.requires_consent IS DISTINCT FROM NEW.requires_consent
      OR OLD.body_markdown IS DISTINCT FROM NEW.body_markdown
      OR OLD.body_editable IS DISTINCT FROM NEW.body_editable
      OR current_setting('wave.d136_toggle',true) IS DISTINCT FROM 'on'
      OR OLD.is_active IS NOT DISTINCT FROM NEW.is_active THEN
      RAISE EXCEPTION 'discovery_digest_guarded_toggle_only';
    END IF;
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER d136_template_guard BEFORE INSERT OR UPDATE OR DELETE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.d136_template_guard();

CREATE FUNCTION public.d136_pair_hash(p_title text,p_teaser text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $fn$
  SELECT encode(sha256(convert_to(jsonb_build_array(p_title,p_teaser)::text,'UTF8')),'hex')
$fn$;
CREATE FUNCTION public.d136_payload_hash(p_payload jsonb) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $fn$
  SELECT encode(sha256(convert_to(p_payload::text,'UTF8')),'hex')
$fn$;

-- Staff identity may retain a legacy email-only role row. The actor is always
-- the authenticated user ID; only one exact same-email staff row can own it.
CREATE FUNCTION public.d136_staff_actor(p_actor text) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
  SELECT COALESCE((SELECT count(*)=1 FROM public."user" auth_user
    JOIN public.app_user_roles role_row ON role_row.role='staff'
      AND lower(btrim(role_row.email))=lower(btrim(auth_user.email))
      AND (role_row.user_id=p_actor OR role_row.user_id IS NULL)
    WHERE auth_user.id=p_actor),false)
$fn$;

CREATE FUNCTION public.d136_identity_ready(p_repreneur_id uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_email text; v_user text;
BEGIN
  SELECT public.w175_assignment_recipient_email(r.email), role_row.user_id
    INTO v_email,v_user
  FROM public.repreneurs r
  JOIN public.app_user_roles role_row ON role_row.repreneur_id=r.id AND role_row.role='repreneur'
  WHERE r.id=p_repreneur_id AND r.is_demo IS FALSE
    AND role_row.user_id IS NOT NULL AND role_row.access_enabled_at IS NOT NULL
    AND public.w175_assignment_recipient_email(role_row.email)=public.w175_assignment_recipient_email(r.email);
  IF NOT FOUND OR v_email IS NULL OR v_user IS NULL THEN RETURN false; END IF;
  RETURN (SELECT count(*) FROM public.app_user_roles role_row
    WHERE role_row.repreneur_id=p_repreneur_id AND role_row.role='repreneur'
      AND role_row.user_id=v_user AND role_row.access_enabled_at IS NOT NULL
      AND public.w175_assignment_recipient_email(role_row.email)=v_email)=1
    AND (SELECT count(*) FROM public."user" auth_user
      WHERE public.w175_assignment_recipient_email(auth_user.email)=v_email)=1
    AND EXISTS (SELECT 1 FROM public."user" auth_user
      WHERE auth_user.id=v_user AND public.w175_assignment_recipient_email(auth_user.email)=v_email)
    AND EXISTS (SELECT 1 FROM public."account" account_row
      WHERE account_row."userId"=v_user AND account_row."providerId"='credential'
        AND account_row.password IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.app_user_roles conflicting
      WHERE (conflicting.user_id=v_user
        OR public.w175_assignment_recipient_email(conflicting.email)=v_email
        OR conflicting.repreneur_id=p_repreneur_id)
        AND (conflicting.role='staff' OR conflicting.repreneur_id IS DISTINCT FROM p_repreneur_id
          OR conflicting.user_id IS DISTINCT FROM v_user));
END $fn$;
CREATE FUNCTION public.d136_recipient_ready(p_repreneur_id uuid) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
  SELECT COALESCE(public.d136_identity_ready(p_repreneur_id)
    AND EXISTS (SELECT 1 FROM public.repreneurs r WHERE r.id=p_repreneur_id AND r.marketing_consent IS TRUE
      AND NOT public.ma_contact_email_address_is_suppressed(r.email))
    AND NOT EXISTS (SELECT 1 FROM public.discovery_digest_optouts o WHERE o.repreneur_id=p_repreneur_id),false)
$fn$;

CREATE FUNCTION public.d136_opt_out(p_user_id text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_repreneur_id uuid;
BEGIN
  SELECT role_row.repreneur_id INTO v_repreneur_id FROM public.app_user_roles role_row
  WHERE role_row.role='repreneur' AND role_row.user_id=p_user_id
    AND role_row.repreneur_id IS NOT NULL;
  IF NOT FOUND OR NOT public.d136_identity_ready(v_repreneur_id) THEN
    RAISE EXCEPTION 'discovery_digest_owner_required';
  END IF;
  INSERT INTO public.discovery_digest_optouts(repreneur_id,user_id,opted_out_at)
  VALUES (v_repreneur_id,p_user_id,clock_timestamp()) ON CONFLICT(repreneur_id) DO NOTHING;
  RETURN true;
END $fn$;

CREATE FUNCTION public.d136_approve_copy(
  p_opportunity_id uuid,p_actor text,p_expected_public_title text,p_expected_teaser text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v public.opportunities%ROWTYPE;
BEGIN
  IF NOT public.d136_staff_actor(p_actor) THEN
    RAISE EXCEPTION 'discovery_digest_staff_required';
  END IF;
  SELECT * INTO v FROM public.opportunities WHERE id=p_opportunity_id FOR UPDATE;
  IF NOT FOUND OR v.is_demo IS DISTINCT FROM false OR v.status IS DISTINCT FROM 'active'
    OR v.repreneur_exposure IS DISTINCT FROM 'anonymized'
    OR nullif(btrim(v.public_title),'') IS NULL OR nullif(btrim(v.teaser_summary),'') IS NULL
    OR v.public_title IS DISTINCT FROM p_expected_public_title
    OR v.teaser_summary IS DISTINCT FROM p_expected_teaser
    OR NOT EXISTS(SELECT 1 FROM public.discovery_digest_origins origin
      JOIN public.discovery_digest_cutover cutover ON cutover.singleton=true
      WHERE origin.opportunity_id=p_opportunity_id
        AND origin.registered_at>=cutover.initialized_at)
    OR NOT public.has_approved_public_description(v.teaser_summary,v.public_description_approved_hash,
      v.public_description_approved_at,v.public_description_approved_by) THEN
    RAISE EXCEPTION 'discovery_digest_public_copy_not_approved';
  END IF;
  INSERT INTO public.discovery_digest_copy_approvals
    (opportunity_id,public_title,teaser_summary,pair_sha256,approved_at,approved_by)
  VALUES(v.id,v.public_title,v.teaser_summary,public.d136_pair_hash(v.public_title,v.teaser_summary),clock_timestamp(),p_actor)
  ON CONFLICT(opportunity_id) DO UPDATE SET public_title=excluded.public_title,
    teaser_summary=excluded.teaser_summary,pair_sha256=excluded.pair_sha256,
    approved_at=excluded.approved_at,approved_by=excluded.approved_by;
  RETURN true;
END $fn$;
CREATE FUNCTION public.d136_invalidate_copy() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
  IF NEW.public_title IS DISTINCT FROM OLD.public_title
    OR NEW.teaser_summary IS DISTINCT FROM OLD.teaser_summary THEN
    DELETE FROM public.discovery_digest_copy_approvals WHERE opportunity_id=NEW.id;
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER d136_invalidate_copy AFTER UPDATE OF public_title,teaser_summary ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.d136_invalidate_copy();

-- Release-only SQL primitive. It is not exposed through PostgREST or the app
-- service role; the release operator binds externally verified live SHA proof.
CREATE FUNCTION public.d136_initialize_cutover(p_actor text,p_release_sha text) RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v public.discovery_digest_cutover%ROWTYPE;
BEGIN
  IF session_user IS DISTINCT FROM 'postgres'
    OR NOT public.d136_staff_actor(p_actor)
    OR p_release_sha !~ '^[0-9a-f]{40}$' THEN
    RAISE EXCEPTION 'discovery_digest_cutover_proof_required';
  END IF;
  INSERT INTO public.discovery_digest_cutover(singleton,initialized_at,initialized_by,release_sha)
  VALUES(true,clock_timestamp(),p_actor,p_release_sha) ON CONFLICT(singleton) DO NOTHING;
  SELECT * INTO v FROM public.discovery_digest_cutover WHERE singleton=true;
  IF v.release_sha IS DISTINCT FROM p_release_sha THEN
    RAISE EXCEPTION 'discovery_digest_cutover_already_initialized';
  END IF;
  RETURN v.initialized_at;
END $fn$;

CREATE FUNCTION public.d136_toggle(p_actor text,p_enabled boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_cutover public.discovery_digest_cutover%ROWTYPE;
  v_template public.email_templates%ROWTYPE; v_epoch public.discovery_digest_epochs%ROWTYPE;
  v_now timestamptz;
BEGIN
  IF NOT public.d136_staff_actor(p_actor)
    OR p_enabled IS NULL THEN RAISE EXCEPTION 'discovery_digest_staff_required'; END IF;
  SELECT * INTO v_cutover FROM public.discovery_digest_cutover WHERE singleton=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'discovery_digest_cutover_not_initialized'; END IF;
  SELECT * INTO v_template FROM public.email_templates
    WHERE template_key='opportunity_discovery_digest' FOR UPDATE;
  IF NOT FOUND OR v_template.requires_consent IS DISTINCT FROM true
    OR v_template.body_editable IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'discovery_digest_template_invalid';
  END IF;
  SELECT * INTO v_epoch FROM public.discovery_digest_epochs WHERE deactivated_at IS NULL FOR UPDATE;
  IF p_enabled THEN
    IF v_template.is_active IS TRUE AND v_epoch.id IS NOT NULL THEN
      RETURN jsonb_build_object('enabled',true,'epochId',v_epoch.id,'activatedAt',v_epoch.activated_at);
    END IF;
    IF v_template.is_active IS NOT FALSE OR v_epoch.id IS NOT NULL THEN
      RAISE EXCEPTION 'discovery_digest_epoch_template_drift';
    END IF;
    v_now:=clock_timestamp();
    INSERT INTO public.discovery_digest_epochs(activated_at,activated_by)
    VALUES(v_now,p_actor) RETURNING * INTO v_epoch;
    PERFORM set_config('wave.d136_toggle','on',true);
    UPDATE public.email_templates SET is_active=true WHERE id=v_template.id;
    PERFORM set_config('wave.d136_toggle','off',true);
    RETURN jsonb_build_object('enabled',true,'epochId',v_epoch.id,'activatedAt',v_now);
  END IF;
  IF v_template.is_active IS FALSE AND v_epoch.id IS NULL THEN
    RETURN jsonb_build_object('enabled',false);
  END IF;
  IF v_template.is_active IS NOT TRUE OR v_epoch.id IS NULL THEN
    RAISE EXCEPTION 'discovery_digest_epoch_template_drift';
  END IF;
  v_now:=clock_timestamp();
  UPDATE public.discovery_digest_epochs SET deactivated_at=v_now,deactivated_by=p_actor
    WHERE id=v_epoch.id;
  PERFORM set_config('wave.d136_toggle','on',true);
  UPDATE public.email_templates SET is_active=false WHERE id=v_template.id;
  PERFORM set_config('wave.d136_toggle','off',true);
  UPDATE public.discovery_digest_deliveries d SET status='suppressed',
    lease_token=NULL,lease_expires_at=NULL,updated_at=v_now
  FROM public.discovery_digest_windows w
  WHERE w.id=d.window_id AND w.epoch_id=v_epoch.id
    AND d.status IN ('pending','failed','claimed') AND d.provider_started_at IS NULL;
  RETURN jsonb_build_object('enabled',false,'endedEpochId',v_epoch.id);
END $fn$;

CREATE FUNCTION public.d136_record_first_availability(p_opportunity_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_opp public.opportunities%ROWTYPE; v_origin public.discovery_digest_origins%ROWTYPE;
  v_cutover public.discovery_digest_cutover%ROWTYPE; v_epoch uuid; v_now timestamptz;
BEGIN
  SELECT * INTO v_opp FROM public.opportunities WHERE id=p_opportunity_id;
  IF NOT FOUND OR v_opp.status IS DISTINCT FROM 'active'
    OR v_opp.repreneur_exposure IS DISTINCT FROM 'anonymized'
    OR v_opp.is_demo IS DISTINCT FROM false THEN RETURN; END IF;
  SELECT * INTO v_origin FROM public.discovery_digest_origins WHERE opportunity_id=p_opportunity_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF EXISTS(SELECT 1 FROM public.discovery_digest_first_availability WHERE opportunity_id=p_opportunity_id) THEN RETURN; END IF;
  SELECT * INTO v_cutover FROM public.discovery_digest_cutover WHERE singleton=true FOR UPDATE;
  v_now:=clock_timestamp();
  IF v_cutover.initialized_at IS NOT NULL AND v_origin.registered_at>=v_cutover.initialized_at THEN
    SELECT e.id INTO v_epoch FROM public.discovery_digest_epochs e
    JOIN public.email_templates t ON t.template_key='opportunity_discovery_digest'
      AND t.is_active IS TRUE AND t.requires_consent IS TRUE
    WHERE e.deactivated_at IS NULL AND e.activated_at<=v_now;
  END IF;
  INSERT INTO public.discovery_digest_first_availability(opportunity_id,available_at,epoch_id)
  VALUES(p_opportunity_id,v_now,v_epoch) ON CONFLICT(opportunity_id) DO NOTHING;
END $fn$;
CREATE FUNCTION public.d136_first_availability_trigger() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
  PERFORM public.d136_record_first_availability(NEW.id);
  RETURN NEW;
END $fn$;
CREATE TRIGGER d136_first_availability_after_insert AFTER INSERT ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.d136_first_availability_trigger();
CREATE TRIGGER d136_first_availability_after_transition
  AFTER UPDATE OF status,is_demo,repreneur_exposure ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.d136_first_availability_trigger();

CREATE FUNCTION public.create_ordinary_discovery_opportunity(
  p_reference text,p_source_office_id uuid DEFAULT NULL,p_affiliation_ids uuid[] DEFAULT ARRAY[]::uuid[],
  p_primary_affiliation_id uuid DEFAULT NULL,p_description text DEFAULT NULL,
  p_target_status public.opportunity_status DEFAULT 'draft',p_actor text DEFAULT NULL,
  p_opportunity_fields jsonb DEFAULT '{}'::jsonb
) RETURNS public.opportunities LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_opp public.opportunities%ROWTYPE;
BEGIN
  IF NOT public.d136_staff_actor(p_actor) THEN
    RAISE EXCEPTION 'discovery_digest_staff_required';
  END IF;
  v_opp:=public.create_opportunity_with_office_context_v2(p_reference,p_source_office_id,
    p_affiliation_ids,p_primary_affiliation_id,p_description,p_target_status,p_actor,p_opportunity_fields);
  INSERT INTO public.discovery_digest_origins(opportunity_id,registered_at,registered_by)
    VALUES(v_opp.id,clock_timestamp(),p_actor);
  PERFORM public.d136_record_first_availability(v_opp.id);
  RETURN v_opp;
END $fn$;

-- Direct updates are not evidence. Service writes use only the guarded RPCs.
CREATE FUNCTION public.d136_immutable_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN RAISE EXCEPTION 'discovery_digest_immutable_event'; END $fn$;
CREATE TRIGGER d136_origin_immutable BEFORE UPDATE ON public.discovery_digest_origins
  FOR EACH ROW EXECUTE FUNCTION public.d136_immutable_event();
CREATE TRIGGER d136_first_event_immutable BEFORE UPDATE ON public.discovery_digest_first_availability
  FOR EACH ROW EXECUTE FUNCTION public.d136_immutable_event();

CREATE FUNCTION public.d136_block_started_parent_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
  IF TG_TABLE_NAME='repreneurs' THEN
    IF EXISTS(SELECT 1 FROM public.discovery_digest_deliveries d
      WHERE d.repreneur_id=OLD.id AND (d.provider_started_at IS NOT NULL OR d.status IN ('sent','review_required'))) THEN
      RAISE EXCEPTION 'discovery_digest_started_receipt_retained';
    END IF;
    UPDATE public.discovery_digest_deliveries SET status='suppressed',lease_token=NULL,
      lease_expires_at=NULL,updated_at=clock_timestamp()
    WHERE repreneur_id=OLD.id AND provider_started_at IS NULL AND status IN ('pending','failed','claimed');
  ELSE
    IF EXISTS(SELECT 1 FROM public.discovery_digest_deliveries d
      CROSS JOIN LATERAL jsonb_array_elements(d.payload->'items') item
      WHERE item->>'opportunityId'=OLD.id::text
        AND (d.provider_started_at IS NOT NULL OR d.status IN ('sent','review_required'))) THEN
      RAISE EXCEPTION 'discovery_digest_started_receipt_retained';
    END IF;
    UPDATE public.discovery_digest_deliveries d SET status='suppressed',lease_token=NULL,
      lease_expires_at=NULL,updated_at=clock_timestamp()
    WHERE provider_started_at IS NULL AND status IN ('pending','failed','claimed')
      AND EXISTS(SELECT 1 FROM jsonb_array_elements(d.payload->'items') item
        WHERE item->>'opportunityId'=OLD.id::text);
  END IF;
  RETURN OLD;
END $fn$;
CREATE TRIGGER d136_repreneur_delete BEFORE DELETE ON public.repreneurs
  FOR EACH ROW EXECUTE FUNCTION public.d136_block_started_parent_delete();
CREATE TRIGGER d136_opportunity_delete BEFORE DELETE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.d136_block_started_parent_delete();

CREATE FUNCTION public.d136_copy_ready(p_opportunity_id uuid) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.opportunities o
    JOIN public.discovery_digest_copy_approvals a ON a.opportunity_id=o.id
    WHERE o.id=p_opportunity_id AND o.is_demo IS FALSE AND o.status='active'
      AND o.repreneur_exposure='anonymized'
      AND nullif(btrim(o.public_title),'') IS NOT NULL
      AND nullif(btrim(o.teaser_summary),'') IS NOT NULL
      AND a.public_title=o.public_title AND a.teaser_summary=o.teaser_summary
      AND a.pair_sha256=public.d136_pair_hash(o.public_title,o.teaser_summary)
      AND public.has_approved_public_description(o.teaser_summary,o.public_description_approved_hash,
        o.public_description_approved_at,o.public_description_approved_by)
  )
$fn$;

-- One transaction either freezes every currently eligible recipient and item
-- for one completed window, or records an explicit review cap. The epoch cursor
-- advances only with that durable outcome; no LIMIT can discard a page.
CREATE FUNCTION public.d136_materialize_next_window() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_cutover public.discovery_digest_cutover%ROWTYPE; v_epoch public.discovery_digest_epochs%ROWTYPE;
  v_template public.email_templates%ROWTYPE; v_window_id uuid; v_start timestamptz;
  v_end timestamptz; v_now timestamptz:=clock_timestamp(); v_items jsonb; v_recipients jsonb;
  v_item_count integer; v_recipient_count integer; v_status text;
BEGIN
  SELECT * INTO v_cutover FROM public.discovery_digest_cutover WHERE singleton=true FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','off'); END IF;
  SELECT * INTO v_template FROM public.email_templates
    WHERE template_key='opportunity_discovery_digest' FOR SHARE;
  IF NOT FOUND OR v_template.is_active IS DISTINCT FROM true
    OR v_template.requires_consent IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('status','off');
  END IF;
  SELECT * INTO v_epoch FROM public.discovery_digest_epochs
    WHERE deactivated_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','off'); END IF;
  v_start:=v_epoch.activated_at + v_epoch.next_window_index * interval '3 days';
  v_end:=v_start + interval '3 days';
  IF v_end>v_now THEN RETURN jsonb_build_object('status','not_due','windowEnd',v_end); END IF;
  SELECT count(*)::integer,COALESCE(jsonb_agg(jsonb_build_object(
      'opportunityId',o.id,'publicTitle',o.public_title,'teaserSummary',o.teaser_summary)
      ORDER BY a.available_at,o.id),'[]'::jsonb)
    INTO v_item_count,v_items
  FROM public.discovery_digest_first_availability a
  JOIN public.opportunities o ON o.id=a.opportunity_id
  WHERE a.epoch_id=v_epoch.id AND a.available_at>=v_start AND a.available_at<v_end
    AND public.d136_copy_ready(o.id);
  SELECT count(*)::integer,COALESCE(jsonb_agg(jsonb_build_object(
      'repreneur_id',r.id,'recipient_email',public.w175_assignment_recipient_email(r.email),
      'first_name',coalesce(nullif(btrim(r.first_name),''),'')) ORDER BY r.id),'[]'::jsonb)
    INTO v_recipient_count,v_recipients
  FROM public.repreneurs r WHERE public.d136_recipient_ready(r.id);
  v_status:=CASE WHEN v_item_count>20 OR v_recipient_count>500 THEN 'review_required'
    WHEN v_item_count=0 OR v_recipient_count=0 THEN 'empty' ELSE 'ready' END;
  INSERT INTO public.discovery_digest_windows(epoch_id,window_index,window_start,window_end,
    status,item_count,recipient_count)
  VALUES(v_epoch.id,v_epoch.next_window_index,v_start,v_end,v_status,v_item_count,v_recipient_count)
  RETURNING id INTO v_window_id;
  IF v_status='ready' THEN
    INSERT INTO public.discovery_digest_deliveries(window_id,repreneur_id,recipient_email,payload,payload_sha256)
    SELECT v_window_id,eligible.repreneur_id,eligible.recipient_email,
      jsonb_build_object('recipientEmail',eligible.recipient_email,
        'firstName',eligible.first_name,
        'subject',v_template.subject,'items',v_items),
      public.d136_payload_hash(jsonb_build_object(
        'recipientEmail',eligible.recipient_email,
        'firstName',eligible.first_name,
        'subject',v_template.subject,'items',v_items))
    FROM jsonb_to_recordset(v_recipients) AS eligible(
      repreneur_id uuid,recipient_email text,first_name text);
  END IF;
  UPDATE public.discovery_digest_epochs SET next_window_index=next_window_index+1 WHERE id=v_epoch.id;
  RETURN jsonb_build_object('status',v_status,'windowId',v_window_id,
    'itemCount',v_item_count,'recipientCount',v_recipient_count,'windowEnd',v_end);
END $fn$;

CREATE FUNCTION public.d136_delivery_gates(p_delivery_id uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v public.discovery_digest_deliveries%ROWTYPE;
  w public.discovery_digest_windows%ROWTYPE; e public.discovery_digest_epochs%ROWTYPE;
  t public.email_templates%ROWTYPE; v_email text;
BEGIN
  SELECT * INTO v FROM public.discovery_digest_deliveries WHERE id=p_delivery_id;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO w FROM public.discovery_digest_windows WHERE id=v.window_id;
  SELECT * INTO e FROM public.discovery_digest_epochs WHERE id=w.epoch_id;
  SELECT * INTO t FROM public.email_templates WHERE template_key='opportunity_discovery_digest';
  SELECT public.w175_assignment_recipient_email(r.email) INTO v_email
    FROM public.repreneurs r WHERE r.id=v.repreneur_id;
  IF NOT EXISTS(SELECT 1 FROM public.discovery_digest_cutover WHERE singleton=true)
    OR w.status IS DISTINCT FROM 'ready' OR w.window_end>clock_timestamp()
    OR w.window_start IS DISTINCT FROM e.activated_at + w.window_index * interval '3 days'
    OR e.deactivated_at IS NOT NULL
    OR t.is_active IS DISTINCT FROM true OR t.requires_consent IS DISTINCT FROM true
    OR v_email IS NULL OR v_email IS DISTINCT FROM v.recipient_email
    OR NOT public.d136_recipient_ready(v.repreneur_id)
    OR v.payload->>'recipientEmail' IS DISTINCT FROM v.recipient_email
    OR v.payload->>'subject' IS DISTINCT FROM t.subject
    OR v.payload_sha256 IS DISTINCT FROM public.d136_payload_hash(v.payload)
    OR jsonb_array_length(v.payload->'items') NOT BETWEEN 1 AND 20 THEN RETURN false; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v.payload->'items') item
    WHERE NOT EXISTS (
      SELECT 1 FROM public.discovery_digest_first_availability a
      JOIN public.opportunities o ON o.id=a.opportunity_id
      WHERE a.opportunity_id=(item->>'opportunityId')::uuid
        AND a.epoch_id=e.id AND a.available_at>=w.window_start AND a.available_at<w.window_end
        AND public.d136_copy_ready(o.id)
        AND o.public_title=item->>'publicTitle'
        AND o.teaser_summary=item->>'teaserSummary'
    )
  ) THEN RETURN false; END IF;
  RETURN true;
END $fn$;

CREATE FUNCTION public.d136_claim(p_delivery_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v public.discovery_digest_deliveries%ROWTYPE; v_now timestamptz:=clock_timestamp(); v_token uuid;
BEGIN
  SELECT * INTO v FROM public.discovery_digest_deliveries WHERE id=p_delivery_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','missing'); END IF;
  IF v.status IN ('sent','suppressed','review_required') THEN RETURN jsonb_build_object('status',v.status); END IF;
  IF v.status='claimed' AND v.lease_expires_at>v_now THEN RETURN jsonb_build_object('status','busy'); END IF;
  IF v.provider_started_at IS NOT NULL AND v.provider_outcome IN ('attempting','uncertain') THEN
    IF v.provider_started_at + interval '23 hours'>v_now THEN
      UPDATE public.discovery_digest_deliveries SET updated_at=v_now WHERE id=v.id;
      RETURN jsonb_build_object('status','uncertain');
    END IF;
    UPDATE public.discovery_digest_deliveries SET status='review_required',updated_at=v_now WHERE id=v.id;
    RETURN jsonb_build_object('status','review_required');
  END IF;
  IF NOT public.d136_delivery_gates(v.id) THEN
    UPDATE public.discovery_digest_deliveries SET status='suppressed',
      lease_token=NULL,lease_expires_at=NULL,updated_at=v_now WHERE id=v.id;
    RETURN jsonb_build_object('status','suppressed');
  END IF;
  v_token:=gen_random_uuid();
  UPDATE public.discovery_digest_deliveries SET status='claimed',lease_token=v_token,
    lease_expires_at=v_now+interval '2 minutes',attempt_count=attempt_count+1,updated_at=v_now
    WHERE id=v.id;
  INSERT INTO public.discovery_digest_attempts(
    delivery_id,attempt_no,lease_token,payload_sha256,claimed_at,outcome)
  VALUES(v.id,v.attempt_count+1,v_token,v.payload_sha256,v_now,'claimed');
  RETURN jsonb_build_object('status','claimed','leaseToken',v_token,
    'payload',v.payload,'payloadSha256',v.payload_sha256,'repreneurId',v.repreneur_id);
END $fn$;

CREATE FUNCTION public.d136_begin_provider_attempt(
  p_delivery_id uuid,p_lease_token uuid,p_payload_sha256 text,p_expected_payload jsonb
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v public.discovery_digest_deliveries%ROWTYPE; v_now timestamptz:=clock_timestamp();
BEGIN
  SELECT * INTO v FROM public.discovery_digest_deliveries WHERE id=p_delivery_id FOR UPDATE;
  IF NOT FOUND OR v.status<>'claimed' OR v.lease_token IS DISTINCT FROM p_lease_token
    OR v.lease_expires_at<=v_now OR v.provider_outcome IN ('attempting','uncertain','accepted')
    OR v.payload_sha256 IS DISTINCT FROM p_payload_sha256
    OR v.payload IS DISTINCT FROM p_expected_payload OR NOT public.d136_delivery_gates(v.id) THEN
    IF FOUND AND v.status='claimed' AND v.lease_token=p_lease_token
      AND v.provider_outcome IS DISTINCT FROM 'attempting'
      AND v.provider_outcome IS DISTINCT FROM 'uncertain'
      AND v.provider_outcome IS DISTINCT FROM 'accepted' THEN
      UPDATE public.discovery_digest_deliveries SET status='suppressed',lease_token=NULL,
        lease_expires_at=NULL,updated_at=v_now WHERE id=v.id;
    END IF;
    RETURN false;
  END IF;
  UPDATE public.discovery_digest_deliveries SET provider_started_at=v_now,
    provider_outcome='attempting',updated_at=v_now WHERE id=v.id;
  RETURN true;
END $fn$;

CREATE FUNCTION public.d136_complete(
  p_delivery_id uuid,p_lease_token uuid,p_outcome text,p_provider_message_id text DEFAULT NULL
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v public.discovery_digest_deliveries%ROWTYPE; v_now timestamptz:=clock_timestamp();
BEGIN
  SELECT * INTO v FROM public.discovery_digest_deliveries WHERE id=p_delivery_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'missing'; END IF;
  IF v.status='sent' THEN RETURN 'sent'; END IF;
  IF v.lease_token IS DISTINCT FROM p_lease_token OR v.status<>'claimed' THEN
    RETURN 'conflict';
  END IF;
  IF p_outcome='accepted' AND v.provider_started_at IS NOT NULL
    AND nullif(btrim(p_provider_message_id),'') IS NOT NULL THEN
    UPDATE public.discovery_digest_deliveries SET status='sent',provider_outcome='accepted',
      provider_message_id=p_provider_message_id,sent_at=v_now,lease_token=NULL,
      lease_expires_at=NULL,updated_at=v_now WHERE id=v.id;
    RETURN 'sent';
  ELSIF p_outcome='rejected' AND v.provider_started_at IS NOT NULL THEN
    UPDATE public.discovery_digest_deliveries SET status='failed',provider_outcome='rejected',
      lease_token=NULL,lease_expires_at=NULL,updated_at=v_now WHERE id=v.id;
    RETURN 'failed';
  ELSIF p_outcome='uncertain' AND v.provider_started_at IS NOT NULL THEN
    UPDATE public.discovery_digest_deliveries SET status='review_required',provider_outcome='uncertain',
      updated_at=v_now WHERE id=v.id;
    RETURN 'review_required';
  ELSIF p_outcome='deferred'
    AND (v.provider_started_at IS NULL OR v.provider_outcome='rejected') THEN
    -- Only the server delivery adapter may assert a proven no-I/O deferral.
    UPDATE public.discovery_digest_deliveries SET status='pending',
      lease_token=NULL,lease_expires_at=NULL,updated_at=v_now WHERE id=v.id;
    RETURN 'pending';
  ELSIF p_outcome='blocked'
    AND (v.provider_started_at IS NULL OR v.provider_outcome='rejected') THEN
    UPDATE public.discovery_digest_deliveries SET status='suppressed',lease_token=NULL,
      lease_expires_at=NULL,updated_at=v_now WHERE id=v.id;
    RETURN 'suppressed';
  END IF;
  IF v.provider_started_at IS NULL THEN RETURN 'conflict'; END IF;
  UPDATE public.discovery_digest_deliveries SET status='review_required',provider_outcome='uncertain',
    updated_at=v_now WHERE id=v.id;
  RETURN 'review_required';
END $fn$;

-- A lost provider response has no send retry. Only explicit provider receipt
-- reconciliation may turn a review-required row into sent or conclusively failed.
CREATE FUNCTION public.d136_reconcile(
  p_delivery_id uuid,p_actor text,p_provider_message_id text,p_conclusive_rejection boolean,
  p_rejection_evidence_reference text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v public.discovery_digest_deliveries%ROWTYPE; v_now timestamptz:=clock_timestamp();
BEGIN
  IF NOT public.d136_staff_actor(p_actor) THEN
    RAISE EXCEPTION 'discovery_digest_staff_required';
  END IF;
  SELECT * INTO v FROM public.discovery_digest_deliveries WHERE id=p_delivery_id FOR UPDATE;
  IF NOT FOUND OR v.status<>'review_required' OR v.provider_started_at IS NULL THEN
    RAISE EXCEPTION 'discovery_digest_reconciliation_state_invalid';
  END IF;
  IF nullif(btrim(p_provider_message_id),'') IS NOT NULL AND p_conclusive_rejection IS FALSE
    AND p_rejection_evidence_reference IS NULL THEN
    UPDATE public.discovery_digest_deliveries SET status='sent',provider_outcome='accepted',
      provider_message_id=p_provider_message_id,sent_at=v_now,lease_token=NULL,
      lease_expires_at=NULL,updated_at=v_now WHERE id=v.id;
    INSERT INTO public.discovery_digest_reconciliations(
      delivery_id,attempt_no,actor,reconciled_at,decision,provider_message_id)
    VALUES(v.id,v.attempt_count,p_actor,v_now,'accepted',p_provider_message_id);
    RETURN 'sent';
  ELSIF p_conclusive_rejection IS TRUE AND nullif(btrim(p_provider_message_id),'') IS NULL
    AND nullif(btrim(p_rejection_evidence_reference),'') IS NOT NULL
    AND length(p_rejection_evidence_reference)<=200 THEN
    UPDATE public.discovery_digest_deliveries SET status='failed',provider_outcome='rejected',
      lease_token=NULL,lease_expires_at=NULL,updated_at=v_now WHERE id=v.id;
    INSERT INTO public.discovery_digest_reconciliations(
      delivery_id,attempt_no,actor,reconciled_at,decision,rejection_evidence_reference)
    VALUES(v.id,v.attempt_count,p_actor,v_now,'rejected',p_rejection_evidence_reference);
    RETURN 'failed';
  END IF;
  RAISE EXCEPTION 'discovery_digest_provider_receipt_required';
END $fn$;

REVOKE ALL ON FUNCTION public.d136_template_guard(),public.d136_pair_hash(text,text),
  public.d136_payload_hash(jsonb),public.d136_track_attempt(),public.d136_staff_actor(text),public.d136_identity_ready(uuid),public.d136_recipient_ready(uuid),
  public.d136_opt_out(text),public.d136_approve_copy(uuid,text,text,text),public.d136_invalidate_copy(),
  public.d136_initialize_cutover(text,text),public.d136_toggle(text,boolean),
  public.d136_record_first_availability(uuid),public.d136_first_availability_trigger(),
  public.create_ordinary_discovery_opportunity(text,uuid,uuid[],uuid,text,public.opportunity_status,text,jsonb),
  public.d136_immutable_event(),public.d136_block_started_parent_delete(),public.d136_copy_ready(uuid),
  public.d136_materialize_next_window(),public.d136_delivery_gates(uuid),public.d136_claim(uuid),
  public.d136_begin_provider_attempt(uuid,uuid,text,jsonb),public.d136_complete(uuid,uuid,text,text),
  public.d136_reconcile(uuid,text,text,boolean,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.d136_identity_ready(uuid),public.d136_recipient_ready(uuid),
  public.d136_copy_ready(uuid),
  public.d136_opt_out(text),public.d136_approve_copy(uuid,text,text,text),
  public.d136_toggle(text,boolean),
  public.create_ordinary_discovery_opportunity(text,uuid,uuid[],uuid,text,public.opportunity_status,text,jsonb),
  public.d136_materialize_next_window(),public.d136_claim(uuid),
  public.d136_begin_provider_attempt(uuid,uuid,text,jsonb),public.d136_complete(uuid,uuid,text,text),
  public.d136_reconcile(uuid,text,text,boolean,text) TO service_role;
COMMIT;
