-- Governance #43 additive foundation. It deliberately keeps legacy public PDR
-- reads intact until #42 final retirement after protected WAVE UAT.

ALTER TABLE public.pdr_proposals
  ADD COLUMN IF NOT EXISTS requester_user_id TEXT,
  ADD COLUMN IF NOT EXISTS requester_display_name TEXT,
  ADD COLUMN IF NOT EXISTS disposition_by_user_id TEXT,
  ADD COLUMN IF NOT EXISTS disposition_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disposition_kind TEXT;

ALTER TABLE public.pdr_proposals
  DROP CONSTRAINT IF EXISTS pdr_proposals_requester_actor_check,
  DROP CONSTRAINT IF EXISTS pdr_proposals_disposition_kind_check,
  DROP CONSTRAINT IF EXISTS pdr_proposals_disposition_audit_check,
  ADD CONSTRAINT pdr_proposals_requester_actor_check
    CHECK (requester_actor IN ('Dev team','qa_person','Colin','Staff')),
  ADD CONSTRAINT pdr_proposals_disposition_kind_check
    CHECK (disposition_kind IS NULL OR disposition_kind IN ('approved','declined')),
  ADD CONSTRAINT pdr_proposals_disposition_audit_check
    CHECK ((disposition_kind IS NULL AND disposition_by_user_id IS NULL AND disposition_at IS NULL)
       OR (disposition_kind IS NOT NULL AND disposition_by_user_id IS NOT NULL AND disposition_at IS NOT NULL));

CREATE TABLE IF NOT EXISTS public.wave_pdr_governance_capabilities (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  actor_user_id TEXT NOT NULL UNIQUE CHECK (NULLIF(BTRIM(actor_user_id),'') IS NOT NULL),
  can_disposition BOOLEAN NOT NULL DEFAULT TRUE CHECK (can_disposition),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  granted_by TEXT NOT NULL CHECK (NULLIF(BTRIM(granted_by),'') IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.wave_pdr_history_attachments (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  proposal_id UUID REFERENCES public.pdr_proposals(id) ON DELETE RESTRICT,
  work_card_id UUID REFERENCES public.pdr_work_cards(id) ON DELETE RESTRICT,
  storage_bucket TEXT NOT NULL DEFAULT 'pdr-intake-attachments' CHECK (storage_bucket='pdr-intake-attachments'),
  storage_path TEXT NOT NULL UNIQUE CHECK (NULLIF(BTRIM(storage_path),'') IS NOT NULL AND storage_path !~ '(^|/)\\.\\.?(/|$)'),
  original_filename TEXT NOT NULL CHECK (CHAR_LENGTH(original_filename) BETWEEN 1 AND 255),
  content_type TEXT NOT NULL CHECK (NULLIF(BTRIM(content_type),'') IS NOT NULL),
  size_bytes BIGINT NOT NULL CHECK (size_bytes BETWEEN 1 AND 20971520),
  uploaded_by_user_id TEXT NOT NULL CHECK (NULLIF(BTRIM(uploaded_by_user_id),'') IS NOT NULL),
  content_sha256 TEXT CHECK (content_sha256 IS NULL OR content_sha256 ~ '^[0-9a-f]{64}$'),
  legacy_source_fingerprint TEXT CHECK (legacy_source_fingerprint IS NULL OR legacy_source_fingerprint ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT wave_pdr_history_attachments_one_parent CHECK ((proposal_id IS NOT NULL)::integer + (work_card_id IS NOT NULL)::integer = 1)
);
CREATE INDEX IF NOT EXISTS wave_pdr_history_attachments_proposal_idx
  ON public.wave_pdr_history_attachments(proposal_id, created_at ASC) WHERE proposal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS wave_pdr_history_attachments_work_card_idx
  ON public.wave_pdr_history_attachments(work_card_id, created_at ASC) WHERE work_card_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS wave_pdr_history_attachments_legacy_fingerprint_unique
  ON public.wave_pdr_history_attachments(legacy_source_fingerprint) WHERE legacy_source_fingerprint IS NOT NULL;

INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES ('pdr-intake-attachments','pdr-intake-attachments',FALSE,20971520,
  ARRAY['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','image/jpeg','image/png']::TEXT[])
ON CONFLICT (id) DO UPDATE SET public=FALSE, file_size_limit=20971520,
  allowed_mime_types=EXCLUDED.allowed_mime_types;

-- New #43 metadata is server-only; existing legacy tables keep their current
-- grants until the separately-gated final retirement migration.
ALTER TABLE public.wave_pdr_governance_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wave_pdr_history_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.wave_pdr_governance_capabilities, public.wave_pdr_history_attachments FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.wave_pdr_governance_capabilities, public.wave_pdr_history_attachments TO service_role;

NOTIFY pgrst, 'reload schema';
