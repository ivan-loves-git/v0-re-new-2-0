-- Additive #43 provenance gate. The earlier foundation is already live and
-- legacy proposals deliberately remain unmarked historical evidence.

ALTER TABLE public.pdr_proposals
  ADD COLUMN IF NOT EXISTS intake_provenance TEXT;

ALTER TABLE public.pdr_proposals
  DROP CONSTRAINT IF EXISTS pdr_proposals_wave_intake_provenance_check,
  ADD CONSTRAINT pdr_proposals_wave_intake_provenance_check
    CHECK (
      intake_provenance IS NULL
      OR (
        intake_provenance = 'wave_staff_v1'
        AND requester_actor = 'Staff'
        AND NULLIF(BTRIM(requester_user_id), '') IS NOT NULL
      )
    );

CREATE OR REPLACE FUNCTION public.wave_pdr_proposal_intake_provenance_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.intake_provenance IS DISTINCT FROM OLD.intake_provenance THEN
    RAISE EXCEPTION 'wave_pdr_intake_provenance_immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wave_pdr_proposal_intake_provenance_immutable ON public.pdr_proposals;
CREATE TRIGGER wave_pdr_proposal_intake_provenance_immutable
  BEFORE UPDATE OF intake_provenance ON public.pdr_proposals
  FOR EACH ROW EXECUTE FUNCTION public.wave_pdr_proposal_intake_provenance_immutable();

NOTIFY pgrst, 'reload schema';
