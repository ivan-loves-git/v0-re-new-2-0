import { createHash, randomUUID } from "node:crypto"
import { expect } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import type { Client } from "pg"
import { syntheticPdfBytes } from "../../lib/__tests__/fixtures/synthetic-pdf"
import { assertOpeningReadinessFixtureEnvironment, OPENING_READINESS_FIXTURE } from "../../lib/opening-readiness-fixture"

/** Actual private PDF bytes and the released W165 source/owner finalizer. */
export async function seedCurrentExternalLdc(db: Client, repreneurId: string, pageCount = 1) {
  const { apiUrl } = assertOpeningReadinessFixtureEnvironment(process.env)
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key || process.env.RESEND_API_KEY) throw new Error("Protected synthetic no-send LDC seed only")
  const storage = createClient(apiUrl.toString(), key, { auth: { persistSession: false } }).storage
  const fixture = OPENING_READINESS_FIXTURE
  const id = randomUUID(), bytes = syntheticPdfBytes(pageCount)
  const sha256 = createHash("sha256").update(bytes).digest("hex")
  const secret = createHash("sha256").update(randomUUID()).digest("hex")
  const actorKey = `staff:${fixture.authIds.staffUser}`
  const path = `cvs/${repreneurId}/ldc/${id}.pdf`
  await db.query(`INSERT INTO public.private_upload_intents(id,actor_kind,actor_key,actor_user_id,actor_email,upload_kind,resource_id,bucket_id,storage_path,
    original_filename,content_type,declared_size,metadata,idempotency_key,finalize_secret_hash,expires_at)
    VALUES($1,'staff',$2,$3,$4,'repreneur_document',$5,'cvs',$6,'QA Lettre de cadrage — SYNTHETIC.pdf','application/pdf',$7,'{"document_type":"ldc"}',$1,$8,now()+interval '1 hour')`,
  [id, actorKey, fixture.authIds.staffUser, fixture.staff.email, repreneurId, path, bytes.byteLength, secret])
  expect((await storage.from("cvs").upload(path, bytes, { contentType: "application/pdf", upsert: false })).error).toBeNull()
  await db.query("SELECT public.finalize_w165_private_upload($1,$2,$3,$4)", [id, actorKey, secret, sha256])
  return { storage, path, bytes, sha256, fileName: "QA Lettre de cadrage — SYNTHETIC.pdf" }
}

/** #255 prerequisite uses the same protected stage/context/byte contract. */
export async function seedExternalE4(db: Client, matchId: string) {
  const fixture = OPENING_READINESS_FIXTURE
  const { rows: [owner] } = await db.query<{ repreneur_id: string }>("SELECT repreneur_id FROM public.opportunity_matches WHERE id=$1", [matchId])
  const ldc = await seedCurrentExternalLdc(db, owner!.repreneur_id)
  const operation = randomUUID()
  const { rows: [current] } = await db.query("SELECT public.journey_external_handoff_context($1,'e4') AS context", [matchId])
  expect(current!.context.ldc.content_sha256).toBe(ldc.sha256)
  const { rows: [prepared] } = await db.query("SELECT public.journey_stage_external_ldc($1,$2,$3,$4,$5) AS stage", [matchId, current!.context, operation, fixture.authIds.staffUser, fixture.staff.email])
  const stage = prepared!.stage
  if (!stage.retained) expect((await ldc.storage.from("cvs").upload(stage.storage_path, ldc.bytes, { contentType: "application/pdf", upsert: false, metadata: { sha256: ldc.sha256 } })).error).toBeNull()
  const retained = await ldc.storage.from("cvs").download(stage.storage_path)
  expect(retained.error).toBeNull()
  expect(createHash("sha256").update(new Uint8Array(await retained.data!.arrayBuffer())).digest("hex")).toBe(ldc.sha256)
  await db.query("SELECT public.journey_record_external_handoff($1,$2,$3,current_date-1,NULL,'phone','Synthetic actual current LDC prerequisite',$4,$5)", [matchId, current!.context, operation, fixture.authIds.staffUser, fixture.staff.email])
  return ldc
}
