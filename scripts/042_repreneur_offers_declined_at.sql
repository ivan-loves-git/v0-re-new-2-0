-- Migration 042: Add declined_at to repreneur_offers
-- When: May 2026
-- Why: Funnel analysis (Alex) needs offer-rejection timestamps. Until now we
--   tracked accepted_at on the offer and declined_at only on the repreneur
--   record (1-to-1, ambiguous when a repreneur has multiple offers).
-- See: lib/actions/offers.ts updateRepreneurOfferStatus — going forward,
--   transitioning an offer to 'declined' will populate declined_at.

ALTER TABLE public.repreneur_offers
  ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ;

-- Best-effort backfill: for currently-declined offers, copy the repreneur's
-- declined_at. Imprecise when a repreneur has more than one declined offer
-- (we only have one repreneur-level timestamp), but better than NULL for the
-- common case. New declines after this migration get a precise per-offer date.
UPDATE public.repreneur_offers ro
SET declined_at = r.declined_at
FROM public.repreneurs r
WHERE ro.repreneur_id = r.id
  AND ro.status = 'declined'
  AND ro.declined_at IS NULL
  AND r.declined_at IS NOT NULL;
