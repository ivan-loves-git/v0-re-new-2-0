-- #186 / Decision #181: private, parent-owned staff review evidence.
-- This is deliberately additive. No historical send is copied into the queue.
BEGIN;

CREATE TABLE public.staff_email_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_kind text NOT NULL CHECK (source_kind IN ('ma', 'e4', 'e6', 'e7')),
  source_operation_id uuid NOT NULL,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  match_id uuid REFERENCES public.opportunity_matches(id) ON DELETE CASCADE,
  upstream_evidence_id uuid REFERENCES public.opportunity_pursuit_evidence(id) ON DELETE RESTRICT,
  contact_link_id uuid REFERENCES public.opportunity_ma_contacts(id) ON DELETE RESTRICT,
  recipient_email text NOT NULL CHECK (length(btrim(recipient_email)) > 3),
  namespace text NOT NULL CHECK (namespace IN ('REAL', 'DEMO')),
  template_key text NOT NULL,
  template_version text NOT NULL,
  subject text NOT NULL CHECK (length(btrim(subject)) > 0),
  body_text text NOT NULL CHECK (length(btrim(body_text)) > 0),
  attachment_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(attachment_snapshot) = 'array'),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'sending', 'sent', 'failed', 'uncertain', 'cancelled')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_by text,
  edited_at timestamptz,
  approved_by text,
  approved_at timestamptz,
  attempted_payload jsonb,
  attempted_at timestamptz,
  attempt_token uuid,
  outcome_at timestamptz,
  provider_message_id text,
  delivery_evidence_id uuid,
  delivery_error text,
  cancelled_by text,
  cancelled_at timestamptz,
  cancel_reason text,
  CONSTRAINT staff_email_reviews_source_unique UNIQUE (source_kind, source_operation_id),
  CONSTRAINT staff_email_reviews_handoff_binding CHECK (
    (source_kind = 'ma' AND match_id IS NULL AND upstream_evidence_id IS NULL AND contact_link_id IS NOT NULL)
    OR (source_kind = 'e6' AND match_id IS NOT NULL AND upstream_evidence_id = source_operation_id AND contact_link_id IS NULL)
    OR (source_kind IN ('e4', 'e7') AND match_id IS NOT NULL AND upstream_evidence_id = source_operation_id AND contact_link_id IS NOT NULL)
  ),
  CONSTRAINT staff_email_reviews_attempt_binding CHECK ((attempted_payload IS NULL) = (attempted_at IS NULL))
);

CREATE INDEX staff_email_reviews_queue_idx ON public.staff_email_reviews (created_at DESC, id DESC);
CREATE INDEX staff_email_reviews_opportunity_idx ON public.staff_email_reviews (opportunity_id, created_at DESC);
CREATE INDEX staff_email_reviews_match_idx ON public.staff_email_reviews (match_id, created_at DESC) WHERE match_id IS NOT NULL;
CREATE UNIQUE INDEX staff_email_reviews_unresolved_opportunity_idx
  ON public.staff_email_reviews (opportunity_id)
  WHERE state IN ('sending', 'uncertain');

CREATE TABLE public.staff_email_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.staff_email_reviews(id) ON DELETE CASCADE,
  event_kind text NOT NULL CHECK (event_kind IN ('prepared', 'edited', 'approved', 'sending', 'sent', 'failed', 'uncertain', 'cancelled')),
  actor text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX staff_email_review_events_review_idx ON public.staff_email_review_events (review_id, occurred_at, id);

ALTER TABLE public.staff_email_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_email_review_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.staff_email_reviews, public.staff_email_review_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.staff_email_reviews, public.staff_email_review_events TO service_role;

CREATE FUNCTION public.staff_email_review_assert_actor(p_actor text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_staff_roles integer;
BEGIN
  IF nullif(btrim(p_actor), '') IS NULL THEN RAISE EXCEPTION 'staff_email_review_requires_staff_actor'; END IF;
  -- The server passes the current Better Auth user ID, never a caller-supplied
  -- email. Resolve its stored email exactly as requireStaffAccess does; the
  -- service-role-only RPC cannot confer a staff role to an unrelated user.
  SELECT count(*) INTO v_staff_roles
  FROM public."user" account
  JOIN public.app_user_roles role ON role.role = 'staff'
    AND (role.user_id = account.id OR lower(btrim(role.email)) = lower(btrim(account.email)))
  WHERE account.id = p_actor AND nullif(btrim(account.email), '') IS NOT NULL;
  IF v_staff_roles <> 1 THEN RAISE EXCEPTION 'staff_email_review_requires_staff_actor'; END IF;
END $$;

CREATE FUNCTION public.staff_email_review_prepare(
  p_source_kind text, p_source_operation_id uuid, p_opportunity_id uuid,
  p_match_id uuid, p_upstream_evidence_id uuid, p_contact_link_id uuid,
  p_recipient_email text, p_namespace text, p_template_key text,
  p_template_version text, p_subject text, p_body_text text,
  p_attachment_snapshot jsonb, p_actor text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; v_namespace text; v_existing public.staff_email_reviews%ROWTYPE;
BEGIN
  PERFORM public.staff_email_review_assert_actor(p_actor);
  IF p_source_kind NOT IN ('ma','e4','e6','e7') OR p_source_operation_id IS NULL
    OR nullif(btrim(p_recipient_email),'') IS NULL OR nullif(btrim(p_template_key),'') IS NULL
    OR nullif(btrim(p_template_version),'') IS NULL OR nullif(btrim(p_subject),'') IS NULL
    OR nullif(btrim(p_body_text),'') IS NULL OR jsonb_typeof(p_attachment_snapshot) <> 'array'
  THEN RAISE EXCEPTION 'staff_email_review_invalid_preparation'; END IF;
  SELECT CASE WHEN is_demo THEN 'DEMO' ELSE 'REAL' END INTO v_namespace
  FROM public.opportunities WHERE id = p_opportunity_id;
  IF v_namespace IS NULL OR v_namespace <> p_namespace THEN RAISE EXCEPTION 'staff_email_review_namespace_changed'; END IF;
  IF p_source_kind <> 'ma' AND NOT EXISTS (
    SELECT 1 FROM public.opportunity_matches m JOIN public.opportunity_pursuit_evidence e
      ON e.match_id = m.id AND e.id = p_upstream_evidence_id
    WHERE m.id = p_match_id AND m.opportunity_id = p_opportunity_id
      AND p_upstream_evidence_id = p_source_operation_id
  ) THEN RAISE EXCEPTION 'staff_email_review_handoff_source_invalid'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.staff_email_reviews prior
    WHERE prior.opportunity_id=p_opportunity_id AND prior.state IN ('sending','uncertain')
      AND (prior.source_kind IS DISTINCT FROM p_source_kind
        OR prior.source_operation_id IS DISTINCT FROM p_source_operation_id)
  ) THEN RAISE EXCEPTION 'staff_email_review_unresolved_source_blocks_new_draft'; END IF;

  INSERT INTO public.staff_email_reviews (
    source_kind, source_operation_id, opportunity_id, match_id, upstream_evidence_id,
    contact_link_id, recipient_email, namespace, template_key, template_version,
    subject, body_text, attachment_snapshot, created_by
  ) VALUES (
    p_source_kind, p_source_operation_id, p_opportunity_id, p_match_id, p_upstream_evidence_id,
    p_contact_link_id, btrim(p_recipient_email), p_namespace, p_template_key, p_template_version,
    btrim(p_subject), btrim(p_body_text), p_attachment_snapshot, p_actor
  ) ON CONFLICT (source_kind, source_operation_id) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT * INTO v_existing FROM public.staff_email_reviews
    WHERE source_kind = p_source_kind AND source_operation_id = p_source_operation_id;
    IF v_existing.opportunity_id IS DISTINCT FROM p_opportunity_id
      OR v_existing.match_id IS DISTINCT FROM p_match_id
      OR v_existing.upstream_evidence_id IS DISTINCT FROM p_upstream_evidence_id
      OR v_existing.contact_link_id IS DISTINCT FROM p_contact_link_id
      OR v_existing.recipient_email IS DISTINCT FROM btrim(p_recipient_email)
      OR v_existing.namespace IS DISTINCT FROM p_namespace
      OR v_existing.template_key IS DISTINCT FROM p_template_key
    THEN RAISE EXCEPTION 'staff_email_review_source_operation_conflict'; END IF;
    v_id := v_existing.id;
  ELSE
    INSERT INTO public.staff_email_review_events(review_id,event_kind,actor,version)
    VALUES(v_id,'prepared',p_actor,1);
  END IF;
  RETURN v_id;
END $$;

CREATE FUNCTION public.staff_email_review_edit(p_review_id uuid, p_version integer, p_subject text, p_body_text text, p_actor text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.staff_email_reviews%ROWTYPE;
BEGIN
  PERFORM public.staff_email_review_assert_actor(p_actor);
  IF nullif(btrim(p_subject),'') IS NULL OR nullif(btrim(p_body_text),'') IS NULL THEN RAISE EXCEPTION 'staff_email_review_content_required'; END IF;
  SELECT * INTO v FROM public.staff_email_reviews WHERE id=p_review_id FOR UPDATE;
  IF v.id IS NULL OR v.source_kind <> 'ma' OR v.state <> 'pending' OR v.version <> p_version
    OR v.attempted_payload IS NOT NULL THEN RAISE EXCEPTION 'staff_email_review_stale_or_locked'; END IF;
  UPDATE public.staff_email_reviews SET subject=btrim(p_subject), body_text=btrim(p_body_text),
    edited_by=p_actor, edited_at=now(), version=version+1 WHERE id=p_review_id RETURNING version INTO p_version;
  INSERT INTO public.staff_email_review_events(review_id,event_kind,actor,version)
    VALUES(p_review_id,'edited',p_actor,p_version);
  RETURN p_version;
END $$;

CREATE FUNCTION public.staff_email_review_reserve(p_review_id uuid, p_version integer, p_payload jsonb, p_actor text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.staff_email_reviews%ROWTYPE; v_token uuid;
BEGIN
  PERFORM public.staff_email_review_assert_actor(p_actor);
  SELECT * INTO v FROM public.staff_email_reviews WHERE id=p_review_id FOR UPDATE;
  IF v.id IS NULL OR v.version <> p_version OR v.namespace <> 'REAL'
    OR (v.state NOT IN ('pending','sending','uncertain')
      AND NOT (v.state='failed' AND v.source_kind IN ('e4','e6','e7')))
  THEN RAISE EXCEPTION 'staff_email_review_stale_or_not_sendable'; END IF;
  IF v.state = 'sending' AND v.attempted_at > now() - interval '2 minutes' THEN
    RAISE EXCEPTION 'staff_email_review_in_flight'; END IF;
  IF v.attempted_payload IS NOT NULL AND (
    v.attempted_payload IS DISTINCT FROM p_payload OR v.attempted_at <= now() - interval '23 hours'
  ) THEN RAISE EXCEPTION 'staff_email_review_reconciliation_required'; END IF;
  IF EXISTS (SELECT 1 FROM public.staff_email_reviews x WHERE x.opportunity_id=v.opportunity_id
    AND x.id<>v.id AND x.state IN ('sending','uncertain')) THEN
    RAISE EXCEPTION 'staff_email_review_other_uncertain_send'; END IF;
  v_token := gen_random_uuid();
  UPDATE public.staff_email_reviews SET state='sending', approved_by=coalesce(approved_by,p_actor),
    approved_at=coalesce(approved_at,now()), attempted_payload=coalesce(attempted_payload,p_payload),
    attempted_at=coalesce(attempted_at,now()), attempt_token=v_token, version=version+1
  WHERE id=p_review_id RETURNING version INTO p_version;
  INSERT INTO public.staff_email_review_events(review_id,event_kind,actor,version,detail)
    VALUES(p_review_id,'approved',p_actor,p_version,'{}'::jsonb),(p_review_id,'sending',p_actor,p_version,'{}'::jsonb);
  RETURN v_token;
END $$;

CREATE FUNCTION public.staff_email_review_finish(
  p_review_id uuid, p_token uuid, p_state text, p_provider_message_id text,
  p_delivery_evidence_id uuid, p_error text, p_actor text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.staff_email_reviews%ROWTYPE; v_version integer; v_source_status text; v_linked_sent boolean;
BEGIN
  PERFORM public.staff_email_review_assert_actor(p_actor);
  IF p_state NOT IN ('sent','failed','uncertain') THEN RAISE EXCEPTION 'staff_email_review_invalid_outcome'; END IF;
  SELECT * INTO v FROM public.staff_email_reviews WHERE id=p_review_id FOR UPDATE;
  IF v.id IS NULL OR v.state <> 'sending' OR v.attempt_token IS DISTINCT FROM p_token THEN
    RAISE EXCEPTION 'staff_email_review_outcome_not_reserved'; END IF;

  IF v.source_kind = 'ma' THEN
    SELECT interaction.delivery_status INTO v_source_status
    FROM public.ma_interactions interaction
    WHERE interaction.client_operation_key=v.source_operation_id
      AND interaction.opportunity_id=v.opportunity_id
      AND interaction.template_key=v.template_key
      AND interaction.recipient_email_snapshot=v.recipient_email
      AND interaction.channel='email' AND interaction.direction='outbound'
      AND interaction.title=v.subject AND interaction.body_markdown=v.body_text;
    SELECT EXISTS (
      SELECT 1 FROM public.ma_interactions interaction
      WHERE interaction.id=p_delivery_evidence_id
        AND interaction.client_operation_key=v.source_operation_id
        AND interaction.opportunity_id=v.opportunity_id
        AND interaction.template_key=v.template_key
        AND interaction.recipient_email_snapshot=v.recipient_email
        AND interaction.title=v.subject AND interaction.body_markdown=v.body_text
        AND interaction.channel='email' AND interaction.direction='outbound'
        AND interaction.delivery_status='sent'
        AND interaction.provider_message_id=p_provider_message_id
    ) INTO v_linked_sent;
  ELSE
    SELECT delivery.delivery_status INTO v_source_status
    FROM public.opportunity_pursuit_handoff_deliveries delivery
    WHERE delivery.upstream_evidence_id=v.source_operation_id
      AND delivery.match_id=v.match_id AND delivery.handoff_type=v.source_kind;
    SELECT EXISTS (
      SELECT 1 FROM public.opportunity_pursuit_handoff_deliveries delivery
      LEFT JOIN public.ma_interactions interaction ON interaction.id=delivery.ma_interaction_id
      WHERE delivery.upstream_evidence_id=v.source_operation_id
        AND delivery.match_id=v.match_id AND delivery.handoff_type=v.source_kind
        AND delivery.evidence_id=p_delivery_evidence_id
        AND delivery.provider_message_id=p_provider_message_id
        AND delivery.delivery_status='sent'
        AND delivery.attachment_snapshot=v.attachment_snapshot
        AND (
          (v.source_kind='e6' AND delivery.ma_interaction_id IS NULL)
          OR (v.source_kind IN ('e4','e7') AND interaction.id IS NOT NULL
            AND interaction.opportunity_id=v.opportunity_id
            AND interaction.client_operation_key=delivery.operation_key
            AND interaction.provider_request_fingerprint=delivery.request_fingerprint
            AND interaction.channel='email' AND interaction.direction='outbound'
            AND interaction.template_key=v.template_key
            AND interaction.recipient_email_snapshot=v.recipient_email
            AND interaction.title=v.subject AND interaction.body_markdown=v.body_text
            AND interaction.delivery_status='sent'
            AND interaction.provider_message_id=p_provider_message_id)
        )
    ) INTO v_linked_sent;
  END IF;

  IF p_state='sent' AND (
    nullif(btrim(p_provider_message_id),'') IS NULL OR p_delivery_evidence_id IS NULL
    OR v_linked_sent IS DISTINCT FROM true
  ) THEN RAISE EXCEPTION 'staff_email_review_sent_requires_linked_source_receipt'; END IF;
  IF p_state <> 'sent' AND (p_provider_message_id IS NOT NULL OR p_delivery_evidence_id IS NOT NULL) THEN
    RAISE EXCEPTION 'staff_email_review_non_sent_cannot_claim_receipt'; END IF;
  IF p_state='failed' AND (
    v_source_status IN ('pending','sending','sent')
    OR (EXISTS (SELECT 1 FROM public.staff_email_review_events event
          WHERE event.review_id=v.id AND event.event_kind='uncertain')
        AND v_source_status IS DISTINCT FROM 'failed')
  ) THEN RAISE EXCEPTION 'staff_email_review_prior_outcome_not_conclusively_failed'; END IF;
  UPDATE public.staff_email_reviews SET state=p_state, outcome_at=now(),
    provider_message_id=p_provider_message_id, delivery_evidence_id=p_delivery_evidence_id,
    delivery_error=left(p_error,500), attempt_token=NULL, version=version+1
  WHERE id=p_review_id RETURNING version INTO v_version;
  IF v_version IS NULL THEN RAISE EXCEPTION 'staff_email_review_outcome_not_reserved'; END IF;
  INSERT INTO public.staff_email_review_events(review_id,event_kind,actor,version,detail)
    VALUES(p_review_id,p_state,p_actor,v_version,jsonb_build_object('provider_message_id',p_provider_message_id,'delivery_evidence_id',p_delivery_evidence_id,'error',left(p_error,500)));
END $$;

CREATE FUNCTION public.staff_email_review_cancel(p_review_id uuid, p_version integer, p_reason text, p_actor text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_version integer;
BEGIN
  PERFORM public.staff_email_review_assert_actor(p_actor);
  IF nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'staff_email_review_cancel_reason_required'; END IF;
  UPDATE public.staff_email_reviews SET state='cancelled', cancel_reason=btrim(p_reason),
    cancelled_by=p_actor, cancelled_at=now(), version=version+1
  WHERE id=p_review_id AND version=p_version AND state IN ('pending','failed')
    AND (state='pending' AND attempted_payload IS NULL OR state='failed')
  RETURNING version INTO v_version;
  IF v_version IS NULL THEN RAISE EXCEPTION 'staff_email_review_stale_or_not_cancellable'; END IF;
  INSERT INTO public.staff_email_review_events(review_id,event_kind,actor,version,detail)
    VALUES(p_review_id,'cancelled',p_actor,v_version,jsonb_build_object('reason',btrim(p_reason)));
  RETURN v_version;
END $$;

REVOKE ALL ON FUNCTION public.staff_email_review_assert_actor(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.staff_email_review_prepare(text,uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,text,jsonb,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.staff_email_review_edit(uuid,integer,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.staff_email_review_reserve(uuid,integer,jsonb,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.staff_email_review_finish(uuid,uuid,text,text,uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.staff_email_review_cancel(uuid,integer,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_email_review_assert_actor(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.staff_email_review_prepare(text,uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,text,jsonb,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.staff_email_review_edit(uuid,integer,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.staff_email_review_reserve(uuid,integer,jsonb,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.staff_email_review_finish(uuid,uuid,text,text,uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.staff_email_review_cancel(uuid,integer,text,text) TO service_role;
COMMIT;
