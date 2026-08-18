-- W-119: one role-safe metadata projection for the External Pursuit board.
-- This is intentionally an additive read-only optimization. It does not expose
-- storage paths or bytes, and it keeps W-108's exact dossier authorization.

CREATE OR REPLACE FUNCTION public.external_pursuit_attachment_map_for_actor(
  p_dossier_ids UUID[],
  p_actor_user_id TEXT
) RETURNS TABLE (
  external_pursuit_id UUID,
  id UUID,
  original_filename TEXT,
  content_type TEXT,
  byte_size BIGINT,
  uploader_label TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  requested_dossier_id UUID;
  actor TEXT := NULLIF(BTRIM(p_actor_user_id), '');
BEGIN
  -- Preserve the single-dossier reader's fail-closed rule for every requested
  -- dossier. A mixed permitted/forbidden request must not return a partial map.
  FOR requested_dossier_id IN
    SELECT DISTINCT requested.id
    FROM unnest(COALESCE(p_dossier_ids, ARRAY[]::UUID[])) AS requested(id)
  LOOP
    PERFORM public.assert_external_pursuit_access(requested_dossier_id, actor, FALSE);
  END LOOP;

  RETURN QUERY
  SELECT
    a.external_pursuit_id,
    a.id,
    a.original_filename,
    a.content_type,
    a.byte_size,
    CASE
      WHEN a.created_by = actor THEN 'You'::TEXT
      WHEN EXISTS (
        SELECT 1
        FROM public.app_user_roles r
        WHERE r.user_id = a.created_by AND r.role = 'staff'
      ) THEN 'Re-New staff'::TEXT
      ELSE 'Dossier owner'::TEXT
    END,
    a.created_at
  FROM public.external_pursuit_attachments a
  WHERE a.external_pursuit_id = ANY(COALESCE(p_dossier_ids, ARRAY[]::UUID[]))
  ORDER BY a.external_pursuit_id, a.created_at ASC;
END $$;

REVOKE ALL ON FUNCTION public.external_pursuit_attachment_map_for_actor(UUID[],TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.external_pursuit_attachment_map_for_actor(UUID[],TEXT)
  TO service_role;

COMMENT ON FUNCTION public.external_pursuit_attachment_map_for_actor(UUID[],TEXT)
  IS 'W-119 authorized External Pursuit attachment metadata map. Never returns storage paths, bytes, raw uploader identity or staff notes.';
