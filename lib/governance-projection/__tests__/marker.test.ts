import { describe, expect, it } from "vitest";

import { parseGovernanceMarker } from "@/lib/governance-projection/marker";

const body = (yaml: string) => `<!-- renew-governance\n${yaml}\n-->`;

describe("GitHub governance marker parser", () => {
  it("accepts the live unquoted placement decision and array approval keys", () => {
    expect(parseGovernanceMarker(body("schema: 1\nkind: decision\nplacement_decision: #36\napproval_keys:\n  - strategy-registry:2026-08-30-initial-1"))).toEqual({
      kind: "Decision", strategy_revision: undefined, goal_id: undefined, milestone_id: undefined,
      publication: undefined, bootstrap: undefined, pdr_reference: undefined, pdr_work_card_id: undefined, pdr_strategic_item_id: undefined,
      kpi_ids: undefined, guardrail_ids: undefined, placement_decision: 36,
      approval_keys: ["strategy-registry:2026-08-30-initial-1"], approved_by: undefined,
      decision_state: undefined, decision_key: undefined, strategic_placement: undefined,
    });
  });

  it("retains bounded Product Change source metadata", () => {
    expect(parseGovernanceMarker(body("schema: 1\nkind: product-change\npublication: manual\nbootstrap: manual\npdr_reference: W-158\npdr_work_card_id: 123e4567-e89b-42d3-a456-426614174000"))).toMatchObject({
      kind: "Product Change", publication: "manual", bootstrap: "manual", pdr_reference: "W-158", pdr_work_card_id: "123e4567-e89b-42d3-a456-426614174000",
    });
  });

  it("rejects ambiguous and unsupported metadata", () => {
    expect(() => parseGovernanceMarker(body("schema: 1\napproval_keys: one,two"))).toThrow("string array");
    expect(() => parseGovernanceMarker(body("schema: 1\nkind: something-else"))).toThrow("kind is unsupported");
    expect(() => parseGovernanceMarker(body("schema: 1\nunknown: value"))).toThrow("unknown governance marker field");
    expect(() => parseGovernanceMarker(body("schema: 1\nkind:\n  nested: value"))).toThrow("non-empty string");
  });

  it.each([
    ["object", "correlation_id:\n  nested: value"],
    ["array", "correlation_id:\n  - value"],
    ["empty", "correlation_id: '   '"],
  ])("rejects a %s correlation ID", (_label, correlationId) => {
    expect(() => parseGovernanceMarker(body(`schema: 1\n${correlationId}`))).toThrow(
      "correlation_id must be a non-empty string",
    );
  });

  it("rejects multiple governance marker blocks", () => {
    expect(() => parseGovernanceMarker(`${body("schema: 1")}\n${body("schema: 1")}`)).toThrow(
      "multiple governance marker blocks",
    );
  });

  it("rejects an unterminated governance marker block", () => {
    expect(() => parseGovernanceMarker("<!-- renew-governance\nschema: 1")).toThrow(
      "malformed governance marker block",
    );
  });
});
