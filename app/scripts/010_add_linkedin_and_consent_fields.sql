-- Add LinkedIn URL and GDPR consent fields to repreneurs table
-- These fields support source tracking and compliance requirements

-- LinkedIn URL for candidate profile
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS linkedin_url TEXT;

-- GDPR Consent fields
-- marketing_consent: whether the candidate has consented to marketing communications
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN DEFAULT FALSE;

-- consent_timestamp: when consent was given (or explicitly declined)
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS consent_timestamp TIMESTAMPTZ;

-- consent_source: where/how consent was captured (e.g., "intake_form", "email", "manual")
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS consent_source TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.repreneurs.linkedin_url IS 'LinkedIn profile URL for the repreneur';
COMMENT ON COLUMN public.repreneurs.marketing_consent IS 'Whether the repreneur has consented to marketing communications (GDPR)';
COMMENT ON COLUMN public.repreneurs.consent_timestamp IS 'When marketing consent was given or declined';
COMMENT ON COLUMN public.repreneurs.consent_source IS 'Where/how consent was captured (intake_form, email, manual, etc.)';
