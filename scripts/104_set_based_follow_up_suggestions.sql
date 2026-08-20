-- W-122: Set-based, service-role-only dashboard follow-up projection.
-- The caller supplies one request timestamp so the 14-day boundary and
-- days-since-contact calculation share the exact same instant.

CREATE OR REPLACE FUNCTION public.get_follow_up_suggestions(p_now TIMESTAMPTZ)
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  journey_stage TEXT,
  days_since_contact INTEGER,
  total_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH eligible_repreneurs AS MATERIALIZED (
    SELECT r.id, r.first_name, r.last_name, r.email, r.journey_stage, r.updated_at
    FROM public.repreneurs AS r
    WHERE r.rejected_at IS NULL
      AND r.journey_stage NOT IN ('archived', 'rejected')
  ),
  latest_notes AS (
    SELECT n.repreneur_id, MAX(n.created_at) AS created_at
    FROM public.notes AS n
    INNER JOIN eligible_repreneurs AS r ON r.id = n.repreneur_id
    GROUP BY n.repreneur_id
  ),
  latest_activities AS (
    SELECT a.repreneur_id, MAX(a.created_at) AS created_at
    FROM public.activities AS a
    INNER JOIN eligible_repreneurs AS r ON r.id = a.repreneur_id
    GROUP BY a.repreneur_id
  ),
  contacts AS (
    SELECT
      r.id,
      r.first_name,
      r.last_name,
      r.email,
      r.journey_stage,
      r.updated_at AS source_updated_at,
      GREATEST(
        COALESCE(r.updated_at, '-infinity'::TIMESTAMPTZ),
        COALESCE(n.created_at, '-infinity'::TIMESTAMPTZ),
        COALESCE(a.created_at, '-infinity'::TIMESTAMPTZ)
      ) AS last_contact
    FROM eligible_repreneurs AS r
    LEFT JOIN latest_notes AS n ON n.repreneur_id = r.id
    LEFT JOIN latest_activities AS a ON a.repreneur_id = r.id
  ),
  stale_contacts AS (
    SELECT
      id,
      first_name,
      last_name,
      email,
      journey_stage,
      source_updated_at,
      last_contact,
      FLOOR(EXTRACT(EPOCH FROM (p_now - last_contact)) / 86400)::INTEGER AS days_since_contact
    FROM contacts
    WHERE last_contact > '-infinity'::TIMESTAMPTZ
      AND last_contact < p_now - INTERVAL '14 days'
  )
  SELECT
    id,
    first_name,
    last_name,
    email,
    journey_stage,
    days_since_contact,
    COUNT(*) OVER () AS total_count
  FROM stale_contacts
  -- The original staff action sorted equal-day suggestions in the source
  -- repreneur order (updated_at ascending); id only makes exact ties stable.
  ORDER BY days_since_contact DESC, source_updated_at ASC NULLS FIRST, id ASC
  LIMIT 10;
$$;

REVOKE EXECUTE ON FUNCTION public.get_follow_up_suggestions(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_follow_up_suggestions(TIMESTAMPTZ) TO service_role;
