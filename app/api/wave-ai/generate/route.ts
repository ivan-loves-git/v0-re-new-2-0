import { NextResponse, after } from "next/server"
import { getCurrentUserAccess } from "@/lib/access-control"
import { WAVE_AI_MODEL, WAVE_AI_PROMPT_VERSION } from "@/lib/ai/config"
import { waveAiEmailDraftRequestSchema } from "@/lib/ai/email-contract"
import { generateWaveAiEmailDraft } from "@/lib/ai/email-drafting"
import { classifyWaveAiError, publicWaveAiError } from "@/lib/ai/errors"
import { completeWaveAiRun, failWaveAiRun, startWaveAiRun } from "@/lib/ai/ledger"
import { estimateWaveAiCostUsd, normalizeWaveAiUsage } from "@/lib/ai/usage"
import { captureWaveAiGeneration } from "@/lib/telemetry/server"

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
    const startedRun = await startWaveAiRun({
      actorUserId: access.user.id,
      feature: "email_draft",
      workflow: "repreneur_email_draft",
      surface: "/tools/wave-ai",
    })
    run = startedRun
    const result = await generateWaveAiEmailDraft({
      request: parsed.data,
      safetyIdentifier: access.user.id,
    })
    const usage = normalizeWaveAiUsage(result.usage)
    const estimatedCostUsd = estimateWaveAiCostUsd(usage)
    const latencyMs = Date.now() - startedAt
    await completeWaveAiRun({
      generationId: startedRun.generationId,
      usage,
      estimatedCostUsd,
      latencyMs,
    })
    after(async () => {
      await captureWaveAiGeneration({
        distinctId: access.user.id,
        generationId: startedRun.generationId,
        traceId: startedRun.traceId,
        role: "staff",
        feature: "email_draft",
        promptVersion: WAVE_AI_PROMPT_VERSION,
        status: "succeeded",
        latencyMs,
        inputTokens: usage.inputTokens,
        cachedInputTokens: usage.cachedInputTokens,
        cacheWriteTokens: usage.cacheWriteTokens,
        outputTokens: usage.outputTokens,
        reasoningTokens: usage.reasoningTokens,
        estimatedCostUsd,
      })
    })

    return NextResponse.json({
      ...result.draft,
      generationId: startedRun.generationId,
      traceId: startedRun.traceId,
      model: WAVE_AI_MODEL,
    })
  } catch (error) {
    const code = classifyWaveAiError(error)
    if (run) {
      const failedRun = run
      const latencyMs = Date.now() - startedAt
      await failWaveAiRun({
        generationId: failedRun.generationId,
        code,
        latencyMs,
      })
      after(async () => {
        await captureWaveAiGeneration({
          distinctId: access.user.id,
          generationId: failedRun.generationId,
          traceId: failedRun.traceId,
          role: "staff",
          feature: "email_draft",
          promptVersion: WAVE_AI_PROMPT_VERSION,
          status: "failed",
          latencyMs,
          errorCode: code,
        })
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
