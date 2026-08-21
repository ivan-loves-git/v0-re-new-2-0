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
  statuses: Array<"proposed" | "interested">,
) {
  const maybeSingle = vi.fn();
  for (const status of statuses) {
    maybeSingle.mockResolvedValueOnce({
      data: { id: MATCH_ID, opportunity_id: OPPORTUNITY_ID, status, opportunity: { status: "active" } },
      error: null,
    });
  }

  const selectForRepreneur = vi.fn(() => ({ maybeSingle }));
  const selectForMatch = vi.fn(() => ({ eq: selectForRepreneur }));
  const select = vi.fn(() => ({ eq: selectForMatch }));

  const updateForRepreneur = vi.fn().mockResolvedValue({ error: null });
  const updateForMatch = vi.fn(() => ({ eq: updateForRepreneur }));
  const update = vi.fn(() => ({ eq: updateForMatch }));

  let fromCall = 0;
  const from = vi.fn(() => {
    fromCall += 1;
    return fromCall % 2 === 1 ? { select } : { update };
  });

  mocks.createAdminClient.mockReturnValue({ from });

  return {
    from,
    selectForMatch,
    selectForRepreneur,
    update,
    updateForMatch,
    updateForRepreneur,
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
      update,
      updateForMatch,
      updateForRepreneur,
    } = mockSuccessfulInterestUpdates(["proposed", "interested"]);

    await markMyOpportunityInterested(MATCH_ID);
    await markMyOpportunityInterested(MATCH_ID);

    const expectedUpdate = {
      status: "interested",
      decline_reason_categories: [],
      decline_reason_text: null,
      reviewed_by: null,
      reviewed_at: null,
    };

    expect(from).toHaveBeenCalledTimes(4);
    expect(from).toHaveBeenNthCalledWith(1, "opportunity_matches");
    expect(from).toHaveBeenNthCalledWith(2, "opportunity_matches");
    expect(from).toHaveBeenNthCalledWith(3, "opportunity_matches");
    expect(from).toHaveBeenNthCalledWith(4, "opportunity_matches");
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenNthCalledWith(1, expectedUpdate);
    expect(update).toHaveBeenNthCalledWith(2, expectedUpdate);
    expect(updateForMatch).toHaveBeenNthCalledWith(1, "id", MATCH_ID);
    expect(updateForMatch).toHaveBeenNthCalledWith(2, "id", MATCH_ID);
    expect(updateForRepreneur).toHaveBeenNthCalledWith(
      1,
      "repreneur_id",
      REPRENEUR_ID,
    );
    expect(updateForRepreneur).toHaveBeenNthCalledWith(
      2,
      "repreneur_id",
      REPRENEUR_ID,
    );
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

  it("does not create a database client when the session lacks a linked repreneur", async () => {
    mocks.requirePortalAccess.mockResolvedValue({ repreneurId: null });

    await expect(markMyOpportunityInterested(MATCH_ID)).rejects.toThrow(
      "No linked repreneur profile",
    );

    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
