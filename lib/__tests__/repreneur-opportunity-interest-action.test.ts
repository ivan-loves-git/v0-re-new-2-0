import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  redirect: vi.fn(),
  requirePortalAccess: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/access-control", () => ({
  requirePortalAccess: mocks.requirePortalAccess,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

import { markMyOpportunityInterested } from "@/lib/actions/repreneur-opportunity-responses";

const MATCH_ID = "match-001";
const OPPORTUNITY_ID = "opportunity-001";
const REPRENEUR_ID = "repreneur-001";

function mockSuccessfulInterestUpdates(
  statuses: Array<"proposed" | "interested" | "declined" | "dropped">,
) {
  const maybeSingle = vi.fn();
  for (const status of statuses) {
    maybeSingle.mockResolvedValueOnce({
      data: { id: MATCH_ID, opportunity_id: OPPORTUNITY_ID, status, opportunity: { status: "active", is_demo: false }, repreneur: { is_demo: false } },
      error: null,
    });
  }

  const selectForRepreneur = vi.fn(() => ({ maybeSingle }));
  const selectForMatch = vi.fn(() => ({ eq: selectForRepreneur }));
  const select = vi.fn(() => ({ eq: selectForMatch }));

  const from = vi.fn(() => ({ select }));
  const rpc = vi.fn().mockResolvedValue({
    data: [{ match_id: MATCH_ID, opportunity_id: OPPORTUNITY_ID, status: "interested" }],
    error: null,
  });

  mocks.createAdminClient.mockReturnValue({ from, rpc });

  return {
    from,
    selectForMatch,
    selectForRepreneur,
    rpc,
  };
}

describe("repreneur opportunity interest response", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePortalAccess.mockResolvedValue({ repreneurId: REPRENEUR_ID });
  });

  it("persists the owned proposed match and keeps a repeated interest response idempotent", async () => {
    const {
      from,
      selectForMatch,
      selectForRepreneur,
      rpc,
    } = mockSuccessfulInterestUpdates(["proposed", "interested"]);

    await markMyOpportunityInterested(MATCH_ID);
    await markMyOpportunityInterested(MATCH_ID);

    const expectedRpc = {
      p_match_id: MATCH_ID,
      p_repreneur_id: REPRENEUR_ID,
      p_status: "interested",
      p_decline_reason_categories: [],
      p_decline_reason_text: null,
    };

    expect(from).toHaveBeenCalledTimes(2);
    expect(from).toHaveBeenNthCalledWith(1, "opportunity_matches");
    expect(from).toHaveBeenNthCalledWith(2, "opportunity_matches");
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenNthCalledWith(1, "update_repreneur_opportunity_response", expectedRpc);
    expect(rpc).toHaveBeenNthCalledWith(2, "update_repreneur_opportunity_response", expectedRpc);
    expect(selectForMatch).toHaveBeenNthCalledWith(1, "id", MATCH_ID);
    expect(selectForMatch).toHaveBeenNthCalledWith(2, "id", MATCH_ID);
    expect(selectForRepreneur).toHaveBeenNthCalledWith(
      1,
      "repreneur_id",
      REPRENEUR_ID,
    );
    expect(selectForRepreneur).toHaveBeenNthCalledWith(
      2,
      "repreneur_id",
      REPRENEUR_ID,
    );
    expect(mocks.redirect).toHaveBeenNthCalledWith(1, "/portal/deals");
    expect(mocks.redirect).toHaveBeenNthCalledWith(2, "/portal/deals");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      `/portal/deals/${MATCH_ID}`,
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      `/opportunities/${OPPORTUNITY_ID}`,
    );
  });

  it.each(["declined", "dropped"] as const)("reconsiders an owned %s match through the atomic interest boundary", async (status) => {
    const { rpc } = mockSuccessfulInterestUpdates([status]);

    await markMyOpportunityInterested(MATCH_ID);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("express_opportunity_interest", {
      p_opportunity_id: OPPORTUNITY_ID,
      p_repreneur_id: REPRENEUR_ID,
      p_actor_id: "",
    });
    expect(mocks.redirect).toHaveBeenCalledWith("/portal/deals");
  });

  it("blocks a REAL repreneur from a DEMO opportunity before the response RPC", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: MATCH_ID,
        opportunity_id: OPPORTUNITY_ID,
        status: "proposed",
        opportunity: { status: "active", is_demo: true },
        repreneur: { is_demo: false },
      },
      error: null,
    });
    const eqForRepreneur = vi.fn(() => ({ maybeSingle }));
    const eqForMatch = vi.fn(() => ({ eq: eqForRepreneur }));
    const select = vi.fn(() => ({ eq: eqForMatch }));
    const rpc = vi.fn();
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => ({ select })), rpc });

    await expect(markMyOpportunityInterested(MATCH_ID)).rejects.toThrow(
      "This opportunity is no longer available for your response.",
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not create a database client when the session lacks a linked repreneur", async () => {
    mocks.requirePortalAccess.mockResolvedValue({ repreneurId: null });

    await expect(markMyOpportunityInterested(MATCH_ID)).rejects.toThrow(
      "No linked repreneur profile",
    );

    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
