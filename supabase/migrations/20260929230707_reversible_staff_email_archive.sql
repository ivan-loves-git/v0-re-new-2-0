-- #221 / #223: reversible shelving is separate from delivery state and parent retention.
-- Existing rows stay active. No source operation, envelope, clock or receipt is rewritten.
BEGIN;

ALTER TABLE public.staff_email_reviews
  ADD COLUMN archived_at timestamptz,
  ADD COLUMN archived_by text,
  ADD COLUMN restored_at timestamptz,
  ADD COLUMN restored_by text,
  ADD CONSTRAINT staff_email_reviews_archive_actor_time CHECK ((archived_at IS NULL) = (archived_by IS NULL)),
  ADD CONSTRAINT staff_email_reviews_restore_actor_time CHECK ((restored_at IS NULL) = (restored_by IS NULL));
CREATE INDEX staff_email_reviews_archive_idx ON public.staff_email_reviews (archived_at, created_at DESC, id DESC);

ALTER TABLE public.staff_email_review_events DROP CONSTRAINT staff_email_review_events_event_kind_check;
ALTER TABLE public.staff_email_review_events ADD CONSTRAINT staff_email_review_events_event_kind_check
  CHECK (event_kind IN ('prepared','edited','refreshed','approved','sending','sent','failed','uncertain','cancelled','archived','restored'));

-- The existing receipt and queue finalizers distinguish conclusively failed
-- attempts from uncertainty. Recheck their source record under the review lock.
CREATE FUNCTION public.staff_email_review_archive_source_clear(p_review_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.staff_email_reviews%ROWTYPE; v_source_status text; v_provider_id text;
  v_source_count integer; v_prior_uncertain boolean;
BEGIN
  SELECT * INTO v FROM public.staff_email_reviews WHERE id=p_review_id;
  IF v.id IS NULL OR v.state NOT IN ('pending','failed') THEN RETURN false; END IF;
  IF v.provider_message_id IS NOT NULL OR v.delivery_evidence_id IS NOT NULL THEN RETURN false; END IF;
  IF v.state='pending' AND v.attempted_payload IS NOT NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.ma_source_email_send_reservations reservation
    WHERE reservation.opportunity_id=v.opportunity_id AND reservation.expires_at>now()) THEN RETURN false; END IF;
  SELECT EXISTS (SELECT 1 FROM public.staff_email_review_events event
    WHERE event.review_id=v.id AND event.event_kind='uncertain') INTO v_prior_uncertain;

  IF v.source_kind='ma' THEN
    SELECT count(*), max(interaction.delivery_status), max(interaction.provider_message_id)
      INTO v_source_count,v_source_status,v_provider_id
    FROM public.ma_interactions interaction WHERE interaction.client_operation_key=v.source_operation_id;
    IF v_source_count>1 OR v_provider_id IS NOT NULL THEN RETURN false; END IF;
    IF v_source_count=1 AND NOT EXISTS (SELECT 1 FROM public.ma_interactions interaction
      WHERE interaction.client_operation_key=v.source_operation_id
        AND interaction.opportunity_id=v.opportunity_id
        AND interaction.template_key=v.template_key
        AND interaction.recipient_email_snapshot=v.recipient_email
        AND interaction.channel='email' AND interaction.direction='outbound') THEN RETURN false; END IF;
  ELSIF v.source_kind IN ('e4','e6','e7') THEN
    SELECT count(*), max(delivery.delivery_status), max(delivery.provider_message_id)
      INTO v_source_count,v_source_status,v_provider_id
    FROM public.opportunity_pursuit_handoff_deliveries delivery
    WHERE delivery.upstream_evidence_id=v.source_operation_id AND delivery.handoff_type=v.source_kind;
    IF v_source_count>1 OR v_provider_id IS NOT NULL THEN RETURN false; END IF;
    IF v_source_count=1 AND NOT EXISTS (SELECT 1 FROM public.opportunity_pursuit_handoff_deliveries delivery
      WHERE delivery.upstream_evidence_id=v.source_operation_id AND delivery.handoff_type=v.source_kind
        AND delivery.match_id=v.match_id) THEN RETURN false; END IF;
  ELSIF v.source_kind='freshness' THEN
    SELECT count(*), max(delivery.delivery_status), max(delivery.provider_message_id)
      INTO v_source_count,v_source_status,v_provider_id
    FROM public.opportunity_freshness_deliveries delivery WHERE delivery.review_id=v.id;
    IF v_source_count>1 OR v_provider_id IS NOT NULL THEN RETURN false; END IF;
  ELSE RETURN false;
  END IF;

  IF v.state='pending' THEN RETURN v_source_count=0; END IF;
  -- A prior unknown provider outcome can become eligible only when the
  -- source ledger itself has a conclusive failed result. Freshness never
  -- downgrades an uncertain result to failed in its existing finalizer.
  IF v_prior_uncertain AND v_source_status IS DISTINCT FROM 'failed' THEN RETURN false; END IF;
  RETURN coalesce(v_source_status='failed',false) OR (v_source_count=0 AND NOT v_prior_uncertain);
END $$;

CREATE FUNCTION public.staff_email_review_archive(p_review_id uuid,p_version integer,p_actor text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.staff_email_reviews%ROWTYPE; v_version integer; v_opportunity_id uuid;
BEGIN
  PERFORM public.staff_email_review_assert_actor(p_actor);
  SELECT opportunity_id INTO v_opportunity_id FROM public.staff_email_reviews WHERE id=p_review_id;
  IF v_opportunity_id IS NULL THEN RAISE EXCEPTION 'staff_email_review_stale_or_not_archivable'; END IF;
  -- MA's source reservation and begin RPCs lock the parent first. Use the
  -- same order so reserve-first waits finish before this source check; no
  -- parent/review lock inversion can turn that case into a deadlock victim.
  PERFORM 1 FROM public.opportunities WHERE id=v_opportunity_id FOR UPDATE;
  SELECT * INTO v FROM public.staff_email_reviews WHERE id=p_review_id FOR UPDATE;
  IF v.id IS NULL OR v.opportunity_id IS DISTINCT FROM v_opportunity_id
    OR v.version<>p_version OR v.archived_at IS NOT NULL
    OR NOT public.staff_email_review_archive_source_clear(p_review_id)
  THEN RAISE EXCEPTION 'staff_email_review_stale_or_not_archivable'; END IF;
  PERFORM set_config('wave.staff_email_archive_mutation',p_review_id::text,true);
  UPDATE public.staff_email_reviews SET archived_at=now(),archived_by=p_actor,version=version+1
    WHERE id=p_review_id RETURNING version INTO v_version;
  INSERT INTO public.staff_email_review_events(review_id,event_kind,actor,version)
    VALUES(p_review_id,'archived',p_actor,v_version);
  RETURN v_version;
END $$;

CREATE FUNCTION public.staff_email_review_restore(p_review_id uuid,p_version integer,p_actor text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.staff_email_reviews%ROWTYPE; v_version integer;
BEGIN
  PERFORM public.staff_email_review_assert_actor(p_actor);
  SELECT * INTO v FROM public.staff_email_reviews WHERE id=p_review_id FOR UPDATE;
  IF v.id IS NULL OR v.version<>p_version OR v.archived_at IS NULL
    OR NOT public.staff_email_review_archive_source_clear(p_review_id)
  THEN RAISE EXCEPTION 'staff_email_review_stale_or_not_restorable'; END IF;
  PERFORM set_config('wave.staff_email_archive_mutation',p_review_id::text,true);
  UPDATE public.staff_email_reviews SET archived_at=NULL,archived_by=NULL,
    restored_at=now(),restored_by=p_actor,version=version+1
    WHERE id=p_review_id RETURNING version INTO v_version;
  INSERT INTO public.staff_email_review_events(review_id,event_kind,actor,version)
    VALUES(p_review_id,'restored',p_actor,v_version);
  RETURN v_version;
END $$;

-- Existing RPCs and older application builds still update this same row.
-- Only the versioned archive/restore RPCs may change the shelf marker.
CREATE FUNCTION public.staff_email_review_archive_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.archived_at IS DISTINCT FROM NEW.archived_at THEN
    IF current_setting('wave.staff_email_archive_mutation',true) IS DISTINCT FROM OLD.id::text
    THEN RAISE EXCEPTION 'staff_email_review_archive_rpc_required'; END IF;
  ELSIF OLD.archived_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'staff_email_review_archived';
  END IF;
  IF NEW.archived_at IS NOT NULL AND NEW.state NOT IN ('pending','failed')
  THEN RAISE EXCEPTION 'staff_email_review_archived_cannot_send'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER staff_email_review_archive_guard BEFORE UPDATE ON public.staff_email_reviews
  FOR EACH ROW EXECUTE FUNCTION public.staff_email_review_archive_guard();

-- Provider-entry records are guarded even when an older app skips the queue
-- action. Read the exact review FOR UPDATE so archive-first and send-first
-- cannot both pass using an uncommitted marker.
CREATE FUNCTION public.staff_email_review_archive_guard_source()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_kind text; v_source uuid; v_archived_at timestamptz;
BEGIN
  IF TG_TABLE_NAME='ma_interactions' THEN
    IF NEW.channel<>'email' OR NEW.direction<>'outbound' OR NEW.delivery_status<>'pending' THEN RETURN NEW; END IF;
    v_kind:='ma'; v_source:=NEW.client_operation_key;
  ELSIF TG_TABLE_NAME='ma_interaction_delivery_events' THEN
    IF NEW.event_kind<>'pending' THEN RETURN NEW; END IF;
    SELECT interaction.client_operation_key INTO v_source FROM public.ma_interactions interaction
      WHERE interaction.id=NEW.interaction_id;
    v_kind:='ma';
  ELSIF TG_TABLE_NAME='opportunity_pursuit_handoff_deliveries' THEN
    IF NEW.delivery_status<>'sending' THEN RETURN NEW; END IF;
    v_kind:=NEW.handoff_type; v_source:=NEW.upstream_evidence_id;
  ELSIF TG_TABLE_NAME='opportunity_freshness_deliveries' THEN
    IF NEW.delivery_status<>'pending' THEN RETURN NEW; END IF;
    SELECT review.archived_at INTO v_archived_at FROM public.staff_email_reviews review
      WHERE review.id=NEW.review_id FOR UPDATE;
    IF v_archived_at IS NOT NULL THEN RAISE EXCEPTION 'staff_email_review_archived_cannot_send'; END IF;
    RETURN NEW;
  END IF;
  IF v_source IS NULL THEN RETURN NEW; END IF;
  SELECT review.archived_at INTO v_archived_at FROM public.staff_email_reviews review
    WHERE review.source_kind=v_kind AND review.source_operation_id=v_source FOR UPDATE;
  IF v_archived_at IS NOT NULL THEN RAISE EXCEPTION 'staff_email_review_archived_cannot_send'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER staff_email_archive_guard_ma_begin BEFORE INSERT OR UPDATE OF delivery_status,client_operation_key
  ON public.ma_interactions FOR EACH ROW EXECUTE FUNCTION public.staff_email_review_archive_guard_source();
CREATE TRIGGER staff_email_archive_guard_ma_replay BEFORE INSERT
  ON public.ma_interaction_delivery_events FOR EACH ROW EXECUTE FUNCTION public.staff_email_review_archive_guard_source();
CREATE TRIGGER staff_email_archive_guard_handoff BEFORE INSERT OR UPDATE OF delivery_status,attempt_count,last_attempt_at
  ON public.opportunity_pursuit_handoff_deliveries FOR EACH ROW EXECUTE FUNCTION public.staff_email_review_archive_guard_source();
CREATE TRIGGER staff_email_archive_guard_freshness BEFORE INSERT OR UPDATE OF delivery_status,attempted_at
  ON public.opportunity_freshness_deliveries FOR EACH ROW EXECUTE FUNCTION public.staff_email_review_archive_guard_source();

-- Keep the existing queue columns and order; append only the archive marker
-- so old readers remain compatible while new readers can filter on it.
CREATE OR REPLACE VIEW public.staff_email_review_queue
  WITH (security_invoker = true, security_barrier = true) AS
WITH identified AS (
  SELECT review.id, review.source_kind, review.template_key, review.subject,
    left(regexp_replace(review.body_text, '[[:space:]]+', ' ', 'g'), 320) AS body_preview,
    review.recipient_email, review.namespace, review.state, review.version, review.created_at,
    CASE WHEN review.source_kind='e6'
      THEN nullif(btrim(concat_ws(' ', repreneur.first_name,repreneur.last_name)), '')
      ELSE nullif(btrim(contact.display_name), '') END AS recipient_name,
    CASE WHEN review.source_kind='e6' THEN repreneur.avatar_url ELSE NULL END AS recipient_avatar_url,
    CASE WHEN review.source_kind='e6' THEN NULL ELSE nullif(btrim(firm.name), '') END AS company_name,
    CASE WHEN review.source_kind='freshness' THEN 'source_freshness'
      WHEN review.source_kind='e4' THEN 'e4_qualification'
      WHEN review.source_kind='e6' THEN 'e6_nda_ready'
      WHEN review.source_kind='e7' THEN 'e7_signed_copies'
      WHEN review.template_key='ma_opportunity_validity_check' THEN 'ma_validity_check'
      WHEN review.template_key='ma_request_more_information' THEN 'ma_more_information'
      WHEN review.template_key='ma_repreneur_interest_feedback' THEN 'ma_interest_feedback'
      WHEN review.template_key='ma_nda_info_memo_request' THEN 'ma_nda_memo_request'
      WHEN review.template_key='ma_process_follow_up' THEN 'ma_process_follow_up'
      ELSE 'ma_other' END AS purpose_key,
    review.body_text, review.archived_at
  FROM public.staff_email_reviews review
  LEFT JOIN public.opportunity_ma_contacts contact_link ON contact_link.id=review.contact_link_id
  LEFT JOIN public.ma_contact_office_affiliations affiliation ON affiliation.id=contact_link.affiliation_id
  LEFT JOIN public.ma_contacts contact ON contact.id=affiliation.contact_id
  LEFT JOIN public.ma_offices office ON office.id=affiliation.office_id
  LEFT JOIN public.ma_firms firm ON firm.id=office.firm_id
  LEFT JOIN public.opportunity_matches match_row ON match_row.id=review.match_id AND review.source_kind='e6'
  LEFT JOIN public.repreneurs repreneur ON repreneur.id=match_row.repreneur_id
), named AS (
  SELECT identified.*,
    CASE purpose_key
      WHEN 'source_freshness' THEN 'Source freshness'
      WHEN 'e4_qualification' THEN 'E4 qualification'
      WHEN 'e6_nda_ready' THEN 'E6 NDA ready'
      WHEN 'e7_signed_copies' THEN 'E7 signed copies'
      WHEN 'ma_validity_check' THEN 'Validity check'
      WHEN 'ma_more_information' THEN 'More information'
      WHEN 'ma_interest_feedback' THEN 'Interest feedback'
      WHEN 'ma_nda_memo_request' THEN 'NDA and memo request'
      WHEN 'ma_process_follow_up' THEN 'Process follow-up'
      ELSE 'Other M&A email' END AS purpose_label
  FROM identified
)
SELECT id,source_kind,template_key,subject,body_preview,recipient_email,
  namespace,state,version,created_at,recipient_name,recipient_avatar_url,
  company_name,purpose_key,purpose_label,
  lower(subject) AS message_sort,
  lower(purpose_label) AS purpose_sort,
  lower(coalesce(recipient_name,recipient_email)) AS recipient_sort,
  lower(coalesce(company_name,'')) AS company_sort,
  lower(concat_ws(' ',subject,body_text,recipient_email,recipient_name,
    company_name,purpose_label,template_key)) AS search_text,
  archived_at,
  public.staff_email_review_archive_source_clear(id) AS archive_eligible
FROM named;
REVOKE ALL ON public.staff_email_review_queue FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.staff_email_review_queue TO service_role;

REVOKE ALL ON FUNCTION public.staff_email_review_archive_source_clear(uuid),
  public.staff_email_review_archive(uuid,integer,text),public.staff_email_review_restore(uuid,integer,text),
  public.staff_email_review_archive_guard(),public.staff_email_review_archive_guard_source()
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.staff_email_review_archive(uuid,integer,text),
  public.staff_email_review_restore(uuid,integer,text),
  public.staff_email_review_archive_source_clear(uuid) TO service_role;

COMMIT;
