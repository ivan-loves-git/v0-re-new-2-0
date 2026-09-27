import { createGovernanceProjection } from "@/lib/governance-projection/normalize";
import { parseGovernanceProjection } from "@/lib/governance-projection/projection-validator";
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
  evidenceReview: {
    productChange: number;
    issueUrl: string;
    evidenceRevision: string;
    releaseState: "verified" | "not_released";
    proofUrl?: string;
    summaryApprovalUrl?: string;
  }[];
  applied?: boolean;
};

/** Injectable operator seam: collection/validation happen before any write, and receipts never carry provider error bodies or credentials. */
export async function refreshGovernanceProjection(
  adapters: ProjectionRefreshAdapters,
  options: { apply: boolean; confirm?: string; evidenceChecked?: string },
): Promise<RefreshReceipt> {
  const projection = createGovernanceProjection(await adapters.collect());
  if (!parseGovernanceProjection(projection))
    throw new Error("normalized projection failed persisted reader validation");
  const digest = governanceProjectionDigest(projection);
  const confirmation = `${projection.registryRevision}:${digest}`;
  const evidenceReview = projection.issues.flatMap((issue) => {
    const reporting = issue.reporting;
    if (issue.kind !== "Product Change" || !reporting?.release || !reporting.evidenceRevision) return [];
    return [{
      productChange: issue.number,
      issueUrl: issue.url,
      evidenceRevision: reporting.evidenceRevision,
      releaseState: reporting.release.state,
      ...(reporting.release.state === "verified" ? { proofUrl: reporting.release.proofUrl } : {}),
      ...(reporting.founderSummary ? { summaryApprovalUrl: reporting.founderSummary.approvalUrl } : {}),
    }];
  });
  if (!options.apply)
    return {
      mode: "dry-run",
      registryRevision: projection.registryRevision,
      sourceCommit: projection.sourceCommit,
      digest,
      confirmation,
      evidenceReview,
    };
  if (options.confirm !== confirmation)
    throw new Error("exact confirmation required");
  if (evidenceReview.length && options.evidenceChecked !== digest)
    throw new Error("exact reporting evidence review confirmation required");
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
    evidenceReview,
    applied: result.applied,
  };
}
