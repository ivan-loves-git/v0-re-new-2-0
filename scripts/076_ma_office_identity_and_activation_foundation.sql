-- Migration: M&A operating-office identity and opportunity activation foundation
-- Purpose: Add the approved firm → operating office → contact affiliation
-- model alongside the existing firm-level records. This is an additive bridge:
-- ma_sources, ma_source_contacts and opportunity_source_contacts remain in
-- place for current staff workflows and immutable historical attribution.
--
-- This migration deliberately does not import a workbook, broaden repreneur
-- disclosure, introduce sourcing-channel data, or rewrite interaction history.
-- The legacy exposure column is written as staff_only only as a compatibility
-- firewall for new records and draft transitions while old portal reads exist.

BEGIN;

-- Stable firm identity. legacy_source_id makes the one-time bridge deterministic
-- without treating legacy source IDs as part of the target operating model.
CREATE TABLE IF NOT EXISTS public.ma_firms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_source_id UUID UNIQUE REFERENCES public.ma_sources(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'prospect'
    CHECK (status IN ('prospect', 'active', 'archived')),
  category TEXT,
  network_label TEXT,
  website_url TEXT,
  internal_notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_by TEXT,
  archived_at TIMESTAMPTZ,
  CHECK (NULLIF(BTRIM(name), '') IS NOT NULL),
  CHECK (status <> 'archived' OR archived_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.ma_offices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES public.ma_firms(id) ON DELETE RESTRICT,
  legacy_source_id UUID UNIQUE REFERENCES public.ma_sources(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  -- True only for the synthetic fallback created from an old firm-level source.
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  city TEXT,
  address TEXT,
  region_codes TEXT[],
  coverage_note TEXT,
  geography_confidence TEXT
    CHECK (geography_confidence IS NULL OR geography_confidence IN ('confirmed', 'review')),
  website_url TEXT,
  general_email TEXT,
  general_phone TEXT,
  internal_notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_by TEXT,
  archived_at TIMESTAMPTZ,
  CHECK (NULLIF(BTRIM(name), '') IS NOT NULL),
  CHECK (status <> 'archived' OR archived_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.ma_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_source_contact_id UUID UNIQUE REFERENCES public.ma_source_contacts(id) ON DELETE RESTRICT,
  first_name TEXT,
  last_name TEXT,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  internal_notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_by TEXT,
  archived_at TIMESTAMPTZ,
  CHECK (
    NULLIF(BTRIM(first_name), '') IS NOT NULL
    OR NULLIF(BTRIM(last_name), '') IS NOT NULL
  ),
  CHECK (status <> 'archived' OR archived_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.ma_contact_office_affiliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.ma_contacts(id) ON DELETE RESTRICT,
  office_id UUID NOT NULL REFERENCES public.ma_offices(id) ON DELETE RESTRICT,
  -- Temporary bridge keys let migration 075 contact moves retain the office
  -- relationship that was true when an opportunity used the contact.
  legacy_source_contact_id UUID REFERENCES public.ma_source_contacts(id) ON DELETE RESTRICT,
  legacy_source_id UUID REFERENCES public.ma_sources(id) ON DELETE RESTRICT,
  job_title TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  started_at DATE,
  ended_at DATE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (is_active AND ended_at IS NULL)
    OR (NOT is_active AND ended_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.opportunity_ma_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  affiliation_id UUID NOT NULL REFERENCES public.ma_contact_office_affiliations(id) ON DELETE RESTRICT,
  -- Preserves the bridge to migration 072/075 snapshots without copying or
  -- rewriting the immutable historical values there.
  legacy_source_contact_id UUID REFERENCES public.ma_source_contacts(id) ON DELETE RESTRICT,
  contact_name_snapshot TEXT,
  contact_email_snapshot TEXT,
  contact_phone_snapshot TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  linked_by TEXT,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_by TEXT,
  removed_at TIMESTAMPTZ,
  CHECK (
    (is_active AND removed_at IS NULL)
    OR (NOT is_active AND removed_at IS NOT NULL)
  ),
  UNIQUE (opportunity_id, affiliation_id)
);

ALTER TABLE public.ma_sources
  ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES public.ma_firms(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS default_office_id UUID REFERENCES public.ma_offices(id) ON DELETE RESTRICT;

ALTER TABLE public.ma_source_contacts
  ADD COLUMN IF NOT EXISTS canonical_contact_id UUID REFERENCES public.ma_contacts(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS office_affiliation_id UUID REFERENCES public.ma_contact_office_affiliations(id) ON DELETE RESTRICT;

ALTER TABLE public.opportunity_source_contacts
  ADD COLUMN IF NOT EXISTS canonical_opportunity_contact_id UUID REFERENCES public.opportunity_ma_contacts(id) ON DELETE RESTRICT;

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS source_office_id UUID REFERENCES public.ma_offices(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- Migration 073 made firm-level source_id mandatory for active opportunities.
-- The canonical office model supersedes that rule: source_id stays a nullable
-- compatibility bridge, while active and paused records require source_office_id.
ALTER TABLE public.opportunities
  DROP CONSTRAINT IF EXISTS opportunities_active_requires_source;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'opportunities_active_or_paused_requires_source_office'
      AND conrelid = 'public.opportunities'::regclass
  ) THEN
    ALTER TABLE public.opportunities
      ADD CONSTRAINT opportunities_active_or_paused_requires_source_office
      CHECK (
        status NOT IN ('active', 'paused')
        OR source_office_id IS NOT NULL
      )
      NOT VALID;
  END IF;
END;
$$;

-- Indexes support the staff-only office selector, compatibility joins and
-- constrained lifecycle checks. The partial uniqueness rules are deliberately
-- on active relationships so historical rows stay preserved.
CREATE INDEX IF NOT EXISTS idx_ma_firms_name
  ON public.ma_firms (LOWER(BTRIM(name)));
CREATE INDEX IF NOT EXISTS idx_ma_offices_firm
  ON public.ma_offices (firm_id, name)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_ma_offices_firm_id
  ON public.ma_offices (firm_id);
CREATE INDEX IF NOT EXISTS idx_ma_sources_default_office_id
  ON public.ma_sources (default_office_id);
CREATE INDEX IF NOT EXISTS idx_ma_source_contacts_office_affiliation_id
  ON public.ma_source_contacts (office_affiliation_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ma_offices_one_synthetic_default
  ON public.ma_offices (firm_id)
  WHERE is_default;
CREATE INDEX IF NOT EXISTS idx_ma_contacts_email
  ON public.ma_contacts (LOWER(BTRIM(email)))
  WHERE NULLIF(BTRIM(email), '') IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ma_contact_office_affiliations_active
  ON public.ma_contact_office_affiliations (contact_id, office_id)
  WHERE is_active;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ma_contact_office_affiliations_legacy_bridge
  ON public.ma_contact_office_affiliations (legacy_source_contact_id, legacy_source_id)
  WHERE legacy_source_contact_id IS NOT NULL
    AND legacy_source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ma_contact_office_affiliations_office
  ON public.ma_contact_office_affiliations (office_id, is_active, contact_id);
CREATE INDEX IF NOT EXISTS idx_ma_contact_office_affiliations_contact_id
  ON public.ma_contact_office_affiliations (contact_id);
CREATE INDEX IF NOT EXISTS idx_ma_contact_office_affiliations_legacy_source_contact_id
  ON public.ma_contact_office_affiliations (legacy_source_contact_id);
CREATE INDEX IF NOT EXISTS idx_ma_contact_office_affiliations_legacy_source_id
  ON public.ma_contact_office_affiliations (legacy_source_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_ma_contacts_opportunity
  ON public.opportunity_ma_contacts (opportunity_id, is_active DESC, is_primary DESC);
CREATE INDEX IF NOT EXISTS idx_opportunity_ma_contacts_affiliation
  ON public.opportunity_ma_contacts (affiliation_id)
  WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_opportunity_ma_contacts_affiliation_id
  ON public.opportunity_ma_contacts (affiliation_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_ma_contacts_legacy_source_contact_id
  ON public.opportunity_ma_contacts (legacy_source_contact_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunity_ma_contacts_primary
  ON public.opportunity_ma_contacts (opportunity_id)
  WHERE is_active AND is_primary;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ma_sources_firm_id
  ON public.ma_sources (firm_id)
  WHERE firm_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ma_source_contacts_canonical_contact
  ON public.ma_source_contacts (canonical_contact_id)
  WHERE canonical_contact_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunity_source_contacts_canonical_link
  ON public.opportunity_source_contacts (canonical_opportunity_contact_id)
  WHERE canonical_opportunity_contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_source_office
  ON public.opportunities (source_office_id)
  WHERE source_office_id IS NOT NULL;

-- Deterministic compatibility backfill. Current ma_sources are firm-level
-- records, so each receives one synthetic default office. No claimed real
-- branch, contact name or affiliation is invented.
INSERT INTO public.ma_firms (
  legacy_source_id,
  name,
  status,
  network_label,
  internal_notes,
  created_by
)
SELECT
  source.id,
  BTRIM(source.firm_name),
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.opportunities opportunity
      WHERE opportunity.source_id = source.id
        AND opportunity.status IN ('active', 'paused')
    ) THEN 'active'
    ELSE 'prospect'
  END,
  network.name,
  source.internal_notes,
  source.created_by
FROM public.ma_sources source
LEFT JOIN public.ma_source_networks network ON network.id = source.network_id
WHERE NULLIF(BTRIM(source.firm_name), '') IS NOT NULL
ON CONFLICT (legacy_source_id) DO NOTHING;

UPDATE public.ma_sources source
SET firm_id = firm.id
FROM public.ma_firms firm
WHERE firm.legacy_source_id = source.id
  AND source.firm_id IS NULL;

INSERT INTO public.ma_offices (
  firm_id,
  legacy_source_id,
  name,
  is_default,
  internal_notes,
  created_by
)
SELECT
  firm.id,
  source.id,
  firm.name,
  TRUE,
  source.internal_notes,
  source.created_by
FROM public.ma_sources source
JOIN public.ma_firms firm ON firm.legacy_source_id = source.id
WHERE source.firm_id = firm.id
ON CONFLICT (legacy_source_id) DO NOTHING;

UPDATE public.ma_sources source
SET default_office_id = office.id
FROM public.ma_offices office
WHERE office.legacy_source_id = source.id
  AND source.default_office_id IS NULL;

UPDATE public.opportunities opportunity
SET source_office_id = source.default_office_id
FROM public.ma_sources source
WHERE opportunity.source_id = source.id
  AND source.default_office_id IS NOT NULL
  AND opportunity.source_office_id IS NULL;

-- A legacy record with only an email or phone is kept in its existing bridge
-- table. It is not falsely converted into a named canonical person.
INSERT INTO public.ma_contacts (
  legacy_source_contact_id,
  first_name,
  last_name,
  display_name,
  email,
  phone,
  created_by
)
SELECT
  legacy_contact.id,
  NULL,
  NULLIF(BTRIM(legacy_contact.name), ''),
  NULLIF(BTRIM(legacy_contact.name), ''),
  NULLIF(BTRIM(legacy_contact.email), ''),
  NULLIF(BTRIM(legacy_contact.phone), ''),
  legacy_contact.created_by
FROM public.ma_source_contacts legacy_contact
WHERE NULLIF(BTRIM(legacy_contact.name), '') IS NOT NULL
ON CONFLICT (legacy_source_contact_id) DO NOTHING;

UPDATE public.ma_source_contacts legacy_contact
SET canonical_contact_id = contact.id
FROM public.ma_contacts contact
WHERE contact.legacy_source_contact_id = legacy_contact.id
  AND legacy_contact.canonical_contact_id IS NULL;

INSERT INTO public.ma_contact_office_affiliations (
  contact_id,
  office_id,
  legacy_source_contact_id,
  legacy_source_id,
  created_by
)
SELECT
  contact.id,
  source.default_office_id,
  legacy_contact.id,
  source.id,
  legacy_contact.created_by
FROM public.ma_source_contacts legacy_contact
JOIN public.ma_contacts contact ON contact.legacy_source_contact_id = legacy_contact.id
JOIN public.ma_sources source ON source.id = legacy_contact.source_id
WHERE source.default_office_id IS NOT NULL
ON CONFLICT (legacy_source_contact_id, legacy_source_id)
  WHERE legacy_source_contact_id IS NOT NULL
    AND legacy_source_id IS NOT NULL
DO NOTHING;

-- A contact may have moved after an opportunity was linked. Preserve each
-- distinct historical contact/source relationship as ended at its last known
-- link date. That date is migration evidence, not a claim about the real move
-- date, and it never replaces the immutable snapshots on the legacy link.
INSERT INTO public.ma_contact_office_affiliations (
  contact_id,
  office_id,
  legacy_source_contact_id,
  legacy_source_id,
  is_active,
  started_at,
  ended_at,
  created_by,
  ended_by
)
SELECT
  contact.id,
  historical_source.default_office_id,
  legacy_link.contact_id,
  legacy_link.source_id,
  FALSE,
  MIN(legacy_link.created_at)::DATE,
  MAX(legacy_link.created_at)::DATE,
  MIN(legacy_link.created_by),
  'migration:076 historical bridge'
FROM public.opportunity_source_contacts legacy_link
JOIN public.ma_source_contacts legacy_contact ON legacy_contact.id = legacy_link.contact_id
JOIN public.ma_contacts contact ON contact.legacy_source_contact_id = legacy_contact.id
JOIN public.ma_sources historical_source ON historical_source.id = legacy_link.source_id
WHERE historical_source.default_office_id IS NOT NULL
  AND legacy_link.source_id IS DISTINCT FROM legacy_contact.source_id
GROUP BY
  contact.id,
  historical_source.default_office_id,
  legacy_link.contact_id,
  legacy_link.source_id
ON CONFLICT (legacy_source_contact_id, legacy_source_id)
  WHERE legacy_source_contact_id IS NOT NULL
    AND legacy_source_id IS NOT NULL
DO NOTHING;

UPDATE public.ma_source_contacts legacy_contact
SET office_affiliation_id = affiliation.id
FROM public.ma_contacts contact
JOIN public.ma_contact_office_affiliations affiliation
  ON affiliation.contact_id = contact.id
  AND affiliation.is_active
JOIN public.ma_sources source ON source.id = legacy_contact.source_id
WHERE contact.legacy_source_contact_id = legacy_contact.id
  AND affiliation.legacy_source_contact_id = legacy_contact.id
  AND affiliation.legacy_source_id = source.id
  AND affiliation.office_id = source.default_office_id
  AND legacy_contact.office_affiliation_id IS NULL;

INSERT INTO public.opportunity_ma_contacts (
  opportunity_id,
  affiliation_id,
  legacy_source_contact_id,
  contact_name_snapshot,
  contact_email_snapshot,
  contact_phone_snapshot,
  is_primary,
  is_active,
  linked_by,
  linked_at,
  removed_by,
  removed_at
)
SELECT
  legacy_link.opportunity_id,
  affiliation.id,
  legacy_link.contact_id,
  legacy_link.contact_name_snapshot,
  legacy_link.contact_email_snapshot,
  legacy_link.contact_phone_snapshot,
  legacy_link.is_primary,
  CASE
    WHEN opportunity.status IN ('active', 'paused') THEN TRUE
    WHEN affiliation.is_active THEN TRUE
    ELSE FALSE
  END,
  legacy_link.created_by,
  legacy_link.created_at,
  CASE
    WHEN opportunity.status IN ('active', 'paused') OR affiliation.is_active THEN NULL
    ELSE 'migration:076 historical bridge'
  END,
  CASE
    WHEN opportunity.status IN ('active', 'paused') OR affiliation.is_active THEN NULL
    ELSE legacy_link.created_at
  END
FROM public.opportunity_source_contacts legacy_link
JOIN public.ma_source_contacts legacy_contact ON legacy_contact.id = legacy_link.contact_id
JOIN public.opportunities opportunity ON opportunity.id = legacy_link.opportunity_id
JOIN public.ma_contact_office_affiliations affiliation
  ON affiliation.legacy_source_contact_id = legacy_link.contact_id
  AND affiliation.legacy_source_id = legacy_link.source_id
WHERE affiliation.id IS NOT NULL
  AND opportunity.source_office_id = affiliation.office_id
ON CONFLICT (opportunity_id, affiliation_id) DO NOTHING;

UPDATE public.opportunity_source_contacts legacy_link
SET canonical_opportunity_contact_id = canonical_link.id
FROM public.opportunity_ma_contacts canonical_link
WHERE canonical_link.opportunity_id = legacy_link.opportunity_id
  AND canonical_link.legacy_source_contact_id = legacy_link.contact_id
  AND legacy_link.canonical_opportunity_contact_id IS NULL;

-- Keep display_name derived from the available name components for future
-- service-role writes. A full legacy name is retained as last_name until staff
-- chooses to split it; the migration does not guess a first/last-name split.
CREATE OR REPLACE FUNCTION public.normalize_ma_contact_display_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.first_name := NULLIF(BTRIM(NEW.first_name), '');
  NEW.last_name := NULLIF(BTRIM(NEW.last_name), '');

  IF NEW.first_name IS NULL AND NEW.last_name IS NULL THEN
    RAISE EXCEPTION 'ma_contact_requires_name_component';
  END IF;

  NEW.display_name := BTRIM(CONCAT_WS(' ', NEW.first_name, NEW.last_name));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.capture_opportunity_ma_contact_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  contact_row public.ma_contacts%ROWTYPE;
BEGIN
  SELECT contact.*
  INTO contact_row
  FROM public.ma_contact_office_affiliations affiliation
  JOIN public.ma_contacts contact ON contact.id = affiliation.contact_id
  WHERE affiliation.id = NEW.affiliation_id;

  IF contact_row.id IS NULL THEN
    RAISE EXCEPTION 'opportunity_contact_affiliation_not_found';
  END IF;

  NEW.contact_name_snapshot := COALESCE(
    NEW.contact_name_snapshot,
    contact_row.display_name
  );
  NEW.contact_email_snapshot := COALESCE(
    NEW.contact_email_snapshot,
    contact_row.email
  );
  NEW.contact_phone_snapshot := COALESCE(
    NEW.contact_phone_snapshot,
    contact_row.phone
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_ma_contact_display_name ON public.ma_contacts;
CREATE TRIGGER normalize_ma_contact_display_name
  BEFORE INSERT OR UPDATE OF first_name, last_name
  ON public.ma_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_ma_contact_display_name();

DROP TRIGGER IF EXISTS capture_opportunity_ma_contact_snapshot ON public.opportunity_ma_contacts;
CREATE TRIGGER capture_opportunity_ma_contact_snapshot
  BEFORE INSERT ON public.opportunity_ma_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.capture_opportunity_ma_contact_snapshot();

DROP TRIGGER IF EXISTS update_ma_firms_updated_at ON public.ma_firms;
CREATE TRIGGER update_ma_firms_updated_at
  BEFORE UPDATE ON public.ma_firms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_ma_offices_updated_at ON public.ma_offices;
CREATE TRIGGER update_ma_offices_updated_at
  BEFORE UPDATE ON public.ma_offices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_ma_contacts_updated_at ON public.ma_contacts;
CREATE TRIGGER update_ma_contacts_updated_at
  BEFORE UPDATE ON public.ma_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_ma_contact_office_affiliations_updated_at
  ON public.ma_contact_office_affiliations;
CREATE TRIGGER update_ma_contact_office_affiliations_updated_at
  BEFORE UPDATE ON public.ma_contact_office_affiliations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Existing migration 072 prevents source_id changes while it owns a legacy
-- relationship. Once a legacy row is bridged to a canonical office-affiliation
-- link, its immutable snapshot may remain without blocking a controlled move.
CREATE OR REPLACE FUNCTION public.guard_opportunity_source_contact_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.source_id IS DISTINCT FROM OLD.source_id
    AND EXISTS (
      SELECT 1
      FROM public.opportunity_source_contacts legacy_link
      WHERE legacy_link.opportunity_id = OLD.id
        AND legacy_link.canonical_opportunity_contact_id IS NULL
    ) THEN
    RAISE EXCEPTION 'opportunity_source_contact_links_must_be_resolved_before_source_change';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_ma_firm_has_active_office(
  p_firm_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  firm_row public.ma_firms%ROWTYPE;
BEGIN
  SELECT *
  INTO firm_row
  FROM public.ma_firms
  WHERE id = p_firm_id;

  IF firm_row.id IS NULL THEN
    RETURN;
  END IF;

  -- Archiving a firm is safe only after every live opportunity using one of
  -- its offices has been closed, archived or moved in the same transaction.
  IF firm_row.status = 'archived' THEN
    IF EXISTS (
      SELECT 1
      FROM public.opportunities opportunity
      JOIN public.ma_offices office
        ON office.id = opportunity.source_office_id
      WHERE office.firm_id = firm_row.id
        AND opportunity.status IN ('active', 'paused')
    ) THEN
      RAISE EXCEPTION 'ma_firm_archive_requires_resolving_active_opportunities';
    END IF;

    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.ma_offices office
    WHERE office.firm_id = firm_row.id
      AND office.status = 'active'
  ) THEN
    RAISE EXCEPTION 'ma_firm_requires_active_office';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_ma_firm_active_office()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_TABLE_NAME = 'ma_firms' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    PERFORM public.assert_ma_firm_has_active_office(NEW.id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.assert_ma_firm_has_active_office(OLD.firm_id);
  ELSE
    PERFORM public.assert_ma_firm_has_active_office(NEW.firm_id);
    IF TG_OP = 'UPDATE' AND NEW.firm_id IS DISTINCT FROM OLD.firm_id THEN
      PERFORM public.assert_ma_firm_has_active_office(OLD.firm_id);
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_ma_firm_active_office_on_firm ON public.ma_firms;
CREATE CONSTRAINT TRIGGER enforce_ma_firm_active_office_on_firm
  AFTER INSERT OR UPDATE OR DELETE ON public.ma_firms
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_ma_firm_active_office();

DROP TRIGGER IF EXISTS enforce_ma_firm_active_office_on_office ON public.ma_offices;
CREATE CONSTRAINT TRIGGER enforce_ma_firm_active_office_on_office
  AFTER INSERT OR UPDATE OR DELETE ON public.ma_offices
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_ma_firm_active_office();

-- One target invariant function is shared by deferred guards and the atomic
-- RPC. It does not inspect repreneur disclosure state: activation only makes a
-- staff-owned opportunity operationally valid.
CREATE OR REPLACE FUNCTION public.assert_opportunity_office_context(
  p_opportunity_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  opportunity_row public.opportunities%ROWTYPE;
  office_row public.ma_offices%ROWTYPE;
  active_contact_count INTEGER;
  primary_contact_count INTEGER;
  primary_has_usable_email BOOLEAN;
BEGIN
  SELECT *
  INTO opportunity_row
  FROM public.opportunities
  WHERE id = p_opportunity_id;

  IF opportunity_row.id IS NULL THEN
    RETURN;
  END IF;

  IF opportunity_row.source_office_id IS NULL THEN
    IF opportunity_row.status IN ('active', 'paused') THEN
      RAISE EXCEPTION 'opportunity_activation_requires_source_office';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.opportunity_ma_contacts link
      WHERE link.opportunity_id = opportunity_row.id
        AND link.is_active
    ) THEN
      RAISE EXCEPTION 'opportunity_contact_requires_source_office';
    END IF;

    RETURN;
  END IF;

  SELECT *
  INTO office_row
  FROM public.ma_offices
  WHERE id = opportunity_row.source_office_id;

  IF office_row.id IS NULL THEN
    RAISE EXCEPTION 'opportunity_source_office_not_found';
  END IF;

  -- source_id and source_label are pre-076 compatibility evidence only. They
  -- do not determine or validate the canonical current source office, because
  -- an old opportunity may later be moved through the office model without
  -- rewriting its legacy history.

  IF EXISTS (
    SELECT 1
    FROM public.opportunity_ma_contacts link
    JOIN public.ma_contact_office_affiliations affiliation
      ON affiliation.id = link.affiliation_id
    WHERE link.opportunity_id = opportunity_row.id
      AND link.is_active
      AND affiliation.office_id <> opportunity_row.source_office_id
  ) THEN
    RAISE EXCEPTION 'opportunity_contact_affiliation_office_mismatch';
  END IF;

  -- Closed and archived records retain their source and contact attribution.
  -- Their linked affiliation/contact may later end or archive without
  -- blocking that historical lifecycle. Office/link consistency remains above.
  IF opportunity_row.status IN ('closed', 'archived') THEN
    RETURN;
  END IF;

  -- The view and save RPC hide/reject this already. Keeping the same rule in
  -- the invariant blocks a direct service mutation from selecting a synthetic
  -- default once a real active office exists for that firm.
  IF office_row.is_default
    AND EXISTS (
      SELECT 1
      FROM public.ma_offices real_office
      WHERE real_office.firm_id = office_row.firm_id
        AND real_office.status = 'active'
        AND NOT real_office.is_default
    ) THEN
    RAISE EXCEPTION 'opportunity_source_office_requires_real_office_selection';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.opportunity_ma_contacts link
    JOIN public.ma_contact_office_affiliations affiliation
      ON affiliation.id = link.affiliation_id
    JOIN public.ma_contacts contact ON contact.id = affiliation.contact_id
    WHERE link.opportunity_id = opportunity_row.id
      AND link.is_active
      AND (
        NOT affiliation.is_active
        OR contact.status <> 'active'
      )
  ) THEN
    RAISE EXCEPTION 'opportunity_active_contact_affiliation_must_be_active';
  END IF;

  IF opportunity_row.status NOT IN ('active', 'paused') THEN
    RETURN;
  END IF;

  IF office_row.status <> 'active' THEN
    RAISE EXCEPTION 'opportunity_activation_requires_active_source_office';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.ma_firms firm
    WHERE firm.id = office_row.firm_id
      AND firm.status <> 'archived'
  ) THEN
    RAISE EXCEPTION 'opportunity_activation_requires_non_archived_source_firm';
  END IF;

  IF NULLIF(BTRIM(opportunity_row.description), '') IS NULL THEN
    RAISE EXCEPTION 'opportunity_activation_requires_description';
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE link.is_primary),
    COALESCE(
      BOOL_OR(
        link.is_primary
        AND affiliation.is_active
        AND contact.status = 'active'
        AND (
          NULLIF(BTRIM(contact.first_name), '') IS NOT NULL
          OR NULLIF(BTRIM(contact.last_name), '') IS NOT NULL
        )
        AND NULLIF(BTRIM(contact.email), '') IS NOT NULL
        AND BTRIM(contact.email) ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      ),
      FALSE
    )
  INTO active_contact_count, primary_contact_count, primary_has_usable_email
  FROM public.opportunity_ma_contacts link
  JOIN public.ma_contact_office_affiliations affiliation
    ON affiliation.id = link.affiliation_id
  JOIN public.ma_contacts contact ON contact.id = affiliation.contact_id
  WHERE link.opportunity_id = opportunity_row.id
    AND link.is_active;

  IF active_contact_count = 0 THEN
    RAISE EXCEPTION 'opportunity_activation_requires_contact';
  END IF;

  IF primary_contact_count <> 1 THEN
    RAISE EXCEPTION 'opportunity_activation_requires_exactly_one_primary_contact';
  END IF;

  IF NOT primary_has_usable_email THEN
    RAISE EXCEPTION 'opportunity_activation_requires_usable_primary_email';
  END IF;
END;
$$;

-- Fail the release rather than leave an already active or paused legacy
-- opportunity in a target state that cannot meet the office/contact contract.
-- Drafts intentionally remain eligible for later staff completion.
DO $$
DECLARE
  active_opportunity_id UUID;
BEGIN
  FOR active_opportunity_id IN
    SELECT opportunity.id
    FROM public.opportunities opportunity
    WHERE opportunity.status IN ('active', 'paused')
    ORDER BY opportunity.id
  LOOP
    PERFORM public.assert_opportunity_office_context(active_opportunity_id);
  END LOOP;
END;
$$;

ALTER TABLE public.opportunities
  VALIDATE CONSTRAINT opportunities_active_or_paused_requires_source_office;

CREATE OR REPLACE FUNCTION public.enforce_opportunity_office_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  affected_opportunity_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'opportunities' THEN
    IF TG_OP = 'DELETE' THEN
      PERFORM public.assert_opportunity_office_context(OLD.id);
    ELSE
      PERFORM public.assert_opportunity_office_context(NEW.id);
    END IF;
  ELSIF TG_TABLE_NAME = 'opportunity_ma_contacts' THEN
    IF TG_OP = 'DELETE' THEN
      PERFORM public.assert_opportunity_office_context(OLD.opportunity_id);
    ELSE
      PERFORM public.assert_opportunity_office_context(NEW.opportunity_id);
    END IF;
  ELSIF TG_TABLE_NAME = 'ma_contact_office_affiliations' THEN
    FOR affected_opportunity_id IN
      SELECT DISTINCT link.opportunity_id
      FROM public.opportunity_ma_contacts link
      WHERE link.affiliation_id = CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END
        AND link.is_active
    LOOP
      PERFORM public.assert_opportunity_office_context(affected_opportunity_id);
    END LOOP;
  ELSIF TG_TABLE_NAME = 'ma_contacts' THEN
    FOR affected_opportunity_id IN
      SELECT DISTINCT link.opportunity_id
      FROM public.opportunity_ma_contacts link
      JOIN public.ma_contact_office_affiliations affiliation
        ON affiliation.id = link.affiliation_id
      WHERE affiliation.contact_id = CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END
        AND link.is_active
    LOOP
      PERFORM public.assert_opportunity_office_context(affected_opportunity_id);
    END LOOP;
  ELSIF TG_TABLE_NAME = 'ma_offices' THEN
    FOR affected_opportunity_id IN
      SELECT DISTINCT opportunity.id
      FROM public.opportunities opportunity
      JOIN public.ma_offices source_office
        ON source_office.id = opportunity.source_office_id
      WHERE source_office.firm_id = CASE WHEN TG_OP = 'DELETE' THEN OLD.firm_id ELSE NEW.firm_id END
    LOOP
      PERFORM public.assert_opportunity_office_context(affected_opportunity_id);
    END LOOP;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

-- Deferred guards allow one service transaction to replace a source office and
-- its contact links together, while rejecting an inconsistent committed state.
DROP TRIGGER IF EXISTS enforce_opportunity_office_context_on_opportunity ON public.opportunities;
CREATE CONSTRAINT TRIGGER enforce_opportunity_office_context_on_opportunity
  AFTER INSERT OR UPDATE OR DELETE ON public.opportunities
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_opportunity_office_context();

DROP TRIGGER IF EXISTS enforce_opportunity_office_context_on_link ON public.opportunity_ma_contacts;
CREATE CONSTRAINT TRIGGER enforce_opportunity_office_context_on_link
  AFTER INSERT OR UPDATE OR DELETE ON public.opportunity_ma_contacts
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_opportunity_office_context();

DROP TRIGGER IF EXISTS enforce_opportunity_office_context_on_affiliation ON public.ma_contact_office_affiliations;
CREATE CONSTRAINT TRIGGER enforce_opportunity_office_context_on_affiliation
  AFTER INSERT OR UPDATE OR DELETE ON public.ma_contact_office_affiliations
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_opportunity_office_context();

DROP TRIGGER IF EXISTS enforce_opportunity_office_context_on_contact ON public.ma_contacts;
CREATE CONSTRAINT TRIGGER enforce_opportunity_office_context_on_contact
  AFTER INSERT OR UPDATE OR DELETE ON public.ma_contacts
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_opportunity_office_context();

DROP TRIGGER IF EXISTS enforce_opportunity_office_context_on_office ON public.ma_offices;
CREATE CONSTRAINT TRIGGER enforce_opportunity_office_context_on_office
  AFTER INSERT OR UPDATE OR DELETE ON public.ma_offices
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_opportunity_office_context();

-- W-063 consumes this projection in server actions only. It lists no
-- opportunities, history, notes or repreneur data.
CREATE OR REPLACE VIEW public.staff_ma_office_intake_projection
WITH (security_invoker = true) AS
SELECT
  office.id AS office_id,
  firm.id AS firm_id,
  firm.name AS firm_name,
  office.name AS office_name,
  CASE
    WHEN BTRIM(office.name) = BTRIM(firm.name) THEN firm.name
    ELSE firm.name || ' — ' || office.name
  END AS office_label,
  contact_context.affiliation_id,
  contact_context.contact_id,
  contact_context.contact_name,
  contact_context.contact_email,
  contact_context.job_title
FROM public.ma_offices office
JOIN public.ma_firms firm ON firm.id = office.firm_id
LEFT JOIN LATERAL (
  SELECT
    affiliation.id AS affiliation_id,
    contact.id AS contact_id,
    contact.display_name AS contact_name,
    contact.email AS contact_email,
    affiliation.job_title
  FROM public.ma_contact_office_affiliations affiliation
  JOIN public.ma_contacts contact ON contact.id = affiliation.contact_id
  WHERE affiliation.office_id = office.id
    AND affiliation.is_active
    AND contact.status = 'active'
) contact_context ON TRUE
WHERE firm.status <> 'archived'
  AND office.status = 'active'
  -- Once a real active office is known, the synthetic default remains only
  -- for historical links and is not offered for new intake selection.
  AND (
    NOT office.is_default
    OR NOT EXISTS (
      SELECT 1
      FROM public.ma_offices real_office
      WHERE real_office.firm_id = office.firm_id
        AND real_office.status = 'active'
        AND NOT real_office.is_default
    )
  );

-- Canonical staff identity primitive for W-063. It creates the smallest
-- usable firm context in one transaction: firm, office, named person and the
-- person's active affiliation. It never creates a legacy ma_sources row.
CREATE OR REPLACE FUNCTION public.create_ma_firm_with_default_office(
  p_firm_name TEXT,
  p_contact_first_name TEXT,
  p_contact_last_name TEXT,
  p_office_name TEXT DEFAULT NULL,
  p_is_synthetic_default BOOLEAN DEFAULT NULL,
  p_contact_email TEXT DEFAULT NULL,
  p_contact_phone TEXT DEFAULT NULL,
  p_contact_job_title TEXT DEFAULT NULL,
  p_actor TEXT DEFAULT NULL
)
RETURNS TABLE (
  firm_id UUID,
  office_id UUID,
  contact_id UUID,
  affiliation_id UUID
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  actor TEXT;
  firm_name TEXT;
  normalized_firm_name TEXT;
  office_name TEXT;
  contact_first_name TEXT;
  contact_last_name TEXT;
  use_synthetic_default BOOLEAN;
  created_firm_id UUID;
  created_office_id UUID;
  created_contact_id UUID;
  created_affiliation_id UUID;
BEGIN
  actor := NULLIF(BTRIM(p_actor), '');
  firm_name := NULLIF(BTRIM(p_firm_name), '');
  office_name := NULLIF(BTRIM(p_office_name), '');
  contact_first_name := NULLIF(BTRIM(p_contact_first_name), '');
  contact_last_name := NULLIF(BTRIM(p_contact_last_name), '');

  IF actor IS NULL THEN
    RAISE EXCEPTION 'ma_identity_actor_required';
  END IF;

  IF firm_name IS NULL THEN
    RAISE EXCEPTION 'ma_firm_name_required';
  END IF;

  -- Serialize canonical firm creation by the normalized business name. This
  -- prevents two concurrent intake requests from passing the exact-match
  -- check before either inserts a case or whitespace variant.
  normalized_firm_name := LOWER(BTRIM(firm_name));
  PERFORM pg_advisory_xact_lock(hashtextextended(normalized_firm_name, 76061));

  IF EXISTS (
    SELECT 1
    FROM public.ma_firms firm
    WHERE LOWER(BTRIM(firm.name)) = normalized_firm_name
  ) THEN
    RAISE EXCEPTION 'ma_firm_name_already_exists';
  END IF;

  IF contact_first_name IS NULL AND contact_last_name IS NULL THEN
    RAISE EXCEPTION 'ma_contact_requires_name_component';
  END IF;

  -- Safe default: a missing office means the branch is genuinely unknown;
  -- a supplied office name is real unless staff explicitly says otherwise.
  use_synthetic_default := COALESCE(p_is_synthetic_default, office_name IS NULL);
  IF use_synthetic_default THEN
    IF office_name IS NOT NULL AND office_name <> firm_name THEN
      RAISE EXCEPTION 'ma_synthetic_default_office_must_use_firm_name';
    END IF;

    office_name := firm_name;
  ELSIF office_name IS NULL THEN
    RAISE EXCEPTION 'ma_real_office_name_required';
  END IF;

  INSERT INTO public.ma_firms (
    name,
    created_by,
    updated_by
  ) VALUES (
    firm_name,
    actor,
    actor
  )
  RETURNING id INTO created_firm_id;

  INSERT INTO public.ma_offices (
    firm_id,
    name,
    is_default,
    created_by,
    updated_by
  ) VALUES (
    created_firm_id,
    office_name,
    use_synthetic_default,
    actor,
    actor
  )
  RETURNING id INTO created_office_id;

  INSERT INTO public.ma_contacts (
    first_name,
    last_name,
    email,
    phone,
    created_by,
    updated_by
  ) VALUES (
    contact_first_name,
    contact_last_name,
    NULLIF(BTRIM(p_contact_email), ''),
    NULLIF(BTRIM(p_contact_phone), ''),
    actor,
    actor
  )
  RETURNING id INTO created_contact_id;

  INSERT INTO public.ma_contact_office_affiliations (
    contact_id,
    office_id,
    job_title,
    created_by
  ) VALUES (
    created_contact_id,
    created_office_id,
    NULLIF(BTRIM(p_contact_job_title), ''),
    actor
  )
  RETURNING id INTO created_affiliation_id;

  RETURN QUERY
  SELECT
    created_firm_id,
    created_office_id,
    created_contact_id,
    created_affiliation_id;
END;
$$;

-- Canonical staff contact primitive for W-063. It adds a second person to an
-- existing office or attaches one already-canonical person to another office.
-- It deliberately never creates or mutates a legacy source-contact row.
CREATE OR REPLACE FUNCTION public.create_or_affiliate_ma_contact(
  p_office_id UUID,
  p_existing_contact_id UUID DEFAULT NULL,
  p_contact_first_name TEXT DEFAULT NULL,
  p_contact_last_name TEXT DEFAULT NULL,
  p_contact_email TEXT DEFAULT NULL,
  p_contact_phone TEXT DEFAULT NULL,
  p_contact_job_title TEXT DEFAULT NULL,
  p_actor TEXT DEFAULT NULL
)
RETURNS TABLE (
  contact_id UUID,
  affiliation_id UUID
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  actor TEXT;
  contact_first_name TEXT;
  contact_last_name TEXT;
  contact_email TEXT;
  contact_phone TEXT;
  office_row public.ma_offices%ROWTYPE;
  firm_row public.ma_firms%ROWTYPE;
  contact_row public.ma_contacts%ROWTYPE;
  resolved_contact_id UUID;
  created_affiliation_id UUID;
  existing_affiliation_id UUID;
BEGIN
  actor := NULLIF(BTRIM(p_actor), '');
  contact_first_name := NULLIF(BTRIM(p_contact_first_name), '');
  contact_last_name := NULLIF(BTRIM(p_contact_last_name), '');
  contact_email := NULLIF(BTRIM(p_contact_email), '');
  contact_phone := NULLIF(BTRIM(p_contact_phone), '');

  IF actor IS NULL THEN
    RAISE EXCEPTION 'ma_contact_affiliation_actor_required';
  END IF;

  -- Lock the office first so two calls cannot race past the active-pair
  -- guard. The firm lock makes an office beneath an archived firm ineligible
  -- for a new operational contact relationship.
  SELECT *
  INTO office_row
  FROM public.ma_offices
  WHERE id = p_office_id
  FOR UPDATE;

  IF office_row.id IS NULL THEN
    RAISE EXCEPTION 'ma_contact_affiliation_office_not_found';
  END IF;

  IF office_row.status <> 'active' THEN
    RAISE EXCEPTION 'ma_contact_affiliation_requires_active_office';
  END IF;

  SELECT *
  INTO firm_row
  FROM public.ma_firms
  WHERE id = office_row.firm_id
  FOR SHARE;

  IF firm_row.id IS NULL OR firm_row.status = 'archived' THEN
    RAISE EXCEPTION 'ma_contact_affiliation_requires_non_archived_firm';
  END IF;

  IF p_existing_contact_id IS NOT NULL THEN
    -- This primitive affiliates an existing identity; it does not quietly
    -- become a contact-profile editor. Updates are a separate audited action.
    IF contact_first_name IS NOT NULL
      OR contact_last_name IS NOT NULL
      OR contact_email IS NOT NULL
      OR contact_phone IS NOT NULL THEN
      RAISE EXCEPTION 'ma_existing_contact_affiliation_must_not_supply_identity_fields';
    END IF;

    SELECT *
    INTO contact_row
    FROM public.ma_contacts
    WHERE id = p_existing_contact_id
    FOR UPDATE;

    IF contact_row.id IS NULL THEN
      RAISE EXCEPTION 'ma_contact_not_found';
    END IF;

    IF contact_row.status <> 'active' THEN
      RAISE EXCEPTION 'ma_contact_affiliation_requires_active_contact';
    END IF;

    resolved_contact_id := contact_row.id;
  ELSE
    IF contact_first_name IS NULL AND contact_last_name IS NULL THEN
      RAISE EXCEPTION 'ma_contact_requires_name_component';
    END IF;

    INSERT INTO public.ma_contacts (
      first_name,
      last_name,
      email,
      phone,
      created_by,
      updated_by
    ) VALUES (
      contact_first_name,
      contact_last_name,
      contact_email,
      contact_phone,
      actor,
      actor
    )
    RETURNING id INTO resolved_contact_id;
  END IF;

  SELECT affiliation.id
  INTO existing_affiliation_id
  FROM public.ma_contact_office_affiliations affiliation
  WHERE affiliation.contact_id = resolved_contact_id
    AND affiliation.office_id = office_row.id
    AND affiliation.is_active
  FOR UPDATE;

  IF existing_affiliation_id IS NOT NULL THEN
    RAISE EXCEPTION 'ma_contact_office_affiliation_already_active';
  END IF;

  -- An earlier ended affiliation remains immutable relationship history. A
  -- later return to the same office receives a new active relationship row.
  INSERT INTO public.ma_contact_office_affiliations (
    contact_id,
    office_id,
    job_title,
    created_by
  ) VALUES (
    resolved_contact_id,
    office_row.id,
    NULLIF(BTRIM(p_contact_job_title), ''),
    actor
  )
  RETURNING id INTO created_affiliation_id;

  RETURN QUERY
  SELECT resolved_contact_id, created_affiliation_id;
END;
$$;

-- An intermediate 076 may have exposed seven-argument RPC overloads before
-- JSONB intake fields were added. Retire them explicitly before defining the
-- final signatures, so a rerun cannot leave a previously granted bypass.
DO $$
BEGIN
  IF to_regprocedure(
    'public.create_opportunity_with_office_context(text,uuid,uuid[],uuid,text,public.opportunity_status,text)'
  ) IS NOT NULL THEN
    EXECUTE
      'REVOKE ALL ON FUNCTION public.create_opportunity_with_office_context(TEXT, UUID, UUID[], UUID, TEXT, public.opportunity_status, TEXT) FROM PUBLIC, anon, authenticated, service_role';
    EXECUTE
      'DROP FUNCTION public.create_opportunity_with_office_context(TEXT, UUID, UUID[], UUID, TEXT, public.opportunity_status, TEXT)';
  END IF;

  IF to_regprocedure(
    'public.save_opportunity_office_context(uuid,uuid,uuid[],uuid,text,public.opportunity_status,text)'
  ) IS NOT NULL THEN
    EXECUTE
      'REVOKE ALL ON FUNCTION public.save_opportunity_office_context(UUID, UUID, UUID[], UUID, TEXT, public.opportunity_status, TEXT) FROM PUBLIC, anon, authenticated, service_role';
    EXECUTE
      'DROP FUNCTION public.save_opportunity_office_context(UUID, UUID, UUID[], UUID, TEXT, public.opportunity_status, TEXT)';
  END IF;
END;
$$;

-- Atomic draft/save/activation primitive. Locks always follow opportunity →
-- office → firm → selected affiliations → existing links. It writes only the
-- canonical source_office_id; any pre-076 source_id/source_label remain
-- untouched compatibility evidence. It never broadens repreneur disclosure:
-- drafts and draft activations remain staff_only in the legacy field.
CREATE OR REPLACE FUNCTION public.save_opportunity_office_context(
  p_opportunity_id UUID,
  p_source_office_id UUID,
  p_affiliation_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_primary_affiliation_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_target_status public.opportunity_status DEFAULT NULL,
  p_actor TEXT DEFAULT NULL,
  p_opportunity_fields JSONB DEFAULT '{}'::JSONB
)
RETURNS public.opportunities
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  opportunity_row public.opportunities%ROWTYPE;
  office_row public.ma_offices%ROWTYPE;
  firm_row public.ma_firms%ROWTYPE;
  saved_opportunity public.opportunities%ROWTYPE;
  requested_affiliation_ids UUID[];
  requested_affiliation_count INTEGER;
  active_affiliation_count INTEGER;
  target_status public.opportunity_status;
  actor TEXT;
  opportunity_fields JSONB;
BEGIN
  actor := NULLIF(BTRIM(p_actor), '');
  IF actor IS NULL THEN
    RAISE EXCEPTION 'opportunity_office_context_actor_required';
  END IF;

  opportunity_fields := COALESCE(p_opportunity_fields, '{}'::JSONB);
  IF jsonb_typeof(opportunity_fields) <> 'object' THEN
    RAISE EXCEPTION 'opportunity_intake_fields_must_be_object';
  END IF;

  IF opportunity_fields ?| ARRAY[
    'source_id',
    'source_label',
    'source_office_id',
    'repreneur_exposure',
    'origin_channel',
    'imported_from',
    'imported_at'
  ] THEN
    RAISE EXCEPTION 'opportunity_intake_fields_contains_forbidden_key';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(opportunity_fields) AS supplied(key)
    WHERE supplied.key NOT IN (
      'sector',
      'activity',
      'location',
      'revenue_meur',
      'ebitda_keur',
      'headcount',
      'headcount_range',
      'date_added',
      'public_title',
      'teaser_summary',
      'internal_notes'
    )
  ) THEN
    RAISE EXCEPTION 'opportunity_intake_fields_contains_unsupported_key';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_each(opportunity_fields) AS supplied(key, value)
    WHERE (
      supplied.key IN (
        'sector',
        'activity',
        'location',
        'headcount_range',
        'date_added',
        'public_title',
        'teaser_summary',
        'internal_notes'
      )
      AND jsonb_typeof(supplied.value) NOT IN ('string', 'null')
    )
    OR (
      supplied.key IN ('revenue_meur', 'ebitda_keur', 'headcount')
      AND jsonb_typeof(supplied.value) NOT IN ('number', 'string', 'null')
    )
  ) THEN
    RAISE EXCEPTION 'opportunity_intake_fields_has_invalid_value_type';
  END IF;

  requested_affiliation_ids := COALESCE(
    ARRAY(
      SELECT DISTINCT affiliation_id
      FROM UNNEST(COALESCE(p_affiliation_ids, ARRAY[]::UUID[])) AS requested(affiliation_id)
      ORDER BY affiliation_id
    ),
    ARRAY[]::UUID[]
  );
  requested_affiliation_count := CARDINALITY(requested_affiliation_ids);

  SELECT *
  INTO opportunity_row
  FROM public.opportunities
  WHERE id = p_opportunity_id
  FOR UPDATE;

  IF opportunity_row.id IS NULL THEN
    RAISE EXCEPTION 'opportunity_not_found';
  END IF;

  target_status := COALESCE(p_target_status, opportunity_row.status);
  IF opportunity_row.status IN ('closed', 'archived')
    AND target_status IN ('draft', 'active', 'paused') THEN
    RAISE EXCEPTION 'opportunity_office_context_cannot_change_historical_status';
  END IF;

  IF target_status NOT IN ('draft', 'active', 'paused') THEN
    RAISE EXCEPTION 'opportunity_office_context_supports_draft_active_or_paused_only';
  END IF;

  -- Drafts intentionally remain staff-only and may have no office or contact.
  -- A caller cannot use this branch for active or paused status.
  IF p_source_office_id IS NULL THEN
    IF target_status <> 'draft' THEN
      RAISE EXCEPTION 'opportunity_activation_requires_source_office';
    END IF;

    IF requested_affiliation_count <> 0 OR p_primary_affiliation_id IS NOT NULL THEN
      RAISE EXCEPTION 'opportunity_contact_requires_source_office';
    END IF;

    PERFORM 1
    FROM public.opportunity_ma_contacts link
    WHERE link.opportunity_id = opportunity_row.id
    ORDER BY link.id
    FOR UPDATE;

    UPDATE public.opportunity_ma_contacts
    SET
      is_active = FALSE,
      is_primary = FALSE,
      removed_by = actor,
      removed_at = NOW()
    WHERE opportunity_id = opportunity_row.id
      AND is_active;

    UPDATE public.opportunities
    SET
      source_office_id = NULL,
      repreneur_exposure = 'staff_only'::public.opportunity_visibility,
      description = CASE
        WHEN p_description IS NULL THEN description
        ELSE NULLIF(BTRIM(p_description), '')
      END,
      sector = CASE
        WHEN opportunity_fields ? 'sector' THEN NULLIF(BTRIM(opportunity_fields ->> 'sector'), '')
        ELSE sector
      END,
      activity = CASE
        WHEN opportunity_fields ? 'activity' THEN NULLIF(BTRIM(opportunity_fields ->> 'activity'), '')
        ELSE activity
      END,
      location = CASE
        WHEN opportunity_fields ? 'location' THEN NULLIF(BTRIM(opportunity_fields ->> 'location'), '')
        ELSE location
      END,
      revenue_meur = CASE
        WHEN opportunity_fields ? 'revenue_meur'
          THEN NULLIF(BTRIM(opportunity_fields ->> 'revenue_meur'), '')::NUMERIC(12, 2)
        ELSE revenue_meur
      END,
      ebitda_keur = CASE
        WHEN opportunity_fields ? 'ebitda_keur'
          THEN NULLIF(BTRIM(opportunity_fields ->> 'ebitda_keur'), '')::NUMERIC(12, 2)
        ELSE ebitda_keur
      END,
      headcount = CASE
        WHEN opportunity_fields ? 'headcount'
          THEN NULLIF(BTRIM(opportunity_fields ->> 'headcount'), '')::INTEGER
        ELSE headcount
      END,
      headcount_range = CASE
        WHEN opportunity_fields ? 'headcount_range'
          THEN NULLIF(BTRIM(opportunity_fields ->> 'headcount_range'), '')
        ELSE headcount_range
      END,
      date_added = CASE
        WHEN opportunity_fields ? 'date_added'
          THEN NULLIF(BTRIM(opportunity_fields ->> 'date_added'), '')::DATE
        ELSE date_added
      END,
      public_title = CASE
        WHEN opportunity_fields ? 'public_title'
          THEN NULLIF(BTRIM(opportunity_fields ->> 'public_title'), '')
        ELSE public_title
      END,
      teaser_summary = CASE
        WHEN opportunity_fields ? 'teaser_summary'
          THEN NULLIF(BTRIM(opportunity_fields ->> 'teaser_summary'), '')
        ELSE teaser_summary
      END,
      internal_notes = CASE
        WHEN opportunity_fields ? 'internal_notes'
          THEN NULLIF(BTRIM(opportunity_fields ->> 'internal_notes'), '')
        ELSE internal_notes
      END,
      status = 'draft',
      updated_by = actor
    WHERE id = opportunity_row.id
    RETURNING * INTO saved_opportunity;

    PERFORM public.assert_opportunity_office_context(saved_opportunity.id);
    RETURN saved_opportunity;
  END IF;

  SELECT *
  INTO office_row
  FROM public.ma_offices
  WHERE id = p_source_office_id
  FOR KEY SHARE;

  IF office_row.id IS NULL THEN
    RAISE EXCEPTION 'opportunity_source_office_not_found';
  END IF;

  -- A synthetic default is a temporary compatibility anchor. It cannot be
  -- selected for a new or changed opportunity once a real active office is
  -- known for the same firm. Historical links are intentionally untouched.
  IF office_row.is_default
    AND EXISTS (
      SELECT 1
      FROM public.ma_offices real_office
      WHERE real_office.firm_id = office_row.firm_id
        AND real_office.status = 'active'
        AND NOT real_office.is_default
    ) THEN
    RAISE EXCEPTION 'opportunity_source_office_requires_real_office_selection';
  END IF;

  SELECT *
  INTO firm_row
  FROM public.ma_firms
  WHERE id = office_row.firm_id
  FOR UPDATE;

  IF firm_row.id IS NULL THEN
    RAISE EXCEPTION 'opportunity_source_firm_not_found';
  END IF;

  -- Lock selected affiliations in UUID order, then verify they are active and
  -- attached to the requested office. Generic mailbox/affiliation shortcuts
  -- cannot become an opportunity primary contact through this RPC.
  PERFORM 1
  FROM public.ma_contact_office_affiliations affiliation
  WHERE affiliation.id = ANY(requested_affiliation_ids)
  ORDER BY affiliation.id
  FOR KEY SHARE;

  SELECT COUNT(*)
  INTO active_affiliation_count
  FROM public.ma_contact_office_affiliations affiliation
  JOIN public.ma_contacts contact ON contact.id = affiliation.contact_id
  WHERE affiliation.id = ANY(requested_affiliation_ids)
    AND affiliation.office_id = office_row.id
    AND affiliation.is_active
    AND contact.status = 'active';

  IF active_affiliation_count <> requested_affiliation_count THEN
    RAISE EXCEPTION 'opportunity_contact_affiliation_not_active_for_source_office';
  END IF;

  IF p_primary_affiliation_id IS NOT NULL
    AND NOT (p_primary_affiliation_id = ANY(requested_affiliation_ids)) THEN
    RAISE EXCEPTION 'opportunity_primary_affiliation_must_be_selected';
  END IF;

  -- Lock current links after the selected source context. Clearing primary
  -- flags before link replacement avoids a transient partial-index conflict.
  PERFORM 1
  FROM public.opportunity_ma_contacts link
  WHERE link.opportunity_id = opportunity_row.id
  ORDER BY link.id
  FOR UPDATE;

  UPDATE public.opportunity_ma_contacts
  SET is_primary = FALSE
  WHERE opportunity_id = opportunity_row.id
    AND is_active
    AND is_primary;

  UPDATE public.opportunity_ma_contacts
  SET
    is_active = FALSE,
    is_primary = FALSE,
    removed_by = actor,
    removed_at = NOW()
  WHERE opportunity_id = opportunity_row.id
    AND is_active
    AND NOT (affiliation_id = ANY(requested_affiliation_ids));

  INSERT INTO public.opportunity_ma_contacts (
    opportunity_id,
    affiliation_id,
    is_primary,
    is_active,
    linked_by,
    linked_at,
    removed_by,
    removed_at
  )
  SELECT
    opportunity_row.id,
    affiliation_id,
    FALSE,
    TRUE,
    actor,
    NOW(),
    NULL,
    NULL
  FROM UNNEST(requested_affiliation_ids) AS requested(affiliation_id)
  ON CONFLICT (opportunity_id, affiliation_id) DO UPDATE
  SET
    is_active = TRUE,
    is_primary = FALSE,
    linked_by = EXCLUDED.linked_by,
    linked_at = EXCLUDED.linked_at,
    removed_by = NULL,
    removed_at = NULL;

  IF p_primary_affiliation_id IS NOT NULL THEN
    UPDATE public.opportunity_ma_contacts
    SET is_primary = TRUE
    WHERE opportunity_id = opportunity_row.id
      AND affiliation_id = p_primary_affiliation_id
      AND is_active;
  END IF;

  UPDATE public.opportunities
  SET
    source_office_id = office_row.id,
    repreneur_exposure = CASE
      WHEN opportunity_row.status = 'draft' OR target_status = 'draft'
        THEN 'staff_only'::public.opportunity_visibility
      ELSE repreneur_exposure
    END,
    description = CASE
      WHEN p_description IS NULL THEN description
      ELSE NULLIF(BTRIM(p_description), '')
    END,
    sector = CASE
      WHEN opportunity_fields ? 'sector' THEN NULLIF(BTRIM(opportunity_fields ->> 'sector'), '')
      ELSE sector
    END,
    activity = CASE
      WHEN opportunity_fields ? 'activity' THEN NULLIF(BTRIM(opportunity_fields ->> 'activity'), '')
      ELSE activity
    END,
    location = CASE
      WHEN opportunity_fields ? 'location' THEN NULLIF(BTRIM(opportunity_fields ->> 'location'), '')
      ELSE location
    END,
    revenue_meur = CASE
      WHEN opportunity_fields ? 'revenue_meur'
        THEN NULLIF(BTRIM(opportunity_fields ->> 'revenue_meur'), '')::NUMERIC(12, 2)
      ELSE revenue_meur
    END,
    ebitda_keur = CASE
      WHEN opportunity_fields ? 'ebitda_keur'
        THEN NULLIF(BTRIM(opportunity_fields ->> 'ebitda_keur'), '')::NUMERIC(12, 2)
      ELSE ebitda_keur
    END,
    headcount = CASE
      WHEN opportunity_fields ? 'headcount'
        THEN NULLIF(BTRIM(opportunity_fields ->> 'headcount'), '')::INTEGER
      ELSE headcount
    END,
    headcount_range = CASE
      WHEN opportunity_fields ? 'headcount_range'
        THEN NULLIF(BTRIM(opportunity_fields ->> 'headcount_range'), '')
      ELSE headcount_range
    END,
    date_added = CASE
      WHEN opportunity_fields ? 'date_added'
        THEN NULLIF(BTRIM(opportunity_fields ->> 'date_added'), '')::DATE
      ELSE date_added
    END,
    public_title = CASE
      WHEN opportunity_fields ? 'public_title'
        THEN NULLIF(BTRIM(opportunity_fields ->> 'public_title'), '')
      ELSE public_title
    END,
    teaser_summary = CASE
      WHEN opportunity_fields ? 'teaser_summary'
        THEN NULLIF(BTRIM(opportunity_fields ->> 'teaser_summary'), '')
      ELSE teaser_summary
    END,
    internal_notes = CASE
      WHEN opportunity_fields ? 'internal_notes'
        THEN NULLIF(BTRIM(opportunity_fields ->> 'internal_notes'), '')
      ELSE internal_notes
    END,
    status = target_status,
    updated_by = actor
  WHERE id = opportunity_row.id
  RETURNING * INTO saved_opportunity;

  PERFORM public.assert_opportunity_office_context(saved_opportunity.id);
  RETURN saved_opportunity;
END;
$$;

-- Atomic creation counterpart for W-063. A failed active/paused validation
-- aborts the inserted draft in the same RPC transaction; callers never need
-- the former create-then-delete/link sequence.
CREATE OR REPLACE FUNCTION public.create_opportunity_with_office_context(
  p_reference TEXT,
  p_source_office_id UUID DEFAULT NULL,
  p_affiliation_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_primary_affiliation_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_target_status public.opportunity_status DEFAULT 'draft',
  p_actor TEXT DEFAULT NULL,
  p_opportunity_fields JSONB DEFAULT '{}'::JSONB
)
RETURNS public.opportunities
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  created_opportunity public.opportunities%ROWTYPE;
BEGIN
  IF NULLIF(BTRIM(p_actor), '') IS NULL THEN
    RAISE EXCEPTION 'opportunity_office_context_actor_required';
  END IF;

  IF NULLIF(BTRIM(p_reference), '') IS NULL THEN
    RAISE EXCEPTION 'opportunity_reference_required';
  END IF;

  IF p_target_status NOT IN ('draft', 'active', 'paused') THEN
    RAISE EXCEPTION 'opportunity_office_context_supports_draft_active_or_paused_only';
  END IF;

  INSERT INTO public.opportunities (
    reference,
    status,
    repreneur_exposure,
    description,
    created_by,
    updated_by
  ) VALUES (
    BTRIM(p_reference),
    'draft',
    'staff_only'::public.opportunity_visibility,
    NULLIF(BTRIM(p_description), ''),
    NULLIF(BTRIM(p_actor), ''),
    NULLIF(BTRIM(p_actor), '')
  )
  RETURNING * INTO created_opportunity;

  RETURN public.save_opportunity_office_context(
    created_opportunity.id,
    p_source_office_id,
    p_affiliation_ids,
    p_primary_affiliation_id,
    p_description,
    p_target_status,
    p_actor,
    p_opportunity_fields
  );
END;
$$;

ALTER TABLE public.ma_firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ma_offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ma_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ma_contact_office_affiliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_ma_contacts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.ma_firms,
  public.ma_offices,
  public.ma_contacts,
  public.ma_contact_office_affiliations,
  public.opportunity_ma_contacts,
  public.staff_ma_office_intake_projection
FROM PUBLIC, anon, authenticated;

-- Service-role writes remain available for the staged W-063/W-020 integration,
-- but canonical rows are never hard-deleted. New firm intake should use the
-- audited identity RPC and opportunity intake should use the atomic RPCs.
GRANT SELECT, INSERT, UPDATE ON TABLE
  public.ma_firms,
  public.ma_offices,
  public.ma_contacts,
  public.ma_contact_office_affiliations,
  public.opportunity_ma_contacts
TO service_role;
REVOKE DELETE ON TABLE
  public.ma_firms,
  public.ma_offices,
  public.ma_contacts,
  public.ma_contact_office_affiliations,
  public.opportunity_ma_contacts
FROM service_role;
GRANT SELECT ON TABLE public.staff_ma_office_intake_projection TO service_role;

REVOKE ALL ON FUNCTION public.normalize_ma_contact_display_name() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.capture_opportunity_ma_contact_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_opportunity_source_contact_integrity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_ma_firm_has_active_office(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_ma_firm_active_office() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_opportunity_office_context(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_opportunity_office_context() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_ma_firm_with_default_office(TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_or_affiliate_ma_contact(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_opportunity_office_context(UUID, UUID, UUID[], UUID, TEXT, public.opportunity_status, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_opportunity_with_office_context(TEXT, UUID, UUID[], UUID, TEXT, public.opportunity_status, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_ma_firm_has_active_office(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.assert_opportunity_office_context(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_ma_firm_with_default_office(TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.create_or_affiliate_ma_contact(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.save_opportunity_office_context(UUID, UUID, UUID[], UUID, TEXT, public.opportunity_status, TEXT, JSONB)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.create_opportunity_with_office_context(TEXT, UUID, UUID[], UUID, TEXT, public.opportunity_status, TEXT, JSONB)
  TO service_role;

COMMENT ON TABLE public.ma_firms IS
  'Staff-only canonical M&A advisory firm identities. legacy_source_id is a temporary compatibility bridge.';
COMMENT ON TABLE public.ma_offices IS
  'Staff-only canonical operating offices. A synthetic default office preserves a former firm-level source without claiming a real branch.';
COMMENT ON TABLE public.ma_contacts IS
  'Staff-only canonical people. A contact has office relationships through ma_contact_office_affiliations.';
COMMENT ON TABLE public.ma_contact_office_affiliations IS
  'Staff-only contact-to-operating-office relationships. Ending an affiliation preserves historical opportunity attribution.';
COMMENT ON TABLE public.opportunity_ma_contacts IS
  'Staff-only canonical opportunity contacts linked through office affiliations. Legacy snapshots remain on opportunity_source_contacts.';
COMMENT ON COLUMN public.opportunities.source_office_id IS
  'Canonical operating office source. Pre-076 source_id and source_label remain untouched compatibility evidence during the office-model transition.';
COMMENT ON FUNCTION public.create_ma_firm_with_default_office(TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT) IS
  'Service-role-only audited canonical identity creation. Creates firm, real or synthetic initial office, named contact and active affiliation without creating a legacy directory record.';
COMMENT ON FUNCTION public.create_or_affiliate_ma_contact(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) IS
  'Service-role-only audited canonical contact creation or existing-contact affiliation for one active office. It rejects an active duplicate pair and never mutates legacy source-contact records.';
COMMENT ON FUNCTION public.save_opportunity_office_context(UUID, UUID, UUID[], UUID, TEXT, public.opportunity_status, TEXT, JSONB) IS
  'Service-role-only atomic source-office/contact and allowlisted intake-field save. It writes source_office_id only and leaves pre-076 source_id/source_label untouched. Drafts may be incomplete; active or paused records require description, one or more contacts, exactly one primary and a usable primary email. It never broadens repreneur disclosure; new records and draft transitions retain the legacy field as staff_only.';
COMMENT ON FUNCTION public.create_opportunity_with_office_context(TEXT, UUID, UUID[], UUID, TEXT, public.opportunity_status, TEXT, JSONB) IS
  'Service-role-only atomic creation plus source-office/contact and allowlisted intake-field save. The legacy exposure field starts staff_only. Any active or paused validation failure rolls back the new draft.';

COMMIT;
