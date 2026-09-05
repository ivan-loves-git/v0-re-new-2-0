-- #112: explicit canonical handoff evidence. Kept separate because PostgreSQL
-- enum values must be committed before a consumer migration uses them.
ALTER TYPE public.opportunity_pursuit_evidence_type ADD VALUE IF NOT EXISTS 'e4_qualification_requested';
ALTER TYPE public.opportunity_pursuit_evidence_type ADD VALUE IF NOT EXISTS 'e6_nda_ready_notified';
ALTER TYPE public.opportunity_pursuit_evidence_type ADD VALUE IF NOT EXISTS 'e7_signed_copies_and_memo_requested';
ALTER TYPE public.opportunity_pursuit_evidence_type ADD VALUE IF NOT EXISTS 'e8_memo_enabled_completed';
ALTER TYPE public.opportunity_pursuit_evidence_type ADD VALUE IF NOT EXISTS 'memo_approved';
