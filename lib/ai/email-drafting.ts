import "server-only"

import { zodTextFormat } from "openai/helpers/zod"
import type { ResponseUsage } from "openai/resources/responses/responses"
import {
  WAVE_AI_MODEL,
  WAVE_AI_REASONING_EFFORT,
} from "@/lib/ai/config"
import {
  waveAiEmailDraftSchema,
  type WaveAiEmailDraft,
  type WaveAiEmailDraftRequest,
} from "@/lib/ai/email-contract"
import { WaveAiInvalidRequestError } from "@/lib/ai/errors"
import { getWaveAiEmailTemplate } from "@/lib/ai/email-templates"
import { getWaveAiOpenAiClient } from "@/lib/ai/openai-client"
import { createAdminClient } from "@/lib/supabase/admin"

interface RepreneurProjection {
  first_name: string | null
  journey_stage: string | null
  tier1_score: number | null
  who_score: number | null
  when_score: number | null
}

async function loadTemplateInstruction(templateId: string) {
  const builtIn = getWaveAiEmailTemplate(templateId)
  if (builtIn) return { name: builtIn.name, instruction: builtIn.instruction }

  const { data, error } = await createAdminClient()
    .from("wavy_templates")
    .select("name, description, channel")
    .eq("id", templateId)
    .eq("channel", "email")
    .maybeSingle()

  if (error) throw new Error("WAVE AI template lookup failed")
  if (!data) throw new WaveAiInvalidRequestError()
  return {
    name: String(data.name).slice(0, 120),
    instruction: String(data.description).slice(0, 1200),
  }
}

async function loadRepreneurProjection(repreneurId: string) {
  const { data, error } = await createAdminClient()
    .from("repreneurs")
    .select("first_name, journey_stage, tier1_score, who_score, when_score")
    .eq("id", repreneurId)
    .maybeSingle()

  if (error) throw new Error("WAVE AI repreneur lookup failed")
  if (!data) throw new WaveAiInvalidRequestError()
  return data as RepreneurProjection
}

function promptForEmail(
  request: WaveAiEmailDraftRequest,
  repreneur: RepreneurProjection,
  template: { name: string; instruction: string },
) {
  const language = request.language === "fr" ? "French" : "English"
  const whoScore = repreneur.who_score ?? repreneur.tier1_score
  const facts = [
    `Recipient first name: ${repreneur.first_name?.trim() || "unknown"}`,
    `Recorded journey stage: ${repreneur.journey_stage?.trim() || "unknown"}`,
    `Recorded WHO score: ${whoScore ?? "unknown"}`,
    `Recorded WHEN score: ${repreneur.when_score ?? "unknown"}`,
  ].join("\n")

  return `Draft one Re-New email in ${language}.

Template: ${template.name}
Template instruction: ${template.instruction}

Recorded facts:
${facts}

Staff goal: ${request.customInstructions?.trim() || "Use the template instruction and recorded facts."}

Rules:
- Use only the recorded facts above. Never invent dates, meetings, offers, opportunity details, reasons, promises or next steps.
- If a fact needed by the staff goal is unknown, omit the claim and add a short warning.
- Keep facts, inference and unknowns distinct. Put any unavoidable inference in assumptions.
- Write plain text with no Markdown, emoji or fake quotation.
- Include a natural greeting and end as "The Re-New Team".
- Return only the structured fields requested.`
}

const instructions = `You are WAVE AI, a staff-only writing assistant for Re-New.
Create editable drafts; never claim that an email was sent or that a business action occurred.
Protect confidentiality and follow the supplied facts and output schema exactly.`

export async function generateWaveAiEmailDraft(input: {
  request: WaveAiEmailDraftRequest
  safetyIdentifier: string
}): Promise<{ draft: WaveAiEmailDraft; usage: ResponseUsage | undefined }> {
  const [repreneur, template] = await Promise.all([
    loadRepreneurProjection(input.request.repreneurId),
    loadTemplateInstruction(input.request.templateId),
  ])
  const client = getWaveAiOpenAiClient()
  const response = await client.responses.parse({
    model: WAVE_AI_MODEL,
    reasoning: {
      effort: WAVE_AI_REASONING_EFFORT,
      context: "current_turn",
    },
    store: false,
    parallel_tool_calls: false,
    instructions,
    input: promptForEmail(input.request, repreneur, template),
    safety_identifier: input.safetyIdentifier.slice(0, 64),
    max_output_tokens: 4000,
    text: {
      format: zodTextFormat(waveAiEmailDraftSchema, "wave_ai_email_draft"),
      verbosity: "low",
    },
  })

  if (!response.output_parsed) throw new SyntaxError("WAVE AI output did not match the schema")
  return { draft: response.output_parsed, usage: response.usage }
}
