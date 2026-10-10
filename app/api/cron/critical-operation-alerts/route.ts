import { NextResponse } from "next/server"
import { env } from "@/lib/env"
import { runCriticalOperationAlertCheck } from "@/lib/observability/critical-operation-alert"

export const maxDuration = 60

export async function GET(request: Request) {
  if (!env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  // Alert maintenance must not recursively report its own failures through
  // the incident pipeline. The runner has a bounded independent fallback.
  const result = await runCriticalOperationAlertCheck()
  return NextResponse.json(result, { status: result.unavailable ? 503 : 200 })
}
