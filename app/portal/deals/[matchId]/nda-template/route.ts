import { NextResponse } from "next/server"
import { resolvePortalPursuitResource } from "@/lib/data/current-pursuit"
import { createAdminClient } from "@/lib/supabase/admin"

function privateRedirect(url: string) {
  const response = NextResponse.redirect(url)
  response.headers.set("cache-control", "private, no-store")
  return response
}

/** The portal may read the exact opportunity template only after canonical Gate 1. */
export async function GET(_request: Request, context: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await context.params
  const template = await resolvePortalPursuitResource({
    matchId,
    viewer: { kind: "portal" },
    resource: { kind: "nda-template" },
  })
  if (template?.kind !== "nda-template") {
    return NextResponse.json({ error: "Gate 1 is required before the template can be downloaded." }, { status: 404 })
  }

  const supabase = createAdminClient()
  const { data: signedUrl, error: signedUrlError } = await supabase.storage
    .from(template.storageBucket)
    .createSignedUrl(template.storagePath, 60, { download: true })
  if (signedUrlError) return NextResponse.json({ error: signedUrlError.message }, { status: 500 })
  return privateRedirect(signedUrl.signedUrl)
}
