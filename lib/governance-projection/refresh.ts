import { createGovernanceProjection } from "@/lib/governance-projection/normalize";
import {
  governanceProjectionDigest,
  stableProjectionText,
  type GovernanceProjection,
  type GovernanceSourceModel,
} from "@/lib/governance-projection/model";

export interface ProjectionRefreshAdapters {
  collect(): Promise<GovernanceSourceModel>;
  currentDigest(): Promise<string>;
  apply(input: {
    projection: GovernanceProjection;
    digest: string;
    canonicalText: string;
    expectedDigest: string;
  }): Promise<{ digest: string; applied: boolean }>;
  readback(): Promise<string>;
}
export type RefreshReceipt = {
  mode: "dry-run" | "apply";
  registryRevision: string;
  sourceCommit: string;
  digest: string;
  confirmation: string;
  applied?: boolean;
};

/** Injectable operator seam: collection/validation happen before any write, and receipts never carry provider error bodies or credentials. */
export async function refreshGovernanceProjection(
  adapters: ProjectionRefreshAdapters,
  options: { apply: boolean; confirm?: string },
): Promise<RefreshReceipt> {
  const projection = createGovernanceProjection(await adapters.collect());
  const digest = governanceProjectionDigest(projection);
  const confirmation = `${projection.registryRevision}:${digest}`;
  if (!options.apply)
    return {
      mode: "dry-run",
      registryRevision: projection.registryRevision,
      sourceCommit: projection.sourceCommit,
      digest,
      confirmation,
    };
  if (options.confirm !== confirmation)
    throw new Error("exact confirmation required");
  const expectedDigest = await adapters.currentDigest();
  const result = await adapters.apply({
    projection,
    digest,
    canonicalText: stableProjectionText(projection),
    expectedDigest,
  });
  if (result.digest !== digest || (await adapters.readback()) !== digest)
    throw new Error("snapshot readback mismatch");
  return {
    mode: "apply",
    registryRevision: projection.registryRevision,
    sourceCommit: projection.sourceCommit,
    digest,
    confirmation,
    applied: result.applied,
  };
}
