import type { PdrHistoryRequest } from "@/lib/pdr/intake-server";

const GOVERNANCE_ISSUE_URL =
  /^https:\/\/github\.com\/re-new-team\/renew-governance\/issues\/([1-9]\d*)$/;
const GOVERNANCE_ISSUE_HANDLE =
  /^github:re-new-team\/renew-governance#([1-9]\d*)$/;

/**
 * A PDR item is linked only when its server-recorded intake provenance is an
 * exact, canonical governance issue reference. Free text, titles, and dates
 * are deliberately not used as a matching heuristic.
 */
export function governanceIssueNumberFromPdrProvenance(
  provenance: string | null,
): number | null {
  if (!provenance) return null;
  const match = GOVERNANCE_ISSUE_URL.exec(provenance) ?? GOVERNANCE_ISSUE_HANDLE.exec(provenance);
  return match ? Number(match[1]) : null;
}

export function verifiedPdrRequestByGovernanceIssue(
  requests: PdrHistoryRequest[],
): Map<number, PdrHistoryRequest> {
  const output = new Map<number, PdrHistoryRequest>();
  for (const request of requests) {
    const issueNumber = governanceIssueNumberFromPdrProvenance(
      request.intakeProvenance,
    );
    if (issueNumber === null || output.has(issueNumber)) continue;
    output.set(issueNumber, request);
  }
  return output;
}
