-- #221 / #224. A staff-confirmed selection is evidence, never a provider key.
-- No existing review, source operation, or historical delivery is rewritten.
BEGIN;

CREATE TABLE public.staff_email_bulk_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prepared_by text NOT NULL,
  prepared_at timestamptz NOT NULL DEFAULT now(),
  confirmed_by text,
  confirmed_at timestamptz,
  item_count integer NOT NULL CHECK (item_count BETWEEN 1 AND 5),
  page_query jsonb NOT NULL CHECK (jsonb_typeof(page_query) = 'object'),
  manifest_sha256 text NOT NULL CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  CHECK ((confirmed_by IS NULL) = (confirmed_at IS NULL))
);

CREATE TABLE public.staff_email_bulk_items (
  batch_id uuid NOT NULL REFERENCES public.staff_email_bulk_batches(id) ON DELETE CASCADE,
  ordinal integer NOT NULL CHECK (ordinal BETWEEN 1 AND 5),
  review_id uuid NOT NULL REFERENCES public.staff_email_reviews(id) ON DELETE CASCADE,
  review_snapshot jsonb NOT NULL CHECK (jsonb_typeof(review_snapshot) = 'object'),
  members_snapshot jsonb NOT NULL CHECK (jsonb_typeof(members_snapshot) = 'array'),
  snapshot_sha256 text NOT NULL CHECK (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  acknowledged_by text,
  acknowledged_at timestamptz,
  state text NOT NULL DEFAULT 'not_attempted' CHECK (state IN
    ('not_attempted','started','accepted','blocked','failed','uncertain')),
  claim_token uuid,
  review_attempt_token uuid,
  ma_reservation_token uuid,
  handoff_delivery_id uuid,
  handoff_operation_key uuid,
  started_at timestamptz,
  finished_at timestamptz,
  outcome_detail text,
  PRIMARY KEY (batch_id, ordinal),
  UNIQUE (batch_id, review_id),
  CHECK ((acknowledged_by IS NULL) = (acknowledged_at IS NULL)),
  CHECK ((claim_token IS NULL) = (started_at IS NULL)),
  CHECK ((state = 'not_attempted' OR state = 'blocked') OR claim_token IS NOT NULL),
  CHECK (finished_at IS NULL OR state IN ('accepted','blocked','failed','uncertain'))
);
CREATE INDEX staff_email_bulk_items_review_idx ON public.staff_email_bulk_items(review_id);

ALTER TABLE public.staff_email_bulk_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_email_bulk_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.staff_email_bulk_batches, public.staff_email_bulk_items
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.staff_email_bulk_batches, public.staff_email_bulk_items TO service_role;

-- The item snapshot is deliberately limited to the reviewed source identity,
-- full message and attachments. Mutable delivery fields are checked separately.
CREATE FUNCTION public.staff_email_bulk_review_snapshot(p_review_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id',r.id,'version',r.version,'source_kind',r.source_kind,
    'source_operation_id',r.source_operation_id,'opportunity_id',r.opportunity_id,
    'match_id',r.match_id,'upstream_evidence_id',r.upstream_evidence_id,
    'contact_link_id',r.contact_link_id,'recipient_email',r.recipient_email,
    'namespace',r.namespace,'template_key',r.template_key,
    'template_version',r.template_version,'subject',r.subject,
    'body_text',r.body_text,'attachment_snapshot',r.attachment_snapshot)
  FROM public.staff_email_reviews r WHERE r.id=p_review_id;
$$;

CREATE FUNCTION public.staff_email_bulk_members_snapshot(p_review_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.opportunity_id),'[]'::jsonb)
  FROM public.opportunity_freshness_members m WHERE m.review_id=p_review_id;
$$;

CREATE FUNCTION public.staff_email_bulk_snapshot_sha(p_review jsonb,p_members jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT encode(extensions.digest(convert_to(jsonb_build_object(
    'review',p_review,'members',p_members)::text,'UTF8'),'sha256'),'hex');
$$;

CREATE FUNCTION public.staff_email_bulk_prepare(
  p_review_ids uuid[],p_versions integer[],p_page integer,p_view text,
  p_search_pattern text,p_purpose text,p_sort text,p_direction text,p_actor text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count integer; v_page_ids uuid[]; v_order text; v_sort text;
  v_batch uuid; v_review public.staff_email_reviews%ROWTYPE;
  v_snapshot jsonb; v_members jsonb; v_hashes text[] := ARRAY[]::text[];
  v_i integer;
BEGIN
  PERFORM public.staff_email_review_assert_actor(p_actor);
  v_count := coalesce(array_length(p_review_ids,1),0);
  IF v_count NOT BETWEEN 1 AND 5 OR coalesce(array_length(p_versions,1),0)<>v_count
    OR p_page NOT BETWEEN 1 AND 1000000 OR p_view NOT IN ('active','all')
    OR p_purpose IS NULL OR p_sort NOT IN ('message','purpose','recipient','company','prepared')
    OR p_direction NOT IN ('asc','desc') OR p_search_pattern IS NULL OR length(p_search_pattern)>250
    OR EXISTS (SELECT 1 FROM unnest(p_versions) x WHERE x IS NULL OR x<1)
    OR (SELECT count(DISTINCT x) FROM unnest(p_review_ids) x)<>v_count
  THEN RAISE EXCEPTION 'bulk_invalid_selection'; END IF;
  v_sort := CASE p_sort WHEN 'message' THEN 'message_sort' WHEN 'purpose' THEN 'purpose_sort'
    WHEN 'recipient' THEN 'recipient_sort' WHEN 'company' THEN 'company_sort'
    ELSE 'created_at' END;
  v_order := CASE WHEN p_direction='asc' THEN 'ASC' ELSE 'DESC' END;
  EXECUTE format('SELECT coalesce(array_agg(id),ARRAY[]::uuid[]) FROM (
    SELECT id FROM public.staff_email_review_queue
    WHERE ($1=''all'' OR (archived_at IS NULL AND state IN (''pending'',''sending'',''uncertain'',''failed'')))
      AND ($2=''all'' OR purpose_key=$2)
      AND ($3=''%%'' OR search_text ILIKE $3)
    ORDER BY %I %s NULLS LAST, %s id DESC
    LIMIT 25 OFFSET $4) page_rows', v_sort, v_order,
    CASE WHEN p_sort='prepared' THEN '' ELSE 'created_at DESC,' END)
    INTO v_page_ids USING p_view,p_purpose,p_search_pattern,(p_page-1)*25;
  IF NOT p_review_ids <@ v_page_ids THEN RAISE EXCEPTION 'bulk_selection_left_current_page'; END IF;

  INSERT INTO public.staff_email_bulk_batches(prepared_by,item_count,page_query,manifest_sha256)
  VALUES(p_actor,v_count,jsonb_build_object('page',p_page,'view',p_view,'search_pattern',p_search_pattern,
    'purpose',p_purpose,'sort',p_sort,'direction',p_direction),repeat('0',64)) RETURNING id INTO v_batch;
  FOR v_i IN 1..v_count LOOP
    SELECT * INTO v_review FROM public.staff_email_reviews WHERE id=p_review_ids[v_i] FOR UPDATE;
    IF v_review.id IS NULL OR v_review.version<>p_versions[v_i]
      OR v_review.namespace<>'REAL' OR v_review.archived_at IS NOT NULL
      OR v_review.state<>'pending' OR v_review.attempted_payload IS NOT NULL
      OR v_review.attempted_at IS NOT NULL
      OR NOT public.staff_email_review_archive_source_clear(v_review.id)
    THEN RAISE EXCEPTION 'bulk_review_stale_or_attempted'; END IF;
    v_snapshot := public.staff_email_bulk_review_snapshot(v_review.id);
    v_members := public.staff_email_bulk_members_snapshot(v_review.id);
    IF (v_review.source_kind='freshness') IS DISTINCT FROM (jsonb_array_length(v_members)>0)
    THEN RAISE EXCEPTION 'bulk_freshness_members_missing'; END IF;
    v_hashes := array_append(v_hashes,public.staff_email_bulk_snapshot_sha(v_snapshot,v_members));
    INSERT INTO public.staff_email_bulk_items(batch_id,ordinal,review_id,review_snapshot,members_snapshot,snapshot_sha256)
    VALUES(v_batch,v_i,v_review.id,v_snapshot,v_members,v_hashes[v_i]);
  END LOOP;
  UPDATE public.staff_email_bulk_batches SET manifest_sha256=encode(extensions.digest(
    convert_to(array_to_string(v_hashes,':'),'UTF8'),'sha256'),'hex') WHERE id=v_batch;
  RETURN v_batch;
END $$;

CREATE FUNCTION public.staff_email_bulk_ack(p_batch_id uuid,p_ordinal integer,p_snapshot_sha256 text,p_actor text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_batch public.staff_email_bulk_batches%ROWTYPE; v_item public.staff_email_bulk_items%ROWTYPE;
BEGIN
  PERFORM public.staff_email_review_assert_actor(p_actor);
  SELECT * INTO v_batch FROM public.staff_email_bulk_batches WHERE id=p_batch_id FOR UPDATE;
  SELECT * INTO v_item FROM public.staff_email_bulk_items WHERE batch_id=p_batch_id AND ordinal=p_ordinal FOR UPDATE;
  IF v_batch.id IS NULL OR v_batch.prepared_by<>p_actor OR v_batch.confirmed_at IS NOT NULL
    OR v_item.review_id IS NULL OR v_item.snapshot_sha256 IS DISTINCT FROM p_snapshot_sha256
    OR v_item.state<>'not_attempted'
  THEN RAISE EXCEPTION 'bulk_ack_stale_or_wrong_actor'; END IF;
  UPDATE public.staff_email_bulk_items SET acknowledged_by=p_actor,acknowledged_at=now()
    WHERE batch_id=p_batch_id AND ordinal=p_ordinal;
END $$;

CREATE FUNCTION public.staff_email_bulk_confirm(p_batch_id uuid,p_manifest_sha256 text,p_actor text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_batch public.staff_email_bulk_batches%ROWTYPE; v_item public.staff_email_bulk_items%ROWTYPE;
  v_count integer:=0;
BEGIN
  PERFORM public.staff_email_review_assert_actor(p_actor);
  SELECT * INTO v_batch FROM public.staff_email_bulk_batches WHERE id=p_batch_id FOR UPDATE;
  IF v_batch.id IS NULL OR v_batch.prepared_by<>p_actor OR v_batch.manifest_sha256 IS DISTINCT FROM p_manifest_sha256
  THEN RAISE EXCEPTION 'bulk_confirmation_stale_or_wrong_actor'; END IF;
  IF v_batch.confirmed_at IS NOT NULL THEN RETURN; END IF;
  FOR v_item IN SELECT * FROM public.staff_email_bulk_items WHERE batch_id=p_batch_id ORDER BY ordinal FOR UPDATE LOOP
    v_count:=v_count+1;
    IF v_item.acknowledged_by IS DISTINCT FROM p_actor OR v_item.state<>'not_attempted'
      OR v_item.review_snapshot IS DISTINCT FROM public.staff_email_bulk_review_snapshot(v_item.review_id)
      OR v_item.members_snapshot IS DISTINCT FROM public.staff_email_bulk_members_snapshot(v_item.review_id)
      OR NOT EXISTS (SELECT 1 FROM public.staff_email_reviews r WHERE r.id=v_item.review_id
        AND r.state='pending' AND r.namespace='REAL' AND r.archived_at IS NULL
        AND r.attempted_payload IS NULL AND r.attempted_at IS NULL)
      OR NOT public.staff_email_review_archive_source_clear(v_item.review_id)
    THEN RAISE EXCEPTION 'bulk_confirmation_requires_exact_current_acks'; END IF;
  END LOOP;
  IF v_count<>v_batch.item_count THEN RAISE EXCEPTION 'bulk_confirmation_incomplete'; END IF;
  UPDATE public.staff_email_bulk_batches SET confirmed_by=p_actor,confirmed_at=now() WHERE id=p_batch_id;
END $$;

-- Return start=false for every repeat, including a lost response. Only the
-- transaction that changes not_attempted to started may call a provider.
CREATE FUNCTION public.staff_email_bulk_claim(
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

-- A preclaim veto is proved no-I/O: it cannot hide a claimed or attempted item.
CREATE FUNCTION public.staff_email_bulk_block(
  p_batch_id uuid,p_ordinal integer,p_actor text,p_reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_batch public.staff_email_bulk_batches%ROWTYPE;
  v_item public.staff_email_bulk_items%ROWTYPE;
BEGIN
  PERFORM public.staff_email_review_assert_actor(p_actor);
  SELECT * INTO v_batch FROM public.staff_email_bulk_batches WHERE id=p_batch_id FOR UPDATE;
  SELECT * INTO v_item FROM public.staff_email_bulk_items WHERE batch_id=p_batch_id AND ordinal=p_ordinal FOR UPDATE;
  IF v_batch.id IS NULL OR v_batch.confirmed_by<>p_actor OR v_item.review_id IS NULL
    OR v_item.state<>'not_attempted' OR v_item.claim_token IS NOT NULL
    OR EXISTS (SELECT 1 FROM public.staff_email_bulk_items prior
      WHERE prior.batch_id=p_batch_id AND prior.ordinal<p_ordinal
        AND prior.state IN ('not_attempted','started'))
  THEN RAISE EXCEPTION 'bulk_block_requires_unclaimed_item'; END IF;
  UPDATE public.staff_email_bulk_items SET state='blocked',finished_at=now(),
    outcome_detail=left(coalesce(nullif(btrim(p_reason),''),'Current delivery gate blocked this message.'),500)
    WHERE batch_id=p_batch_id AND ordinal=p_ordinal;
END $$;

-- No application result can claim acceptance without the existing review's
-- source-linked receipt. Unknown finalization remains uncertain.
CREATE FUNCTION public.staff_email_bulk_finish(
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
      v_review.provider_message_id IS NULL OR v_review.delivery_evidence_id IS NULL))
    OR (p_outcome IN ('failed','blocked') AND (v_review.state<>'failed' OR
      NOT public.staff_email_review_archive_source_clear(v_review.id)))
  THEN RAISE EXCEPTION 'bulk_finish_requires_source_evidence'; END IF;
  UPDATE public.staff_email_bulk_items SET state=p_outcome,finished_at=now(),
    outcome_detail=left(nullif(btrim(p_detail),''),500)
    WHERE batch_id=p_batch_id AND ordinal=p_ordinal;
END $$;

-- Explicit receipt-only recovery after a lost response. It never invokes a
-- provider or a source reservation and cannot turn unknown into no-send.
CREATE FUNCTION public.staff_email_bulk_reconcile(p_batch_id uuid,p_ordinal integer,p_actor text)
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
      AND v_review.delivery_evidence_id IS NOT NULL THEN 'accepted'
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

-- A parent deletion may remove unattempted/settled selection evidence with
-- its review. An unresolved claimed item cannot be cascaded away.
CREATE FUNCTION public.staff_email_bulk_guard_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.state IN ('started','uncertain') THEN RAISE EXCEPTION 'bulk_unresolved_item_blocks_delete'; END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER staff_email_bulk_item_delete_guard BEFORE DELETE ON public.staff_email_bulk_items
  FOR EACH ROW EXECUTE FUNCTION public.staff_email_bulk_guard_delete();

REVOKE ALL ON FUNCTION public.staff_email_bulk_review_snapshot(uuid),
  public.staff_email_bulk_members_snapshot(uuid),public.staff_email_bulk_snapshot_sha(jsonb,jsonb),
  public.staff_email_bulk_prepare(uuid[],integer[],integer,text,text,text,text,text,text),
  public.staff_email_bulk_ack(uuid,integer,text,text),public.staff_email_bulk_confirm(uuid,text,text),
  public.staff_email_bulk_claim(uuid,integer,text,jsonb,text),
  public.staff_email_bulk_block(uuid,integer,text,text),
  public.staff_email_bulk_finish(uuid,integer,uuid,text,text,text),
  public.staff_email_bulk_reconcile(uuid,integer,text),
  public.staff_email_bulk_guard_delete() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.staff_email_bulk_prepare(uuid[],integer[],integer,text,text,text,text,text,text),
  public.staff_email_bulk_ack(uuid,integer,text,text),public.staff_email_bulk_confirm(uuid,text,text),
  public.staff_email_bulk_claim(uuid,integer,text,jsonb,text),
  public.staff_email_bulk_block(uuid,integer,text,text),
  public.staff_email_bulk_finish(uuid,integer,uuid,text,text,text),
  public.staff_email_bulk_reconcile(uuid,integer,text) TO service_role;

COMMIT;
