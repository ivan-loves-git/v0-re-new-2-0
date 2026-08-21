-- Remove the one known partial object left when Supabase's historical
-- migration runner reaches a build-771 branch without the pre-ledger base.
-- The following guard rejects every other public-schema object.
DROP SEQUENCE IF EXISTS public.pdr_work_card_reference_seq;

DO $guard$
DECLARE
  public_oid oid;
BEGIN
  SELECT oid INTO public_oid FROM pg_namespace WHERE nspname = 'public';
  IF public_oid IS NULL THEN
    RAISE EXCEPTION 'schema-not-empty';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relnamespace = public_oid)
    OR EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = public_oid)
    OR EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = public_oid)
    OR EXISTS (SELECT 1 FROM pg_collation WHERE collnamespace = public_oid)
    OR EXISTS (SELECT 1 FROM pg_conversion WHERE connamespace = public_oid)
    OR EXISTS (SELECT 1 FROM pg_operator WHERE oprnamespace = public_oid)
    OR EXISTS (SELECT 1 FROM pg_opclass WHERE opcnamespace = public_oid)
    OR EXISTS (SELECT 1 FROM pg_opfamily WHERE opfnamespace = public_oid)
    OR EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgnamespace = public_oid)
    OR EXISTS (SELECT 1 FROM pg_ts_dict WHERE dictnamespace = public_oid)
    OR EXISTS (SELECT 1 FROM pg_ts_parser WHERE prsnamespace = public_oid)
    OR EXISTS (SELECT 1 FROM pg_ts_template WHERE tmplnamespace = public_oid)
    OR EXISTS (SELECT 1 FROM pg_statistic_ext WHERE stxnamespace = public_oid)
  THEN
    RAISE EXCEPTION 'schema-not-empty';
  END IF;
END;
$guard$;
