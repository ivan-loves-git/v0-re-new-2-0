import { describe, expect, it, vi } from "vitest";
import {
  governanceProjectionDigest,
  type GovernanceSourceModel,
} from "@/lib/governance-projection/model";
import { refreshGovernanceProjection } from "@/lib/governance-projection/refresh";
import { createGovernanceProjection } from "@/lib/governance-projection/normalize";
import { createProjectionOperatorAdapters } from "@/lib/governance-projection/operator-adapters";

const repo = "re-new-team/renew-governance";
const source = (): GovernanceSourceModel => ({
  sourceCommit: "a".repeat(40),
  retrievedAt: "2026-08-30T00:00:00.000Z",
  snapshotAt: "2026-08-30T00:00:01.000Z",
  registry: {
    schema_version: 1, registry_id: "renew-strategy", revision: "2026-08-30-initial-1", status: "accepted", governance_decision: "#36", governance_decision_key: "governance-key", observed_at: "2026-08-30",
    approval: { state: "approved", decision: "#46", approved_by: "Ivan", approved_at: "2026-08-30T00:00:00.000Z" },
    goals: [{ id: "G-001", title: "Goal", statement: "Statement", source_refs: ["#36"], kpi_ids: [] }], milestones: [], kpis: [], guardrails: [],
  },
  issues: [
    { number: 36, title: "Decision", url: `https://github.com/${repo}/issues/36`, repository: repo, kind: "Decision", state: "CLOSED", projectStatus: "Done", decisionState: "Decided", updatedAt: "2026-08-30T00:00:00.000Z", marker: { decision_state: "decided", approved_by: "Ivan", approval_keys: ["governance-key"] } },
    { number: 46, title: "Approval", url: `https://github.com/${repo}/issues/46`, repository: repo, kind: "Decision", state: "CLOSED", projectStatus: "Done", decisionState: "Decided", updatedAt: "2026-08-30T00:00:00.000Z", marker: { decision_state: "decided", approved_by: "Ivan", approval_keys: ["strategy-registry:2026-08-30-initial-1"] } },
  ],
});

const adapters = () => ({
  collect: vi.fn(async () => source()),
  currentDigest: vi.fn(async () => "current"),
  apply: vi.fn(async ({ digest }: { digest: string }) => ({ digest, applied: true })),
  readback: vi.fn(async () => governanceProjectionDigest(createGovernanceProjection(source()))),
});

describe("governance projection refresh seam", () => {
  it("dry-runs collection only", async () => {
    const input = adapters();
    const receipt = await refreshGovernanceProjection(input, { apply: false });
    expect(receipt.mode).toBe("dry-run");
    expect(input.collect).toHaveBeenCalledOnce();
    expect(input.currentDigest).not.toHaveBeenCalled();
    expect(input.apply).not.toHaveBeenCalled();
    expect(input.readback).not.toHaveBeenCalled();
  });

  it("requires the exact digest confirmation before any database call", async () => {
    const input = adapters();
    await expect(refreshGovernanceProjection(input, { apply: true, confirm: "wrong" })).rejects.toThrow("exact confirmation required");
    expect(input.currentDigest).not.toHaveBeenCalled();
    expect(input.apply).not.toHaveBeenCalled();
  });

  it("writes, then verifies the exact snapshot digest", async () => {
    const input = adapters();
    const projection = createGovernanceProjection(source());
    const digest = governanceProjectionDigest(projection);
    input.readback.mockResolvedValue(digest);
    await expect(refreshGovernanceProjection(input, { apply: true, confirm: `${projection.registryRevision}:${digest}` })).resolves.toMatchObject({ mode: "apply", digest, applied: true });
    expect(input.currentDigest).toHaveBeenCalledOnce();
    expect(input.apply).toHaveBeenCalledWith(expect.objectContaining({ digest, expectedDigest: "current" }));
    expect(input.readback).toHaveBeenCalledOnce();
  });

  it("preserves a no-op response while still requiring readback", async () => {
    const input = adapters();
    const projection = createGovernanceProjection(source());
    const digest = governanceProjectionDigest(projection);
    input.apply.mockResolvedValue({ digest, applied: false });
    input.readback.mockResolvedValue(digest);
    await expect(refreshGovernanceProjection(input, { apply: true, confirm: `${projection.registryRevision}:${digest}` })).resolves.toMatchObject({ applied: false });
    expect(input.readback).toHaveBeenCalledOnce();
  });

  it("fails closed for an optimistic conflict, provider failure, or mismatched readback", async () => {
    const projection = createGovernanceProjection(source());
    const digest = governanceProjectionDigest(projection);
    const conflict = adapters();
    conflict.apply.mockRejectedValue(new Error("raw provider internals"));
    await expect(refreshGovernanceProjection(conflict, { apply: true, confirm: `${projection.registryRevision}:${digest}` })).rejects.toThrow("raw provider internals");
    const mismatch = adapters();
    mismatch.readback.mockResolvedValue("different");
    await expect(refreshGovernanceProjection(mismatch, { apply: true, confirm: `${projection.registryRevision}:${digest}` })).rejects.toThrow("snapshot readback mismatch");
  });

  it("maps database adapter conflicts and provider bodies to stable operator errors", async () => {
    const current = { maybeSingle: vi.fn(async () => ({ data: null, error: { message: "provider secret" } })), single: vi.fn() };
    const client = {
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => current) })) })),
      rpc: vi.fn(async () => ({ data: null, error: { message: "provider secret" } })),
    };
    const adapter = createProjectionOperatorAdapters(client, async () => source());
    await expect(adapter.currentDigest()).rejects.toThrow("cannot read current snapshot");
    await expect(adapter.apply({ projection: createGovernanceProjection(source()), digest: "digest", canonicalText: "{}", expectedDigest: "old" })).rejects.toThrow("snapshot apply failed");
  });

  it("accepts only one complete RPC receipt and preserves an applied false no-op", async () => {
    const current = { maybeSingle: vi.fn(), single: vi.fn() };
    const client = {
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => current) })) })),
      rpc: vi.fn(async () => ({ data: [{ snapshot_id: "11111111-1111-4111-8111-111111111111", snapshot_digest: "a".repeat(64), applied: false }], error: null })),
    };
    const adapter = createProjectionOperatorAdapters(client, async () => source());
    await expect(adapter.apply({ projection: createGovernanceProjection(source()), digest: "digest", canonicalText: "{}", expectedDigest: "old" })).resolves.toEqual({ digest: "a".repeat(64), applied: false });
    client.rpc.mockResolvedValueOnce({ data: [], error: null });
    await expect(adapter.apply({ projection: createGovernanceProjection(source()), digest: "digest", canonicalText: "{}", expectedDigest: "old" })).rejects.toThrow("snapshot apply failed");
    client.rpc.mockResolvedValueOnce({ data: [{ snapshot_id: "bad", snapshot_digest: "bad", applied: "false" as unknown as boolean }], error: null });
    await expect(adapter.apply({ projection: createGovernanceProjection(source()), digest: "digest", canonicalText: "{}", expectedDigest: "old" })).rejects.toThrow("snapshot apply failed");
  });
});
