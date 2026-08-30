import { describe, expect, it } from "vitest";
import { createGovernanceProjection } from "@/lib/governance-projection/normalize";
import {
  governanceProjectionDigest,
  type GovernanceSourceModel,
} from "@/lib/governance-projection/model";

const repo = "re-new-team/renew-governance";
const registry = {
  schema_version: 1,
  registry_id: "renew-strategy",
  revision: "2026-08-30-initial-1",
  status: "accepted",
  governance_decision: "#36",
  governance_decision_key: "governance-key",
  observed_at: "2026-08-30",
  approval: {
    state: "approved",
    decision: "#46",
    approved_by: "Ivan",
    approved_at: "2026-08-30T00:00:00.000Z",
  },
  goals: [
    {
      id: "G-001",
      title: "Goal",
      statement: "Statement",
      source_refs: ["#36"],
      kpi_ids: ["KPI-001"],
    },
  ],
  milestones: [
    {
      id: "M-002",
      goal_id: "G-001",
      title: "Milestone",
      outcome: "Outcome",
      lifecycle: "active",
      outcome_state: "in_progress",
      source_refs: ["#36"],
    },
  ],
  kpis: [
    {
      id: "KPI-001",
      goal_id: "G-001",
      title: "KPI",
      definition: "Definition",
      definition_status: "accepted",
      unit: "count",
      measurement: {
        source_status: "defined",
        source_ref: "db",
        cadence: "weekly",
        baseline_date: "2026-08-30",
      },
      target: { status: "accepted", value: 1, target_date: "2026-12-31" },
      source_refs: ["#36"],
    },
  ],
  guardrails: [
    {
      id: "GR-001",
      title: "Guardrail",
      rule: "Rule",
      lifecycle: "active",
      source_refs: ["#36"],
    },
  ],
};
const issue = (
  number: number,
  kind: "Decision" | "Product Change" | "Ticket" | "Bug",
  marker?: Record<string, unknown>,
) => ({
  number,
  title: `Issue ${number}`,
  url: `https://github.com/${repo}/issues/${number}`,
  repository: repo,
  kind,
  state:
    number === 23 || number === 38 ? ("OPEN" as const) : ("CLOSED" as const),
  projectStatus: number === 23 || number === 38 ? "In Progress" : "Done",
  decisionState: kind === "Decision" ? "Decided" : null,
  updatedAt: "2026-08-30T00:00:00.000Z",
  marker,
});
const source = (): GovernanceSourceModel => ({
  sourceCommit: "a".repeat(40),
  retrievedAt: "2026-08-30T00:00:00.000Z",
  snapshotAt: "2026-08-30T00:00:01.000Z",
  registry,
  issues: [
    issue(36, "Decision", {
      decision_state: "decided",
      approved_by: "Ivan",
      approval_keys: ["governance-key"],
    }),
    issue(46, "Decision", {
      decision_state: "decided",
      approved_by: "Ivan",
      approval_keys: [
        "strategy-registry:2026-08-30-initial-1",
        "strategic-placement:#23:2026-08-30-initial-1:G-001:M-002",
      ],
    }),
    issue(23, "Product Change", {
      strategy_revision: registry.revision,
      goal_id: "G-001",
      milestone_id: "M-002",
      placement_decision: 46,
    }),
    { ...issue(38, "Ticket"), parentNumber: 23 },
  ],
});

describe("governance projection normalization", () => {
  it("projects only allowlisted facts and inherits Product Change placement", () => {
    const result = createGovernanceProjection(source());
    expect(
      result.issues.find((entry) => entry.number === 38)?.placement,
    ).toMatchObject({
      goalId: "G-001",
      milestoneId: "M-002",
      decisionNumber: 46,
    });
    expect(JSON.stringify(result)).not.toContain("approval_keys");
    expect(result.issues.find((entry) => entry.number === 23)?.provenance).toEqual({ state: "unverified" });
  });
  it("projects direct GitHub scope only from its exact marker", () => {
    const direct = source();
    (direct.issues[2].marker as Record<string, unknown>).publication = "direct-github";
    expect(createGovernanceProjection(direct).issues.find((entry) => entry.number === 23)?.provenance).toEqual({ state: "direct_github", publication: "direct-github" });
  });
  it("projects a complete bootstrap PDR Work Card source without guessing", () => {
    const pdr = source();
    Object.assign(pdr.issues[2].marker as Record<string, unknown>, { publication: "manual", bootstrap: "manual", pdr_reference: "W-158", pdr_work_card_id: "123e4567-e89b-42d3-a456-426614174000" });
    expect(createGovernanceProjection(pdr).issues.find((entry) => entry.number === 23)?.provenance).toMatchObject({ state: "pdr_work_card", pdrReference: "W-158", pdrWorkCardId: "123e4567-e89b-42d3-a456-426614174000" });
  });
  it("keeps partial source metadata unverified and retains direct GitHub authorization with exact Work Card context", () => {
    const partial = source();
    (partial.issues[2].marker as Record<string, unknown>).pdr_reference = "W-158";
    expect(createGovernanceProjection(partial).issues.find((entry) => entry.number === 23)?.provenance).toMatchObject({ state: "unverified", pdrReference: "W-158" });
    const directWithWorkCard = source();
    Object.assign(directWithWorkCard.issues[2].marker as Record<string, unknown>, { publication: "direct-github", pdr_reference: "W-081", pdr_work_card_id: "123e4567-e89b-42d3-a456-426614174000" });
    expect(createGovernanceProjection(directWithWorkCard).issues.find((entry) => entry.number === 23)?.provenance).toMatchObject({ state: "pdr_work_card", publication: "direct-github", pdrReference: "W-081", pdrWorkCardId: "123e4567-e89b-42d3-a456-426614174000" });
    const invalid = source();
    Object.assign(invalid.issues[2].marker as Record<string, unknown>, { publication: "direct-github", pdr_reference: "W-158" });
    expect(() => createGovernanceProjection(invalid)).toThrow("partial PDR source fields");
  });
  it("retains direct GitHub authorization with type-valid strategic-item context", () => {
    const directWithStrategicItem = source();
    Object.assign(directWithStrategicItem.issues[2].marker as Record<string, unknown>, { publication: "direct-github", pdr_strategic_item_id: "123e4567-e89b-42d3-a456-426614174000" });
    expect(createGovernanceProjection(directWithStrategicItem).issues.find((entry) => entry.number === 23)?.provenance).toMatchObject({ state: "pdr_strategic_item", publication: "direct-github", pdrStrategicItemId: "123e4567-e89b-42d3-a456-426614174000" });
  });
  it("retains Genesis Decision-style strategic-item provenance", () => {
    const genesis = source();
    Object.assign(genesis.issues[0].marker as Record<string, unknown>, { bootstrap: "manual", pdr_strategic_item_id: "123e4567-e89b-42d3-a456-426614174000" });
    expect(createGovernanceProjection(genesis).issues.find((entry) => entry.number === 36)?.provenance).toMatchObject({ state: "pdr_strategic_item", bootstrap: "manual", pdrStrategicItemId: "123e4567-e89b-42d3-a456-426614174000" });
  });
  it.each(["Ticket", "Bug"] as const)("does not allow %s to own provenance", (kind) => {
    const invalid = source();
    invalid.issues.push({ ...issue(39, kind), parentNumber: 23, marker: { publication: "direct-github" } });
    expect(() => createGovernanceProjection(invalid)).toThrow("cannot own provenance fields");
  });
  it.each(["Ticket", "Bug"] as const)("does not allow %s to own a Decision state", (kind) => {
    const invalid = source();
    invalid.issues.push({ ...issue(39, kind), parentNumber: 23, decisionState: "Decided" });
    expect(() => createGovernanceProjection(invalid)).toThrow("cannot own Decision state");
  });
  it("rejects unsupported Decision provenance combinations", () => {
    const direct = source();
    (direct.issues[0].marker as Record<string, unknown>).publication = "direct-github";
    expect(() => createGovernanceProjection(direct)).toThrow("Decision #36 has unsupported source provenance");
    const workCard = source();
    Object.assign(workCard.issues[0].marker as Record<string, unknown>, { pdr_reference: "W-158", pdr_work_card_id: "123e4567-e89b-42d3-a456-426614174000" });
    expect(() => createGovernanceProjection(workCard)).toThrow("Decision #36 has unsupported source provenance");
  });
  it("requires exactly accepted KPI contracts and strict registry records", () => {
    const invalid = source();
    invalid.registry = structuredClone(registry);
    (
      invalid.registry.kpis as { definition_status: string }[]
    )[0].definition_status = "needs_approval";
    (invalid.issues[2].marker as Record<string, unknown>).kpi_ids = ["KPI-001"];
    expect(() => createGovernanceProjection(invalid)).toThrow(
      "unavailable KPI",
    );
    const malformed = source();
    malformed.registry = structuredClone(registry);
    delete malformed.registry.observed_at;
    expect(() => createGovernanceProjection(malformed)).toThrow("observed_at");
  });
  it("only permits a strict closed legacy child exclusion", () => {
    const legacy = source();
    legacy.issues.push({
      number: 21,
      title: "Historic",
      url: `https://github.com/${repo}/issues/21`,
      repository: repo,
      state: "CLOSED",
      projectStatus: "Done",
      updatedAt: "2026-08-30T00:00:00.000Z",
      parentNumber: 23,
    });
    legacy.legacyExclusions = [
      {
        number: 21,
        title: "Historic",
        url: `https://github.com/${repo}/issues/21`,
        state: "CLOSED",
        projectStatus: "Done",
        parentNumber: 23,
        reason: "legacy_missing_issue_type",
      },
    ];
    expect(createGovernanceProjection(legacy).legacyExclusions).toHaveLength(1);
    legacy.issues[4].marker = { goal_id: "G-001" };
    expect(() => createGovernanceProjection(legacy)).toThrow(
      "legacy exclusion",
    );
  });
  it("keeps a digest stable across recollection timestamps", () => {
    const first = createGovernanceProjection(source());
    const second = source();
    second.retrievedAt = "2026-08-30T01:00:00.000Z";
    second.snapshotAt = second.retrievedAt;
    expect(governanceProjectionDigest(first)).toBe(
      governanceProjectionDigest(createGovernanceProjection(second)),
    );
  });

  it("rejects malformed native markers, dependencies, and legacy source facts", () => {
    const wrongKind = source();
    (wrongKind.issues[2].marker as Record<string, unknown>).kind = "Ticket";
    expect(() => createGovernanceProjection(wrongKind)).toThrow("marker kind");

    const unknownMetadata = source();
    (unknownMetadata.issues[2].marker as Record<string, unknown>).ignored = "not safe";
    expect(() => createGovernanceProjection(unknownMetadata)).toThrow("unknown field");

    const unresolved = source();
    unresolved.issues[3].dependencies = [{ number: 999, repository: repo }];
    expect(() => createGovernanceProjection(unresolved)).toThrow("unresolved");

    const malformedLegacy = source();
    malformedLegacy.issues.push({ number: 21, title: "Historic", url: `https://github.com/${repo}/issues/21`, repository: repo, state: "CLOSED", projectStatus: "Done", updatedAt: "2026-08-30T00:00:00.000Z", parentNumber: 23 });
    malformedLegacy.legacyExclusions = [{ number: 21, title: "Different", url: `https://github.com/${repo}/issues/21`, state: "CLOSED", projectStatus: "Done", parentNumber: 23, reason: "legacy_missing_issue_type" }];
    expect(() => createGovernanceProjection(malformedLegacy)).toThrow("legacy exclusion");
  });

  it("rejects any placement field mixed with a temporary exception", () => {
    const invalid = source();
    (invalid.issues[2].marker as Record<string, unknown>).strategic_placement = "needs-strategic-home";
    (invalid.issues[2].marker as Record<string, unknown>).goal_id = undefined;
    (invalid.issues[2].marker as Record<string, unknown>).milestone_id = undefined;
    (invalid.issues[2].marker as Record<string, unknown>).strategy_revision = registry.revision;
    expect(() => createGovernanceProjection(invalid)).toThrow("mixes temporary exception");
  });
});
