-- Fix: Enable RLS on offer_milestones table
-- Run this in Supabase SQL Editor
-- This fixes the security warning: "RLS Disabled in Public"

-- Enable Row Level Security
ALTER TABLE public.offer_milestones ENABLE ROW LEVEL SECURITY;

-- Check if policies already exist before creating them
-- If you get "policy already exists" errors, that's OK - just means RLS policies were already created

-- These policies allow any authenticated user to interact with milestones
-- (Matching the pattern used for other tables in this project)

DO $$
BEGIN
  -- SELECT policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'offer_milestones' AND policyname = 'Users can view offer milestones') THEN
    CREATE POLICY "Users can view offer milestones" ON public.offer_milestones
      FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;

  -- INSERT policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'offer_milestones' AND policyname = 'Users can insert offer milestones') THEN
    CREATE POLICY "Users can insert offer milestones" ON public.offer_milestones
      FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  -- UPDATE policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'offer_milestones' AND policyname = 'Users can update offer milestones') THEN
    CREATE POLICY "Users can update offer milestones" ON public.offer_milestones
      FOR UPDATE USING (auth.uid() IS NOT NULL);
  END IF;

  -- DELETE policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'offer_milestones' AND policyname = 'Users can delete offer milestones') THEN
    CREATE POLICY "Users can delete offer milestones" ON public.offer_milestones
      FOR DELETE USING (auth.uid() IS NOT NULL);
  END IF;
END $$;
