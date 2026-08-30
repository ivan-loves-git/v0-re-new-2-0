import { describe, expect, it, vi } from "vitest";

const maybeSingle = vi.fn();
const select = vi.fn(() => ({ eq: () => ({ maybeSingle }) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ select }) }),
}));

describe("current governance projection reader", () => {
  it("returns explicit unavailable state without a snapshot", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const { readCurrentGovernanceProjection } =
      await import("@/lib/governance-projection/server");
    await expect(readCurrentGovernanceProjection()).resolves.toEqual({
      state: "unavailable",
      reason: "no_snapshot",
    });
  });

  it("does not fall back when the protected read fails", async () => {
    maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "unavailable" },
    });
    const { readCurrentGovernanceProjection } =
      await import("@/lib/governance-projection/server");
    await expect(readCurrentGovernanceProjection()).resolves.toEqual({
      state: "unavailable",
      reason: "read_failed",
    });
  });
});
