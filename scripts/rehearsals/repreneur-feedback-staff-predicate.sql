-- Exact released W196 helper, isolated for this synthetic migration fixture.
CREATE FUNCTION public.w196_staff_role_matches(p_user_id text, p_email text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT NULLIF(BTRIM(p_user_id), '') IS NOT NULL
    AND NULLIF(BTRIM(p_email), '') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.app_user_roles role_row
      WHERE role_row.role = 'staff'
        AND LOWER(BTRIM(role_row.email)) = LOWER(BTRIM(p_email))
        AND (role_row.user_id = p_user_id OR (
          role_row.user_id IS NULL AND EXISTS (
            SELECT 1 FROM public."user" auth_user
            WHERE auth_user.id = p_user_id
              AND LOWER(BTRIM(auth_user.email)) = LOWER(BTRIM(p_email))
          )))
    )
$$;
REVOKE ALL ON FUNCTION public.w196_staff_role_matches(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.w196_staff_role_matches(text, text) TO service_role;
