import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

// Existing handoff functions are Server Actions. An included direct action is
// never delivery authority by itself: only a reserved queue row may enter it.
export async function requireReservedHandoffReview(reviewId: string | undefined, kind: "e4" | "e6" | "e7", matchId: string, upstreamId: string) {
  if (!reviewId) throw new Error("Prepare this handoff in Review & send before delivery.")
  const { data, error } = await createAdminClient().from("staff_email_reviews").select("*")
    .eq("id", reviewId).eq("source_kind", kind).eq("match_id", matchId)
    .eq("source_operation_id", upstreamId).eq("state", "sending").maybeSingle()
  if (error || !data?.attempt_token || !data.approved_by || data.namespace !== "REAL") {
    throw new Error("This handoff has no current staff-approved send reservation.")
  }
  return data
}

export function sameAttachmentSnapshot(left: unknown, right: unknown) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false
  const fields = ["artifact_id", "document_id", "content_sha256", "file_name", "mime_type", "size_bytes"] as const
  return left.every((item, index) => fields.every((field) => item?.[field] === right[index]?.[field]))
}
