-- #186 / Decision #181, explicitly approved on 24 September 2026.
-- The existing E4/E6/E7 delivery RPCs receive actual Better Auth user IDs,
-- not caller-supplied email strings. Match the existing staff role by user ID
-- or normalized account email, changing only the two old actor predicates.
BEGIN;

DO $migration$
DECLARE
  v_signature text;
  v_oid oid;
  v_definition text;
  v_old text := $guard$(SELECT count(*) FROM public.app_user_roles WHERE role='staff' AND (user_id=p_actor OR email=p_actor))<>1$guard$;
  v_new text := $guard$(SELECT count(*) FROM public."user" account
      JOIN public.app_user_roles role ON role.role='staff'
        AND (role.user_id=account.id OR lower(btrim(role.email))=lower(btrim(account.email)))
      WHERE account.id=p_actor AND nullif(btrim(account.email),'') IS NOT NULL)<>1$guard$;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.journey_begin_handoff_delivery(uuid,uuid,text,text,text,jsonb)',
    'public.journey_finalize_handoff_delivery(uuid,uuid,text,text,text,text,uuid)'
  ] LOOP
    v_oid := to_regprocedure(v_signature);
    IF v_oid IS NULL THEN RAISE EXCEPTION 'handoff_source_actor_alignment_missing_function: %', v_signature; END IF;
    v_definition := pg_get_functiondef(v_oid);
    IF position('SECURITY DEFINER' IN v_definition) = 0
      OR length(v_definition) - length(replace(v_definition, v_old, '')) <> length(v_old)
    THEN RAISE EXCEPTION 'handoff_source_actor_alignment_definition_changed: %', v_signature; END IF;
    EXECUTE replace(v_definition, v_old, v_new);
  END LOOP;
END;
$migration$;

REVOKE ALL ON FUNCTION public.journey_begin_handoff_delivery(uuid,uuid,text,text,text,jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.journey_finalize_handoff_delivery(uuid,uuid,text,text,text,text,uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.journey_begin_handoff_delivery(uuid,uuid,text,text,text,jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.journey_finalize_handoff_delivery(uuid,uuid,text,text,text,text,uuid)
  TO service_role;

COMMIT;
