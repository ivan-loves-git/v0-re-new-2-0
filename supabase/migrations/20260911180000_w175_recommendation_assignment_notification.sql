-- Build candidate: Decision #123, Ticket #118. No backfill, invitation,
-- portal access, scheduler, provider call, or response-window write.
-- One immutable intent per newly inserted Proposed REAL match. Delivery state
-- remains in the existing notification_delivery_claims and email_logs.
CREATE OR REPLACE FUNCTION public.w175_safe_assignment_teaser(p_teaser TEXT,p_internal TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
  SELECT CASE WHEN NULLIF(BTRIM(p_teaser),'') IS NULL THEN NULL
    WHEN NULLIF(BTRIM(p_internal),'') IS NOT NULL
      AND regexp_replace(lower(normalize(p_teaser,NFKC)),'[^[:alnum:]]','','g')
        = regexp_replace(lower(normalize(p_internal,NFKC)),'[^[:alnum:]]','','g') THEN NULL
    ELSE BTRIM(p_teaser) END
$$;

CREATE TABLE IF NOT EXISTS public.opportunity_recommendation_assignment_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL UNIQUE REFERENCES public.opportunity_matches(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  recipient_email TEXT NOT NULL,
  recipient_first_name TEXT NOT NULL,
  public_title TEXT NOT NULL,
  teaser_summary TEXT,
  email_subject TEXT NOT NULL DEFAULT 'Une opportunité sélectionnée pour vous',
  copy_version INTEGER NOT NULL DEFAULT 1 CHECK(copy_version=1)
);
ALTER TABLE public.opportunity_recommendation_assignment_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_recommendation_assignment_notifications FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.opportunity_recommendation_assignment_notifications FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.opportunity_recommendation_assignment_notifications TO service_role;

CREATE OR REPLACE FUNCTION public.w175_record_assignment_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_email TEXT; v_first_name TEXT; v_title TEXT; v_teaser TEXT;
BEGIN
  IF NEW.status <> 'proposed' THEN RETURN NEW; END IF;
  IF (SELECT count(*) FROM public.app_user_roles WHERE role='staff' AND user_id=NEW.created_by) <> 1 THEN
    RAISE EXCEPTION 'recommendation_assignment_staff_required';
  END IF;
  SELECT lower(BTRIM(r.email)), COALESCE(NULLIF(BTRIM(r.first_name),''),'Bonjour'),
    COALESCE(NULLIF(BTRIM(o.public_title),''),'Confidential acquisition opportunity'),
    public.w175_safe_assignment_teaser(o.teaser_summary,o.description)
  INTO v_email,v_first_name,v_title,v_teaser
  FROM public.opportunities o JOIN public.repreneurs r ON r.id=NEW.repreneur_id
  WHERE o.id=NEW.opportunity_id AND o.status='active' AND o.is_demo=false AND r.is_demo=false;
  IF NOT FOUND THEN RETURN NEW; END IF; -- DEMO never requests external delivery.
  IF v_email IS NULL OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'recommendation_assignment_valid_email_required';
  END IF;
  INSERT INTO public.opportunity_recommendation_assignment_notifications
    (match_id,created_by,recipient_email,recipient_first_name,public_title,teaser_summary)
  VALUES(NEW.id,NEW.created_by,v_email,v_first_name,v_title,v_teaser);
  RETURN NEW;
END $$;
CREATE TRIGGER w175_record_assignment_notification AFTER INSERT ON public.opportunity_matches
  FOR EACH ROW EXECUTE FUNCTION public.w175_record_assignment_notification();

CREATE OR REPLACE FUNCTION public.w175_assignment_notification_immutable()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN RAISE EXCEPTION 'recommendation_assignment_snapshot_immutable'; END $$;
CREATE TRIGGER w175_assignment_notification_immutable
  BEFORE UPDATE ON public.opportunity_recommendation_assignment_notifications
  FOR EACH ROW EXECUTE FUNCTION public.w175_assignment_notification_immutable();

-- Staff-only server calls receive only the frozen allowlisted payload.
-- Mutable recipient/content/eligibility is rechecked immediately before send.
CREATE OR REPLACE FUNCTION public.get_recommendation_assignment_notification(p_match_id UUID,p_actor TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_payload JSONB;
BEGIN
  IF (SELECT count(*) FROM public.app_user_roles WHERE role='staff' AND user_id=p_actor) <> 1 THEN
    RAISE EXCEPTION 'recommendation_assignment_staff_required';
  END IF;
  SELECT jsonb_build_object('id',n.id,'repreneur_id',m.repreneur_id,'recipient_email',n.recipient_email,
    'recipient_first_name',n.recipient_first_name,'public_title',n.public_title,
    'teaser_summary',n.teaser_summary,'email_subject',n.email_subject,'copy_version',n.copy_version)
  INTO v_payload
  FROM public.opportunity_recommendation_assignment_notifications n
  JOIN public.opportunity_matches m ON m.id=n.match_id
  JOIN public.opportunities o ON o.id=m.opportunity_id
  JOIN public.repreneurs r ON r.id=m.repreneur_id
  WHERE n.match_id=p_match_id AND m.status='proposed' AND o.status='active'
    AND o.is_demo=false AND r.is_demo=false
    AND lower(BTRIM(r.email))=n.recipient_email
    AND COALESCE(NULLIF(BTRIM(o.public_title),''),'Confidential acquisition opportunity')=n.public_title
    AND public.w175_safe_assignment_teaser(o.teaser_summary,o.description) IS NOT DISTINCT FROM n.teaser_summary
    AND NOT EXISTS(SELECT 1 FROM public.opportunity_matches active
      WHERE active.opportunity_id=o.id AND active.status='active_pursuit');
  RETURN v_payload;
END $$;

-- Content-free staff readback distinguishes a retryable failure from current
-- disclosure blocks, uncertain old attempts and terminal delivery problems.
CREATE OR REPLACE FUNCTION public.list_recommendation_assignment_notification_states(p_match_ids UUID[],p_actor TEXT)
RETURNS TABLE(match_id UUID, status TEXT)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
  IF cardinality(p_match_ids)>100 OR (SELECT count(*) FROM public.app_user_roles WHERE role='staff' AND user_id=p_actor) <> 1 THEN
    RAISE EXCEPTION 'recommendation_assignment_staff_required';
  END IF;
  RETURN QUERY SELECT n.match_id, CASE
    WHEN l.status IN ('bounced','complained') THEN 'delivery_issue'
    WHEN l.status IN ('sent','delivered','opened','clicked') OR c.status='sent' THEN 'sent'
    WHEN l.provider_outcome IN ('attempting','uncertain') AND l.provider_attempted_at < clock_timestamp()-interval '23 hours' THEN 'review_required'
    WHEN public.get_recommendation_assignment_notification(n.match_id,p_actor) IS NULL
      OR NOT EXISTS(SELECT 1 FROM public.email_templates t WHERE t.template_key='opportunity_recommendation_assignment'
        AND t.is_active=true AND (t.requires_consent=false OR r.marketing_consent=true))
      OR public.ma_contact_email_address_is_suppressed(r.email) THEN 'blocked'
    WHEN c.status='failed' THEN 'failed'
    ELSE 'pending' END
  FROM public.opportunity_recommendation_assignment_notifications n
  JOIN public.opportunity_matches m ON m.id=n.match_id
  JOIN public.repreneurs r ON r.id=m.repreneur_id
  LEFT JOIN public.notification_delivery_claims c ON c.idempotency_key='recommendation-assignment:'||n.id::TEXT
  LEFT JOIN public.email_logs l ON l.idempotency_key='recommendation-assignment:'||n.id::TEXT
  WHERE n.match_id=ANY(p_match_ids);
END $$;

REVOKE ALL ON FUNCTION public.w175_safe_assignment_teaser(TEXT,TEXT),
  public.w175_record_assignment_notification(),public.w175_assignment_notification_immutable(),
  public.get_recommendation_assignment_notification(UUID,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.list_recommendation_assignment_notification_states(UUID[],TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.w175_safe_assignment_teaser(TEXT,TEXT),
  public.get_recommendation_assignment_notification(UUID,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_recommendation_assignment_notification_states(UUID[],TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.w175_record_assignment_notification(),
  public.w175_assignment_notification_immutable() FROM service_role;

INSERT INTO public.email_templates(template_key,subject,description,is_active,requires_consent,body_editable)
VALUES('opportunity_recommendation_assignment','Une opportunité sélectionnée pour vous',
  'Versioned staff-assignment notification. Public title and approved teaser only; no portal access. Generic manual sends are unavailable.',
  true,false,false)
ON CONFLICT(template_key) DO NOTHING;
