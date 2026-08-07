-- W-090/W-091 disposable companion. Run only after loading the production
-- schema into an empty local database and applying migration 088.
-- It is deliberately transactional: fixtures and evidence never survive.
BEGIN;

DO $$
BEGIN
  IF NOT public.wave_journey_is_enabled() = FALSE THEN
    RAISE EXCEPTION 'Rehearsal must begin with the WAVE journey disabled.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='journey_current_gate_1_event')
    OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='journey_current_gate_2_event')
    OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='journey_current_dispatch_event') THEN
    RAISE EXCEPTION 'Migration 088 canonical authority functions are missing.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='opportunity_pursuit_confidential_grants' AND column_name='nda_expires_at') THEN
    RAISE EXCEPTION 'Required grant expiry column is missing.';
  END IF;
END $$;

-- The fixture runner supplies one complete synthetic path and asserts that:
-- * another mutual-interest event invalidates every old Gate/dispatch/grant;
-- * template or signed-copy replacement invalidates Gate 1/2;
-- * duplicate same-hash portal upload returns the existing artifact under lock;
-- * direct staff repreneur-copy registration rejects;
-- * dispatch before exact Gate 2 and grant before dispatch reject;
-- * expiry, revocation, pause, close/archive, drop/reopen deny access;
-- * a regrant records a second immutable disclosure snapshot; and
-- * migration backfill inserts only mutual_interest_validated.
ROLLBACK;
