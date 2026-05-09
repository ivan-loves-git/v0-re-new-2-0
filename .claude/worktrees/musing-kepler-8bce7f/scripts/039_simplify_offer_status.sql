-- Migration 039: Simplify offer statuses
-- When: April 2026
-- Why: Bertrand finds "active" and "expired" confusing.
--   accepted = active by default, expired → completed.
--   Add "declined" status for offers.

-- Migrate existing data
UPDATE repreneur_offers SET status = 'accepted' WHERE status = 'active';
UPDATE repreneur_offers SET status = 'completed' WHERE status = 'expired';
