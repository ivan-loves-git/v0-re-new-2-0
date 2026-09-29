-- PostgreSQL requires these enum labels to commit before any function may use
-- them. The guarded catch-up operator follows in the next migration.
ALTER TYPE public.opportunity_pursuit_stage ADD VALUE IF NOT EXISTS 'nda_signed' AFTER 'interest';
ALTER TYPE public.opportunity_pursuit_stage ADD VALUE IF NOT EXISTS 'qa_with_ma_firm' AFTER 'info_memo_received';
