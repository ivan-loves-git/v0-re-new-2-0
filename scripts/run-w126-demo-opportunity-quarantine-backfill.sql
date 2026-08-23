-- Manual, staff-confirmed production operation only. This file is deliberately
-- separate from migration 112: deploying the eligibility guard never classifies
-- live records by itself. Run only after the Gate 2 manifest has been reviewed.
BEGIN;
SELECT * FROM public.apply_w126_demo_opportunity_quarantine('staff-confirmed-w126-backfill');
COMMIT;
