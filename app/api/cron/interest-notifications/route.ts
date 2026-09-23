import { NextResponse } from "next/server"
import { env } from "@/lib/env"
import { runPendingInterestNotifications } from "@/lib/email/interest-notification-delivery"
import { startCriticalOperation } from "@/lib/observability/critical-operation"

export const maxDuration = 60

/** Isolated daily recovery; the legacy abandonment/interview cron is never
 * held behind an email provider request for this new family. */
export async function GET(request: Request) {
  const secret = env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const trace = startCriticalOperation("cron.interest_notifications")
  try {
    const result = await runPendingInterestNotifications(4, 40_000)
    if (result.reviewRequired > 0 || result.budgetDeferred > 0) trace.failure("provider_pending")
    else if (result.failed > 0) trace.failure("provider_unavailable")
    else trace.success()
    return NextResponse.json(result)
  } catch {
    trace.failure("persistence_failed")
    return NextResponse.json({ error: "Interest notification recovery failed" }, { status: 500 })
  }
}
