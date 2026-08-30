-- Governance #40: saved staff-approved screening previews only. Prompts,
-- provider bodies, attachment information and secrets are intentionally absent.
CREATE TABLE IF NOT EXISTS public.wave_pdr_screening_records (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.pdr_proposals(id) ON DELETE RESTRICT,
  created_by_user_id TEXT NOT NULL CHECK (char_length(btrim(created_by_user_id)) BETWEEN 1 AND 160),
  output JSONB NOT NULL,
  governance_snapshot_id UUID NOT NULL,
  governance_snapshot_digest TEXT NOT NULL CHECK (governance_snapshot_digest ~ '^[a-f0-9]{64}$'),
  registry_revision TEXT NOT NULL CHECK (char_length(btrim(registry_revision)) BETWEEN 1 AND 160),
  governance_snapshot_at TIMESTAMPTZ NOT NULL,
  freshness TEXT NOT NULL CHECK (freshness IN ('fresh','stale')),
  prompt_version TEXT NOT NULL CHECK (char_length(btrim(prompt_version)) BETWEEN 1 AND 80),
  output_schema_version TEXT NOT NULL CHECK (char_length(btrim(output_schema_version)) BETWEEN 1 AND 80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT wave_pdr_screening_output_object CHECK (jsonb_typeof(output) = 'object')
);
CREATE INDEX IF NOT EXISTS wave_pdr_screening_records_proposal_idx ON public.wave_pdr_screening_records(proposal_id, created_at DESC);
ALTER TABLE public.wave_pdr_screening_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wave_pdr_screening_records FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.wave_pdr_screening_records FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.wave_pdr_screening_records TO service_role;
COMMENT ON TABLE public.wave_pdr_screening_records IS 'Server-only explicit saves of allowlisted PDR AI screening output and immutable governance snapshot metadata. No prompts, provider responses, attachment metadata, request bodies or secrets.';
NOTIFY pgrst, 'reload schema';
