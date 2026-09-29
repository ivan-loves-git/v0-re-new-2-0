import { NextResponse } from "next/server"
import { env } from "@/lib/env"
import { runPendingRecommendationCycleNotifications } from "@/lib/email/recommendation-cycle-delivery"
import { startCriticalOperation } from "@/lib/observability/critical-operation"

export const maxDuration = 60

/** Daily due-eligibility, not exact-minute delivery. This isolated bounded
 * family cannot starve the legacy abandoned-form or other mail jobs. */
export async function GET(request: Request) {
  const secret = env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== "Bearer " + secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const trace = startCriticalOperation("cron.recommendation_cycles")
  try {
    const result = await runPendingRecommendationCycleNotifications(4, 40_000)
    if (result.reviewRequired > 0 || result.budgetDeferred > 0) trace.failure("provider_pending")
    else if (result.failed > 0) trace.failure("provider_unavailable")
    else trace.success()
    return NextResponse.json(result)
  } catch {
    trace.failure("persistence_failed")
    return NextResponse.json({ error: "Recommendation cycle recovery failed" }, { status: 500 })
  }
}
