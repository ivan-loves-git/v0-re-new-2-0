import "server-only";

import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseUsage } from "openai/resources/responses/responses";
import { getOpportunity } from "@/lib/actions/opportunities";
import {
  listOpportunityMatchCandidates,
  listOpportunityMatches,
} from "@/lib/actions/opportunity-matches";
import { WAVE_AI_MODEL, WAVE_AI_REASONING_EFFORT } from "@/lib/ai/config";
import {
  waveAiNextActionResponseSchema,
  type WaveAiNextAction,
} from "@/lib/ai/next-action-contract";
import { getWaveAiOpenAiClient } from "@/lib/ai/openai-client";
import { findIncompleteOpportunityDataFields } from "@/lib/utils/opportunity-incomplete-data";

const actionMeta = {
  resolve_source_review: {
    title: "Resolve source review",
    label: "Open source review",
    href: (id: string) => `/opportunities/${id}`,
  },
  complete_opportunity_profile: {
    title: "Complete the opportunity profile",
    label: "Open edit",
    href: (id: string) => `/opportunities/${id}?tab=edit`,
  },
} as const;

export type WaveAiNextActionView = WaveAiNextAction & {
  title: string;
  label: string;
  href: string;
  facts: string[];
};

export async function generateWaveAiNextActions(input: {
  opportunityId: string;
  safetyIdentifier: string;
}): Promise<{
  recommendations: WaveAiNextActionView[];
  usage: ResponseUsage | undefined;
}> {
  const [opportunity, matches, candidates] = await Promise.all([
    getOpportunity(input.opportunityId),
    listOpportunityMatches(input.opportunityId),
    listOpportunityMatchCandidates(input.opportunityId),
  ]);
  if (!opportunity) throw new Error("Opportunity not found");
  const activePursuit = matches.some(
    (match) => match.status === "active_pursuit",
  );
  const form = new FormData();
  for (const key of ["revenue_meur", "ebitda_keur", "headcount_range"])
    if (opportunity[key as keyof typeof opportunity] != null)
      form.set(key, "present");
  if (opportunity.source?.firm_name) form.set("source_firm_name", "present");
  if (
    (opportunity.source_contacts?.length ?? 0) > 0 ||
    (opportunity.office_contacts?.length ?? 0) > 0
  )
    form.set("source_contact_ids", "present");
  const incomplete = findIncompleteOpportunityDataFields(form);
  const allowedActions = [
    ...(opportunity.source_review_required ? ["resolve_source_review"] : []),
    ...(incomplete.length > 0 ? ["complete_opportunity_profile"] : []),
  ] as const;
  const facts: Record<string, string> = {
    status: `Recorded opportunity status: ${opportunity.status}.`,
    source_review: opportunity.source_review_required
      ? "Recorded source review is required."
      : "Recorded source review is not required.",
    completeness: incomplete.length
      ? `Profile fields requiring staff review: ${incomplete.join(", ")}.`
      : "Recorded profile completeness is sufficient for the existing checks.",
    matches: `Recorded match count: ${matches.length}; candidate count: ${candidates.length}; active pursuit: ${activePursuit ? "yes" : "no"}.`,
    as_of: `Projection generated at ${new Date().toISOString()}.`,
    date_precision: opportunity.date_added
      ? `Recorded opportunity added date precision: ${opportunity.date_added_precision ?? "unknown"}.`
      : "Recorded opportunity added date precision is unknown.",
    freshness: opportunity.date_added
      ? `Opportunity age bucket: ${Math.floor((Date.now() - new Date(opportunity.date_added).getTime()) / 86_400_000) > 90 ? "over_90_days" : "under_90_days"}.`
      : "Opportunity age bucket is unknown.",
    readiness: activePursuit
      ? "Readiness gate: an active pursuit exists."
      : "Readiness gate: no active pursuit exists.",
    interaction:
      "Last canonical interaction age and next-due bucket are unknown in this bounded v1 projection.",
  };
  if (allowedActions.length === 0)
    return { recommendations: [], usage: undefined };
  const response = await getWaveAiOpenAiClient().responses.parse({
    model: WAVE_AI_MODEL,
    reasoning: { effort: WAVE_AI_REASONING_EFFORT, context: "current_turn" },
    store: false,
    parallel_tool_calls: false,
    instructions:
      "You are WAVE AI. Recommend only the supplied existing actions. Do not make a business change, return URLs, IDs, or unseen facts. Keep recorded facts, inference, and unknowns distinct.",
    input: `Allowed actions: ${allowedActions.join(", ")}\n\nRecorded facts:\n${Object.entries(
      facts,
    )
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n")}`,
    safety_identifier: input.safetyIdentifier.slice(0, 64),
    max_output_tokens: 1200,
    text: {
      format: zodTextFormat(
        waveAiNextActionResponseSchema,
        "wave_ai_next_action_v1",
      ),
      verbosity: "low",
    },
  });
  const parsed = waveAiNextActionResponseSchema.safeParse(
    response.output_parsed,
  );
  if (!parsed.success)
    throw new SyntaxError("WAVE AI output did not match the schema");
  for (const item of parsed.data.recommendations) {
    if (
      !allowedActions.includes(item.actionId) ||
      !item.factRefs.every((ref) => ref in facts)
    )
      throw new SyntaxError("WAVE AI returned an unsupported recommendation");
  }
  const recommendations = parsed.data.recommendations.map((item) => ({
    ...item,
    ...actionMeta[item.actionId],
    href: actionMeta[item.actionId].href(input.opportunityId),
    facts: item.factRefs.map((ref) => facts[ref]),
  }));
  return { recommendations, usage: response.usage };
}
