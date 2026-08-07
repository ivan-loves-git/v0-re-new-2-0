import { describe, expect, it } from "vitest";
import {
  waveAiNextActionRequestSchema,
  waveAiNextActionResponseSchema,
} from "@/lib/ai/next-action-contract";

const recommendation = {
  rank: 1 as const,
  actionId: "complete_opportunity_profile",
  rationale: "Recorded profile fields need review.",
  confidence: "high" as const,
  factRefs: ["completeness"],
  unknowns: [],
};

describe("WAVE AI next-action contract", () => {
  it("accepts only a UUID request", () => {
    expect(
      waveAiNextActionRequestSchema.safeParse({
        opportunityId: "0d72d223-8a24-4ebc-8c3a-5db11ebd92e1",
      }).success,
    ).toBe(true);
    expect(
      waveAiNextActionRequestSchema.safeParse({
        opportunityId: "not-an-id",
        extra: true,
      }).success,
    ).toBe(false);
  });

  it("rejects repeated actions and provider-controlled identifiers", () => {
    expect(
      waveAiNextActionResponseSchema.safeParse({
        recommendations: [recommendation, { ...recommendation, rank: 2 }],
      }).success,
    ).toBe(false);
    expect(
      waveAiNextActionResponseSchema.safeParse({
        recommendations: [{ ...recommendation, url: "/unsafe" }],
      }).success,
    ).toBe(false);
  });
});
