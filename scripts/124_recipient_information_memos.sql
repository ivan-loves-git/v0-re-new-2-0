-- #185 / Decision #180. Additive, no classification or deletion of existing files.
-- Apply before the application. Existing opportunities and IMs remain reusable.
BEGIN;

ALTER TABLE public.opportunities
  ADD COLUMN recipient_im_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN recipient_im_required_changed_at TIMESTAMPTZ,
  ADD COLUMN recipient_im_required_changed_by TEXT;
ALTER TABLE public.opportunities ADD CONSTRAINT opportunity_recipient_im_flag_audit
  CHECK ((recipient_im_required_changed_at IS NULL) = (recipient_im_required_changed_by IS NULL));

ALTER TABLE public.opportunity_documents
  ADD COLUMN recipient_match_id UUID REFERENCES public.opportunity_matches(id) ON DELETE RESTRICT,
  ADD COLUMN recipient_repreneur_id UUID REFERENCES public.repreneurs(id) ON DELETE RESTRICT;
ALTER TABLE public.opportunity_documents ADD CONSTRAINT opportunity_document_recipient_im_pair
  CHECK ((recipient_match_id IS NULL) = (recipient_repreneur_id IS NULL));
ALTER TABLE public.opportunity_documents ADD CONSTRAINT opportunity_document_recipient_im_type
  CHECK (recipient_match_id IS NULL OR (document_type = 'deal_book' AND visibility = 'staff_only'
    AND external_url IS NULL AND storage_bucket = 'opportunity-documents'
    AND mime_type = 'application/pdf' AND lower(file_name) LIKE '%.pdf'));
CREATE INDEX opportunity_documents_recipient_match_idx
  ON public.opportunity_documents(recipient_match_id, id) WHERE recipient_match_id IS NOT NULL;

-- The document row survives physical deletion because canonical grant/evidence
-- foreign keys point to it. Only this exact private object may enter cleanup.
CREATE TABLE public.recipient_im_cleanup (
  document_id UUID PRIMARY KEY REFERENCES public.opportunity_documents(id) ON DELETE RESTRICT,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  match_id UUID NOT NULL REFERENCES public.opportunity_matches(id) ON DELETE RESTRICT,
  repreneur_id UUID NOT NULL REFERENCES public.repreneurs(id) ON DELETE RESTRICT,
  storage_bucket TEXT NOT NULL CHECK (storage_bucket = 'opportunity-documents'),
  storage_path TEXT NOT NULL UNIQUE,
  dropped_by TEXT NOT NULL CHECK (btrim(dropped_by) <> ''),
  dropped_at TIMESTAMPTZ NOT NULL,
  drop_reason TEXT NOT NULL CHECK (btrim(drop_reason) <> ''),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','failed','deleted')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error_code TEXT,
  last_attempt_at TIMESTAMPTZ,
  deletion_receipt_at TIMESTAMPTZ,
  CHECK ((status = 'deleted') = (deletion_receipt_at IS NOT NULL)),
  CHECK (storage_path !~ '(^|/)\.\.?(/|$)')
);
CREATE INDEX recipient_im_cleanup_retry_idx ON public.recipient_im_cleanup(dropped_at,document_id)
  WHERE status <> 'deleted';
ALTER TABLE public.recipient_im_cleanup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipient_im_cleanup FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.recipient_im_cleanup FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.recipient_im_cleanup TO service_role;

CREATE OR REPLACE FUNCTION public.set_opportunity_recipient_im_required(
  p_opportunity_id UUID, p_required BOOLEAN, p_actor TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_current BOOLEAN;
BEGIN
  IF p_required IS NULL OR btrim(coalesce(p_actor,''))='' OR
    (SELECT count(*) FROM public.app_user_roles WHERE role='staff' AND (user_id=p_actor OR email=p_actor))<>1
  THEN RAISE EXCEPTION 'Exact staff authority and flag choice are required.'; END IF;
  SELECT recipient_im_required INTO v_current FROM public.opportunities WHERE id=p_opportunity_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opportunity not found.'; END IF;
  IF v_current IS DISTINCT FROM p_required THEN
    UPDATE public.opportunities SET recipient_im_required=p_required,
      recipient_im_required_changed_at=clock_timestamp(),recipient_im_required_changed_by=p_actor
    WHERE id=p_opportunity_id;
  END IF;
  RETURN p_required;
END $$;

-- The existing W-165 finalizer writes the document while its exact upload
-- intent is pending and locked. Bind it here, inside that same transaction.
-- A stale intent cannot be finalized after flag-off or after Drop.
CREATE OR REPLACE FUNCTION public.bind_recipient_information_memo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_required BOOLEAN; v_status TEXT; v_demo BOOLEAN;
  v_intent public.private_upload_intents%ROWTYPE; v_match public.opportunity_matches%ROWTYPE;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF OLD.recipient_match_id IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
      -- The regular updated_at trigger is harmless only when no field changes.
      RAISE EXCEPTION 'Recipient IM metadata is immutable.';
    END IF;
    IF (NEW.recipient_match_id,NEW.recipient_repreneur_id) IS DISTINCT FROM
       (OLD.recipient_match_id,OLD.recipient_repreneur_id) THEN
      RAISE EXCEPTION 'Recipient IM ownership is immutable.';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='DELETE' THEN
    IF OLD.recipient_match_id IS NOT NULL THEN RAISE EXCEPTION 'Recipient IM tombstones cannot be removed.'; END IF;
    RETURN OLD;
  END IF;
  IF NEW.document_type <> 'deal_book' THEN
    IF NEW.recipient_match_id IS NOT NULL OR NEW.recipient_repreneur_id IS NOT NULL
    THEN RAISE EXCEPTION 'Only an IM can be recipient-bound.'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.recipient_match_id IS NOT NULL OR NEW.recipient_repreneur_id IS NOT NULL
  THEN RAISE EXCEPTION 'Recipient identity must come from the exact upload intent.'; END IF;
  SELECT * INTO v_intent FROM public.private_upload_intents
    WHERE storage_path=NEW.storage_path AND upload_kind='opportunity_document'
      AND status='pending' AND related_id IS NOT NULL;
  IF v_intent.id IS NOT NULL THEN
    SELECT * INTO v_match FROM public.opportunity_matches WHERE id=v_intent.related_id FOR UPDATE;
  END IF;
  SELECT recipient_im_required,status,is_demo INTO v_required,v_status,v_demo
    FROM public.opportunities WHERE id=NEW.opportunity_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opportunity not found.'; END IF;
  IF v_intent.id IS NULL THEN
    IF v_required THEN RAISE EXCEPTION 'This opportunity requires a fresh recipient-bound IM.'; END IF;
    RETURN NEW;
  END IF;
  IF NOT v_required OR v_status<>'active' OR v_intent.actor_kind<>'staff'
    OR v_intent.resource_id IS DISTINCT FROM NEW.opportunity_id
    OR v_intent.bucket_id IS DISTINCT FROM NEW.storage_bucket
    OR v_intent.actor_user_id IS DISTINCT FROM NEW.uploaded_by
    OR v_intent.content_type<>'application/pdf' OR NEW.storage_bucket<>'opportunity-documents'
    OR NEW.storage_path NOT LIKE NEW.opportunity_id::TEXT||'/recipient-im/'||v_intent.related_id::TEXT||'/%'
  THEN RAISE EXCEPTION 'Recipient IM upload intent is stale or mismatched.'; END IF;
  IF v_match.id IS NULL OR v_match.opportunity_id<>NEW.opportunity_id
    OR v_match.status<>'active_pursuit'
    OR NOT EXISTS(SELECT 1 FROM public.repreneurs WHERE id=v_match.repreneur_id AND is_demo=v_demo)
  THEN RAISE EXCEPTION 'Recipient IM pursuit is no longer active in this namespace.'; END IF;
  NEW.recipient_match_id:=v_match.id;
  NEW.recipient_repreneur_id:=v_match.repreneur_id;
  RETURN NEW;
END $$;
CREATE TRIGGER bind_recipient_information_memo_insert BEFORE INSERT ON public.opportunity_documents
  FOR EACH ROW EXECUTE FUNCTION public.bind_recipient_information_memo();
CREATE TRIGGER bind_recipient_information_memo_update BEFORE UPDATE ON public.opportunity_documents
  FOR EACH ROW EXECUTE FUNCTION public.bind_recipient_information_memo();
CREATE TRIGGER bind_recipient_information_memo_delete BEFORE DELETE ON public.opportunity_documents
  FOR EACH ROW EXECUTE FUNCTION public.bind_recipient_information_memo();

-- The grant function already locks the match and proves Gate 2 / sent E7.
-- This trigger adds only the recipient-class boundary, on each new grant.
CREATE OR REPLACE FUNCTION public.guard_recipient_information_memo_grant()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE; v_document public.opportunity_documents%ROWTYPE;
  v_required BOOLEAN;
BEGIN
  IF NEW.revoked_at IS NOT NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id=NEW.match_id FOR SHARE;
  SELECT * INTO v_document FROM public.opportunity_documents WHERE id=NEW.information_memo_document_id;
  SELECT recipient_im_required INTO v_required FROM public.opportunities WHERE id=NEW.opportunity_id FOR SHARE;
  IF v_match.id IS NULL OR v_match.status<>'active_pursuit'
    OR v_match.opportunity_id<>NEW.opportunity_id OR v_document.id IS NULL
    OR v_document.opportunity_id<>NEW.opportunity_id
    OR EXISTS(SELECT 1 FROM public.recipient_im_cleanup WHERE document_id=v_document.id)
  THEN RAISE EXCEPTION 'Recipient IM grant is unavailable.'; END IF;
  IF v_document.recipient_match_id IS NULL THEN
    IF v_required THEN RAISE EXCEPTION 'Upload a new IM for this exact repreneur before granting access.'; END IF;
  ELSIF v_document.recipient_match_id<>v_match.id
    OR v_document.recipient_repreneur_id<>v_match.repreneur_id
  THEN RAISE EXCEPTION 'This IM belongs to another repreneur.'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_recipient_information_memo_grant
  BEFORE INSERT OR UPDATE OF information_memo_document_id,revoked_at
  ON public.opportunity_pursuit_confidential_grants
  FOR EACH ROW EXECUTE FUNCTION public.guard_recipient_information_memo_grant();

-- Do not replace Gate 1/2/E7 logic. Extend the exact current-grant predicate
-- with live document ownership and absence of a Drop tombstone.
CREATE OR REPLACE FUNCTION public.journey_repreneur_can_access_confidential(
  p_match_id UUID,p_repreneur_id UUID,p_document_id UUID
) RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT public.wave_journey_is_enabled() AND EXISTS(
    SELECT 1 FROM public.opportunity_matches match
    JOIN public.repreneurs repreneur ON repreneur.id=match.repreneur_id
    JOIN public.opportunities opportunity ON opportunity.id=match.opportunity_id AND opportunity.is_demo=repreneur.is_demo
    JOIN public.opportunity_pursuit_confidential_grants grant_row ON grant_row.match_id=match.id
    JOIN public.opportunity_documents document ON document.id=grant_row.information_memo_document_id
    WHERE match.id=p_match_id AND match.repreneur_id=p_repreneur_id AND match.status='active_pursuit'
      AND opportunity.status='active'
      AND grant_row.information_memo_document_id=p_document_id
      AND document.opportunity_id=match.opportunity_id AND document.document_type='deal_book'
      AND (document.recipient_match_id IS NULL OR
        (document.recipient_match_id=match.id AND document.recipient_repreneur_id=match.repreneur_id))
      AND NOT EXISTS(SELECT 1 FROM public.recipient_im_cleanup WHERE document_id=document.id)
      AND grant_row.revoked_at IS NULL AND grant_row.nda_expires_at>NOW()
      AND grant_row.cycle_started_evidence_id=public.journey_current_cycle_event(match.id)
      AND grant_row.gate_2_evidence_id=public.journey_current_gate_2_event(match.id)
      AND grant_row.dispatch_evidence_id=public.journey_current_dispatch_event(match.id)
  )
$$;

CREATE OR REPLACE FUNCTION public.recipient_im_staff_can_read(p_document_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_document public.opportunity_documents%ROWTYPE; v_match public.opportunity_matches%ROWTYPE;
BEGIN
  SELECT * INTO v_document FROM public.opportunity_documents WHERE id=p_document_id;
  IF v_document.id IS NULL OR v_document.recipient_match_id IS NULL THEN RETURN FALSE; END IF;
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id=v_document.recipient_match_id FOR SHARE;
  RETURN v_match.id IS NOT NULL AND v_match.status='active_pursuit'
    AND v_match.opportunity_id=v_document.opportunity_id
    AND v_match.repreneur_id=v_document.recipient_repreneur_id
    AND NOT EXISTS(SELECT 1 FROM public.recipient_im_cleanup WHERE document_id=p_document_id);
END $$;

-- Deferred so the canonical Drop function can first append its immutable
-- reason-bearing event. Failure rolls the Drop back rather than leaving access
-- revoked without a durable cleanup target. The match row lock serializes
-- this transition with grant and personalized-upload finalization.
CREATE OR REPLACE FUNCTION public.queue_dropped_recipient_information_memos()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_event public.opportunity_pursuit_evidence%ROWTYPE;
BEGIN
  IF OLD.status IS DISTINCT FROM 'active_pursuit' OR NEW.status IS DISTINCT FROM 'dropped'
  THEN RETURN NULL; END IF;
  SELECT * INTO v_event FROM public.opportunity_pursuit_evidence
    WHERE match_id=NEW.id AND event_type='dropped'
      AND actor=NEW.pursuit_stage_updated_by
      AND recorded_at>=NEW.pursuit_stage_updated_at
    ORDER BY recorded_at DESC,id DESC LIMIT 1;
  IF v_event.id IS NULL OR btrim(coalesce(v_event.evidence_reference,''))=''
  THEN RAISE EXCEPTION 'Recipient IM cleanup requires canonical Drop evidence.'; END IF;
  INSERT INTO public.recipient_im_cleanup(document_id,opportunity_id,match_id,repreneur_id,
    storage_bucket,storage_path,dropped_by,dropped_at,drop_reason)
  SELECT document.id,document.opportunity_id,NEW.id,NEW.repreneur_id,
    document.storage_bucket,document.storage_path,v_event.actor,v_event.recorded_at,v_event.evidence_reference
  FROM public.opportunity_documents document WHERE document.recipient_match_id=NEW.id
    AND document.recipient_repreneur_id=NEW.repreneur_id
  ON CONFLICT(document_id) DO NOTHING;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER queue_dropped_recipient_information_memos
  AFTER UPDATE OF status ON public.opportunity_matches DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.queue_dropped_recipient_information_memos();

CREATE OR REPLACE FUNCTION public.record_recipient_im_cleanup_attempt(
  p_document_id UUID,p_result TEXT,p_error_code TEXT DEFAULT NULL
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_cleanup public.recipient_im_cleanup%ROWTYPE;
BEGIN
  IF p_result NOT IN ('failed','deleted') THEN RAISE EXCEPTION 'Invalid cleanup result.'; END IF;
  SELECT * INTO v_cleanup FROM public.recipient_im_cleanup WHERE document_id=p_document_id FOR UPDATE;
  IF v_cleanup.document_id IS NULL THEN RAISE EXCEPTION 'Recipient IM cleanup not found.'; END IF;
  IF v_cleanup.status='deleted' THEN RETURN 'deleted'; END IF;
  UPDATE public.recipient_im_cleanup SET status=p_result,
    attempt_count=attempt_count+1,last_attempt_at=clock_timestamp(),
    last_error_code=CASE WHEN p_result='failed' THEN left(coalesce(p_error_code,'storage_remove_failed'),80) ELSE NULL END,
    deletion_receipt_at=CASE WHEN p_result='deleted' THEN clock_timestamp() ELSE NULL END
  WHERE document_id=p_document_id;
  RETURN p_result;
END $$;

REVOKE ALL ON FUNCTION public.set_opportunity_recipient_im_required(UUID,BOOLEAN,TEXT),
  public.bind_recipient_information_memo(),public.guard_recipient_information_memo_grant(),
  public.queue_dropped_recipient_information_memos(),
  public.recipient_im_staff_can_read(UUID),
  public.record_recipient_im_cleanup_attempt(UUID,TEXT,TEXT)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.set_opportunity_recipient_im_required(UUID,BOOLEAN,TEXT),
  public.recipient_im_staff_can_read(UUID),
  public.record_recipient_im_cleanup_attempt(UUID,TEXT,TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.journey_repreneur_can_access_confidential(UUID,UUID,UUID)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.journey_repreneur_can_access_confidential(UUID,UUID,UUID) TO service_role;

COMMENT ON TABLE public.recipient_im_cleanup IS
  'Exact private-object deletion receipt after canonical Drop; the IM document row and grant/evidence references remain tombstones.';
COMMIT;
