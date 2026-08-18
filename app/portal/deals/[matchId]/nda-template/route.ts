import { NextResponse } from "next/server"
import { resolvePortalPursuitResource } from "@/lib/data/current-pursuit"
import { createAdminClient } from "@/lib/supabase/admin"
import { startCriticalOperation } from "@/lib/observability/critical-operation"

function privateRedirect(url: string) {
  const response = NextResponse.redirect(url)
  response.headers.set("cache-control", "private, no-store")
  return response
}

/** The portal may read the exact opportunity template only after canonical Gate 1. */
export async function GET(_request: Request, context: { params: Promise<{ matchId: string }> }) {
  const trace = startCriticalOperation("portal.nda_template_download")
  try {
    const { matchId } = await context.params
    const template = await resolvePortalPursuitResource({
      matchId,
      viewer: { kind: "portal" },
      resource: { kind: "nda-template" },
    })
    if (template?.kind !== "nda-template") {
      trace.failure("authorization_denied")
      return NextResponse.json({ error: "Gate 1 is required before the template can be downloaded." }, { status: 404 })
    }

    const supabase = createAdminClient()
    const { data: signedUrl, error: signedUrlError } = await supabase.storage
      .from(template.storageBucket)
      .createSignedUrl(template.storagePath, 60, { download: true })
    if (signedUrlError) {
      trace.failure("storage_failed")
      return NextResponse.json({ error: signedUrlError.message }, { status: 500 })
    }
    trace.success()
    return privateRedirect(signedUrl.signedUrl)
  } catch (error) {
    trace.failure("internal_error")
    throw error
  }
}
