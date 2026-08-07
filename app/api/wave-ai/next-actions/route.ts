import { NextResponse, after } from "next/server";
import { getCurrentUserAccessFromHeaders } from "@/lib/access-control";
import { waveAiNextActionRequestSchema } from "@/lib/ai/next-action-contract";
import { generateWaveAiNextActions } from "@/lib/ai/next-action";
import {
  startWaveAiRun,
  completeWaveAiRun,
  failWaveAiRun,
} from "@/lib/ai/ledger";
import { normalizeWaveAiUsage, estimateWaveAiCostUsd } from "@/lib/ai/usage";
import { classifyWaveAiError, publicWaveAiError } from "@/lib/ai/errors";
import { getOpaqueTelemetryUserId } from "@/lib/telemetry/identity";
import { captureWaveAiGeneration } from "@/lib/telemetry/server";
import { createWaveAiOutcomeToken } from "@/lib/ai/next-action-outcome";
import { WAVE_AI_NEXT_ACTION_PROMPT_VERSION } from "@/lib/ai/config";

export async function POST(request: Request) {
  const access = await getCurrentUserAccessFromHeaders(request.headers);
  if (!access)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "staff")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = waveAiNextActionRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid WAVE AI request." },
      { status: 400 },
    );
  const startedAt = Date.now();
  const telemetryUserId = getOpaqueTelemetryUserId(access.user.id);
  let run: Awaited<ReturnType<typeof startWaveAiRun>> | null = null;
  try {
    run = await startWaveAiRun({
      actorUserId: access.user.id,
      feature: "next_action",
      workflow: "opportunity_next_action",
      surface: "/opportunities/[id]",
      promptVersion: "next-action-v1",
      outputSchemaVersion: "next-action-v1",
    });
    const result = await generateWaveAiNextActions({
      opportunityId: parsed.data.opportunityId,
      safetyIdentifier: access.user.id,
    });
    const usage = normalizeWaveAiUsage(result.usage);
    const latencyMs = Date.now() - startedAt;
    const estimatedCostUsd = estimateWaveAiCostUsd(usage);
    await completeWaveAiRun({
      generationId: run.generationId,
      usage,
      estimatedCostUsd,
      latencyMs,
    });
    after(() =>
      captureWaveAiGeneration({
        distinctId: telemetryUserId,
        generationId: run!.generationId,
        traceId: run!.traceId,
        role: "staff",
        feature: "next_action",
        promptVersion: WAVE_AI_NEXT_ACTION_PROMPT_VERSION,
        status: "succeeded",
        latencyMs,
        inputTokens: usage.inputTokens,
        cachedInputTokens: usage.cachedInputTokens,
        cacheWriteTokens: usage.cacheWriteTokens,
        outputTokens: usage.outputTokens,
        reasoningTokens: usage.reasoningTokens,
        estimatedCostUsd,
      }),
    );
    return NextResponse.json({
      recommendations: result.recommendations.map((recommendation) => ({
        ...recommendation,
        outcomeToken: createWaveAiOutcomeToken({
          generationId: run!.generationId,
          userId: access.user.id,
          opportunityId: parsed.data.opportunityId,
          action: recommendation.actionId,
        }),
      })),
      generationId: run.generationId,
    });
  } catch (error) {
    const code = classifyWaveAiError(error);
    if (run) {
      const failedRun = run;
      const latencyMs = Date.now() - startedAt;
      await failWaveAiRun({
        generationId: failedRun.generationId,
        code,
        latencyMs,
      });
      after(() =>
        captureWaveAiGeneration({
          distinctId: telemetryUserId,
          generationId: failedRun.generationId,
          traceId: failedRun.traceId,
          role: "staff",
          feature: "next_action",
          promptVersion: WAVE_AI_NEXT_ACTION_PROMPT_VERSION,
          status: "failed",
          latencyMs,
          errorCode: code,
        }),
      );
    }
    return NextResponse.json(
      { error: publicWaveAiError(code).message },
      { status: publicWaveAiError(code).status },
    );
  }
}
