import { describe, expect, it } from "vitest";
import { GOVERNANCE_PROJECTION_STALE_AFTER_MS, isGovernanceProjectionStale } from "@/lib/governance-projection/freshness";

describe("governance projection freshness", () => {
  it("uses a strict 24 hour boundary", () => {
    const start = Date.parse("2026-08-30T00:00:00.000Z");
    expect(isGovernanceProjectionStale("2026-08-30T00:00:00.000Z", start + GOVERNANCE_PROJECTION_STALE_AFTER_MS)).toBe(false);
    expect(isGovernanceProjectionStale("2026-08-30T00:00:00.000Z", start + GOVERNANCE_PROJECTION_STALE_AFTER_MS + 1)).toBe(true);
  });
});
