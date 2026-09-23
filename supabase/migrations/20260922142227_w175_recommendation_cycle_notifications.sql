-- Ticket #175 / Decision #161: forward-only W172 recommendation cycles.
-- No historical scan, clock inference, invitation, activation, or send.

CREATE TABLE public.opportunity_recommendation_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.opportunity_matches(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL,
  repreneur_id UUID NOT NULL,
  source_kind TEXT NOT NULL CHECK(source_kind IN ('publication','renewal')),
  actor TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT opportunity_recommendation_cycle_72h CHECK(expires_at=started_at+INTERVAL '72 hours'),
  CONSTRAINT opportunity_recommendation_cycle_once UNIQUE(match_id,expires_at)
);
CREATE INDEX opportunity_recommendation_cycles_match_current
  ON public.opportunity_recommendation_cycles(match_id,created_at DESC);
ALTER TABLE public.opportunity_recommendation_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_recommendation_cycles FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.opportunity_recommendation_cycles FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.opportunity_recommendation_cycles TO service_role;

CREATE TABLE public.opportunity_recommendation_cycle_deliveries (
  cycle_id UUID NOT NULL REFERENCES public.opportunity_recommendation_cycles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('client_reminder','staff_expiry')),
  due_at TIMESTAMPTZ NOT NULL,
  template_key TEXT NOT NULL,
  template_updated_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK(status IN ('pending','failed','sent','suppressed','review_required')),
  lease_token UUID,
  lease_expires_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count>=0),
  payload_sha256 TEXT CHECK(payload_sha256 IS NULL OR payload_sha256 ~ '^[a-f0-9]{64}$'),
  provider_attempted_at TIMESTAMPTZ,
  provider_outcome TEXT CHECK(provider_outcome IS NULL OR provider_outcome IN ('attempting','uncertain','rejected','accepted','blocked','deferred')),
  provider_inflight BOOLEAN NOT NULL DEFAULT false,
  provider_message_id TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(cycle_id,kind)
);
CREATE INDEX opportunity_recommendation_cycle_deliveries_due
  ON public.opportunity_recommendation_cycle_deliveries(due_at,updated_at,cycle_id,kind)
  WHERE status IN ('pending','failed');
ALTER TABLE public.opportunity_recommendation_cycle_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_recommendation_cycle_deliveries FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.opportunity_recommendation_cycle_deliveries FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.opportunity_recommendation_cycle_deliveries TO service_role;

INSERT INTO public.email_templates(template_key,subject,description,is_active,requires_consent,body_markdown,body_editable)
VALUES
  ('recommendation_response_reminder','Votre recommandation — {opportunityTitle}',
    'One reminder in the exact open 72-hour recommendation cycle after 48 elapsed hours.',
    false,false,
    E'Bonjour {firstName},\n\nVous pouvez encore consulter la recommandation {opportunityTitle} et nous indiquer votre intérêt avant la fin de sa période de réponse.\n\nL’équipe Re-New',
    true),
  ('recommendation_unanswered_staff_alert','Recommandation sans réponse — {opportunityTitle}',
    'One configured-staff alert after the exact unanswered 72-hour cycle expires.',
    false,false,
    E'La recommandation {opportunityTitle} proposée à {repreneurName} a atteint sa fin de réponse sans intérêt enregistré. Vérifiez la suite appropriée dans Re-New.',
    true)
ON CONFLICT(template_key) DO NOTHING;

-- This guard sorts before w172_set_recommendation_window. Thus legitimate
-- W172 BEFORE-trigger publication arrives without caller-supplied clocks,
-- while raw prefilled INSERTs and raw clock UPDATEs cannot mint a cycle.
CREATE FUNCTION public.w171_guard_recommendation_clock_source()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.recommendation_published_at IS NOT NULL OR NEW.recommendation_expires_at IS NOT NULL
      OR NEW.recommendation_renewed_at IS NOT NULL OR NEW.recommendation_renewed_by IS NOT NULL THEN
      RAISE EXCEPTION 'recommendation_clock_canonical_source_required' USING ERRCODE='P0001';
    END IF;
    IF NEW.status='proposed' THEN
      -- Publication of a fresh match has no existing match row to lock. Hold
      -- the linked portal-role row through commit so a concurrent role delete
      -- cannot finish its cancellation scan before this cycle is inserted.
      PERFORM 1 FROM public.app_user_roles
        WHERE role='repreneur' AND repreneur_id=NEW.repreneur_id
          AND user_id IS NOT NULL LIMIT 1 FOR SHARE;
    END IF;
  ELSE
    IF NEW.repreneur_id IS DISTINCT FROM OLD.repreneur_id
      AND OLD.status IS DISTINCT FROM 'proposed' AND NEW.status='proposed'
      AND NEW.recommendation_published_at IS NULL THEN
      -- A same-statement pair reassignment and first publication is not yet
      -- visible to the new repreneur's role-loss cancellation scan. Serialize
      -- this narrow transition with deletion of that target portal role.
      PERFORM 1 FROM public.app_user_roles
        WHERE role='repreneur' AND repreneur_id=NEW.repreneur_id
          AND user_id IS NOT NULL LIMIT 1 FOR SHARE;
    END IF;
    IF NEW.recommendation_published_at IS DISTINCT FROM OLD.recommendation_published_at
      OR NEW.recommendation_expires_at IS DISTINCT FROM OLD.recommendation_expires_at
      OR NEW.recommendation_renewed_at IS DISTINCT FROM OLD.recommendation_renewed_at
      OR NEW.recommendation_renewed_by IS DISTINCT FROM OLD.recommendation_renewed_by THEN
      IF current_setting('w175.renewal_match_id',true) IS DISTINCT FROM NEW.id::TEXT THEN
        RAISE EXCEPTION 'recommendation_clock_canonical_source_required' USING ERRCODE='P0001';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER w171_guard_recommendation_clock_source
  BEFORE INSERT OR UPDATE ON public.opportunity_matches
  FOR EACH ROW EXECUTE FUNCTION public.w171_guard_recommendation_clock_source();

-- Preserve the W172 contract/signature and idempotent open-window return.
-- The match-bound transaction-local source is cleared immediately after the
-- canonical UPDATE, so a later raw write in the same transaction cannot reuse it.
CREATE OR REPLACE FUNCTION public.renew_opportunity_recommendation(
  p_match_id UUID,p_actor TEXT
) RETURNS TABLE(match_id UUID,publication_at TIMESTAMPTZ,expires_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE; v_now TIMESTAMPTZ;
BEGIN
  IF NULLIF(BTRIM(p_actor),'') IS NULL
    OR (SELECT count(*) FROM public.app_user_roles
        WHERE role='staff' AND (user_id=p_actor OR email=p_actor))<>1 THEN
    RAISE EXCEPTION 'recommendation_renewal_staff_required';
  END IF;
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE;
  IF NOT FOUND OR v_match.status<>'proposed' THEN
    RAISE EXCEPTION 'recommendation_renewal_not_available' USING ERRCODE='P0001';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.app_user_roles WHERE role='repreneur'
      AND repreneur_id=v_match.repreneur_id AND user_id IS NOT NULL)
    OR NOT EXISTS(SELECT 1 FROM public.opportunities o JOIN public.repreneurs r
      ON r.id=v_match.repreneur_id AND r.is_demo=o.is_demo
      WHERE o.id=v_match.opportunity_id AND o.status='active') THEN
    RAISE EXCEPTION 'recommendation_renewal_visible_portal_required';
  END IF;
  v_now:=clock_timestamp();
  IF v_match.recommendation_expires_at IS NOT NULL
    AND v_match.recommendation_expires_at>v_now THEN
    RETURN QUERY SELECT v_match.id,v_match.recommendation_published_at,v_match.recommendation_expires_at;
    RETURN;
  END IF;
  PERFORM set_config('w175.renewal_match_id',v_match.id::TEXT,true);
  UPDATE public.opportunity_matches
    SET recommendation_published_at=COALESCE(recommendation_published_at,v_now),
      recommendation_expires_at=v_now+INTERVAL '72 hours',
      recommendation_renewed_at=v_now,recommendation_renewed_by=BTRIM(p_actor)
    WHERE id=v_match.id;
  PERFORM set_config('w175.renewal_match_id','',true);
  RETURN QUERY SELECT v_match.id,COALESCE(v_match.recommendation_published_at,v_now),
    v_now+INTERVAL '72 hours';
END $$;

CREATE FUNCTION public.w175_cycle_immutable()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN RAISE EXCEPTION 'recommendation_cycle_immutable'; END $$;
CREATE TRIGGER w175_cycle_immutable BEFORE UPDATE ON public.opportunity_recommendation_cycles
  FOR EACH ROW EXECUTE FUNCTION public.w175_cycle_immutable();

-- Cancel unstarted work when an open cycle is answered, removed from Proposed,
-- superseded, or loses its portal eligibility. An in-flight attempt keeps its
-- lease so completion can record an accepted send; uncertainty requires review.
CREATE FUNCTION public.w175_cancel_recommendation_cycle(p_match_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  UPDATE public.opportunity_recommendation_cycle_deliveries d
    SET status=CASE WHEN d.provider_inflight OR d.provider_outcome IN ('attempting','uncertain')
      THEN 'review_required' ELSE 'suppressed' END,
      lease_token=CASE WHEN d.provider_inflight THEN d.lease_token ELSE NULL END,
      lease_expires_at=CASE WHEN d.provider_inflight THEN d.lease_expires_at ELSE NULL END,
      updated_at=clock_timestamp()
    FROM public.opportunity_recommendation_cycles c
    WHERE c.id=d.cycle_id AND c.match_id=p_match_id AND d.status IN ('pending','failed');
END $$;

CREATE FUNCTION public.w175_capture_recommendation_cycle()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_started TIMESTAMPTZ; v_source TEXT; v_actor TEXT;
  v_cycle UUID; v_real BOOLEAN; v_client public.email_templates%ROWTYPE;
  v_staff public.email_templates%ROWTYPE;
BEGIN
  IF TG_OP='UPDATE' AND OLD.status='proposed' AND NEW.status IS DISTINCT FROM 'proposed' THEN
    PERFORM public.w175_cancel_recommendation_cycle(NEW.id);
  END IF;
  IF TG_OP='UPDATE' AND (NEW.opportunity_id IS DISTINCT FROM OLD.opportunity_id
    OR NEW.repreneur_id IS DISTINCT FROM OLD.repreneur_id) THEN
    PERFORM public.w175_cancel_recommendation_cycle(NEW.id);
  END IF;
  IF NEW.status<>'proposed' OR NEW.recommendation_expires_at IS NULL THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND NEW.recommendation_renewed_at IS DISTINCT FROM OLD.recommendation_renewed_at THEN
    IF current_setting('w175.renewal_match_id',true) IS DISTINCT FROM NEW.id::TEXT
      OR NEW.recommendation_expires_at IS NOT DISTINCT FROM OLD.recommendation_expires_at THEN
      RETURN NEW;
    END IF;
    v_source:='renewal'; v_started:=NEW.recommendation_renewed_at; v_actor:=NEW.recommendation_renewed_by;
  ELSIF (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'proposed')
    AND NEW.recommendation_published_at IS NOT NULL
    AND (TG_OP='INSERT' OR OLD.recommendation_published_at IS NULL)
    AND NEW.recommendation_renewed_at IS NULL THEN
    v_source:='publication'; v_started:=NEW.recommendation_published_at; v_actor:=NEW.created_by;
  ELSE
    RETURN NEW;
  END IF;
  IF v_started IS NULL OR v_actor IS NULL
    OR NEW.recommendation_expires_at IS DISTINCT FROM v_started+INTERVAL '72 hours'
    OR (SELECT count(*) FROM public.app_user_roles
        WHERE role='staff' AND (user_id=v_actor OR email=v_actor))<>1 THEN
    RAISE EXCEPTION 'recommendation_cycle_source_invalid' USING ERRCODE='P0001';
  END IF;
  SELECT o.is_demo=false AND r.is_demo=false INTO v_real
    FROM public.opportunities o JOIN public.repreneurs r ON r.id=NEW.repreneur_id
    WHERE o.id=NEW.opportunity_id AND o.status='active'
      AND o.is_demo=r.is_demo
    FOR SHARE OF o;
  IF v_real IS NULL THEN
    RAISE EXCEPTION 'recommendation_cycle_portal_source_invalid' USING ERRCODE='P0001';
  END IF;
  SELECT * INTO v_client FROM public.email_templates
    WHERE template_key='recommendation_response_reminder';
  SELECT * INTO v_staff FROM public.email_templates
    WHERE template_key='recommendation_unanswered_staff_alert';
  INSERT INTO public.opportunity_recommendation_cycles
    (match_id,opportunity_id,repreneur_id,source_kind,actor,started_at,expires_at)
  VALUES(NEW.id,NEW.opportunity_id,NEW.repreneur_id,v_source,v_actor,v_started,NEW.recommendation_expires_at)
  RETURNING id INTO v_cycle;
  PERFORM public.w175_cancel_recommendation_cycle(NEW.id);
  INSERT INTO public.opportunity_recommendation_cycle_deliveries
    (cycle_id,kind,due_at,template_key,template_updated_at,status)
  VALUES
    (v_cycle,'client_reminder',v_started+INTERVAL '48 hours',
      'recommendation_response_reminder',v_client.updated_at,
      CASE WHEN v_real AND v_client.is_active IS TRUE THEN 'pending' ELSE 'suppressed' END),
    (v_cycle,'staff_expiry',NEW.recommendation_expires_at,
      'recommendation_unanswered_staff_alert',v_staff.updated_at,
      CASE WHEN v_real AND v_staff.is_active IS TRUE THEN 'pending' ELSE 'suppressed' END);
  RETURN NEW;
END $$;
CREATE TRIGGER w175_capture_recommendation_cycle
  AFTER INSERT OR UPDATE ON public.opportunity_matches
  FOR EACH ROW EXECUTE FUNCTION public.w175_capture_recommendation_cycle();

CREATE FUNCTION public.w175_cancel_cycles_on_role_loss()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_match UUID;
BEGIN
  IF OLD.role<>'repreneur' OR OLD.repreneur_id IS NULL THEN RETURN OLD; END IF;
  IF EXISTS(SELECT 1 FROM public.app_user_roles
    WHERE role='repreneur' AND repreneur_id=OLD.repreneur_id AND user_id IS NOT NULL) THEN RETURN OLD; END IF;
  FOR v_match IN SELECT id FROM public.opportunity_matches
    WHERE repreneur_id=OLD.repreneur_id ORDER BY id FOR UPDATE LOOP
    PERFORM public.w175_cancel_recommendation_cycle(v_match);
  END LOOP;
  RETURN OLD;
END $$;
CREATE TRIGGER w175_cancel_cycles_on_role_loss
  AFTER DELETE OR UPDATE OF role,repreneur_id,user_id ON public.app_user_roles
  FOR EACH ROW EXECUTE FUNCTION public.w175_cancel_cycles_on_role_loss();

CREATE FUNCTION public.w175_cancel_cycles_on_opportunity_loss()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_match UUID;
BEGIN
  IF OLD.status='active' AND NEW.status<>'active' THEN
    -- The opportunity row is already locked by its UPDATE. Do not take a
    -- match lock here: response RPCs lock match then opportunity. Delivery
    -- row locks serialize cancellation with begin without that inversion.
    FOR v_match IN SELECT id FROM public.opportunity_matches
      WHERE opportunity_id=NEW.id ORDER BY id LOOP
      PERFORM public.w175_cancel_recommendation_cycle(v_match);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER w175_cancel_cycles_on_opportunity_loss
  AFTER UPDATE OF status ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.w175_cancel_cycles_on_opportunity_loss();

-- A normal unused/settled recommendation remains removable with its cycle
-- rows by cascade. Never erase a begun request with unresolved provider truth.
CREATE FUNCTION public.w175_guard_match_delete_during_delivery()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.opportunity_recommendation_cycles c
    JOIN public.opportunity_recommendation_cycle_deliveries d ON d.cycle_id=c.id
    WHERE c.match_id=OLD.id AND d.provider_inflight
      AND d.provider_outcome='attempting' AND d.lease_expires_at>clock_timestamp()) THEN
    RAISE EXCEPTION 'recommendation_cycle_delivery_in_flight' USING ERRCODE='P0001';
  END IF;
  IF EXISTS(SELECT 1 FROM public.opportunity_recommendation_cycles c
    JOIN public.opportunity_recommendation_cycle_deliveries d ON d.cycle_id=c.id
    WHERE c.match_id=OLD.id AND (d.provider_inflight OR d.provider_outcome IN ('attempting','uncertain')
      OR (d.status='review_required' AND d.provider_attempted_at IS NOT NULL))) THEN
    RAISE EXCEPTION 'recommendation_cycle_delivery_review_required' USING ERRCODE='P0001';
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER w175_guard_match_delete_during_delivery
  BEFORE DELETE ON public.opportunity_matches
  FOR EACH ROW EXECUTE FUNCTION public.w175_guard_match_delete_during_delivery();

-- Eligibility is event-specific. The client's mailbox/consent do not gate a
-- configured-staff expiry alert; actual portal entitlement gates both.
CREATE FUNCTION public.w175_cycle_window_open(
  p_kind TEXT,p_started_at TIMESTAMPTZ,p_expires_at TIMESTAMPTZ,p_at TIMESTAMPTZ
) RETURNS BOOLEAN LANGUAGE sql IMMUTABLE STRICT SET search_path=public,pg_temp AS $$
  SELECT CASE p_kind
    WHEN 'client_reminder' THEN p_at>=p_started_at+INTERVAL '48 hours' AND p_at<p_expires_at
    WHEN 'staff_expiry' THEN p_at>=p_expires_at
    ELSE false END
$$;

CREATE FUNCTION public.w175_cycle_delivery_payload(p_cycle_id UUID,p_kind TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_payload JSONB; v_now TIMESTAMPTZ:=clock_timestamp();
BEGIN
  IF p_kind NOT IN ('client_reminder','staff_expiry') THEN RETURN NULL; END IF;
  SELECT jsonb_build_object('cycleId',c.id,'kind',d.kind,'matchId',m.id,
    'repreneurId',r.id,
    'recipientEmail',CASE WHEN d.kind='client_reminder'
      THEN public.w175_assignment_recipient_email(r.email) ELSE '' END,
    'firstName',COALESCE(NULLIF(BTRIM(r.first_name),''),'Bonjour'),
    'repreneurName',COALESCE(NULLIF(BTRIM(r.first_name||' '||r.last_name),''),'le repreneur'),
    'opportunityTitle',COALESCE(NULLIF(BTRIM(o.public_title),''),'cette opportunité'),
    'templateKey',d.template_key,'subject',t.subject,'body',t.body_markdown)
  INTO v_payload
  FROM public.opportunity_recommendation_cycles c
    JOIN public.opportunity_recommendation_cycle_deliveries d ON d.cycle_id=c.id
    JOIN public.opportunity_matches m ON m.id=c.match_id
    JOIN public.opportunities o ON o.id=m.opportunity_id
    JOIN public.repreneurs r ON r.id=m.repreneur_id
    JOIN public.email_templates t ON t.template_key=d.template_key
  WHERE c.id=p_cycle_id AND d.kind=p_kind AND d.status IN ('pending','failed')
    AND d.due_at<=v_now
    AND d.template_key=CASE WHEN d.kind='client_reminder'
      THEN 'recommendation_response_reminder' ELSE 'recommendation_unanswered_staff_alert' END
    AND (d.payload_sha256 IS NULL OR d.template_updated_at=t.updated_at)
    AND t.is_active IS TRUE
    AND m.status='proposed' AND m.recommendation_expires_at=c.expires_at
    AND m.opportunity_id=c.opportunity_id AND m.repreneur_id=c.repreneur_id
    AND (CASE WHEN c.source_kind='renewal' THEN m.recommendation_renewed_at
      ELSE m.recommendation_published_at END)=c.started_at
    AND c.id=(SELECT newer.id FROM public.opportunity_recommendation_cycles newer
      WHERE newer.match_id=m.id ORDER BY newer.created_at DESC,newer.id DESC LIMIT 1)
    AND o.status='active' AND o.is_demo=false AND r.is_demo=false
    AND public.w164_match_has_same_namespace(m.id)
    AND EXISTS(SELECT 1 FROM public.app_user_roles role_row
      WHERE role_row.role='repreneur' AND role_row.repreneur_id=r.id
        AND role_row.user_id IS NOT NULL)
    AND public.w175_cycle_window_open(d.kind,c.started_at,c.expires_at,v_now)
    AND (CASE WHEN d.kind='client_reminder' THEN
      public.w175_assignment_recipient_email(r.email) IS NOT NULL
      AND NOT public.ma_contact_email_address_is_suppressed(r.email)
      AND (t.requires_consent IS FALSE OR r.marketing_consent IS TRUE)
      ELSE t.requires_consent IS FALSE END);
  RETURN v_payload;
END $$;

CREATE FUNCTION public.w175_claim_cycle_delivery(p_cycle_id UUID,p_kind TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_match UUID; v_delivery public.opportunity_recommendation_cycle_deliveries%ROWTYPE;
  v_now TIMESTAMPTZ:=clock_timestamp(); v_token UUID:=gen_random_uuid(); v_status TEXT;
BEGIN
  SELECT match_id INTO v_match FROM public.opportunity_recommendation_cycles WHERE id=p_cycle_id;
  IF v_match IS NULL OR p_kind NOT IN ('client_reminder','staff_expiry') THEN
    RETURN jsonb_build_object('status','missing');
  END IF;
  PERFORM 1 FROM public.opportunity_matches WHERE id=v_match FOR UPDATE;
  SELECT * INTO v_delivery FROM public.opportunity_recommendation_cycle_deliveries
    WHERE cycle_id=p_cycle_id AND kind=p_kind FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','missing'); END IF;
  v_now:=clock_timestamp();
  IF v_delivery.status IN ('sent','suppressed','review_required') THEN
    RETURN jsonb_build_object('status',v_delivery.status);
  END IF;
  IF v_delivery.due_at>v_now THEN RETURN jsonb_build_object('status','not_due'); END IF;
  IF v_delivery.lease_expires_at>v_now THEN RETURN jsonb_build_object('status','busy'); END IF;
  IF v_delivery.provider_outcome IN ('attempting','uncertain')
    AND (v_delivery.provider_attempted_at IS NULL
      OR v_delivery.provider_attempted_at<=v_now-INTERVAL '23 hours') THEN
    UPDATE public.opportunity_recommendation_cycle_deliveries
      SET status='review_required',lease_token=NULL,lease_expires_at=NULL,
        provider_inflight=false,updated_at=v_now
      WHERE cycle_id=p_cycle_id AND kind=p_kind;
    RETURN jsonb_build_object('status','review_required');
  END IF;
  IF v_delivery.provider_outcome='attempting' THEN
    UPDATE public.opportunity_recommendation_cycle_deliveries
      SET provider_outcome='uncertain',provider_inflight=false,updated_at=v_now
      WHERE cycle_id=p_cycle_id AND kind=p_kind;
    v_delivery.provider_outcome:='uncertain';
  END IF;
  IF public.w175_cycle_delivery_payload(p_cycle_id,p_kind) IS NULL THEN
    v_status:=CASE WHEN v_delivery.provider_outcome IN ('attempting','uncertain')
      OR v_delivery.payload_sha256 IS NOT NULL THEN 'review_required' ELSE 'suppressed' END;
    UPDATE public.opportunity_recommendation_cycle_deliveries
      SET status=v_status,lease_token=NULL,lease_expires_at=NULL,
        provider_inflight=false,updated_at=v_now
      WHERE cycle_id=p_cycle_id AND kind=p_kind;
    RETURN jsonb_build_object('status',v_status);
  END IF;
  UPDATE public.opportunity_recommendation_cycle_deliveries
    SET status='pending',lease_token=v_token,lease_expires_at=v_now+INTERVAL '5 minutes',
      provider_inflight=false,attempt_count=attempt_count+1,updated_at=v_now
    WHERE cycle_id=p_cycle_id AND kind=p_kind;
  RETURN jsonb_build_object('status','claimed','leaseToken',v_token::TEXT);
END $$;

CREATE FUNCTION public.w175_begin_cycle_provider_attempt(
  p_cycle_id UUID,p_kind TEXT,p_lease_token UUID,p_payload_sha256 TEXT,p_expected_payload JSONB
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_match UUID; v_delivery public.opportunity_recommendation_cycle_deliveries%ROWTYPE;
  v_now TIMESTAMPTZ:=clock_timestamp(); v_current_payload JSONB;
BEGIN
  IF p_lease_token IS NULL OR p_expected_payload IS NULL
    OR p_payload_sha256 IS NULL OR p_payload_sha256 !~ '^[a-f0-9]{64}$' THEN RETURN false; END IF;
  SELECT match_id INTO v_match FROM public.opportunity_recommendation_cycles WHERE id=p_cycle_id;
  IF v_match IS NULL THEN RETURN false; END IF;
  PERFORM 1 FROM public.opportunity_matches WHERE id=v_match FOR UPDATE;
  SELECT * INTO v_delivery FROM public.opportunity_recommendation_cycle_deliveries
    WHERE cycle_id=p_cycle_id AND kind=p_kind FOR UPDATE;
  v_now:=clock_timestamp();
  IF v_delivery.status<>'pending' OR v_delivery.lease_token IS DISTINCT FROM p_lease_token
    OR v_delivery.lease_expires_at IS NULL OR v_delivery.lease_expires_at<=v_now THEN RETURN false; END IF;
  IF v_delivery.payload_sha256 IS NOT NULL AND v_delivery.payload_sha256<>p_payload_sha256 THEN
    UPDATE public.opportunity_recommendation_cycle_deliveries
      SET status='review_required',lease_token=NULL,lease_expires_at=NULL,updated_at=v_now
      WHERE cycle_id=p_cycle_id AND kind=p_kind;
    RETURN false;
  END IF;
  v_current_payload:=public.w175_cycle_delivery_payload(p_cycle_id,p_kind);
  IF v_current_payload IS DISTINCT FROM p_expected_payload THEN
    UPDATE public.opportunity_recommendation_cycle_deliveries
      SET status=CASE WHEN v_current_payload IS NOT NULL
        OR v_delivery.provider_outcome IN ('attempting','uncertain')
        OR v_delivery.payload_sha256 IS NOT NULL THEN 'review_required' ELSE 'suppressed' END,
        lease_token=NULL,lease_expires_at=NULL,updated_at=v_now
      WHERE cycle_id=p_cycle_id AND kind=p_kind;
    RETURN false;
  END IF;
  IF v_delivery.provider_outcome IN ('attempting','uncertain')
    AND (v_delivery.provider_attempted_at IS NULL
      OR v_delivery.provider_attempted_at<=v_now-INTERVAL '23 hours') THEN
    UPDATE public.opportunity_recommendation_cycle_deliveries
      SET status='review_required',lease_token=NULL,lease_expires_at=NULL,updated_at=v_now
      WHERE cycle_id=p_cycle_id AND kind=p_kind;
    RETURN false;
  END IF;
  UPDATE public.opportunity_recommendation_cycle_deliveries
    SET payload_sha256=COALESCE(payload_sha256,p_payload_sha256),
      template_updated_at=(SELECT updated_at FROM public.email_templates
        WHERE template_key=v_delivery.template_key),
      provider_attempted_at=CASE WHEN provider_outcome IN ('attempting','uncertain')
        THEN provider_attempted_at ELSE v_now END,
      provider_outcome=CASE WHEN provider_outcome IN ('attempting','uncertain')
        THEN 'uncertain' ELSE 'attempting' END,
      provider_inflight=true,updated_at=v_now
    WHERE cycle_id=p_cycle_id AND kind=p_kind;
  RETURN true;
END $$;

CREATE FUNCTION public.w175_complete_cycle_delivery(
  p_cycle_id UUID,p_kind TEXT,p_lease_token UUID,p_outcome TEXT,
  p_provider_message_id TEXT DEFAULT NULL
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_delivery public.opportunity_recommendation_cycle_deliveries%ROWTYPE;
  v_now TIMESTAMPTZ:=clock_timestamp(); v_cancelled_after_begin BOOLEAN;
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('sent','rejected','uncertain','suppressed','deferred')
    THEN RAISE EXCEPTION 'invalid_delivery_outcome'; END IF;
  IF p_lease_token IS NULL THEN RETURN 'stale'; END IF;
  SELECT * INTO v_delivery FROM public.opportunity_recommendation_cycle_deliveries
    WHERE cycle_id=p_cycle_id AND kind=p_kind FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'delivery_missing'; END IF;
  v_now:=clock_timestamp();
  IF v_delivery.status='sent' THEN RETURN 'sent'; END IF;
  v_cancelled_after_begin:=v_delivery.status='review_required'
    AND v_delivery.provider_inflight
    AND v_delivery.lease_token IS NOT DISTINCT FROM p_lease_token;
  IF NOT ((v_delivery.status='pending' OR v_cancelled_after_begin)
    AND v_delivery.lease_token IS NOT DISTINCT FROM p_lease_token) THEN
    RETURN v_delivery.status;
  END IF;
  IF v_cancelled_after_begin THEN
    IF p_outcome='sent' THEN
      UPDATE public.opportunity_recommendation_cycle_deliveries
        SET status='sent',provider_outcome='accepted',provider_message_id=p_provider_message_id,
          sent_at=v_now,provider_inflight=false,lease_token=NULL,lease_expires_at=NULL,updated_at=v_now
        WHERE cycle_id=p_cycle_id AND kind=p_kind;
      RETURN 'sent';
    END IF;
    IF p_outcome IN ('rejected','suppressed','deferred')
      AND v_delivery.provider_outcome IS DISTINCT FROM 'uncertain' THEN
      UPDATE public.opportunity_recommendation_cycle_deliveries
        SET status='suppressed',lease_token=NULL,lease_expires_at=NULL,
          provider_inflight=false,
          provider_outcome=CASE WHEN p_outcome='rejected' THEN 'rejected'
            WHEN p_outcome='deferred' THEN 'deferred' ELSE 'blocked' END,
          provider_attempted_at=CASE WHEN p_outcome IN ('suppressed','deferred')
            THEN NULL ELSE provider_attempted_at END,
          payload_sha256=CASE WHEN p_outcome IN ('suppressed','deferred')
            THEN NULL ELSE payload_sha256 END,
          template_updated_at=CASE WHEN p_outcome IN ('suppressed','deferred')
            THEN NULL ELSE template_updated_at END,updated_at=v_now
        WHERE cycle_id=p_cycle_id AND kind=p_kind;
      RETURN 'suppressed';
    END IF;
    UPDATE public.opportunity_recommendation_cycle_deliveries
      SET lease_token=NULL,lease_expires_at=NULL,provider_inflight=false,
        provider_outcome=CASE WHEN provider_outcome='uncertain' OR p_outcome='uncertain'
          THEN 'uncertain' ELSE provider_outcome END,updated_at=v_now
      WHERE cycle_id=p_cycle_id AND kind=p_kind;
    RETURN 'review_required';
  END IF;
  UPDATE public.opportunity_recommendation_cycle_deliveries SET
    status=CASE WHEN p_outcome='sent' THEN 'sent'
      WHEN p_outcome='suppressed' AND v_delivery.provider_outcome='uncertain'
        THEN 'review_required'
      WHEN p_outcome='suppressed' THEN 'suppressed' ELSE 'failed' END,
    lease_token=NULL,lease_expires_at=NULL,provider_inflight=false,
    provider_outcome=CASE WHEN p_outcome='sent' THEN 'accepted'
      WHEN v_delivery.provider_outcome='uncertain' THEN 'uncertain'
      WHEN p_outcome='rejected' THEN 'rejected' WHEN p_outcome='uncertain' THEN 'uncertain'
      WHEN p_outcome='deferred' THEN 'deferred' ELSE 'blocked' END,
    provider_attempted_at=CASE WHEN p_outcome IN ('suppressed','deferred')
      AND v_delivery.provider_outcome IS DISTINCT FROM 'uncertain'
      THEN NULL ELSE provider_attempted_at END,
    payload_sha256=CASE WHEN p_outcome IN ('suppressed','deferred')
      AND v_delivery.provider_outcome IS DISTINCT FROM 'uncertain'
      THEN NULL ELSE payload_sha256 END,
    template_updated_at=CASE WHEN p_outcome IN ('suppressed','deferred')
      AND v_delivery.provider_outcome IS DISTINCT FROM 'uncertain'
      THEN NULL ELSE template_updated_at END,
    provider_message_id=CASE WHEN p_outcome='sent' THEN p_provider_message_id ELSE provider_message_id END,
    sent_at=CASE WHEN p_outcome='sent' THEN v_now ELSE sent_at END,updated_at=v_now
    WHERE cycle_id=p_cycle_id AND kind=p_kind;
  IF p_outcome='suppressed' AND v_delivery.provider_outcome='uncertain'
    THEN RETURN 'review_required'; END IF;
  RETURN p_outcome;
END $$;

REVOKE ALL ON FUNCTION public.w171_guard_recommendation_clock_source(),
  public.w175_cycle_immutable(),public.w175_cancel_recommendation_cycle(UUID),
  public.w175_capture_recommendation_cycle(),public.w175_cancel_cycles_on_role_loss(),
  public.w175_cancel_cycles_on_opportunity_loss(),
  public.w175_guard_match_delete_during_delivery(),
  public.w175_cycle_window_open(TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TIMESTAMPTZ),
  public.w175_cycle_delivery_payload(UUID,TEXT),public.w175_claim_cycle_delivery(UUID,TEXT),
  public.w175_begin_cycle_provider_attempt(UUID,TEXT,UUID,TEXT,JSONB),
  public.w175_complete_cycle_delivery(UUID,TEXT,UUID,TEXT,TEXT)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.w175_cycle_delivery_payload(UUID,TEXT),
  public.w175_claim_cycle_delivery(UUID,TEXT),
  public.w175_begin_cycle_provider_attempt(UUID,TEXT,UUID,TEXT,JSONB),
  public.w175_complete_cycle_delivery(UUID,TEXT,UUID,TEXT,TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.renew_opportunity_recommendation(UUID,TEXT)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.renew_opportunity_recommendation(UUID,TEXT) TO service_role;
