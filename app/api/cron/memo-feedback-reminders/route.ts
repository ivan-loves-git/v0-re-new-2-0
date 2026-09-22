import { NextResponse } from "next/server"
import { env } from "@/lib/env"
import { runPendingMemoFeedbackReminders } from "@/lib/email/memo-feedback-reminder-delivery"
import { startCriticalOperation } from "@/lib/observability/critical-operation"

export const maxDuration = 60

/** Due eligibility is checked at the daily run, not promised at the exact
 * minute. New template keys are inactive until staff chooses to activate. */
export async function GET(request: Request) {
  const secret = env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const trace = startCriticalOperation("cron.memo_feedback_reminders")
  try {
    const result = await runPendingMemoFeedbackReminders(4, 40_000)
    if (result.reviewRequired > 0 || result.budgetDeferred > 0) trace.failure("provider_pending")
    else if (result.failed > 0) trace.failure("provider_unavailable")
    else trace.success()
    return NextResponse.json(result)
  } catch {
    trace.failure("persistence_failed")
    return NextResponse.json({ error: "Memo feedback reminder recovery failed" }, { status: 500 })
  }
}
