-- Keep the persisted email status contract aligned with the supported Resend
-- webhook event map. The application already renders complaint outcomes, but
-- the legacy check constraint rejected that exact status.

ALTER TABLE public.email_logs
  DROP CONSTRAINT email_logs_status_check;

ALTER TABLE public.email_logs
  ADD CONSTRAINT email_logs_status_check
  CHECK (status IN (
    'pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'complained'
  ));
