-- Create offers table
CREATE TABLE IF NOT EXISTS public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL,
  duration_days INTEGER NOT NULL,
  acceptance_deadline_days INTEGER NOT NULL,
  includes_hours NUMERIC(10, 2) NOT NULL,
  includes_resources BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on is_active for filtering active offers
CREATE INDEX IF NOT EXISTS idx_offers_is_active ON public.offers(is_active);

-- Enable Row Level Security
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Authenticated users can perform all operations
CREATE POLICY "Authenticated users can view all offers"
  ON public.offers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert offers"
  ON public.offers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update offers"
  ON public.offers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete offers"
  ON public.offers FOR DELETE
  TO authenticated
  USING (true);
