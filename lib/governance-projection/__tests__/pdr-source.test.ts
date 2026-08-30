import { describe, expect, it } from "vitest";
import { governanceIssueNumberFromPdrProvenance, verifiedPdrRequestByGovernanceIssue } from "@/lib/governance-projection/pdr-source";

describe("verified PDR-to-governance links", () => {
  it("accepts only exact canonical governance references", () => {
    expect(governanceIssueNumberFromPdrProvenance("https://github.com/re-new-team/renew-governance/issues/42")).toBe(42);
    expect(governanceIssueNumberFromPdrProvenance("github:re-new-team/renew-governance#42")).toBe(42);
    expect(governanceIssueNumberFromPdrProvenance("Please see #42")).toBeNull();
    expect(governanceIssueNumberFromPdrProvenance("https://github.com/other/repo/issues/42")).toBeNull();
  });

  it("does not invent a second PDR source for one governance issue", () => {
    const request = (id: string) => ({ id, intakeProvenance: "github:re-new-team/renew-governance#42" }) as never;
    const index = verifiedPdrRequestByGovernanceIssue([request("first"), request("second")]);
    expect(index.get(42)?.id).toBe("first");
  });
});
