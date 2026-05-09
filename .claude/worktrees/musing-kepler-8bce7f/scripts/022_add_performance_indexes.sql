-- Performance indexes migration
-- Run in Supabase Dashboard > SQL Editor

-- Index for activity queries (filter by repreneur, sort by date)
CREATE INDEX IF NOT EXISTS idx_activities_repreneur_created
ON public.activities(repreneur_id, created_at DESC);

-- Index for notes queries (filter by repreneur, sort by date)
CREATE INDEX IF NOT EXISTS idx_notes_repreneur_created
ON public.notes(repreneur_id, created_at DESC);

-- Index for email log queries (filter by status and date)
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_status
ON public.email_logs(sent_at DESC, status);

-- Index for email log analytics by template
CREATE INDEX IF NOT EXISTS idx_email_logs_template
ON public.email_logs(template_key);

-- Index for repreneur filtering and sorting
CREATE INDEX IF NOT EXISTS idx_repreneurs_lifecycle_created
ON public.repreneurs(lifecycle_status, created_at DESC);

-- Index for repreneur email lookups (intake duplicate check)
CREATE INDEX IF NOT EXISTS idx_repreneurs_email
ON public.repreneurs(email);

-- Atomic email counter function (for race condition fix)
CREATE OR REPLACE FUNCTION increment_email_count(target_date DATE)
RETURNS void AS $$
BEGIN
  INSERT INTO email_daily_counts (date, count)
  VALUES (target_date, 1)
  ON CONFLICT (date)
  DO UPDATE SET count = email_daily_counts.count + 1;
END;
$$ LANGUAGE plpgsql;
