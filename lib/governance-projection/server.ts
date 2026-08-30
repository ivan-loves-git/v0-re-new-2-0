import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  GOVERNANCE_PROJECTION_SCHEMA_VERSION,
  GOVERNANCE_SOURCE_REPOSITORY,
  governanceProjectionDigest,
  type GovernanceProjection,
} from "@/lib/governance-projection/model";

export type CurrentGovernanceProjection =
  | { state: "unavailable"; reason: "no_snapshot" | "read_failed" }
  | {
      state: "available";
      snapshotId: string;
      digest: string;
      projection: GovernanceProjection;
    };

function isProjection(value: unknown): value is GovernanceProjection {
  if (!value || typeof value !== "object") return false;
  const projection = value as Record<string, unknown>;
  const text = (input: unknown) => typeof input === "string" && input.trim().length > 0;
  const issueUrl = (input: unknown) => typeof input === "string" && /^https:\/\/github\.com\/re-new-team\/renew-governance\/issues\/[1-9]\d*$/.test(input);
  const prUrl = (input: unknown) => typeof input === "string" && /^https:\/\/github\.com\/(?:ivan-loves-git\/v0-re-new-2-0|re-new-team\/renew-governance)\/pull\/[1-9]\d*$/.test(input);
  if (projection.schemaVersion !== GOVERNANCE_PROJECTION_SCHEMA_VERSION || projection.sourceRepository !== GOVERNANCE_SOURCE_REPOSITORY || !text(projection.sourceCommit) || !text(projection.registryRevision) || !Array.isArray(projection.issues) || !Array.isArray(projection.legacyExclusions)) return false;
  const registry = projection.registry as Record<string, unknown> | null;
  if (!registry || typeof registry !== "object" || registry.status !== "accepted" || !Array.isArray(registry.goals) || !Array.isArray(registry.milestones) || !Array.isArray(registry.kpis) || !Array.isArray(registry.guardrails)) return false;
  return projection.issues.every((item) => {
    if (!item || typeof item !== "object") return false;
    const issue = item as Record<string, unknown>;
    const placement = issue.placement as Record<string, unknown> | null;
    return Number.isInteger(issue.number) && text(issue.title) && issueUrl(issue.url) && ["Product Change", "Decision", "Ticket", "Bug"].includes(issue.kind as string) && ["OPEN", "CLOSED"].includes(issue.state as string) && ["Unrouted", "Ready", "Todo", "In Progress", "Review", "Done", null].includes(issue.projectStatus as string | null) && ["Proposed", "Needs Ivan", "Decided", "Superseded", null].includes(issue.decisionState as string | null) && Array.isArray(issue.assigneeLogins) && issue.assigneeLogins.every(text) && Array.isArray(issue.dependencyNumbers) && issue.dependencyNumbers.every(Number.isInteger) && Array.isArray(issue.pullRequests) && issue.pullRequests.every((pr) => pr && typeof pr === "object" && prUrl((pr as Record<string, unknown>).url) && ["OPEN", "CLOSED", "MERGED"].includes((pr as Record<string, unknown>).state as string)) && !!placement && typeof placement === "object" && typeof placement.temporaryException === "boolean";
  });
}

/** The sole WAVE/AI read seam. It never contacts GitHub or falls back to PDR. */
export async function readCurrentGovernanceProjection(): Promise<CurrentGovernanceProjection> {
  const client = createAdminClient();
  const { data, error } = await client
    .from("wave_governance_projection_current_read")
    .select(
      "snapshot_id, snapshot_digest, payload, validation, retrieved_at, snapshot_at",
    )
    .eq("projection_key", "current")
    .maybeSingle();
  if (error) return { state: "unavailable", reason: "read_failed" };
  if (!data) return { state: "unavailable", reason: "no_snapshot" };
  const projection = data.payload as GovernanceProjection;
  if (
    !isProjection(projection) ||
    typeof data.snapshot_digest !== "string" ||
    governanceProjectionDigest(projection) !== data.snapshot_digest
  )
    return { state: "unavailable", reason: "read_failed" };
  return {
    state: "available",
    snapshotId: data.snapshot_id as string,
    digest: data.snapshot_digest as string,
    projection,
  };
}
