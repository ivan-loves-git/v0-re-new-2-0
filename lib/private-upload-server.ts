import "server-only"

import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto"
import { revalidatePath } from "next/cache"
import { getCurrentUserAccess } from "@/lib/access-control"
import { revalidateOpportunityDashboardTags, revalidateRepreneurDashboardTags } from "@/lib/data/dashboard-snapshots"
import { env } from "@/lib/env"
import { EXTERNAL_PURSUIT_ATTACHMENT_MAX_BYTES } from "@/lib/external-pursuit-attachments"
import { getOpportunityDocumentPolicy } from "@/lib/opportunity-document-policy"
import { isOpportunityInRepreneurNamespace } from "@/lib/repreneur-opportunity-eligibility"
import { recalculateRepreneurScoresAndMatches } from "@/lib/repreneur-profile-refresh"
import { matchesExpectedFileStructure } from "@/lib/security/external-pursuit-attachment-content"
import { assertSafePdfEvidence } from "@/lib/security/pdf-evidence"
import {
  IntakeUploadSecurityError,
  requestFingerprint,
  verifyAndConsumeIntakeUploadToken,
} from "@/lib/security/intake-upload"
import { createAdminClient } from "@/lib/supabase/admin"

export const W165_MAX_BYTES = 20 * 1024 * 1024
// Supabase signed upload capabilities expire after two hours. Keep the intent
// alive for the same window so cleanup never removes a path while its token
// could still recreate the object.
const INTENT_TTL_MS = 2 * 60 * 60 * 1000
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SHA256_PATTERN = /^[0-9a-f]{64}$/

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
}

type UploadKind =
  | "opportunity_document"
  | "staff_nda_artifact"
  | "portal_signed_nda"
  | "repreneur_document"
  | "external_pursuit_attachment"

type IntentInput = {
  kind: UploadKind
  resourceId: string | null
  relatedId: string | null
  fileName: string
  contentType: string
  sizeBytes: number
  metadata: Record<string, unknown>
  idempotencyKey: string
}

type AuthorizedIntent = {
  actorKind: "staff" | "portal" | "intake"
  actorKey: string
  actorUserId: string | null
  actorRepreneurId: string | null
  actorEmail: string | null
  actorFingerprint: string | null
  resourceId: string | null
  relatedId: string | null
  metadata: Record<string, unknown>
  bucket: "opportunity-documents" | "cvs" | "external-pursuit-attachments"
  path: string
}

export type PrivateUploadIntentRow = {
  id: string
  actor_kind: "staff" | "portal" | "intake"
  actor_key: string
  actor_user_id: string | null
  actor_repreneur_id: string | null
  actor_email: string | null
  actor_fingerprint: string | null
  upload_kind: UploadKind
  resource_id: string | null
  related_id: string | null
  bucket_id: "opportunity-documents" | "cvs" | "external-pursuit-attachments"
  storage_path: string
  original_filename: string
  content_type: string
  declared_size: number
  metadata: Record<string, unknown>
  finalize_secret_hash: string
  status: "pending" | "finalized" | "rejected" | "expired"
  content_sha256: string | null
  result: Record<string, unknown> | null
  expires_at: string
}

type CleanupQueueRow = {
  id: string
  intent_id: string
  bucket_id: PrivateUploadIntentRow["bucket_id"]
  storage_path: string
  attempt_count: number
}

export class PrivateUploadError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
  }
}

export async function readPrivateUploadJson(request:Request) {
  const contentLength=Number(request.headers.get("content-length")??0)
  if (Number.isFinite(contentLength) && contentLength>16*1024) {
    throw new PrivateUploadError("Upload metadata is too large.",413)
  }
  const text=await request.text()
  if (text.length>16*1024) throw new PrivateUploadError("Upload metadata is too large.",413)
  try { return JSON.parse(text) as unknown }
  catch { throw new PrivateUploadError("Invalid upload request.",400) }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function stringValue(value: unknown, max = 255) {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  return normalized && normalized.length <= max ? normalized : null
}

function uuidValue(value: unknown, required = false) {
  if (value === null || value === undefined || value === "") {
    if (required) throw new PrivateUploadError("A valid resource is required.")
    return null
  }
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new PrivateUploadError("A valid resource is required.")
  }
  return value
}

function extensionOf(filename: string) {
  return filename.toLowerCase().match(/\.([a-z0-9]{2,5})$/)?.[1] ?? null
}

function safeFilename(value: unknown) {
  const filename = stringValue(value)
  if (!filename || /[\r\n\\/\0]/.test(filename)) {
    throw new PrivateUploadError("The file name is invalid.")
  }
  return filename
}

function safePathFilename(filename: string) {
  return filename.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "document"
}

function expectedMime(filename: string, supplied: unknown) {
  const extension = extensionOf(filename)
  const expected = extension ? MIME_BY_EXTENSION[extension] : null
  if (!expected || supplied !== expected) {
    throw new PrivateUploadError("The file type does not match its supported extension.")
  }
  return expected
}

function parseIntentInput(value: unknown): IntentInput {
  if (!isRecord(value)) throw new PrivateUploadError("Invalid upload request.")
  const kinds = new Set<UploadKind>([
    "opportunity_document","staff_nda_artifact","portal_signed_nda",
    "repreneur_document","external_pursuit_attachment",
  ])
  if (typeof value.kind !== "string" || !kinds.has(value.kind as UploadKind)) {
    throw new PrivateUploadError("Choose a supported upload workflow.")
  }
  const fileName = safeFilename(value.fileName)
  const contentType = expectedMime(fileName, value.contentType)
  if (!Number.isSafeInteger(value.sizeBytes) || Number(value.sizeBytes) < 1 || Number(value.sizeBytes) > W165_MAX_BYTES) {
    throw new PrivateUploadError("Files must be between 1 byte and 20 MiB.")
  }
  if (typeof value.idempotencyKey !== "string" || !UUID_PATTERN.test(value.idempotencyKey)) {
    throw new PrivateUploadError("The upload retry key is invalid.")
  }
  const metadata = isRecord(value.metadata) ? value.metadata : {}
  if (JSON.stringify(metadata).length > 4096) throw new PrivateUploadError("Upload metadata is too large.")
  return {
    kind: value.kind as UploadKind,
    resourceId: uuidValue(value.resourceId),
    relatedId: uuidValue(value.relatedId),
    fileName,
    contentType,
    sizeBytes: Number(value.sizeBytes),
    metadata,
    idempotencyKey: value.idempotencyKey,
  }
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin) return process.env.NODE_ENV !== "production"
  try {
    const candidate = new URL(origin)
    const configured = new URL(env.BETTER_AUTH_URL)
    return candidate.origin === configured.origin
      || (candidate.protocol === "https:" && candidate.host === request.headers.get("host"))
  } catch { return false }
}

function accessActorKey(access: NonNullable<Awaited<ReturnType<typeof getCurrentUserAccess>>>) {
  return `${access.role}:${access.user.id}:${access.repreneurId ?? ""}`
}

function requireMetadataText(metadata: Record<string, unknown>, key: string, label: string) {
  const value = stringValue(metadata[key])
  if (!value) throw new PrivateUploadError(`${label} is required.`)
  return value
}

async function authorizeIntent(
  request: Request,
  input: IntentInput,
  intentId: string,
  finalizeSecret: string,
): Promise<AuthorizedIntent> {
  if (!sameOrigin(request)) throw new PrivateUploadError("Forbidden", 403)
  const access = await getCurrentUserAccess()
  const supabase = createAdminClient()
  const extension = extensionOf(input.fileName)!
  const actor = access?.role === "staff" || access?.role === "repreneur"
    ? {
        actorKind: access.role === "staff" ? "staff" as const : "portal" as const,
        actorKey: accessActorKey(access),
        actorUserId: access.user.id,
        actorRepreneurId: access.repreneurId,
        actorEmail: access.user.email?.trim().toLowerCase() || null,
        actorFingerprint: null,
      }
    : null

  if (input.kind === "opportunity_document") {
    if (!actor || actor.actorKind !== "staff") throw new PrivateUploadError("Staff access is required.", 403)
    const opportunityId = uuidValue(input.resourceId, true)!
    const documentType = requireMetadataText(input.metadata, "document_type", "Document type")
    if (!new Set(["source_teaser","teaser","deal_book","external_analysis","other"]).has(documentType)) {
      throw new PrivateUploadError("Choose a valid document type.")
    }
    const visibility = stringValue(input.metadata.visibility) ?? "staff_only"
    if (!new Set(["staff_only","approved_for_repreneur"]).has(visibility)) {
      throw new PrivateUploadError("Choose a valid document visibility.")
    }
    const policy = getOpportunityDocumentPolicy(documentType as "source_teaser" | "teaser" | "deal_book" | "external_analysis" | "other")
    if (policy.requiresPdf && input.contentType !== "application/pdf") {
      throw new PrivateUploadError(documentType === "deal_book" ? "Information memoranda must be PDFs." : "Source teasers must be PDFs.")
    }
    if (!policy.canChangeVisibility && visibility !== "staff_only") {
      throw new PrivateUploadError("This document stays staff-only until the pursuit workflow grants access.")
    }
    requireMetadataText(input.metadata, "title", "Document title")
    const { data, error } = await supabase.from("opportunities").select("id").eq("id", opportunityId).maybeSingle()
    if (error || !data) throw new PrivateUploadError("Opportunity not found.", 404)
    return {
      ...actor,resourceId: opportunityId,relatedId: null,
      metadata: { ...input.metadata, document_type: documentType, visibility },
      bucket: "opportunity-documents",
      path: `${opportunityId}/documents/${intentId}-${safePathFilename(input.fileName)}`,
    }
  }

  if (input.kind === "staff_nda_artifact") {
    if (!actor || actor.actorKind !== "staff" || !actor.actorEmail) throw new PrivateUploadError("Staff access is required.", 403)
    const opportunityId = uuidValue(input.resourceId, true)!
    const role = requireMetadataText(input.metadata, "artifact_role", "Artifact role")
    if (!new Set(["blank_template","renew_signed_copy"]).has(role)) throw new PrivateUploadError("Choose a supported NDA artifact role.")
    if (role === "blank_template" ? input.relatedId !== null : input.relatedId === null) {
      throw new PrivateUploadError(role === "blank_template" ? "The blank template belongs to the opportunity." : "A signed copy requires an active pursuit.")
    }
    if (role !== "blank_template" && input.contentType !== "application/pdf") throw new PrivateUploadError("Signed NDA copies must be PDFs.")
    if (role === "blank_template" && !new Set(["application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document"]).has(input.contentType)) {
      throw new PrivateUploadError("The blank NDA template must be a PDF or DOCX file.")
    }
    requireMetadataText(input.metadata, "title", "Artifact title")
    const { data: opportunity, error: opportunityError } = await supabase
      .from("opportunities").select("id").eq("id", opportunityId).maybeSingle()
    if (opportunityError || !opportunity) throw new PrivateUploadError("Opportunity not found.", 404)
    if (input.relatedId) {
      const { data: match, error: matchError } = await supabase
        .from("opportunity_matches")
        .select("id,opportunity_id,status,opportunity:opportunities!inner(status,is_demo),repreneur:repreneurs!inner(is_demo)")
        .eq("id", input.relatedId).eq("opportunity_id", opportunityId).maybeSingle()
      const matchedOpportunity = Array.isArray(match?.opportunity) ? match.opportunity[0] : match?.opportunity
      const matchedRepreneur = Array.isArray(match?.repreneur) ? match.repreneur[0] : match?.repreneur
      if (
        matchError
        || !match
        || match.status !== "active_pursuit"
        || matchedOpportunity?.status !== "active"
        || !isOpportunityInRepreneurNamespace(matchedOpportunity, matchedRepreneur)
      ) {
        throw new PrivateUploadError("An active same-namespace pursuit is required for this signed copy.", 404)
      }
    }
    return {
      ...actor,resourceId: opportunityId,relatedId: input.relatedId,metadata: input.metadata,
      bucket: "opportunity-documents",
      path: `${opportunityId}/nda-artifacts/${role}/${intentId}-${safePathFilename(input.fileName)}`,
    }
  }

  if (input.kind === "portal_signed_nda") {
    if (!actor || actor.actorKind !== "portal" || !actor.actorRepreneurId || !actor.actorEmail) {
      throw new PrivateUploadError("Portal access is required.", 403)
    }
    if (input.contentType !== "application/pdf") throw new PrivateUploadError("The signed NDA must be a PDF.")
    const matchId = uuidValue(input.resourceId, true)!
    const { data: match, error } = await supabase
      .from("opportunity_matches")
      .select("id,opportunity_id,status,opportunity:opportunities!inner(status,is_demo),repreneur:repreneurs!inner(is_demo)")
      .eq("id",matchId).eq("repreneur_id",actor.actorRepreneurId).maybeSingle()
    const opportunity = Array.isArray(match?.opportunity) ? match.opportunity[0] : match?.opportunity
    const repreneur = Array.isArray(match?.repreneur) ? match.repreneur[0] : match?.repreneur
    if (error || !match || match.status!=="active_pursuit" || opportunity?.status!=="active" || opportunity?.is_demo!==repreneur?.is_demo) {
      throw new PrivateUploadError("This NDA is not available for upload.", 403)
    }
    const { data: gate } = await supabase.rpc("journey_current_gate_1_event",{p_match_id:matchId})
    if (!gate) throw new PrivateUploadError("The NDA is not ready for signature yet.",409)
    return {
      ...actor,resourceId:matchId,relatedId:actor.actorRepreneurId,
      metadata:{ ...input.metadata, opportunity_id:match.opportunity_id },
      bucket:"opportunity-documents",
      path:`${match.opportunity_id}/nda-artifacts/repreneur_signed_copy/${intentId}-${safePathFilename(input.fileName)}`,
    }
  }

  if (input.kind === "repreneur_document") {
    const documentType = requireMetadataText(input.metadata,"document_type","Document type")
    if (!new Set(["cv","ldc"]).has(documentType)) throw new PrivateUploadError("Choose CV or Lettre de cadrage.")
    if (!new Set(["application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"]).has(input.contentType)) {
      throw new PrivateUploadError("Upload a PDF or Word document.")
    }
    if (!actor) {
      const grant = await verifyAndConsumeIntakeUploadToken(request,request.headers.get("x-intake-upload-token"))
      const fingerprint = requestFingerprint(request)
      return {
        actorKind:"intake",actorKey:`intake:${grant.id}:${fingerprint}`,actorUserId:null,
        actorRepreneurId:null,actorEmail:null,actorFingerprint:fingerprint,
        resourceId:null,relatedId:null,metadata:{document_type:documentType},bucket:"cvs",
        path:`cvs/intake-${grant.id}/${documentType}/${intentId}.${extension}`,
      }
    }
    const repreneurId = actor.actorKind === "portal"
      ? actor.actorRepreneurId
      : uuidValue(input.resourceId,true)
    if (!repreneurId || (actor.actorKind==="portal" && input.resourceId!==repreneurId)) {
      throw new PrivateUploadError("This document does not belong to your profile.",403)
    }
    const { data: profile,error } = await supabase.from("repreneurs").select("id,ms_ldc_validated").eq("id",repreneurId).maybeSingle()
    if (error || !profile) throw new PrivateUploadError("Repreneur not found.",404)
    if (actor.actorKind==="portal" && documentType==="ldc" && profile.ms_ldc_validated) {
      throw new PrivateUploadError("This Lettre de cadrage is already validated by Re-New and cannot be replaced here.",409)
    }
    return {
      ...actor,resourceId:repreneurId,relatedId:null,metadata:{document_type:documentType},bucket:"cvs",
      path:`cvs/${repreneurId}/${documentType}/${intentId}.${extension}`,
    }
  }

  if (!actor || !new Set(["staff","portal"]).has(actor.actorKind)) throw new PrivateUploadError("External Pursuit access is required.",403)
  if (input.sizeBytes>EXTERNAL_PURSUIT_ATTACHMENT_MAX_BYTES) throw new PrivateUploadError("Attachments must not exceed 20 MiB.")
  if (!new Set(["application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","text/csv","image/jpeg","image/png","image/webp","image/gif"]).has(input.contentType)) {
    throw new PrivateUploadError("Choose a permitted document or image file.")
  }
  const pursuitId=uuidValue(input.resourceId,true)!
  const { error: accessError }=await supabase.rpc("external_pursuit_attachments_for_actor",{p_dossier_id:pursuitId,p_actor_user_id:actor.actorUserId})
  if (accessError) throw new PrivateUploadError("External Pursuit access denied.",403)
  const digest=createHash("sha256").update(intentId).update(finalizeSecret).digest("hex")
  return {
    ...actor,resourceId:pursuitId,relatedId:null,metadata:{},bucket:"external-pursuit-attachments",
    path:`${pursuitId}/${digest}.${extension}`,
  }
}

export async function createPrivateUploadIntent(request: Request, payload: unknown) {
  const input=parseIntentInput(payload)
  const intentId=randomUUID()
  const finalizeSecret=randomBytes(32).toString("base64url")
  const authorized=await authorizeIntent(request,input,intentId,finalizeSecret)
  const supabase=createAdminClient()
  const { error:insertError }=await supabase.from("private_upload_intents").insert({
    id:intentId,actor_kind:authorized.actorKind,actor_key:authorized.actorKey,
    actor_user_id:authorized.actorUserId,actor_repreneur_id:authorized.actorRepreneurId,
    actor_email:authorized.actorEmail,actor_fingerprint:authorized.actorFingerprint,
    upload_kind:input.kind,resource_id:authorized.resourceId,related_id:authorized.relatedId,
    bucket_id:authorized.bucket,storage_path:authorized.path,original_filename:input.fileName,
    content_type:input.contentType,declared_size:input.sizeBytes,metadata:authorized.metadata,
    idempotency_key:input.idempotencyKey,
    finalize_secret_hash:createHash("sha256").update(finalizeSecret).digest("hex"),
    expires_at:new Date(Date.now()+INTENT_TTL_MS).toISOString(),
  })
  if (insertError?.code === "23505") throw new PrivateUploadError("This upload retry key has already been used.",409)
  if (insertError) throw new PrivateUploadError("Upload authorization could not be recorded.",500)
  const { data:signed,error:signedError }=await supabase.storage.from(authorized.bucket).createSignedUploadUrl(authorized.path,{upsert:false})
  if (signedError || !signed?.token) {
    await supabase.from("private_upload_intents").delete().eq("id",intentId)
    throw new PrivateUploadError("Private storage is temporarily unavailable.",503)
  }
  return {intentId,finalizeSecret,bucket:authorized.bucket,path:authorized.path,token:signed.token}
}

function secretHash(secret: unknown) {
  if (typeof secret!=="string" || secret.length<32 || secret.length>128) return null
  return createHash("sha256").update(secret).digest("hex")
}

function sameDigest(left: string, right: string) {
  const a=Buffer.from(left)
  const b=Buffer.from(right)
  return a.length===b.length && timingSafeEqual(a,b)
}

export async function loadAuthorizedPrivateUploadIntent(request: Request,payload: unknown) {
  if (!sameOrigin(request)) throw new PrivateUploadError("Forbidden",403)
  if (!isRecord(payload)) throw new PrivateUploadError("Invalid upload request.")
  const id=uuidValue(payload.intentId,true)!
  const suppliedHash=secretHash(payload.finalizeSecret)
  if (!suppliedHash) throw new PrivateUploadError("Upload authorization is invalid.",403)
  const supabase=createAdminClient()
  const {data,error}=await supabase.from("private_upload_intents").select("*").eq("id",id).maybeSingle()
  const intent=data as PrivateUploadIntentRow|null
  if (error || !intent || !sameDigest(suppliedHash,intent.finalize_secret_hash)) throw new PrivateUploadError("Upload authorization is invalid.",403)
  const access=await getCurrentUserAccess()
  if (intent.actor_kind==="intake") {
    if (intent.actor_fingerprint!==requestFingerprint(request)) throw new PrivateUploadError("Upload authorization is invalid.",403)
  } else if (!access || accessActorKey(access)!==intent.actor_key) {
    throw new PrivateUploadError("Upload authorization is invalid.",403)
  }
  return intent
}

async function processCleanupQueue(queueIds?:string[]) {
  const supabase=createAdminClient()
  let query=supabase.from("private_upload_cleanup_queue")
    .select("id,intent_id,bucket_id,storage_path,attempt_count")
    .is("completed_at",null)
    .order("created_at",{ascending:true})
    .limit(200)
  if (queueIds?.length) query=query.in("id",queueIds)
  const {data,error}=await query
  if (error) throw new Error(error.message)

  let cleaned=0
  for (const row of (data??[]) as CleanupQueueRow[]) {
    const {error:removeError}=await supabase.storage.from(row.bucket_id).remove([row.storage_path])
    const now=new Date().toISOString()
    if (removeError && !/not found/i.test(removeError.message)) {
      await supabase.from("private_upload_cleanup_queue").update({
        attempt_count:row.attempt_count+1,
        last_error:removeError.message.slice(0,500),
        updated_at:now,
      }).eq("id",row.id).is("completed_at",null)
      continue
    }
    const {data:updated}=await supabase.from("private_upload_cleanup_queue").update({
      attempt_count:row.attempt_count+1,
      last_error:null,
      completed_at:now,
      updated_at:now,
    }).eq("id",row.id).is("completed_at",null).select("id").maybeSingle()
    if (updated) cleaned+=1
  }
  return {examined:(data??[]).length,cleaned}
}

async function processCleanupQueueForIntent(intentId:string) {
  const supabase=createAdminClient()
  const {data,error}=await supabase.from("private_upload_cleanup_queue")
    .select("id").eq("intent_id",intentId).is("completed_at",null)
  if (error) throw new Error(error.message)
  const ids=(data??[]).map((row)=>row.id)
  if (ids.length) await processCleanupQueue(ids)
}

async function closeIntent(
  intent:PrivateUploadIntentRow,
  code:string,
  status:"rejected"|"expired"="rejected",
) {
  const supabase=createAdminClient()
  const {data,error}=await supabase.rpc("close_w165_private_upload_intent",{
    p_intent_id:intent.id,
    p_actor_key:intent.actor_key,
    p_status:status,
    p_failure_code:code,
  })
  if (error) throw new PrivateUploadError("Upload cleanup could not be scheduled safely.",503)
  if (typeof data==="string") await processCleanupQueue([data])
}

function assertLegacyDoc(bytes:Uint8Array) {
  const signature=[0xd0,0xcf,0x11,0xe0]
  if (!signature.every((byte,index)=>bytes[index]===byte)) throw new PrivateUploadError("The Word document contents are invalid.")
}

async function assertValidPrivateUpload(intent:PrivateUploadIntentRow,bytes:Uint8Array,blobType:string) {
  if (bytes.byteLength!==Number(intent.declared_size)) throw new PrivateUploadError("The uploaded byte count does not match the authorized file.")
  if (blobType && blobType.split(";")[0]?.trim().toLowerCase()!==intent.content_type.toLowerCase()) {
    throw new PrivateUploadError("The uploaded content type does not match the authorized file.")
  }
  if (intent.content_type==="application/pdf") {
    await assertSafePdfEvidence(bytes)
    return
  }
  if (intent.content_type==="application/msword") {
    assertLegacyDoc(bytes)
    return
  }
  if (!matchesExpectedFileStructure(intent.original_filename,bytes)) {
    throw new PrivateUploadError("The file contents do not match its permitted type.")
  }
}

async function afterSuccessfulFinalize(intent:PrivateUploadIntentRow) {
  await processCleanupQueueForIntent(intent.id)
  if (intent.upload_kind==="opportunity_document" || intent.upload_kind==="staff_nda_artifact") {
    revalidatePath(`/opportunities/${intent.resource_id}`)
    revalidateOpportunityDashboardTags()
  }
  if (intent.upload_kind==="portal_signed_nda") {
    revalidatePath("/portal/deals")
    revalidatePath(`/portal/deals/${intent.resource_id}`)
  }
  if (intent.upload_kind==="repreneur_document" && intent.resource_id) {
    revalidatePath("/repreneurs")
    revalidatePath(`/repreneurs/${intent.resource_id}`)
    revalidatePath("/portal/profile")
    revalidateRepreneurDashboardTags()
    if (intent.metadata.document_type==="ldc") {
      await recalculateRepreneurScoresAndMatches(intent.resource_id).catch((error)=>console.error("W-165 LDC score refresh failed",error))
    }
  }
}

function intakeHandle(intentId:string,finalizeSecret:string) {
  return `w165-intake:${intentId}:${finalizeSecret}`
}

export type PrivateIntakeUploadHandle = {
  intentId:string
  secretHash:string
}

export function parsePrivateIntakeUploadHandle(value:string|null|undefined):PrivateIntakeUploadHandle|null {
  const match=value?.match(/^w165-intake:([0-9a-f-]{36}):([A-Za-z0-9_-]{32,128})$/i)
  if (!match || !UUID_PATTERN.test(match[1])) return null
  return {intentId:match[1],secretHash:createHash("sha256").update(match[2]).digest("hex")}
}

export async function claimPrivateIntakeUploads(
  repreneurId:string,
  cv:PrivateIntakeUploadHandle|null,
  ldc:PrivateIntakeUploadHandle|null,
) {
  if (!UUID_PATTERN.test(repreneurId) || (!cv && !ldc)) {
    throw new PrivateUploadError("The intake upload claim is invalid.",400)
  }
  const supabase=createAdminClient()
  const {data,error,status}=await supabase.rpc("claim_w165_intake_uploads",{
    p_repreneur_id:repreneurId,
    p_cv_intent_id:cv?.intentId??null,
    p_cv_secret_hash:cv?.secretHash??null,
    p_ldc_intent_id:ldc?.intentId??null,
    p_ldc_secret_hash:ldc?.secretHash??null,
  })
  if (!error && data) return data

  // A status-0 response can arrive after PostgreSQL commits. Reconcile every
  // exact claim before deciding whether the newly-created repreneur must be
  // compensated by the caller.
  if (status===0) {
    const ids=[cv?.intentId,ldc?.intentId].filter((id):id is string=>Boolean(id))
    const {data:claims}=await supabase.from("private_intake_upload_claims")
      .select("intent_id,claimed_repreneur_id").in("intent_id",ids)
    if (claims?.length===ids.length && claims.every((claim)=>claim.claimed_repreneur_id===repreneurId)) {
      return claims
    }
    throw new PrivateUploadError("Intake document registration is still being confirmed. Please retry.",503)
  }
  throw new PrivateUploadError("The uploaded intake document is expired or invalid.",409)
}

export async function finalizePrivateUpload(request:Request,payload:unknown) {
  const intent=await loadAuthorizedPrivateUploadIntent(request,payload)
  const suppliedSecret=isRecord(payload) && typeof payload.finalizeSecret==="string"
    ? payload.finalizeSecret
    : null
  const clientResult=(result:Record<string,unknown>)=>intent.actor_kind==="intake" && suppliedSecret
    ? {...result,url:intakeHandle(intent.id,suppliedSecret)}
    : result
  if (intent.status==="finalized" && intent.result) return clientResult(intent.result)
  if (intent.status!=="pending") throw new PrivateUploadError("This upload is already closed.",409)
  if (Date.parse(intent.expires_at)<=Date.now()) {
    await closeIntent(intent,"expired","expired")
    throw new PrivateUploadError("Upload authorization expired. Choose the file again.",410)
  }
  const supabase=createAdminClient()
  const {data:blob,error:downloadError}=await supabase.storage.from(intent.bucket_id).download(intent.storage_path)
  if (downloadError || !blob) throw new PrivateUploadError("The private upload is not available for validation.",409)
  const bytes=new Uint8Array(await blob.arrayBuffer())
  try { await assertValidPrivateUpload(intent,bytes,blob.type) }
  catch(error) {
    await closeIntent(intent,"content_validation_failed")
    throw error
  }
  const digest=createHash("sha256").update(bytes).digest("hex")
  if (!SHA256_PATTERN.test(digest)) throw new PrivateUploadError("Upload digest failed.",500)
  const {data,error,status}=await supabase.rpc("finalize_w165_private_upload",{
    p_intent_id:intent.id,p_actor_key:intent.actor_key,
    p_finalize_secret_hash:intent.finalize_secret_hash,p_content_sha256:digest,
  })
  if (error || !data) {
    const {data:reconciled}=await supabase.from("private_upload_intents").select("status,result,content_sha256").eq("id",intent.id).maybeSingle()
    if (reconciled?.status==="finalized" && reconciled.content_sha256===digest && isRecord(reconciled.result)) {
      await afterSuccessfulFinalize(intent)
      return clientResult(reconciled.result)
    }
    if (status===0) throw new PrivateUploadError("Upload registration is still being confirmed. Retry finalization.",503)
    await closeIntent(intent,"registration_rejected")
    throw new PrivateUploadError("The upload is no longer valid for this record.",409)
  }
  const result=isRecord(data)?data:{}
  await afterSuccessfulFinalize(intent)
  return clientResult(result)
}

export async function abortPrivateUpload(request:Request,payload:unknown) {
  const intent=await loadAuthorizedPrivateUploadIntent(request,payload)
  if (intent.status==="finalized" && intent.actor_kind==="intake") {
    const supabase=createAdminClient()
    const {data,error}=await supabase.rpc("expire_w165_intake_upload_claim",{
      p_intent_id:intent.id,p_actor_key:intent.actor_key,p_force:true,
    })
    if (error) throw new PrivateUploadError("This intake upload cannot be abandoned.",409)
    if (typeof data==="string") await processCleanupQueue([data])
    return {success:true}
  }
  if (intent.status==="finalized") throw new PrivateUploadError("A finalized upload cannot be removed here.",409)
  if (intent.status!=="pending") return {success:true}
  await closeIntent(intent,"client_abort")
  return {success:true}
}

export async function cleanupExpiredPrivateUploads() {
  const supabase=createAdminClient()
  const {data,error}=await supabase.from("private_upload_intents").select("*").eq("status","pending").lt("expires_at",new Date().toISOString()).limit(200)
  if (error) throw new Error(error.message)
  for (const row of (data??[]) as PrivateUploadIntentRow[]) {
    await closeIntent(row,"expired_cleanup","expired").catch(()=>undefined)
  }

  const {data:claims,error:claimError}=await supabase
    .from("private_intake_upload_claims")
    .select("intent_id,intent:private_upload_intents!inner(actor_key)")
    .is("claimed_at",null)
    .is("expired_at",null)
    .lt("claim_expires_at",new Date().toISOString())
    .limit(200)
  if (claimError) throw new Error(claimError.message)
  for (const claim of claims??[]) {
    const intent=Array.isArray(claim.intent)?claim.intent[0]:claim.intent
    if (!intent?.actor_key) continue
    try {
      await supabase.rpc("expire_w165_intake_upload_claim",{
        p_intent_id:claim.intent_id,p_actor_key:intent.actor_key,p_force:false,
      })
    } catch {
      // The durable row remains eligible for the next cleanup pass.
    }
  }
  const queue=await processCleanupQueue()
  return {
    expiredIntentsExamined:(data??[]).length,
    expiredClaimsExamined:(claims??[]).length,
    ...queue,
  }
}

export { IntakeUploadSecurityError }
