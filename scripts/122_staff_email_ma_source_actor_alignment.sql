-- #186 / Decision #181, explicitly approved on 24 September 2026.
-- The two existing MA source send RPCs must accept an actual Better Auth user
-- ID whose existing staff role matches either that ID or its normalized email.
-- Replace only the old staff predicate after validating the installed source.
-- Reservation, replay ownership, provider identity and finalization stay intact.
BEGIN;

DO $migration$
DECLARE
  v_signature text;
  v_oid oid;
  v_definition text;
  v_old text := $guard$SELECT COUNT(*) INTO staff_count
  FROM public.app_user_roles role
  WHERE role.role = 'staff' AND role.user_id = normalized_actor;$guard$;
  v_new text := $guard$SELECT COUNT(*) INTO staff_count
  FROM public."user" account
  JOIN public.app_user_roles role ON role.role = 'staff'
    AND (role.user_id = account.id OR lower(btrim(role.email)) = lower(btrim(account.email)))
  WHERE account.id = normalized_actor AND nullif(btrim(account.email), '') IS NOT NULL;$guard$;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.begin_ma_interaction_email_send(uuid,uuid,uuid,text,text,text,text,text,uuid,text,uuid)',
    'public.finalize_ma_interaction_email_send(uuid,text,text,text,text)'
  ] LOOP
    v_oid := to_regprocedure(v_signature);
    IF v_oid IS NULL THEN RAISE EXCEPTION 'ma_source_actor_alignment_missing_function: %', v_signature; END IF;
    v_definition := pg_get_functiondef(v_oid);
    IF position('SECURITY DEFINER' IN v_definition) = 0
      OR length(v_definition) - length(replace(v_definition, v_old, '')) <> length(v_old)
    THEN RAISE EXCEPTION 'ma_source_actor_alignment_definition_changed: %', v_signature; END IF;
    EXECUTE replace(v_definition, v_old, v_new);
  END LOOP;
END;
$migration$;

REVOKE ALL ON FUNCTION public.begin_ma_interaction_email_send(uuid,uuid,uuid,text,text,text,text,text,uuid,text,uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.finalize_ma_interaction_email_send(uuid,text,text,text,text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.begin_ma_interaction_email_send(uuid,uuid,uuid,text,text,text,text,text,uuid,text,uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_ma_interaction_email_send(uuid,text,text,text,text)
  TO service_role;

COMMIT;
