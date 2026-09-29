import type { GovernanceProjection, SafeGovernanceIssue } from "@/lib/governance-projection/model";

export interface FounderWorkSummary {
  completed: number;
  verifiedProduction: number;
  closedUnreleased: number;
  releaseUnknown: number;
  unverifiedClosures: number;
  cancelled: number;
  superseded: number;
}

/** Counts Product Changes once; child Tickets and Bugs never enter headline totals. */
export function summarizeFounderWork(projection: GovernanceProjection): FounderWorkSummary {
  const changes = projection.issues.filter((issue) => issue.kind === "Product Change");
  const completed = changes.filter((issue) => issue.reporting?.closureDisposition === "completed");
  return {
    completed: completed.length,
    verifiedProduction: completed.filter((issue) => issue.reporting?.release?.state === "verified").length,
    closedUnreleased: completed.filter((issue) => issue.reporting?.release?.state === "not_released").length,
    releaseUnknown: completed.filter((issue) => issue.reporting?.release === null).length,
    unverifiedClosures: changes.filter((issue) => issue.state === "CLOSED" && (!issue.reporting || issue.reporting.closureDisposition === "unknown")).length,
    cancelled: changes.filter((issue) => issue.reporting?.closureDisposition === "cancelled").length,
    superseded: changes.filter((issue) => issue.reporting?.closureDisposition === "superseded").length,
  };
}

export function childProgress(parent: SafeGovernanceIssue, issues: SafeGovernanceIssue[]) {
  const children = issues.filter((issue) =>
    (issue.kind === "Ticket" || issue.kind === "Bug") && issue.parentNumber === parent.number,
  );
  return {
    total: children.length,
    done: children.filter((issue) => issue.state === "CLOSED" && issue.projectStatus === "Done").length,
    children,
  };
}
