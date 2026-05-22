-- Migration: Phase 8 info memo pursuit stage
-- Purpose: Track when the M&A info memo has been received before an intermediary meeting.

ALTER TYPE public.opportunity_pursuit_stage
  ADD VALUE IF NOT EXISTS 'info_memo_received' AFTER 'interest';
