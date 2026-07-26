-- Migration: retire legacy M&A directory mutations
--
-- Migration 076 makes firms, operating offices, contact affiliations and
-- office-anchored opportunity contacts authoritative. The pre-076 tables stay
-- available as historical compatibility reads only; they must not remain a
-- second service-role write path that can diverge from the canonical model.

BEGIN;

REVOKE ALL ON TABLE
  public.ma_sources,
  public.ma_source_networks,
  public.ma_source_contacts,
  public.ma_source_contact_moves,
  public.opportunity_source_contacts
FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON TABLE
  public.ma_sources,
  public.ma_source_networks,
  public.ma_source_contacts,
  public.ma_source_contact_moves,
  public.opportunity_source_contacts
TO service_role;

REVOKE ALL ON FUNCTION public.move_ma_source_contact(
  UUID,
  UUID,
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT
)
FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE public.ma_sources IS
  'Read-only legacy M&A firm-level source bridge. Canonical mutations use ma_firms and ma_offices.';
COMMENT ON TABLE public.ma_source_networks IS
  'Read-only legacy source grouping bridge. Canonical firm grouping uses ma_firms.network_label.';
COMMENT ON TABLE public.ma_source_contacts IS
  'Read-only legacy contact bridge. Canonical mutations use ma_contacts and office affiliations.';
COMMENT ON TABLE public.ma_source_contact_moves IS
  'Read-only immutable legacy contact-move evidence retained for historical attribution.';
COMMENT ON TABLE public.opportunity_source_contacts IS
  'Read-only legacy opportunity-contact bridge. Canonical mutations use opportunity_ma_contacts.';
COMMENT ON FUNCTION public.move_ma_source_contact(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT) IS
  'Retired legacy mutation primitive. Execution is revoked from browser and service roles after canonical office/contact activation.';

COMMIT;
