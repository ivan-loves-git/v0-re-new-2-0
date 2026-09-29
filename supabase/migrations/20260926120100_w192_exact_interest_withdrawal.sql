-- Decision #184 / Ticket #204. Prospective exact-interest withdrawal only.
-- Existing interests, prior evidence and provider outcomes are not backfilled.

ALTER TABLE public.opportunity_interest_events
  ADD COLUMN withdrawal_origin TEXT CHECK (withdrawal_origin IN ('owner','staff'));
ALTER TABLE public.opportunity_interest_events
  DROP CONSTRAINT opportunity_interest_event_shape;
ALTER TABLE public.opportunity_interest_events
  ADD CONSTRAINT opportunity_interest_event_shape CHECK (
    (event_type='validated' AND validation_evidence_id IS NOT NULL
      AND internal_reason IS NULL AND withdrawal_origin IS NULL)
    OR (event_type='rejected' AND validation_evidence_id IS NULL
      AND withdrawal_origin IS NULL AND NULLIF(BTRIM(internal_reason),'') IS NOT NULL
      AND char_length(BTRIM(internal_reason))<=500)
    OR (event_type IN ('proposed_interested','proposed_declined')
      AND validation_evidence_id IS NULL AND internal_reason IS NULL
      AND withdrawal_origin IS NULL)
    OR (event_type='withdrawn' AND interest_expressed_at IS NOT NULL
      AND validation_evidence_id IS NULL AND withdrawal_origin IS NOT NULL
      AND NULLIF(BTRIM(internal_reason),'') IS NOT NULL
      AND char_length(BTRIM(internal_reason))<=500)
  );
ALTER TABLE public.opportunity_interest_events
  DROP CONSTRAINT opportunity_interest_events_event_type_check;
ALTER TABLE public.opportunity_interest_events
  ADD CONSTRAINT opportunity_interest_events_event_type_check CHECK (event_type IN
    ('proposed_interested','proposed_declined','validated','rejected','withdrawn'));
CREATE UNIQUE INDEX opportunity_interest_one_withdrawal_per_interest
  ON public.opportunity_interest_events(match_id,interest_expressed_at)
  WHERE event_type='withdrawn';

-- The provider request for the existing direct staff alert was previously not
-- recorded. Prospective attempts now keep one durable receipt per exact token.
CREATE TABLE public.opportunity_interest_direct_notices (
  match_id UUID NOT NULL REFERENCES public.opportunity_matches(id) ON DELETE CASCADE,
  interest_expressed_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN
    ('pending','attempting','uncertain','sent','rejected','suppressed','review_required')),
  provider_attempted_at TIMESTAMPTZ,
  provider_outcome TEXT CHECK (provider_outcome IS NULL OR provider_outcome IN
    ('attempting','uncertain','accepted','rejected')),
  provider_message_id TEXT,
  sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (match_id,interest_expressed_at)
);
ALTER TABLE public.opportunity_interest_direct_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_interest_direct_notices FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.opportunity_interest_direct_notices FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.opportunity_interest_direct_notices TO service_role;

-- A status change must have gone through the guarded withdrawal or fresh
-- expression RPC. No staff editor or stale application can manufacture a
-- Withdrawn row, or reactivate its old token by a plain status update.
CREATE FUNCTION public.w192_guard_withdrawn_match_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.status='withdrawn' AND OLD.status IS DISTINCT FROM 'withdrawn'
    AND current_setting('wave.w192_withdraw_match',true) IS DISTINCT FROM OLD.id::text
  THEN RAISE EXCEPTION 'withdrawal_requires_exact_rpc' USING ERRCODE='P0001'; END IF;
  IF OLD.status='withdrawn' AND NEW.status IS DISTINCT FROM 'withdrawn'
    AND current_setting('wave.w192_reinterest_match',true) IS DISTINCT FROM OLD.id::text
  THEN RAISE EXCEPTION 'withdrawn_interest_requires_fresh_rpc' USING ERRCODE='P0001'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER w192_guard_withdrawn_match_status
  BEFORE UPDATE OF status ON public.opportunity_matches
  FOR EACH ROW EXECUTE FUNCTION public.w192_guard_withdrawn_match_status();

-- Event history is append-only except when its match parent is actually
-- deleted under the pre-existing retention/deletion contract.
CREATE FUNCTION public.w192_guard_interest_event_history()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF TG_OP='DELETE' AND NOT EXISTS(
    SELECT 1 FROM public.opportunity_matches WHERE id=OLD.match_id) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'interest_event_history_immutable' USING ERRCODE='P0001';
END $$;
CREATE TRIGGER w192_interest_event_history_immutable
  BEFORE UPDATE OR DELETE ON public.opportunity_interest_events
  FOR EACH ROW EXECUTE FUNCTION public.w192_guard_interest_event_history();

-- New interest timestamps are database-owned and strictly greater than the
-- prior token at millisecond precision, which is also the existing direct-
-- mail provider key's precision. The old RPC signature remains compatible,
-- but caller-supplied time is not trusted.
CREATE OR REPLACE FUNCTION public.express_opportunity_interest(
  p_opportunity_id UUID,p_repreneur_id UUID,p_actor_id TEXT,p_expressed_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(match_id UUID,expressed_at TIMESTAMPTZ,notification_sent_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_opportunity public.opportunities%ROWTYPE; v_match public.opportunity_matches%ROWTYPE;
  v_has_match BOOLEAN:=FALSE; v_repreneur_demo BOOLEAN; v_new_token TIMESTAMPTZ;
BEGIN
  SELECT is_demo INTO v_repreneur_demo FROM public.repreneurs WHERE id=p_repreneur_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'interest_not_available' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_opportunity FROM public.opportunities
    WHERE id=p_opportunity_id AND status='active' AND is_demo=v_repreneur_demo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'interest_not_available' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_match FROM public.opportunity_matches
    WHERE opportunity_id=p_opportunity_id AND repreneur_id=p_repreneur_id FOR UPDATE;
  v_has_match:=FOUND;
  IF v_has_match AND v_match.status='active_pursuit' THEN RAISE EXCEPTION 'interest_not_available' USING ERRCODE='P0001'; END IF;
  IF v_has_match AND ((v_match.nda_status='signed' AND v_match.nda_signed_at IS NULL)
    OR (v_match.nda_status='waived' AND (v_match.nda_waived_at IS NULL OR NULLIF(BTRIM(v_match.nda_waived_by),'') IS NULL)))
  THEN RAISE EXCEPTION 'interest_not_available' USING ERRCODE='P0001'; END IF;
  PERFORM 1 FROM public.opportunity_matches
    WHERE opportunity_id=p_opportunity_id AND status='active_pursuit' AND repreneur_id<>p_repreneur_id FOR UPDATE;
  IF v_has_match AND v_match.status='interested' THEN
    IF v_match.interest_expressed_at IS NULL THEN RAISE EXCEPTION 'interest_not_available' USING ERRCODE='P0001'; END IF;
    RETURN QUERY SELECT v_match.id,v_match.interest_expressed_at,v_match.interest_notification_sent_at; RETURN;
  END IF;
  IF v_has_match AND v_match.status='withdrawn'
    AND current_setting('wave.w192_reinterest_match',true) IS DISTINCT FROM v_match.id::text
  THEN RAISE EXCEPTION 'interest_not_available' USING ERRCODE='P0001'; END IF;
  v_new_token:=GREATEST(clock_timestamp(),
    COALESCE(date_trunc('milliseconds',v_match.interest_expressed_at),'-infinity'::timestamptz)+interval '1 millisecond');
  IF v_has_match THEN
    UPDATE public.opportunity_matches SET status='interested',decline_reason_categories='{}',decline_reason_text=NULL,
      pursuit_stage=NULL,pursuit_stage_notes=NULL,pursuit_stage_updated_by=NULL,pursuit_stage_updated_at=NULL,
      reviewed_by=NULL,reviewed_at=NULL,interest_expressed_at=v_new_token,interest_notification_sent_at=NULL
    WHERE id=v_match.id RETURNING * INTO v_match;
  ELSE
    INSERT INTO public.opportunity_matches(opportunity_id,repreneur_id,status,created_by,interest_expressed_at)
    VALUES(p_opportunity_id,p_repreneur_id,'interested',p_actor_id,v_new_token) RETURNING * INTO v_match;
  END IF;
  RETURN QUERY SELECT v_match.id,v_match.interest_expressed_at,v_match.interest_notification_sent_at;
END $$;

-- Only a fresh, explicitly submitted Withdrawn page may re-express interest.
-- Ordinary retries of the former interest call have no token/version proof and
-- cannot silently turn a confirmed withdrawal back into a request.
CREATE FUNCTION public.w192_reexpress_withdrawn_interest(
  p_opportunity_id UUID,p_repreneur_id UUID,p_actor_id TEXT,
  p_expected_withdrawn_at TIMESTAMPTZ,p_expected_updated_at TIMESTAMPTZ
) RETURNS TABLE(match_id UUID,expressed_at TIMESTAMPTZ,notification_sent_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE; v_demo BOOLEAN;
BEGIN
  SELECT is_demo INTO v_demo FROM public.repreneurs WHERE id=p_repreneur_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'interest_not_available' USING ERRCODE='P0001'; END IF;
  PERFORM 1 FROM public.opportunities WHERE id=p_opportunity_id AND status='active'
    AND is_demo=v_demo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'interest_not_available' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_match FROM public.opportunity_matches
    WHERE opportunity_id=p_opportunity_id AND repreneur_id=p_repreneur_id FOR UPDATE;
  IF v_match.id IS NULL OR v_match.status<>'withdrawn'
    OR v_match.interest_expressed_at IS DISTINCT FROM p_expected_withdrawn_at
    OR v_match.updated_at IS DISTINCT FROM p_expected_updated_at
    OR NOT public.w164_match_has_same_namespace(v_match.id)
  THEN RAISE EXCEPTION 'interest_not_available' USING ERRCODE='P0001'; END IF;
  PERFORM set_config('wave.w192_reinterest_match',v_match.id::text,true);
  RETURN QUERY SELECT * FROM public.express_opportunity_interest(
    p_opportunity_id,p_repreneur_id,p_actor_id,clock_timestamp());
END $$;

-- A withdrawn request is ordinary inventory, not a still-open response to
-- its old staff recommendation clock. All other W172 deadlines stay intact.
CREATE OR REPLACE FUNCTION public.w172_reject_expired_interest()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.status='interested' AND OLD.status NOT IN ('interested','active_pursuit','withdrawn')
    AND OLD.recommendation_expires_at IS NOT NULL
    AND OLD.recommendation_expires_at<=clock_timestamp() THEN
    RAISE EXCEPTION 'recommendation_response_expired' USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END $$;

-- Only the four existing response/decision events own W173 deliveries.
-- Withdrawal is retained evidence, not a fifth notification campaign.
CREATE OR REPLACE FUNCTION public.w173_record_interest_delivery()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_key TEXT; v_template public.email_templates%ROWTYPE; v_real BOOLEAN;
BEGIN
  v_key:=CASE NEW.event_type
    WHEN 'validated' THEN 'interest_outcome_validated'
    WHEN 'rejected' THEN 'interest_outcome_rejected'
    WHEN 'proposed_interested' THEN 'proposed_opportunity_response_staff'
    WHEN 'proposed_declined' THEN 'proposed_opportunity_response_staff'
    ELSE NULL END;
  IF v_key IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_template FROM public.email_templates WHERE template_key=v_key;
  SELECT o.is_demo=false AND r.is_demo=false INTO v_real
    FROM public.opportunity_matches m JOIN public.opportunities o ON o.id=m.opportunity_id
    JOIN public.repreneurs r ON r.id=m.repreneur_id WHERE m.id=NEW.match_id;
  INSERT INTO public.opportunity_interest_notification_deliveries
    (event_id,template_key,template_updated_at,status)
  VALUES(NEW.id,v_key,v_template.updated_at,
    CASE WHEN v_template.is_active IS TRUE AND v_real IS TRUE THEN 'pending' ELSE 'suppressed' END);
  RETURN NEW;
END $$;

CREATE FUNCTION public.w192_withdraw_exact_interest(
  p_match_id UUID,p_opportunity_id UUID,p_repreneur_id UUID,
  p_actor_id TEXT,p_actor_email TEXT,p_expected_interest_at TIMESTAMPTZ,
  p_expected_updated_at TIMESTAMPTZ,p_reason TEXT,
  p_workspace_id UUID DEFAULT NULL,p_workspace_generation UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE; v_event UUID;
  v_origin TEXT; v_reason TEXT:=NULLIF(BTRIM(p_reason),''); v_now TIMESTAMPTZ;
BEGIN
  IF p_match_id IS NULL OR p_opportunity_id IS NULL OR p_repreneur_id IS NULL
    OR p_expected_interest_at IS NULL OR p_expected_updated_at IS NULL
    OR v_reason IS NULL OR char_length(v_reason)>500
  THEN RAISE EXCEPTION 'withdrawal_interest_stale' USING ERRCODE='P0001'; END IF;
  IF p_workspace_id IS NOT NULL OR p_workspace_generation IS NOT NULL THEN
    PERFORM public.w196_assert_staff_portal_workspace(p_workspace_id,p_workspace_generation,
      p_repreneur_id,p_actor_id,p_actor_email);
    v_origin:='staff';
  ELSE
    IF NOT EXISTS(
      SELECT 1 FROM public.app_user_roles role_row
      JOIN public.repreneurs repreneur ON repreneur.id=p_repreneur_id
      WHERE role_row.role='repreneur'
        AND LOWER(BTRIM(role_row.email))=LOWER(BTRIM(p_actor_email))
        AND LOWER(BTRIM(repreneur.email))=LOWER(BTRIM(p_actor_email))
        AND (role_row.user_id=p_actor_id OR (
          role_row.user_id IS NULL AND EXISTS(SELECT 1 FROM public."user" auth_user
            WHERE auth_user.id=p_actor_id
              AND LOWER(BTRIM(auth_user.email))=LOWER(BTRIM(p_actor_email)))))
        AND (role_row.repreneur_id=p_repreneur_id OR role_row.repreneur_id IS NULL)
    ) THEN RAISE EXCEPTION 'withdrawal_actor_denied' USING ERRCODE='P0001'; END IF;
    v_origin:='owner';
  END IF;
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE;
  IF v_match.id IS NULL OR v_match.repreneur_id<>p_repreneur_id
    OR v_match.opportunity_id<>p_opportunity_id
    OR NOT public.w164_match_has_same_namespace(v_match.id)
    OR v_match.interest_expressed_at IS DISTINCT FROM p_expected_interest_at
  THEN RAISE EXCEPTION 'withdrawal_interest_stale' USING ERRCODE='P0001'; END IF;
  IF v_match.status='withdrawn' THEN
    SELECT id INTO v_event FROM public.opportunity_interest_events
      WHERE match_id=p_match_id AND event_type='withdrawn'
        AND interest_expressed_at=p_expected_interest_at
        AND match_updated_at=p_expected_updated_at
        AND actor=p_actor_id AND withdrawal_origin=v_origin AND internal_reason=v_reason;
    IF v_event IS NOT NULL THEN
      RETURN jsonb_build_object('eventId',v_event,'status','withdrawn','reusedExisting',true);
    END IF;
    RAISE EXCEPTION 'withdrawal_interest_stale' USING ERRCODE='P0001';
  END IF;
  IF v_match.status='active_pursuit' THEN
    RAISE EXCEPTION 'withdrawal_requires_staff_drop' USING ERRCODE='P0001'; END IF;
  IF v_match.status<>'interested' OR v_match.updated_at IS DISTINCT FROM p_expected_updated_at
    OR EXISTS(SELECT 1 FROM public.opportunity_interest_events e
      WHERE e.match_id=p_match_id AND e.event_type IN ('validated','rejected')
        AND e.interest_expressed_at IS NOT DISTINCT FROM p_expected_interest_at)
    OR EXISTS(SELECT 1 FROM public.opportunity_pursuit_confidential_grants g
      WHERE g.match_id=p_match_id AND g.revoked_at IS NULL)
  THEN RAISE EXCEPTION 'withdrawal_interest_stale' USING ERRCODE='P0001'; END IF;
  -- The canonical match is the arbitration lock shared with validation.
  -- Do not wait on the opportunity row here: expression owns that row before
  -- this match, and a second lock would create an avoidable lock-order cycle.
  PERFORM 1 FROM public.opportunities o WHERE o.id=p_opportunity_id
    AND o.status='active' AND o.is_demo=(SELECT is_demo FROM public.repreneurs WHERE id=p_repreneur_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'withdrawal_interest_stale' USING ERRCODE='P0001'; END IF;

  PERFORM set_config('wave.w192_withdraw_match',p_match_id::text,true);
  UPDATE public.opportunity_matches SET status='withdrawn',reviewed_by=NULL,reviewed_at=NULL
    WHERE id=p_match_id;
  INSERT INTO public.opportunity_interest_events
    (match_id,event_type,interest_expressed_at,match_updated_at,actor,internal_reason,withdrawal_origin)
  VALUES(p_match_id,'withdrawn',p_expected_interest_at,p_expected_updated_at,p_actor_id,v_reason,v_origin)
  RETURNING id INTO v_event;
  v_now:=clock_timestamp();
  UPDATE public.opportunity_interest_notification_deliveries d
    SET status='suppressed',lease_token=NULL,lease_expires_at=NULL,updated_at=v_now
    FROM public.opportunity_interest_events e
    WHERE e.id=d.event_id AND e.match_id=p_match_id
      AND e.interest_expressed_at=p_expected_interest_at
      AND e.event_type='proposed_interested'
      AND d.status IN ('pending','failed')
      AND d.provider_outcome IS DISTINCT FROM 'uncertain'
      AND d.provider_outcome IS DISTINCT FROM 'attempting'
      AND d.provider_outcome IS DISTINCT FROM 'accepted';
  UPDATE public.opportunity_interest_direct_notices
    SET status='suppressed',updated_at=v_now
    WHERE match_id=p_match_id AND interest_expressed_at=p_expected_interest_at
      AND status IN ('pending','rejected') AND provider_outcome IS DISTINCT FROM 'uncertain';
  RETURN jsonb_build_object('eventId',v_event,'status','withdrawn','reusedExisting',false);
END $$;

-- The same direct provider key is used for any safe retry. An attempt already
-- started when withdrawal commits stays recorded, not retroactively unsent.
CREATE FUNCTION public.w192_begin_direct_interest_notice(
  p_match_id UUID,p_interest_at TIMESTAMPTZ
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE;
  v_notice public.opportunity_interest_direct_notices%ROWTYPE;
  v_now TIMESTAMPTZ:=clock_timestamp();
BEGIN
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE;
  IF v_match.id IS NULL OR v_match.status<>'interested'
    OR v_match.interest_expressed_at IS DISTINCT FROM p_interest_at
    OR v_match.interest_notification_sent_at IS NOT NULL
    OR NOT public.w164_match_has_same_namespace(v_match.id)
    OR NOT EXISTS(SELECT 1 FROM public.opportunities o
      WHERE o.id=v_match.opportunity_id AND o.status='active')
  THEN RETURN false; END IF;
  INSERT INTO public.opportunity_interest_direct_notices(match_id,interest_expressed_at,status)
    VALUES(p_match_id,p_interest_at,'pending') ON CONFLICT DO NOTHING;
  SELECT * INTO v_notice FROM public.opportunity_interest_direct_notices
    WHERE match_id=p_match_id AND interest_expressed_at=p_interest_at FOR UPDATE;
  IF v_notice.status IN ('sent','suppressed','review_required') THEN RETURN false; END IF;
  IF v_notice.provider_outcome IN ('attempting','uncertain')
    AND (v_notice.provider_attempted_at IS NULL
      OR v_notice.provider_attempted_at<=v_now-interval '23 hours') THEN
    UPDATE public.opportunity_interest_direct_notices
      SET status='review_required',provider_outcome='uncertain',updated_at=v_now
      WHERE match_id=p_match_id AND interest_expressed_at=p_interest_at;
    RETURN false;
  END IF;
  -- One exact token owns one live provider attempt. A concurrent browser retry
  -- must not make another request while its first outcome is unresolved.
  IF v_notice.provider_outcome IN ('attempting','uncertain') THEN RETURN false; END IF;
  UPDATE public.opportunity_interest_direct_notices SET
    status='attempting',provider_outcome=CASE WHEN provider_outcome IN ('attempting','uncertain')
      THEN 'uncertain' ELSE 'attempting' END,
    provider_attempted_at=COALESCE(provider_attempted_at,v_now),updated_at=v_now
    WHERE match_id=p_match_id AND interest_expressed_at=p_interest_at;
  RETURN true;
END $$;

CREATE FUNCTION public.w192_complete_direct_interest_notice(
  p_match_id UUID,p_interest_at TIMESTAMPTZ,p_outcome TEXT,p_provider_message_id TEXT DEFAULT NULL
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_notice public.opportunity_interest_direct_notices%ROWTYPE;
  v_now TIMESTAMPTZ:=clock_timestamp();
BEGIN
  IF p_outcome NOT IN ('sent','rejected','uncertain') THEN RAISE EXCEPTION 'invalid_direct_notice_outcome'; END IF;
  SELECT * INTO v_notice FROM public.opportunity_interest_direct_notices
    WHERE match_id=p_match_id AND interest_expressed_at=p_interest_at FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'direct_notice_missing'; END IF;
  IF v_notice.status='sent' THEN RETURN 'sent'; END IF;
  IF v_notice.status NOT IN ('attempting','uncertain') THEN RETURN 'stale'; END IF;
  UPDATE public.opportunity_interest_direct_notices SET
    status=p_outcome,provider_outcome=CASE p_outcome
      WHEN 'sent' THEN 'accepted' WHEN 'rejected' THEN 'rejected' ELSE 'uncertain' END,
    provider_message_id=CASE WHEN p_outcome='sent' THEN p_provider_message_id ELSE provider_message_id END,
    sent_at=CASE WHEN p_outcome='sent' THEN v_now ELSE sent_at END,
    updated_at=v_now
    WHERE match_id=p_match_id AND interest_expressed_at=p_interest_at;
  RETURN p_outcome;
END $$;

-- W173's claim and begin functions already re-run this payload immediately
-- before provider I/O. Make a proposed Interested alert exact to its still-
-- current request, not just to the old event's existence.
CREATE OR REPLACE FUNCTION public.w173_interest_delivery_payload(p_event_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_payload JSONB;
BEGIN
  SELECT jsonb_build_object('eventId',e.id,'eventType',e.event_type,'matchId',m.id,
    'repreneurId',r.id,'recipientEmail',CASE WHEN e.event_type IN ('proposed_interested','proposed_declined')
      THEN '' ELSE COALESCE(public.w175_assignment_recipient_email(r.email),'') END,
    'firstName',COALESCE(NULLIF(BTRIM(r.first_name),''),'Bonjour'),
    'repreneurName',COALESCE(NULLIF(BTRIM(r.first_name||' '||r.last_name),''),r.email),
    'opportunityTitle',COALESCE(NULLIF(BTRIM(o.public_title),''),'cette opportunité'),
    'templateKey',d.template_key,'subject',t.subject,'body',t.body_markdown)
  INTO v_payload FROM public.opportunity_interest_events e
    JOIN public.opportunity_interest_notification_deliveries d ON d.event_id=e.id
    JOIN public.opportunity_matches m ON m.id=e.match_id
    JOIN public.opportunities o ON o.id=m.opportunity_id
    JOIN public.repreneurs r ON r.id=m.repreneur_id
    JOIN public.email_templates t ON t.template_key=d.template_key
  WHERE e.id=p_event_id AND d.status IN ('pending','failed')
    AND (d.payload_sha256 IS NULL OR d.template_updated_at=t.updated_at) AND t.is_active IS TRUE
    AND (e.event_type IN ('proposed_interested','proposed_declined')
      OR t.requires_consent IS FALSE OR r.marketing_consent IS TRUE)
    AND o.status='active' AND o.is_demo=false AND r.is_demo=false
    AND public.w164_match_has_same_namespace(m.id)
    AND (e.event_type IN ('proposed_interested','proposed_declined') OR (
      public.w175_assignment_recipient_email(r.email) IS NOT NULL
      AND NOT public.ma_contact_email_address_is_suppressed(r.email)))
    AND ((e.event_type='proposed_interested' AND NOT EXISTS(
        SELECT 1 FROM public.opportunity_interest_events withdrawn
        WHERE withdrawn.match_id=e.match_id AND withdrawn.event_type='withdrawn'
          AND withdrawn.interest_expressed_at=e.interest_expressed_at))
      OR e.event_type='proposed_declined'
      OR (e.event_type='validated' AND m.status='active_pursuit'
        AND e.validation_evidence_id=public.journey_current_cycle_event(m.id))
      OR (e.event_type='rejected' AND m.status='interested'
        AND e.interest_expressed_at IS NOT DISTINCT FROM m.interest_expressed_at))
    AND (e.event_type NOT IN ('validated','rejected') OR EXISTS(
      SELECT 1 FROM public.app_user_roles role_row WHERE role_row.role='repreneur'
        AND role_row.repreneur_id=r.id AND role_row.user_id IS NOT NULL));
  RETURN v_payload;
END $$;

-- The raw journey RPC cannot turn an old post-withdrawal page replay into a
-- new pursuit. W173 exact validation supplies the current token only after
-- it has locked and compared both token and version.
CREATE OR REPLACE FUNCTION public.journey_start_pursuit(
  p_match_id UUID,p_actor TEXT,p_idempotency_key TEXT,p_evidence_reference TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE; v_existing UUID; v_blank_present BOOLEAN;
  v_previous public.opportunity_pursuit_evidence%ROWTYPE; v_revalidate BOOLEAN:=false;
BEGIN
  IF NOT public.wave_journey_is_enabled() THEN RAISE EXCEPTION 'wave_journey_disabled'; END IF;
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE;
  IF v_match.id IS NULL OR NOT public.w164_match_has_same_namespace(v_match.id)
    OR (SELECT count(*) FROM public.app_user_roles WHERE role='staff' AND (user_id=p_actor OR email=p_actor))<>1
  THEN RAISE EXCEPTION 'Mutual-interest validation requires exact staff and a same-namespace match.'; END IF;
  SELECT id INTO v_existing FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND idempotency_key=p_idempotency_key;
  IF v_existing IS NOT NULL THEN
    IF v_match.status='active_pursuit' AND v_existing=public.journey_current_cycle_event(p_match_id) THEN RETURN v_existing; END IF;
    RAISE EXCEPTION 'validation_idempotency_stale' USING ERRCODE='P0001';
  END IF;
  IF v_match.status='active_pursuit' THEN
    SELECT * INTO v_previous FROM public.opportunity_pursuit_evidence WHERE id=public.journey_current_cycle_event(p_match_id);
    IF v_previous.id IS NULL OR jsonb_typeof(v_previous.metadata->'blank_nda_present_at_validation')='boolean'
      OR EXISTS(SELECT 1 FROM public.opportunity_pursuit_confidential_grants WHERE match_id=p_match_id AND revoked_at IS NULL)
    THEN RAISE EXCEPTION 'Only a historical pursuit without frozen validation or live access may be revalidated.'; END IF;
    v_revalidate:=true;
  ELSIF v_match.status<>'interested' THEN RAISE EXCEPTION 'Only an interested match can start a pursuit.'; END IF;
  IF NOT v_revalidate AND EXISTS(SELECT 1 FROM public.opportunity_interest_events e
    WHERE e.match_id=p_match_id AND e.event_type='withdrawn')
    AND current_setting('wave.w192_exact_validation',true)
      IS DISTINCT FROM v_match.interest_expressed_at::text
  THEN RAISE EXCEPTION 'validation_requires_exact_interest' USING ERRCODE='P0001'; END IF;
  IF NOT v_revalidate AND EXISTS(SELECT 1 FROM public.opportunity_interest_events e
    WHERE e.match_id=p_match_id AND e.event_type='rejected'
      AND e.interest_expressed_at IS NOT DISTINCT FROM v_match.interest_expressed_at) THEN
    RAISE EXCEPTION 'interest_rejected' USING ERRCODE='P0001'; END IF;
  PERFORM 1 FROM public.opportunities WHERE id=v_match.opportunity_id AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only an active opportunity can start a pursuit.'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.opportunity_nda_artifacts a JOIN public.opportunity_documents d ON d.id=a.document_id WHERE a.opportunity_id=v_match.opportunity_id AND a.match_id IS NULL AND a.artifact_role='blank_template' AND d.document_type='nda' AND d.visibility='staff_only' AND d.external_url IS NULL AND d.storage_bucket='opportunity-documents' AND d.storage_path LIKE v_match.opportunity_id::TEXT||'/nda-artifacts/blank_template/%' AND d.size_bytes>0 AND ((d.mime_type='application/pdf' AND LOWER(d.file_name) LIKE '%.pdf') OR (d.mime_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document' AND LOWER(d.file_name) LIKE '%.docx'))) INTO v_blank_present;
  IF NOT v_revalidate THEN
    UPDATE public.opportunity_matches SET status='active_pursuit',pursuit_stage='interest',pursuit_stage_updated_by=p_actor,pursuit_stage_updated_at=NOW(),reviewed_by=p_actor,reviewed_at=NOW() WHERE id=p_match_id;
  END IF;
  RETURN public.journey_append_evidence(p_match_id,'mutual_interest_validated',p_actor,p_idempotency_key,NULL,NULL,p_evidence_reference,jsonb_build_object('blank_nda_present_at_validation',v_blank_present,'previous_validation_evidence_id',v_previous.id,'historical_revalidation',v_revalidate));
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'This opportunity already has an active pursuit.'; END $$;

CREATE OR REPLACE FUNCTION public.w173_validate_exact_interest(
  p_match_id UUID,p_opportunity_id UUID,p_actor TEXT,p_expected_interest_at TIMESTAMPTZ,
  p_expected_updated_at TIMESTAMPTZ,p_idempotency_key TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE; v_existing UUID;
BEGIN
  IF p_expected_updated_at IS NULL OR NULLIF(BTRIM(p_idempotency_key),'') IS NULL THEN
    RAISE EXCEPTION 'validation_interest_stale' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE;
  IF v_match.id IS NULL OR v_match.opportunity_id<>p_opportunity_id
    OR NOT public.w164_match_has_same_namespace(v_match.id)
    OR (SELECT count(*) FROM public.app_user_roles WHERE role='staff' AND (user_id=p_actor OR email=p_actor))<>1 THEN
    RAISE EXCEPTION 'validation_interest_stale' USING ERRCODE='P0001'; END IF;
  SELECT id INTO v_existing FROM public.opportunity_pursuit_evidence
    WHERE match_id=p_match_id AND idempotency_key=p_idempotency_key;
  IF v_match.status='active_pursuit' AND v_existing IS NOT NULL
    AND v_existing=public.journey_current_cycle_event(p_match_id) THEN RETURN v_existing; END IF;
  IF v_match.status<>'interested'
    OR v_match.interest_expressed_at IS DISTINCT FROM p_expected_interest_at
    OR v_match.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'validation_interest_stale' USING ERRCODE='P0001'; END IF;
  PERFORM set_config('wave.w192_exact_validation',v_match.interest_expressed_at::text,true);
  RETURN public.journey_start_pursuit(p_match_id,p_actor,p_idempotency_key,'staff validation');
END $$;

-- Private reason/history is available only to actual staff and only for the
-- current withdrawn token. The portal projection reads status, not this RPC.
CREATE FUNCTION public.w192_staff_withdrawals(p_actor TEXT,p_match_ids UUID[])
RETURNS TABLE(match_id UUID,interest_expressed_at TIMESTAMPTZ,reason TEXT,
  withdrawn_at TIMESTAMPTZ,actor TEXT,origin TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF cardinality(p_match_ids)>100 OR (SELECT count(*) FROM public.app_user_roles
    WHERE role='staff' AND (user_id=p_actor OR email=p_actor))<>1
  THEN RAISE EXCEPTION 'staff_required'; END IF;
  RETURN QUERY SELECT m.id,e.interest_expressed_at,e.internal_reason,e.occurred_at,
    e.actor,e.withdrawal_origin
    FROM public.opportunity_matches m JOIN public.opportunity_interest_events e ON e.match_id=m.id
    WHERE m.id=ANY(p_match_ids) AND m.status='withdrawn' AND e.event_type='withdrawn'
      AND e.interest_expressed_at=m.interest_expressed_at
      AND public.w164_match_has_same_namespace(m.id);
END $$;

REVOKE ALL ON FUNCTION public.w192_guard_withdrawn_match_status(),
  public.w192_guard_interest_event_history(),
  public.w192_withdraw_exact_interest(UUID,UUID,UUID,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,UUID,UUID),
  public.w192_reexpress_withdrawn_interest(UUID,UUID,TEXT,TIMESTAMPTZ,TIMESTAMPTZ),
  public.w192_begin_direct_interest_notice(UUID,TIMESTAMPTZ),
  public.w192_complete_direct_interest_notice(UUID,TIMESTAMPTZ,TEXT,TEXT),
  public.w192_staff_withdrawals(TEXT,UUID[])
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION
  public.w192_withdraw_exact_interest(UUID,UUID,UUID,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,UUID,UUID),
  public.w192_reexpress_withdrawn_interest(UUID,UUID,TEXT,TIMESTAMPTZ,TIMESTAMPTZ),
  public.w192_begin_direct_interest_notice(UUID,TIMESTAMPTZ),
  public.w192_complete_direct_interest_notice(UUID,TIMESTAMPTZ,TEXT,TEXT),
  public.w192_staff_withdrawals(TEXT,UUID[])
  TO service_role;
