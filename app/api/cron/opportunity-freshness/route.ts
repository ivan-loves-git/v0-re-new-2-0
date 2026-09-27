import { NextResponse } from "next/server"
import { env } from "@/lib/env"
import { runOpportunityFreshnessDrafts } from "@/lib/opportunity-freshness-drafts"

export const maxDuration = 60

export async function GET(request: Request) {
  if (!env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    return NextResponse.json(await runOpportunityFreshnessDrafts(30))
  } catch {
    return NextResponse.json({ error: "Freshness drafts were not safely prepared" }, { status: 500 })
  }
}
