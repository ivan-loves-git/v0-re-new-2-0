import { NextResponse } from "next/server"
import { env } from "@/lib/env"
import { runDueDiscoveryDigests } from "@/lib/email/discovery-digest-delivery"
import { startCriticalOperation } from "@/lib/observability/critical-operation"

export const maxDuration = 60

/** Daily bounded, authenticated job. The catalogue stays OFF until staff act. */
export async function GET(request: Request) {
  const secret = env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const trace = startCriticalOperation("cron.discovery_digest")
  try {
    const result = await runDueDiscoveryDigests(4, 40_000)
    if (result.reviewRequired > 0 || result.windowReviewBacklog > 0 || result.uncertain > 0 || result.failed > 0) {
      trace.failure("provider_pending")
    } else {
      trace.success()
    }
    return NextResponse.json(result)
  } catch {
    trace.failure("persistence_failed")
    return NextResponse.json({ error: "Discovery digest recovery failed" }, { status: 500 })
  }
}
