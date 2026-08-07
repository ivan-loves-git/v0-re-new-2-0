import { describe, expect, it, vi } from "vitest";

vi.stubEnv("BETTER_AUTH_SECRET", "test-secret");
import {
  createWaveAiOutcomeToken,
  validateWaveAiOutcomeToken,
} from "@/lib/ai/next-action-outcome";

const base = {
  generationId: "0d72d223-8a24-4ebc-8c3a-5db11ebd92e1",
  userId: "staff-a",
  opportunityId: "opportunity-a",
  action: "complete_opportunity_profile" as const,
};

describe("WAVE AI outcome correlation", () => {
  it("accepts only its exact actor target and action", () => {
    const token = createWaveAiOutcomeToken(base, 100);
    expect(
      validateWaveAiOutcomeToken(
        token,
        {
          userId: base.userId,
          opportunityId: base.opportunityId,
          action: base.action,
        },
        101,
      ),
    ).toBe(base.generationId);
    expect(
      validateWaveAiOutcomeToken(
        token,
        {
          userId: "staff-b",
          opportunityId: base.opportunityId,
          action: base.action,
        },
        101,
      ),
    ).toBeNull();
    expect(
      validateWaveAiOutcomeToken(
        token,
        {
          userId: base.userId,
          opportunityId: "opportunity-b",
          action: base.action,
        },
        101,
      ),
    ).toBeNull();
    expect(
      validateWaveAiOutcomeToken(
        token,
        {
          userId: base.userId,
          opportunityId: base.opportunityId,
          action: "resolve_source_review",
        },
        101,
      ),
    ).toBeNull();
  });

  it("rejects forged and expired tokens", () => {
    const token = createWaveAiOutcomeToken(base, 100);
    expect(
      validateWaveAiOutcomeToken(
        `${token}x`,
        {
          userId: base.userId,
          opportunityId: base.opportunityId,
          action: base.action,
        },
        101,
      ),
    ).toBeNull();
    expect(
      validateWaveAiOutcomeToken(
        token,
        {
          userId: base.userId,
          opportunityId: base.opportunityId,
          action: base.action,
        },
        900_101,
      ),
    ).toBeNull();
  });
});
