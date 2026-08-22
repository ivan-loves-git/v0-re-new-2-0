DO $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('renew-permanent-qa-lease', 20260822));
  IF EXISTS (SELECT 1 FROM qa_control.lease) THEN
    RAISE EXCEPTION 'qa-schema-sync-active-lease';
  END IF;
END
$$;

DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, service_role;
