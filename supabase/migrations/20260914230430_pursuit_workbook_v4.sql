-- Ticket #131 / Decision #128: separate V4 source binding, immutable V3 facts retained.
-- This installs a reviewed candidate; it does NOT apply any real pursuit rows.
BEGIN;
ALTER TABLE public.historical_pursuit_import_rows
  ADD COLUMN import_match_before JSONB,
  ADD COLUMN import_match_after_sha TEXT CHECK(import_match_after_sha ~ '^[0-9a-f]{64}$');
CREATE TABLE public.pursuit_workbook_v4_source_bindings(
  source_row INTEGER PRIMARY KEY CHECK(source_row BETWEEN 3 AND 74),
  source_row_fingerprint TEXT NOT NULL CHECK(source_row_fingerprint ~ '^[0-9a-f]{64}$'),
  source_payload_digest TEXT NOT NULL CHECK(source_payload_digest ~ '^[0-9a-f]{64}$'),
  approval_digest TEXT NOT NULL CHECK(approval_digest ~ '^[0-9a-f]{64}$'),
  expected_match_exists BOOLEAN NOT NULL,
  expected_match_fingerprint TEXT CHECK(expected_match_fingerprint ~ '^[0-9a-f]{64}$'),
  CHECK(expected_match_exists=(expected_match_fingerprint IS NOT NULL))
);
ALTER TABLE public.pursuit_workbook_v4_source_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pursuit_workbook_v4_source_bindings FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.pursuit_workbook_v4_source_bindings FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER pursuit_workbook_v4_bindings_immutable BEFORE UPDATE OR DELETE ON public.pursuit_workbook_v4_source_bindings
  FOR EACH ROW EXECUTE FUNCTION public.historical_pursuit_import_rows_immutable();
INSERT INTO public.pursuit_workbook_v4_source_bindings
SELECT split_part(binding,'|',1)::INTEGER,split_part(binding,'|',2),split_part(binding,'|',3),split_part(binding,'|',4),
  split_part(binding,'|',5)::BOOLEAN,NULLIF(split_part(binding,'|',6),'')
FROM regexp_split_to_table($v4_bindings$
3|823bf1d4582222e46a840ade048ecb5aa27d68e19761ccfb7651863b35845e88|96c7c244fb598c586aff275ee411724544901ccb7d656acce13855a812c66336|9efe4132934a71617224d0fdd12f195aca0db82ddb2b6d97a77fe7763fbfd789|true|07c357da6c0f10a52fca2bc39ec8664c7963f22aaa50a43fcd5e39b0593d303b
4|11b1e4e65ea321798fa5d240904a5e45381364304dbd227cca21b0c012efafae|f6111dbde764e9f33ea5a04f4f3845d34093f634dd16c7aece083d050c0c56e7|71f150488fd72f78b4252ca832a4ae73296dcf4fc74b251b96e5372c34e1bc45|true|f6d7bebfdba550172c48976082f9fd5e098a625cd4104950012ccf8dfc2806c6
5|b1f33255702e5021bb8c03045a08103859981072822b11074bd81dd6d2e9133b|2e547bf5c7818bd6b2ac2e3826812c7d59ec0d2a8fa982ce92708ed256a587dd|2901e67cd4b9459cc9af7dbf2fc96b0082d9a1367f74fc6f777c6e206ffc4b41|false|
6|7b73931c67dfdc885bd2d66b224ac0bfd4898e6884db4c9247026a7ec0954361|c22d7bb40fa36524b89c14bde6c5a97d5a12f46a6166ec7629a1ea7ef707ab44|28b910820462839c93a0c88598f33a300b6ebf7d4be121a7621e48b4099e3a96|false|
7|6aff823be2b7c3bb67c70c0d74809e1c93e148eb0acb5184c864d35caee1916e|d3e52a9a884c924a8ff13657a8c773c6c66bb47f3451d81ad0cefbe251925d48|4cbaf702601d413cd27053baefe57ac5f8068b26e8c5ec5e70c351ed08599515|false|
8|ca82c003446fce5edfa9dd7591ffa8a1545acb9cd5034c3572dff53c222d8eea|0c737edf397682ac9e4d1ee9b22235a2948810f0cf7e1d5752a1494f0d367fd6|72008e58913735dd027b4b55ffd40cc6e559b7d6bd63ab72aa1d0aecb9f58954|false|
9|1bee152698db794b6f4f327f136d83df4e886fd2d21552bb368da041d1f87786|c38cb2c486acb513854dbe7c5640a08b67d667d1cd1abd1255dc9353b66207fc|44ed202d287cdab42172b2d0cf36b65717ebfd1f8e887fcf83d50cffa35ed8a3|false|
10|279c1b4658968f0eeb8e73d4a7004503964b1d187e9b2ddd5179f6fcf02110e4|fdb99ebb5d156751ba8d54a444085cd5abb9887671c50e0b362dc5775f124421|872466f0146d16e86327a26328d5b2d0fa97952f86e77f3d245cb1c7a8242ad3|true|8632c1fbeace8ae44a54bb1d641e5bdae448664c000e38e33c95f2b1e007d0d3
11|1c7224e0a1ecd2be4a77337f007bbfe8f5da0634a2eb72bb34b09eb9cfe16b6a|c35cd3ccd1758b18f2f433ab355cdc9de7e508e2df5832bbd04818706429122c|0cc7c7489b19f6f4e9958a716f0681f6a2a4332bbebb7e75c71880e53c8ae919|false|
12|b11d219ad10e28f5e8026f873f12ee0fe944a52106ad64506a89f0d0372305bd|4ccab74979ec24746534e152a3b02e08fd94b1c03fd2e354f847a26cdd79396b|f662722d1f37e70624f142a37bfd6b0bace3bbab1ce2a774ac778fb0ea70517a|false|
13|e9c28fa2805c63e596d7752c985d9f7166085ea936b669498680ae0733a6ec59|1f5b401723226cb2dcb5eead260b2fee937bf632730cc916e695a76a6451d222|d38be760693d3ae17792321b46a72e0ca8a764761245e25bef7e4deeac0bd9e0|true|c058a9b9533ecc2c95e6ed5ec53962cdfd61843007404d13aeed781d9e68a882
14|9a707e4d81df38471283db31d694f07cf6e946416a7f8b5e29e52acc180928da|639bd34b15f2efdd1823a6bf373817adb3cd4fd348a58b9d878ebf514eca7bf8|2d5826d06ff9d2b62d5c8a3ba7efec680a0be61307816974e44bb3af87880350|true|94bc98e1f7cbf444e7b1b5b563ede07d61df21583b2d03fe4832e0a539bd8689
15|54462f79452280bf3b7c28daffd6642a9f9b951d3a17de0e8e10fc981b574609|b1d45e37114e24ba63808f4bff1cdbdf79c976323b1e59c9be8f4753704e572b|981c8555d8b9e94362dfebde092d8f532094c06fc80f464274436cd8ae4d0be4|true|14b77bf3cfdbdb36a0986ca24d63622fa08be57c4900047ef84f750bb4233419
16|014adf8a1107542c117b43133d1439ff892d257b9ba70c535b5a7635f961246a|02b00ef073f8d63f4d91e2da5583821213266323919e74f243b3035fcace1237|15b56e1c1567f1b596ab731da9125a6335da31886b5c5f730e824da7cf1064b7|true|b8b381f417958733eba70f37c23776ad895ba1e357e8ab3efc64750bf1e1b073
17|58dc7ec9548caaa6e77f54f70d748ac310b6f346ef84827d32e703d111062169|9758652f3383062475476f011fb584c79ac5ad27b84dd47716b5df7e961cbac4|2bd726652f041c52793fa436a530751fda119da93b4436dd537103c12c7c8c9a|true|3313187eef68a68e2ef06bfa7c77d1b5edd94f985d9b7e74b038c8d05c27899d
18|bab39a6505abd5431befdccb36ea1c2297fa3abae80c748e5de00693475dc698|f86c5ce7e4d205637f3bf67fca8037c0cd4843a00b42c526366cbdadc8ca3a63|945a94da12c7b9bbd6785dcc94ec34ffcae5b171f685f3166c411009d36da7dc|true|87851499528c81bf30e5ee9d10ae2b4ab3341344befef554412df6ed1cf87168
19|80c33d09154fb5503d917a1bf8d816d28888064487130f248017e871b60728e0|d99fe7eba7df1ed738181d46c4f0092fd4362f5d528f770fd6cb5b789238c568|ed43c62e71a35aaf6504f971a1df1f7cbda3f9d498cc6cc3c01522cf6f00f832|true|dc6774603e101bae04ce0ac63e890d7ddc0030c8504b0ef492fbe0883f0a4371
20|6a306819c51b181248e8d6aed9d2d9830148674dc14a7cc9927bce755ecb88ea|e67529dd1562bc4f03f430406b9af6020c7eb7f491e742b2ee1a5e38de55d63e|aa366044b8777f1922554db03406423223de5ea7061415a5aeeca9c2a4375a7b|false|
21|14f5a6f20aebaae40da5cd78d3a5ae210a955a55c7e1806c840cec893c352c13|5a93abed911751cf0109b293321c5e6feb23800735211bb15d3b8f5c5ac5aa4a|7ad7c1ceca11d024c07ec47f4226ede73fde41638e342d262f3c4f23609ede17|true|3bfa25e365fab1fe4d1aac1fadb377018ac4a12a755fa0c23eab4b3ba903c40a
22|d1622c35e8462c663b33e3e5ffea6d3b4d9aa95ef2ae6d3f5c130cea91c39e10|605cbb1c1c86f788aba5bfa8be8e825134365a72caab6ef17f52a4a238c9f9db|408edd4d947ba7e3c3085b756ef10d64d0518e305ec8fb4407d6083b492ba053|true|7a3f0a08a5e7927d1fdfd607953530a018be047ac079ca932cd3c2b43f6b6066
23|8062537f068f828349ce92607068056cb9c13f8f9283ac81fd248047639c7089|ba3ea15f46e6129820c51131cc08a4f10fdf6888c52eb61135f9a65d21c7b7a5|2f242c3bbb91556399bddd62256134e81b00225d6cb5dc1bfee454221a92a0b2|false|
24|448d1b4c2c95fd447c911ea08825f9b7faa49b502e14c89c1af8e42c376fddc5|7b31229fb2ff6627571a5527be044b89b640e1f0920a514b02332cfc26fde4e6|99ecf99c2e28c962e8dff53faf8a70d82bbadc27124039b5b3377f3431e90d15|true|b46c4db3a2b868bda3d6f4f5cdd5aa336a2bf3a731bcf39fa3f06b3d9dfb4070
25|72a6af4a514e5ce902b4b9e40d7e50607987e53577c75acf264f34a329d3c5c7|5ef2a986bc00df386fe424b192c44c1c124e0dd9140a2f19272414690ed5e62b|317e76484695611affba63cd3f4a4795d6cdf9346eaa8bf4931c2808b0f5ffe2|true|a1830ffc74be49ed544c8500fbdf1e7575b52d8eaf9d898ddd7eb7f64a5a56d3
26|c41831deb14b37333515c16498c3dec4b805f0937a91e8d03d0131e0b94b76a2|f2fa89f2fe8c64b9b0ed9efd5ebdce43b21f36953c5db210adf0786e30854d87|7ec43eddefaf872428af54eaee2419c935158ef786ca11f6d86d19dec0f6ac4a|true|a85507c83385e351de0c57b06d180be3325c50ed66879a3b51393a7af5892306
27|42d149e81c55523eccfb963c8566412c803a4be9f50cf767ca2126301e52beb0|cac6536b100f4c411f3dcc9325379614cd384acae0b92ef6a02a29024b74160f|c694b4bd2806541693688a994f1cec09e0b6fa9575cd12e36215f1675088f660|true|74484109f6469e2a967f20b4b1a088bfdc8598ccf2542e8c8fe831e0ef02fb71
28|0b52bd504d63f36dcdfd4c97d912c120192500bdbc010ca23d5a0764fdd0c774|a7d730140798804556f38086e65f6e6ba8290c4e4150a2b12282bbf4a11628eb|85ea10ccb58644828c99d2b41abfd6d55dfbbba97930001ae89d329ed58e7b3b|true|3248571e00b4720e75d498844a87de91f1fcf6d87ddc2f995e4e38f68dfec713
29|87e2cd0500b846aa7866776fcc67a8cc4c7bc9285aabf88842b87db97b06ccca|9908ca65e2ee3e2fbf7d9a2d539e74bfc296cd76e88275b23d5a73936af197e9|c40a704d53d8be9258ad86c10204db68d54cfcd537da6f61bf782072cfd3346e|true|0fe6a0150a9c936d85624bc6337dae9dcc89eb023ed8e30c4f35b2227b72cf88
30|bcaeda853600e234a8cc5512e07e4ed38634e6e696eba3c2103d44d4270404e5|0bbfbee11aa5993fc40a13b828fe91b02d0cf945009de947aa2dbe7d3675577b|5a768b8abb2a881a872022b8ed9f736d72bddd34abf22ce286f8787c1f9e0f65|false|
31|5b29a295610b6197df8ccff728a0e16a9eb4def42c2532986361280e84241d63|3861af60c5404422c276dc42623c9ad102498ab72476b387aa5459bdb8e1c3f4|7e553dec2d25e357c34f20d2078c5eadbc45b99e2da80a6117817c3c924b784d|false|
32|aebe6a5464e1207d8df0312d88585c4a85e5d17a8bd6eb3e107f39ed9d30ec28|8b8a4182413e09b9559ec4ae324b0634bee9b5cec892058cc29e811579350c0a|1c9db6559f4002e0a9a55602a67bd0e83df5e02d6149d6abd98da47bc771df88|false|
33|e407e0ad3efb234ee0a430e6cac94346eb2185460af48e3202efb9139c5c5903|2ff08f2b251fcce463223bc43f6ce6711c5130a2ba34ad713c1a3d9e394bb248|71ebd8db8db530907728691127066e860a3bf1a68a32546baa409f590c4c44c4|true|fd3cc33a2577342cbb89edba156a504fd114649659033d9bd8d0e7d9f0018475
34|da43a3610d2ad09a8f05a2e1d88646cab137976431272a84c9989bd8862cfa3b|145abcfb72bb21d402513b521ffaf39724a88ae1c50ced446dc201e31d31d6a1|53875d814531b2fe9c73f4a5e6b35e86cf8b770779ddbaecb3325a6bdf0eb41c|true|21299a31097f75a193bce5243782710c4aaaa734a914e79f613e39c219c6f3d9
35|b7bd3685cb5445b4071e557998b556ad426f39c3a795825b5827576dc15e21a9|1a650f44a609343bf06bb7187a99c804f0dead7ba3b0f9b50d38b4e89528643c|5112055934391d4de47e285ca5873e4ebebdde43c380dd3a2516d61a509ad414|false|
36|15461e7da9822364c8f5282f8d2bdded28f02868ad762cd8118b6ee88daf1eda|29f72261686262c76baf552400bba4fd1f5b57e8bdc14dd040b812953f6bffe9|ca9ad3c8f8e10624f8b164f5d950dbd02a383f163aa054482ff37eab9eda9dd1|true|a0e655d4c6942677ac90dfab53960e9adab809fd7d9cd91eef42088391a8148d
37|58aab36384c87e13d68da755bd2a402bd2872cbb2b3893326e2eff93427b5e49|c1efa8e704a8a7b28856fb3946d489a78d43b1d8ab8160b43e7d4a394d335427|7c70eea6fdc12658aeb3878c58cd06c61e6b279218c07f8f514c8c6f56ad0db7|true|82c1f70b0a3471e134ed9a18461319925993f73f2c76119c060e8b18b892d978
38|f5951e1398448aca2b13c423fbad5a0fe2b81e1ab3ba6330154e81ce30a82882|422e8c6d3025ce27a85c522d4da8305fcf44b86d5c692958551b189fbbe3f512|7b0413b23fa4ff24678f9e58df0747f3427b37dbe2b703f2d64740758ac76e54|true|344d075478baf745374512314a6a8e6ebc21fd05fa6f3aa7e3064edc01929533
39|fee2d152dbf0b543f6dc92785173a92447b9cec9a8f12c9c932f2115a3b2968d|879866f960a7ddcead262636bb0e209a91290cad0b0389521814a8c758bcded1|085012842bfb7843a8c03e5d760692d9350d59bb5bcf0c565c121611dc15bf42|true|67cec8db61abae7b157e9fe4a8ddb05aadbf2b05746887414a408c6fffc82b8c
40|27583eeb8f7389502152d36f69bbf46ff0b1b43e9d7b94724ebb9f8d1193b4bc|817bc08ebbe14e3b5405ccb0fb88d781aa206be854d0c7529fe8f6ea18096e32|3c09f95c9cfd274ad6cd344c03127ad68c32307f967a65989f446c76eb701ebb|false|
41|1e2e5d59a987f80ff1987cd3c4b01d41c1146f50ee38a3dd6547f5c6b5b2da63|4859510d65f352faeed9f1425c9f2a3d9778f8d558d499f4efa72e1a498e506d|0134e8eaf43f941cc050e870fae4b218f57d90987f5724ff85cb746ecc0d6bd2|false|
42|2ca0c737bf96ea30886f1ae57f10caa143e809d85a16cbaa9f2d26d87967d7a8|d27604b96564fec0dcb1ac1091020fdfc800792cf3d80162992e0d708e5986e1|e9789a7899c61313669e9d89762630d73f10118af9a1cb427e9cf07396f94422|true|0eec4d3ee3025fdb89da979d8fbd424ced4d20d5d6d880cdf388b94fe961feb9
43|7c7bbb7688dc063fa3910162a89475adab6c670278c5ccdec8917b741d258991|b53db4f32563dbaae7002a8af2e9e2dc56e993918d7734004b86f2d76ac6705b|c8c86fe908acf34e5d9497db95864d49ae38a9a614d2dbd584039852f806475a|true|d32e8e0424597ff512774026dce7c2195359bd0e77e010b8c88267acf463e08b
44|72bc7e68879d565cee8c528f0269ae48dc0eaf367e2eaa7eb841abfb2bedd5c6|1c0c7cfbb55b9d2ecb4a0ec72562b4653ddced75be46a0c1f8eb0a9b56e9bc36|c527ddbd5c6160725c86d13b98d57899201f53f24d34f4933b7c217189cb1bf6|true|ea53c4c932c560e05f050263a14d1e5fc58e6a0e55302e76afd4aaf97efcfb43
45|63f94e783eb7c2658026e58cd58588f11332b9e007ee8f71ebbbbf87eb91a024|328195267d1c795838b5ed12ee9105971afd3bc10b3cccdf48d8d5bcec062ea6|ce0bd060ef4838175e6f2f4be5fdaf4362690472f03c4b2520bec4db58c88912|true|972879cac57597e8639da94f120630d82c443d3e3f8b4950a927e7374af63d2b
46|f8b94edbcce907423cf53c3217d7793eefd6aef9debc2e42989ca53a913f8924|e3566bea99cf222c4bde490fec58ef4583ccd6406eaee4285037be14f3c4c2c1|1104cffe06e3f7c784016703f358ba04a9564563c21f7d9a3adfab892759745b|true|4cd2c4261b8696ea2bcab504b311939b206cdddaabd32fa346e67bb4fb42f428
47|0bc822749f631c0c2747dbacc3d3cae63312e17c4608ac5fde06823ce9f278ba|384173217e8ab808b4e7cf6fb2e0fc2b5ba92948b436b8f8114be03bc5c5f300|762e6af50eb4a8bc311d464e76d2d1ccb13a10fd09c54492bad43c05058d0200|true|632a0111c7fa56c9c00c78ff7f7fa3ab7a845f1b7d3dc6805457e4e415a76686
48|52dba9fb8cb8a5b0f6d93a33a720750bd47c81d27f2d83c8624568b73d6d8ac9|2f7b74fa48ab874ed50a311b93a5dce4241cc1fdbd16f15a6120f90cf6d57ee4|8c760dd67d82962181ed5731aaa7fa3432405188172b8abc9e7032394d527cfb|true|54dd046c0e20f52e97f965c983cfc6e4b310a27d431a21d0625ae991b9aecf4d
49|cf4c240a27a5694fd60da5e04065f89687ed59383fc74de7cfeaaf9ffd955d7e|bd560d68c712eaf0f5bc8e605664c6978cc332bd136a7da93537a45bc7bed413|40cc03b00be53ad610854cabf7574ba6418ad12abc1bc89b1c95f7c49eeb9fc4|true|0f3b846ebec3872d985112bc5ae5fbbeb447e9aa42bef65721f7726a154a7c42
50|31d5f103c892b8b06df561d984b6235184310b383a77edd8adba2ebca6e29a2f|fc4423d66adb666e36dddbc5d9dcc23a724f33b3a576d6d76236e5d1d131c623|f19afd35a2f1375ad161e522ae1f11f231815071335693e8de4cc70d522f066c|true|9f6f8a5ced17ac5f6469f216674fdc2d4fe2580a597992c53e34368069a557ed
51|298367bba773cebee267be983bc925e902e786b9991482f1bcc66871e9b2c4e2|fb688e5004daca0e04f9374e1b4d6b6b1d6e63dd40607357c88436174eaa3c45|4fdfb50c3ce803df4eb46ccdff37b4cf0ba38f25d9e27479267e614532520d85|true|59db23b7464c44168505c9df7d573f0b12f6a00e4dbffc18f2b8016d7e87c724
52|f2d3a9e84159f036e6d2b798224f369f4e980d3fddbf8e54081edbe7a15e89b1|7a7ee6cb4a233b59674a03fd1da4fb4223d424dbe407409b723af2555d469ec7|9d7eb8f6f42d817b83108d935ab7ce1b076e8009de53880e064b6e6145753fe1|true|3f34edad308730bbd95c7c0d4a5bb3a8ae107b1aa8d73507654d72e058faecc4
53|24e99e973bf8af308cc845769d0d6fde61690205540ddcf3e28682062283102d|0f1c7e40da85e0bb72dfb327b2a8dac43c4daea43469386d11fbc974c6c5b848|d182b345779f9e0b667002f13198a7cab9db74692c9ca607dbe8ca14ad5853a5|true|abee4079fad9a6d8669591233578f1dd3676d5ce163fb5bac8d6b72623a4b5f5
54|82d9453dc197ea49d16c952e2ba9685b4aaf1bc078aafdd4631e7b5b49d5bf35|37434f81ebdda11ffd7ae880429d4f8f62f28912a00a4f831a51757acfa1c29f|dd19c4e18fe8eb2a4f49c0fdd967cd06ca81df4f1d804f854e1e2a9d5997be39|false|
55|10a871e775e1254df3b84fab6acde20d37bc85eb338742da79cbf22044506e18|b3b7921c65027371a5ec6de3e62912796aa039c4f8b5d1d8692559b17d50bd10|acbcf5f7b96020f9f4f362b7c002d1b78ad60317839270988d1053c76028777e|false|
56|eda14f19eb33997c846dda60aaed2e8bbdae3775d06da5bf240b046574373830|dd197b8ca9b2659b5fb2f437ba23bcb605c135661e89481ce02de6f52a91f65d|4c6749be5c28cf67e811a1fa8d7299063b59c6886f4724cb6e29da8774832f2c|true|cc4a85a53bd05210827d77267f738d13707e7f63ebb986802e7ac717e0c42384
57|6867801e85f0121203da82253d1a734cc1b4f668425433e5e917570fa9526878|4c1163cbc4455772fc139e0f9e2655f2896e10381e51dbadd7c190c7a6885446|e803b4a0d016b43b053bc08cb65f657c8eb1cfd4a9614ce771ddce5f452cfd62|false|
58|651a961fd8f784df898eeafd73305870564b3aa9d65e20cb17b7416a1546074c|8d817a1b8b7f2c4c6f4dc8bda822bd6d8fff1180db5907da3a5719f5ed3a60be|5c554e09006f357f99659ce5c422be8e7a33ddaf10fb1f3aba85eec74c761e19|false|
59|851d164066506184f6f2096b68bdf23f57d0e975403755c8c9c718a8e2aad270|6afce0e45e9f7ee856f845f977505bda8e91045988aeb35badb816d1914fdee5|b5fa361a084125dfa23dd3c72c95a6e72d95139c6e0463e621ce17620834fd46|true|f6e7caee0ab9caa4a379c562414da607595a85ce666b084e8d5c970f55d0291b
60|92bc6a483d94c06dd83661fa7d133a44103c2854f6ae1c315d569495503fdf3e|c4e63265b6de7a444f668e3dd549ad533bcc893ffd51f2691d38320e820f9baa|05748970ecb9084cdc6c0b873c18ba5f5542249d37edb04d7e737a1a0624c3a9|true|765a7c781fc4372bb17e48468d3fe8c8c99ecc64b6145d453a903180916fcbc8
61|654258eef2acfa1c0a170ce9929b623af08ee421626aaae3f927558ed0fea60c|da9e7b7b5886e7e419914088f908477dbcd5706253cd9cdb6a2203d8d31aa990|1526106aca20aa23fae666617e2b8463656fd5492253b777cedd3d329e0d0d16|true|c38578ca1d6644e068025d27481363b809ed219e2aef14207314377035958328
62|c43455b176652e27ac54a12a360a65a1ae35c401d2dcb190d582b1a8bc09db63|fc2a4f14192a864c742f2f8e0bffce9c79b33d71d39239b3c8807165ebd03ac9|092f6ca37070e04ed2bbb05d66c7e5b348c4a109bea1136db0f2d841902179bc|true|e6cb07d3457831a690d5065040795fff84052c42cabe097a1496ccad92ca4ad2
63|0875a43e31ce7ca3a25ddba9f9027e0c23c1ae9d52be12a03b19e898ebb373e6|fb5cf137e3b7c5b31366e9a4329a1de15170df62536b394c176ef7a38f0b8720|d579bd78a83544f392b1b3408c13ae337d5403fbaa34a2f09d5fc14dd7b10179|true|7571c8c7754ec7bd350e36f439766604abba89bcc52ba00264e584bf10b9f2c0
64|539d3863a29f8d09dc4bb9ec1e14aea16616a7e929e25d4988cc336b158806ae|21f967c63d2f1bccd9a3b068f35a354c8247adf1a8b6c030bcf283a6c3838f21|a329575e4714cdf77b283d7189e7b92cfc6303828a92d7fa5fba23e1932220be|true|c58d4051f1a18aff4a81917dcb1a5d0de88f4eddac90233c8e77d65b38f7f949
65|895c6fff02b14acb4a5e49c65e149611cb2f0b4ace14ed46397f92ab09e5ecca|8fe1809ac870efbd2c31aeba055cda4c3a5bcf13fc8bb7d9526401438c7174bf|3d7c61353a34209d5bb5d78ff63f4d8b91e790ea69f0e1fc3c93ad505b07233d|true|60d041c87c1b581fef10bbae27e470d64d6940d627ec37c4a328dc60bc608d98
66|f94e9ec048fc5920574060ec82a96c999412f2e9f8e5b9a8e026e9a4992a7c7d|b80f6678e1e8453bedd328996d39078094ba940fe1fce1f58b8c2ae10f3f3542|863b9490c91177e72f776ebcbbc2a3644286b24f6b4dd2279f21b43ba0b3edd4|true|4f3396ae7974e3a9d635395e623e50a69c97b06d58611ceb5b1f9e77b1dcb7bf
67|2a31663b7e58ba9c8e3864bc33044f8aee7dcea53cd4d12041c64503226d6b21|1a606f5d0836aeb65d443bd746db9227d9aba451fbabd2db4cd19dc89c191178|3cc6acd8f2c3abb42d0ed79056e0d18d0b9b738404abf68fba72d3631dc97088|false|
68|a909c047668dbf55fb263c81aad8d7aa4c1f1077ab2668b5d3bc5a62ef0e8fb0|46f2c5332eb4c9d04724629c0723f8e8d0b537267b5e5b0c302eee2616c76ab7|07418b7d56a6fea9bc8e1b0f53eafcaf9b765f3c9f6a308ad87f8271f43b9450|true|2e1548fbf57b05875f041e7a809f5dcc086622a1cfa5fee77d6e11188776c5a2
69|712fe869d879aece518da261276ba2fd7c66ea829c7b8ead537d8d7837cbe128|3dfd6afedb8575d4967902ccf7eef107dbc0b137a52942261297d21233a8a78c|11615cbc37ad081a7ba8d67870976b9318df18f3e3b85e435aa3dc7307940f92|false|
70|a08d25ec429bef83e66664e2bbfc97faf6eae5d3f1926a23b197a0da1b4d994a|c3a78653a57af42d0f7a36491d56601a3b9d37959e05d25c19725852db0208a2|b2dbef26e3a1fabf4e00bcda80fc5031cf7577e9691dfce554d7c34e4858030f|true|9d3ebdf761dcabf111b5fe356815d0fe26cf9dc3b9b273b719630a259c4fd06f
71|9f1ac1ddabf3b66c5be13b698bb58d8ea18e68082bafe00d3bbe70a172d72068|d9efede74795b8617a25522f6bd5650e610067fd32c42ad19e4d37accc853a75|4c9793fbb4be09e52f13096b9cfd7aca85a258aba85f7b3285d39c4e3fb193ca|false|
72|aacfd11aebde2beda9f6192b15aab86fd642c13cf0858acbccc7a044f9d35f69|03f39a62f1dfe71468bb791847f0268e1ff19c354519da7a5376224c73bde1cd|6d92083084fedace8c71acac01d230930fb76fce12012b33c9183a23bde473db|false|
73|31acc6ed22231786a8b22a880036658cf98e1c88b9fc48ed20eb0d8572aaa140|dbbfeb210130fce35674f45294fd3cc54724b90a2ed6f6c3823bb53fa0833ff8|172d79f5c33f8a7375778f00f2a3ee7a040ad2e982bd32aa01db872a30c13ab6|true|4cc6aae68c37cd139f6d0bda52643d93143f6cddc46d041af1ef0680dc485d19
74|0beb677c4db8ce34979847c0ac5a5ad5850eaef8bd355e2baae51d97a353131e|bd03ae3d72037b63a4da56aeed7bd85e5616b06a0958b821ee35718eb432eda9|e4900c7d1a7fd2d12c057d443ccc6c771500901c63e624e029592b1cd12838fa|false|
$v4_bindings$,E'\n') AS binding WHERE binding<>'';

CREATE OR REPLACE FUNCTION public.apply_pursuit_workbook_v4_row(
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
  v_before JSONB;
  v_after_sha TEXT;
  v_binding public.pursuit_workbook_v4_source_bindings%ROWTYPE;
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
  IF (SELECT count(*) FROM public.app_user_roles WHERE role='staff' AND user_id=p_actor) <> 1 THEN RAISE EXCEPTION 'pursuit_v4_staff_required'; END IF;
  IF p_source_sha256 <> 'f527683a09d1e67e2c01479c20529963b7b1760578ff558181cad18c7febfbd3'
    OR p_manifest_digest <> 'cf93e17ed1e59aebf08841ecca73a45e0470fe6d85388a7676df81a9575de0d1'
    OR p_source_row_fingerprint !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'historical_pursuit_source_hash_not_approved';
  END IF;
  IF BTRIM(COALESCE(p_source_sheet, '')) <> 'Synthese' OR p_source_row NOT BETWEEN 3 AND 74 THEN
    RAISE EXCEPTION 'historical_pursuit_source_locator_invalid';
  END IF;
  IF NULLIF(BTRIM(p_actor), '') IS NULL OR NULLIF(BTRIM(p_source_repreneur_name), '') IS NULL OR p_event_dates_unknown IS DISTINCT FROM TRUE OR jsonb_typeof(p_source_cells) <> 'object' OR (p_opportunity_id IS NOT NULL AND p_repreneur_id IS NULL) THEN
    RAISE EXCEPTION 'historical_pursuit_required_input_missing';
  END IF;
  IF NOT (p_source_cells ?& ARRAY['interest_confirmed','nda_received','nda_signed','info_memo_received','qa_with_ma_firm','seller_meeting','valuation','loi_issued','audits','financing','closing'])
    OR EXISTS (
      SELECT 1
      FROM jsonb_each(p_source_cells) AS cell(key, value)
      WHERE cell.key <> ALL(v_allowed)
        OR jsonb_typeof(cell.value) NOT IN ('string', 'null')
    )
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
  IF v_terminal THEN v_categories := ARRAY['other']; END IF;
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
  SELECT * INTO v_binding FROM public.pursuit_workbook_v4_source_bindings binding WHERE binding.source_row=p_source_row
    AND binding.approval_digest=v_approval_digest AND binding.source_row_fingerprint=p_source_row_fingerprint
    AND binding.source_payload_digest=v_source_payload_digest;
  IF NOT FOUND THEN RAISE EXCEPTION 'pursuit_v4_source_binding_mismatch'; END IF;

  IF p_opportunity_id IS NULL THEN
    INSERT INTO public.historical_pursuit_import_rows(source_sha256,source_sheet,source_row,source_repreneur_name,source_offer_label,source_opportunity_reference,source_cells,source_row_fingerprint,manifest_digest,payload_sha256,repreneur_id,completed_source_stages,not_applicable_source_stages,last_reported_source_stage,raw_drop_reason,event_dates_unknown,source_terminal,resolution_blockers,review_flags,apply_outcome,applied_by)
    VALUES(p_source_sha256,p_source_sheet,p_source_row,BTRIM(p_source_repreneur_name),NULLIF(BTRIM(p_source_offer_label),''),NULLIF(BTRIM(p_source_opportunity_reference),''),p_source_cells,p_source_row_fingerprint,p_manifest_digest,v_digest,p_repreneur_id,COALESCE(p_completed_source_stages,'{}'),COALESCE(p_not_applicable_source_stages,'{}'),v_last_stage,NULLIF(BTRIM(p_raw_drop_reason),''),TRUE,v_terminal,COALESCE(p_resolution_blockers,'{}'),v_flags || COALESCE(p_review_flags,'{}'),'external_or_missing',BTRIM(p_actor))
    RETURNING id INTO v_match_id;
    RETURN jsonb_build_object('outcome', 'external_or_missing', 'ledger_id', v_match_id);
  END IF;

  SELECT * INTO v_match FROM public.opportunity_matches
  WHERE opportunity_id = p_opportunity_id AND repreneur_id = p_repreneur_id FOR UPDATE;
  IF v_binding.expected_match_exists IS DISTINCT FROM (v_match.id IS NOT NULL)
    OR v_binding.expected_match_fingerprint IS DISTINCT FROM
      (CASE WHEN v_match.id IS NULL THEN NULL ELSE encode(sha256(convert_to(to_jsonb(v_match)::TEXT,'UTF8')),'hex') END) THEN
    RAISE EXCEPTION 'pursuit_v4_live_match_changed';
  END IF;
  v_before := CASE WHEN v_match.id IS NULL THEN NULL ELSE to_jsonb(v_match) END;
  IF v_match.id IS NOT NULL THEN
    v_status := v_match.status;
    IF v_match.status = 'draft' AND v_terminal AND NOT ('existing_draft_workflow_preserved'=ANY(COALESCE(p_review_flags,'{}'))) THEN
      -- An existing match is current operational data. Historical import may
      -- only close a pristine draft; it never changes its notes, score,
      -- recommendations, decline data or any workflow/access field.
      UPDATE public.opportunity_matches m SET status='dropped'
      WHERE m.id=v_match.id AND m.pursuit_stage IS NULL AND m.nda_status='not_required' AND m.nda_document_id IS NULL
  AND m.nda_received_at IS NULL AND m.nda_signed_at IS NULL AND m.nda_waived_at IS NULL
  AND m.pursuit_stage_notes IS NULL AND m.pursuit_stage_updated_by IS NULL AND m.pursuit_stage_updated_at IS NULL
  AND m.nda_notes IS NULL AND m.nda_updated_by IS NULL AND m.nda_updated_at IS NULL AND m.nda_waived_by IS NULL
  AND m.interest_expressed_at IS NULL AND m.interest_notification_sent_at IS NULL
  AND COALESCE(cardinality(m.decline_reason_categories),0)=0 AND m.decline_reason_text IS NULL
  AND m.human_recommendation='not_evaluated' AND m.reviewed_by IS NULL AND m.reviewed_at IS NULL
  AND m.recommendation_published_at IS NULL AND m.recommendation_expires_at IS NULL
  AND NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_evidence e WHERE e.match_id=m.id)
  AND NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_confidential_grants g WHERE g.match_id=m.id)
  AND NOT EXISTS(SELECT 1 FROM public.opportunity_nda_artifacts a WHERE a.match_id=m.id)
  AND NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_events e WHERE e.match_id=m.id)
  AND NOT EXISTS(SELECT 1 FROM public.opportunity_recommendation_assignment_notifications n WHERE n.match_id=m.id)
        AND EXISTS(SELECT 1 FROM public.opportunities o WHERE o.id=m.opportunity_id AND o.status='active');
      IF NOT FOUND THEN RAISE EXCEPTION 'historical_pursuit_draft_has_unexpected_workflow_state'; END IF;
      v_status := 'dropped';
    ELSIF v_match.status <> 'draft' THEN
      v_flags := array_append(v_flags, 'current_status_preserved');
    END IF;
    v_match_id := v_match.id; v_outcome := 'merged';
  ELSE
    PERFORM 1 FROM public.opportunities o JOIN public.repreneurs r ON r.id=p_repreneur_id
      WHERE o.id=p_opportunity_id AND o.status='active' AND o.is_demo=r.is_demo FOR UPDATE OF o,r;
    IF NOT FOUND THEN RAISE EXCEPTION 'pursuit_v4_new_pair_not_eligible'; END IF;
    v_status := CASE WHEN v_terminal THEN 'dropped'::public.opportunity_match_status ELSE 'draft'::public.opportunity_match_status END;
    INSERT INTO public.opportunity_matches(opportunity_id,repreneur_id,status,decline_reason_categories,decline_reason_text,created_by)
    VALUES(p_opportunity_id,p_repreneur_id,v_status,
      CASE WHEN v_terminal THEN v_categories ELSE '{}' END,
      CASE WHEN v_terminal THEN NULLIF(BTRIM(p_raw_drop_reason), '') ELSE NULL END,
      BTRIM(p_actor)) RETURNING id INTO v_match_id;
    v_outcome := 'created';
  END IF;
  SELECT encode(sha256(convert_to(to_jsonb(m)::TEXT,'UTF8')),'hex') INTO v_after_sha FROM public.opportunity_matches m WHERE m.id=v_match_id;
  INSERT INTO public.historical_pursuit_import_rows(source_sha256,source_sheet,source_row,source_repreneur_name,source_offer_label,source_opportunity_reference,source_cells,source_row_fingerprint,manifest_digest,payload_sha256,repreneur_id,opportunity_id,match_id,completed_source_stages,not_applicable_source_stages,last_reported_source_stage,raw_drop_reason,event_dates_unknown,source_terminal,resolution_blockers,review_flags,mapped_match_status,apply_outcome,applied_by,import_match_before,import_match_after_sha)
  VALUES(p_source_sha256,p_source_sheet,p_source_row,BTRIM(p_source_repreneur_name),NULLIF(BTRIM(p_source_offer_label),''),NULLIF(BTRIM(p_source_opportunity_reference),''),p_source_cells,p_source_row_fingerprint,p_manifest_digest,v_digest,p_repreneur_id,p_opportunity_id,v_match_id,COALESCE(p_completed_source_stages,'{}'),COALESCE(p_not_applicable_source_stages,'{}'),v_last_stage,NULLIF(BTRIM(p_raw_drop_reason),''),TRUE,v_terminal,COALESCE(p_resolution_blockers,'{}'),v_flags || COALESCE(p_review_flags,'{}'),v_status,v_outcome,BTRIM(p_actor),v_before,v_after_sha);
  RETURN jsonb_build_object('outcome', v_outcome, 'match_id', v_match_id, 'mapped_match_status', v_status);
END $$;

-- Only the complete batch is externally callable. A failure in any row rolls
-- back all rows; each successful replay returns without revisiting live state.
REVOKE ALL ON FUNCTION public.apply_pursuit_workbook_v4_row(TEXT,TEXT,INTEGER,UUID,UUID,TEXT[],TEXT[],TEXT,BOOLEAN,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT[],TEXT[],JSONB,TEXT)
  FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.apply_pursuit_workbook_v4(p_rows JSONB,p_actor TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE item JSONB; result JSONB; outcomes JSONB:='{}'::JSONB; outcome TEXT;
BEGIN
  IF (SELECT count(*) FROM public.app_user_roles WHERE role='staff' AND user_id=p_actor) <> 1 THEN RAISE EXCEPTION 'pursuit_v4_staff_required'; END IF;
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows)<>72
    OR (SELECT count(DISTINCT (value->>'sourceRow')::INTEGER) FROM jsonb_array_elements(p_rows))<>72
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows) WHERE (value->>'sourceRow')::INTEGER NOT BETWEEN 3 AND 74 OR value->>'sourceRow' IS NULL)
    THEN RAISE EXCEPTION 'pursuit_v4_full_batch_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('pursuit-workbook-v4',131));
  FOR item IN SELECT value FROM jsonb_array_elements(p_rows) ORDER BY (value->>'sourceRow')::INTEGER LOOP
    result:=public.apply_pursuit_workbook_v4_row(
      'f527683a09d1e67e2c01479c20529963b7b1760578ff558181cad18c7febfbd3','Synthese',(item->>'sourceRow')::INTEGER,
      (item->>'repreneurId')::UUID,(item->>'opportunityId')::UUID,
      ARRAY(SELECT jsonb_array_elements_text(item->'completedSourceStages')),
      ARRAY(SELECT jsonb_array_elements_text(item->'notApplicableSourceStages')),
      item->>'dropReason',TRUE,p_actor,item->>'repreneurName',item->>'offerLabel',item->>'opportunityReference',
      item->>'fingerprint','cf93e17ed1e59aebf08841ecca73a45e0470fe6d85388a7676df81a9575de0d1',
      ARRAY(SELECT jsonb_array_elements_text(item->'blockers')),ARRAY(SELECT jsonb_array_elements_text(item->'flags')),
      item->'sourceCells',item->>'approvalDigest');
    outcome:=result->>'outcome';
    outcomes:=jsonb_set(outcomes,ARRAY[outcome],to_jsonb(COALESCE((outcomes->>outcome)::INTEGER,0)+1));
  END LOOP;
  RETURN outcomes;
END $$;
REVOKE ALL ON FUNCTION public.apply_pursuit_workbook_v4(JSONB,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_pursuit_workbook_v4(JSONB,TEXT) TO service_role;
COMMIT;
