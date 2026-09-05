import "server-only"

import { createHash } from "node:crypto"
import type { ResendDeliveryRequest } from "@/lib/email/resend-delivery-outcome"

export const RESEND_ATTACHMENT_LIMIT_BYTES = 40_000_000

export interface PursuitSignedCopy {
  artifactId: string
  contentSha256: string
  fileName: string
  mimeType: string
  bytes: Uint8Array
}

export function assertExactPursuitAttachments(copies: PursuitSignedCopy[]) {
  if (copies.length !== 2 || new Set(copies.map((copy) => copy.artifactId)).size !== 2) {
    throw new Error("E7 requires exactly the two current Gate 2 signed copies.")
  }
  for (const copy of copies) {
    if (copy.mimeType !== "application/pdf" || !copy.fileName.toLowerCase().endsWith(".pdf")) {
      throw new Error("E7 requires retained PDF signed copies.")
    }
    const actual = createHash("sha256").update(copy.bytes).digest("hex")
    if (actual !== copy.contentSha256.toLowerCase()) {
      throw new Error("A retained signed copy no longer matches its Gate 2 evidence.")
    }
  }
  if (copies.some((copy) => copy.bytes.length === 0 || !Buffer.from(copy.bytes.subarray(0, 5)).equals(Buffer.from("%PDF-")))) throw new Error("A retained signed copy is not a PDF.")
  // Resend measures the fully encoded message. Base64 grows by 4/3; allow no
  // hidden conversion or truncation at the provider boundary.
  const encodedBytes = copies.reduce((total, copy) => total + Math.ceil(copy.bytes.length / 3) * 4, 0)
  if (encodedBytes > RESEND_ATTACHMENT_LIMIT_BYTES) {
    throw new Error("The two signed copies exceed the 40 MiB email attachment limit. Send no email; reconcile the documents with staff.")
  }
  return {
    encodedBytes,
    snapshot: copies.map((copy) => ({ artifact_id: copy.artifactId, content_sha256: copy.contentSha256.toLowerCase(), file_name: copy.fileName, mime_type: copy.mimeType, size_bytes: copy.bytes.length })),
  }
}

// Include MIME wrapping, names, message text and a conservative envelope reserve.
// Reject before provider I/O; never truncate either signed artifact.
export function assertPursuitEmailSize(request: ResendDeliveryRequest) {
  const attachments = (request.attachments ?? []).reduce((total, attachment) => {
    const base64 = Math.ceil(attachment.content.length / 3) * 4
    return total + base64 + Math.ceil(base64 / 76) * 2 + Buffer.byteLength(attachment.filename) * 2 + 512
  }, 0)
  const bytes = attachments + Buffer.byteLength(request.html + request.text + request.subject + request.from + request.to.join(",")) + 65_536
  if (bytes > RESEND_ATTACHMENT_LIMIT_BYTES) throw new Error("The signed copies exceed the email provider's encoded message limit. No email was sent; staff must reconcile the document sizes.")
  return bytes
}
