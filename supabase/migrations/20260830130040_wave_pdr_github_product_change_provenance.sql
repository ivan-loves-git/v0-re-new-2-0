-- Governance #41: an approved WAVE intake may point to one canonical GitHub
-- Product Change. This is provenance only; delivery state remains in GitHub.
ALTER TABLE public.pdr_proposals
  ADD COLUMN IF NOT EXISTS github_product_change_number INTEGER,
  ADD COLUMN IF NOT EXISTS github_product_change_url TEXT,
  ADD COLUMN IF NOT EXISTS github_product_change_correlation_id TEXT,
  ADD COLUMN IF NOT EXISTS github_product_change_linked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS github_product_change_linked_by TEXT;

ALTER TABLE public.pdr_proposals
  DROP CONSTRAINT IF EXISTS pdr_proposals_github_product_change_provenance_check,
  ADD CONSTRAINT pdr_proposals_github_product_change_provenance_check
    CHECK (
      (
        github_product_change_number IS NULL
        AND github_product_change_url IS NULL
        AND github_product_change_correlation_id IS NULL
        AND github_product_change_linked_at IS NULL
        AND github_product_change_linked_by IS NULL
      )
      OR (
        github_product_change_number IS NOT NULL
        AND github_product_change_url IS NOT NULL
        AND github_product_change_correlation_id IS NOT NULL
        AND github_product_change_linked_at IS NOT NULL
        AND github_product_change_linked_by IS NOT NULL
        AND github_product_change_number > 0
        AND github_product_change_url = 'https://github.com/re-new-team/renew-governance/issues/' || github_product_change_number::TEXT
        AND github_product_change_correlation_id = 'wave-pdr-proposal:' || id::TEXT
        AND NULLIF(BTRIM(github_product_change_linked_by), '') IS NOT NULL
      )
    );

CREATE UNIQUE INDEX IF NOT EXISTS pdr_proposals_github_product_change_number_unique
  ON public.pdr_proposals(github_product_change_number)
  WHERE github_product_change_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pdr_proposals_github_product_change_correlation_unique
  ON public.pdr_proposals(github_product_change_correlation_id)
  WHERE github_product_change_correlation_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.wave_pdr_product_change_provenance_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.github_product_change_number IS NOT NULL
    AND (
      NEW.github_product_change_number IS DISTINCT FROM OLD.github_product_change_number
      OR NEW.github_product_change_url IS DISTINCT FROM OLD.github_product_change_url
      OR NEW.github_product_change_correlation_id IS DISTINCT FROM OLD.github_product_change_correlation_id
      OR NEW.github_product_change_linked_at IS DISTINCT FROM OLD.github_product_change_linked_at
      OR NEW.github_product_change_linked_by IS DISTINCT FROM OLD.github_product_change_linked_by
    ) THEN
    RAISE EXCEPTION 'wave_pdr_product_change_provenance_immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wave_pdr_product_change_provenance_immutable ON public.pdr_proposals;
CREATE TRIGGER wave_pdr_product_change_provenance_immutable
  BEFORE UPDATE OF github_product_change_number, github_product_change_url,
    github_product_change_correlation_id, github_product_change_linked_at,
    github_product_change_linked_by
  ON public.pdr_proposals
  FOR EACH ROW EXECUTE FUNCTION public.wave_pdr_product_change_provenance_immutable();

COMMENT ON CONSTRAINT pdr_proposals_github_product_change_provenance_check ON public.pdr_proposals
  IS 'Either no GitHub provenance or one complete canonical Product Change link; browser roles retain their existing read-only access and service_role remains the mutation path.';
NOTIFY pgrst, 'reload schema';
