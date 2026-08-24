-- W-147: Better Auth is the only product identity boundary. Browser roles have
-- no product-data access except the deliberately public PDR and clipboard.
DO $$
DECLARE item record;
BEGIN
  FOR item IN SELECT n.nspname, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', item.nspname, item.relname);
  END LOOP;
  FOR item IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public' AND roles && ARRAY['public'::name, 'anon'::name, 'authenticated'::name] AND tablename NOT IN ('clipboard', 'pdr_feedback', 'pdr_goals', 'pdr_milestones', 'pdr_proposals', 'pdr_requests', 'pdr_work_cards') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', item.policyname, item.schemaname, item.tablename);
  END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
-- Current public-read product decision: W-096 keeps the PDR public. These
-- raw read exceptions are intentional until its explicitly deferred review.
GRANT SELECT ON TABLE public.clipboard, public.pdr_feedback, public.pdr_goals, public.pdr_milestones, public.pdr_proposals, public.pdr_requests, public.pdr_work_cards TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
