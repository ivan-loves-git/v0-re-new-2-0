-- #247 / #253 / accepted Decision #250. Additive source only; production held.
BEGIN;
ALTER TABLE public.email_templates ADD COLUMN auto_send boolean NOT NULL DEFAULT false,
  ADD COLUMN policy_version bigint NOT NULL DEFAULT 1,
  ADD COLUMN policy_changed_at timestamptz NOT NULL DEFAULT now();
CREATE TABLE public.email_policy_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), template_key text NOT NULL,
  actor text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now(),
  old_policy jsonb NOT NULL, new_policy jsonb NOT NULL
);
ALTER TABLE public.email_policy_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_policy_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.email_policy_events TO service_role;
CREATE FUNCTION public.email_policy_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF OLD.is_active IS DISTINCT FROM NEW.is_active OR OLD.auto_send IS DISTINCT FROM NEW.auto_send THEN
    NEW.policy_version:=OLD.policy_version+1; NEW.policy_changed_at:=clock_timestamp();
    INSERT INTO public.email_policy_events(template_key,actor,old_policy,new_policy)
    VALUES(NEW.template_key,coalesce(nullif(current_setting('wave.email_policy_actor',true),''),'service'),
      jsonb_build_object('active',OLD.is_active,'auto_send',OLD.auto_send,'version',OLD.policy_version),
      jsonb_build_object('active',NEW.is_active,'auto_send',NEW.auto_send,'version',NEW.policy_version));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER email_policy_audit BEFORE UPDATE ON public.email_templates
FOR EACH ROW EXECUTE FUNCTION public.email_policy_audit();
CREATE FUNCTION public.email_policy_set(p_template_key text,p_auto_send boolean,p_actor text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM public.staff_email_review_assert_actor(p_actor);
  IF p_template_key IN ('portal_access_setup','password_reset') THEN RAISE EXCEPTION 'access_policy_locked'; END IF;
  PERFORM set_config('wave.email_policy_actor',p_actor,true);
  UPDATE public.email_templates SET auto_send=p_auto_send WHERE template_key=p_template_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'email_policy_missing'; END IF;
END $$;
-- New code-governed business entries have no editable reusable body. Creating
-- their catalogue rows preserves their existing eligibility; review is default.
INSERT INTO public.email_templates(template_key,subject,description,is_active,requires_consent)
VALUES ('opportunity_memo_available','Memo available','Exact current authorized memo grant',true,false),
 ('locked_opportunity_interest','Direct interest alert','Exact new direct interest to staff',true,false),
 ('code:e6_nda_ready','NDA ready','Exact current blank NDA validation',true,false)
ON CONFLICT(template_key) DO NOTHING;
ALTER TABLE public.staff_email_reviews ALTER COLUMN opportunity_id DROP NOT NULL;
ALTER TABLE public.staff_email_reviews ADD COLUMN repreneur_id uuid REFERENCES public.repreneurs(id) ON DELETE CASCADE,
  ADD COLUMN business_match_id uuid REFERENCES public.opportunity_matches(id) ON DELETE CASCADE,
  ADD COLUMN source_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN business_operation_key text,
  ADD COLUMN retained_html text,
  ADD COLUMN protected_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN prepared_policy jsonb,
  ADD COLUMN provider_cc jsonb,
  ADD COLUMN tracking_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN provider_started_at timestamptz;
CREATE UNIQUE INDEX staff_email_business_operation_idx ON public.staff_email_reviews(business_operation_key)
WHERE business_operation_key IS NOT NULL;
ALTER TABLE public.staff_email_reviews DROP CONSTRAINT staff_email_reviews_source_kind_check;
ALTER TABLE public.staff_email_reviews ADD CONSTRAINT staff_email_reviews_source_kind_check
CHECK(source_kind IN ('ma','e4','e6','e7','freshness','business'));
ALTER TABLE public.staff_email_reviews DROP CONSTRAINT staff_email_reviews_handoff_binding;
ALTER TABLE public.staff_email_reviews ADD CONSTRAINT staff_email_reviews_handoff_binding CHECK(
 (source_kind='business' AND business_operation_key IS NOT NULL AND contact_link_id IS NULL AND upstream_evidence_id IS NULL)
 OR (source_kind IN ('ma','freshness') AND opportunity_id IS NOT NULL AND match_id IS NULL AND upstream_evidence_id IS NULL AND contact_link_id IS NOT NULL)
 OR (source_kind='e6' AND opportunity_id IS NOT NULL AND match_id IS NOT NULL AND upstream_evidence_id=source_operation_id AND contact_link_id IS NULL)
 OR (source_kind IN ('e4','e7') AND opportunity_id IS NOT NULL AND match_id IS NOT NULL AND upstream_evidence_id=source_operation_id AND contact_link_id IS NOT NULL));

CREATE FUNCTION public.email_policy_set_active(p_template_key text,p_active boolean,p_actor text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.staff_email_review_assert_actor(p_actor);
 IF p_template_key IN ('portal_access_setup','password_reset') THEN RAISE EXCEPTION 'access_policy_locked'; END IF;
 PERFORM set_config('wave.email_policy_actor',p_actor,true);
 IF p_template_key='opportunity_discovery_digest' THEN PERFORM public.d136_toggle(p_actor,p_active);
 ELSE UPDATE public.email_templates SET is_active=p_active WHERE template_key=p_template_key;
 IF NOT FOUND THEN RAISE EXCEPTION 'email_policy_missing'; END IF; END IF;
END $$;
REVOKE ALL ON FUNCTION public.email_policy_set_active(text,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_policy_set_active(text,boolean,text) TO service_role;
-- Copy audits retain hashes and actors rather than duplicating message content.
CREATE FUNCTION public.email_template_words_set(p_template_key text,p_settings jsonb,p_actor text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t public.email_templates%ROWTYPE;
BEGIN
 PERFORM public.staff_email_review_assert_actor(p_actor);
 SELECT * INTO t FROM public.email_templates WHERE template_key=p_template_key FOR UPDATE;
 IF t.id IS NULL OR p_template_key IN ('portal_access_setup','password_reset','opportunity_discovery_digest','opportunity_recommendation_assignment','opportunity_memo_available','locked_opportunity_interest','code:e6_nda_ready')
 OR jsonb_typeof(p_settings)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_settings) x WHERE x NOT IN ('subject','body_markdown','preview_text'))
 OR (p_settings ? 'body_markdown' AND t.body_editable IS DISTINCT FROM true)
 OR (p_settings ? 'subject' AND nullif(btrim(p_settings->>'subject'),'') IS NULL)
 THEN RAISE EXCEPTION 'email_words_not_editable'; END IF;
 UPDATE public.email_templates SET
 subject=CASE WHEN p_settings ? 'subject' THEN p_settings->>'subject' ELSE subject END,
 body_markdown=CASE WHEN p_settings ? 'body_markdown' THEN p_settings->>'body_markdown' ELSE body_markdown END,
 preview_text=CASE WHEN p_settings ? 'preview_text' THEN p_settings->>'preview_text' ELSE preview_text END
 WHERE template_key=p_template_key;
 INSERT INTO public.email_policy_events(template_key,actor,old_policy,new_policy)
 SELECT p_template_key,p_actor,jsonb_build_object('copy_sha',md5(concat_ws('|',t.subject,t.body_markdown))),
 jsonb_build_object('copy_sha',md5(concat_ws('|',subject,body_markdown))) FROM public.email_templates WHERE template_key=p_template_key;
END $$;
REVOKE ALL ON FUNCTION public.email_template_words_set(text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_template_words_set(text,jsonb,text) TO service_role;
CREATE FUNCTION public.email_business_prepare(p_key text,p_template_key text,p_repreneur_id uuid,
 p_recipient text,p_subject text,p_body text,p_html text,p_context jsonb,p_links jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t public.email_templates%ROWTYPE; r public.staff_email_reviews%ROWTYPE; v_id uuid:=gen_random_uuid();
 v_namespace text:='REAL'; v_email text; v_actor text:='system'; v_match_id uuid;
BEGIN
 IF p_context->>'kind'='manual' THEN
 v_actor:=p_context->>'preparedBy'; PERFORM public.staff_email_review_assert_actor(v_actor); END IF;
 SELECT * INTO t FROM public.email_templates WHERE template_key=p_template_key FOR SHARE;
 IF t.id IS NULL OR t.is_active IS DISTINCT FROM true OR p_template_key IN ('portal_access_setup','password_reset')
 THEN RAISE EXCEPTION 'email_business_inactive_or_missing'; END IF;
 IF nullif(btrim(p_key),'') IS NULL OR nullif(btrim(p_subject),'') IS NULL OR nullif(btrim(p_body),'') IS NULL
 OR nullif(btrim(p_recipient),'') IS NULL OR jsonb_typeof(p_context)<>'object' OR jsonb_typeof(p_links)<>'array'
 THEN RAISE EXCEPTION 'email_business_invalid'; END IF;
 IF p_repreneur_id IS NOT NULL THEN
   SELECT CASE WHEN is_demo THEN 'DEMO' ELSE 'REAL' END,email INTO v_namespace,v_email
   FROM public.repreneurs WHERE id=p_repreneur_id;
   IF v_namespace IS NULL OR lower(btrim(v_email)) IS DISTINCT FROM lower(btrim(p_recipient))
   THEN RAISE EXCEPTION 'email_business_recipient_changed'; END IF;
 END IF;
 -- Staff-recipient business notices still belong to the immutable match.
 -- This adds a cascade only for newly prepared rows, without historic rewrite.
 IF p_context->>'kind'='interest' THEN
 SELECT match_id INTO v_match_id FROM public.opportunity_interest_events WHERE id=(p_context->>'eventId')::uuid;
 ELSIF p_context->>'kind'='cycle' THEN
 SELECT match_id INTO v_match_id FROM public.opportunity_recommendation_cycles WHERE id=(p_context->>'cycleId')::uuid;
 ELSIF p_context->>'kind'='memo_feedback' THEN
 SELECT match_id INTO v_match_id FROM public.opportunity_pursuit_evidence WHERE id=(p_context->>'grantEvidenceId')::uuid;
 ELSE v_match_id:=coalesce(nullif(p_context->>'matchId',''),nullif(p_context->'input'->>'matchId',''))::uuid;
 END IF;
 IF p_context->>'kind' IN ('interest','cycle','direct_interest','recommendation','memo_available','memo_feedback') AND v_match_id IS NULL
 THEN RAISE EXCEPTION 'email_business_source_parent_missing'; END IF;
 IF v_match_id IS NOT NULL THEN
 SELECT CASE WHEN o.is_demo OR p.is_demo THEN 'DEMO' ELSE 'REAL' END INTO v_namespace
 FROM public.opportunity_matches m JOIN public.opportunities o ON o.id=m.opportunity_id
 JOIN public.repreneurs p ON p.id=m.repreneur_id WHERE m.id=v_match_id;
 IF v_namespace IS NULL THEN RAISE EXCEPTION 'email_business_source_parent_missing'; END IF;
 END IF;
 INSERT INTO public.staff_email_reviews(id,source_kind,source_operation_id,opportunity_id,
  recipient_email,namespace,template_key,template_version,subject,body_text,created_by,
  repreneur_id,business_match_id,source_context,business_operation_key,retained_html,protected_links,prepared_policy)
 VALUES(v_id,'business',v_id,NULL,btrim(p_recipient),v_namespace,p_template_key,
  md5(concat_ws('|',coalesce(t.subject,''),coalesce(t.body_markdown,''),coalesce(t.body_editable::text,''))),p_subject,p_body,v_actor,
  p_repreneur_id,v_match_id,p_context,p_key,p_html,p_links,jsonb_build_object('auto_send',t.auto_send,'version',t.policy_version))
 ON CONFLICT(business_operation_key) WHERE business_operation_key IS NOT NULL DO NOTHING;
 SELECT * INTO r FROM public.staff_email_reviews WHERE business_operation_key=p_key;
 IF r.recipient_email IS DISTINCT FROM btrim(p_recipient) OR r.template_key IS DISTINCT FROM p_template_key
 OR r.repreneur_id IS DISTINCT FROM p_repreneur_id OR r.business_match_id IS DISTINCT FROM v_match_id OR r.namespace IS DISTINCT FROM v_namespace
 THEN RAISE EXCEPTION 'email_business_operation_conflict'; END IF;
 IF r.id=v_id THEN INSERT INTO public.staff_email_review_events(review_id,event_kind,actor,version,detail)
 VALUES(v_id,'prepared',v_actor,1,jsonb_build_object('policy',r.prepared_policy)); END IF;
 RETURN to_jsonb(r);
END $$;
CREATE FUNCTION public.email_business_reserve(p_review_id uuid,p_version integer,p_actor text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.staff_email_reviews%ROWTYPE; t public.email_templates%ROWTYPE; v_token uuid; v_payload jsonb;
BEGIN
 IF p_actor IS NOT NULL THEN PERFORM public.staff_email_review_assert_actor(p_actor); END IF;
 SELECT * INTO r FROM public.staff_email_reviews WHERE id=p_review_id FOR UPDATE;
 SELECT * INTO t FROM public.email_templates WHERE template_key=r.template_key FOR SHARE;
 IF r.source_kind IS DISTINCT FROM 'business' OR r.version<>p_version OR r.namespace<>'REAL'
 OR r.archived_at IS NOT NULL OR r.state NOT IN ('pending','failed','sending','uncertain')
 OR t.is_active IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'email_business_not_sendable'; END IF;
 IF p_actor IS NULL AND (r.state<>'pending' OR t.auto_send IS DISTINCT FROM true
 OR (r.prepared_policy->>'auto_send')::boolean IS DISTINCT FROM true
 OR (r.prepared_policy->>'version')::bigint IS DISTINCT FROM t.policy_version)
 THEN RAISE EXCEPTION 'email_business_review_required'; END IF;
 IF r.state='sending' AND r.attempted_at>clock_timestamp()-interval '2 minutes'
 THEN RAISE EXCEPTION 'email_business_in_flight'; END IF;
 IF r.state IN ('sending','uncertain') AND r.attempted_at<=clock_timestamp()-interval '23 hours'
 THEN RAISE EXCEPTION 'email_business_reconcile_required'; END IF;
 v_payload:=jsonb_build_object('to',jsonb_build_array(r.recipient_email),'subject',r.subject,'text',r.body_text,'context',r.source_context);
 IF r.attempted_payload IS NOT NULL AND r.attempted_payload IS DISTINCT FROM v_payload
 THEN RAISE EXCEPTION 'email_business_payload_changed'; END IF;
 v_token:=gen_random_uuid();
 UPDATE public.staff_email_reviews SET state='sending',attempt_token=v_token,
 attempted_at=coalesce(attempted_at,clock_timestamp()),attempted_payload=v_payload,
 approved_by=coalesce(approved_by,p_actor,'system'),approved_at=coalesce(approved_at,clock_timestamp()) WHERE id=r.id;
 INSERT INTO public.staff_email_review_events(review_id,event_kind,actor,version,detail)
 VALUES(r.id,'approved',coalesce(p_actor,'system'),r.version,jsonb_build_object('effective_policy',to_jsonb(t)-'body_markdown'));
 RETURN v_token;
END $$;
CREATE FUNCTION public.email_business_authorize_attempt(p_review_id uuid,p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.staff_email_reviews%ROWTYPE; t public.email_templates%ROWTYPE; v_email text; v_demo boolean;
BEGIN
 SELECT * INTO r FROM public.staff_email_reviews WHERE id=p_review_id FOR UPDATE;
 SELECT * INTO t FROM public.email_templates WHERE template_key=r.template_key FOR SHARE;
 IF r.source_kind IS DISTINCT FROM 'business' OR r.state<>'sending' OR r.attempt_token IS DISTINCT FROM p_token
 OR r.archived_at IS NOT NULL OR r.namespace<>'REAL' OR t.is_active IS DISTINCT FROM true
 OR (r.approved_by='system' AND r.provider_started_at IS NULL AND (t.auto_send IS DISTINCT FROM true
 OR (r.prepared_policy->>'version')::bigint IS DISTINCT FROM t.policy_version))
 THEN RETURN false; END IF;
 IF r.repreneur_id IS NOT NULL THEN
 SELECT email,is_demo INTO v_email,v_demo FROM public.repreneurs WHERE id=r.repreneur_id;
 IF v_demo IS DISTINCT FROM false OR lower(btrim(v_email)) IS DISTINCT FROM lower(btrim(r.recipient_email)) THEN RETURN false; END IF;
 END IF;
 UPDATE public.staff_email_reviews SET provider_started_at=coalesce(provider_started_at,clock_timestamp()) WHERE id=r.id;
 RETURN true;
END $$;
CREATE FUNCTION public.email_business_finish(p_review_id uuid,p_token uuid,p_state text,p_provider_id text,
 p_error text,p_actor text,p_cc jsonb,p_tracking boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.staff_email_reviews%ROWTYPE; v_version integer;
BEGIN
 SELECT * INTO r FROM public.staff_email_reviews WHERE id=p_review_id FOR UPDATE;
 IF r.source_kind IS DISTINCT FROM 'business' OR r.state<>'sending' OR r.attempt_token IS DISTINCT FROM p_token
 OR p_state NOT IN ('sent','failed','uncertain') OR (p_state='sent' AND nullif(btrim(p_provider_id),'') IS NULL)
 OR (p_state<>'sent' AND p_provider_id IS NOT NULL) THEN RAISE EXCEPTION 'email_business_outcome_invalid'; END IF;
 UPDATE public.staff_email_reviews SET state=p_state,outcome_at=clock_timestamp(),provider_message_id=p_provider_id,
 provider_cc=p_cc,tracking_verified=p_tracking,delivery_error=left(p_error,500),attempt_token=NULL,version=version+1
 WHERE id=r.id RETURNING version INTO v_version;
 INSERT INTO public.staff_email_review_events(review_id,event_kind,actor,version,detail)
 VALUES(r.id,p_state,coalesce(p_actor,'system'),v_version,jsonb_build_object('provider_message_id',p_provider_id,'error',left(p_error,500)));
END $$;

-- Retained words may change only before any provider attempt; URLs remain
-- frozen. All old source-specific business and document checks still apply.
ALTER FUNCTION public.staff_email_review_edit(uuid,integer,text,text,text) RENAME TO staff_email_review_edit_pre247;
CREATE FUNCTION public.staff_email_review_edit(p_review_id uuid,p_version integer,p_subject text,p_body_text text,p_actor text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.staff_email_reviews%ROWTYPE; v_version integer; v_links jsonb;
BEGIN
 PERFORM public.staff_email_review_assert_actor(p_actor);
 SELECT * INTO r FROM public.staff_email_reviews WHERE id=p_review_id FOR UPDATE;
 SELECT coalesce(jsonb_agg(DISTINCT x[1]),'[]'::jsonb) INTO v_links FROM regexp_matches(r.body_text,'https?://[^[:space:]<>"\])]+','g') x;
 v_links:=v_links||r.protected_links;
 IF r.id IS NULL OR r.version<>p_version OR r.state<>'pending' OR r.archived_at IS NOT NULL
 OR r.attempted_payload IS NOT NULL OR nullif(btrim(p_subject),'') IS NULL OR nullif(btrim(p_body_text),'') IS NULL
 THEN RAISE EXCEPTION 'email_review_stale_or_locked'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(v_links) x WHERE position(x in p_body_text)=0)
 OR EXISTS(SELECT 1 FROM regexp_matches(p_body_text,'https?://[^[:space:]<>"\])]+','g') x WHERE NOT v_links ? x[1])
 THEN RAISE EXCEPTION 'email_review_protected_link'; END IF;
 IF r.source_kind IN ('ma','freshness') THEN RETURN public.staff_email_review_edit_pre247(p_review_id,p_version,p_subject,p_body_text,p_actor); END IF;
 UPDATE public.staff_email_reviews SET subject=btrim(p_subject),body_text=btrim(p_body_text),retained_html=NULL,
 edited_by=p_actor,edited_at=clock_timestamp(),version=version+1 WHERE id=r.id RETURNING version INTO v_version;
 INSERT INTO public.staff_email_review_events(review_id,event_kind,actor,version) VALUES(r.id,'edited',p_actor,v_version);
 RETURN v_version;
END $$;
ALTER FUNCTION public.staff_email_review_archive_source_clear(uuid) RENAME TO staff_email_review_archive_source_clear_pre247;
CREATE FUNCTION public.staff_email_review_archive_source_clear(p_review_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.staff_email_reviews%ROWTYPE;
BEGIN
 SELECT * INTO r FROM public.staff_email_reviews WHERE id=p_review_id;
 IF r.source_kind<>'business' THEN RETURN public.staff_email_review_archive_source_clear_pre247(p_review_id); END IF;
 RETURN r.provider_message_id IS NULL AND r.state IN ('pending','failed') AND r.provider_started_at IS NULL;
END $$;
ALTER FUNCTION public.staff_email_review_archive(uuid,integer,text) RENAME TO staff_email_review_archive_pre247;
CREATE FUNCTION public.staff_email_review_archive(p_review_id uuid,p_version integer,p_actor text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.staff_email_reviews%ROWTYPE; v_version integer;
BEGIN
 PERFORM public.staff_email_review_assert_actor(p_actor);
 SELECT * INTO r FROM public.staff_email_reviews WHERE id=p_review_id FOR UPDATE;
 IF r.source_kind<>'business' THEN RETURN public.staff_email_review_archive_pre247(p_review_id,p_version,p_actor); END IF;
 IF r.id IS NULL OR r.version<>p_version OR r.archived_at IS NOT NULL OR NOT public.staff_email_review_archive_source_clear(r.id)
 THEN RAISE EXCEPTION 'email_review_not_archivable'; END IF;
 PERFORM set_config('wave.staff_email_archive_mutation',r.id::text,true);
 UPDATE public.staff_email_reviews SET archived_at=clock_timestamp(),archived_by=p_actor,version=version+1
 WHERE id=r.id RETURNING version INTO v_version;
 INSERT INTO public.staff_email_review_events(review_id,event_kind,actor,version) VALUES(r.id,'archived',p_actor,v_version);
 RETURN v_version;
END $$;
-- Extend the released queue without replacing its canonical contact joins.
ALTER VIEW public.staff_email_review_queue RENAME TO staff_email_review_queue_pre247;
CREATE VIEW public.staff_email_review_queue WITH(security_invoker=true,security_barrier=true) AS
 SELECT * FROM public.staff_email_review_queue_pre247 WHERE source_kind<>'business'
 UNION ALL
 SELECT r.id,r.source_kind,r.template_key,r.subject,left(regexp_replace(r.body_text,'[[:space:]]+',' ','g'),320),
 r.recipient_email,r.namespace,r.state,r.version,r.created_at,
 nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),p.avatar_url,NULL::text,
 'business'::text,r.template_key,lower(r.subject),lower(r.template_key),lower(coalesce(p.first_name,r.recipient_email)),''::text,
 lower(concat_ws(' ',r.subject,r.body_text,r.recipient_email,p.first_name,p.last_name,r.template_key)),
 r.archived_at,public.staff_email_review_archive_source_clear(r.id)
 FROM public.staff_email_reviews r LEFT JOIN public.repreneurs p ON p.id=r.repreneur_id WHERE r.source_kind='business';
REVOKE ALL ON public.staff_email_review_queue FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.staff_email_review_queue TO service_role;
-- Private independent facts, with no raw payload, IP or user-agent retention.
CREATE TABLE public.email_provider_events(
 id text PRIMARY KEY,provider_message_id text NOT NULL,event_type text NOT NULL,
 occurred_at timestamptz NOT NULL,recipient_kind text NOT NULL CHECK(recipient_kind IN ('primary','copy','unknown')),
 recipient_email text,reason text CHECK(length(reason)<=500),created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.email_provider_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_provider_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.email_provider_events TO service_role;
CREATE INDEX email_provider_events_message_idx ON public.email_provider_events(provider_message_id,event_type,occurred_at);
ALTER TABLE public.email_logs ADD COLUMN retained_html text,ADD COLUMN retained_text text,
 ADD COLUMN actual_cc jsonb,ADD COLUMN tracking_verified boolean NOT NULL DEFAULT false,
 ADD COLUMN bounced_at timestamptz,ADD COLUMN complained_at timestamptz,
 ADD COLUMN delayed_at timestamptz,ADD COLUMN suppressed_at timestamptz;

REVOKE ALL ON FUNCTION public.email_policy_set(text,boolean,text),
 public.email_business_prepare(text,text,uuid,text,text,text,text,jsonb,jsonb),
 public.email_business_reserve(uuid,integer,text),public.email_business_authorize_attempt(uuid,uuid),
 public.email_business_finish(uuid,uuid,text,text,text,text,jsonb,boolean),
 public.staff_email_review_edit(uuid,integer,text,text,text),
 public.staff_email_review_archive_source_clear(uuid),public.staff_email_review_archive(uuid,integer,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_policy_set(text,boolean,text),
 public.email_business_prepare(text,text,uuid,text,text,text,text,jsonb,jsonb),
 public.email_business_reserve(uuid,integer,text),public.email_business_authorize_attempt(uuid,uuid),
 public.email_business_finish(uuid,uuid,text,text,text,text,jsonb,boolean),
 public.staff_email_review_edit(uuid,integer,text,text,text),
 public.staff_email_review_archive_source_clear(uuid),public.staff_email_review_archive(uuid,integer,text)
 TO service_role;

CREATE FUNCTION public.email_provider_record_event(p_id text,p_provider_id text,p_type text,
 p_occurred_at timestamptz,p_recipient_kind text,p_reason text,p_recipient text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_inserted integer;
BEGIN
 IF nullif(btrim(p_id),'') IS NULL OR nullif(btrim(p_provider_id),'') IS NULL
 OR p_type NOT IN ('email.sent','email.delivered','email.opened','email.clicked','email.bounced','email.complained','email.delivery_delayed','email.failed','email.suppressed')
 OR p_recipient_kind NOT IN ('primary','copy','unknown') THEN RAISE EXCEPTION 'email_provider_invalid'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.email_operations_history WHERE provider_message_id=p_provider_id) THEN
 RAISE EXCEPTION 'email_provider_parent_not_yet_retained'; END IF;
 INSERT INTO public.email_provider_events(id,provider_message_id,event_type,occurred_at,recipient_kind,reason,recipient_email)
 VALUES(p_id,p_provider_id,p_type,p_occurred_at,p_recipient_kind,left(p_reason,500),lower(btrim(p_recipient))) ON CONFLICT(id) DO NOTHING;
 GET DIAGNOSTICS v_inserted=ROW_COUNT;
 IF v_inserted=0 OR p_recipient_kind<>'primary' THEN RETURN; END IF;
 UPDATE public.email_logs SET
 delivered_at=CASE WHEN p_type='email.delivered' THEN least(delivered_at,p_occurred_at) ELSE delivered_at END,
 opened_at=CASE WHEN p_type='email.opened' THEN least(opened_at,p_occurred_at) ELSE opened_at END,
 clicked_at=CASE WHEN p_type='email.clicked' THEN least(clicked_at,p_occurred_at) ELSE clicked_at END,
 bounced_at=CASE WHEN p_type='email.bounced' THEN least(bounced_at,p_occurred_at) ELSE bounced_at END,
 complained_at=CASE WHEN p_type='email.complained' THEN least(complained_at,p_occurred_at) ELSE complained_at END,
 delayed_at=CASE WHEN p_type='email.delivery_delayed' THEN least(delayed_at,p_occurred_at) ELSE delayed_at END,
 suppressed_at=CASE WHEN p_type='email.suppressed' THEN least(suppressed_at,p_occurred_at) ELSE suppressed_at END,
 status=CASE WHEN status IN ('bounced','complained') THEN status
 WHEN p_type='email.complained' THEN 'complained' WHEN p_type='email.bounced' THEN 'bounced'
 WHEN p_type='email.clicked' THEN 'clicked' WHEN p_type='email.opened' AND status<>'clicked' THEN 'opened'
 WHEN p_type='email.delivered' AND status NOT IN ('clicked','opened') THEN 'delivered'
 WHEN p_type='email.sent' AND status IN ('pending','failed') THEN 'sent' ELSE status END
 WHERE resend_id=p_provider_id;
END $$;
REVOKE ALL ON FUNCTION public.email_provider_record_event(text,text,text,timestamptz,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_provider_record_event(text,text,text,timestamptz,text,text,text) TO service_role;

CREATE FUNCTION public.email_review_initial_policy() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t public.email_templates%ROWTYPE; v_actor text;
BEGIN
 SELECT * INTO t FROM public.email_templates WHERE template_key=NEW.template_key FOR SHARE;
 IF NEW.source_kind<>'business' THEN
 SELECT actor INTO v_actor FROM public.email_policy_events WHERE template_key=NEW.template_key
 AND (new_policy->>'auto_send')::boolean=true ORDER BY occurred_at DESC,id DESC LIMIT 1;
 NEW.prepared_policy:=jsonb_build_object('auto_send',coalesce(t.is_active AND t.auto_send,false),'version',t.policy_version,'enabled_by',v_actor);
 SELECT coalesce(jsonb_agg(DISTINCT x[1]),'[]'::jsonb) INTO NEW.protected_links
 FROM regexp_matches(NEW.body_text,'https?://[^[:space:]<>"\])]+','g') x;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER email_review_initial_policy BEFORE INSERT ON public.staff_email_reviews
FOR EACH ROW EXECUTE FUNCTION public.email_review_initial_policy();
CREATE FUNCTION public.email_review_claim_future_auto(p_review_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.staff_email_reviews%ROWTYPE; t public.email_templates%ROWTYPE;
BEGIN
 SELECT * INTO r FROM public.staff_email_reviews WHERE id=p_review_id FOR UPDATE;
 SELECT * INTO t FROM public.email_templates WHERE template_key=r.template_key FOR SHARE;
 IF r.id IS NULL OR r.state<>'pending' OR r.archived_at IS NOT NULL OR r.namespace<>'REAL'
 OR r.attempted_payload IS NOT NULL OR t.is_active IS DISTINCT FROM true OR t.auto_send IS DISTINCT FROM true
 OR (r.prepared_policy->>'auto_send')::boolean IS DISTINCT FROM true
 OR (r.prepared_policy->>'version')::bigint IS DISTINCT FROM t.policy_version OR r.prepared_policy ? 'auto_claimed_at'
 THEN RETURN false; END IF;
 UPDATE public.staff_email_reviews SET prepared_policy=prepared_policy||jsonb_build_object('auto_claimed_at',clock_timestamp()) WHERE id=r.id;
 RETURN true;
END $$;
CREATE FUNCTION public.email_review_capture_envelope(p_review_id uuid,p_token uuid,p_cc jsonb,p_tracking boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.staff_email_reviews%ROWTYPE; t public.email_templates%ROWTYPE;
BEGIN
 SELECT * INTO r FROM public.staff_email_reviews WHERE id=p_review_id FOR UPDATE;
 SELECT * INTO t FROM public.email_templates WHERE template_key=r.template_key FOR SHARE;
 IF t.is_active IS DISTINCT FROM true OR (r.provider_started_at IS NULL AND r.prepared_policy ? 'auto_claimed_at'
 AND (t.auto_send IS DISTINCT FROM true OR (r.prepared_policy->>'version')::bigint IS DISTINCT FROM t.policy_version))
 THEN RAISE EXCEPTION 'email_review_automatic_policy_changed'; END IF;
 UPDATE public.staff_email_reviews SET provider_cc=coalesce(provider_cc,p_cc),tracking_verified=p_tracking,provider_started_at=CASE WHEN source_kind='business' THEN provider_started_at ELSE coalesce(provider_started_at,clock_timestamp()) END
 WHERE id=p_review_id AND state='sending' AND attempt_token=p_token AND (provider_cc IS NULL OR provider_cc=p_cc);
 IF NOT FOUND THEN RAISE EXCEPTION 'email_review_envelope_changed'; END IF;
END $$;
CREATE FUNCTION public.email_review_mark_manual(p_review_id uuid,p_version integer,p_actor text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.staff_email_review_assert_actor(p_actor);
 UPDATE public.staff_email_reviews SET prepared_policy=prepared_policy-'auto_claimed_at'
 WHERE id=p_review_id AND version=p_version AND state IN ('pending','failed','uncertain','sending') AND archived_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'email_review_stale'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.email_review_mark_manual(uuid,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_review_mark_manual(uuid,integer,text) TO service_role;
CREATE FUNCTION public.email_review_replace_words(p_review_id uuid,p_version integer,p_subject text,p_body text,p_html text,p_template_version text,p_actor text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_version integer;
BEGIN
 v_version:=public.staff_email_review_edit(p_review_id,p_version,p_subject,p_body,p_actor);
 UPDATE public.staff_email_reviews SET template_version=p_template_version,retained_html=p_html WHERE id=p_review_id;
 RETURN v_version;
END $$;
REVOKE ALL ON FUNCTION public.email_review_claim_future_auto(uuid),public.email_review_capture_envelope(uuid,uuid,jsonb,boolean),
 public.email_review_replace_words(uuid,integer,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_review_claim_future_auto(uuid),public.email_review_capture_envelope(uuid,uuid,jsonb,boolean),
 public.email_review_replace_words(uuid,integer,text,text,text,text,text) TO service_role;

-- The released bounded manifest/serial/receipt rules also cover new business
-- rows without an opportunity parent. Historical batches remain immutable.
CREATE OR REPLACE FUNCTION public.staff_email_bulk_review_snapshot(p_review_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id',r.id,'version',r.version,'source_kind',r.source_kind,
    'source_operation_id',r.source_operation_id,'opportunity_id',r.opportunity_id,
    'match_id',r.match_id,'upstream_evidence_id',r.upstream_evidence_id,
    'contact_link_id',r.contact_link_id,'recipient_email',r.recipient_email,
    'namespace',r.namespace,'template_key',r.template_key,
    'template_version',r.template_version,'subject',r.subject,
    'body_text',r.body_text,'attachment_snapshot',r.attachment_snapshot,
    'source_context',r.source_context,'business_operation_key',r.business_operation_key)
  FROM public.staff_email_reviews r WHERE r.id=p_review_id;
$$;
CREATE OR REPLACE FUNCTION public.staff_email_bulk_claim(
  p_batch_id uuid,p_ordinal integer,p_actor text,p_payload jsonb,p_fingerprint text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_batch public.staff_email_bulk_batches%ROWTYPE;
  v_item public.staff_email_bulk_items%ROWTYPE;
  v_review public.staff_email_reviews%ROWTYPE;
  v_opportunity_id uuid; v_match_id uuid; v_review_token uuid;
  v_ma_token uuid; v_delivery_id uuid; v_operation_key uuid; v_delivery_status text;
  v_claim uuid;
BEGIN
  PERFORM public.staff_email_review_assert_actor(p_actor);
  SELECT * INTO v_batch FROM public.staff_email_bulk_batches WHERE id=p_batch_id FOR UPDATE;
  SELECT * INTO v_item FROM public.staff_email_bulk_items WHERE batch_id=p_batch_id AND ordinal=p_ordinal FOR UPDATE;
  IF v_batch.id IS NULL OR v_batch.prepared_by<>p_actor OR v_batch.confirmed_by<>p_actor
    OR v_batch.confirmed_at IS NULL OR v_item.review_id IS NULL
  THEN RAISE EXCEPTION 'bulk_claim_not_confirmed_or_wrong_actor'; END IF;
  IF v_item.state<>'not_attempted' THEN
    RETURN jsonb_build_object('start',false,'state',v_item.state);
  END IF;
  IF EXISTS (SELECT 1 FROM public.staff_email_bulk_items prior
    WHERE prior.batch_id=p_batch_id AND prior.ordinal<p_ordinal
      AND prior.state IN ('not_attempted','started'))
  THEN RAISE EXCEPTION 'bulk_claim_requires_serial_prior_result'; END IF;
  IF p_fingerprint !~ '^[0-9a-f]{64}$' OR jsonb_typeof(p_payload)<>'object'
  THEN RAISE EXCEPTION 'bulk_claim_invalid_payload'; END IF;

  IF EXISTS(SELECT 1 FROM public.staff_email_reviews WHERE id=v_item.review_id AND source_kind='business') THEN
    SELECT * INTO v_review FROM public.staff_email_reviews WHERE id=v_item.review_id FOR UPDATE;
    IF v_review.state<>'pending' OR v_review.archived_at IS NOT NULL OR v_review.namespace<>'REAL'
      OR v_review.attempted_payload IS NOT NULL OR v_review.attempted_at IS NOT NULL
      OR v_item.review_snapshot IS DISTINCT FROM public.staff_email_bulk_review_snapshot(v_review.id)
      OR NOT public.staff_email_review_archive_source_clear(v_review.id)
      OR p_payload->>'subject' IS DISTINCT FROM v_review.subject
      OR p_payload->>'text' IS DISTINCT FROM v_review.body_text
      OR p_payload->'to' IS DISTINCT FROM jsonb_build_array(v_review.recipient_email)
      OR p_payload->'attachments' IS DISTINCT FROM '[]'::jsonb
    THEN RAISE EXCEPTION 'bulk_business_changed'; END IF;
    v_review_token:=public.email_business_reserve(v_review.id,v_review.version,p_actor);
    v_claim:=gen_random_uuid();
    UPDATE public.staff_email_bulk_items SET state='started',claim_token=v_claim,
      review_attempt_token=v_review_token,started_at=now() WHERE batch_id=p_batch_id AND ordinal=p_ordinal;
    RETURN jsonb_build_object('start',true,'claim_token',v_claim,'review_attempt_token',v_review_token);
  END IF;

  -- Archive and MA source operations lock the parent before the review. A
  -- nonblocking match lock avoids inversion with older pursuit dispatchers.
  SELECT opportunity_id,match_id INTO v_opportunity_id,v_match_id
    FROM public.staff_email_reviews WHERE id=v_item.review_id;
  IF v_opportunity_id IS NULL THEN RAISE EXCEPTION 'bulk_review_parent_missing'; END IF;
  PERFORM 1 FROM public.opportunities WHERE id=v_opportunity_id FOR UPDATE NOWAIT;
  IF v_match_id IS NOT NULL THEN
    PERFORM 1 FROM public.opportunity_matches WHERE id=v_match_id FOR UPDATE NOWAIT;
  END IF;
  SELECT * INTO v_review FROM public.staff_email_reviews WHERE id=v_item.review_id FOR UPDATE;
  IF v_review.id IS NULL OR v_review.opportunity_id IS DISTINCT FROM v_opportunity_id
    OR v_review.match_id IS DISTINCT FROM v_match_id
    OR v_review.namespace<>'REAL' OR v_review.state<>'pending'
    OR v_review.archived_at IS NOT NULL OR v_review.attempted_payload IS NOT NULL
    OR v_review.attempted_at IS NOT NULL
    OR v_item.review_snapshot IS DISTINCT FROM public.staff_email_bulk_review_snapshot(v_review.id)
    OR v_item.members_snapshot IS DISTINCT FROM public.staff_email_bulk_members_snapshot(v_review.id)
    OR NOT public.staff_email_review_archive_source_clear(v_review.id)
    OR p_payload->>'subject' IS DISTINCT FROM v_review.subject
    OR p_payload->>'text' IS DISTINCT FROM v_review.body_text
    OR p_payload->'to' IS DISTINCT FROM jsonb_build_array(v_review.recipient_email)
    OR (v_review.source_kind<>'freshness' AND
      p_payload->'attachments' IS DISTINCT FROM v_review.attachment_snapshot)
  THEN RAISE EXCEPTION 'bulk_claim_review_or_source_changed'; END IF;

  IF v_review.source_kind IN ('e4','e6','e7') THEN
    SELECT delivery_id,operation_key,delivery_status
      INTO v_delivery_id,v_operation_key,v_delivery_status
    FROM public.journey_begin_handoff_delivery(v_review.match_id,v_review.source_operation_id,
      v_review.source_kind,p_fingerprint,p_actor,v_review.attachment_snapshot);
    IF v_delivery_status IS DISTINCT FROM 'sending' THEN
      RAISE EXCEPTION 'bulk_claim_prior_handoff_attempt';
    END IF;
  END IF;
  IF v_review.source_kind IN ('ma','e4','e7') THEN
    v_ma_token:=public.reserve_ma_source_email_send(v_review.opportunity_id,p_actor);
  END IF;
  IF v_review.source_kind='freshness' THEN
    v_review_token:=public.opportunity_freshness_reserve(v_review.id,v_review.version,
      p_payload,p_fingerprint,p_actor);
  ELSE
    v_review_token:=public.staff_email_review_reserve(v_review.id,v_review.version,p_payload,p_actor);
  END IF;
  v_claim:=gen_random_uuid();
  UPDATE public.staff_email_bulk_items SET state='started',claim_token=v_claim,
    review_attempt_token=v_review_token,ma_reservation_token=v_ma_token,
    handoff_delivery_id=v_delivery_id,handoff_operation_key=v_operation_key,
    started_at=now() WHERE batch_id=p_batch_id AND ordinal=p_ordinal;
  RETURN jsonb_build_object('start',true,'claim_token',v_claim,
    'review_attempt_token',v_review_token,'ma_reservation_token',v_ma_token,
    'handoff_delivery_id',v_delivery_id,'handoff_operation_key',v_operation_key);
END $$;
CREATE OR REPLACE FUNCTION public.staff_email_bulk_finish(
  p_batch_id uuid,p_ordinal integer,p_claim_token uuid,p_outcome text,p_detail text,p_actor text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_batch public.staff_email_bulk_batches%ROWTYPE;
  v_item public.staff_email_bulk_items%ROWTYPE;
  v_review public.staff_email_reviews%ROWTYPE;
BEGIN
  PERFORM public.staff_email_review_assert_actor(p_actor);
  SELECT * INTO v_batch FROM public.staff_email_bulk_batches WHERE id=p_batch_id FOR UPDATE;
  SELECT * INTO v_item FROM public.staff_email_bulk_items WHERE batch_id=p_batch_id AND ordinal=p_ordinal FOR UPDATE;
  IF v_batch.id IS NULL OR v_batch.confirmed_by<>p_actor OR v_item.review_id IS NULL
    OR v_item.claim_token IS DISTINCT FROM p_claim_token
    OR v_item.state NOT IN ('started','uncertain')
    OR p_outcome NOT IN ('accepted','blocked','failed','uncertain')
  THEN RAISE EXCEPTION 'bulk_finish_not_claimed'; END IF;
  SELECT * INTO v_review FROM public.staff_email_reviews WHERE id=v_item.review_id;
  IF (p_outcome='accepted' AND (v_review.state<>'sent' OR
      v_review.provider_message_id IS NULL OR (v_review.source_kind<>'business' AND v_review.delivery_evidence_id IS NULL)))
    OR (p_outcome IN ('failed','blocked') AND (v_review.state<>'failed' OR
      NOT public.staff_email_review_archive_source_clear(v_review.id)))
  THEN RAISE EXCEPTION 'bulk_finish_requires_source_evidence'; END IF;
  UPDATE public.staff_email_bulk_items SET state=p_outcome,finished_at=now(),
    outcome_detail=left(nullif(btrim(p_detail),''),500)
    WHERE batch_id=p_batch_id AND ordinal=p_ordinal;
END $$;
CREATE OR REPLACE FUNCTION public.staff_email_bulk_reconcile(p_batch_id uuid,p_ordinal integer,p_actor text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_batch public.staff_email_bulk_batches%ROWTYPE;
  v_item public.staff_email_bulk_items%ROWTYPE;
  v_review public.staff_email_reviews%ROWTYPE; v_state text;
BEGIN
  PERFORM public.staff_email_review_assert_actor(p_actor);
  SELECT * INTO v_batch FROM public.staff_email_bulk_batches WHERE id=p_batch_id FOR UPDATE;
  SELECT * INTO v_item FROM public.staff_email_bulk_items WHERE batch_id=p_batch_id AND ordinal=p_ordinal FOR UPDATE;
  IF v_batch.id IS NULL OR v_batch.confirmed_by<>p_actor OR v_item.review_id IS NULL
  THEN RAISE EXCEPTION 'bulk_reconcile_wrong_actor'; END IF;
  IF v_item.state NOT IN ('started','uncertain') THEN RETURN v_item.state; END IF;
  SELECT * INTO v_review FROM public.staff_email_reviews WHERE id=v_item.review_id;
  v_state:=CASE
    WHEN v_review.state='sent' AND v_review.provider_message_id IS NOT NULL
      AND (v_review.source_kind='business' OR v_review.delivery_evidence_id IS NOT NULL) THEN 'accepted'
    WHEN v_review.state='failed' AND public.staff_email_review_archive_source_clear(v_review.id)
      THEN 'failed'
    WHEN v_review.state='uncertain' OR v_item.started_at<=now()-interval '2 minutes'
      THEN 'uncertain'
    ELSE 'started' END;
  IF v_state IS DISTINCT FROM v_item.state THEN
    UPDATE public.staff_email_bulk_items SET state=v_state,
      finished_at=CASE WHEN v_state='started' THEN NULL ELSE now() END,
      outcome_detail=CASE WHEN v_state='uncertain' THEN 'Provider outcome is unknown; inspect the individual review and source receipt.'
        ELSE outcome_detail END WHERE batch_id=p_batch_id AND ordinal=p_ordinal;
  END IF;
  RETURN v_state;
END $$;

CREATE VIEW public.email_operations_history WITH(security_invoker=true,security_barrier=true) AS
WITH raw AS (
 SELECT 'log:'||l.id::text AS id,coalesce(l.resend_id,'business:'||l.idempotency_key,'log:'||l.id::text) AS dispatch_key,
 l.resend_id AS provider_message_id,l.template_key,l.subject,l.retained_text AS body_text,l.retained_html AS body_html,
 l.to_email AS recipient_email,nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),'') AS recipient_name,
 l.actual_cc AS cc,l.status::text AS source_status,l.sent_at,l.created_at,l.error_message AS reason,
 NULL::text AS review_id,NULL::text AS opportunity_id,l.repreneur_id::text AS repreneur_id,
 CASE WHEN p.is_demo THEN 'DEMO' ELSE 'REAL' END AS namespace,l.tracking_verified,
 l.delivered_at IS NOT NULL AS delivered,l.opened_at IS NOT NULL AS opened,l.clicked_at IS NOT NULL AS clicked,
 l.bounced_at IS NOT NULL OR l.status='bounced' AS bounced,10 AS priority
 FROM public.email_logs l LEFT JOIN public.repreneurs p ON p.id=l.repreneur_id
 UNION ALL
 SELECT 'review:'||r.id::text,coalesce(r.provider_message_id,'business:'||r.business_operation_key,'review:'||r.id::text),
 r.provider_message_id,r.template_key,r.subject,r.body_text,r.retained_html,r.recipient_email,
 nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),r.provider_cc,r.state,
 CASE WHEN r.state='sent' AND r.provider_message_id IS NOT NULL THEN r.outcome_at ELSE NULL END,r.created_at,r.delivery_error,
 r.id::text,r.opportunity_id::text,r.repreneur_id::text,r.namespace,r.tracking_verified,false,false,false,false,30
 FROM public.staff_email_reviews r LEFT JOIN public.repreneurs p ON p.id=r.repreneur_id
 UNION ALL
 SELECT 'ma:'||i.id::text,coalesce(i.provider_message_id,'review:'||r.id::text,'ma:'||i.id::text),
 i.provider_message_id,i.template_key,i.title,i.body_markdown,NULL::text,i.recipient_email_snapshot,NULL::text,NULL::jsonb,
 i.delivery_status::text,CASE WHEN i.delivery_status='sent' AND i.provider_message_id IS NOT NULL THEN i.sent_at ELSE NULL END,
 i.created_at,i.delivery_error,r.id::text,i.opportunity_id::text,NULL::text,CASE WHEN o.is_demo THEN 'DEMO' ELSE 'REAL' END,
 false,false,false,false,false,20
 FROM public.ma_interactions i LEFT JOIN public.opportunities o ON o.id=i.opportunity_id
 LEFT JOIN public.staff_email_reviews r ON r.source_operation_id=i.client_operation_key AND r.source_kind='ma'
 WHERE i.channel='email' AND i.direction='outbound' AND i.delivery_status IS NOT NULL
 UNION ALL
 SELECT 'handoff:'||h.id::text,coalesce(h.provider_message_id,'review:'||r.id::text,'handoff:'||h.id::text),
 h.provider_message_id,CASE WHEN h.handoff_type='e6' THEN 'code:e6_nda_ready' ELSE 'ma_nda_info_memo_request' END,
 NULL::text,NULL::text,NULL::text,coalesce(r.recipient_email,mi.recipient_email_snapshot,CASE WHEN h.handoff_type='e6' THEN p.email END),
 CASE WHEN h.handoff_type='e6' THEN nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),'') END,NULL::jsonb,h.delivery_status::text,
 h.sent_at,h.created_at,h.delivery_error,r.id::text,m.opportunity_id::text,m.repreneur_id::text,
 CASE WHEN o.is_demo THEN 'DEMO' ELSE 'REAL' END,false,false,false,false,false,5
 FROM public.opportunity_pursuit_handoff_deliveries h
 LEFT JOIN public.ma_interactions mi ON mi.id=h.ma_interaction_id
 JOIN public.opportunity_matches m ON m.id=h.match_id LEFT JOIN public.repreneurs p ON p.id=m.repreneur_id
 LEFT JOIN public.opportunities o ON o.id=m.opportunity_id
 LEFT JOIN public.staff_email_reviews r ON r.source_operation_id=h.upstream_evidence_id AND r.source_kind=h.handoff_type
), event_actors AS (
 SELECT e.provider_message_id,e.event_type,CASE
 WHEN e.recipient_kind<>'unknown' THEN e.recipient_kind
 WHEN e.recipient_email IS NOT NULL AND e.recipient_email=lower(btrim(message.recipient_email)) THEN 'primary'
 WHEN e.recipient_email IS NOT NULL AND message.cc ? e.recipient_email THEN 'copy'
 ELSE 'unknown' END AS recipient_kind
 FROM public.email_provider_events e LEFT JOIN LATERAL (
   SELECT r.recipient_email,r.cc FROM raw r WHERE r.provider_message_id=e.provider_message_id ORDER BY priority DESC LIMIT 1
 ) message ON true
), facts AS (
 SELECT provider_message_id,
 bool_or(event_type='email.delivered' AND recipient_kind='primary') AS delivered,
 bool_or(event_type='email.opened') AS opened,bool_or(event_type='email.clicked') AS clicked,
 bool_or(event_type='email.bounced' AND recipient_kind='primary') AS bounced,
 bool_or(event_type='email.complained' AND recipient_kind='primary') AS complained,
 bool_or(event_type='email.delivery_delayed' AND recipient_kind='primary') AS delayed,
 bool_or(event_type='email.suppressed' AND recipient_kind='primary') AS suppressed,
 bool_or(event_type='email.failed' AND recipient_kind='primary') AS rejected
 FROM event_actors GROUP BY provider_message_id
), numbered AS (
 SELECT raw.*,row_number() OVER(PARTITION BY dispatch_key ORDER BY priority DESC,id DESC) AS duplicate_rank,
 bool_or(delivered) OVER(PARTITION BY dispatch_key) AS retained_delivered,
 bool_or(opened) OVER(PARTITION BY dispatch_key) AS retained_opened,
 bool_or(clicked) OVER(PARTITION BY dispatch_key) AS retained_clicked,
 bool_or(bounced) OVER(PARTITION BY dispatch_key) AS retained_bounced
 FROM raw
)
SELECT n.id,n.provider_message_id,n.template_key,n.subject,n.body_text,n.body_html,n.recipient_email,n.recipient_name,n.cc,
 n.source_status,n.sent_at,n.created_at,n.reason,n.review_id,n.opportunity_id,n.repreneur_id,n.namespace,n.tracking_verified,
 coalesce(f.delivered,false) OR n.retained_delivered AS delivered,
 coalesce(f.opened,false) OR n.retained_opened AS opened,coalesce(f.clicked,false) OR n.retained_clicked AS clicked,
 coalesce(f.bounced,false) OR n.retained_bounced AS bounced,
 CASE WHEN f.complained THEN 'complained' WHEN f.bounced OR n.retained_bounced THEN 'bounced'
 WHEN f.suppressed THEN 'suppressed' WHEN f.rejected THEN 'rejected' WHEN f.delayed AND NOT (f.delivered OR n.retained_delivered) THEN 'delayed'
 WHEN n.source_status IN ('uncertain','sending','pending') THEN n.source_status
 WHEN n.source_status IN ('failed','rejected') THEN 'rejected'
 WHEN f.clicked OR n.retained_clicked THEN 'clicked' WHEN f.opened OR n.retained_opened THEN 'opened'
 WHEN f.delivered OR n.retained_delivered THEN 'delivered' ELSE n.source_status END AS status,
 CASE WHEN n.template_key LIKE 'ma_%' OR n.template_key LIKE 'code:%'
 OR n.template_key ~ 'opportunity|recommendation|interest|memo' THEN 'ma'
 WHEN n.template_key IN ('welcome','form_step_complete','abandoned_reminder','thank_you','high_score_alert','booking_reminder') THEN 'intake'
 WHEN n.template_key IN ('offer_received','offer_accepted','offer_activated','milestone_completed') THEN 'offer'
 ELSE 'status' END AS category,
 lower(concat_ws(' ',n.subject,n.recipient_email,n.recipient_name,n.template_key,n.source_status,
 CASE WHEN f.bounced OR n.retained_bounced THEN 'bounced' END,
 CASE WHEN f.suppressed THEN 'suppressed' END,CASE WHEN f.rejected THEN 'rejected' END,
 CASE WHEN f.delayed THEN 'delayed' END,CASE WHEN f.clicked OR n.retained_clicked THEN 'clicked' END,
 CASE WHEN f.opened OR n.retained_opened THEN 'opened' END,CASE WHEN f.delivered OR n.retained_delivered THEN 'delivered' END)) AS search_text
FROM numbered n LEFT JOIN facts f ON f.provider_message_id=n.provider_message_id WHERE duplicate_rank=1;
REVOKE ALL ON public.email_operations_history FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.email_operations_history TO service_role;
-- New provider facts follow the retained operational source's existing
-- deletion boundary. This is not a historic purge or a new retention clock.
CREATE FUNCTION public.email_provider_source_deleted() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_provider_id text;
BEGIN
 v_provider_id:=CASE WHEN TG_TABLE_NAME='email_logs' THEN to_jsonb(OLD)->>'resend_id' ELSE to_jsonb(OLD)->>'provider_message_id' END;
 IF v_provider_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.email_operations_history WHERE provider_message_id=v_provider_id) THEN
 DELETE FROM public.email_provider_events WHERE provider_message_id=v_provider_id;
 END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER email_provider_source_deleted AFTER DELETE ON public.email_logs FOR EACH ROW EXECUTE FUNCTION public.email_provider_source_deleted();
CREATE TRIGGER email_provider_source_deleted AFTER DELETE ON public.staff_email_reviews FOR EACH ROW EXECUTE FUNCTION public.email_provider_source_deleted();
CREATE TRIGGER email_provider_source_deleted AFTER DELETE ON public.ma_interactions FOR EACH ROW EXECUTE FUNCTION public.email_provider_source_deleted();
CREATE TRIGGER email_provider_source_deleted AFTER DELETE ON public.opportunity_pursuit_handoff_deliveries FOR EACH ROW EXECUTE FUNCTION public.email_provider_source_deleted();
REVOKE ALL ON FUNCTION public.email_provider_source_deleted() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.email_operations_analytics(p_from timestamptz,p_to timestamptz)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH cohort AS(SELECT * FROM public.email_operations_history
 WHERE namespace='REAL' AND sent_at>=p_from AND sent_at<p_to AND provider_message_id IS NOT NULL
 AND subject NOT LIKE '[TEST]%' AND template_key NOT IN ('portal_access_setup','password_reset')),
 daily AS(SELECT (sent_at AT TIME ZONE 'Europe/Paris')::date AS date,count(*) AS count FROM cohort GROUP BY 1),
 categories AS(SELECT category,count(*) AS count FROM cohort GROUP BY 1)
 SELECT jsonb_build_object('totalSent',count(*),'totalDelivered',count(*) FILTER(WHERE delivered),
 'totalBounced',count(*) FILTER(WHERE bounced),'totalOpened',count(*) FILTER(WHERE opened AND delivered AND tracking_verified),
 'totalClicked',count(*) FILTER(WHERE clicked AND delivered AND tracking_verified),
 'coveredDelivered',count(*) FILTER(WHERE delivered AND tracking_verified),'uncoveredSent',count(*) FILTER(WHERE NOT tracking_verified),
 'daily',coalesce((SELECT jsonb_agg(to_jsonb(daily) ORDER BY date) FROM daily),'[]'::jsonb),
 'categories',coalesce((SELECT jsonb_agg(to_jsonb(categories)) FROM categories),'[]'::jsonb)) FROM cohort;
$$;
REVOKE ALL ON FUNCTION public.email_operations_analytics(timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_operations_analytics(timestamptz,timestamptz) TO service_role;
COMMIT;
