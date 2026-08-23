-- W-112 candidate: controlled, source-row-idempotent import of historical
-- pursuit *facts*. This migration intentionally creates no canonical journey
-- evidence, documents, gates, grants, email or source-disclosure capability.

CREATE TABLE IF NOT EXISTS public.historical_pursuit_import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_sha256 TEXT NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  source_sheet TEXT NOT NULL CHECK (BTRIM(source_sheet) <> ''),
  source_row INTEGER NOT NULL CHECK (source_row >= 1),
  source_repreneur_name TEXT NOT NULL CHECK (BTRIM(source_repreneur_name) <> ''),
  source_offer_label TEXT,
  source_opportunity_reference TEXT,
  source_cells JSONB NOT NULL CHECK (jsonb_typeof(source_cells) = 'object'),
  source_row_fingerprint TEXT NOT NULL CHECK (source_row_fingerprint ~ '^[0-9a-f]{64}$'),
  manifest_digest TEXT NOT NULL CHECK (manifest_digest ~ '^[0-9a-f]{64}$'),
  payload_sha256 TEXT NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  repreneur_id UUID REFERENCES public.repreneurs(id) ON DELETE RESTRICT,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  match_id UUID REFERENCES public.opportunity_matches(id) ON DELETE RESTRICT,
  completed_source_stages TEXT[] NOT NULL DEFAULT '{}',
  not_applicable_source_stages TEXT[] NOT NULL DEFAULT '{}',
  last_reported_source_stage TEXT NOT NULL,
  raw_drop_reason TEXT,
  event_dates_unknown BOOLEAN NOT NULL DEFAULT TRUE CHECK (event_dates_unknown),
  source_terminal BOOLEAN NOT NULL,
  resolution_blockers TEXT[] NOT NULL DEFAULT '{}',
  review_flags TEXT[] NOT NULL DEFAULT '{}',
  mapped_match_status public.opportunity_match_status,
  apply_outcome TEXT NOT NULL CHECK (apply_outcome IN ('created', 'merged', 'external_or_missing')),
  applied_by TEXT NOT NULL CHECK (BTRIM(applied_by) <> ''),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT historical_pursuit_import_rows_source_key UNIQUE (source_sha256, source_sheet, source_row),
  CONSTRAINT historical_pursuit_import_rows_link_scope CHECK (
    (opportunity_id IS NULL AND match_id IS NULL AND mapped_match_status IS NULL AND apply_outcome = 'external_or_missing')
    OR (opportunity_id IS NOT NULL AND match_id IS NOT NULL AND mapped_match_status IS NOT NULL AND apply_outcome IN ('created', 'merged'))
  )
);

ALTER TABLE public.historical_pursuit_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_pursuit_import_rows FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.historical_pursuit_import_rows FROM PUBLIC, anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.historical_pursuit_import_rows_immutable() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'historical_pursuit_import_rows_are_immutable'; END $$;
CREATE TRIGGER historical_pursuit_import_rows_no_update_delete BEFORE UPDATE OR DELETE ON public.historical_pursuit_import_rows FOR EACH ROW EXECUTE FUNCTION public.historical_pursuit_import_rows_immutable();

CREATE TABLE public.historical_pursuit_import_allowlist (
  source_sha256 TEXT NOT NULL, source_sheet TEXT NOT NULL, source_row INTEGER NOT NULL,
  manifest_digest TEXT NOT NULL CHECK (manifest_digest ~ '^[0-9a-f]{64}$'), approval_digest TEXT NOT NULL CHECK (approval_digest ~ '^[0-9a-f]{64}$'),
  source_row_fingerprint TEXT NOT NULL CHECK (source_row_fingerprint ~ '^[0-9a-f]{64}$'),
  PRIMARY KEY (source_sha256, source_sheet, source_row), UNIQUE (approval_digest),
  CHECK (source_sha256 = '6fa8b640dfcd385c2bd6dabf571ee01a4f51d09a53122f65c422c047ddb3f60f'),
  CHECK (source_sheet = 'Synthese' AND source_row BETWEEN 3 AND 62),
  CHECK (manifest_digest = 'b25008e1dfcc7c9e8f21f0f2aad5d757e54ed508243a89595fd5e231feb907b7')
);
ALTER TABLE public.historical_pursuit_import_allowlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_pursuit_import_allowlist FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.historical_pursuit_import_allowlist FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER historical_pursuit_import_allowlist_no_update_delete BEFORE UPDATE OR DELETE ON public.historical_pursuit_import_allowlist FOR EACH ROW EXECUTE FUNCTION public.historical_pursuit_import_rows_immutable();
-- Reviewed 60-row binding. This contains no buyer or opportunity identifiers.
INSERT INTO public.historical_pursuit_import_allowlist (source_sha256, source_sheet, source_row, manifest_digest, source_row_fingerprint, approval_digest)
SELECT '6fa8b640dfcd385c2bd6dabf571ee01a4f51d09a53122f65c422c047ddb3f60f', 'Synthese', split_part(binding, '|', 1)::INTEGER, 'b25008e1dfcc7c9e8f21f0f2aad5d757e54ed508243a89595fd5e231feb907b7', split_part(binding, '|', 2), split_part(binding, '|', 3)
FROM regexp_split_to_table($historical_pursuit_bindings$
3|823bf1d4582222e46a840ade048ecb5aa27d68e19761ccfb7651863b35845e88|d82339601abd10a72edaabd93ecab8b9c4e0202fc2682e2ddb320529266a4c30
4|11b1e4e65ea321798fa5d240904a5e45381364304dbd227cca21b0c012efafae|9a64278f858b1af4981b2cf59d408db98d92ff4b90e43f0585fca5c82bc77237
5|b1f33255702e5021bb8c03045a08103859981072822b11074bd81dd6d2e9133b|55fcc8b69b7389e73cfd0d4d2937f25fbf72307ef9ba2597e67c17368ec7ac25
6|7b73931c67dfdc885bd2d66b224ac0bfd4898e6884db4c9247026a7ec0954361|1a80b5aec65c88e71d694b7608bfacfc28eacbf76446aa1586c8b260aecb5214
7|6aff823be2b7c3bb67c70c0d74809e1c93e148eb0acb5184c864d35caee1916e|13df79fe5b200353cb8233108644421a4a393c980b0dfda44db80b4d22438981
8|ca82c003446fce5edfa9dd7591ffa8a1545acb9cd5034c3572dff53c222d8eea|b0bb0c77360b922c5d5667f6e323867738ed9c5d0f887e88ee1ff05e5ff0da9d
9|1bee152698db794b6f4f327f136d83df4e886fd2d21552bb368da041d1f87786|67485172fca106d4120efbb896364abb54646904a9af3c30b458fd6dbe962678
10|3b3f78cd83cdb3069dd5a47c7e774ed813a48b76b24e973f39eafe89c02139b0|072c0d7ae232a2becfcb9ee4b7a5a2c9475998283b8ad12091f13e6d6210921e
11|6cfccc9a555fd0a1ba81f0d1bf602fce91b5c2c2659e97483501b3f6df1aceb7|a8d4c5b2175d84e41c97c72e7770787e5118ca39d501250be023c3dacca34d10
12|edf2f57e9738ea126b1c2ed0222522900741708818849e316faa86e3982adc25|5bb3c8b821ee2152e9aa7b4f347a88333523837e6089745f87804697ecf0a7fa
13|a8b730bcf8d789a1aaef887dfda502c631c7a7ec5ce3c8497fb5c9aa872a0286|6317591abda29d88f0e866631f5cc284de4879ecf1a32bd03c2147049ea92918
14|3fc9c2c2c295495c7b85c4109b6e8ffa2c52c21a7d4386a54db13df8b2a9ee59|7de1dd0298d589f10097b868c64f11ae8e97cb52f4271ba4f44e39d96fbb32aa
15|8bbf259800e02960f54fce9814b2dcbf448235c6e16caefad103998b6a448915|f94052fd1fac796632fd8813a4ce110e25ecdaba7ef05e8d8e208ebebacfc2d8
16|70fa6ddf2bc39cc72fe1fcf22ae8f2b454bf5e7906516f33fb4976e3afd51f36|c7d2f3b5239c063d25a8f7497a49b7e33013f54a71a4ff28008d3a9c3d5a8adb
17|e640929c01dd86447a47ca2aab6396d0e47e0899fc03863cc36b8caa5eb062e0|a0d2e079d4e112331a09451a5b8420a32360621762b432a24f1985b5fab58acb
18|0847ed260696136ff0816901c814b7929bde4606a8b6eb3b62796117fc7ec63b|69dfbf0c3cb31ba9fa600efb6292fe4a6bc56045d6495bf4088f9c11aaaae1f6
19|86177ed2beca66c4340d179fa9cb817c1cd899ed03c802d22395ed437c3f3145|3bfd6aea70ece3f448d6678e8e24620f7b2ef11a8af6ceca43a5bfeb3e1872eb
20|37d3224ef41803dd5c05c65f3d20d998b33fa276c786a912022d3faec3c4ecb9|9c53ed2e967861864f645ccf25dbb38b2dce996479fca12454b7ed0de4f1eec0
21|57164516df2e04384190441ccfa13a02ac0cb5d06cb5f7371497290840a9f6ab|ec9b916e6073bfd9f232b593aeace6a6383d0c7dfb92192b2f94523ccf82f43c
22|930037550fc4100673d097e40ce1f6fbd8bbb4b99253afd7206ab43d8af6854a|0e88015a3d4d4cca8c02a93e3490cb2124c7a241e11c415e9f8eade3773bad20
23|64acdaba26c0ac2059982dd7a4492b5b1850885a730e62e9d1bc93b7b8024f94|fe4ba5297c7e75b92e1b129aedd22357e24bca77f798e11e8ef8a70192e380a9
24|c92bdd500a9cd9c05556d8314f0853e3f2f6b02af9c4de637ef20896ae236f22|983882e525ba6f2752e7e10600b2aa84805b358199af54b5e41cfce4d0fd7de6
25|72ebf8887f29afc94337e1a59ed788baeeb88fe192ca64c287d57e1583419306|c45d879c57463c451f033048ec93482155d7be9e7f11c3378376d26b240e6698
26|5b8fd6f407e408eb15ee6632d1d145dc83941c02fe3a20ac115438ac3b5bde73|53b7365718081938ecc7277e33dec8e768ad04ef9ecae6ee9a8b5bb0326e7a9b
27|2538b4b40ad864e97d1e255c0591d92757ffc20aaf33a9b77094f9950938c30c|bbbb9e49df1205aea32178f1a20f18e998f44eae88d043392d85a3a887c6183d
28|b235cc1f80c84d9ea58e3ca5f9453254c1a555fb25b6bc44d27440247b251cfe|8650e1b668a3dd04bcc9ca81e3405c80d1dcfd571bd0b061e1ba70a197204585
29|b1e791313706ab0ac41f6195c6317b3e99b5e8ed19c55848e9d4bfbe6f6d6735|adc852693fa7906ef2b637ce2a27c22d4554733bd6ea2a1f6c38e4ab7d581867
30|c450927aad38c0fb08e7e72984ebae31f3a824ea1739c118eec23c7f63bc36d4|d68c005359ad7da54400cd8bf0d48c9914890fc1db60b4096e02802b9bc6688e
31|a749a3bd1818157d75ca35fa6ce65de2169bf84ab3279762475065fb8bdde7fd|30af4e244aa5320ec01b1f6e7b8c455db47743c6dcaff6af5eabc50bf7753bd0
32|796e806999999cbeb70d1dc849ce9730c955592fbd691e8bc083f5fe376dcf7f|226c2541a0d2922d9db7aeea05002da31f726e92750b31cfcd6b32101dd7381f
33|f9aeecf85dbe2b828bd9ea12f224c64b082980aee5d92ac4daf684a1b327781a|ccb60b61b61d014e89d808a70251a2c6cef2e043e7ccd569a2e04cdf9b7089ae
34|24fe876de2d24ded493c4f56572527e5531a56cc353ef51b86f8be5a89d9d987|ba2389d7f6118996a0555726fcc3d92ac1d9d2f6bcb9caa588d832f769b37dad
35|35aaa9d6b907b890758ecd48695000b388a7b24491a54b4d3ca9ec0fbe251999|89303ffbd9dd94cd89589776af7671973f9ef66066ff613a2879509e54c5bf41
36|174d13e06b7d011dffe205aa1bc02660f38f4c9686cd207c543515fb9eba3f74|55696a7ab31f3e3a1813e7bd7ab95cbdbf7c3b44c30a5eac1fc06030a69abbc8
37|7b70d14bc95d183f7ecaadf86c3f1d5c8d960119b5682226569ea77cb6748cf2|36f2bce58534cc58f42a622a8d59fb48920aa1a639d79dea7ab48d29d0fdfe08
38|bfefaa6a368c05a0697ef1b27d3abf097527fa6103e4ac3fe1a5afa7ba65d3c3|7e67e1fe0ff3919f07219af740b8d6fc45f868cf1800a4146b54b6171dcdac47
39|59819e7e1bee48423bc775c53f93e903317116e9e22e3222bb9e2e8e15edb134|7da6a5a2b4920126087a7eacbdc965c3105c5a2bafa0cd4dc84de5770570bd7a
40|48cbad5a9e46fc9d6e3055be71de7d8d4a3f88010ee96808771f68a5c64722e9|2d4e134b5c4fa57fc5d77bb2abf052e05e25dd0be6b4b8b0816896ed80e96025
41|310d55f833abd8eab93a13058743e98861a1072497307bd4333f56256a33e38f|af78caa8e21e6cc5a16f3f3cbb7e3a6855a26f7a60382d2a4a4016b71e570da8
42|7f78afe606910152bc5cee17f097dd87f62e83fe9e2c4dac0b16584cd7d8c46e|3a1963fefbdcc376aca6b372fbcddae8cc95ac8f4742943c21db8c6949723802
43|5f937d0c7e01a029eb4296d1101c4dc76b5eca8948eba8225bd425cd67cc2b59|ee57a2c2474013eff4f294336f331fc6e50a8a1fb5cf0b2b353c5bdd790ac196
44|1db83fb32605f3e3d591e6b30c41a39a7e428a1f0c74e825338f6cbc369acdf5|34f0c0a33e27372797868b9f8aa9bd9f6618f06702a13e11bca6a2d87c1f0c94
45|388db9e3834fc3758499ba11e5df5034b852373b0f7470dfcd51e7b955dab66b|120c492ede4a33af2499ba8ee7d2e10cff69a88d0274c039da972c051c6012be
46|d2b430bae9e5ee5560834402874b6d14084e82c566d7caa82f5c7e382eadf66f|ff44e2565195b47d721c588e19c0a515605bb79c7fc1e7a9d15733ac4ee532a1
47|9697e96724e47b96f80bfb921d00267fdefc0e552196d30d0cbceb2133f17ec2|d1a8b0a592a2b09643580b498004f0671a9dc19c0e93fe6b810a7a76243c67f4
48|c1e4b0219e79f5ecc64e93b5574bb40fed0ce29495272ad1b4041a94c8192419|0d6c9edfd1bb4076f8e0859049727ddffa57bdbc280976128d34b9789a7ae034
49|82f6b71903130ac5f27ac100bea0f0838278716b4c28e0a5c05c630f8e92c6e3|c3bb14c486a538488bc95a742be19d85f987036570ab2aff90b571b0a4fdc4ae
50|69f406d42ade3ea603d7a64b5cd0df321bea8ef2e3ee3a617ac04eaa4785081e|9e3b0c409072c5b0f671a55235047c349bef6f8b36bb8f0cfa7c659aa2e2ce4c
51|b657b66b0cdb61283790440a68cd343857e6ffe4675e51c5f26ace291ec3eff9|9ff61e54b27cd08d07bc4a71e37b4dfbad8afbf0eddf5b917258ed99cc0cd3bd
52|3657dfcef94d42a1276f0f6a637008a88878b8d7d7aeb1a6eba626a4d0325c3f|79a880e2af41d089ea1c0d13ab019332f5c3516e0d59035f1c17164da98ffcca
53|80afef0566a336955fe5e81e2ea0f93f62db49549ef9d740415dbd96def5b6a1|babc37ab6d1dcb741d235df25c61d3cdda44bf34be5dc1788fcb2e0625a7893b
54|6a1bd2fed1babb232714d893d8ee14366a3408d0a77afdc250957b70443042f1|f7b132895a5fb0b4aac8aff89313ca4450f7ea15b3d5631a26da305fcc80ccad
55|eecf629a8fcd5687650f81c0d8c7acd5ce10cfbf55ae19a4c81489b4bdceba01|6fc121afc2e2e46b7292c8f1c87148427a2e53d1f4fc9e37ba38e0e067d5682e
56|9daadbb2b0e9bc0b6fcc316b8c6651cf724bbad6a93eed432967390d4926504b|5192fcaf4b75849f18414c8dde509160373c891e9bb6e770cc18865e75e17771
57|1d176e4ba541d5a3f90512c0230fb27a849aab68088bf0cf0be7f80d86466aa4|cef98ddf6f3306e4abe0bfb9631b5f2a771178753f5b6cc97127688d194ac625
58|1cc01c6a0e967fc5193753f438492b9742f422de805c26a7b354b1897bec06ac|f3643adc739614d2f7724eee5af69f617002830d40a58a8fff33d3fd96e0e7e5
59|6c307ccc8193191a7b250497348ee1e0c68280f4b32e02256d6754e3f61a6706|a95437eb73abe836f9b74e3d1bf0d0e9bdaec674f1706777ee064697956967c4
60|d26dfa3c3571359933ba260bf09260941f42666fda854b5f843a7223c2fbb190|757ced62c8b6ad1c72f3adb8013d5672d38f2627ded07c0dcec339b084bd79b8
61|955b1b272bd6516b608978f8c35633c749e7bdb61e600a8d019bef26c9270030|675b6c4baccb13e562aaa02d9ffcc786b2dcf3210cf8d95a0172853324592280
62|37e2333d459ab1b80b7938a5548df323ded65e9436b2f039d90ce15bb3377547|c76a6fd32267d95e354fd132fe9e9cac4b0c007412663236888066991f835d6d
$historical_pursuit_bindings$, E'\n') AS binding
WHERE binding <> '';


CREATE TABLE public.historical_pursuit_import_source_bindings (
  source_sha256 TEXT NOT NULL, source_sheet TEXT NOT NULL, source_row INTEGER NOT NULL,
  manifest_digest TEXT NOT NULL, source_row_fingerprint TEXT NOT NULL, source_payload_digest TEXT NOT NULL, approval_digest TEXT NOT NULL,
  PRIMARY KEY (source_sha256, source_sheet, source_row),
  CHECK (source_sha256 = '6fa8b640dfcd385c2bd6dabf571ee01a4f51d09a53122f65c422c047ddb3f60f'),
  CHECK (source_sheet = 'Synthese' AND source_row BETWEEN 3 AND 62),
  CHECK (manifest_digest = 'b25008e1dfcc7c9e8f21f0f2aad5d757e54ed508243a89595fd5e231feb907b7')
);
ALTER TABLE public.historical_pursuit_import_source_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_pursuit_import_source_bindings FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.historical_pursuit_import_source_bindings FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER historical_pursuit_import_source_bindings_no_update_delete BEFORE UPDATE OR DELETE ON public.historical_pursuit_import_source_bindings FOR EACH ROW EXECUTE FUNCTION public.historical_pursuit_import_rows_immutable();
INSERT INTO public.historical_pursuit_import_source_bindings (source_sha256, source_sheet, source_row, manifest_digest, source_row_fingerprint, source_payload_digest, approval_digest)
SELECT '6fa8b640dfcd385c2bd6dabf571ee01a4f51d09a53122f65c422c047ddb3f60f', 'Synthese', split_part(binding, '|', 1)::INTEGER, 'b25008e1dfcc7c9e8f21f0f2aad5d757e54ed508243a89595fd5e231feb907b7', split_part(binding, '|', 2), split_part(binding, '|', 3), split_part(binding, '|', 4)
FROM regexp_split_to_table($historical_pursuit_source_bindings$
3|823bf1d4582222e46a840ade048ecb5aa27d68e19761ccfb7651863b35845e88|96c7c244fb598c586aff275ee411724544901ccb7d656acce13855a812c66336|f55c672d8a3274c433a408525141b8436a0e26c62c43e5a0b9480e39137ce257
4|11b1e4e65ea321798fa5d240904a5e45381364304dbd227cca21b0c012efafae|f6111dbde764e9f33ea5a04f4f3845d34093f634dd16c7aece083d050c0c56e7|3ac5b44c20729e2e209bc925d02814d4e0aa8dc95844b8f8c33eedbd0c6539b9
5|b1f33255702e5021bb8c03045a08103859981072822b11074bd81dd6d2e9133b|2e547bf5c7818bd6b2ac2e3826812c7d59ec0d2a8fa982ce92708ed256a587dd|2901e67cd4b9459cc9af7dbf2fc96b0082d9a1367f74fc6f777c6e206ffc4b41
6|7b73931c67dfdc885bd2d66b224ac0bfd4898e6884db4c9247026a7ec0954361|c22d7bb40fa36524b89c14bde6c5a97d5a12f46a6166ec7629a1ea7ef707ab44|28b910820462839c93a0c88598f33a300b6ebf7d4be121a7621e48b4099e3a96
7|6aff823be2b7c3bb67c70c0d74809e1c93e148eb0acb5184c864d35caee1916e|d3e52a9a884c924a8ff13657a8c773c6c66bb47f3451d81ad0cefbe251925d48|4cbaf702601d413cd27053baefe57ac5f8068b26e8c5ec5e70c351ed08599515
8|ca82c003446fce5edfa9dd7591ffa8a1545acb9cd5034c3572dff53c222d8eea|0c737edf397682ac9e4d1ee9b22235a2948810f0cf7e1d5752a1494f0d367fd6|72008e58913735dd027b4b55ffd40cc6e559b7d6bd63ab72aa1d0aecb9f58954
9|1bee152698db794b6f4f327f136d83df4e886fd2d21552bb368da041d1f87786|c38cb2c486acb513854dbe7c5640a08b67d667d1cd1abd1255dc9353b66207fc|44ed202d287cdab42172b2d0cf36b65717ebfd1f8e887fcf83d50cffa35ed8a3
10|3b3f78cd83cdb3069dd5a47c7e774ed813a48b76b24e973f39eafe89c02139b0|869f9573745aabd8b3faf069328cff2dc1155c2c673bcdb1ab2e4a40bd32ae6a|d7f629db8cdc81a5ee689becb2da3dc0b6c785eb6f433143966f4f547059eb37
11|6cfccc9a555fd0a1ba81f0d1bf602fce91b5c2c2659e97483501b3f6df1aceb7|4ccab74979ec24746534e152a3b02e08fd94b1c03fd2e354f847a26cdd79396b|caa9daa055d64d8b6546292a2b8aae9f0e58ef746d2fb9a39edf7fb26816a4f8
12|edf2f57e9738ea126b1c2ed0222522900741708818849e316faa86e3982adc25|1f5b401723226cb2dcb5eead260b2fee937bf632730cc916e695a76a6451d222|b0ae5c045708246336a5b903825a89946925f56bc9077b60900f3cd7eea4cf18
13|a8b730bcf8d789a1aaef887dfda502c631c7a7ec5ce3c8497fb5c9aa872a0286|24e9c1f370273d50b0433e83e8b907eba303cfd41b30af77a1f985d1e5523114|5d0c20aa3bcdd18d274d2da40849aae31a2fb87627684e0572eb96b2b4a2f34c
14|3fc9c2c2c295495c7b85c4109b6e8ffa2c52c21a7d4386a54db13df8b2a9ee59|b1d45e37114e24ba63808f4bff1cdbdf79c976323b1e59c9be8f4753704e572b|c8462a9941fb766b7d7ac1bcb9cc4774e5b88e8604bc6f7c64f6aab121861071
15|8bbf259800e02960f54fce9814b2dcbf448235c6e16caefad103998b6a448915|02b00ef073f8d63f4d91e2da5583821213266323919e74f243b3035fcace1237|504ee610eebe1405b81b48f479fbf14204064f8fb89f799e6507e4e3a2c7c8fa
16|70fa6ddf2bc39cc72fe1fcf22ae8f2b454bf5e7906516f33fb4976e3afd51f36|1c21d864410714a906ef0c7cea5337b93d549c43c6f2612a52a9fd1cb616fc5a|0eaeb72da696c47e56feda5213baaf659fd72eab0125ab98988f4a3216aa0334
17|e640929c01dd86447a47ca2aab6396d0e47e0899fc03863cc36b8caa5eb062e0|f86c5ce7e4d205637f3bf67fca8037c0cd4843a00b42c526366cbdadc8ca3a63|b3904c1999813c879a7dde536e136a18d2be881d512cd93892477e25485e73ea
18|0847ed260696136ff0816901c814b7929bde4606a8b6eb3b62796117fc7ec63b|d99fe7eba7df1ed738181d46c4f0092fd4362f5d528f770fd6cb5b789238c568|3ac94c609b75b7048c49c338faf8a362b8fc82e114f253989cae65706982fc09
19|86177ed2beca66c4340d179fa9cb817c1cd899ed03c802d22395ed437c3f3145|e67529dd1562bc4f03f430406b9af6020c7eb7f491e742b2ee1a5e38de55d63e|9dbe09e17a24ab74d5b7675d5ba254ab7a55488eae1aae5cf8c1c9945e5a700e
20|37d3224ef41803dd5c05c65f3d20d998b33fa276c786a912022d3faec3c4ecb9|a33241df4f0cdd67b11e30176061187b05c58121d94cc0790a0a5a1e63603d48|7eff9b07fc5d0557ea83a23cd4b93a5957ea5de187ae0415e9712a6d5f32a558
21|57164516df2e04384190441ccfa13a02ac0cb5d06cb5f7371497290840a9f6ab|c58651f6a9d5c96c92795d2a33e6f67ef0651d9ecfd830e5cbf37069fe90a7ba|ca33f323cd04957bbf05b8ad81dcaeb3364139d86f76078f930fec0937dd3c57
22|930037550fc4100673d097e40ce1f6fbd8bbb4b99253afd7206ab43d8af6854a|7b31229fb2ff6627571a5527be044b89b640e1f0920a514b02332cfc26fde4e6|29649018e4aabcc2be1502b914196cbcc346b20ab6be205e13614e5d7cfb65e0
23|64acdaba26c0ac2059982dd7a4492b5b1850885a730e62e9d1bc93b7b8024f94|5ef2a986bc00df386fe424b192c44c1c124e0dd9140a2f19272414690ed5e62b|01f32fd6559015df1c2aba4509148fada2c0036d29c611e005ba8af59b511be4
24|c92bdd500a9cd9c05556d8314f0853e3f2f6b02af9c4de637ef20896ae236f22|f2fa89f2fe8c64b9b0ed9efd5ebdce43b21f36953c5db210adf0786e30854d87|cee86919fccdbfd968711286f4a3158b3ecc9d6e3e5f1f99fbe6ca46b091feab
25|72ebf8887f29afc94337e1a59ed788baeeb88fe192ca64c287d57e1583419306|cac6536b100f4c411f3dcc9325379614cd384acae0b92ef6a02a29024b74160f|570fa63c4f7f8a014172fc21742b5f95070792bdf2b035ef1aa351e81d5a037e
26|5b8fd6f407e408eb15ee6632d1d145dc83941c02fe3a20ac115438ac3b5bde73|a7d730140798804556f38086e65f6e6ba8290c4e4150a2b12282bbf4a11628eb|92625f220e5e376ecc2dc168f23a8e50bbb84c67fbdb6036c14e2338e5ef21cd
27|2538b4b40ad864e97d1e255c0591d92757ffc20aaf33a9b77094f9950938c30c|9908ca65e2ee3e2fbf7d9a2d539e74bfc296cd76e88275b23d5a73936af197e9|ceb8de70a05aacc74f8d4f38388f5ceb5961d6ec0b2107617d5695bc6b739a84
28|b235cc1f80c84d9ea58e3ca5f9453254c1a555fb25b6bc44d27440247b251cfe|2ff08f2b251fcce463223bc43f6ce6711c5130a2ba34ad713c1a3d9e394bb248|939661c0290ff74f71ae27ee496560cc9d2d100b366df52b1d31e45935868548
29|b1e791313706ab0ac41f6195c6317b3e99b5e8ed19c55848e9d4bfbe6f6d6735|58e8120f18ea8de1da37cca08debf73276a16a727ee946a5990f6e1af96231ad|9f093a5381baec430f282bea2f63a4f38c6e02328a61f4c5e05568033592eb9b
30|c450927aad38c0fb08e7e72984ebae31f3a824ea1739c118eec23c7f63bc36d4|6735cf500dbf017683d27c8001a3292627f11f078cb70a23e2fd096ea5e05d2a|8d6b5501e303b7c4a1894f2492b4d11848bdd3cd11e42ea31283a76b0dfdc18e
31|a749a3bd1818157d75ca35fa6ce65de2169bf84ab3279762475065fb8bdde7fd|ec32961d3505b772b53991d2eeb753d5d7f105b5c8adf86d86c5502001045465|b7fb23f1562794e2fdee916f3b35dceabc4e7f0af4050d0fe8b8b97df43e8732
32|796e806999999cbeb70d1dc849ce9730c955592fbd691e8bc083f5fe376dcf7f|c447bd099a628eed061db82687749fca5975397d94ebb7b3beb22fc5f0484233|d8c6272f0f1d9b38611b28a05c242f89497fb085295dfdd4574b4fb3ff3429b6
33|f9aeecf85dbe2b828bd9ea12f224c64b082980aee5d92ac4daf684a1b327781a|422e8c6d3025ce27a85c522d4da8305fcf44b86d5c692958551b189fbbe3f512|918daef00f84d6839d1873894e55f47c4b5c5b7d8c3b15aba55f4bd992e2ae7c
34|24fe876de2d24ded493c4f56572527e5531a56cc353ef51b86f8be5a89d9d987|879866f960a7ddcead262636bb0e209a91290cad0b0389521814a8c758bcded1|d0f7c3a994ba9b79e34a98408106837dddae13dc825740438b8250730ffe6059
35|35aaa9d6b907b890758ecd48695000b388a7b24491a54b4d3ca9ec0fbe251999|5dbaa079092c0b3a4f3068033ee118ed07edb2369a44bca13ea2d3a966876ee8|ab89303c63f0a3e49f002b5d1059f7484770a7580fd5b56887b15d0a25258378
36|174d13e06b7d011dffe205aa1bc02660f38f4c9686cd207c543515fb9eba3f74|b53db4f32563dbaae7002a8af2e9e2dc56e993918d7734004b86f2d76ac6705b|43e34830b7a93eb10aef96f038ee98ab7d3e24e465e84c002f5a32383e868bda
37|7b70d14bc95d183f7ecaadf86c3f1d5c8d960119b5682226569ea77cb6748cf2|1c0c7cfbb55b9d2ecb4a0ec72562b4653ddced75be46a0c1f8eb0a9b56e9bc36|553f3b6d409201e5784dfbd3810e8650d2fa0de842034adaaa9d6ca57b6541a2
38|bfefaa6a368c05a0697ef1b27d3abf097527fa6103e4ac3fe1a5afa7ba65d3c3|328195267d1c795838b5ed12ee9105971afd3bc10b3cccdf48d8d5bcec062ea6|7f3af826d4001a98251953366292c4715e6fe238f84ee9c33879525358140b67
39|59819e7e1bee48423bc775c53f93e903317116e9e22e3222bb9e2e8e15edb134|f04a5e8197a8e7c1f11208fe9ebe93d257ad14a17b9ba5457cd1f57f432f74bd|3374e63a00d927b99e4031a9b142f4125103848417249c8c48003e917d092ddb
40|48cbad5a9e46fc9d6e3055be71de7d8d4a3f88010ee96808771f68a5c64722e9|343bd9abc9c78b519c6af8bed76599e75ae27be765bf7fa4305bccc61c6aba0b|135e63ce74bce44b6e4ea7f66ea0c059179d6972ee8feef3cc193d760cdd28eb
41|310d55f833abd8eab93a13058743e98861a1072497307bd4333f56256a33e38f|2f7b74fa48ab874ed50a311b93a5dce4241cc1fdbd16f15a6120f90cf6d57ee4|e321b736ccf6eddc0ec9b8fb875a1ec8a03b818a0dfeb4f2068916e5a22f49fb
42|7f78afe606910152bc5cee17f097dd87f62e83fe9e2c4dac0b16584cd7d8c46e|bd560d68c712eaf0f5bc8e605664c6978cc332bd136a7da93537a45bc7bed413|58c49b0954328a5276a3f0c539ecd0a66db280adc171cf12f5a2b5418833f9c8
43|5f937d0c7e01a029eb4296d1101c4dc76b5eca8948eba8225bd425cd67cc2b59|3e6e2e87f4ab8023249164ce113add07114ede741d14051ce518abcd6f3000a5|fbd2a53d6344764ad632cff364a1b3b061e3c1944e914f13d874d8945d5ea2ed
44|1db83fb32605f3e3d591e6b30c41a39a7e428a1f0c74e825338f6cbc369acdf5|fb688e5004daca0e04f9374e1b4d6b6b1d6e63dd40607357c88436174eaa3c45|5f003c9b6878e9dffc9006d2705e6e8338e97c9237ef68c8eaab0b4f10efacdd
45|388db9e3834fc3758499ba11e5df5034b852373b0f7470dfcd51e7b955dab66b|7a7ee6cb4a233b59674a03fd1da4fb4223d424dbe407409b723af2555d469ec7|d7a9e76478617b5e1e4fb63d64d4588f512d2b2e0f8268e4f6ea8cf546a26716
46|d2b430bae9e5ee5560834402874b6d14084e82c566d7caa82f5c7e382eadf66f|0f1c7e40da85e0bb72dfb327b2a8dac43c4daea43469386d11fbc974c6c5b848|fa8db573ad9b7769e7c54b5c8e51c7b7c21daccc813502e30e61e79590d0234c
47|9697e96724e47b96f80bfb921d00267fdefc0e552196d30d0cbceb2133f17ec2|6afce0e45e9f7ee856f845f977505bda8e91045988aeb35badb816d1914fdee5|3c9a605d5a78a89160fdb180f9e8ea47e1ab424a43cc4e65ea568aebb03c8209
48|c1e4b0219e79f5ecc64e93b5574bb40fed0ce29495272ad1b4041a94c8192419|c4e63265b6de7a444f668e3dd549ad533bcc893ffd51f2691d38320e820f9baa|67d7c172e0258b8b1081e3aea99f66e3219946fd099ff6fed492d01adadf374c
49|82f6b71903130ac5f27ac100bea0f0838278716b4c28e0a5c05c630f8e92c6e3|35101d36df316f0c256977db76c83b0deeabd0688541b0c933764012b9a80814|34b43c8c121bbabdb74deaeb8c5d7fb2bddbc5465065f77a8f50de231986d251
50|69f406d42ade3ea603d7a64b5cd0df321bea8ef2e3ee3a617ac04eaa4785081e|de81d0914857afc1e47b8a88fdbd6d74c5cdc3ba0583ca9e31c1b29a45ac4600|17c1c09a7843739f600ddc18acfe399b83594e9408cdc225d709c72a54723962
51|b657b66b0cdb61283790440a68cd343857e6ffe4675e51c5f26ace291ec3eff9|fb5cf137e3b7c5b31366e9a4329a1de15170df62536b394c176ef7a38f0b8720|c7b38002e0a9cc9dc98d77ef47f471a106dd946cb180b90b374b4adf5f621c4c
52|3657dfcef94d42a1276f0f6a637008a88878b8d7d7aeb1a6eba626a4d0325c3f|06d9db96a9811d7c09420675437ca4e362bbbd179f421d9a2d8f92a6888f91bb|7b2f83d341689c4b59873093aa85e64dfe6334e62710d16ad225aac8272e8253
53|80afef0566a336955fe5e81e2ea0f93f62db49549ef9d740415dbd96def5b6a1|cb44fd8d7a2881042fcff143f8376ad256b408fa8bbbb950ce5c1c839b5f0e91|dff603c0a444933e70463c77e1b44ef652c126adfbb7fed5a76fd3107908329c
54|6a1bd2fed1babb232714d893d8ee14366a3408d0a77afdc250957b70443042f1|b80f6678e1e8453bedd328996d39078094ba940fe1fce1f58b8c2ae10f3f3542|2165bf6386cb7c6a0d783bd74992459ecfcfac8cee2d4d9aacb7968fa9101431
55|eecf629a8fcd5687650f81c0d8c7acd5ce10cfbf55ae19a4c81489b4bdceba01|1a606f5d0836aeb65d443bd746db9227d9aba451fbabd2db4cd19dc89c191178|04ffc2a0862946d5b851a766cea7534fa8f1a517bd87ade518cd275f20e01de6
56|9daadbb2b0e9bc0b6fcc316b8c6651cf724bbad6a93eed432967390d4926504b|46f2c5332eb4c9d04724629c0723f8e8d0b537267b5e5b0c302eee2616c76ab7|bdce112db410823633df9722ce718db3029d2feb7757a04de6eebc746842123f
57|1d176e4ba541d5a3f90512c0230fb27a849aab68088bf0cf0be7f80d86466aa4|3dfd6afedb8575d4967902ccf7eef107dbc0b137a52942261297d21233a8a78c|3c4b8affc0f5d06b7a89a0cadc4b9b6e38f7dbbbee38d167886e36ba23dfb989
58|1cc01c6a0e967fc5193753f438492b9742f422de805c26a7b354b1897bec06ac|c3a78653a57af42d0f7a36491d56601a3b9d37959e05d25c19725852db0208a2|392243f0348a5c5442e1d1119ea510230994cea242fe69effa4cfc211abd43b3
59|6c307ccc8193191a7b250497348ee1e0c68280f4b32e02256d6754e3f61a6706|d9efede74795b8617a25522f6bd5650e610067fd32c42ad19e4d37accc853a75|397b14866feb69acb5ff37686914c016a2c7ade4a075823109f772a3cdbef79c
60|d26dfa3c3571359933ba260bf09260941f42666fda854b5f843a7223c2fbb190|03f39a62f1dfe71468bb791847f0268e1ff19c354519da7a5376224c73bde1cd|d879ca4daeba699e20490f84c26ebf6b370e34eaa1776acec2cf12e68b183966
61|955b1b272bd6516b608978f8c35633c749e7bdb61e600a8d019bef26c9270030|dbbfeb210130fce35674f45294fd3cc54724b90a2ed6f6c3823bb53fa0833ff8|e748a629fd62e7f7ad3a650a59e3f5b2bc91206a502e2bde0d68fa1c554a4734
62|37e2333d459ab1b80b7938a5548df323ded65e9436b2f039d90ce15bb3377547|e994ac30021c0944a6eb29a71257c04b4962cd4baa60d2ff950359bb30c16295|e01d21d8059475ba6e288870dda42e72f2aca78a3185423e8bfc343f19f67495
$historical_pursuit_source_bindings$, E'\n') AS binding
WHERE binding <> '';

CREATE OR REPLACE FUNCTION public.historical_pursuit_import_length_prefixed(p_value TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path=pg_catalog AS $$
  SELECT CASE WHEN p_value IS NULL THEN '-1:' ELSE octet_length(convert_to(p_value, 'UTF8'))::TEXT || ':' || p_value END
$$;

CREATE OR REPLACE FUNCTION public.historical_pursuit_import_source_payload_digest(
  p_source_repreneur_name TEXT, p_source_offer_label TEXT, p_source_opportunity_reference TEXT,
  p_completed_source_stages TEXT[], p_not_applicable_source_stages TEXT[], p_raw_drop_reason TEXT, p_source_cells JSONB
) RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path=public,pg_catalog,extensions AS $$
  SELECT encode(extensions.digest(convert_to(
    public.historical_pursuit_import_length_prefixed('repreneur_name') || public.historical_pursuit_import_length_prefixed(p_source_repreneur_name) ||
    public.historical_pursuit_import_length_prefixed('offer_label') || public.historical_pursuit_import_length_prefixed(p_source_offer_label) ||
    public.historical_pursuit_import_length_prefixed('opportunity_reference') || public.historical_pursuit_import_length_prefixed(p_source_opportunity_reference) ||
    public.historical_pursuit_import_length_prefixed('completed_source_stages') || public.historical_pursuit_import_length_prefixed(to_json(COALESCE(p_completed_source_stages, '{}'::TEXT[]))::TEXT) ||
    public.historical_pursuit_import_length_prefixed('not_applicable_source_stages') || public.historical_pursuit_import_length_prefixed(to_json(COALESCE(p_not_applicable_source_stages, '{}'::TEXT[]))::TEXT) ||
    public.historical_pursuit_import_length_prefixed('raw_drop_reason') || public.historical_pursuit_import_length_prefixed(p_raw_drop_reason) ||
    public.historical_pursuit_import_length_prefixed('source_cells.interest_confirmed') || public.historical_pursuit_import_length_prefixed(p_source_cells->>'interest_confirmed') ||
    public.historical_pursuit_import_length_prefixed('source_cells.nda_received') || public.historical_pursuit_import_length_prefixed(p_source_cells->>'nda_received') ||
    public.historical_pursuit_import_length_prefixed('source_cells.nda_signed') || public.historical_pursuit_import_length_prefixed(p_source_cells->>'nda_signed') ||
    public.historical_pursuit_import_length_prefixed('source_cells.info_memo_received') || public.historical_pursuit_import_length_prefixed(p_source_cells->>'info_memo_received') ||
    public.historical_pursuit_import_length_prefixed('source_cells.qa_with_ma_firm') || public.historical_pursuit_import_length_prefixed(p_source_cells->>'qa_with_ma_firm') ||
    public.historical_pursuit_import_length_prefixed('source_cells.seller_meeting') || public.historical_pursuit_import_length_prefixed(p_source_cells->>'seller_meeting') ||
    public.historical_pursuit_import_length_prefixed('source_cells.valuation') || public.historical_pursuit_import_length_prefixed(p_source_cells->>'valuation') ||
    public.historical_pursuit_import_length_prefixed('source_cells.loi_issued') || public.historical_pursuit_import_length_prefixed(p_source_cells->>'loi_issued') ||
    public.historical_pursuit_import_length_prefixed('source_cells.audits') || public.historical_pursuit_import_length_prefixed(p_source_cells->>'audits') ||
    public.historical_pursuit_import_length_prefixed('source_cells.financing') || public.historical_pursuit_import_length_prefixed(p_source_cells->>'financing') ||
    public.historical_pursuit_import_length_prefixed('source_cells.closing') || public.historical_pursuit_import_length_prefixed(p_source_cells->>'closing'), 'UTF8'), 'sha256'), 'hex')
$$;

CREATE OR REPLACE FUNCTION public.historical_pursuit_import_approval_digest(
  p_source_row_fingerprint TEXT,
  p_source_payload_digest TEXT,
  p_repreneur_id UUID,
  p_opportunity_id UUID,
  p_resolution_blockers TEXT[],
  p_review_flags TEXT[]
) RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path=pg_catalog,extensions AS $$
  SELECT encode(extensions.digest(convert_to(
    public.historical_pursuit_import_length_prefixed('fingerprint') || public.historical_pursuit_import_length_prefixed(p_source_row_fingerprint) ||
    public.historical_pursuit_import_length_prefixed('source_payload_digest') || public.historical_pursuit_import_length_prefixed(p_source_payload_digest) ||
    public.historical_pursuit_import_length_prefixed('repreneur') || public.historical_pursuit_import_length_prefixed(p_repreneur_id::TEXT) ||
    public.historical_pursuit_import_length_prefixed('opportunity') || public.historical_pursuit_import_length_prefixed(p_opportunity_id::TEXT) ||
    public.historical_pursuit_import_length_prefixed('blockers') || public.historical_pursuit_import_length_prefixed(to_json(COALESCE(p_resolution_blockers, '{}'::TEXT[]))::TEXT) ||
    public.historical_pursuit_import_length_prefixed('flags') || public.historical_pursuit_import_length_prefixed(to_json(COALESCE(p_review_flags, '{}'::TEXT[]))::TEXT),
    'UTF8'), 'sha256'), 'hex')
$$;

CREATE OR REPLACE FUNCTION public.apply_historical_pursuit_import_row(
  p_source_sha256 TEXT,
  p_source_sheet TEXT,
  p_source_row INTEGER,
  p_repreneur_id UUID,
  p_opportunity_id UUID,
  p_completed_source_stages TEXT[],
  p_not_applicable_source_stages TEXT[],
  p_raw_drop_reason TEXT,
  p_event_dates_unknown BOOLEAN,
  p_actor TEXT,
  p_source_repreneur_name TEXT,
  p_source_offer_label TEXT,
  p_source_opportunity_reference TEXT,
  p_source_row_fingerprint TEXT,
  p_manifest_digest TEXT,
  p_resolution_blockers TEXT[],
  p_review_flags TEXT[],
  p_source_cells JSONB,
  p_approval_digest TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_payload JSONB;
  v_digest TEXT;
  v_existing public.historical_pursuit_import_rows%ROWTYPE;
  v_match public.opportunity_matches%ROWTYPE;
  v_match_id UUID;
  v_status public.opportunity_match_status;
  v_terminal BOOLEAN := FALSE;
  v_outcome TEXT;
  v_last_stage TEXT := 'none';
  v_flags TEXT[] := '{}';
  v_categories TEXT[] := '{}';
  v_approval_digest TEXT;
  v_source_payload_digest TEXT;
  v_allowed TEXT[] := ARRAY['interest_confirmed','nda_received','nda_signed','info_memo_received','qa_with_ma_firm','seller_meeting','valuation','loi_issued','audits','financing','closing'];
BEGIN
  IF p_source_sha256 <> '6fa8b640dfcd385c2bd6dabf571ee01a4f51d09a53122f65c422c047ddb3f60f'
    OR p_manifest_digest <> 'b25008e1dfcc7c9e8f21f0f2aad5d757e54ed508243a89595fd5e231feb907b7'
    OR p_source_row_fingerprint !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'historical_pursuit_source_hash_not_approved';
  END IF;
  IF BTRIM(COALESCE(p_source_sheet, '')) <> 'Synthese' OR p_source_row NOT BETWEEN 3 AND 62 THEN
    RAISE EXCEPTION 'historical_pursuit_source_locator_invalid';
  END IF;
  IF NULLIF(BTRIM(p_actor), '') IS NULL OR NULLIF(BTRIM(p_source_repreneur_name), '') IS NULL OR p_event_dates_unknown IS DISTINCT FROM TRUE OR jsonb_typeof(p_source_cells) <> 'object' OR (p_opportunity_id IS NOT NULL AND p_repreneur_id IS NULL) THEN
    RAISE EXCEPTION 'historical_pursuit_required_input_missing';
  END IF;
  IF NOT (p_source_cells ?& ARRAY['interest_confirmed','nda_received','nda_signed','info_memo_received','qa_with_ma_firm','seller_meeting','valuation','loi_issued','audits','financing','closing'])
    OR EXISTS (SELECT 1 FROM jsonb_each(p_source_cells) AS cell(key, value) WHERE cell.key <> ALL(v_allowed) OR jsonb_typeof(cell.value) <> 'string')
  THEN RAISE EXCEPTION 'historical_pursuit_source_cells_invalid'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(COALESCE(p_completed_source_stages, '{}')) AS stage WHERE stage <> ALL(v_allowed))
    OR EXISTS (SELECT 1 FROM unnest(COALESCE(p_not_applicable_source_stages, '{}')) AS stage WHERE stage <> ALL(v_allowed))
    OR EXISTS (SELECT 1 FROM unnest(COALESCE(p_completed_source_stages, '{}')) AS stage WHERE stage = ANY(COALESCE(p_not_applicable_source_stages, '{}')))
  THEN RAISE EXCEPTION 'historical_pursuit_source_stage_invalid'; END IF;

  SELECT stage INTO v_last_stage
  FROM unnest(v_allowed) WITH ORDINALITY AS orderings(stage, ordinal)
  WHERE stage = ANY(COALESCE(p_completed_source_stages, '{}'))
  ORDER BY ordinal DESC LIMIT 1;
  v_last_stage := COALESCE(v_last_stage, 'none');
  IF cardinality(COALESCE(p_not_applicable_source_stages, '{}')) > 0 THEN
    v_terminal := TRUE;
    IF NULLIF(BTRIM(p_raw_drop_reason), '') IS NULL THEN v_flags := ARRAY['missing_reason']; END IF;
  ELSIF NULLIF(BTRIM(p_raw_drop_reason), '') IS NOT NULL THEN
    v_terminal := TRUE;
    v_flags := ARRAY['reason_without_terminal_marker'];
  END IF;
  IF v_terminal AND NULLIF(BTRIM(p_raw_drop_reason), '') IS NOT NULL THEN
    IF lower(p_raw_drop_reason) ~ 'locali|geograph' THEN v_categories := ARRAY['geography'];
    ELSIF lower(p_raw_drop_reason) ~ 'sector' THEN v_categories := ARRAY['sector'];
    ELSIF lower(p_raw_drop_reason) ~ 'size|profit|financ|price|valor' THEN v_categories := ARRAY['size_metrics'];
    ELSIF lower(p_raw_drop_reason) ~ 'business model|technical skill|operational risk' THEN v_categories := ARRAY['business_model'];
    ELSE v_categories := ARRAY['other']; END IF;
  END IF;
  v_payload := jsonb_build_object(
    'repreneur_id', p_repreneur_id, 'opportunity_id', p_opportunity_id,
    'completed_source_stages', COALESCE(p_completed_source_stages, '{}'),
    'not_applicable_source_stages', COALESCE(p_not_applicable_source_stages, '{}'),
    'raw_drop_reason', NULLIF(BTRIM(p_raw_drop_reason), ''),
    'event_dates_unknown', p_event_dates_unknown, 'terminal', v_terminal,
    'source_row_fingerprint', p_source_row_fingerprint, 'manifest_digest', p_manifest_digest,
    'resolution_blockers', COALESCE(p_resolution_blockers, '{}'), 'review_flags', COALESCE(p_review_flags, '{}'), 'source_cells', p_source_cells,
    'source_repreneur_name', p_source_repreneur_name, 'source_offer_label', p_source_offer_label, 'source_opportunity_reference', p_source_opportunity_reference
  );
  v_digest := encode(extensions.digest(convert_to(v_payload::text, 'UTF8'), 'sha256'), 'hex');
  v_source_payload_digest := public.historical_pursuit_import_source_payload_digest(
    p_source_repreneur_name, p_source_offer_label, p_source_opportunity_reference,
    p_completed_source_stages, p_not_applicable_source_stages, p_raw_drop_reason, p_source_cells
  );
  v_approval_digest := public.historical_pursuit_import_approval_digest(
    p_source_row_fingerprint, v_source_payload_digest, p_repreneur_id, p_opportunity_id,
    COALESCE(p_resolution_blockers, '{}'), COALESCE(p_review_flags, '{}')
  );
  IF p_approval_digest <> v_approval_digest THEN
    RAISE EXCEPTION 'historical_pursuit_approval_digest_invalid';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_source_sha256 || ':' || p_source_sheet || ':' || p_source_row::text, 112));
  SELECT * INTO v_existing FROM public.historical_pursuit_import_rows
  WHERE source_sha256 = p_source_sha256 AND source_sheet = p_source_sheet AND source_row = p_source_row FOR UPDATE;
  IF FOUND THEN
    IF v_existing.payload_sha256 <> v_digest THEN RAISE EXCEPTION 'historical_pursuit_source_row_payload_mismatch'; END IF;
    RETURN jsonb_build_object('outcome', 'replay', 'ledger_id', v_existing.id, 'match_id', v_existing.match_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.historical_pursuit_import_source_bindings binding WHERE binding.source_sha256=p_source_sha256 AND binding.source_sheet=p_source_sheet AND binding.source_row=p_source_row AND binding.manifest_digest=p_manifest_digest AND binding.approval_digest=v_approval_digest AND binding.source_row_fingerprint=p_source_row_fingerprint AND binding.source_payload_digest=v_source_payload_digest) THEN RAISE EXCEPTION 'historical_pursuit_allowlist_mismatch'; END IF;

  IF p_opportunity_id IS NULL THEN
    INSERT INTO public.historical_pursuit_import_rows(source_sha256,source_sheet,source_row,source_repreneur_name,source_offer_label,source_opportunity_reference,source_cells,source_row_fingerprint,manifest_digest,payload_sha256,repreneur_id,completed_source_stages,not_applicable_source_stages,last_reported_source_stage,raw_drop_reason,event_dates_unknown,source_terminal,resolution_blockers,review_flags,apply_outcome,applied_by)
    VALUES(p_source_sha256,p_source_sheet,p_source_row,BTRIM(p_source_repreneur_name),NULLIF(BTRIM(p_source_offer_label),''),NULLIF(BTRIM(p_source_opportunity_reference),''),p_source_cells,p_source_row_fingerprint,p_manifest_digest,v_digest,p_repreneur_id,COALESCE(p_completed_source_stages,'{}'),COALESCE(p_not_applicable_source_stages,'{}'),v_last_stage,NULLIF(BTRIM(p_raw_drop_reason),''),TRUE,v_terminal,COALESCE(p_resolution_blockers,'{}'),v_flags || COALESCE(p_review_flags,'{}'),'external_or_missing',BTRIM(p_actor))
    RETURNING id INTO v_match_id;
    RETURN jsonb_build_object('outcome', 'external_or_missing', 'ledger_id', v_match_id);
  END IF;

  SELECT * INTO v_match FROM public.opportunity_matches
  WHERE opportunity_id = p_opportunity_id AND repreneur_id = p_repreneur_id FOR UPDATE;
  IF FOUND THEN
    v_status := v_match.status;
    IF v_match.status = 'draft' AND v_terminal THEN
      -- An existing match is current operational data. Historical import may
      -- only close a pristine draft; it never changes its notes, score,
      -- recommendations, decline data or any workflow/access field.
      UPDATE public.opportunity_matches SET status = 'dropped'
      WHERE id = v_match.id
        AND pursuit_stage IS NULL AND nda_status = 'not_required' AND nda_document_id IS NULL
        AND nda_received_at IS NULL AND nda_signed_at IS NULL AND nda_waived_at IS NULL
        AND COALESCE(cardinality(decline_reason_categories), 0) = 0 AND decline_reason_text IS NULL
        AND human_recommendation = 'not_evaluated'
        AND reviewed_by IS NULL AND reviewed_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM public.opportunity_pursuit_evidence evidence WHERE evidence.match_id = v_match.id)
        AND NOT EXISTS (SELECT 1 FROM public.opportunity_pursuit_confidential_grants grant_row WHERE grant_row.match_id = v_match.id)
        AND NOT EXISTS (SELECT 1 FROM public.opportunity_nda_artifacts artifact WHERE artifact.match_id = v_match.id)
        AND NOT EXISTS (SELECT 1 FROM public.opportunity_pursuit_events event_row WHERE event_row.match_id = v_match.id);
      IF NOT FOUND THEN RAISE EXCEPTION 'historical_pursuit_draft_has_unexpected_workflow_state'; END IF;
      v_status := 'dropped';
    ELSIF v_match.status <> 'draft' THEN
      v_flags := array_append(v_flags, 'current_status_preserved');
    END IF;
    v_match_id := v_match.id; v_outcome := 'merged';
  ELSE
    v_status := CASE WHEN v_terminal THEN 'dropped'::public.opportunity_match_status ELSE 'draft'::public.opportunity_match_status END;
    INSERT INTO public.opportunity_matches(opportunity_id,repreneur_id,status,decline_reason_categories,decline_reason_text,created_by)
    VALUES(p_opportunity_id,p_repreneur_id,v_status,
      CASE WHEN v_terminal THEN v_categories ELSE '{}' END,
      CASE WHEN v_terminal THEN NULLIF(BTRIM(p_raw_drop_reason), '') ELSE NULL END,
      BTRIM(p_actor)) RETURNING id INTO v_match_id;
    v_outcome := 'created';
  END IF;
  INSERT INTO public.historical_pursuit_import_rows(source_sha256,source_sheet,source_row,source_repreneur_name,source_offer_label,source_opportunity_reference,source_cells,source_row_fingerprint,manifest_digest,payload_sha256,repreneur_id,opportunity_id,match_id,completed_source_stages,not_applicable_source_stages,last_reported_source_stage,raw_drop_reason,event_dates_unknown,source_terminal,resolution_blockers,review_flags,mapped_match_status,apply_outcome,applied_by)
  VALUES(p_source_sha256,p_source_sheet,p_source_row,BTRIM(p_source_repreneur_name),NULLIF(BTRIM(p_source_offer_label),''),NULLIF(BTRIM(p_source_opportunity_reference),''),p_source_cells,p_source_row_fingerprint,p_manifest_digest,v_digest,p_repreneur_id,p_opportunity_id,v_match_id,COALESCE(p_completed_source_stages,'{}'),COALESCE(p_not_applicable_source_stages,'{}'),v_last_stage,NULLIF(BTRIM(p_raw_drop_reason),''),TRUE,v_terminal,COALESCE(p_resolution_blockers,'{}'),v_flags || COALESCE(p_review_flags,'{}'),v_status,v_outcome,BTRIM(p_actor));
  RETURN jsonb_build_object('outcome', v_outcome, 'match_id', v_match_id, 'mapped_match_status', v_status);
END $$;

CREATE OR REPLACE FUNCTION public.historical_pursuit_import_rows_for_staff(p_repreneur_id UUID) RETURNS SETOF public.historical_pursuit_import_rows LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT * FROM public.historical_pursuit_import_rows WHERE p_repreneur_id IS NULL OR repreneur_id=p_repreneur_id ORDER BY source_row $$;
REVOKE ALL ON FUNCTION public.historical_pursuit_import_rows_for_staff(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.historical_pursuit_import_rows_for_staff(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.apply_historical_pursuit_import_row(TEXT,TEXT,INTEGER,UUID,UUID,TEXT[],TEXT[],TEXT,BOOLEAN,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT[],TEXT[],JSONB,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_historical_pursuit_import_row(TEXT,TEXT,INTEGER,UUID,UUID,TEXT[],TEXT[],TEXT,BOOLEAN,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT[],TEXT[],JSONB,TEXT) TO service_role;
