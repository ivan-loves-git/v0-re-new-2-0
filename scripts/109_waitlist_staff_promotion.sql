-- Migration 109: close the public Request Access lifecycle with a staff-reviewed, exactly-once
-- promotion into the canonical repreneur table.
ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS promoted_repreneur_id UUID REFERENCES public.repreneurs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS promoted_by TEXT;

DROP INDEX IF EXISTS public.waitlist_promoted_repreneur_unique;

CREATE INDEX IF NOT EXISTS idx_waitlist_promoted_repreneur
  ON public.waitlist (promoted_repreneur_id)
  WHERE promoted_repreneur_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.promote_waitlist_repreneur(
  p_waitlist_id UUID,
  p_first_name TEXT,
  p_last_name TEXT,
  p_actor_user_id TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  request_row public.waitlist%ROWTYPE;
  target_repreneur_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_waitlist_id::text, 0));

  SELECT * INTO request_row
  FROM public.waitlist
  WHERE id = p_waitlist_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access request was not found.';
  END IF;

  IF request_row.promoted_repreneur_id IS NOT NULL THEN
    RETURN request_row.promoted_repreneur_id;
  END IF;

  IF request_row.role <> 'repreneur' THEN
    RAISE EXCEPTION 'Seller access requests cannot be promoted to repreneurs.';
  END IF;

  IF NULLIF(BTRIM(request_row.email), '') IS NULL THEN
    RAISE EXCEPTION 'The access request has no usable email address.';
  END IF;

  -- Serialize normalized-email decisions across duplicate legacy requests. The
  -- existing canonical profile always wins; its names and source stay intact.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('repreneur-email:' || LOWER(BTRIM(request_row.email)), 0)
  );

  SELECT id INTO target_repreneur_id
  FROM public.repreneurs
  WHERE LOWER(BTRIM(email)) = LOWER(BTRIM(request_row.email))
  ORDER BY created_at ASC NULLS LAST, id ASC
  LIMIT 1
  FOR UPDATE;

  IF target_repreneur_id IS NULL THEN
    IF NULLIF(BTRIM(p_first_name), '') IS NULL OR NULLIF(BTRIM(p_last_name), '') IS NULL THEN
      RAISE EXCEPTION 'Both first and last name are required.';
    END IF;

    INSERT INTO public.repreneurs (
      email, first_name, last_name, lifecycle_status, source, consent_source, created_by
    ) VALUES (
      LOWER(BTRIM(request_row.email)),
      BTRIM(p_first_name),
      BTRIM(p_last_name),
      'lead',
      'access_request_staff_review',
      'manual',
      p_actor_user_id
    )
    RETURNING id INTO target_repreneur_id;
  END IF;

  UPDATE public.waitlist
  SET status = 'approved',
      promoted_repreneur_id = target_repreneur_id,
      promoted_at = NOW(),
      promoted_by = p_actor_user_id,
      updated_at = NOW()
  WHERE id = p_waitlist_id;

  RETURN target_repreneur_id;
END;
$$;

REVOKE ALL ON FUNCTION public.promote_waitlist_repreneur(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_waitlist_repreneur(UUID, TEXT, TEXT, TEXT) TO service_role;
