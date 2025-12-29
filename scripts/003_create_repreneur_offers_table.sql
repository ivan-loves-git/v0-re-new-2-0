-- Create enum for repreneur offer status
DO $$ BEGIN
  CREATE TYPE repreneur_offer_status AS ENUM ('offered', 'accepted', 'active', 'completed', 'expired');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create repreneur_offers junction table
CREATE TABLE IF NOT EXISTS public.repreneur_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repreneur_id UUID NOT NULL REFERENCES public.repreneurs(id) ON DELETE CASCADE,
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  status repreneur_offer_status NOT NULL DEFAULT 'offered',
  offered_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_repreneur_offers_repreneur_id ON public.repreneur_offers(repreneur_id);
CREATE INDEX IF NOT EXISTS idx_repreneur_offers_offer_id ON public.repreneur_offers(offer_id);
CREATE INDEX IF NOT EXISTS idx_repreneur_offers_status ON public.repreneur_offers(status);

-- Enable Row Level Security
ALTER TABLE public.repreneur_offers ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Authenticated users can perform all operations
CREATE POLICY "Authenticated users can view all repreneur offers"
  ON public.repreneur_offers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert repreneur offers"
  ON public.repreneur_offers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update repreneur offers"
  ON public.repreneur_offers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete repreneur offers"
  ON public.repreneur_offers FOR DELETE
  TO authenticated
  USING (true);
