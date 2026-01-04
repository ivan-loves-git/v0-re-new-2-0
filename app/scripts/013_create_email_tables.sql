-- Migration: Create email automation tables
-- Run this in Supabase SQL Editor

-- =============================================
-- 1. Email Templates Table
-- =============================================
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT UNIQUE NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  requires_consent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default templates
INSERT INTO public.email_templates (template_key, subject, description, requires_consent) VALUES
  ('welcome', 'Bienvenue chez Re-New!', 'Welcome email after first contact capture', FALSE),
  ('form_step_complete', 'Your Re-New profile is taking shape', 'Sent after completing step 1 of intake', TRUE),
  ('abandoned_reminder', 'Complete your Re-New profile', 'Reminder for incomplete forms (48h)', TRUE),
  ('thank_you', 'Thank you for completing your Re-New profile', 'Sent after full form completion', FALSE),
  ('high_score_alert', 'Exciting news about your Re-New profile', 'High potential notification (70+ score)', TRUE),
  ('offer_received', 'You have received an offer from Re-New', 'Offer notification', FALSE),
  ('milestone_completed', 'Milestone achieved!', 'Milestone completion notification', FALSE),
  ('offer_accepted', 'Your offer has been accepted', 'Offer acceptance confirmation', FALSE),
  ('offer_activated', 'Your Re-New journey begins', 'Offer activation notification', FALSE),
  ('rejection', 'Update on your Re-New application', 'Rejection notification', FALSE)
ON CONFLICT (template_key) DO NOTHING;

-- =============================================
-- 2. Email Logs Table
-- =============================================
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repreneur_id UUID NOT NULL REFERENCES public.repreneurs(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,
  resend_id TEXT,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_email_logs_repreneur_id ON public.email_logs(repreneur_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_template_key ON public.email_logs(template_key);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON public.email_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON public.email_logs(created_at);

-- =============================================
-- 3. Intake Abandonment Tracking Table
-- =============================================
CREATE TABLE IF NOT EXISTS public.intake_abandonment_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repreneur_id UUID NOT NULL REFERENCES public.repreneurs(id) ON DELETE CASCADE,
  last_step_completed INTEGER NOT NULL DEFAULT 1,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reminder_sent_at TIMESTAMPTZ,
  reminder_count INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one tracking record per repreneur
CREATE UNIQUE INDEX IF NOT EXISTS idx_abandonment_repreneur_unique
  ON public.intake_abandonment_tracking(repreneur_id);

CREATE INDEX IF NOT EXISTS idx_abandonment_activity
  ON public.intake_abandonment_tracking(last_activity_at);

CREATE INDEX IF NOT EXISTS idx_abandonment_incomplete
  ON public.intake_abandonment_tracking(is_completed, last_activity_at)
  WHERE is_completed = FALSE;

-- =============================================
-- 4. Daily Email Counter (for rate limiting)
-- =============================================
CREATE TABLE IF NOT EXISTS public.email_daily_counts (
  date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
  count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- 5. Enable RLS
-- =============================================
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intake_abandonment_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_daily_counts ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 6. RLS Policies
-- =============================================

-- Email Templates: Read-only for authenticated users
CREATE POLICY "Users can view email templates" ON public.email_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update email templates" ON public.email_templates
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Email Logs: Full access for authenticated users
CREATE POLICY "Users can view email logs" ON public.email_logs
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert email logs" ON public.email_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update email logs" ON public.email_logs
  FOR UPDATE USING (true);

-- Intake Abandonment: Full access for authenticated users + service role
CREATE POLICY "Users can view abandonment tracking" ON public.intake_abandonment_tracking
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert abandonment tracking" ON public.intake_abandonment_tracking
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update abandonment tracking" ON public.intake_abandonment_tracking
  FOR UPDATE USING (true);

-- Daily Counts: Full access
CREATE POLICY "Anyone can view daily counts" ON public.email_daily_counts
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert daily counts" ON public.email_daily_counts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update daily counts" ON public.email_daily_counts
  FOR UPDATE USING (true);

-- =============================================
-- 7. Updated_at trigger for templates
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
