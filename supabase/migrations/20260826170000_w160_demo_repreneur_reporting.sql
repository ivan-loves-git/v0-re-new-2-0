-- W-160: DEMO repreneurs are an explicit staff-only classification. They stay
-- in the database and in staff dossiers, but never enter production metrics
-- or automatic recommendation candidates.
ALTER TABLE public.repreneurs
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.repreneurs.is_demo IS
  'Staff-only operating classification. A DEMO repreneur is excluded from production reporting and automatic matching; historical records are retained.';

CREATE OR REPLACE FUNCTION public.w160_demo_repreneur_manifest()
RETURNS TABLE (id UUID, updated_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id::UUID, updated_at::TIMESTAMPTZ
  FROM (VALUES
    ('856423d2-9276-4697-ad3b-327c787438fc', '2026-07-24T06:39:56.941913+00:00', '1aa6ca0958874e487e51126b70bb0627aa6ebce5b6faa331f975324bcf9438f9'),
    ('596e17c3-43b7-469d-9159-3e7b26cba034', '2026-06-18T10:33:56.817301+00:00', '0cb070aa4154b9742c9df902bae10de53b9813e37cb4a0c7d2a369a7e98ca654'),
    ('06220a7f-b303-461a-9787-fbbdfda880c5', '2026-08-25T09:31:23.763245+00:00', 'a690c9c122f5f1af8f75dbbd2d7f80eaef0c9062e4c9925367274cb8f0c878ff'),
    ('795f28a5-8510-424a-9375-679561ef53c3', '2026-08-25T08:47:04.407529+00:00', 'c55b5b57992eeaa127c9e02917d16ef0d2eda9804ec189782f71b9280385514f'),
    ('dc5187f3-74c3-4a02-9920-6ea13d1d1a98', '2026-08-21T04:35:54.551734+00:00', '1142c924a2b812e9ae3b74b62d77c8e8dfb05b3735ad6aa5afb8ecb6b12055b7'),
    ('8dfed9c5-ee06-4b3b-8bf4-aad720c0c5ea', '2026-08-21T04:27:05.798042+00:00', '4b2a198105c55378fcb33dce9b5484b0830a9d8665ea7fb1f7d207376fc0a073'),
    ('9d608166-3c2c-482e-a304-591e6daeddb1', '2026-08-21T04:27:05.798042+00:00', '182c4f83b106543982de93f4f4038ff1a0badce2e80cf5727df855d8a62cf24d'),
    ('1b22699e-01ff-4480-b279-7d822a8fc40b', '2026-08-25T12:12:00.330463+00:00', 'fa7bde10f20a904fa9d3a91dd0f91792fd8d31bba66352009fb1dc4f346d1c4b'),
    ('e7e0ba45-0262-4ef8-abcb-2d0644559977', '2026-08-21T04:35:54.551734+00:00', 'c9a0218313083cfe211056a87d9fd41545c1d61ca5cb7c66f78e5854c2e01371'),
    ('dd25d9e0-28f7-4cec-b26c-86c635768005', '2026-08-21T04:35:54.551734+00:00', '367906b8ae1cb5ce9cfeb745ec4182fe3af2903c8d26501fa34c66511b815210'),
    ('91ce3e4a-b838-464c-8314-04b3eb68f846', '2026-08-21T04:35:54.551734+00:00', '208741e7e6cf3f8dc084912dce084fcfa4cdbd027e10dc243e07ff5a1d546cbe'),
    ('d851ff32-1b9b-4d4a-98ea-2d9a37f1c7e6', '2026-08-21T04:27:05.798042+00:00', 'd7403fc2bb80abfb9216f1df164da2a48c56787530fe53aa62d28c2713818f2b'),
    ('a55ca89a-5b1d-4c30-a360-eeb1b7d3955c', '2026-08-21T04:27:05.798042+00:00', 'd93ad1dee3de255f6f28bd6afe4138949c1cc6b3a39e9e8ecdea684f4fb0cb35'),
    ('da7fd559-5b9b-49f2-9255-85167dfe6686', '2026-08-21T04:27:05.798042+00:00', '078d156d4eba8ca1115cc5fe9fa37bdd296e513cf154b77e8c9d6cf5c105fc04'),
    ('0af82dda-ae0c-4a4d-aff9-54de932126c4', '2026-08-21T04:44:20.720301+00:00', '6a4963ba3f831d057b7276b61b11742bee609c543aa67bfbc929e3f97e916343'),
    ('fdb84ac2-0489-4331-94b5-46deadb438cd', '2026-08-21T05:03:03.700828+00:00', '18ef107bb66f958db239abb6339b68ac54ed708b589dc095a5f740f48ecaf520'),
    ('2e0b089f-aa14-4daa-b892-a25a87a1274e', '2026-08-21T05:39:37.923055+00:00', 'ea5d36b6f27a808a85f1464a5546fa2f0436d5d72200402476a3fe0b479ff6e0'),
    ('83cd3c13-6ed2-4bcf-9590-79cb9ccc9108', '2026-08-21T05:41:25.579931+00:00', 'ba57e597e17c63fcb6041e5294a0e873f94900eadba2486e9bc36c061825512a'),
    ('3eddf913-3d4e-495b-9f4d-413a4d69514a', '2026-08-21T05:56:53.610091+00:00', '0f84ccba30a6a99b49b5d5850de81b78f04ab7368362fa617474a04eab1200e6'),
    ('66ae1f2f-7ab4-4cdf-9ac3-5776791e07bf', '2026-08-25T12:11:11.901886+00:00', '739e34612b70c54790bb8bc46244d9ded7b0a6fc2ba219fd1eb3a934c017b37d')
  ) AS manifest(id, updated_at, fingerprint)
$$;

REVOKE ALL ON FUNCTION public.w160_demo_repreneur_manifest() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.w160_demo_repreneur_manifest() TO service_role;

CREATE OR REPLACE FUNCTION public.apply_w160_demo_repreneur_classification(p_actor TEXT)
RETURNS TABLE (classified_rows INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_actor TEXT := NULLIF(BTRIM(p_actor), ''); v_rows INTEGER;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'w160_demo_repreneur_actor_required'; END IF;
  DROP TABLE IF EXISTS pg_temp.w160_manifest;
  CREATE TEMP TABLE pg_temp.w160_manifest ON COMMIT DROP AS SELECT * FROM public.w160_demo_repreneur_manifest();
  IF (SELECT count(*) FROM pg_temp.w160_manifest) <> 20 THEN RAISE EXCEPTION 'w160_demo_repreneur_manifest_cardinality_mismatch'; END IF;
  PERFORM 1 FROM public.repreneurs r JOIN pg_temp.w160_manifest m ON m.id=r.id FOR UPDATE OF r;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 20 THEN RAISE EXCEPTION 'w160_demo_repreneur_identity_mismatch'; END IF;
  IF EXISTS (SELECT 1 FROM public.repreneurs r JOIN pg_temp.w160_manifest m ON m.id=r.id WHERE r.is_demo AND r.updated_by IS DISTINCT FROM v_actor) THEN RAISE EXCEPTION 'w160_demo_repreneur_existing_state_drift'; END IF;
  IF EXISTS (SELECT 1 FROM public.repreneurs r JOIN pg_temp.w160_manifest m ON m.id=r.id WHERE NOT r.is_demo AND r.updated_at IS DISTINCT FROM m.updated_at) THEN RAISE EXCEPTION 'w160_demo_repreneur_manifest_drift'; END IF;
  UPDATE public.repreneurs r SET is_demo=TRUE, updated_by=v_actor FROM pg_temp.w160_manifest m WHERE r.id=m.id AND NOT r.is_demo;
  RETURN QUERY SELECT 20;
END;
$$;

CREATE OR REPLACE FUNCTION public.rollback_w160_demo_repreneur_classification(p_apply_actor TEXT, p_rollback_actor TEXT)
RETURNS TABLE (rolled_back_rows INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_apply TEXT := NULLIF(BTRIM(p_apply_actor), ''); v_rollback TEXT := NULLIF(BTRIM(p_rollback_actor), ''); v_rows INTEGER;
BEGIN
  IF v_apply IS NULL OR v_rollback IS NULL THEN RAISE EXCEPTION 'w160_demo_repreneur_rollback_actor_required'; END IF;
  DROP TABLE IF EXISTS pg_temp.w160_manifest;
  CREATE TEMP TABLE pg_temp.w160_manifest ON COMMIT DROP AS SELECT * FROM public.w160_demo_repreneur_manifest();
  PERFORM 1 FROM public.repreneurs r JOIN pg_temp.w160_manifest m ON m.id=r.id FOR UPDATE OF r;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 20 OR (SELECT count(*) FROM pg_temp.w160_manifest) <> 20 THEN RAISE EXCEPTION 'w160_demo_repreneur_rollback_identity_mismatch'; END IF;
  IF EXISTS (SELECT 1 FROM public.repreneurs r JOIN pg_temp.w160_manifest m ON m.id=r.id WHERE NOT r.is_demo OR r.updated_by IS DISTINCT FROM v_apply) THEN RAISE EXCEPTION 'w160_demo_repreneur_rollback_state_drift'; END IF;
  UPDATE public.repreneurs r SET is_demo=FALSE, updated_by=v_rollback FROM pg_temp.w160_manifest m WHERE r.id=m.id;
  RETURN QUERY SELECT 20;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_w160_demo_repreneur_classification(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rollback_w160_demo_repreneur_classification(TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_w160_demo_repreneur_classification(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rollback_w160_demo_repreneur_classification(TEXT,TEXT) TO service_role;
