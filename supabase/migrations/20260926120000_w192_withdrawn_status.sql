-- Decision #184 / Ticket #204. Kept separate because PostgreSQL cannot use a
-- newly added enum label in the same migration transaction.
ALTER TYPE public.opportunity_match_status ADD VALUE IF NOT EXISTS 'withdrawn';
