// Native partial DB + physical-file adapter proof. No Supabase server, browser,
// real authentication, email/provider or production URL is used or claimed.
const { strict: assert } = require('node:assert')
const { createHash, randomUUID } = require('node:crypto')
const { readFile, writeFile, mkdir, rm } = require('node:fs/promises')
const { join } = require('node:path')
const { createRequire } = require('node:module')
const { Client } = require('pg')
const repo = process.env.RENEW_EXTERNAL_HANDOFF_REPO_ROOT
const cluster = process.env.RENEW_LDC_NATIVE_SOCKET
if (!repo || !cluster || !cluster.includes('/renew-external-handoff.') || !process.env.RENEW_LDC_NATIVE_PORT) throw Error('Generated native socket proof only')
const rootRequire = createRequire(join(repo, 'package.json'))
const viteRequire = createRequire(createRequire(rootRequire.resolve('vitest/config')).resolve('vite'))
const { build } = viteRequire('esbuild')
const db = new Client({ host: cluster, port: Number(process.env.RENEW_LDC_NATIVE_PORT), user: 'renew_external_handoff_admin', database: 'renew_external_handoff' })
const files = join(cluster, 'physical-ldc-proof')
const repr = '76000000-0000-4000-8000-000000000004'
const staff = { id: 'w173-staff', email: 'w173-staff@example.test' }
let uploads = 0, removals = 0
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const physicalPath = (bucket, path) => { if (bucket !== 'cvs' || !path || /(^\/|\\|(^|\/)\.\.?($|\/))/.test(path)) throw Error('Unsafe native file target'); return join(files, bucket, path) }
const storage = { from: bucket => ({
  download: async path => { try { return { data: new Blob([await readFile(physicalPath(bucket, path))]), error: null } } catch { return { data: null, error: { message: 'missing owned physical bytes' } } } },
  upload: async (path, bytes, options) => {
    const target = physicalPath(bucket, path)
    await mkdir(join(target, '..'), { recursive: true })
    try { await writeFile(target, bytes, { flag: 'wx' }) } catch { return { data: null, error: { statusCode: '409' } } }
    uploads++
    await db.query('INSERT INTO storage.objects(bucket_id,name,version,metadata,user_metadata) VALUES($1,$2,$3,$4,$5)',
      [bucket, path, randomUUID(), { size: bytes.byteLength, mimetype: options.contentType }, options.metadata ?? {}])
    return { data: {}, error: null }
  },
  remove: async paths => {
    for (const path of paths) { await rm(physicalPath(bucket, path), { force: true }); await db.query('DELETE FROM storage.objects WHERE bucket_id=$1 AND name=$2', [bucket, path]); removals++ }
    return { data: [], error: null }
  },
}) }
const rpc = async (name, args) => {
  if (!/^journey_[a-z_]+$/.test(name) || Object.keys(args).some(key => !/^p_[a-z_]+$/.test(key))) throw Error('Unexpected native RPC')
  const invocation = `public.${name}(${Object.keys(args).map((key, i) => `${key} => $${i + 1}`).join(',')})`
  try {
    await db.query('SET ROLE service_role')
    const query = name === 'journey_claim_ldc_cleanup' ? `SELECT coalesce(jsonb_agg(result),'[]'::jsonb) AS data FROM ${invocation} result` : `SELECT ${invocation} AS data`
    return { data: (await db.query(query, Object.values(args))).rows[0].data, error: null }
  } catch (error) { return { data: null, error: { message: error.message } } }
  finally { await db.query('RESET ROLE') }
}
global.__ldcNativeDb = { rpc, storage }

async function uploadCurrent(bytes) {
  const id = randomUUID(), path = `cvs/${repr}/ldc/${id}.pdf`, actorKey = `staff:${staff.id}`, secret = hash(Buffer.from(id))
  await db.query(`INSERT INTO public.private_upload_intents(id,actor_kind,actor_key,actor_user_id,actor_email,upload_kind,resource_id,bucket_id,storage_path,original_filename,content_type,declared_size,metadata,idempotency_key,finalize_secret_hash,expires_at)
    VALUES($1,'staff',$2,$3,$4,'repreneur_document',$5,'cvs',$6,'Synthetic Lettre-de-cadrage.pdf','application/pdf',$7,'{"document_type":"ldc"}',$1,$8,now()+interval '1 hour')`, [id, actorKey, staff.id, staff.email, repr, path, bytes.byteLength, secret])
  assert.equal((await storage.from('cvs').upload(path, bytes, { contentType: 'application/pdf' })).error, null)
  await db.query('SELECT public.finalize_w165_private_upload($1,$2,$3,$4)', [id, actorKey, secret, hash(bytes)])
  return { id, path }
}
async function seedMatch(index) {
  const opportunity = `25400000-0000-4000-8000-${String(300 + index).padStart(12, '0')}`, match = `25400000-0000-4000-8000-${String(400 + index).padStart(12, '0')}`
  await db.query('BEGIN')
  await db.query(`INSERT INTO public.opportunities(id,reference,status,is_demo,source_office_id,public_title,description,created_by)
    VALUES($1,$2,'active',false,'76000000-0000-4000-8000-000000000002','Synthetic native LDC','Synthetic native existing PDF proof',$3)`, [opportunity, `QA-NATIVE-LDC-${index}`, staff.id])
  await db.query(`INSERT INTO public.opportunity_ma_contacts(opportunity_id,affiliation_id,contact_name_snapshot,is_primary,linked_by)
    VALUES($1,'25400000-0000-4000-8000-000000000092','Synthetic source',true,$2)`, [opportunity, staff.id])
  await db.query(`INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,created_by) VALUES($1,$2,$3,'interested',$4)`, [match, opportunity, repr, staff.id])
  await db.query('SET CONSTRAINTS ALL IMMEDIATE')
  await db.query('COMMIT')
  await db.query('SELECT public.journey_start_pursuit($1,$2,$3)', [match, staff.email, `ldc-physical-cycle-${index}`])
  return match
}
async function qualifyingSnapshot(match) {
  return (await db.query(`SELECT jsonb_build_object('receipts',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM public.opportunity_pursuit_external_handoffs x WHERE match_id=$1),
    'events',(SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.id),'[]') FROM public.opportunity_pursuit_evidence e WHERE match_id=$1),
    'versions',(SELECT coalesce(jsonb_agg(to_jsonb(v) ORDER BY v.id),'[]') FROM public.pursuit_ldc_versions v),
    'links',(SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.receipt_id),'[]') FROM public.pursuit_external_ldc_receipts l),
    'grants',(SELECT coalesce(jsonb_agg(to_jsonb(g) ORDER BY g.id),'[]') FROM public.opportunity_pursuit_confidential_grants g WHERE match_id=$1)) AS snapshot`, [match])).rows[0].snapshot
}
;(async () => {
  await db.connect()
  try {
    const output = join(cluster, 'ldc-public-action.cjs')
    await build({ stdin: { contents: `export { recordExternalPursuitHandoff } from '${join(repo, 'lib/actions/external-pursuit-handoffs.ts')}'; export { loadVerifiedExternalHandoffContext, stageExternalLdcVersion, retainExternalLdcBytes, cleanupExternalLdcStaging } from '${join(repo, 'lib/external-ldc-version.ts')}'; export { syntheticPdfBytes } from '${join(repo, 'lib/__tests__/fixtures/synthetic-pdf.ts')}';`, resolveDir: repo },
      outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external', plugins: [{ name: 'native-boundaries', setup(builder) {
        const stubs = { 'server-only': '', 'next/cache': 'export function revalidatePath() {}', '@/lib/access-control': `export async function requireStaffAccess(){return {user:${JSON.stringify(staff)}}}`, '@/lib/supabase/admin': 'export function createAdminClient(){return globalThis.__ldcNativeDb}', '@/lib/env': 'export const env={BETTER_AUTH_SECRET:"native-only-synthetic-secret-never-provider"}' }
        builder.onResolve({ filter: /^(server-only|next\/cache|@\/lib\/(access-control|supabase\/admin|env))$/ }, args => ({ path: args.path, namespace: 'native-boundary' }))
        builder.onLoad({ filter: /.*/, namespace: 'native-boundary' }, args => ({ contents: stubs[args.path], loader: 'js' }))
      } }] })
    const { recordExternalPursuitHandoff: record, loadVerifiedExternalHandoffContext: load, syntheticPdfBytes, stageExternalLdcVersion, retainExternalLdcBytes, cleanupExternalLdcStaging } = require(output)
    if (process.env.RENEW_LDC_NATIVE_FINISH === '1') {
      for (const row of (await db.query('SELECT stage_id,operation_key FROM public.synthetic_ldc_races')).rows) await cleanupExternalLdcStaging(global.__ldcNativeDb, { stageId: row.stage_id, operationKey: row.operation_key, staffId: staff.id })
      const active = (await db.query('SELECT storage_path,content_sha256 FROM public.pursuit_ldc_versions')).rows
      for (const version of active) { try { assert.equal(hash(await readFile(physicalPath('cvs',version.storage_path))), version.content_sha256) } catch (error) { if (version.content_sha256 !== 'a'.repeat(64)) throw error } }
      assert.equal((await db.query("SELECT count(*)::int AS count FROM public.pursuit_ldc_staging WHERE state IN ('pending','cleanup')")).rows[0].count, 0)
      console.log('PASS: native independent-race finish cleaned only unused owned physical stages; every actual retained PDF remains byte/hash intact. Zero pending own stages; no provider/Supabase/browser proof.')
      return
    }
    await db.query('UPDATE public.pursuit_external_handoff_settings SET enabled=true')
    const originalBytes = syntheticPdfBytes(1), replacementBytes = syntheticPdfBytes(2)
    const original = await uploadCurrent(originalBytes), match = await seedMatch(1)
    const context = await load(global.__ldcNativeDb, match, 'e4')
    assert(context && context.ldc.content_sha256 === hash(originalBytes))
    // A queued/read older worker already holds this ORIGINAL key before record.
    await db.query("INSERT INTO public.private_upload_cleanup_queue(intent_id,bucket_id,storage_path,reason) VALUES($1,'cvs',$2,'synthetic already-read original') ON CONFLICT(bucket_id,storage_path) DO NOTHING", [original.id, original.path])
    const olderRead = (await db.query("SELECT bucket_id,storage_path FROM public.private_upload_cleanup_queue WHERE storage_path=$1", [original.path])).rows[0]
    const input = { matchId: match, context, operationKey: randomUUID(), exchangeDate: new Date(Date.now()-86400000).toISOString().slice(0,10), exchangeTime: null, channel: 'phone', reference: 'Native actual PDF exchange proof' }
    const beforeTamper = await qualifyingSnapshot(match), beforeTamperIo = { uploads, removals }
    const tamperedBytes = Buffer.from(originalBytes)
    tamperedBytes[tamperedBytes.length - 2] ^= 1
    await writeFile(physicalPath('cvs', original.path), tamperedBytes)
    assert.equal((await record(input)).success, false)
    assert.deepEqual(await qualifyingSnapshot(match), beforeTamper)
    assert.deepEqual({ uploads, removals }, beforeTamperIo)
    await writeFile(physicalPath('cvs', original.path), originalBytes)
    assert.equal((await record(input)).success, true)
    const saved = (await db.query('SELECT x.id,v.storage_path,v.content_sha256,v.size_bytes FROM public.opportunity_pursuit_external_handoffs x JOIN public.pursuit_external_ldc_receipts link ON link.receipt_id=x.id JOIN public.pursuit_ldc_versions v ON v.id=link.version_id WHERE x.operation_key=$1', [input.operationKey])).rows[0]
    assert.deepEqual(await readFile(physicalPath('cvs', saved.storage_path)), Buffer.from(originalBytes))
    const readFor = async (receipt, id, email) => {
      const result = await rpc('journey_retained_ldc_for_actor', { p_receipt_id: receipt, p_actor_user_id: id, p_actor_email: email })
      assert.equal(result.error, null)
      return result.data
    }
    assert.equal((await readFor(saved.id, 'w173-repreneur-interest', 'interested@example.test')).content_sha256, hash(originalBytes))
    assert.equal(await readFor(saved.id, 'w173-repreneur-second', 'second@example.test'), null)
    assert.equal(await readFor(saved.id, 'w173-repreneur-interest', 'second@example.test'), null)
    assert.equal(await readFor(saved.id, null, null), null)
    assert.equal(await readFor(randomUUID(), staff.id, staff.email), null)
    const beforeRetry = await qualifyingSnapshot(match)
    // Exact actual legacy remove arguments, with physical bytes gone.
    await storage.from(olderRead.bucket_id).remove([olderRead.storage_path])
    assert.equal((await storage.from('cvs').download(original.path)).data, null)
    await uploadCurrent(replacementBytes)
    const counts = { uploads, removals }
    assert.equal((await record(input)).success, true)
    assert.deepEqual({ uploads, removals }, counts)
    assert.deepEqual(await qualifyingSnapshot(match), beforeRetry)
    assert.deepEqual(await readFile(physicalPath('cvs', saved.storage_path)), Buffer.from(originalBytes))
    assert.equal((await record({ ...input, reference: 'Changed contradictory retry' })).success, false)
    // A new cycle: fault after evidence insertion must also clean owned bytes.
    await db.query("SELECT public.journey_transition_terminal($1,'drop',$2,'ldc-physical-drop','buyer_search_paused')", [match,staff.email])
    assert.equal(await readFor(saved.id, 'w173-repreneur-interest', 'interested@example.test'), null)
    assert.equal((await readFor(saved.id, staff.id, staff.email)).content_sha256, hash(originalBytes))
    await db.query("SELECT public.journey_transition_terminal($1,'reopen',$2,'ldc-physical-reopen')", [match,staff.email])
    await db.query("SELECT public.journey_start_pursuit($1,$2,'ldc-physical-restart')", [match,staff.email])
    const current = await load(global.__ldcNativeDb, match, 'e4'), retry = { ...input, context: current, operationKey: randomUUID() }
    const beforeFault = await qualifyingSnapshot(match)
    await db.query('CREATE TRIGGER synthetic_ldc_late_fault BEFORE INSERT ON public.pursuit_external_ldc_receipts FOR EACH ROW EXECUTE FUNCTION public.synthetic_ldc_fault()')
    assert.equal((await record(retry)).success, false)
    assert.deepEqual(await qualifyingSnapshot(match), beforeFault)
    const failedStage = (await db.query('SELECT state,storage_path FROM public.pursuit_ldc_staging WHERE operation_key=$1', [retry.operationKey])).rows[0]
    assert.equal(failedStage.state, 'cleaned')
    assert.equal((await storage.from('cvs').download(failedStage.storage_path)).data, null)
    await db.query('DROP TRIGGER synthetic_ldc_late_fault ON public.pursuit_external_ldc_receipts')
    assert.equal((await record({ ...retry, operationKey: randomUUID() })).success, true)
    // A separate current pursuit shares this exact owner/mode/source version.
    const sibling = await seedMatch(2), siblingContext = await load(global.__ldcNativeDb, sibling, 'e4'), uploadCount = uploads
    assert.equal((await record({ ...input, matchId: sibling, context: siblingContext, operationKey: randomUUID() })).success, true)
    assert.equal(uploads, uploadCount)
    const shared = (await db.query('SELECT count(DISTINCT link.version_id)::int AS versions FROM public.pursuit_external_ldc_receipts link JOIN public.opportunity_pursuit_external_handoffs x ON x.id=link.receipt_id WHERE x.match_id=ANY($1::uuid[]) AND x.context->\'ldc\'->>\'content_sha256\'=$2', [[match,sibling],hash(replacementBytes)])).rows[0]
    assert.equal(shared.versions, 1)
    const siblingReceipt = (await db.query('SELECT id FROM public.opportunity_pursuit_external_handoffs WHERE match_id=$1', [sibling])).rows[0].id
    assert.equal((await readFor(siblingReceipt, 'w173-repreneur-interest', 'interested@example.test')).content_sha256, hash(replacementBytes))
    await db.query("SELECT public.pause_opportunity_with_reason($1,'seller_paused_sale',$2,NULL)", [siblingContext.opportunity_id, staff.id])
    assert.equal(await readFor(siblingReceipt, 'w173-repreneur-interest', 'interested@example.test'), null)
    assert.equal((await readFor(siblingReceipt, staff.id, staff.email)).content_sha256, hash(replacementBytes))
    await uploadCurrent(syntheticPdfBytes(3))
    await db.query('CREATE TABLE public.synthetic_ldc_races(kind text PRIMARY KEY,match_id uuid,opportunity_id uuid,context jsonb,operation_key uuid,stage_id uuid)')
    for (const [index,kind] of [[3,'record-first'],[4,'cleanup-first'],[5,'source-first'],[6,'pause-first'],[7,'drop-first']]) {
      const raceMatch = await seedMatch(index), raceContext = await load(global.__ldcNativeDb,raceMatch,'e4'), operationKey=randomUUID()
      const prepared=await stageExternalLdcVersion(global.__ldcNativeDb,{matchId:raceMatch,operationKey,context:raceContext},staff)
      await retainExternalLdcBytes(global.__ldcNativeDb,prepared.stage,prepared.bytes,raceContext.ldc.content_sha256)
      await db.query('INSERT INTO public.synthetic_ldc_races VALUES($1,$2,$3,$4,$5,$6)',[kind,raceMatch,raceContext.opportunity_id,raceContext,operationKey,prepared.stage.stage_id])
    }
    await db.query(`CREATE FUNCTION public.synthetic_ldc_race_record(p_kind text) RETURNS uuid LANGUAGE sql AS $body$
      SELECT public.journey_record_external_handoff(match_id,context,operation_key,current_date-1,NULL,'phone','Synthetic independent LDC race','w173-staff','w173-staff@example.test') FROM public.synthetic_ldc_races WHERE kind=p_kind;
    $body$`)
    console.log('PASS: real native public action, actual changed-hash denial without writes or blob I/O, safe PDF + physical snapshot/readback, exact owner/other/forged identity and Drop/Pause read denials, old already-read original removal, W165 replacement, exact unchanged replay, contradictory retry, late atomic fault/owned physical cleanup, independent pursuit exact-version reuse. NO Supabase/browser/auth/provider delivery proof.')
  } finally { await db.end() }
})().catch(error => { console.error(error); process.exitCode = 1 })
