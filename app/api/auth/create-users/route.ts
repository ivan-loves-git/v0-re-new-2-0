import { NextResponse } from "next/server"

/**
 * Retired bootstrap endpoint. WAVE is invitation-only and user provisioning is
 * handled by the staff portal-access workflow.
 */

export async function POST() {
  return NextResponse.json(
    { error: "User provisioning is available only through staff invitations." },
    { status: 410 },
  )
}
