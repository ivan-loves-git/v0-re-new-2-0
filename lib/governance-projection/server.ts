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
  const record = (input: unknown): Record<string, unknown> | null =>
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : null;
  const strings = (input: unknown): input is string[] =>
    Array.isArray(input) && input.every(text) && new Set(input).size === input.length;
  const ids = (input: unknown, pattern: RegExp) =>
    strings(input) && input.every((entry) => pattern.test(entry as string));
  const stamp = (input: unknown) =>
    typeof input === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input) &&
    new Date(input).toISOString() === input;
  const issueUrl = (input: unknown) => typeof input === "string" && /^https:\/\/github\.com\/re-new-team\/renew-governance\/issues\/[1-9]\d*$/.test(input);
  const prUrl = (input: unknown) => typeof input === "string" && /^https:\/\/github\.com\/(?:ivan-loves-git\/v0-re-new-2-0|re-new-team\/renew-governance)\/pull\/[1-9]\d*$/.test(input);
  const safeRegistryEntry = (entry: unknown, kind: "goal" | "milestone" | "kpi" | "guardrail") => {
    const value = record(entry);
    if (!value || !text(value.id) || !text(value.title) || !strings(value.sourceRefs)) return false;
    if (kind === "goal") return text(value.statement) && ids(value.kpiIds, /^KPI-\d{3}$/);
    if (kind === "milestone") return /^G-\d{3}$/.test(String(value.goalId)) && text(value.outcome) && ["active", "retired"].includes(value.lifecycle as string) && ["unassessed", "in_progress", "achieved", "not_achieved"].includes(value.outcomeState as string);
    if (kind === "guardrail") return text(value.rule) && ["active", "retired"].includes(value.lifecycle as string);
    const measurement = record(value.measurement);
    const target = record(value.target);
    return /^G-\d{3}$/.test(String(value.goalId)) && text(value.definition) && ["needs_approval", "accepted"].includes(value.definitionStatus as string) && text(value.unit) && !!measurement && ["unset", "defined"].includes(measurement.sourceStatus as string) && [null, "string"].includes(measurement.sourceRef == null ? null : typeof measurement.sourceRef) && [null, "string"].includes(measurement.cadence == null ? null : typeof measurement.cadence) && [null, "string"].includes(measurement.baselineDate == null ? null : typeof measurement.baselineDate) && !!target && ["unset", "proposed", "accepted"].includes(target.status as string) && (target.value == null || (typeof target.value === "number" && Number.isFinite(target.value))) && (target.targetDate == null || typeof target.targetDate === "string");
  };
  if (projection.schemaVersion !== GOVERNANCE_PROJECTION_SCHEMA_VERSION || projection.sourceRepository !== GOVERNANCE_SOURCE_REPOSITORY || !/^[0-9a-f]{40}$/i.test(String(projection.sourceCommit)) || !text(projection.registryRevision) || !stamp(projection.retrievedAt) || !stamp(projection.snapshotAt) || !Array.isArray(projection.issues) || !Array.isArray(projection.legacyExclusions)) return false;
  const registry = record(projection.registry);
  if (!registry || registry.schemaVersion !== 1 || !text(registry.registryId) || registry.revision !== projection.registryRevision || registry.status !== "accepted" || !Number.isInteger(registry.governanceDecision) || !text(registry.governanceDecisionKey) || !/^\d{4}-\d{2}-\d{2}$/.test(String(registry.observedAt)) || !record(registry.approval) || (registry.approval as Record<string, unknown>).approvedBy !== "Ivan" || !Number.isInteger((registry.approval as Record<string, unknown>).decision) || !stamp((registry.approval as Record<string, unknown>).approvedAt) || !Array.isArray(registry.goals) || !Array.isArray(registry.milestones) || !Array.isArray(registry.kpis) || !Array.isArray(registry.guardrails) || !registry.goals.every((entry) => safeRegistryEntry(entry, "goal")) || !registry.milestones.every((entry) => safeRegistryEntry(entry, "milestone")) || !registry.kpis.every((entry) => safeRegistryEntry(entry, "kpi")) || !registry.guardrails.every((entry) => safeRegistryEntry(entry, "guardrail"))) return false;
  return projection.issues.every((item) => {
    if (!item || typeof item !== "object") return false;
    const issue = item as Record<string, unknown>;
    const placement = issue.placement as Record<string, unknown> | null;
    return Number.isInteger(issue.number) && text(issue.title) && issueUrl(issue.url) && issue.url === `https://github.com/${GOVERNANCE_SOURCE_REPOSITORY}/issues/${issue.number}` && ["Product Change", "Decision", "Ticket", "Bug"].includes(issue.kind as string) && ["OPEN", "CLOSED"].includes(issue.state as string) && ["Unrouted", "Ready", "Todo", "In Progress", "Review", "Done", null].includes(issue.projectStatus as string | null) && ["Proposed", "Needs Ivan", "Decided", "Superseded", null].includes(issue.decisionState as string | null) && stamp(issue.updatedAt) && strings(issue.assigneeLogins) && Array.isArray(issue.dependencyNumbers) && issue.dependencyNumbers.every((number) => Number.isInteger(number) && (number as number) > 0) && new Set(issue.dependencyNumbers).size === issue.dependencyNumbers.length && Array.isArray(issue.pullRequests) && issue.pullRequests.every((pr) => pr && typeof pr === "object" && prUrl((pr as Record<string, unknown>).url) && ["OPEN", "CLOSED", "MERGED"].includes((pr as Record<string, unknown>).state as string)) && !!placement && typeof placement === "object" && [null, "string"].includes((placement as Record<string, unknown>).goalId == null ? null : typeof (placement as Record<string, unknown>).goalId) && [null, "string"].includes((placement as Record<string, unknown>).milestoneId == null ? null : typeof (placement as Record<string, unknown>).milestoneId) && ids((placement as Record<string, unknown>).kpiIds, /^KPI-\d{3}$/) && ids((placement as Record<string, unknown>).guardrailIds, /^GR-\d{3}$/) && ((placement as Record<string, unknown>).decisionNumber == null || Number.isInteger((placement as Record<string, unknown>).decisionNumber)) && typeof (placement as Record<string, unknown>).temporaryException === "boolean";
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
