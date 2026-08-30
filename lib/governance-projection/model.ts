import { createHash } from "node:crypto";

export const GOVERNANCE_SOURCE_REPOSITORY = "re-new-team/renew-governance";
export const GOVERNANCE_PROJECTION_SCHEMA_VERSION = 1;
export type GovernanceIssueKind =
  | "Product Change"
  | "Decision"
  | "Ticket"
  | "Bug";
export type ProjectStatus =
  | "Unrouted"
  | "Ready"
  | "Todo"
  | "In Progress"
  | "Review"
  | "Done";
export type DecisionState =
  | "Proposed"
  | "Needs Ivan"
  | "Decided"
  | "Superseded"
  | null;
export interface GithubMarker {
  kind?: GovernanceIssueKind;
  strategy_revision?: string;
  goal_id?: string;
  milestone_id?: string;
  kpi_ids?: string[];
  guardrail_ids?: string[];
  placement_decision?: number;
  approval_keys?: string[];
  approved_by?: string;
  decision_state?: string;
  decision_key?: string;
  strategic_placement?: string;
}
export interface GithubIssueFact {
  number: number;
  title: string;
  url: string;
  repository?: string;
  kind?: GovernanceIssueKind;
  state: "OPEN" | "CLOSED";
  projectStatus?: string | null;
  decisionState?: string | null;
  updatedAt: string;
  assigneeLogins?: string[];
  parentNumber?: number | null;
  parentKind?: GovernanceIssueKind | null;
  dependencyNumbers?: number[];
  dependencies?: { number: number; repository: string }[];
  pullRequests?: { url: string; state: string }[];
  marker?: GithubMarker;
}
export interface LegacyExclusion {
  number: number;
  title: string;
  url: string;
  state: "CLOSED";
  projectStatus: "Done";
  parentNumber: number;
  reason:
    | "legacy_missing_issue_type"
    | "legacy_non_product_change_parent";
  nativeKind?: "Ticket" | "Bug";
}
export interface StrategyRegistryInput {
  [key: string]: unknown;
}
export interface GovernanceSourceModel {
  sourceCommit: string;
  retrievedAt: string;
  snapshotAt: string;
  registry: StrategyRegistryInput;
  issues: GithubIssueFact[];
  legacyExclusions?: LegacyExclusion[];
}
export interface SafeRegistryGoal {
  id: string;
  title: string;
  statement: string;
  sourceRefs: string[];
  kpiIds: string[];
}
export interface SafeRegistryMilestone {
  id: string;
  goalId: string;
  title: string;
  outcome: string;
  lifecycle: "active" | "retired";
  outcomeState: "unassessed" | "in_progress" | "achieved" | "not_achieved";
  sourceRefs: string[];
}
export interface SafeRegistryKpi {
  id: string;
  goalId: string;
  title: string;
  definition: string;
  definitionStatus: "needs_approval" | "accepted";
  unit: string;
  measurement: {
    sourceStatus: "unset" | "defined";
    sourceRef: string | null;
    cadence: string | null;
    baselineDate: string | null;
  };
  target: {
    status: "unset" | "proposed" | "accepted";
    value: number | null;
    targetDate: string | null;
  };
  sourceRefs: string[];
}
export interface SafeRegistryGuardrail {
  id: string;
  title: string;
  rule: string;
  lifecycle: "active" | "retired";
  sourceRefs: string[];
}
export interface SafeStrategyRegistry {
  schemaVersion: 1;
  registryId: string;
  revision: string;
  status: "accepted";
  governanceDecision: number;
  governanceDecisionKey: string;
  observedAt: string;
  approval: { decision: number; approvedBy: "Ivan"; approvedAt: string };
  goals: SafeRegistryGoal[];
  milestones: SafeRegistryMilestone[];
  kpis: SafeRegistryKpi[];
  guardrails: SafeRegistryGuardrail[];
}
export interface SafeGovernanceIssue {
  number: number;
  title: string;
  url: string;
  kind: GovernanceIssueKind;
  state: "OPEN" | "CLOSED";
  /** Every persisted safe issue is typed in GitHub and therefore has a status. */
  projectStatus: ProjectStatus;
  decisionState: DecisionState;
  updatedAt: string;
  assigneeLogins: string[];
  parentNumber: number | null;
  dependencyNumbers: number[];
  pullRequests: { url: string; state: string }[];
  placement: {
    goalId: string | null;
    milestoneId: string | null;
    kpiIds: string[];
    guardrailIds: string[];
    decisionNumber: number | null;
    temporaryException: boolean;
  };
}
export interface GovernanceProjection {
  schemaVersion: typeof GOVERNANCE_PROJECTION_SCHEMA_VERSION;
  sourceRepository: typeof GOVERNANCE_SOURCE_REPOSITORY;
  sourceCommit: string;
  registryRevision: string;
  retrievedAt: string;
  snapshotAt: string;
  registry: SafeStrategyRegistry;
  issues: SafeGovernanceIssue[];
  legacyExclusions: LegacyExclusion[];
}

/** Stable JSON is a protocol, not JSONB formatting. SQL verifies this text parses to the payload minus volatile fields before hashing it. */
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  return JSON.stringify(value);
}
export function stableProjectionText(projection: GovernanceProjection): string {
  const {
    retrievedAt: _retrievedAt,
    snapshotAt: _snapshotAt,
    ...stable
  } = projection;
  return stableJson(stable);
}
export function governanceProjectionDigest(
  projection: GovernanceProjection,
): string {
  return createHash("sha256")
    .update(stableProjectionText(projection))
    .digest("hex");
}
