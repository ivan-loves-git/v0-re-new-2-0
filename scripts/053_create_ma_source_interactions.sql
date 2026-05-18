-- Migration: M&A intermediary workflow interactions
-- Purpose: log opportunity/source-scoped intermediary follow-up without reusing repreneur email logs.

CREATE TABLE IF NOT EXISTS public.ma_source_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  source_id UUID REFERENCES public.ma_sources(id) ON DELETE SET NULL,
  template_key TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  direction TEXT NOT NULL DEFAULT 'outbound',
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_markdown TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ma_source_interactions_opportunity
  ON public.ma_source_interactions(opportunity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ma_source_interactions_source
  ON public.ma_source_interactions(source_id, created_at DESC)
  WHERE source_id IS NOT NULL;

ALTER TABLE public.ma_source_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view ma source interactions" ON public.ma_source_interactions;
CREATE POLICY "Authenticated users can view ma source interactions"
  ON public.ma_source_interactions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert ma source interactions" ON public.ma_source_interactions;
CREATE POLICY "Authenticated users can insert ma source interactions"
  ON public.ma_source_interactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

