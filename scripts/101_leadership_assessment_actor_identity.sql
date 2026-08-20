-- Repair the legacy Supabase Auth sender type without discarding attribution.
-- Better Auth user IDs are opaque TEXT values and are not guaranteed UUIDs.
-- Production preflight confirms this column has no foreign-key constraint; fail
-- rather than silently removing an unexpected contract if another environment
-- has drifted.

ALTER TABLE public.leadership_assessments
  ALTER COLUMN sent_by TYPE TEXT USING sent_by::text;

COMMENT ON COLUMN public.leadership_assessments.sent_by IS
  'Better Auth user ID (TEXT) of the staff actor who issued this assessment link. NULL is retained only for legacy rows without recorded attribution.';
