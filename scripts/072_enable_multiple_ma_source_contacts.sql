-- Migration: Canonical M&A contacts and opportunity contact links
-- Purpose: Keep intermediary firms in their existing ma_sources records, give
-- each firm any number of staff-only contacts, and make the contact used for an
-- opportunity explicit. Legacy ma_sources.contact_* values remain only as a
-- rollback-compatible source for this one-time, idempotent backfill.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ma_source_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.ma_sources(id) ON DELETE RESTRICT,
  name TEXT,
  email TEXT,
  phone TEXT,
  -- The old firm row that seeded this contact. It is intentionally not exposed
  -- by application queries and makes the backfill safe to re-run.
  legacy_source_id UUID,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    NULLIF(BTRIM(name), '') IS NOT NULL
    OR NULLIF(BTRIM(email), '') IS NOT NULL
    OR NULLIF(BTRIM(phone), '') IS NOT NULL
  )
);

ALTER TABLE public.ma_source_contacts
  ADD COLUMN IF NOT EXISTS legacy_source_id UUID;

CREATE TABLE IF NOT EXISTS public.opportunity_source_contacts (
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.ma_sources(id) ON DELETE RESTRICT,
  contact_id UUID NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (opportunity_id, contact_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ma_source_contacts_legacy_source_id
  ON public.ma_source_contacts (legacy_source_id)
  WHERE legacy_source_id IS NOT NULL;

-- Backfill at most one contact from every legacy firm row. Empty legacy values
-- never create placeholder contacts, and the legacy_source_id index prevents a
-- second run from duplicating contacts.
INSERT INTO public.ma_source_contacts (
  source_id,
  name,
  email,
  phone,
  legacy_source_id,
  created_by
)
SELECT
  s.id,
  NULLIF(BTRIM(s.contact_name), ''),
  NULLIF(BTRIM(s.contact_email), ''),
  NULLIF(BTRIM(s.contact_phone), ''),
  s.id,
  s.created_by
FROM public.ma_sources s
WHERE NULLIF(BTRIM(s.contact_name), '') IS NOT NULL
   OR NULLIF(BTRIM(s.contact_email), '') IS NOT NULL
   OR NULLIF(BTRIM(s.contact_phone), '') IS NOT NULL
ON CONFLICT (legacy_source_id) WHERE legacy_source_id IS NOT NULL DO NOTHING;

-- Each existing opportunity receives its firm's backfilled contact as its
-- primary relationship only when it does not already have a primary contact.
-- The DISTINCT ON choice is deterministic for historical duplicate firms.
WITH first_backfilled_contact AS (
  SELECT DISTINCT ON (source_id)
    id,
    source_id
  FROM public.ma_source_contacts
  WHERE legacy_source_id IS NOT NULL
  ORDER BY source_id, created_at ASC, id ASC
)
INSERT INTO public.opportunity_source_contacts (
  opportunity_id,
  source_id,
  contact_id,
  is_primary,
  created_by
)
SELECT
  o.id,
  o.source_id,
  contact.id,
  TRUE,
  o.created_by
FROM public.opportunities o
JOIN first_backfilled_contact contact
  ON contact.source_id = o.source_id
WHERE o.source_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.opportunity_source_contacts existing
    WHERE existing.opportunity_id = o.id
      AND existing.contact_id = contact.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.opportunity_source_contacts primary_contact
    WHERE primary_contact.opportunity_id = o.id
      AND primary_contact.is_primary
  );

-- Interaction rows retain their immutable recipient_email snapshot and gain a
-- staff-only contact link when a primary relationship is available.
ALTER TABLE public.ma_source_interactions
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.ma_source_contacts(id) ON DELETE SET NULL;

UPDATE public.ma_source_interactions interaction
SET contact_id = relation.contact_id
FROM public.opportunity_source_contacts relation
WHERE interaction.contact_id IS NULL
  AND relation.opportunity_id = interaction.opportunity_id
  AND relation.source_id = interaction.source_id
  AND relation.is_primary;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ma_source_contacts_id_source_id_key'
      AND conrelid = 'public.ma_source_contacts'::regclass
  ) THEN
    ALTER TABLE public.ma_source_contacts
      ADD CONSTRAINT ma_source_contacts_id_source_id_key UNIQUE (id, source_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'opportunity_source_contacts_contact_source_fkey'
      AND conrelid = 'public.opportunity_source_contacts'::regclass
  ) THEN
    ALTER TABLE public.opportunity_source_contacts
      ADD CONSTRAINT opportunity_source_contacts_contact_source_fkey
      FOREIGN KEY (contact_id, source_id)
      REFERENCES public.ma_source_contacts(id, source_id)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

-- Repair any manually-created duplicate primaries before making the primary
-- relationship unique. The oldest link remains primary.
WITH ranked_primary_contacts AS (
  SELECT
    opportunity_id,
    contact_id,
    ROW_NUMBER() OVER (
      PARTITION BY opportunity_id
      ORDER BY created_at ASC, contact_id ASC
    ) AS position
  FROM public.opportunity_source_contacts
  WHERE is_primary
)
UPDATE public.opportunity_source_contacts relation
SET is_primary = FALSE
FROM ranked_primary_contacts ranked
WHERE relation.opportunity_id = ranked.opportunity_id
  AND relation.contact_id = ranked.contact_id
  AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunity_source_contacts_primary
  ON public.opportunity_source_contacts (opportunity_id)
  WHERE is_primary;

CREATE INDEX IF NOT EXISTS idx_ma_source_contacts_source_id
  ON public.ma_source_contacts(source_id, name);

CREATE INDEX IF NOT EXISTS idx_ma_source_contacts_email
  ON public.ma_source_contacts(LOWER(BTRIM(email)))
  WHERE NULLIF(BTRIM(email), '') IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_opportunity_source_contacts_opportunity
  ON public.opportunity_source_contacts(opportunity_id, is_primary DESC);

CREATE INDEX IF NOT EXISTS idx_opportunity_source_contacts_contact
  ON public.opportunity_source_contacts(contact_id);

CREATE INDEX IF NOT EXISTS idx_ma_source_interactions_contact
  ON public.ma_source_interactions(contact_id, created_at DESC)
  WHERE contact_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_opportunity_source_contact_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  expected_source_id UUID;
BEGIN
  SELECT source_id
  INTO expected_source_id
  FROM public.opportunities
  WHERE id = NEW.opportunity_id;

  IF expected_source_id IS NULL OR expected_source_id <> NEW.source_id THEN
    RAISE EXCEPTION 'opportunity_source_contact_source_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_opportunity_source_contact_integrity ON public.opportunity_source_contacts;
CREATE TRIGGER enforce_opportunity_source_contact_integrity
  BEFORE INSERT OR UPDATE OF opportunity_id, source_id, contact_id
  ON public.opportunity_source_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_opportunity_source_contact_integrity();

CREATE OR REPLACE FUNCTION public.guard_opportunity_source_contact_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.source_id IS DISTINCT FROM OLD.source_id
    AND EXISTS (
      SELECT 1
      FROM public.opportunity_source_contacts relation
      WHERE relation.opportunity_id = OLD.id
    ) THEN
    RAISE EXCEPTION 'opportunity_source_contact_links_must_be_replaced_before_source_change';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_opportunity_source_contact_integrity ON public.opportunities;
CREATE TRIGGER guard_opportunity_source_contact_integrity
  BEFORE UPDATE OF source_id ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_opportunity_source_contact_integrity();

DROP TRIGGER IF EXISTS update_ma_source_contacts_updated_at ON public.ma_source_contacts;
CREATE TRIGGER update_ma_source_contacts_updated_at
  BEFORE UPDATE ON public.ma_source_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ma_source_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_source_contacts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ma_source_contacts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.opportunity_source_contacts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ma_source_contacts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.opportunity_source_contacts TO service_role;

COMMENT ON TABLE public.ma_source_contacts IS
  'Staff-only intermediary people. Contacts belong to one canonical M&A firm and are never selected on repreneur surfaces.';
COMMENT ON TABLE public.opportunity_source_contacts IS
  'Staff-only explicit contacts for an opportunity. One optional primary contact is used as the default workflow recipient.';
COMMENT ON COLUMN public.ma_source_interactions.contact_id IS
  'Staff-only selected M&A contact. recipient_email remains the immutable outbound recipient snapshot.';
COMMENT ON COLUMN public.ma_sources.contact_name IS
  'Deprecated compatibility field. Canonical M&A contacts live in ma_source_contacts.';
COMMENT ON COLUMN public.ma_sources.contact_email IS
  'Deprecated compatibility field. Canonical M&A contacts live in ma_source_contacts.';
COMMENT ON COLUMN public.ma_sources.contact_phone IS
  'Deprecated compatibility field. Canonical M&A contacts live in ma_source_contacts.';

COMMIT;
