-- Migration: Confidentiality wall and live-source invariant
-- Purpose: Keep staff-only opportunity/provenance data off browser database and
-- storage APIs, require a canonical source before activation, and make memo
-- disclosure depend on recorded NDA and staff approval evidence.
--
-- This is deliberately additive. It does not backfill, rewrite, delete, merge,
-- or otherwise change any existing opportunity, source, match, or document.
-- Legacy repreneur-approved documents and signed/waived matches remain without
-- the new evidence and therefore stay unavailable until staff records it.

BEGIN;

-- Live opportunities must have a real canonical source record. `NOT VALID`
-- keeps this safe for historical rows while enforcing the invariant for every
-- future insert or update.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'opportunities_active_requires_source'
      AND conrelid = 'public.opportunities'::regclass
  ) THEN
    ALTER TABLE public.opportunities
      ADD CONSTRAINT opportunities_active_requires_source
      CHECK (status <> 'active' OR source_id IS NOT NULL)
      NOT VALID;
  END IF;
END;
$$;

-- A waived NDA is an explicit staff decision, not a status-only shortcut.
ALTER TABLE public.opportunity_matches
  ADD COLUMN IF NOT EXISTS nda_waived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nda_waived_by TEXT;

COMMENT ON COLUMN public.opportunity_matches.nda_waived_at IS
  'When staff recorded the explicit waiver that permits a repreneur memo disclosure.';
COMMENT ON COLUMN public.opportunity_matches.nda_waived_by IS
  'Staff user who recorded the explicit NDA waiver.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'opportunity_matches_signed_requires_evidence'
      AND conrelid = 'public.opportunity_matches'::regclass
  ) THEN
    ALTER TABLE public.opportunity_matches
      ADD CONSTRAINT opportunity_matches_signed_requires_evidence
      CHECK (nda_status <> 'signed' OR nda_signed_at IS NOT NULL)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'opportunity_matches_waived_requires_evidence'
      AND conrelid = 'public.opportunity_matches'::regclass
  ) THEN
    ALTER TABLE public.opportunity_matches
      ADD CONSTRAINT opportunity_matches_waived_requires_evidence
      CHECK (
        nda_status <> 'waived'
        OR (
          nda_waived_at IS NOT NULL
          AND NULLIF(BTRIM(nda_waived_by), '') IS NOT NULL
        )
      )
      NOT VALID;
  END IF;
END;
$$;

-- Visibility is still a staff choice, but disclosure also needs a durable
-- actor-and-time record. Existing visible documents are intentionally not
-- backfilled or automatically approved.
ALTER TABLE public.opportunity_documents
  ADD COLUMN IF NOT EXISTS repreneur_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS repreneur_approved_by TEXT;

COMMENT ON COLUMN public.opportunity_documents.repreneur_approved_at IS
  'When a staff member explicitly approved this document for repreneur disclosure.';
COMMENT ON COLUMN public.opportunity_documents.repreneur_approved_by IS
  'Staff user who explicitly approved this document for repreneur disclosure.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'opportunity_documents_repreneur_approval_evidence'
      AND conrelid = 'public.opportunity_documents'::regclass
  ) THEN
    ALTER TABLE public.opportunity_documents
      ADD CONSTRAINT opportunity_documents_repreneur_approval_evidence
      CHECK (
        visibility <> 'approved_for_repreneur'
        OR (
          repreneur_approved_at IS NOT NULL
          AND NULLIF(BTRIM(repreneur_approved_by), '') IS NOT NULL
        )
      )
      NOT VALID;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_opportunity_documents_repreneur_approval
  ON public.opportunity_documents(opportunity_id, uploaded_at DESC)
  WHERE visibility = 'approved_for_repreneur'
    AND repreneur_approved_at IS NOT NULL;

-- Browser clients use the anonymous/authenticated Supabase roles. All product
-- reads and writes for these staff-only records happen in server actions and
-- routes through the service role after Better Auth role checks.
ALTER TABLE public.ma_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ma_source_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_pursuit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view ma sources" ON public.ma_sources;
DROP POLICY IF EXISTS "Authenticated users can insert ma sources" ON public.ma_sources;
DROP POLICY IF EXISTS "Authenticated users can update ma sources" ON public.ma_sources;
DROP POLICY IF EXISTS "Authenticated users can delete ma sources" ON public.ma_sources;

DROP POLICY IF EXISTS "Authenticated users can view opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Authenticated users can insert opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Authenticated users can update opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Authenticated users can delete opportunities" ON public.opportunities;

DROP POLICY IF EXISTS "Authenticated users can view opportunity matches" ON public.opportunity_matches;
DROP POLICY IF EXISTS "Authenticated users can insert opportunity matches" ON public.opportunity_matches;
DROP POLICY IF EXISTS "Authenticated users can update opportunity matches" ON public.opportunity_matches;
DROP POLICY IF EXISTS "Authenticated users can delete opportunity matches" ON public.opportunity_matches;

DROP POLICY IF EXISTS "Authenticated users can view opportunity documents" ON public.opportunity_documents;
DROP POLICY IF EXISTS "Authenticated users can insert opportunity documents" ON public.opportunity_documents;
DROP POLICY IF EXISTS "Authenticated users can update opportunity documents" ON public.opportunity_documents;
DROP POLICY IF EXISTS "Authenticated users can delete opportunity documents" ON public.opportunity_documents;

DROP POLICY IF EXISTS "Authenticated users can view ma source interactions" ON public.ma_source_interactions;
DROP POLICY IF EXISTS "Authenticated users can insert ma source interactions" ON public.ma_source_interactions;

DROP POLICY IF EXISTS "Authenticated users can view opportunity pursuit events" ON public.opportunity_pursuit_events;
DROP POLICY IF EXISTS "Authenticated users can insert opportunity pursuit events" ON public.opportunity_pursuit_events;

REVOKE ALL ON TABLE
  public.ma_sources,
  public.opportunities,
  public.opportunity_matches,
  public.opportunity_documents,
  public.ma_source_interactions,
  public.opportunity_pursuit_events
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.ma_sources,
  public.opportunities,
  public.opportunity_matches,
  public.opportunity_documents,
  public.ma_source_interactions,
  public.opportunity_pursuit_events
TO service_role;

REVOKE USAGE ON TYPE
  public.opportunity_status,
  public.opportunity_visibility,
  public.ma_source_type,
  public.opportunity_document_type,
  public.opportunity_document_visibility,
  public.opportunity_match_recommendation,
  public.opportunity_match_status,
  public.opportunity_nda_status,
  public.opportunity_pursuit_stage
FROM PUBLIC, anon, authenticated;

GRANT USAGE ON TYPE
  public.opportunity_status,
  public.opportunity_visibility,
  public.ma_source_type,
  public.opportunity_document_type,
  public.opportunity_document_visibility,
  public.opportunity_match_recommendation,
  public.opportunity_match_status,
  public.opportunity_nda_status,
  public.opportunity_pursuit_stage
TO service_role;

-- Keep the private opportunity-documents bucket private at the storage API as
-- well. Server-side signed URLs remain available because the service role
-- bypasses these browser-role policies.
DROP POLICY IF EXISTS "Authenticated users can view opportunity documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload opportunity documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update opportunity documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete opportunity documents" ON storage.objects;

-- Memo notifications now use the same disclosure evidence as the portal: a
-- signed NDA needs its recorded signature, a waiver needs a staff record, and
-- the deal book needs an explicit staff approval record.
CREATE OR REPLACE FUNCTION public.claim_opportunity_memo_notification(
  p_opportunity_id UUID,
  p_match_id UUID DEFAULT NULL,
  p_attempted_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  match_id UUID,
  opportunity_id UUID,
  repreneur_id UUID,
  recipient_email TEXT,
  repreneur_first_name TEXT,
  opportunity_title TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match_id UUID;
  v_repreneur_id UUID;
  v_recipient_email TEXT;
  v_repreneur_first_name TEXT;
  v_opportunity_title TEXT;
  v_claimed_match_id UUID;
BEGIN
  SELECT
    om.id,
    om.repreneur_id,
    BTRIM(r.email),
    COALESCE(NULLIF(BTRIM(r.first_name), ''), 'Madame, Monsieur'),
    COALESCE(NULLIF(BTRIM(o.public_title), ''), 'votre opportunite')
  INTO
    v_match_id,
    v_repreneur_id,
    v_recipient_email,
    v_repreneur_first_name,
    v_opportunity_title
  FROM public.opportunity_matches om
  JOIN public.opportunities o ON o.id = om.opportunity_id
  JOIN public.repreneurs r ON r.id = om.repreneur_id
  LEFT JOIN public.opportunity_memo_notifications n ON n.match_id = om.id
  WHERE om.opportunity_id = p_opportunity_id
    AND (p_match_id IS NULL OR om.id = p_match_id)
    AND om.status = 'active_pursuit'
    AND (
      (om.nda_status = 'signed' AND om.nda_signed_at IS NOT NULL)
      OR (
        om.nda_status = 'waived'
        AND om.nda_waived_at IS NOT NULL
        AND NULLIF(BTRIM(om.nda_waived_by), '') IS NOT NULL
      )
    )
    AND NULLIF(BTRIM(r.email), '') IS NOT NULL
    AND (
      n.match_id IS NULL
      OR (
        n.sent_at IS NULL
        AND (
          n.status IN ('pending', 'failed')
          OR (
            n.status = 'sending'
            AND n.last_attempt_at < p_attempted_at - INTERVAL '15 minutes'
          )
        )
      )
    )
    AND EXISTS (
      SELECT 1
      FROM public.opportunity_documents d
      WHERE d.opportunity_id = om.opportunity_id
        AND d.document_type = 'deal_book'
        AND d.visibility = 'approved_for_repreneur'
        AND d.repreneur_approved_at IS NOT NULL
        AND NULLIF(BTRIM(d.repreneur_approved_by), '') IS NOT NULL
        AND (
          NULLIF(BTRIM(d.storage_path), '') IS NOT NULL
          OR NULLIF(BTRIM(d.external_url), '') IS NOT NULL
        )
    )
  ORDER BY om.updated_at DESC
  LIMIT 1
  FOR UPDATE OF om;

  IF v_match_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.opportunity_memo_notifications (
    match_id,
    opportunity_id,
    repreneur_id,
    recipient_email
  )
  VALUES (
    v_match_id,
    p_opportunity_id,
    v_repreneur_id,
    v_recipient_email
  )
  ON CONFLICT ON CONSTRAINT opportunity_memo_notifications_match_id_key DO UPDATE
  SET
    recipient_email = EXCLUDED.recipient_email,
    updated_at = p_attempted_at
  WHERE opportunity_memo_notifications.sent_at IS NULL;

  UPDATE public.opportunity_memo_notifications n
  SET
    status = 'sending',
    attempt_count = n.attempt_count + 1,
    last_attempt_at = p_attempted_at,
    failed_at = NULL,
    last_error = NULL,
    updated_at = p_attempted_at
  WHERE n.match_id = v_match_id
    AND n.sent_at IS NULL
    AND (
      n.status IN ('pending', 'failed')
      OR (
        n.status = 'sending'
        AND n.last_attempt_at < p_attempted_at - INTERVAL '15 minutes'
      )
    )
  RETURNING n.match_id INTO v_claimed_match_id;

  IF v_claimed_match_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY SELECT
    v_match_id,
    p_opportunity_id,
    v_repreneur_id,
    v_recipient_email,
    v_repreneur_first_name,
    v_opportunity_title;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_opportunity_memo_notification(UUID, UUID, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_opportunity_memo_notification(UUID, UUID, TIMESTAMPTZ)
  TO service_role;

COMMIT;
