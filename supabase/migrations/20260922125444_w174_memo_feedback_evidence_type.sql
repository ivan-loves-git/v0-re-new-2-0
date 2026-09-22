-- Ticket #174: the immutable staff receipt is a canonical pursuit event.
-- PostgreSQL must commit this enum label before a later migration uses it.
ALTER TYPE public.opportunity_pursuit_evidence_type
  ADD VALUE IF NOT EXISTS 'memo_feedback_received';
