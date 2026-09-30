-- Ticket #229 / Decision #78. Additive, service-only portal feedback.
-- No existing records are copied or changed by this migration.
BEGIN;

CREATE TABLE public.repreneur_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  sender_repreneur_id uuid NOT NULL REFERENCES public.repreneurs(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('improvement', 'difficulty', 'other')),
  message text,
  context_key text CHECK (context_key IN ('portal_deals', 'portal_profile', 'portal_other')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'routed', 'closed')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  redacted_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  CONSTRAINT repreneur_feedback_message_check CHECK (
    (message IS NOT NULL AND redacted_at IS NULL AND char_length(message) BETWEEN 20 AND 1000 AND message = btrim(message))
    OR (message IS NULL AND redacted_at IS NOT NULL)
  )
);

CREATE INDEX repreneur_feedback_queue_idx
  ON public.repreneur_feedback (status, created_at DESC, id DESC);
CREATE INDEX repreneur_feedback_expiry_idx
  ON public.repreneur_feedback (created_at, id);

ALTER TABLE public.repreneur_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repreneur_feedback FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.repreneur_feedback FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.repreneur_feedback TO service_role;

-- The server action must already have required staff access. The SQL guard
-- adds a second check against the current staff role and serializes mutations
-- on the exact row. A stale version never overwrites another staff action.
CREATE FUNCTION public.staff_mutate_repreneur_feedback(
  p_id uuid,
  p_expected_version bigint,
  p_action text,
  p_new_status text,
  p_actor_user_id text,
  p_actor_email text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_row public.repreneur_feedback%ROWTYPE;
  v_version bigint;
BEGIN
  IF NOT public.w196_staff_role_matches(p_actor_user_id, p_actor_email) THEN
    RAISE EXCEPTION 'feedback_staff_required' USING ERRCODE = 'P0001';
  END IF;
  IF p_id IS NULL OR p_expected_version IS NULL OR p_expected_version < 1
    OR p_action IS NULL OR p_action NOT IN ('status', 'redact', 'delete')
    OR (p_action = 'status' AND (p_new_status IS NULL OR p_new_status NOT IN ('new', 'routed', 'closed')))
    OR (p_action <> 'status' AND p_new_status IS NOT NULL) THEN
    RAISE EXCEPTION 'feedback_invalid_mutation' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_row FROM public.repreneur_feedback WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'not_found');
  END IF;
  IF v_row.version <> p_expected_version THEN
    RETURN jsonb_build_object('outcome', 'conflict');
  END IF;
  IF p_action <> 'delete' AND v_row.created_at <= clock_timestamp() - interval '90 days' THEN
    RETURN jsonb_build_object('outcome', 'expired');
  END IF;

  IF p_action = 'delete' THEN
    DELETE FROM public.repreneur_feedback WHERE id = p_id;
    RETURN jsonb_build_object('outcome', 'deleted');
  ELSIF p_action = 'redact' THEN
    IF v_row.message IS NULL THEN
      RETURN jsonb_build_object('outcome', 'already_redacted');
    END IF;
    UPDATE public.repreneur_feedback
      SET message = NULL, redacted_at = clock_timestamp(),
        updated_at = clock_timestamp(), version = version + 1
      WHERE id = p_id RETURNING version INTO v_version;
  ELSE
    UPDATE public.repreneur_feedback
      SET status = p_new_status, updated_at = clock_timestamp(), version = version + 1
      WHERE id = p_id RETURNING version INTO v_version;
  END IF;
  RETURN jsonb_build_object('outcome', 'updated', 'version', v_version);
END $$;
REVOKE ALL ON FUNCTION public.staff_mutate_repreneur_feedback(uuid,bigint,text,text,text,text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.staff_mutate_repreneur_feedback(uuid,bigint,text,text,text,text)
  TO service_role;

-- Called only after the existing daily CRON_SECRET guard. This is the sole
-- automated action: irreversible deletion of this feature's expired rows.
CREATE FUNCTION public.purge_expired_repreneur_feedback()
RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM public.repreneur_feedback
    WHERE created_at <= clock_timestamp() - interval '90 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END $$;
REVOKE ALL ON FUNCTION public.purge_expired_repreneur_feedback()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purge_expired_repreneur_feedback() TO service_role;

COMMENT ON TABLE public.repreneur_feedback IS
  'Decision #78: staff-only manual product feedback. Created by authenticated repreneurs, no post-submit repreneur read, deleted after 90 days or actual auth-user deletion.';
COMMIT;
