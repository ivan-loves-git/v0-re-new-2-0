-- Migration: Add 'declined' status for manual internal decisions
-- Date: 2026-02-01
-- Purpose: Distinguish between "rejected" (sends email to candidate) and "declined" (internal decision, no email)

-- Add 'declined' to the lifecycle_status enum
ALTER TYPE lifecycle_status ADD VALUE IF NOT EXISTS 'declined';

-- Add declined_at timestamp column
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ;

-- Add comment for clarity
COMMENT ON COLUMN public.repreneurs.declined_at IS 'Timestamp when admin manually declined this repreneur (internal decision, no email sent)';
COMMENT ON COLUMN public.repreneurs.rejected_at IS 'Timestamp when repreneur was rejected (sends rejection email to candidate)';
