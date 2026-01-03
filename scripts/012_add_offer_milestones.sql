-- Migration: Add offer milestones table
-- Run this in Supabase SQL Editor

-- Create offer_milestones table
CREATE TABLE IF NOT EXISTS public.offer_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repreneur_offer_id UUID NOT NULL REFERENCES public.repreneur_offers(id) ON DELETE CASCADE,
  milestone_type TEXT NOT NULL CHECK (milestone_type IN ('deliverable', 'checkpoint')),
  title TEXT NOT NULL,
  notes TEXT,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_offer_milestones_repreneur_offer_id
  ON public.offer_milestones(repreneur_offer_id);

-- Enable RLS
ALTER TABLE public.offer_milestones ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (same pattern as other tables)
CREATE POLICY "Users can view offer milestones" ON public.offer_milestones
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert offer milestones" ON public.offer_milestones
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update offer milestones" ON public.offer_milestones
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete offer milestones" ON public.offer_milestones
  FOR DELETE USING (auth.uid() IS NOT NULL);
