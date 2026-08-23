-- W-126 manual rollback only. No automatic rollback or production mutation.
-- Run only after an explicit staff decision, in one transaction. The stable
-- apply actor prevents this artifact from reversing an unrelated classification.
BEGIN;
SELECT * FROM public.rollback_w126_demo_opportunity_quarantine(
  'staff-confirmed-w126-backfill',
  'staff-confirmed-w126-rollback'
);
COMMIT;
