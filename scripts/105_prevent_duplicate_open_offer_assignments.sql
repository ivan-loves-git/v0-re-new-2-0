-- A staff member can have the same offer only once while it is awaiting a
-- decision or active. This closes the two-tab race that the UI alone cannot.
-- Historical completed/declined records remain intact.
CREATE UNIQUE INDEX IF NOT EXISTS repreneur_offers_one_open_offer_per_repreneur
  ON public.repreneur_offers (repreneur_id, offer_id)
  WHERE status IN ('offered', 'accepted');
