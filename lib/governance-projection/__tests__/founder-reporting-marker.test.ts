import { describe, expect, it } from "vitest";

import { parseFounderReportingMarker } from "@/lib/governance-projection/founder-reporting-marker";

const block = (lines: string) => `Private issue prose and client detail must stay out.\n<!-- renew-founder-reporting\n${lines}\n-->\nMore private prose.`;
const verified = `schema: 1\nrelease:\n  state: verified\n  commit: ${"a".repeat(40)}\n  released_at: 2026-09-27T12:00:00.000Z\n  verified_at: 2026-09-27T12:30:00.000Z\n  proof_url: https://github.com/re-new-team/renew-governance/issues/123#issuecomment-456\nsummary:\n  text: "The team can see the approved outcome in WAVE."\n  approval_url: https://github.com/re-new-team/renew-governance/issues/123#issuecomment-789`;

describe("strict founder reporting marker", () => {
  it("keeps only reviewed fields, one same-card proof and one same-card approval reference", () => {
    const result = parseFounderReportingMarker(block(verified), 123);
    expect(result).toMatchObject({
      release: { state: "verified", commit: "a".repeat(40), proofUrl: "https://github.com/re-new-team/renew-governance/issues/123#issuecomment-456" },
      summary: { text: "The team can see the approved outcome in WAVE.", approvalUrl: "https://github.com/re-new-team/renew-governance/issues/123#issuecomment-789" },
    });
    expect(result?.evidenceRevision).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(result)).not.toContain("client detail");
    expect(JSON.stringify(result)).not.toContain("Private issue prose");
  });

  it("keeps absent and explicit not-released states distinct", () => {
    expect(parseFounderReportingMarker("Unmarked historical issue", 123)).toBeUndefined();
    expect(parseFounderReportingMarker(block("schema: 1\nrelease:\n  state: not_released"), 123)?.release).toEqual({ state: "not_released" });
  });

  it.each([
    ["unknown field", `${verified}\nprivate_note: secret`],
    ["duplicate field", "schema: 1\nschema: 1"],
    ["other issue proof", verified.replace("issues/123#issuecomment-456", "issues/124#issuecomment-456")],
    ["other issue approval", verified.replace("issues/123#issuecomment-789", "issues/124#issuecomment-789")],
    ["summary without proof", "schema: 1\nsummary:\n  text: Approved outcome\n  approval_url: https://github.com/re-new-team/renew-governance/issues/123#issuecomment-789"],
    ["URL in summary", verified.replace("The team can see the approved outcome in WAVE.", "See https://private.example")],
    ["incomplete proof", `schema: 1\nrelease:\n  state: verified\n  commit: ${"a".repeat(40)}`],
  ])("rejects %s", (_label, yaml) => {
    expect(() => parseFounderReportingMarker(block(yaml), 123)).toThrow();
  });

  it("rejects duplicate or unterminated blocks", () => {
    expect(() => parseFounderReportingMarker(`${block("schema: 1")}\n${block("schema: 1")}`, 123)).toThrow("multiple");
    expect(() => parseFounderReportingMarker("<!-- renew-founder-reporting\nschema: 1", 123)).toThrow("malformed");
    expect(() => parseFounderReportingMarker("<!--  renew-founder-reporting\nschema: 1", 123)).toThrow("malformed");
    expect(() => parseFounderReportingMarker("<!--\trenew-founder-reporting\nschema: 1", 123)).toThrow("malformed");
    expect(() => parseFounderReportingMarker(`${block("schema: 1")}\n<!--  renew-founder-reporting\nschema: 1`, 123)).toThrow("multiple");
    expect(parseFounderReportingMarker("<!--  renew-founder-reporting\nschema: 1\n-->", 123)).toBeDefined();
  });
});
