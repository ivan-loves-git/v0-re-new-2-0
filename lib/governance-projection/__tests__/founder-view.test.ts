import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { GovernanceProjection } from "@/lib/governance-projection/model";

const mocks = vi.hoisted(() => ({
  staff: vi.fn(),
  read: vi.fn(),
}));
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: mocks.staff }));
vi.mock("@/lib/governance-projection/server", () => ({ readCurrentGovernanceProjection: mocks.read }));
vi.mock("@/lib/pdr/intake-server", () => ({
  listHistoricalPdrWorkCards: async () => [],
  listPdrRequestHistory: async () => [],
}));

const now = "2026-09-27T13:00:00.000Z";
const projection = (): GovernanceProjection => ({
  schemaVersion: 2,
  sourceRepository: "re-new-team/renew-governance",
  sourceCommit: "a".repeat(40),
  registryRevision: "2026-08-30-initial-1",
  retrievedAt: now,
  snapshotAt: now,
  registry: {
    schemaVersion: 1, registryId: "renew-strategy", revision: "2026-08-30-initial-1", status: "accepted",
    governanceDecision: 36, governanceDecisionKey: "approved", observedAt: "2026-08-30",
    approval: { decision: 46, approvedBy: "Ivan", approvedAt: now },
    goals: [{ id: "G-001", title: "Synthetic goal", statement: "Synthetic strategic outcome", sourceRefs: ["#36"], kpiIds: ["KPI-001"] }],
    milestones: [], kpis: [{
      id: "KPI-001", goalId: "G-001", title: "Synthetic KPI", definition: "Synthetic definition", definitionStatus: "needs_approval",
      unit: "count", measurement: { sourceStatus: "unset", sourceRef: null, cadence: null, baselineDate: null },
      target: { status: "proposed", value: 98765, targetDate: "2026-12-31" }, sourceRefs: ["#36"],
    }], guardrails: [],
  },
  issues: [{
    number: 123, title: "Synthetic delivered change", url: "https://github.com/re-new-team/renew-governance/issues/123",
    kind: "Product Change", state: "CLOSED", projectStatus: "Done", decisionState: null,
    updatedAt: now, assigneeLogins: [], parentNumber: null, dependencyNumbers: [], pullRequests: [],
    placement: { goalId: null, milestoneId: null, kpiIds: [], guardrailIds: [], decisionNumber: null, temporaryException: false },
    reporting: {
      closedAt: now, closureDisposition: "completed", evidenceRevision: "b".repeat(64),
      release: { state: "verified", commit: "c".repeat(40), releasedAt: now, verifiedAt: now, proofUrl: "https://github.com/re-new-team/renew-governance/issues/123#issuecomment-456" },
      founderSummary: { text: "The team can review the approved outcome in WAVE.", approvalUrl: "https://github.com/re-new-team/renew-governance/issues/123#issuecomment-789" },
    },
  }],
  legacyExclusions: [],
});

describe("protected founder-readable projection", () => {
  beforeEach(() => {
    mocks.staff.mockReset();
    mocks.read.mockReset();
  });

  it.each(["repreneur", "unassigned"])("does not read governance or PDR for a denied %s session", async (role) => {
    mocks.staff.mockRejectedValue(new Error(`${role} denied by staff gate`));
    const { default: page } = await import("@/app/(dashboard)/strategic-pdr/page");
    await expect(page({ searchParams: Promise.resolve({}) })).rejects.toThrow(`${role} denied`);
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("renders an approved summary and separate completed/release facts for an allowed staff account", async () => {
    mocks.staff.mockResolvedValue({ role: "staff" });
    mocks.read.mockResolvedValue({ state: "available", snapshotId: "synthetic", digest: "d".repeat(64), projection: projection(), lastValidatedAt: now });
    const { default: page } = await import("@/app/(dashboard)/strategic-pdr/page");
    const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Synthetic strategic outcome");
    expect(html).toContain("The team can review the approved outcome in WAVE.");
    expect(html).toContain("Completed scope");
    expect(html).toContain("Verified in production");
    expect(html).toContain("Last successful GitHub validation");
    expect(html).toContain("Snapshot created");
    expect(html).toContain("Target proposed, not approved");
    expect(html).not.toContain("98765");
    expect(html).not.toContain("issuecomment-789");
  });
});
