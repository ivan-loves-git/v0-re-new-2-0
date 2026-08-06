import { NextResponse } from "next/server"
import { getCurrentUserAccess } from "@/lib/access-control"
import { WAVE_AI_MODEL } from "@/lib/ai/config"
import { waveAiEmailDraftRequestSchema } from "@/lib/ai/email-contract"
import { generateWaveAiEmailDraft } from "@/lib/ai/email-drafting"
import { classifyWaveAiError, publicWaveAiError } from "@/lib/ai/errors"
import { completeWaveAiRun, failWaveAiRun, startWaveAiRun } from "@/lib/ai/ledger"
import { estimateWaveAiCostUsd, normalizeWaveAiUsage } from "@/lib/ai/usage"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const access = await getCurrentUserAccess()
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (access.role !== "staff") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const rawBody = await request.json().catch(() => null)
  const parsed = waveAiEmailDraftRequestSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: publicWaveAiError("invalid_request").message },
      { status: 400 },
    )
  }

  const startedAt = Date.now()
  let run: Awaited<ReturnType<typeof startWaveAiRun>> | null = null

  try {
    run = await startWaveAiRun({
      actorUserId: access.user.id,
      feature: "email_draft",
      workflow: "repreneur_email_draft",
      surface: "/tools/wave-ai",
    })
    const result = await generateWaveAiEmailDraft({
      request: parsed.data,
      safetyIdentifier: access.user.id,
    })
    const usage = normalizeWaveAiUsage(result.usage)
    const estimatedCostUsd = estimateWaveAiCostUsd(usage)
    await completeWaveAiRun({
      generationId: run.generationId,
      usage,
      estimatedCostUsd,
      latencyMs: Date.now() - startedAt,
    })

    return NextResponse.json({
      ...result.draft,
      generationId: run.generationId,
      traceId: run.traceId,
      model: WAVE_AI_MODEL,
    })
  } catch (error) {
    const code = classifyWaveAiError(error)
    if (run) {
      await failWaveAiRun({
        generationId: run.generationId,
        code,
        latencyMs: Date.now() - startedAt,
      })
    }
    console.error("WAVE AI generation failed", {
      code,
      traceId: run?.traceId ?? "not_started",
    })
    const safe = publicWaveAiError(code)
    return NextResponse.json({ error: safe.message }, { status: safe.status })
  }
}

