import { NextResponse } from "next/server"
import { getCurrentUserAccessFromHeaders } from "@/lib/access-control"
import { EXTERNAL_PURSUIT_ATTACHMENTS_BUCKET } from "@/lib/external-pursuit-attachments"
import {
  privateSignedDownloadContentType,
  privateStorageDownloadError,
  proxyPrivateSignedStorageDownload,
} from "@/lib/storage/private-signed-download"
import { createAdminClient } from "@/lib/supabase/admin"

function privateResponse(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

/** A short-lived private redirect after exact dossier/attachment authorization. */
export async function GET(
  request: Request,
  context: { params: Promise<{ pursuitId: string; attachmentId: string }> },
) {
  const access = await getCurrentUserAccessFromHeaders(request.headers)
  if (!access || access.role === "unassigned") return privateResponse(NextResponse.json({ error: "Not found" }, { status: 404 }))
  const { pursuitId, attachmentId } = await context.params
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc("external_pursuit_attachment_for_actor", {
    p_dossier_id: pursuitId, p_attachment_id: attachmentId, p_actor_user_id: access.user.id,
  })
  if (error || !data?.[0]) return privateResponse(NextResponse.json({ error: "Not found" }, { status: 404 }))
  const attachment = data[0] as { storage_path: string; original_filename: string; content_type: string }
  const { data: signed, error: signedError } = await supabase.storage
    .from(EXTERNAL_PURSUIT_ATTACHMENTS_BUCKET)
    .createSignedUrl(attachment.storage_path, 60)
  if (signedError || !signed?.signedUrl) return privateResponse(NextResponse.json({ error: "Unable to open attachment." }, { status: 500 }))
  const response = await proxyPrivateSignedStorageDownload(signed.signedUrl, {
    filename: attachment.original_filename,
    contentType: privateSignedDownloadContentType(attachment.content_type),
  })
  return response ?? privateStorageDownloadError("Unable to open attachment.")
}
