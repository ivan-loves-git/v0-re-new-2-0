import { NextResponse } from "next/server"
import { getCurrentUserAccessFromHeaders } from "@/lib/access-control"
import { waveAiGenerationEventSchema } from "@/lib/ai/email-contract"
import { recordWaveAiGenerationEvent } from "@/lib/ai/ledger"

export async function POST(request: Request) {
  const access = await getCurrentUserAccessFromHeaders(request.headers)
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (access.role !== "staff") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const parsed = waveAiGenerationEventSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid WAVE AI event." }, { status: 400 })
  }

  try {
    await recordWaveAiGenerationEvent({
      actorUserId: access.user.id,
      generationId: parsed.data.generationId,
      eventType: parsed.data.eventType,
      reasonCode: parsed.data.reasonCode,
      actionKey: parsed.data.actionKey,
    })
    return NextResponse.json({ success: true })
  } catch {
    console.error("WAVE AI lifecycle event could not be recorded")
    return NextResponse.json({ error: "WAVE AI usage logging is unavailable." }, { status: 503 })
  }
}
