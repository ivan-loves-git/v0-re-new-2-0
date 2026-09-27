-- #187 / Decision #182. Additive, service-only freshness episodes in the #186 queue.
-- Apply after 121-125. Migration 128 belongs to a different, unapplied lane.
BEGIN;

ALTER TABLE public.staff_email_reviews DROP CONSTRAINT staff_email_reviews_source_kind_check;
ALTER TABLE public.staff_email_reviews ADD CONSTRAINT staff_email_reviews_source_kind_check
  CHECK (source_kind IN ('ma', 'e4', 'e6', 'e7', 'freshness'));
ALTER TABLE public.staff_email_reviews DROP CONSTRAINT staff_email_reviews_handoff_binding;
ALTER TABLE public.staff_email_reviews ADD CONSTRAINT staff_email_reviews_handoff_binding CHECK (
  (source_kind IN ('ma', 'freshness') AND match_id IS NULL AND upstream_evidence_id IS NULL AND contact_link_id IS NOT NULL)
  OR (source_kind = 'e6' AND match_id IS NOT NULL AND upstream_evidence_id = source_operation_id AND contact_link_id IS NULL)
  OR (source_kind IN ('e4', 'e7') AND match_id IS NOT NULL AND upstream_evidence_id = source_operation_id AND contact_link_id IS NOT NULL)
);
ALTER TABLE public.staff_email_review_events DROP CONSTRAINT staff_email_review_events_event_kind_check;
ALTER TABLE public.staff_email_review_events ADD CONSTRAINT staff_email_review_events_event_kind_check
  CHECK (event_kind IN ('prepared','edited','refreshed','approved','sending','sent','failed','uncertain','cancelled'));

CREATE TABLE public.opportunity_freshness_members (
  review_id uuid NOT NULL REFERENCES public.staff_email_reviews(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  episode_key text NOT NULL CHECK (length(episode_key) > 0),
  contact_id uuid NOT NULL REFERENCES public.ma_contacts(id) ON DELETE RESTRICT,
  contact_link_id uuid NOT NULL REFERENCES public.opportunity_ma_contacts(id) ON DELETE RESTRICT,
  affiliation_id uuid NOT NULL REFERENCES public.ma_contact_office_affiliations(id) ON DELETE RESTRICT,
  source_office_id uuid NOT NULL REFERENCES public.ma_offices(id) ON DELETE RESTRICT,
  frozen_member jsonb NOT NULL CHECK (jsonb_typeof(frozen_member) = 'object'),
  PRIMARY KEY (review_id, opportunity_id),
  UNIQUE (opportunity_id, episode_key)
);
CREATE INDEX opportunity_freshness_members_contact_idx ON public.opportunity_freshness_members(contact_id, review_id);

CREATE TABLE public.opportunity_freshness_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL UNIQUE REFERENCES public.staff_email_reviews(id) ON DELETE RESTRICT,
  provider_idempotency_key text NOT NULL UNIQUE,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  delivery_status text NOT NULL CHECK (delivery_status IN ('pending', 'sent', 'failed')),
  provider_message_id text,
  delivery_error text,
  attempted_by text NOT NULL,
  attempted_at timestamptz NOT NULL,
  finalized_at timestamptz,
  CHECK (delivery_status <> 'sent' OR (provider_message_id IS NOT NULL AND finalized_at IS NOT NULL))
);

CREATE TABLE public.opportunity_freshness_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL,
  opportunity_id uuid NOT NULL,
  contact_id uuid NOT NULL REFERENCES public.ma_contacts(id) ON DELETE RESTRICT,
  outcome text NOT NULL CHECK (outcome IN ('confirmed_open', 'closed', 'paused', 'unclear')),
  reply_at timestamptz NOT NULL,
  evidence text NOT NULL CHECK (length(btrim(evidence)) >= 5),
  recorded_by text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (review_id, opportunity_id) REFERENCES public.opportunity_freshness_members(review_id, opportunity_id) ON DELETE RESTRICT,
  UNIQUE (review_id, opportunity_id, reply_at, outcome)
);
CREATE INDEX opportunity_freshness_replies_latest_idx
  ON public.opportunity_freshness_replies(opportunity_id, reply_at DESC, id DESC)
  WHERE outcome = 'confirmed_open';

ALTER TABLE public.opportunity_freshness_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_freshness_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_freshness_replies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.opportunity_freshness_members, public.opportunity_freshness_deliveries, public.opportunity_freshness_replies FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.opportunity_freshness_members, public.opportunity_freshness_deliveries, public.opportunity_freshness_replies TO service_role;

-- A candidate is exact, source-office anchored and excludes ambiguous or
-- suppressed recipients. This read model never substitutes created_at.
CREATE FUNCTION public.opportunity_freshness_candidates(
  p_contact_id uuid DEFAULT NULL, p_now timestamptz DEFAULT now(), p_exclude_recorded boolean DEFAULT true,
  p_ignore_review uuid DEFAULT NULL
) RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
WITH linked AS (
  SELECT o.id opportunity_id, o.reference, o.public_title, o.sector, o.source_office_id,
    o.date_added, o.date_added_precision, office.name office_name, firm.name firm_name,
    link.id contact_link_id, link.affiliation_id, link.is_primary, affiliation.contact_id,
    contact.display_name contact_name, contact.status contact_status,
    lower(btrim(contact.email)) recipient_email,
    count(*) OVER (PARTITION BY o.id) link_count,
    count(*) FILTER (WHERE link.is_primary) OVER (PARTITION BY o.id) primary_count
  FROM public.opportunities o
  JOIN public.ma_offices office ON office.id=o.source_office_id AND office.status='active'
  JOIN public.ma_firms firm ON firm.id=office.firm_id AND firm.status<>'archived'
  JOIN public.opportunity_ma_contacts link ON link.opportunity_id=o.id AND link.is_active AND link.removed_at IS NULL
  JOIN public.ma_contact_office_affiliations affiliation ON affiliation.id=link.affiliation_id
    AND affiliation.office_id=o.source_office_id AND affiliation.is_active AND affiliation.ended_at IS NULL
  JOIN public.ma_contacts contact ON contact.id=affiliation.contact_id
  WHERE o.status='active' AND NOT o.is_demo
    AND o.source_identity_to_verify IS NOT TRUE
    AND NOT public.ma_opportunity_source_review_required(o.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.opportunity_matches match
      JOIN public.repreneurs rep ON rep.id=match.repreneur_id
      WHERE match.opportunity_id=o.id AND match.status='active_pursuit' AND NOT rep.is_demo
    )
), chosen AS (
  SELECT linked.* FROM linked
  WHERE (link_count=1 OR (primary_count=1 AND is_primary))
    AND (p_contact_id IS NULL OR contact_id=p_contact_id)
    AND contact_status='active'
    AND recipient_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
), clocked AS (
  SELECT chosen.*, last_positive.id confirmation_id, last_positive.reply_at confirmation_at,
    CASE WHEN last_positive.id IS NOT NULL THEN last_positive.id::text ELSE 'initial' END episode_key,
    CASE WHEN last_positive.id IS NOT NULL THEN 'confirmed_open'
      WHEN chosen.date_added_precision='day' THEN 'recorded_source_day'
      ELSE 'older_inventory_no_confirmation' END basis,
    CASE WHEN last_positive.id IS NOT NULL THEN (p_now AT TIME ZONE 'UTC')::date - (last_positive.reply_at AT TIME ZONE 'UTC')::date
      WHEN chosen.date_added_precision='month' THEN (p_now AT TIME ZONE 'UTC')::date -
        ((date_trunc('month',chosen.date_added::timestamp) + interval '1 month - 1 day')::date)
      ELSE (p_now AT TIME ZONE 'UTC')::date - chosen.date_added::date END age_days
  FROM chosen
  LEFT JOIN LATERAL (
    SELECT reply.id, reply.reply_at FROM public.opportunity_freshness_replies reply
    WHERE reply.opportunity_id=chosen.opportunity_id AND reply.outcome='confirmed_open'
    ORDER BY reply.reply_at DESC, reply.id DESC LIMIT 1
  ) last_positive ON true
)
SELECT jsonb_build_object(
  'opportunity_id', c.opportunity_id, 'reference', c.reference,
  'title', coalesce(nullif(btrim(c.public_title),''),nullif(btrim(c.sector),''),c.reference),
  'source_office_id', c.source_office_id, 'office_name', c.office_name, 'firm_name', c.firm_name,
  'contact_link_id', c.contact_link_id, 'affiliation_id', c.affiliation_id,
  'contact_id', c.contact_id, 'contact_name', c.contact_name, 'recipient_email', c.recipient_email,
  'date_added', c.date_added, 'date_added_precision', c.date_added_precision,
  'confirmation_id', c.confirmation_id, 'confirmation_at', c.confirmation_at,
  'episode_key', c.episode_key, 'basis', c.basis
)
FROM clocked c
WHERE c.age_days >= 45
  AND (c.confirmation_id IS NOT NULL OR c.date_added IS NOT NULL)
  AND public.ma_contact_email_is_allowed(c.contact_id,c.opportunity_id,'opportunity_general'::public.ma_contact_email_purpose)
  AND NOT public.ma_contact_email_address_is_suppressed(c.recipient_email)
  AND NOT EXISTS (
    SELECT 1 FROM public.ma_interactions interaction
    WHERE interaction.opportunity_id=c.opportunity_id
      AND ((interaction.channel='email' AND interaction.direction='outbound'
          AND (interaction.delivery_status='pending' OR
            (interaction.delivery_status='sent' AND interaction.occurred_at >= p_now - interval '45 days')))
        OR (interaction.direction='inbound' AND interaction.occurred_at >= p_now - interval '45 days'))
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.ma_source_email_send_reservations reservation
    WHERE reservation.opportunity_id=c.opportunity_id AND reservation.expires_at>p_now
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.opportunity_freshness_replies reply
    WHERE reply.opportunity_id=c.opportunity_id AND reply.reply_at >= p_now - interval '45 days'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.staff_email_reviews review
    LEFT JOIN public.opportunity_freshness_members member ON member.review_id=review.id
    WHERE (review.opportunity_id=c.opportunity_id OR member.opportunity_id=c.opportunity_id)
      AND review.id IS DISTINCT FROM p_ignore_review
      AND review.state IN ('sending','uncertain')
  )
  AND (NOT p_exclude_recorded OR NOT EXISTS (
    SELECT 1 FROM public.opportunity_freshness_members member
    WHERE member.opportunity_id=c.opportunity_id AND member.episode_key=c.episode_key
  ));
$$;

CREATE FUNCTION public.opportunity_freshness_due_contacts(p_limit integer DEFAULT 30)
RETURNS TABLE(contact_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT DISTINCT (candidate->>'contact_id')::uuid
  FROM public.opportunity_freshness_candidates(NULL,now(),true,NULL) candidate
  ORDER BY 1 LIMIT greatest(1,least(p_limit,100));
$$;

CREATE FUNCTION public.opportunity_freshness_latest_confirmations(p_opportunity_ids uuid[])
RETURNS TABLE(opportunity_id uuid, confirmation_id uuid, confirmed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT DISTINCT ON (reply.opportunity_id) reply.opportunity_id,reply.id,reply.reply_at
  FROM public.opportunity_freshness_replies reply
  WHERE reply.opportunity_id=ANY(p_opportunity_ids) AND reply.outcome='confirmed_open'
  ORDER BY reply.opportunity_id,reply.reply_at DESC,reply.id DESC;
$$;

CREATE FUNCTION public.opportunity_freshness_prepare(
  p_contact_id uuid, p_members jsonb, p_subject text, p_body text, p_template_version text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_current jsonb; v_first jsonb; v_review_id uuid; v_member jsonb; v_email text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('freshness-contact:' || p_contact_id::text,187));
  SELECT jsonb_agg(candidate ORDER BY candidate->>'opportunity_id') INTO v_current
  FROM public.opportunity_freshness_candidates(p_contact_id,now(),true,NULL) candidate;
  IF v_current IS NULL OR v_current IS DISTINCT FROM p_members
    OR nullif(btrim(p_subject),'') IS NULL OR nullif(btrim(p_body),'') IS NULL
    OR nullif(btrim(p_template_version),'') IS NULL THEN
    RAISE EXCEPTION 'freshness_members_changed_before_preparation';
  END IF;
  v_first := v_current->0; v_email := v_first->>'recipient_email';
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_current) item WHERE item->>'recipient_email' IS DISTINCT FROM v_email)
  THEN RAISE EXCEPTION 'freshness_group_recipient_mismatch'; END IF;
  INSERT INTO public.staff_email_reviews(
    source_kind,source_operation_id,opportunity_id,contact_link_id,recipient_email,
    namespace,template_key,template_version,subject,body_text,created_by
  ) VALUES (
    'freshness',gen_random_uuid(),(v_first->>'opportunity_id')::uuid,(v_first->>'contact_link_id')::uuid,
    v_email,'REAL','ma_opportunity_validity_check',p_template_version,btrim(p_subject),btrim(p_body),
    'system:opportunity-freshness'
  ) RETURNING id INTO v_review_id;
  FOR v_member IN SELECT value FROM jsonb_array_elements(v_current) LOOP
    INSERT INTO public.opportunity_freshness_members(
      review_id,opportunity_id,episode_key,contact_id,contact_link_id,affiliation_id,source_office_id,frozen_member
    ) VALUES (
      v_review_id,(v_member->>'opportunity_id')::uuid,v_member->>'episode_key',p_contact_id,
      (v_member->>'contact_link_id')::uuid,(v_member->>'affiliation_id')::uuid,
      (v_member->>'source_office_id')::uuid,v_member
    );
  END LOOP;
  INSERT INTO public.staff_email_review_events(review_id,event_kind,actor,version,detail)
  VALUES(v_review_id,'prepared','system:opportunity-freshness',1,jsonb_build_object('rule','opportunity-freshness-v1','members',jsonb_array_length(v_current)));
  RETURN v_review_id;
END $$;

CREATE FUNCTION public.opportunity_freshness_assert_current(p_review_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.staff_email_reviews%ROWTYPE; v_member public.opportunity_freshness_members%ROWTYPE; v_current jsonb;
BEGIN
  SELECT * INTO v FROM public.staff_email_reviews WHERE id=p_review_id;
  IF v.id IS NULL OR v.source_kind<>'freshness' OR v.namespace<>'REAL' THEN RAISE EXCEPTION 'freshness_review_unavailable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.opportunity_freshness_members WHERE review_id=p_review_id) THEN
    RAISE EXCEPTION 'freshness_review_has_no_members'; END IF;
  FOR v_member IN SELECT * FROM public.opportunity_freshness_members WHERE review_id=p_review_id ORDER BY opportunity_id LOOP
    SELECT candidate INTO v_current FROM public.opportunity_freshness_candidates(v_member.contact_id,now(),false,p_review_id) candidate
      WHERE candidate->>'opportunity_id'=v_member.opportunity_id::text;
    IF v_current IS NULL OR v_current IS DISTINCT FROM v_member.frozen_member
      OR v_current->>'recipient_email' IS DISTINCT FROM lower(btrim(v.recipient_email)) THEN
      RAISE EXCEPTION 'freshness_member_drift_requires_review';
    END IF;
  END LOOP;
END $$;

-- A short provider lease fences every exact member, not only the queue row's
-- anchor opportunity. Source/contact/pursuit edits wait on the same advisory
-- key and cannot commit between final preflight and provider I/O.
CREATE FUNCTION public.opportunity_freshness_lock_opportunity(p_opportunity_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('freshness-opportunity:' || p_opportunity_id::text,187));
END $$;

CREATE FUNCTION public.opportunity_freshness_assert_mutation_allowed(p_opportunity_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_opportunity_id IS NULL THEN RETURN; END IF;
  PERFORM public.opportunity_freshness_lock_opportunity(p_opportunity_id);
  IF EXISTS (
    SELECT 1 FROM public.opportunity_freshness_members member
    JOIN public.staff_email_reviews review ON review.id=member.review_id
    LEFT JOIN public.opportunity_freshness_deliveries delivery ON delivery.review_id=review.id
    WHERE member.opportunity_id=p_opportunity_id AND review.state='sending'
      AND coalesce(delivery.attempted_at,review.attempted_at)>now()-interval '2 minutes'
  ) THEN RAISE EXCEPTION 'freshness_member_send_lease_blocks_change'; END IF;
END $$;

CREATE FUNCTION public.opportunity_freshness_guard_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_opportunity_id uuid;
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.source_kind<>'freshness' THEN PERFORM public.opportunity_freshness_lock_opportunity(NEW.opportunity_id); END IF;
    IF NEW.source_kind<>'freshness' AND EXISTS (
      SELECT 1 FROM public.opportunity_freshness_members member
      JOIN public.staff_email_reviews review ON review.id=member.review_id
      WHERE member.opportunity_id=NEW.opportunity_id AND review.state IN ('sending','uncertain')
    ) THEN RAISE EXCEPTION 'freshness_unresolved_member_blocks_review'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.state<>'sending' THEN RETURN NEW; END IF;
  IF NEW.source_kind='freshness' THEN
    FOR v_opportunity_id IN SELECT opportunity_id FROM public.opportunity_freshness_members
      WHERE review_id=NEW.id ORDER BY opportunity_id LOOP
      PERFORM public.opportunity_freshness_lock_opportunity(v_opportunity_id);
    END LOOP;
    PERFORM public.opportunity_freshness_assert_current(NEW.id);
    IF EXISTS (
      SELECT 1 FROM public.opportunity_freshness_members member
      JOIN public.staff_email_reviews other_review ON other_review.opportunity_id=member.opportunity_id
      WHERE member.review_id=NEW.id AND other_review.id<>NEW.id
        AND other_review.state IN ('sending','uncertain')
    ) THEN RAISE EXCEPTION 'freshness_other_unresolved_send'; END IF;
  ELSE
    PERFORM public.opportunity_freshness_lock_opportunity(NEW.opportunity_id);
    IF EXISTS (
      SELECT 1 FROM public.opportunity_freshness_members member
      JOIN public.staff_email_reviews review ON review.id=member.review_id
      WHERE member.opportunity_id=NEW.opportunity_id AND review.state IN ('sending','uncertain')
    ) THEN RAISE EXCEPTION 'freshness_unresolved_member_blocks_send'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER opportunity_freshness_guard_review_insert BEFORE INSERT ON public.staff_email_reviews
  FOR EACH ROW EXECUTE FUNCTION public.opportunity_freshness_guard_review();
CREATE TRIGGER opportunity_freshness_guard_review_send BEFORE UPDATE OF state ON public.staff_email_reviews
  FOR EACH ROW EXECUTE FUNCTION public.opportunity_freshness_guard_review();

CREATE FUNCTION public.opportunity_freshness_guard_source_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_opportunity_id uuid; v_old_email text; v_other_outreach boolean;
BEGIN
  IF TG_TABLE_NAME='opportunities' THEN
    PERFORM public.opportunity_freshness_assert_mutation_allowed(NEW.id);
  ELSIF TG_TABLE_NAME='opportunity_matches' THEN
    IF TG_OP<>'INSERT' THEN PERFORM public.opportunity_freshness_assert_mutation_allowed(OLD.opportunity_id); END IF;
    IF TG_OP<>'DELETE' THEN PERFORM public.opportunity_freshness_assert_mutation_allowed(NEW.opportunity_id); END IF;
  ELSIF TG_TABLE_NAME='opportunity_ma_contacts' THEN
    IF TG_OP<>'INSERT' THEN PERFORM public.opportunity_freshness_assert_mutation_allowed(OLD.opportunity_id); END IF;
    IF TG_OP<>'DELETE' THEN PERFORM public.opportunity_freshness_assert_mutation_allowed(NEW.opportunity_id); END IF;
  ELSIF TG_TABLE_NAME='ma_source_email_send_reservations' OR TG_TABLE_NAME='ma_interactions' THEN
    IF TG_OP='UPDATE' THEN PERFORM public.opportunity_freshness_assert_mutation_allowed(OLD.opportunity_id); END IF;
    PERFORM public.opportunity_freshness_assert_mutation_allowed(NEW.opportunity_id);
    -- Reservation rows have no channel/direction. Keep their check separate
    -- from the interaction-only fields before evaluating the uncertain fence.
    IF TG_TABLE_NAME='ma_source_email_send_reservations' THEN
      v_other_outreach := true;
    ELSE
      v_other_outreach := NEW.channel='email' AND NEW.direction='outbound';
    END IF;
    IF v_other_outreach AND EXISTS (
      SELECT 1 FROM public.opportunity_freshness_members member
      JOIN public.staff_email_reviews review ON review.id=member.review_id
      WHERE member.opportunity_id=NEW.opportunity_id AND review.state='uncertain'
    ) THEN RAISE EXCEPTION 'freshness_uncertain_member_blocks_other_send'; END IF;
  ELSIF TG_TABLE_NAME='ma_contact_office_affiliations' THEN
    FOR v_opportunity_id IN SELECT DISTINCT link.opportunity_id FROM public.opportunity_ma_contacts link
      WHERE link.affiliation_id IN (OLD.id,NEW.id) ORDER BY 1 LOOP
      PERFORM public.opportunity_freshness_assert_mutation_allowed(v_opportunity_id);
    END LOOP;
  ELSIF TG_TABLE_NAME='ma_contacts' THEN
    v_old_email := CASE WHEN TG_OP='INSERT' THEN NULL ELSE lower(btrim(OLD.email)) END;
    FOR v_opportunity_id IN SELECT DISTINCT link.opportunity_id FROM public.opportunity_ma_contacts link
      JOIN public.ma_contact_office_affiliations affiliation ON affiliation.id=link.affiliation_id
      WHERE affiliation.contact_id=NEW.id ORDER BY 1 LOOP
      PERFORM public.opportunity_freshness_assert_mutation_allowed(v_opportunity_id);
    END LOOP;
    -- Address-level suppression includes *any* contact with the same email,
    -- including an unlinked record that becomes suppressed during delivery.
    FOR v_opportunity_id IN SELECT DISTINCT member.opportunity_id
      FROM public.opportunity_freshness_members member
      JOIN public.staff_email_reviews review ON review.id=member.review_id
      WHERE review.state='sending' AND lower(btrim(review.recipient_email))
        IN (v_old_email,lower(btrim(NEW.email))) ORDER BY 1 LOOP
      PERFORM public.opportunity_freshness_assert_mutation_allowed(v_opportunity_id);
    END LOOP;
  ELSIF TG_TABLE_NAME='ma_offices' THEN
    FOR v_opportunity_id IN SELECT id FROM public.opportunities WHERE source_office_id=NEW.id ORDER BY 1 LOOP
      PERFORM public.opportunity_freshness_assert_mutation_allowed(v_opportunity_id);
    END LOOP;
  ELSIF TG_TABLE_NAME='ma_firms' THEN
    FOR v_opportunity_id IN SELECT opportunity.id FROM public.opportunities opportunity
      JOIN public.ma_offices office ON office.id=opportunity.source_office_id
      WHERE office.firm_id=NEW.id ORDER BY 1 LOOP
      PERFORM public.opportunity_freshness_assert_mutation_allowed(v_opportunity_id);
    END LOOP;
  ELSIF TG_TABLE_NAME='repreneurs' THEN
    FOR v_opportunity_id IN SELECT DISTINCT match.opportunity_id FROM public.opportunity_matches match
      WHERE match.repreneur_id=NEW.id AND match.status='active_pursuit' ORDER BY 1 LOOP
      PERFORM public.opportunity_freshness_assert_mutation_allowed(v_opportunity_id);
    END LOOP;
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;

CREATE TRIGGER opportunity_freshness_guard_opportunity BEFORE UPDATE OF status,is_demo,source_office_id,source_identity_to_verify,date_added,date_added_precision,reference,public_title,sector
  ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.opportunity_freshness_guard_source_change();
CREATE TRIGGER opportunity_freshness_guard_match BEFORE INSERT OR UPDATE OF status,opportunity_id,repreneur_id OR DELETE
  ON public.opportunity_matches FOR EACH ROW EXECUTE FUNCTION public.opportunity_freshness_guard_source_change();
CREATE TRIGGER opportunity_freshness_guard_link BEFORE INSERT OR UPDATE OF opportunity_id,affiliation_id,is_active,is_primary,removed_at OR DELETE
  ON public.opportunity_ma_contacts FOR EACH ROW EXECUTE FUNCTION public.opportunity_freshness_guard_source_change();
CREATE TRIGGER opportunity_freshness_guard_affiliation BEFORE UPDATE OF contact_id,office_id,is_active,ended_at
  ON public.ma_contact_office_affiliations FOR EACH ROW EXECUTE FUNCTION public.opportunity_freshness_guard_source_change();
CREATE TRIGGER opportunity_freshness_guard_contact BEFORE INSERT OR UPDATE OF status,email,display_name,campaign_email_suppressed
  ON public.ma_contacts FOR EACH ROW EXECUTE FUNCTION public.opportunity_freshness_guard_source_change();
CREATE TRIGGER opportunity_freshness_guard_office BEFORE UPDATE OF name,firm_id,status
  ON public.ma_offices FOR EACH ROW EXECUTE FUNCTION public.opportunity_freshness_guard_source_change();
CREATE TRIGGER opportunity_freshness_guard_firm BEFORE UPDATE OF name,status
  ON public.ma_firms FOR EACH ROW EXECUTE FUNCTION public.opportunity_freshness_guard_source_change();
CREATE TRIGGER opportunity_freshness_guard_repreneur BEFORE UPDATE OF is_demo
  ON public.repreneurs FOR EACH ROW EXECUTE FUNCTION public.opportunity_freshness_guard_source_change();
CREATE TRIGGER opportunity_freshness_guard_other_reservation BEFORE INSERT OR UPDATE ON public.ma_source_email_send_reservations
  FOR EACH ROW EXECUTE FUNCTION public.opportunity_freshness_guard_source_change();
CREATE TRIGGER opportunity_freshness_guard_other_outreach BEFORE INSERT OR UPDATE OF delivery_status,opportunity_id,occurred_at,channel,direction ON public.ma_interactions
  FOR EACH ROW WHEN (NEW.direction='inbound' OR (NEW.channel='email' AND NEW.direction='outbound'))
  EXECUTE FUNCTION public.opportunity_freshness_guard_source_change();

CREATE FUNCTION public.opportunity_freshness_guard_template_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.template_key <> 'ma_opportunity_validity_check' THEN RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('freshness-template:ma_opportunity_validity_check',187));
  IF EXISTS (SELECT 1 FROM public.staff_email_reviews review
    LEFT JOIN public.opportunity_freshness_deliveries delivery ON delivery.review_id=review.id
    WHERE review.source_kind='freshness' AND review.state='sending'
      AND coalesce(delivery.attempted_at,review.attempted_at)>now()-interval '2 minutes') THEN
    RAISE EXCEPTION 'freshness_send_lease_blocks_template_change';
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER opportunity_freshness_guard_template BEFORE UPDATE OF subject,body_markdown,body_editable,is_active OR DELETE
  ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.opportunity_freshness_guard_template_change();

CREATE FUNCTION public.opportunity_freshness_edit(p_review_id uuid,p_version integer,p_subject text,p_body text,p_actor text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_version integer;
BEGIN
  PERFORM public.staff_email_review_assert_actor(p_actor);
  IF nullif(btrim(p_subject),'') IS NULL OR nullif(btrim(p_body),'') IS NULL THEN RAISE EXCEPTION 'freshness_content_required'; END IF;
  UPDATE public.staff_email_reviews SET subject=btrim(p_subject),body_text=btrim(p_body),
    edited_by=p_actor,edited_at=now(),version=version+1
  WHERE id=p_review_id AND source_kind='freshness' AND state='pending' AND version=p_version AND attempted_payload IS NULL
  RETURNING version INTO v_version;
  IF v_version IS NULL THEN RAISE EXCEPTION 'freshness_stale_or_locked'; END IF;
  INSERT INTO public.staff_email_review_events(review_id,event_kind,actor,version)
  VALUES(p_review_id,'edited',p_actor,v_version);
  RETURN v_version;
END $$;

-- Explicit staff refresh changes evidence/version, never the exact member IDs or
-- the reviewed words. An ineligible member vetoes the whole group.
CREATE FUNCTION public.opportunity_freshness_refresh(p_review_id uuid,p_version integer,p_template_version text,p_actor text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.staff_email_reviews%ROWTYPE; v_member public.opportunity_freshness_members%ROWTYPE;
  v_current jsonb; v_email text; v_version integer;
BEGIN
  PERFORM public.staff_email_review_assert_actor(p_actor);
  SELECT * INTO v FROM public.staff_email_reviews WHERE id=p_review_id FOR UPDATE;
  IF v.id IS NULL OR v.source_kind<>'freshness' OR v.state<>'pending' OR v.version<>p_version
    OR v.attempted_payload IS NOT NULL OR nullif(btrim(p_template_version),'') IS NULL THEN
    RAISE EXCEPTION 'freshness_refresh_requires_unattempted_exact_version'; END IF;
  FOR v_member IN SELECT * FROM public.opportunity_freshness_members WHERE review_id=p_review_id ORDER BY opportunity_id LOOP
    SELECT candidate INTO v_current FROM public.opportunity_freshness_candidates(v_member.contact_id,now(),false,p_review_id) candidate
      WHERE candidate->>'opportunity_id'=v_member.opportunity_id::text;
    IF v_current IS NULL OR v_current->>'episode_key' IS DISTINCT FROM v_member.episode_key
      OR v_current->>'contact_link_id' IS DISTINCT FROM v_member.contact_link_id::text THEN
      RAISE EXCEPTION 'freshness_refresh_member_not_current'; END IF;
    IF v_email IS NULL THEN v_email := v_current->>'recipient_email'; END IF;
    IF v_email IS DISTINCT FROM v_current->>'recipient_email' THEN RAISE EXCEPTION 'freshness_refresh_group_recipient_ambiguous'; END IF;
    UPDATE public.opportunity_freshness_members SET frozen_member=v_current
    WHERE review_id=p_review_id AND opportunity_id=v_member.opportunity_id;
  END LOOP;
  IF v_email IS NULL THEN RAISE EXCEPTION 'freshness_refresh_has_no_members'; END IF;
  UPDATE public.staff_email_reviews SET recipient_email=v_email,template_version=p_template_version,
    edited_by=p_actor,edited_at=now(),version=version+1 WHERE id=p_review_id RETURNING version INTO v_version;
  INSERT INTO public.staff_email_review_events(review_id,event_kind,actor,version,detail)
  VALUES(p_review_id,'refreshed',p_actor,v_version,jsonb_build_object('recipient_email',v_email));
  RETURN v_version;
END $$;

CREATE FUNCTION public.opportunity_freshness_reserve(p_review_id uuid,p_version integer,p_payload jsonb,p_fingerprint text,p_actor text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.staff_email_reviews%ROWTYPE; v_token uuid; v_version integer; v_last_attempt timestamptz;
BEGIN
  PERFORM public.staff_email_review_assert_actor(p_actor);
  SELECT * INTO v FROM public.staff_email_reviews WHERE id=p_review_id FOR UPDATE;
  IF v.id IS NULL OR v.source_kind<>'freshness' OR v.version<>p_version
    OR v.state NOT IN ('pending','sending','uncertain','failed') THEN RAISE EXCEPTION 'freshness_stale_or_not_sendable'; END IF;
  SELECT attempted_at INTO v_last_attempt FROM public.opportunity_freshness_deliveries WHERE review_id=p_review_id;
  IF v.state IN ('sending','uncertain') AND coalesce(v_last_attempt,v.attempted_at)>now()-interval '2 minutes' THEN
    RAISE EXCEPTION 'freshness_in_flight'; END IF;
  IF v.attempted_payload IS NOT NULL AND (v.attempted_payload IS DISTINCT FROM p_payload
    OR v.attempted_at<=now()-interval '23 hours') THEN RAISE EXCEPTION 'freshness_reconciliation_required'; END IF;
  IF p_fingerprint !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'freshness_invalid_fingerprint'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('freshness-template:ma_opportunity_validity_check',187));
  PERFORM public.opportunity_freshness_assert_current(p_review_id);
  IF NOT EXISTS (SELECT 1 FROM public.email_templates template
    WHERE template.template_key='ma_opportunity_validity_check' AND template.is_active) THEN
    RAISE EXCEPTION 'freshness_template_disabled'; END IF;
  v_token := gen_random_uuid();
  UPDATE public.staff_email_reviews SET state='sending',approved_by=p_actor,
    approved_at=now(),attempted_payload=coalesce(attempted_payload,p_payload),
    attempted_at=coalesce(attempted_at,now()),attempt_token=v_token,version=version+1
  WHERE id=p_review_id RETURNING version INTO v_version;
  INSERT INTO public.opportunity_freshness_deliveries(
    review_id,provider_idempotency_key,request_fingerprint,delivery_status,attempted_by,attempted_at
  ) VALUES(p_review_id,p_review_id::text,p_fingerprint,'pending',p_actor,now())
  ON CONFLICT (review_id) DO UPDATE SET delivery_status='pending',attempted_by=excluded.attempted_by,
    attempted_at=excluded.attempted_at
  WHERE public.opportunity_freshness_deliveries.request_fingerprint=excluded.request_fingerprint
    AND public.opportunity_freshness_deliveries.delivery_status<>'sent';
  IF NOT FOUND THEN RAISE EXCEPTION 'freshness_delivery_fingerprint_changed'; END IF;
  INSERT INTO public.staff_email_review_events(review_id,event_kind,actor,version)
  VALUES(p_review_id,'approved',p_actor,v_version),(p_review_id,'sending',p_actor,v_version);
  RETURN v_token;
END $$;

CREATE FUNCTION public.opportunity_freshness_finish(
  p_review_id uuid,p_token uuid,p_state text,p_provider_message_id text,p_error text,p_actor text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.staff_email_reviews%ROWTYPE; v_delivery public.opportunity_freshness_deliveries%ROWTYPE; v_version integer;
BEGIN
  PERFORM public.staff_email_review_assert_actor(p_actor);
  IF p_state NOT IN ('sent','failed','uncertain') THEN RAISE EXCEPTION 'freshness_invalid_outcome'; END IF;
  SELECT * INTO v FROM public.staff_email_reviews WHERE id=p_review_id FOR UPDATE;
  SELECT * INTO v_delivery FROM public.opportunity_freshness_deliveries WHERE review_id=p_review_id FOR UPDATE;
  IF v.id IS NULL OR v.source_kind<>'freshness' OR v.state<>'sending' OR v.attempt_token IS DISTINCT FROM p_token
    OR v_delivery.id IS NULL THEN RAISE EXCEPTION 'freshness_outcome_not_reserved'; END IF;
  IF p_state='sent' AND nullif(btrim(p_provider_message_id),'') IS NULL THEN RAISE EXCEPTION 'freshness_sent_requires_provider_receipt'; END IF;
  IF p_state<>'sent' AND p_provider_message_id IS NOT NULL THEN RAISE EXCEPTION 'freshness_non_sent_cannot_claim_receipt'; END IF;
  IF p_state='failed' AND EXISTS (SELECT 1 FROM public.staff_email_review_events event
    WHERE event.review_id=p_review_id AND event.event_kind='uncertain') THEN
    RAISE EXCEPTION 'freshness_prior_uncertainty_requires_reconciliation'; END IF;
  UPDATE public.opportunity_freshness_deliveries SET
    delivery_status=CASE WHEN p_state='uncertain' THEN 'pending' ELSE p_state END,
    provider_message_id=p_provider_message_id,delivery_error=left(p_error,500),
    finalized_at=CASE WHEN p_state='uncertain' THEN NULL ELSE now() END
  WHERE id=v_delivery.id;
  UPDATE public.staff_email_reviews SET state=p_state,outcome_at=now(),
    provider_message_id=p_provider_message_id,
    delivery_evidence_id=CASE WHEN p_state='sent' THEN v_delivery.id ELSE NULL END,
    delivery_error=left(p_error,500),attempt_token=NULL,version=version+1
  WHERE id=p_review_id RETURNING version INTO v_version;
  INSERT INTO public.staff_email_review_events(review_id,event_kind,actor,version,detail)
  VALUES(p_review_id,p_state,p_actor,v_version,
    jsonb_build_object('provider_message_id',p_provider_message_id,'delivery_evidence_id',CASE WHEN p_state='sent' THEN v_delivery.id ELSE NULL END));
END $$;

CREATE FUNCTION public.opportunity_freshness_record_reply(
  p_review_id uuid,p_opportunity_id uuid,p_outcome text,p_reply_at timestamptz,p_evidence text,p_actor text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_review public.staff_email_reviews%ROWTYPE; v_member public.opportunity_freshness_members%ROWTYPE; v_id uuid;
BEGIN
  PERFORM public.staff_email_review_assert_actor(p_actor);
  -- A reply against an earlier sent review may race a new episode's send.
  -- Serialize it with all-member reservation before checking/recording truth.
  PERFORM public.opportunity_freshness_assert_mutation_allowed(p_opportunity_id);
  SELECT * INTO v_review FROM public.staff_email_reviews WHERE id=p_review_id;
  SELECT * INTO v_member FROM public.opportunity_freshness_members
    WHERE review_id=p_review_id AND opportunity_id=p_opportunity_id;
  IF v_review.id IS NULL OR v_review.source_kind<>'freshness' OR v_review.state<>'sent'
    OR v_member.review_id IS NULL OR p_outcome NOT IN ('confirmed_open','closed','paused','unclear')
    OR p_reply_at IS NULL OR p_reply_at<coalesce(v_review.attempted_at,v_review.created_at)
    OR p_reply_at>now()+interval '5 minutes' OR length(btrim(p_evidence))<5 THEN
    RAISE EXCEPTION 'freshness_reply_requires_exact_sent_member_and_evidence';
  END IF;
  INSERT INTO public.opportunity_freshness_replies(
    review_id,opportunity_id,contact_id,outcome,reply_at,evidence,recorded_by
  ) VALUES(p_review_id,p_opportunity_id,v_member.contact_id,p_outcome,p_reply_at,btrim(p_evidence),p_actor)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.opportunity_freshness_candidates(uuid,timestamptz,boolean,uuid),
  public.opportunity_freshness_due_contacts(integer),public.opportunity_freshness_latest_confirmations(uuid[]),
  public.opportunity_freshness_prepare(uuid,jsonb,text,text,text),
  public.opportunity_freshness_assert_current(uuid),public.opportunity_freshness_edit(uuid,integer,text,text,text),
  public.opportunity_freshness_lock_opportunity(uuid),public.opportunity_freshness_assert_mutation_allowed(uuid),
  public.opportunity_freshness_guard_review(),public.opportunity_freshness_guard_source_change(),
  public.opportunity_freshness_guard_template_change(),
  public.opportunity_freshness_refresh(uuid,integer,text,text),
  public.opportunity_freshness_reserve(uuid,integer,jsonb,text,text),
  public.opportunity_freshness_finish(uuid,uuid,text,text,text,text),
  public.opportunity_freshness_record_reply(uuid,uuid,text,timestamptz,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.opportunity_freshness_candidates(uuid,timestamptz,boolean,uuid),
  public.opportunity_freshness_due_contacts(integer),public.opportunity_freshness_latest_confirmations(uuid[]),
  public.opportunity_freshness_prepare(uuid,jsonb,text,text,text),
  public.opportunity_freshness_assert_current(uuid),public.opportunity_freshness_edit(uuid,integer,text,text,text),
  public.opportunity_freshness_lock_opportunity(uuid),public.opportunity_freshness_assert_mutation_allowed(uuid),
  public.opportunity_freshness_refresh(uuid,integer,text,text),
  public.opportunity_freshness_reserve(uuid,integer,jsonb,text,text),
  public.opportunity_freshness_finish(uuid,uuid,text,text,text,text),
  public.opportunity_freshness_record_reply(uuid,uuid,text,timestamptz,text,text)
  TO service_role;
COMMIT;
