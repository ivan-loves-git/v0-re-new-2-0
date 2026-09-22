-- Ticket #173 / Decision #161. Forward-only exact response and disposition
-- evidence. New notification keys are deliberately inactive. A disabled key
-- suppresses the event permanently: enabling it later never replays a backlog.

CREATE TABLE public.opportunity_interest_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.opportunity_matches(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN
    ('proposed_interested','proposed_declined','validated','rejected')),
  interest_expressed_at TIMESTAMPTZ,
  match_updated_at TIMESTAMPTZ NOT NULL,
  actor TEXT NOT NULL CHECK (NULLIF(BTRIM(actor),'') IS NOT NULL),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  validation_evidence_id UUID UNIQUE REFERENCES public.opportunity_pursuit_evidence(id) ON DELETE RESTRICT,
  internal_reason TEXT,
  CONSTRAINT opportunity_interest_event_shape CHECK (
    (event_type='validated' AND validation_evidence_id IS NOT NULL AND internal_reason IS NULL)
    OR (event_type='rejected' AND validation_evidence_id IS NULL
      AND NULLIF(BTRIM(internal_reason),'') IS NOT NULL AND char_length(BTRIM(internal_reason))<=500)
    OR (event_type IN ('proposed_interested','proposed_declined')
      AND validation_evidence_id IS NULL AND internal_reason IS NULL)
  )
);
CREATE INDEX opportunity_interest_events_match_time ON public.opportunity_interest_events(match_id,occurred_at DESC,id DESC);
CREATE UNIQUE INDEX opportunity_interest_one_rejection_per_interest
  ON public.opportunity_interest_events(match_id,COALESCE(interest_expressed_at,'-infinity'::timestamptz))
  WHERE event_type='rejected';
ALTER TABLE public.opportunity_interest_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_interest_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.opportunity_interest_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.opportunity_interest_events TO service_role;

CREATE TABLE public.opportunity_interest_notification_deliveries (
  event_id UUID PRIMARY KEY REFERENCES public.opportunity_interest_events(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,
  template_updated_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK(status IN ('pending','failed','sent','suppressed','review_required')),
  lease_token UUID,
  lease_expires_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count>=0),
  payload_sha256 TEXT CHECK(payload_sha256 IS NULL OR payload_sha256 ~ '^[a-f0-9]{64}$'),
  provider_attempted_at TIMESTAMPTZ,
  provider_outcome TEXT CHECK(provider_outcome IS NULL OR provider_outcome IN ('attempting','uncertain','rejected','accepted','blocked','deferred')),
  provider_message_id TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX opportunity_interest_notifications_pending ON public.opportunity_interest_notification_deliveries(created_at,event_id)
  WHERE status IN ('pending','failed');
ALTER TABLE public.opportunity_interest_notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_interest_notification_deliveries FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.opportunity_interest_notification_deliveries FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT(event_id,status,created_at) ON public.opportunity_interest_notification_deliveries TO service_role;

INSERT INTO public.email_templates(template_key,subject,description,is_active,requires_consent,body_markdown,body_editable)
VALUES
 ('interest_outcome_validated','Suite à votre intérêt pour {opportunityTitle}',
  'Neutral outcome after exact staff validation; no private source or staff notes.',false,false,
  E'Bonjour {firstName},\n\nRe-New a validé votre intérêt pour {opportunityTitle}. Notre équipe vous contactera pour la suite.\n\nL’équipe Re-New',true),
 ('interest_outcome_rejected','Suite à votre intérêt pour {opportunityTitle}',
  'Neutral outcome after staff rejects this exact interest; not an account rejection.',false,false,
  E'Bonjour {firstName},\n\nAprès examen, Re-New ne poursuivra pas cette opportunité avec vous pour le moment. Cela ne change pas votre accès aux autres opportunités.\n\nL’équipe Re-New',true),
 ('proposed_opportunity_response_staff','Réponse à une opportunité proposée — {opportunityTitle}',
  'Configured staff alert for a new response to a staff proposal; not the unassigned-interest alert.',false,false,
  E'Bonjour,\n\n{repreneurName} a répondu {responseLabel} à l’opportunité {opportunityTitle}. Consultez WAVE pour la suite.\n\nL’équipe Re-New',true)
ON CONFLICT(template_key) DO NOTHING;

-- The event and its once-only delivery record are committed with the source
-- business transaction. An absent/inactive key or DEMO match is terminally
-- suppressed, never queued for catch-up after a settings change.
CREATE OR REPLACE FUNCTION public.w173_record_interest_delivery()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_key TEXT; v_template public.email_templates%ROWTYPE; v_real BOOLEAN;
BEGIN
  v_key:=CASE NEW.event_type
    WHEN 'validated' THEN 'interest_outcome_validated'
    WHEN 'rejected' THEN 'interest_outcome_rejected'
    ELSE 'proposed_opportunity_response_staff' END;
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
CREATE TRIGGER w173_record_interest_delivery AFTER INSERT ON public.opportunity_interest_events
  FOR EACH ROW EXECUTE FUNCTION public.w173_record_interest_delivery();

-- Capture only a real repreneur RPC response, not staff editing a match status.
-- The old RPC signature remains compatible during schema-first deployment.
CREATE OR REPLACE FUNCTION public.w173_capture_proposed_response()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF current_setting('wave.repreneur_response',true)='on'
    AND NEW.status IS DISTINCT FROM OLD.status
    AND ((OLD.status='proposed' AND NEW.status IN ('interested','declined'))
      OR (OLD.status='interested' AND NEW.status='declined' AND EXISTS(
        SELECT 1 FROM public.opportunity_interest_events prior
        WHERE prior.match_id=NEW.id AND prior.event_type='proposed_interested'
          AND prior.interest_expressed_at IS NOT DISTINCT FROM NEW.interest_expressed_at))) THEN
    INSERT INTO public.opportunity_interest_events
      (match_id,event_type,interest_expressed_at,match_updated_at,actor)
    VALUES(NEW.id,CASE WHEN NEW.status='interested' THEN 'proposed_interested' ELSE 'proposed_declined' END,
      NEW.interest_expressed_at,NEW.updated_at,NEW.repreneur_id::text);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER w173_capture_proposed_response AFTER UPDATE OF status ON public.opportunity_matches
  FOR EACH ROW EXECUTE FUNCTION public.w173_capture_proposed_response();

CREATE OR REPLACE FUNCTION public.update_repreneur_opportunity_response(
  p_match_id UUID,p_repreneur_id UUID,p_status TEXT,
  p_decline_reason_categories TEXT[] DEFAULT '{}',p_decline_reason_text TEXT DEFAULT NULL
)
RETURNS TABLE(match_id UUID,opportunity_id UUID,status TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE; v_opportunity public.opportunities%ROWTYPE; v_repreneur_demo BOOLEAN;
BEGIN
  IF p_status NOT IN ('interested','declined') THEN RAISE EXCEPTION 'response_not_available' USING ERRCODE='P0001'; END IF;
  SELECT is_demo INTO v_repreneur_demo FROM public.repreneurs WHERE id=p_repreneur_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'response_not_available' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id AND repreneur_id=p_repreneur_id FOR UPDATE;
  IF NOT FOUND OR NOT public.w164_match_has_same_namespace(v_match.id) THEN RAISE EXCEPTION 'response_not_available' USING ERRCODE='P0001'; END IF;
  IF v_match.status NOT IN ('proposed','interested','declined') THEN RAISE EXCEPTION 'response_locked' USING ERRCODE='P0001'; END IF;
  IF EXISTS(SELECT 1 FROM public.opportunity_interest_events decision
    WHERE decision.match_id=v_match.id AND decision.event_type='rejected'
      AND decision.interest_expressed_at IS NOT DISTINCT FROM v_match.interest_expressed_at) THEN
    RAISE EXCEPTION 'response_locked' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_opportunity FROM public.opportunities opportunity
    WHERE opportunity.id=v_match.opportunity_id AND opportunity.status='active' AND opportunity.is_demo=v_repreneur_demo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'response_not_available' USING ERRCODE='P0001'; END IF;
  IF v_match.status<>p_status::public.opportunity_match_status THEN
    PERFORM set_config('wave.repreneur_response','on',true);
    UPDATE public.opportunity_matches SET status=p_status::public.opportunity_match_status,
      decline_reason_categories=CASE WHEN p_status='declined' THEN COALESCE(p_decline_reason_categories,'{}') ELSE '{}' END,
      decline_reason_text=CASE WHEN p_status='declined' THEN NULLIF(BTRIM(p_decline_reason_text),'') ELSE NULL END,
      interest_expressed_at=CASE WHEN p_status='interested' THEN clock_timestamp() ELSE v_match.interest_expressed_at END,
      reviewed_by=NULL,reviewed_at=NULL WHERE id=v_match.id;
  END IF;
  RETURN QUERY SELECT v_match.id,v_opportunity.id,p_status;
END $$;

-- Staff rejection is a distinct staff-only decision. Match state, account,
-- other deals, queue and confidential grants are deliberately untouched.
CREATE OR REPLACE FUNCTION public.w173_reject_exact_interest(
  p_match_id UUID,p_expected_interest_at TIMESTAMPTZ,p_expected_updated_at TIMESTAMPTZ,
  p_actor TEXT,p_reason TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE; v_existing UUID; v_event UUID; v_reason TEXT:=BTRIM(p_reason);
BEGIN
  IF v_reason IS NULL OR char_length(v_reason)<1 OR char_length(v_reason)>500 THEN
    RAISE EXCEPTION 'interest_rejection_reason_required' USING ERRCODE='P0001'; END IF;
  IF (SELECT count(*) FROM public.app_user_roles WHERE role='staff' AND (user_id=p_actor OR email=p_actor))<>1 THEN
    RAISE EXCEPTION 'interest_rejection_staff_required' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE;
  IF v_match.id IS NULL OR NOT public.w164_match_has_same_namespace(v_match.id)
    OR v_match.status<>'interested' OR v_match.interest_expressed_at IS DISTINCT FROM p_expected_interest_at
    OR v_match.updated_at IS DISTINCT FROM p_expected_updated_at
    OR NOT EXISTS(SELECT 1 FROM public.opportunities WHERE id=v_match.opportunity_id AND status='active') THEN
    RAISE EXCEPTION 'interest_rejection_stale' USING ERRCODE='P0001'; END IF;
  SELECT id INTO v_existing FROM public.opportunity_interest_events
    WHERE match_id=v_match.id AND event_type='rejected'
      AND interest_expressed_at IS NOT DISTINCT FROM v_match.interest_expressed_at;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  INSERT INTO public.opportunity_interest_events
    (match_id,event_type,interest_expressed_at,match_updated_at,actor,internal_reason)
  VALUES(v_match.id,'rejected',v_match.interest_expressed_at,v_match.updated_at,p_actor,v_reason)
  RETURNING id INTO v_event;
  RETURN v_event;
END $$;

-- Validation and rejection acquire the same match row lock. The existing
-- canonical validation evidence remains the sole positive business decision.
CREATE OR REPLACE FUNCTION public.journey_start_pursuit(
  p_match_id UUID,p_actor TEXT,p_idempotency_key TEXT,p_evidence_reference TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE; v_existing UUID; v_blank_present BOOLEAN; v_previous public.opportunity_pursuit_evidence%ROWTYPE; v_revalidate BOOLEAN:=false;
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

-- Staff confirmation is bound to the exact interest/version displayed in the
-- response queue. The row lock is held through canonical evidence creation.
-- A lost response may return only the same current validation cycle.
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
  RETURN public.journey_start_pursuit(p_match_id,p_actor,p_idempotency_key,'staff validation');
END $$;

-- The legacy journey panel exposes only active-pursuit historical
-- revalidation. A fresh Interested match must use the exact-token path above.
CREATE OR REPLACE FUNCTION public.w173_revalidate_historical_pursuit(
  p_match_id UUID,p_actor TEXT,p_idempotency_key TEXT,p_evidence_reference TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE;
BEGIN
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE;
  IF v_match.id IS NULL OR v_match.status<>'active_pursuit' THEN
    RAISE EXCEPTION 'historical_revalidation_requires_active_pursuit' USING ERRCODE='P0001'; END IF;
  RETURN public.journey_start_pursuit(p_match_id,p_actor,p_idempotency_key,p_evidence_reference);
END $$;

CREATE OR REPLACE FUNCTION public.w173_capture_validation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE;
BEGIN
  IF NEW.event_type<>'mutual_interest_validated' OR NEW.metadata->>'historical_revalidation'='true' THEN RETURN NEW; END IF;
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id=NEW.match_id;
  INSERT INTO public.opportunity_interest_events
    (match_id,event_type,interest_expressed_at,match_updated_at,actor,validation_evidence_id)
  VALUES(NEW.match_id,'validated',v_match.interest_expressed_at,v_match.updated_at,NEW.actor,NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER w173_capture_validation AFTER INSERT ON public.opportunity_pursuit_evidence
  FOR EACH ROW EXECUTE FUNCTION public.w173_capture_validation();

-- Separate, explicitly authorized projections. No staff reason can appear in
-- the repreneur payload or delivery payload even if a client supplies UUIDs.
CREATE OR REPLACE FUNCTION public.w173_repreneur_rejections(p_repreneur_id UUID,p_match_ids UUID[])
RETURNS TABLE(match_id UUID) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF cardinality(p_match_ids)>100 THEN RAISE EXCEPTION 'too_many_matches'; END IF;
  RETURN QUERY SELECT m.id FROM public.opportunity_matches m
    JOIN public.opportunity_interest_events e ON e.match_id=m.id AND e.event_type='rejected'
      AND e.interest_expressed_at IS NOT DISTINCT FROM m.interest_expressed_at
    WHERE m.id=ANY(p_match_ids) AND m.repreneur_id=p_repreneur_id AND m.status='interested'
      AND public.w164_match_has_same_namespace(m.id);
END $$;
CREATE OR REPLACE FUNCTION public.w173_staff_rejections(p_actor TEXT,p_match_ids UUID[])
RETURNS TABLE(match_id UUID,interest_expressed_at TIMESTAMPTZ,reason TEXT,decided_at TIMESTAMPTZ,decided_by TEXT,delivery_status TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF cardinality(p_match_ids)>100 OR (SELECT count(*) FROM public.app_user_roles
    WHERE role='staff' AND (user_id=p_actor OR email=p_actor))<>1 THEN RAISE EXCEPTION 'staff_required'; END IF;
  RETURN QUERY SELECT m.id,e.interest_expressed_at,e.internal_reason,e.occurred_at,e.actor,d.status
    FROM public.opportunity_matches m JOIN public.opportunity_interest_events e ON e.match_id=m.id
    JOIN public.opportunity_interest_notification_deliveries d ON d.event_id=e.id
    WHERE m.id=ANY(p_match_ids) AND m.status='interested' AND e.event_type='rejected'
      AND e.interest_expressed_at IS NOT DISTINCT FROM m.interest_expressed_at
      AND public.w164_match_has_same_namespace(m.id);
END $$;

-- Service-only delivery payload. The internal reason is intentionally absent.
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
    AND (e.event_type IN ('proposed_interested','proposed_declined')
      OR (e.event_type='validated' AND m.status='active_pursuit'
        AND e.validation_evidence_id=public.journey_current_cycle_event(m.id))
      OR (e.event_type='rejected' AND m.status='interested'
        AND e.interest_expressed_at IS NOT DISTINCT FROM m.interest_expressed_at))
    AND (e.event_type NOT IN ('validated','rejected') OR EXISTS(
      SELECT 1 FROM public.app_user_roles role_row WHERE role_row.role='repreneur'
        AND role_row.repreneur_id=r.id AND role_row.user_id IS NOT NULL));
  RETURN v_payload;
END $$;

CREATE OR REPLACE FUNCTION public.w173_claim_interest_delivery(p_event_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_delivery public.opportunity_interest_notification_deliveries%ROWTYPE;
  v_now TIMESTAMPTZ:=clock_timestamp(); v_token UUID:=gen_random_uuid();
BEGIN
  SELECT * INTO v_delivery FROM public.opportunity_interest_notification_deliveries WHERE event_id=p_event_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','missing'); END IF;
  IF v_delivery.status IN ('sent','suppressed','review_required') THEN RETURN jsonb_build_object('status',v_delivery.status); END IF;
  IF v_delivery.lease_expires_at>v_now THEN RETURN jsonb_build_object('status','busy'); END IF;
  IF v_delivery.provider_outcome IN ('attempting','uncertain')
    AND (v_delivery.provider_attempted_at IS NULL OR v_delivery.provider_attempted_at<=v_now-interval '23 hours') THEN
    UPDATE public.opportunity_interest_notification_deliveries SET status='review_required',updated_at=v_now
      WHERE event_id=p_event_id;
    RETURN jsonb_build_object('status','review_required');
  END IF;
  -- An expired lease after a provider boundary is unknown, even if the
  -- process died before recording its outcome. Preserve that uncertainty
  -- through later no-I/O preflight failures and across the 23-hour fence.
  IF v_delivery.provider_outcome='attempting' THEN
    UPDATE public.opportunity_interest_notification_deliveries
      SET provider_outcome='uncertain',updated_at=v_now WHERE event_id=p_event_id;
    v_delivery.provider_outcome:='uncertain';
  END IF;
  IF public.w173_interest_delivery_payload(p_event_id) IS NULL THEN
    UPDATE public.opportunity_interest_notification_deliveries
      SET status=CASE WHEN v_delivery.payload_sha256 IS NULL THEN 'suppressed' ELSE 'review_required' END,
        lease_token=NULL,lease_expires_at=NULL,updated_at=v_now WHERE event_id=p_event_id;
    RETURN jsonb_build_object('status',CASE WHEN v_delivery.payload_sha256 IS NULL THEN 'suppressed' ELSE 'review_required' END);
  END IF;
  UPDATE public.opportunity_interest_notification_deliveries
    SET status='pending',lease_token=v_token,lease_expires_at=v_now+interval '5 minutes',
      attempt_count=attempt_count+1,updated_at=v_now WHERE event_id=p_event_id;
  RETURN jsonb_build_object('status','claimed','leaseToken',v_token::text);
END $$;

CREATE OR REPLACE FUNCTION public.w173_begin_interest_provider_attempt(
  p_event_id UUID,p_lease_token UUID,p_payload_sha256 TEXT,p_expected_payload JSONB
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_delivery public.opportunity_interest_notification_deliveries%ROWTYPE; v_now TIMESTAMPTZ:=clock_timestamp();
BEGIN
  IF p_payload_sha256 !~ '^[a-f0-9]{64}$' THEN RETURN false; END IF;
  SELECT * INTO v_delivery FROM public.opportunity_interest_notification_deliveries WHERE event_id=p_event_id FOR UPDATE;
  IF NOT FOUND OR v_delivery.status<>'pending' OR v_delivery.lease_token IS DISTINCT FROM p_lease_token
    OR v_delivery.lease_expires_at<=v_now THEN RETURN false; END IF;
  IF v_delivery.payload_sha256 IS NOT NULL AND v_delivery.payload_sha256<>p_payload_sha256 THEN
    UPDATE public.opportunity_interest_notification_deliveries
      SET status='review_required',lease_token=NULL,lease_expires_at=NULL,updated_at=v_now WHERE event_id=p_event_id;
    RETURN false;
  END IF;
  IF public.w173_interest_delivery_payload(p_event_id) IS DISTINCT FROM p_expected_payload THEN
    UPDATE public.opportunity_interest_notification_deliveries
      SET status='review_required',lease_token=NULL,lease_expires_at=NULL,updated_at=v_now WHERE event_id=p_event_id;
    RETURN false;
  END IF;
  IF v_delivery.provider_outcome IN ('attempting','uncertain') AND
      (v_delivery.provider_attempted_at IS NULL OR v_delivery.provider_attempted_at<=v_now-interval '23 hours')
  THEN
    UPDATE public.opportunity_interest_notification_deliveries
      SET status='review_required',lease_token=NULL,lease_expires_at=NULL,updated_at=v_now WHERE event_id=p_event_id;
    RETURN false;
  END IF;
  UPDATE public.opportunity_interest_notification_deliveries
    SET payload_sha256=COALESCE(payload_sha256,p_payload_sha256),
      template_updated_at=(SELECT updated_at FROM public.email_templates WHERE template_key=v_delivery.template_key),
      provider_attempted_at=CASE WHEN provider_outcome IN ('attempting','uncertain')
        THEN provider_attempted_at ELSE v_now END,
      provider_outcome=CASE WHEN provider_outcome IN ('attempting','uncertain')
        THEN 'uncertain' ELSE 'attempting' END,updated_at=v_now WHERE event_id=p_event_id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.w173_complete_interest_delivery(
  p_event_id UUID,p_lease_token UUID,p_outcome TEXT,p_provider_message_id TEXT DEFAULT NULL
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_delivery public.opportunity_interest_notification_deliveries%ROWTYPE; v_now TIMESTAMPTZ:=clock_timestamp();
BEGIN
  IF p_outcome NOT IN ('sent','rejected','uncertain','suppressed','deferred') THEN RAISE EXCEPTION 'invalid_delivery_outcome'; END IF;
  SELECT * INTO v_delivery FROM public.opportunity_interest_notification_deliveries WHERE event_id=p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'delivery_missing'; END IF;
  IF v_delivery.status='sent' THEN RETURN 'sent'; END IF;
  IF v_delivery.status<>'pending' OR v_delivery.lease_token IS DISTINCT FROM p_lease_token THEN RETURN 'stale'; END IF;
  UPDATE public.opportunity_interest_notification_deliveries SET
    status=CASE WHEN p_outcome='sent' THEN 'sent'
      WHEN p_outcome='suppressed' AND v_delivery.provider_outcome='uncertain' THEN 'review_required'
      WHEN p_outcome='suppressed' THEN 'suppressed' ELSE 'failed' END,
    lease_token=NULL,lease_expires_at=NULL,
    provider_outcome=CASE WHEN p_outcome='sent' THEN 'accepted'
      WHEN v_delivery.provider_outcome='uncertain' THEN 'uncertain'
      WHEN p_outcome='rejected' THEN 'rejected' WHEN p_outcome='uncertain' THEN 'uncertain'
      WHEN p_outcome='deferred' THEN 'deferred' ELSE 'blocked' END,
    provider_attempted_at=CASE WHEN p_outcome IN ('suppressed','deferred') AND v_delivery.provider_outcome IS DISTINCT FROM 'uncertain'
      THEN NULL ELSE provider_attempted_at END,
    payload_sha256=CASE WHEN p_outcome IN ('suppressed','deferred') AND v_delivery.provider_outcome IS DISTINCT FROM 'uncertain'
      THEN NULL ELSE payload_sha256 END,
    template_updated_at=CASE WHEN p_outcome IN ('suppressed','deferred') AND v_delivery.provider_outcome IS DISTINCT FROM 'uncertain'
      THEN NULL ELSE template_updated_at END,
    provider_message_id=CASE WHEN p_outcome='sent' THEN p_provider_message_id ELSE provider_message_id END,
    sent_at=CASE WHEN p_outcome='sent' THEN v_now ELSE sent_at END,updated_at=v_now WHERE event_id=p_event_id;
  IF p_outcome='suppressed' AND v_delivery.provider_outcome='uncertain' THEN RETURN 'review_required'; END IF;
  RETURN p_outcome;
END $$;

REVOKE ALL ON FUNCTION public.w173_record_interest_delivery(),public.w173_capture_proposed_response(),
  public.w173_capture_validation(),public.w173_reject_exact_interest(UUID,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,TEXT),
  public.w173_validate_exact_interest(UUID,UUID,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TEXT),
  public.w173_revalidate_historical_pursuit(UUID,TEXT,TEXT,TEXT),
  public.w173_repreneur_rejections(UUID,UUID[]),public.w173_staff_rejections(TEXT,UUID[]),
  public.w173_interest_delivery_payload(UUID),public.w173_claim_interest_delivery(UUID),
  public.w173_begin_interest_provider_attempt(UUID,UUID,TEXT,JSONB),
  public.w173_complete_interest_delivery(UUID,UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.w173_reject_exact_interest(UUID,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,TEXT),
  public.w173_validate_exact_interest(UUID,UUID,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TEXT),
  public.w173_revalidate_historical_pursuit(UUID,TEXT,TEXT,TEXT),
  public.w173_repreneur_rejections(UUID,UUID[]),public.w173_staff_rejections(TEXT,UUID[]),
  public.w173_interest_delivery_payload(UUID),public.w173_claim_interest_delivery(UUID),
  public.w173_begin_interest_provider_attempt(UUID,UUID,TEXT,JSONB),
  public.w173_complete_interest_delivery(UUID,UUID,TEXT,TEXT) TO service_role;
