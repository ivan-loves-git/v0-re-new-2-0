"use client"

import { createClient } from "@/lib/supabase/client"

export const PRIVATE_DOCUMENT_MAX_BYTES = 20 * 1024 * 1024
export const PRIVATE_DOCUMENT_MAX_LABEL = "20 MiB"

export type PrivateUploadKind =
  | "opportunity_document"
  | "staff_nda_artifact"
  | "portal_signed_nda"
  | "repreneur_document"
  | "external_pursuit_attachment"

export interface PrivateUploadRequest {
  kind: PrivateUploadKind
  resourceId?: string | null
  relatedId?: string | null
  metadata?: Record<string, unknown>
  idempotencyKey?: string
  intakeToken?: string
}

type UploadIntentResponse = {
  intentId: string
  finalizeSecret: string
  bucket: string
  path: string
  token: string
}

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

function extensionOf(filename: string) {
  return filename.trim().toLowerCase().match(/\.([a-z0-9]{2,5})$/)?.[1] ?? null
}

export function privateUploadContentType(file: File) {
  const extension = extensionOf(file.name)
  const expected = extension ? MIME_BY_EXTENSION[extension] : null
  if (!expected) throw new Error("Choose a supported document type.")
  if (file.type && file.type !== expected) {
    throw new Error("The file type does not match its extension.")
  }
  return expected
}

async function responseError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null)
  return new Error(typeof payload?.error === "string" ? payload.error : fallback)
}

async function abandonIntent(intent: UploadIntentResponse) {
  await fetch("/api/private-uploads/abort", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      intentId: intent.intentId,
      finalizeSecret: intent.finalizeSecret,
    }),
  }).catch(() => undefined)
}

function intakeHandleParts(value: string | null | undefined) {
  const match=value?.match(/^w165-intake:([0-9a-f-]{36}):([A-Za-z0-9_-]{32,128})$/i)
  return match ? {intentId:match[1],finalizeSecret:match[2]} : null
}

/** Removes a finalized-but-unclaimed public-intake upload immediately. */
export async function abandonPrivateIntakeUpload(value: string | null | undefined) {
  const handle=intakeHandleParts(value)
  if (!handle) return
  await fetch("/api/private-uploads/abort", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(handle),
  }).catch(() => undefined)
}

/**
 * Uploads bytes directly from the browser to one exact private Storage path.
 * The app server receives only small JSON intent/finalize requests.
 */
export async function uploadPrivateDocument<T extends Record<string, unknown> = Record<string, unknown>>(
  file: File,
  request: PrivateUploadRequest,
): Promise<T> {
  if (file.size < 1) throw new Error("Choose a non-empty file.")
  if (file.size > PRIVATE_DOCUMENT_MAX_BYTES) {
    throw new Error(`File size must not exceed ${PRIVATE_DOCUMENT_MAX_LABEL}.`)
  }
  const contentType = privateUploadContentType(file)
  const intentResponse = await fetch("/api/private-uploads/intents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(request.intakeToken ? { "x-intake-upload-token": request.intakeToken } : {}),
    },
    body: JSON.stringify({
      kind: request.kind,
      resourceId: request.resourceId ?? null,
      relatedId: request.relatedId ?? null,
      metadata: request.metadata ?? {},
      idempotencyKey: request.idempotencyKey ?? crypto.randomUUID(),
      fileName: file.name,
      contentType,
      sizeBytes: file.size,
    }),
  })
  if (!intentResponse.ok) throw await responseError(intentResponse, "Upload authorization failed.")
  const intent = await intentResponse.json() as UploadIntentResponse

  const { error: uploadError } = await createClient().storage
    .from(intent.bucket)
    .uploadToSignedUrl(intent.path, intent.token, file, { contentType })
  if (uploadError) {
    await abandonIntent(intent)
    throw new Error("The private file upload failed. Please try again.")
  }

  const finalizeResponse = await fetch("/api/private-uploads/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      intentId: intent.intentId,
      finalizeSecret: intent.finalizeSecret,
    }),
  })
  if (!finalizeResponse.ok) throw await responseError(finalizeResponse, "The uploaded file could not be validated.")
  return await finalizeResponse.json() as T
}
