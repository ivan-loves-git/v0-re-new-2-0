-- #247: prospective, source-bound pause notices. No historical backfill.
INSERT INTO public.email_templates(template_key,subject,description,is_active,requires_consent,body_markdown,body_editable,auto_send)
VALUES ('opportunity_paused','L’opportunité {opportunityTitle} est en pause',
 'Selected public pause reason for affected repreneurs; staff explanations are never disclosed.',true,false,
 E'Bonjour {firstName},\n\nL’opportunité {opportunityTitle} est temporairement mise en pause.',true,true)
ON CONFLICT(template_key) DO NOTHING;

CREATE TABLE public.opportunity_pause_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 pause_id uuid NOT NULL REFERENCES public.opportunity_pause_history(id) ON DELETE CASCADE,
 match_id uuid NOT NULL REFERENCES public.opportunity_matches(id) ON DELETE CASCADE,
 repreneur_id uuid NOT NULL REFERENCES public.repreneurs(id) ON DELETE CASCADE,
 recipient_email text NOT NULL,
 first_name text NOT NULL,
 public_title text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(pause_id,repreneur_id)
);
CREATE INDEX opportunity_pause_notifications_match ON public.opportunity_pause_notifications(match_id);
CREATE INDEX opportunity_pause_notifications_repreneur ON public.opportunity_pause_notifications(repreneur_id);
ALTER TABLE public.opportunity_pause_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_pause_notifications FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.opportunity_pause_notifications FROM PUBLIC,anon,authenticated,service_role;
COMMENT ON TABLE public.opportunity_pause_notifications IS 'Private prospective pause-recipient snapshots. Never includes staff reason_note. Follows exact parents; no new deletion authority or retention period.';

CREATE FUNCTION public.capture_opportunity_pause_notifications() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.opportunity_pause_notifications(pause_id,match_id,repreneur_id,recipient_email,first_name,public_title)
 SELECT NEW.id,m.id,r.id,btrim(r.email),r.first_name,
   coalesce(nullif(btrim(o.public_title),''),'Votre opportunité de reprise')
 FROM public.opportunities o JOIN public.opportunity_matches m ON m.opportunity_id=o.id
 JOIN public.repreneurs r ON r.id=m.repreneur_id
 WHERE o.id=NEW.opportunity_id AND o.status='paused' AND NOT o.is_demo AND NOT r.is_demo
   AND m.status IN ('interested','active_pursuit')
   AND nullif(btrim(r.email),'') IS NOT NULL
   AND NOT EXISTS(SELECT 1 FROM public.opportunity_interest_events e WHERE e.match_id=m.id
     AND e.event_type='rejected' AND e.interest_expressed_at IS NOT DISTINCT FROM m.interest_expressed_at)
   AND EXISTS(SELECT 1 FROM public.email_templates t WHERE t.template_key='opportunity_paused' AND t.is_active)
 ON CONFLICT(pause_id,repreneur_id) DO NOTHING;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.capture_opportunity_pause_notifications() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER capture_opportunity_pause_notifications AFTER INSERT ON public.opportunity_pause_history
FOR EACH ROW EXECUTE FUNCTION public.capture_opportunity_pause_notifications();

CREATE FUNCTION public.opportunity_pause_notification_payload(p_notification_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('notificationId',n.id,'pauseId',h.id,'matchId',m.id,'repreneurId',r.id,
   'recipientEmail',n.recipient_email,'firstName',n.first_name,'publicTitle',n.public_title,
   'reason',h.reason,'subject',t.subject,'body',coalesce(nullif(btrim(t.body_markdown),''),
     E'Bonjour {firstName},\n\nL’opportunité {opportunityTitle} est temporairement mise en pause.'))
 FROM public.opportunity_pause_notifications n JOIN public.opportunity_pause_history h ON h.id=n.pause_id
 JOIN public.opportunity_matches m ON m.id=n.match_id AND m.repreneur_id=n.repreneur_id
 JOIN public.opportunities o ON o.id=h.opportunity_id AND o.id=m.opportunity_id
 JOIN public.repreneurs r ON r.id=n.repreneur_id
 JOIN public.email_templates t ON t.template_key='opportunity_paused' AND t.is_active
 WHERE n.id=p_notification_id AND o.status='paused' AND NOT o.is_demo AND NOT r.is_demo
   AND m.status IN ('interested','active_pursuit') AND lower(btrim(r.email))=lower(n.recipient_email)
   AND NOT EXISTS(SELECT 1 FROM public.opportunity_interest_events e WHERE e.match_id=m.id
     AND e.event_type='rejected' AND e.interest_expressed_at IS NOT DISTINCT FROM m.interest_expressed_at)
   AND h.id=(SELECT latest.id FROM public.opportunity_pause_history latest WHERE latest.opportunity_id=o.id
     ORDER BY latest.paused_at DESC,latest.id DESC LIMIT 1)
$$;
REVOKE ALL ON FUNCTION public.opportunity_pause_notification_payload(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.opportunity_pause_notification_payload(uuid) TO service_role;

CREATE FUNCTION public.pending_opportunity_pause_notifications(p_pause_id uuid DEFAULT NULL,p_limit integer DEFAULT 4)
RETURNS TABLE(id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT n.id FROM public.opportunity_pause_notifications n
 LEFT JOIN public.notification_delivery_claims c ON c.idempotency_key='opportunity-pause:'||n.id::text
 WHERE (p_pause_id IS NULL OR n.pause_id=p_pause_id) AND coalesce(c.status,'pending')<>'sent'
   AND public.opportunity_pause_notification_payload(n.id) IS NOT NULL
 ORDER BY coalesce(c.updated_at,n.created_at),n.id LIMIT greatest(1,least(coalesce(p_limit,4),50))
$$;
REVOKE ALL ON FUNCTION public.pending_opportunity_pause_notifications(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pending_opportunity_pause_notifications(uuid,integer) TO service_role;
