import { describe, expect, it } from "vitest";

import { parseGovernanceMarker } from "@/lib/governance-projection/marker";

const body = (yaml: string) => `<!-- renew-governance\n${yaml}\n-->`;

describe("GitHub governance marker parser", () => {
  it("accepts the live unquoted placement decision and array approval keys", () => {
    expect(parseGovernanceMarker(body("schema: 1\nkind: decision\nplacement_decision: #36\napproval_keys:\n  - strategy-registry:2026-08-30-initial-1"))).toEqual({
      kind: "Decision", strategy_revision: undefined, goal_id: undefined, milestone_id: undefined,
      kpi_ids: undefined, guardrail_ids: undefined, placement_decision: 36,
      approval_keys: ["strategy-registry:2026-08-30-initial-1"], approved_by: undefined,
      decision_state: undefined, decision_key: undefined, strategic_placement: undefined,
    });
  });

  it("rejects ambiguous and unsupported metadata", () => {
    expect(() => parseGovernanceMarker(body("schema: 1\napproval_keys: one,two"))).toThrow("string array");
    expect(() => parseGovernanceMarker(body("schema: 1\nkind: something-else"))).toThrow("kind is unsupported");
    expect(() => parseGovernanceMarker(body("schema: 1\nunknown: value"))).toThrow("unknown governance marker field");
    expect(() => parseGovernanceMarker(body("schema: 1\nkind:\n  nested: value"))).toThrow("non-empty string");
  });
});
