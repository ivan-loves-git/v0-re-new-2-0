import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOpportunity: vi.fn(),
  listOpportunityMatches: vi.fn(),
  listOpportunityMatchCandidates: vi.fn(),
  parse: vi.fn(),
}));

vi.mock("@/lib/actions/opportunities", () => ({
  getOpportunity: mocks.getOpportunity,
}));
vi.mock("@/lib/actions/opportunity-matches", () => ({
  listOpportunityMatches: mocks.listOpportunityMatches,
  listOpportunityMatchCandidates: mocks.listOpportunityMatchCandidates,
}));
vi.mock("@/lib/ai/openai-client", () => ({
  getWaveAiOpenAiClient: () => ({ responses: { parse: mocks.parse } }),
}));

import { generateWaveAiNextActions } from "@/lib/ai/next-action";

const opportunity = {
  id: "00000000-0000-4000-8000-000000000001",
  reference: "OPP-1",
  status: "active",
  repreneur_exposure: "internal",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  date_added: "2026-01-01",
  date_added_precision: "month",
  source_review_required: true,
  source: { firm_name: "Hidden firm" },
  source_contacts: [],
  office_contacts: [],
  revenue_meur: null,
  ebitda_keur: null,
  headcount_range: null,
};

const validRecommendation = {
  recommendations: [
    {
      rank: 1,
      actionId: "resolve_source_review",
      rationale: "The recorded source review remains required.",
      confidence: "high",
      factRefs: [
        "source_review",
        "date_precision",
        "freshness",
        "matches",
        "readiness",
        "interaction",
      ],
      unknowns: ["The interaction timing is unknown."],
    },
  ],
};

describe("WAVE AI next-action projection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T12:00:00.000Z"));
    mocks.getOpportunity.mockResolvedValue(opportunity);
    mocks.listOpportunityMatches.mockResolvedValue([
      { status: "active_pursuit" },
    ]);
    mocks.listOpportunityMatchCandidates.mockResolvedValue([{}, {}]);
    mocks.parse.mockResolvedValue({
      output_parsed: validRecommendation,
      usage: undefined,
    });
  });

  afterEach(() => vi.useRealTimers());

  it("uses only the bounded projection with precise recorded and unknown facts", async () => {
    const result = await generateWaveAiNextActions({
      opportunityId: opportunity.id,
      safetyIdentifier: "staff-user",
    });

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0]).toMatchObject({
      actionId: "resolve_source_review",
      href: `/opportunities/${opportunity.id}`,
    });
    const request = mocks.parse.mock.calls[0][0];
    expect(request.input).toContain("Recorded source review is required.");
    expect(request.input).toContain(
      "Profile fields requiring staff review: revenue_meur, ebitda_keur, headcount_range, source_contact.",
    );
    expect(request.input).toContain(
      "Recorded opportunity added date precision: month.",
    );
    expect(request.input).toContain(
      "Opportunity age bucket is unknown because the source supplied only a month, not an exact day.",
    );
    expect(request.input).toContain("active pursuit: yes.");
    expect(request.input).toContain(
      "Readiness gate: an active pursuit exists.",
    );
    expect(request.input).toContain(
      "Last canonical interaction age and next-due bucket are unknown",
    );
    expect(request.input).not.toContain("Hidden firm");
    expect(request.input).not.toContain(opportunity.id);
  });

  it("does not call the provider when no existing action is eligible", async () => {
    mocks.getOpportunity.mockResolvedValue({
      ...opportunity,
      source_review_required: false,
      revenue_meur: 1,
      ebitda_keur: 1,
      headcount_range: "1-10",
      source_contacts: [{ contact_id: "present" }],
    });

    await expect(
      generateWaveAiNextActions({
        opportunityId: opportunity.id,
        safetyIdentifier: "staff-user",
      }),
    ).resolves.toEqual({ recommendations: [], usage: undefined });
    expect(mocks.parse).not.toHaveBeenCalled();
  });

  it.each([
    [
      "invented action",
      {
        ...validRecommendation,
        recommendations: [
          {
            ...validRecommendation.recommendations[0],
            actionId: "delete_opportunity",
          },
        ],
      },
    ],
    [
      "duplicate action",
      {
        recommendations: [
          validRecommendation.recommendations[0],
          { ...validRecommendation.recommendations[0], rank: 2 },
        ],
      },
    ],
    [
      "non-contiguous rank",
      {
        recommendations: [
          { ...validRecommendation.recommendations[0], rank: 2 },
        ],
      },
    ],
    [
      "unknown fact reference",
      {
        recommendations: [
          {
            ...validRecommendation.recommendations[0],
            factRefs: ["unseen_fact"],
          },
        ],
      },
    ],
    [
      "too many recommendations",
      {
        recommendations: [1, 2, 3, 4].map((rank) => ({
          ...validRecommendation.recommendations[0],
          rank,
          actionId:
            rank === 1
              ? "resolve_source_review"
              : "complete_opportunity_profile",
        })),
      },
    ],
    ["provider parse failure", null],
  ])("rejects %s wholesale", async (_label, output) => {
    mocks.parse.mockResolvedValue({ output_parsed: output, usage: undefined });
    await expect(
      generateWaveAiNextActions({
        opportunityId: opportunity.id,
        safetyIdentifier: "staff-user",
      }),
    ).rejects.toThrow(SyntaxError);
  });
});
