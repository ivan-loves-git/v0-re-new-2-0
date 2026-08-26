-- W-021 corrective release: an intermediary firm's commercial CRM status is
-- not an opportunity-publication rule. Prospect firms may have active offices
-- carrying complete, current opportunities. Keep the office/contact and
-- anonymized-teaser checks, but remove firm status from eligibility and from
-- the exact-manifest fingerprint.

CREATE OR REPLACE FUNCTION public.w021_opportunity_publication_preflight()
RETURNS TABLE (
  ordinal INTEGER, id UUID, reference TEXT, updated_at TIMESTAMPTZ,
  fingerprint TEXT, eligible BOOLEAN, exclusion_reasons TEXT[]
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH candidate AS (
    SELECT o.id, o.reference, o.updated_at, o.status, o.is_demo,
      o.repreneur_exposure, o.public_title, o.teaser_summary, o.sector, o.location,
      o.source_office_id, office.status AS office_status,
      COALESCE(contacts.active_count, 0) AS active_contact_count,
      COALESCE(contacts.primary_count, 0) AS primary_contact_count,
      COALESCE(contacts.usable_primary_email, FALSE) AS usable_primary_email,
      COALESCE(contacts.invalid_active_contact, FALSE) AS invalid_active_contact,
      COALESCE(contacts.fingerprint, '') AS contact_fingerprint
    FROM public.opportunities o
    LEFT JOIN public.ma_offices office ON office.id = o.source_office_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::INTEGER AS active_count,
        COUNT(*) FILTER (WHERE link.is_primary)::INTEGER AS primary_count,
        BOOL_OR(link.is_primary AND affiliation.is_active AND contact.status = 'active'
          AND NULLIF(BTRIM(contact.email), '') IS NOT NULL
          AND BTRIM(contact.email) ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') AS usable_primary_email,
        BOOL_OR(affiliation.office_id IS DISTINCT FROM o.source_office_id
          OR NOT affiliation.is_active OR contact.status <> 'active') AS invalid_active_contact,
        STRING_AGG(CONCAT_WS(':', link.id, link.affiliation_id, link.is_primary, link.is_active,
          affiliation.office_id, affiliation.is_active, contact.status, contact.email), ',' ORDER BY link.id) AS fingerprint
      FROM public.opportunity_ma_contacts link
      JOIN public.ma_contact_office_affiliations affiliation ON affiliation.id = link.affiliation_id
      JOIN public.ma_contacts contact ON contact.id = affiliation.contact_id
      WHERE link.opportunity_id = o.id AND link.is_active
    ) contacts ON TRUE
    WHERE o.status = 'active' AND o.repreneur_exposure = 'staff_only' AND NOT o.is_demo
  ), classified AS (
    SELECT *, ARRAY_REMOVE(ARRAY[
      CASE WHEN NULLIF(BTRIM(public_title), '') IS NULL THEN 'public_title_missing' END,
      CASE WHEN NULLIF(BTRIM(teaser_summary), '') IS NULL THEN 'teaser_summary_missing' END,
      CASE WHEN NULLIF(BTRIM(sector), '') IS NULL THEN 'sector_missing' END,
      CASE WHEN NULLIF(BTRIM(location), '') IS NULL THEN 'location_missing' END,
      CASE WHEN source_office_id IS NULL THEN 'source_office_missing' END,
      CASE WHEN office_status IS DISTINCT FROM 'active' THEN 'source_office_inactive_or_missing' END,
      CASE WHEN active_contact_count = 0 THEN 'active_contact_missing' END,
      CASE WHEN primary_contact_count <> 1 THEN 'primary_contact_not_exactly_one' END,
      CASE WHEN NOT usable_primary_email THEN 'primary_email_unusable' END,
      CASE WHEN invalid_active_contact THEN 'active_contact_invalid_or_wrong_office' END
    ], NULL) AS exclusion_reasons FROM candidate
  )
  SELECT ROW_NUMBER() OVER (ORDER BY reference, id)::INTEGER, id, reference, updated_at,
    ENCODE(extensions.digest(CONVERT_TO(CONCAT_WS('|', id, reference,
      TO_CHAR(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      status, is_demo, repreneur_exposure, public_title, teaser_summary, sector, location,
      source_office_id, office_status, active_contact_count, primary_contact_count,
      usable_primary_email, invalid_active_contact, contact_fingerprint), 'UTF8'), 'sha256'), 'hex'),
    CARDINALITY(exclusion_reasons) = 0, exclusion_reasons
  FROM classified ORDER BY reference, id;
$$;
