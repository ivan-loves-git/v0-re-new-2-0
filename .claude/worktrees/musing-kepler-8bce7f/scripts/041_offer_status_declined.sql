-- Add 'declined' to repreneur_offer_status enum.
--
-- Needed by lib/actions/activities.ts: when an `offer_rejected` activity is
-- logged, the code calls updateRepreneurOfferStatus(id, "declined", ...). That
-- was a runtime error because the enum only had {offered, accepted, active,
-- completed, expired}. Caught in browser testing 2026-04-24.

ALTER TYPE repreneur_offer_status ADD VALUE IF NOT EXISTS 'declined';
