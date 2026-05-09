-- Create activities table for tracking interactions with repreneurs
-- This is the "Activity History" feature for logging communications and meetings

CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repreneur_id UUID NOT NULL REFERENCES public.repreneurs(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'welcome_email',
    'interview',
    'offer_submitted',
    'offer_rejected',
    'offer_approved',
    'meeting'
  )),
  notes TEXT,
  duration_minutes INTEGER, -- For future cost analytics
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_activities_repreneur_id ON public.activities(repreneur_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON public.activities(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Authenticated users can perform all operations
CREATE POLICY "Authenticated users can view all activities"
  ON public.activities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert activities"
  ON public.activities FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update activities"
  ON public.activities FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete activities"
  ON public.activities FOR DELETE
  TO authenticated
  USING (true);

-- Add comment for documentation
COMMENT ON TABLE public.activities IS 'Tracks all interactions and activities with repreneurs (emails, interviews, meetings, offers)';
COMMENT ON COLUMN public.activities.duration_minutes IS 'Duration of the activity in minutes, used for future cost estimation per candidate';
