import { z } from "zod";

import {
  GOVERNANCE_PROJECTION_SCHEMA_VERSION,
  GOVERNANCE_SOURCE_REPOSITORY,
  type GovernanceProjection,
} from "@/lib/governance-projection/model";

const issueNumber = z.number().int().positive();
const nonEmpty = z.string().trim().min(1);
const unique = <T>(items: T[]) => new Set(items).size === items.length;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}, "invalid ISO date");
const timestamp = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/).refine(
  (value) => !Number.isNaN(new Date(value).valueOf()) && new Date(value).toISOString() === value,
  "invalid ISO timestamp",
);
const refs = z.array(nonEmpty).min(1).refine(unique, "duplicate values");
const issueUrl = z.string().regex(new RegExp(`^https://github\\.com/${GOVERNANCE_SOURCE_REPOSITORY}/issues/[1-9]\\d*$`));
const login = z.string().regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37})?$/);
const projectStatus = z.enum(["Unrouted", "Ready", "Todo", "In Progress", "Review", "Done"]);
const decisionState = z.enum(["Proposed", "Needs Ivan", "Decided", "Superseded"]).nullable();
const kind = z.enum(["Product Change", "Decision", "Ticket", "Bug"]);
const placement = z.object({
  goalId: z.string().regex(/^G-\d{3}$/).nullable(),
  milestoneId: z.string().regex(/^M-\d{3}$/).nullable(),
  kpiIds: z.array(z.string().regex(/^KPI-\d{3}$/)).refine(unique, "duplicate KPI"),
  guardrailIds: z.array(z.string().regex(/^GR-\d{3}$/)).refine(unique, "duplicate guardrail"),
  decisionNumber: issueNumber.nullable(),
  temporaryException: z.boolean(),
}).strict();
const goal = z.object({ id: z.string().regex(/^G-\d{3}$/), title: nonEmpty, statement: nonEmpty, sourceRefs: refs, kpiIds: z.array(z.string().regex(/^KPI-\d{3}$/)).refine(unique) }).strict();
const milestone = z.object({ id: z.string().regex(/^M-\d{3}$/), goalId: z.string().regex(/^G-\d{3}$/), title: nonEmpty, outcome: nonEmpty, lifecycle: z.enum(["active", "retired"]), outcomeState: z.enum(["unassessed", "in_progress", "achieved", "not_achieved"]), sourceRefs: refs }).strict();
const kpi = z.object({
  id: z.string().regex(/^KPI-\d{3}$/), goalId: z.string().regex(/^G-\d{3}$/), title: nonEmpty, definition: nonEmpty,
  definitionStatus: z.enum(["needs_approval", "accepted"]), unit: nonEmpty,
  measurement: z.object({ sourceStatus: z.enum(["unset", "defined"]), sourceRef: nonEmpty.nullable(), cadence: nonEmpty.nullable(), baselineDate: date.nullable() }).strict(),
  target: z.object({ status: z.enum(["unset", "proposed", "accepted"]), value: z.number().finite().nullable(), targetDate: date.nullable() }).strict(),
  sourceRefs: refs,
}).strict();
const guardrail = z.object({ id: z.string().regex(/^GR-\d{3}$/), title: nonEmpty, rule: nonEmpty, lifecycle: z.enum(["active", "retired"]), sourceRefs: refs }).strict();
const registry = z.object({
  schemaVersion: z.literal(1), registryId: z.string().regex(/^[a-z][a-z0-9-]*$/), revision: z.string().regex(/^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*$/), status: z.literal("accepted"),
  governanceDecision: issueNumber, governanceDecisionKey: nonEmpty, observedAt: date,
  approval: z.object({ decision: issueNumber, approvedBy: z.literal("Ivan"), approvedAt: timestamp }).strict(),
  goals: z.array(goal).min(1), milestones: z.array(milestone), kpis: z.array(kpi), guardrails: z.array(guardrail),
}).strict();
const issue = z.object({
  number: issueNumber, title: nonEmpty, url: issueUrl, kind, state: z.enum(["OPEN", "CLOSED"]), projectStatus, decisionState, updatedAt: timestamp,
  assigneeLogins: z.array(login).refine(unique, "duplicate assignee"), parentNumber: issueNumber.nullable(), dependencyNumbers: z.array(issueNumber).refine(unique, "duplicate dependency"),
  pullRequests: z.array(z.object({ url: z.string().regex(/^https:\/\/github\.com\/(?:ivan-loves-git\/v0-re-new-2-0|re-new-team\/renew-governance)\/pull\/[1-9]\d*$/), state: z.enum(["OPEN", "CLOSED", "MERGED"]) }).strict()).refine((items) => unique(items.map((item) => item.url)), "duplicate pull request"),
  placement,
}).strict();
const legacy = z.object({ number: issueNumber, title: nonEmpty, url: issueUrl, state: z.literal("CLOSED"), projectStatus: z.literal("Done"), parentNumber: issueNumber, reason: z.enum(["legacy_missing_issue_type", "legacy_non_product_change_parent"]), nativeKind: z.enum(["Ticket", "Bug"]).optional() }).strict();
const projectionSchema = z.object({
  schemaVersion: z.literal(GOVERNANCE_PROJECTION_SCHEMA_VERSION), sourceRepository: z.literal(GOVERNANCE_SOURCE_REPOSITORY), sourceCommit: z.string().regex(/^[0-9a-f]{40}$/), registryRevision: nonEmpty, retrievedAt: timestamp, snapshotAt: timestamp,
  registry, issues: z.array(issue), legacyExclusions: z.array(legacy),
}).strict();

const emptyPlacement = (value: z.infer<typeof placement>) => value.goalId === null && value.milestoneId === null && value.kpiIds.length === 0 && value.guardrailIds.length === 0 && value.decisionNumber === null && !value.temporaryException;
const decided = (item: z.infer<typeof issue> | undefined) => Boolean(item && item.kind === "Decision" && item.state === "CLOSED" && item.projectStatus === "Done" && item.decisionState === "Decided");

/**
 * Parses the persisted allowlist and re-establishes all relationships before a
 * WAVE reader can receive it. It is deliberately stricter than digest checking.
 */
export function parseGovernanceProjection(value: unknown): GovernanceProjection | null {
  const result = projectionSchema.safeParse(value);
  if (!result.success) return null;
  const projection = result.data;
  if (projection.registry.revision !== projection.registryRevision || new Date(projection.snapshotAt) < new Date(projection.retrievedAt)) return null;
  const uniqueIds = (items: { id: string }[]) => unique(items.map((item) => item.id));
  if (!uniqueIds(projection.registry.goals) || !uniqueIds(projection.registry.milestones) || !uniqueIds(projection.registry.kpis) || !uniqueIds(projection.registry.guardrails)) return null;
  const goals = new Map(projection.registry.goals.map((item) => [item.id, item]));
  const milestones = new Map(projection.registry.milestones.map((item) => [item.id, item]));
  const kpis = new Map(projection.registry.kpis.map((item) => [item.id, item]));
  const guardrails = new Map(projection.registry.guardrails.map((item) => [item.id, item]));
  if ([...milestones.values()].some((item) => !goals.has(item.goalId))) return null;
  if ([...kpis.values()].some((item) => !goals.has(item.goalId))) return null;
  if ([...goals.values()].some((item) => item.kpiIds.some((id) => kpis.get(id)?.goalId !== item.id))) return null;
  for (const item of kpis.values()) {
    const measured = item.measurement.sourceStatus === "defined";
    const hasMeasurementValues = Boolean(item.measurement.sourceRef && item.measurement.cadence && item.measurement.baselineDate);
    if (measured !== hasMeasurementValues) return null;
    if (!measured && (item.measurement.sourceRef !== null || item.measurement.cadence !== null || item.measurement.baselineDate !== null)) return null;
    if (item.target.status === "unset" && (item.target.value !== null || item.target.targetDate !== null)) return null;
    if (item.target.status === "accepted" && (item.target.value === null || item.target.targetDate === null)) return null;
  }
  const issues = new Map(projection.issues.map((item) => [item.number, item]));
  const exclusions = new Map(projection.legacyExclusions.map((item) => [item.number, item]));
  if (issues.size !== projection.issues.length || exclusions.size !== projection.legacyExclusions.length || [...exclusions.keys()].some((number) => issues.has(number))) return null;
  if (!decided(issues.get(projection.registry.governanceDecision)) || !decided(issues.get(projection.registry.approval.decision))) return null;
  for (const item of projection.issues) {
    if (item.url !== `https://github.com/${GOVERNANCE_SOURCE_REPOSITORY}/issues/${item.number}` || item.parentNumber === item.number) return null;
    if (item.kind === "Decision" && (!emptyPlacement(item.placement) || item.decisionState === null)) return null;
    if (item.kind !== "Decision" && item.decisionState !== null) return null;
    if (item.dependencyNumbers.some((number) => !issues.has(number) || exclusions.has(number))) return null;
    if (item.placement.decisionNumber !== null && !decided(issues.get(item.placement.decisionNumber))) return null;
    if (item.kind === "Ticket" || item.kind === "Bug") {
      const parent = item.parentNumber === null ? undefined : issues.get(item.parentNumber);
      if (!parent || parent.kind !== "Product Change" || JSON.stringify(item.placement) !== JSON.stringify(parent.placement)) return null;
    }
    if (item.kind === "Product Change") {
      const p = item.placement;
      if (p.temporaryException) {
        if (p.goalId !== null || p.milestoneId !== null || p.kpiIds.length || p.guardrailIds.length || p.decisionNumber === null) return null;
      } else if (emptyPlacement(p)) {
        if (item.state !== "CLOSED") return null;
      } else {
        const milestoneValue = p.milestoneId === null ? undefined : milestones.get(p.milestoneId);
        if (!p.goalId || !milestoneValue || milestoneValue.goalId !== p.goalId || milestoneValue.lifecycle !== "active" || p.decisionNumber === null) return null;
        if (p.kpiIds.some((id) => { const candidate = kpis.get(id); return !candidate || candidate.goalId !== p.goalId || candidate.definitionStatus !== "accepted" || candidate.measurement.sourceStatus !== "defined" || candidate.target.status !== "accepted"; })) return null;
        if (p.guardrailIds.some((id) => guardrails.get(id)?.lifecycle !== "active")) return null;
      }
    }
  }
  for (const item of projection.legacyExclusions) {
    if (item.url !== `https://github.com/${GOVERNANCE_SOURCE_REPOSITORY}/issues/${item.number}` || item.parentNumber === item.number) return null;
    const parent = issues.get(item.parentNumber);
    if (!parent || parent.state !== "CLOSED") return null;
    if (item.reason === "legacy_missing_issue_type" ? parent.kind !== "Product Change" || item.nativeKind !== undefined : (item.nativeKind !== "Ticket" && item.nativeKind !== "Bug") || parent.kind === "Product Change") return null;
  }
  return projection as GovernanceProjection;
}
