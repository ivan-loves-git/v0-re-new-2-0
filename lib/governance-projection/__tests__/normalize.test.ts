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
  kind: "Decision" | "Product Change" | "Ticket",
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
