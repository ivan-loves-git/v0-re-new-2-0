import { NextResponse } from "next/server"
import { env } from "@/lib/env"
import { runPendingOpportunityPauseNotifications } from "@/lib/email/opportunity-pause-delivery"
import { startCriticalOperation } from "@/lib/observability/critical-operation"

export const maxDuration = 60

export async function GET(request: Request) {
  if (!env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const trace = startCriticalOperation("cron.opportunity_pause_notifications")
  try {
    const result = await runPendingOpportunityPauseNotifications()
    if (result.failed > 0) trace.failure("provider_unavailable")
    else trace.success()
    return NextResponse.json(result)
  } catch {
    trace.failure("persistence_failed")
    return NextResponse.json({ error: "Pause notification recovery failed" }, { status: 500 })
  }
}
