import { describe, expect, it, vi } from "vitest";
import { createGovernanceProjection } from "@/lib/governance-projection/normalize";
import { governanceProjectionDigest } from "@/lib/governance-projection/model";

const maybeSingle = vi.fn();
const select = vi.fn(() => ({ eq: () => ({ maybeSingle }) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ select }) }),
}));

const repo = "re-new-team/renew-governance";
const validProjection = () =>
  createGovernanceProjection({
    sourceCommit: "a".repeat(40),
    retrievedAt: "2026-08-30T00:00:00.000Z",
    snapshotAt: "2026-08-30T00:00:01.000Z",
    registry: {
      schema_version: 1, registry_id: "renew-strategy", revision: "2026-08-30-initial-1", status: "accepted", governance_decision: "#36", governance_decision_key: "governance-key", observed_at: "2026-08-30",
      approval: { state: "approved", decision: "#46", approved_by: "Ivan", approved_at: "2026-08-30T00:00:00.000Z" },
      goals: [{ id: "G-001", title: "Goal", statement: "Statement", source_refs: ["#36"], kpi_ids: ["KPI-001"] }], milestones: [],
      kpis: [{ id: "KPI-001", goal_id: "G-001", title: "KPI", definition: "Definition", definition_status: "accepted", unit: "count", measurement: { source_status: "defined", source_ref: "#36", cadence: "weekly", baseline_date: "2026-08-30" }, target: { status: "accepted", value: 1, target_date: "2026-09-30" }, source_refs: ["#36"] }],
      guardrails: [],
    },
    issues: [
      { number: 36, title: "Decision", url: `https://github.com/${repo}/issues/36`, repository: repo, kind: "Decision", state: "CLOSED", projectStatus: "Done", decisionState: "Decided", updatedAt: "2026-08-30T00:00:00.000Z", marker: { decision_state: "decided", approved_by: "Ivan", approval_keys: ["governance-key"] } },
      { number: 46, title: "Approval", url: `https://github.com/${repo}/issues/46`, repository: repo, kind: "Decision", state: "CLOSED", projectStatus: "Done", decisionState: "Decided", updatedAt: "2026-08-30T00:00:00.000Z", marker: { decision_state: "decided", approved_by: "Ivan", approval_keys: ["strategy-registry:2026-08-30-initial-1"] } },
    ],
  });

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

  it.each([
    ["malformed issue title", (value: Record<string, unknown>) => ((value.issues as { title: unknown }[])[0].title = "")],
    ["malformed issue URL", (value: Record<string, unknown>) => ((value.issues as { url: unknown }[])[0].url = "https://example.test/1")],
    ["malformed issue status", (value: Record<string, unknown>) => ((value.issues as { projectStatus: unknown }[])[0].projectStatus = "Elsewhere")],
    ["malformed assignee", (value: Record<string, unknown>) => ((value.issues as { assigneeLogins: unknown }[])[0].assigneeLogins = [1])],
    ["malformed pull request", (value: Record<string, unknown>) => ((value.issues as { pullRequests: unknown }[])[0].pullRequests = [{ url: "bad", state: "OPEN" }])],
    ["malformed registry field", (value: Record<string, unknown>) => ((value.registry as { goals: { statement: unknown }[] }).goals[0].statement = "")],
  ])("fails closed for %s", async (_label, corrupt) => {
    const projection = structuredClone(validProjection()) as unknown as Record<string, unknown>;
    corrupt(projection);
    maybeSingle.mockResolvedValueOnce({ data: { snapshot_id: "id", snapshot_digest: governanceProjectionDigest(projection as unknown as ReturnType<typeof validProjection>), payload: projection }, error: null });
    const { readCurrentGovernanceProjection } = await import("@/lib/governance-projection/server");
    await expect(readCurrentGovernanceProjection()).resolves.toEqual({ state: "unavailable", reason: "read_failed" });
  });

  it("fails closed when a syntactically valid payload has the wrong digest", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { snapshot_id: "id", snapshot_digest: "0".repeat(64), payload: validProjection() }, error: null });
    const { readCurrentGovernanceProjection } = await import("@/lib/governance-projection/server");
    await expect(readCurrentGovernanceProjection()).resolves.toEqual({ state: "unavailable", reason: "read_failed" });
  });

  it.each([
    ["unknown fields", (value: Record<string, unknown>) => { value.unexpected = true; }],
    ["duplicate issue", (value: Record<string, unknown>) => { (value.issues as unknown[]).push(structuredClone((value.issues as unknown[])[0])); }],
    ["invalid login", (value: Record<string, unknown>) => { (value.issues as { assigneeLogins: string[] }[])[0].assigneeLogins = ["not valid!"]; }],
    ["bad registry cross reference", (value: Record<string, unknown>) => { ((value.registry as { goals: { kpiIds: string[] }[] }).goals[0]).kpiIds = ["KPI-999"]; }],
    ["partially unset measurement", (value: Record<string, unknown>) => {
      const measurement = (value.registry as { kpis: { measurement: { sourceStatus: string; cadence: string | null; baselineDate: string | null } }[] }).kpis[0].measurement;
      measurement.sourceStatus = "unset";
      measurement.cadence = null;
      measurement.baselineDate = null;
    }],
    ["empty source references", (value: Record<string, unknown>) => { ((value.registry as { goals: { sourceRefs: string[] }[] }).goals[0]).sourceRefs = []; }],
    ["null typed issue project status", (value: Record<string, unknown>) => { ((value.issues as { projectStatus: unknown }[])[0]).projectStatus = null; }],
    ["invalid legacy exclusion", (value: Record<string, unknown>) => { value.legacyExclusions = [{ number: 99, title: "Old", url: `https://github.com/${repo}/issues/99`, state: "CLOSED", projectStatus: "Done", parentNumber: 36, reason: "legacy_missing_issue_type" }]; }],
  ])("rejects a digest-valid tampered snapshot with %s", async (_label, corrupt) => {
    const projection = structuredClone(validProjection()) as unknown as Record<string, unknown>;
    corrupt(projection);
    maybeSingle.mockResolvedValueOnce({ data: { snapshot_id: "id", snapshot_digest: governanceProjectionDigest(projection as unknown as ReturnType<typeof validProjection>), payload: projection }, error: null });
    const { readCurrentGovernanceProjection } = await import("@/lib/governance-projection/server");
    await expect(readCurrentGovernanceProjection()).resolves.toEqual({ state: "unavailable", reason: "read_failed" });
  });
});
