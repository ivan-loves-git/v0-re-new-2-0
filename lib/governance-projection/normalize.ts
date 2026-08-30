import {
  GOVERNANCE_PROJECTION_SCHEMA_VERSION,
  GOVERNANCE_SOURCE_REPOSITORY,
  type DecisionState,
  type GithubIssueFact,
  type GovernanceIssueKind,
  type GovernanceProjection,
  type GovernanceSourceModel,
  type LegacyExclusion,
  type ProjectStatus,
  type SafeGovernanceIssue,
  type SafeStrategyRegistry,
  type StrategyRegistryInput,
} from "@/lib/governance-projection/model";

const SHA = /^[0-9a-f]{40}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STAMP = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?Z$/;
const ISSUE_URL =
  /^https:\/\/github\.com\/re-new-team\/renew-governance\/issues\/[1-9]\d*$/;
const kinds = new Set<GovernanceIssueKind>([
  "Product Change",
  "Decision",
  "Ticket",
  "Bug",
]);
const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37})?$/;
const PR_URL = /^https:\/\/github\.com\/(?:ivan-loves-git\/v0-re-new-2-0|re-new-team\/renew-governance)\/pull\/[1-9]\d*$/;
const PR_STATES = new Set(["OPEN", "CLOSED", "MERGED"]);
const statuses = new Set([
  "Unrouted",
  "Ready",
  "Todo",
  "In Progress",
  "Review",
  "Done",
]);
const decisionStates = new Set([
  "Proposed",
  "Needs Ivan",
  "Decided",
  "Superseded",
]);
const obj = (x: unknown, label: string): Record<string, unknown> => {
  if (!x || typeof x !== "object" || Array.isArray(x))
    throw new Error(`${label} must be an object`);
  return x as Record<string, unknown>;
};
const arr = (x: unknown, label: string): unknown[] => {
  if (!Array.isArray(x)) throw new Error(`${label} must be an array`);
  return x;
};
const string = (x: unknown, label: string) => {
  if (typeof x !== "string" || !x.trim())
    throw new Error(`${label} must be a non-empty string`);
  return x.trim();
};
const enumValue = <T extends string>(
  x: unknown,
  values: Set<T>,
  label: string,
): T => {
  const value = string(x, label) as T;
  if (!values.has(value))
    throw new Error(`${label} has unsupported value: ${value}`);
  return value;
};
const id = (x: unknown, re: RegExp, label: string) => {
  const value = string(x, label);
  if (!re.test(value)) throw new Error(`${label} has invalid format`);
  return value;
};
const date = (x: unknown, label: string) => {
  const value = string(x, label);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    !DATE.test(value) ||
    Number.isNaN(parsed.valueOf()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    throw new Error(`${label} must be an ISO date`);
  return value;
};
const timestamp = (x: unknown, label: string) => {
  const value = string(x, label);
  const m = STAMP.exec(value);
  if (!m) throw new Error(`${label} must be an ISO UTC timestamp`);
  const canonical = `${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5] ?? "000"}Z`;
  if (new Date(canonical).toISOString() !== canonical)
    throw new Error(`${label} must be an ISO UTC timestamp`);
  return canonical;
};
const optionalString = (x: unknown, label: string) =>
  x == null ? null : string(x, label);
const stringArray = (x: unknown, label: string, nonEmpty = false) => {
  const values = arr(x, label).map((v, i) => string(v, `${label}[${i}]`));
  if (nonEmpty && !values.length)
    throw new Error(`${label} must contain at least one value`);
  if (new Set(values).size !== values.length)
    throw new Error(`${label} contains duplicates`);
  return values;
};
const issueRef = (x: unknown, label: string) =>
  Number(id(x, /^#[1-9]\d*$/, label).slice(1));

function safeRegistry(raw: StrategyRegistryInput): SafeStrategyRegistry {
  const registry = obj(raw, "registry");
  if (registry.schema_version !== 1)
    throw new Error("registry.schema_version must equal 1");
  const registryId = id(
    registry.registry_id,
    /^[a-z][a-z0-9-]*$/,
    "registry.registry_id",
  );
  const revision = id(
    registry.revision,
    /^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*$/,
    "registry.revision",
  );
  if (
    enumValue(
      registry.status,
      new Set(["proposed", "accepted"]),
      "registry.status",
    ) !== "accepted"
  )
    throw new Error("only an accepted Strategy Registry can be projected");
  const governanceDecision = issueRef(
    registry.governance_decision,
    "registry.governance_decision",
  );
  const governanceDecisionKey = string(
    registry.governance_decision_key,
    "registry.governance_decision_key",
  );
  const observedAt = date(registry.observed_at, "registry.observed_at");
  const approvalRaw = obj(registry.approval, "registry.approval");
  if (
    enumValue(
      approvalRaw.state,
      new Set(["pending", "approved"]),
      "registry.approval.state",
    ) !== "approved" ||
    approvalRaw.approved_by !== "Ivan"
  )
    throw new Error("accepted registry must have Ivan approval");
  const approval = {
    decision: issueRef(approvalRaw.decision, "registry.approval.decision"),
    approvedBy: "Ivan" as const,
    approvedAt: timestamp(
      approvalRaw.approved_at,
      "registry.approval.approved_at",
    ),
  };
  const seen = (name: string) => new Set<string>();
  const goalIds = seen("goal");
  const milestoneIds = seen("milestone");
  const kpiIds = seen("KPI");
  const guardrailIds = seen("guardrail");
  const unique = (value: string, values: Set<string>, label: string) => {
    if (values.has(value)) throw new Error(`duplicate ${label}: ${value}`);
    values.add(value);
    return value;
  };
  const goals = arr(registry.goals, "registry.goals").map((item, index) => {
    const r = obj(item, `registry.goals[${index}]`);
    const key = unique(id(r.id, /^G-\d{3}$/, "Goal ID"), goalIds, "Goal ID");
    return {
      id: key,
      title: string(r.title, `${key}.title`),
      statement: string(r.statement, `${key}.statement`),
      sourceRefs: stringArray(r.source_refs, `${key}.source_refs`, true),
      kpiIds: r.kpi_ids == null ? [] : stringArray(r.kpi_ids, `${key}.kpi_ids`),
    };
  });
  if (!goals.length)
    throw new Error("registry.goals must contain at least one Goal");
  const milestones = arr(registry.milestones, "registry.milestones").map(
    (item, index) => {
      const r = obj(item, `registry.milestones[${index}]`);
      const key = unique(
        id(r.id, /^M-\d{3}$/, "Milestone ID"),
        milestoneIds,
        "Milestone ID",
      );
      const goalId = id(r.goal_id, /^G-\d{3}$/, `${key}.goal_id`);
      if (!goalIds.has(goalId))
        throw new Error(`${key}.goal_id references unknown ID`);
      return {
        id: key,
        goalId,
        title: string(r.title, `${key}.title`),
        outcome: string(r.outcome, `${key}.outcome`),
        lifecycle: enumValue(
          r.lifecycle,
          new Set(["active", "retired"]),
          `${key}.lifecycle`,
        ) as "active" | "retired",
        outcomeState: enumValue(
          r.outcome_state,
          new Set(["unassessed", "in_progress", "achieved", "not_achieved"]),
          `${key}.outcome_state`,
        ) as "unassessed" | "in_progress" | "achieved" | "not_achieved",
        sourceRefs: stringArray(r.source_refs, `${key}.source_refs`, true),
      };
    },
  );
  const kpis = arr(registry.kpis, "registry.kpis").map((item, index) => {
    const r = obj(item, `registry.kpis[${index}]`);
    const key = unique(id(r.id, /^KPI-\d{3}$/, "KPI ID"), kpiIds, "KPI ID");
    const goalId = id(r.goal_id, /^G-\d{3}$/, `${key}.goal_id`);
    if (!goalIds.has(goalId))
      throw new Error(`${key}.goal_id references unknown ID`);
    const measurement = obj(r.measurement, `${key}.measurement`);
    const sourceStatus = enumValue(
      measurement.source_status,
      new Set(["unset", "defined"]),
      `${key}.measurement.source_status`,
    ) as "unset" | "defined";
    const sourceRef = optionalString(
      measurement.source_ref,
      `${key}.measurement.source_ref`,
    );
    const cadence = optionalString(
      measurement.cadence,
      `${key}.measurement.cadence`,
    );
    const baselineDate =
      measurement.baseline_date == null
        ? null
        : date(measurement.baseline_date, `${key}.measurement.baseline_date`);
    if (sourceStatus === "defined" && (!sourceRef || !cadence || !baselineDate))
      throw new Error(
        `${key}.measurement requires source_ref, cadence and baseline_date when defined`,
      );
    if (sourceStatus === "unset" && (sourceRef || cadence || baselineDate))
      throw new Error(`${key}.measurement must not carry values while unset`);
    const target = obj(r.target, `${key}.target`);
    const targetStatus = enumValue(
      target.status,
      new Set(["unset", "proposed", "accepted"]),
      `${key}.target.status`,
    ) as "unset" | "proposed" | "accepted";
    const targetValue =
      target.value == null
        ? null
        : typeof target.value === "number" && Number.isFinite(target.value)
          ? target.value
          : (() => {
              throw new Error(`${key}.target.value must be finite`);
            })();
    const targetDate =
      target.target_date == null
        ? null
        : date(target.target_date, `${key}.target.target_date`);
    if (targetStatus === "accepted" && (targetValue == null || !targetDate))
      throw new Error(`${key}.target requires value and date when accepted`);
    if (targetStatus === "unset" && (targetValue != null || targetDate != null))
      throw new Error(`${key}.target must not carry values while unset`);
    return {
      id: key,
      goalId,
      title: string(r.title, `${key}.title`),
      definition: string(r.definition, `${key}.definition`),
      definitionStatus: enumValue(
        r.definition_status,
        new Set(["needs_approval", "accepted"]),
        `${key}.definition_status`,
      ) as "needs_approval" | "accepted",
      unit: string(r.unit, `${key}.unit`),
      measurement: { sourceStatus, sourceRef, cadence, baselineDate },
      target: { status: targetStatus, value: targetValue, targetDate },
      sourceRefs: stringArray(r.source_refs, `${key}.source_refs`, true),
    };
  });
  for (const goal of goals)
    for (const kpi of goal.kpiIds) {
      if (
        !kpiIds.has(kpi) ||
        kpis.find((x) => x.id === kpi)?.goalId !== goal.id
      )
        throw new Error(`${goal.id}.kpi_ids has invalid ownership`);
    }
  const guardrails = arr(registry.guardrails, "registry.guardrails").map(
    (item, index) => {
      const r = obj(item, `registry.guardrails[${index}]`);
      const key = unique(
        id(r.id, /^GR-\d{3}$/, "Guardrail ID"),
        guardrailIds,
        "Guardrail ID",
      );
      return {
        id: key,
        title: string(r.title, `${key}.title`),
        rule: string(r.rule, `${key}.rule`),
        lifecycle: enumValue(
          r.lifecycle,
          new Set(["active", "retired"]),
          `${key}.lifecycle`,
        ) as "active" | "retired",
        sourceRefs: stringArray(r.source_refs, `${key}.source_refs`, true),
      };
    },
  );
  return {
    schemaVersion: 1,
    registryId,
    revision,
    status: "accepted",
    governanceDecision,
    governanceDecisionKey,
    observedAt,
    approval,
    goals,
    milestones,
    kpis,
    guardrails,
  };
}

const approval = (issue: GithubIssueFact | undefined, key: string) =>
  Boolean(
    issue &&
    issue.kind === "Decision" &&
    issue.state === "CLOSED" &&
    issue.projectStatus === "Done" &&
    issue.decisionState === "Decided" &&
    issue.marker?.decision_state === "decided" &&
    issue.marker.approved_by === "Ivan" &&
    issue.marker.approval_keys?.includes(key),
  );
const placementEmpty = {
  goalId: null,
  milestoneId: null,
  kpiIds: [],
  guardrailIds: [],
  decisionNumber: null,
  temporaryException: false,
};

export function createGovernanceProjection(
  source: GovernanceSourceModel,
): GovernanceProjection {
  if (!SHA.test(source.sourceCommit))
    throw new Error("source commit must be an exact 40-character SHA");
  timestamp(source.retrievedAt, "retrievedAt");
  timestamp(source.snapshotAt, "snapshotAt");
  const registry = safeRegistry(source.registry);
  const byNumber = new Map<number, GithubIssueFact>();
  for (const issue of source.issues) {
    validateIssueShape(issue);
    if (byNumber.has(issue.number))
      throw new Error("duplicate GitHub issue number");
    byNumber.set(issue.number, issue);
  }
  if (
    !approval(
      byNumber.get(registry.governanceDecision),
      registry.governanceDecisionKey,
    )
  )
    throw new Error(
      "accepted Strategy Registry governance Decision is invalid",
    );
  if (
    !approval(
      byNumber.get(registry.approval.decision),
      `strategy-registry:${registry.revision}`,
    )
  )
    throw new Error("accepted Strategy Registry approval Decision is invalid");
  const exclusions = validateLegacyExclusions(
    source.legacyExclusions ?? [],
    byNumber,
  );
  const excluded = new Set(exclusions.map((x) => x.number));
  for (const issue of source.issues)
    for (const dependency of issue.dependencies ?? [])
      if (!byNumber.has(dependency.number) || excluded.has(dependency.number))
        throw new Error(`issue #${issue.number} has unresolved or excluded dependency`);
  const activeDependencyTargets = new Set(
    source.issues
      .filter((issue) => issue.state === "OPEN")
      .flatMap((issue) => issue.dependencies ?? [])
      .map((x) => x.number),
  );
  for (const issue of source.issues)
    if (!issue.kind && !excluded.has(issue.number))
      throw new Error(`issue #${issue.number} has unknown native Issue Type`);
  for (const item of exclusions)
    if (activeDependencyTargets.has(item.number))
      throw new Error(
        `legacy exclusion #${item.number} is referenced by an active dependency`,
      );
  const placements = new Map<number, SafeGovernanceIssue["placement"]>();
  const milestones = new Map(registry.milestones.map((x) => [x.id, x]));
  const kpis = new Map(registry.kpis.map((x) => [x.id, x]));
  const guardrails = new Map(registry.guardrails.map((x) => [x.id, x]));
  for (const issue of source.issues) {
    if (issue.kind !== "Product Change") continue;
    const marker = issue.marker ?? {};
    const exception = marker.strategic_placement === "needs-strategic-home";
    const mapped = [
      marker.strategy_revision,
      marker.goal_id,
      marker.milestone_id,
      marker.kpi_ids,
      marker.guardrail_ids,
    ].some((value) => value != null);
    if (exception && mapped)
      throw new Error(
        `Product Change #${issue.number} mixes temporary exception and placement`,
      );
    if (exception) {
      if (
        !marker.placement_decision ||
        !approval(
          byNumber.get(marker.placement_decision),
          `strategic-placement:#${issue.number}:needs-strategic-home`,
        )
      )
        throw new Error(
          `Product Change #${issue.number} exception lacks approval`,
        );
      placements.set(issue.number, {
        ...placementEmpty,
        decisionNumber: marker.placement_decision,
        temporaryException: true,
      });
      continue;
    }
    if (issue.state === "CLOSED" && !mapped && !marker.strategy_revision) {
      placements.set(issue.number, placementEmpty);
      continue;
    }
    if (
      marker.strategy_revision !== registry.revision ||
      !marker.goal_id ||
      !marker.milestone_id ||
      !marker.placement_decision
    )
      throw new Error(
        `Product Change #${issue.number} has missing current strategic placement`,
      );
    const milestone = milestones.get(marker.milestone_id);
    if (
      !registry.goals.some((x) => x.id === marker.goal_id) ||
      !milestone ||
      milestone.goalId !== marker.goal_id ||
      milestone.lifecycle !== "active"
    )
      throw new Error(
        `Product Change #${issue.number} placement references invalid Goal/Milestone`,
      );
    for (const key of marker.kpi_ids ?? []) {
      const k = kpis.get(key);
      if (
        !k ||
        k.goalId !== marker.goal_id ||
        k.definitionStatus !== "accepted" ||
        k.measurement.sourceStatus !== "defined" ||
        k.target.status !== "accepted"
      )
        throw new Error(
          `Product Change #${issue.number} references unavailable KPI`,
        );
    }
    for (const key of marker.guardrail_ids ?? [])
      if (!guardrails.get(key) || guardrails.get(key)?.lifecycle !== "active")
        throw new Error(
          `Product Change #${issue.number} references retired Guardrail`,
        );
    if (
      !approval(
        byNumber.get(marker.placement_decision),
        `strategic-placement:#${issue.number}:${registry.revision}:${marker.goal_id}:${marker.milestone_id}`,
      )
    )
      throw new Error(
        `Product Change #${issue.number} placement lacks approval`,
      );
    placements.set(issue.number, {
      goalId: marker.goal_id,
      milestoneId: marker.milestone_id,
      kpiIds: marker.kpi_ids ?? [],
      guardrailIds: marker.guardrail_ids ?? [],
      decisionNumber: marker.placement_decision,
      temporaryException: false,
    });
  }
  const resolve = (
    issue: GithubIssueFact,
  ): SafeGovernanceIssue["placement"] => {
    if (issue.kind === "Product Change")
      return (
        placements.get(issue.number) ??
        (() => {
          throw new Error(`Product Change #${issue.number} was not validated`);
        })()
      );
    if (issue.kind === "Ticket" || issue.kind === "Bug") {
      if (excluded.has(issue.number)) return placementEmpty;
      if (
        !issue.parentNumber ||
        byNumber.get(issue.parentNumber)?.kind !== "Product Change"
      )
        throw new Error(
          `${issue.kind} #${issue.number} must have a direct Product Change parent`,
        );
      if (
        issue.marker &&
        Object.entries(issue.marker).some(
          ([key, value]) =>
            key !== "kind" &&
            value != null &&
            (!Array.isArray(value) || value.length),
        )
      )
        throw new Error(
          `${issue.kind} #${issue.number} cannot own governance marker fields`,
        );
      return (
        placements.get(issue.parentNumber) ??
        (() => {
          throw new Error(
            `${issue.kind} #${issue.number} parent placement is invalid`,
          );
        })()
      );
    }
    return placementEmpty;
  };
  return {
    schemaVersion: GOVERNANCE_PROJECTION_SCHEMA_VERSION,
    sourceRepository: GOVERNANCE_SOURCE_REPOSITORY,
    sourceCommit: source.sourceCommit.toLowerCase(),
    registryRevision: registry.revision,
    retrievedAt: timestamp(source.retrievedAt, "retrievedAt"),
    snapshotAt: timestamp(source.snapshotAt, "snapshotAt"),
    registry,
    issues: source.issues
      .filter((x) => x.kind && !excluded.has(x.number))
      .map((x) => safeIssue(x, resolve(x)))
      .sort((a, b) => a.number - b.number),
    legacyExclusions: exclusions,
  };
}

function validateIssueShape(issue: GithubIssueFact) {
  if (
    !Number.isInteger(issue.number) ||
    issue.number < 1 ||
    !string(issue.title, "issue.title") ||
    !ISSUE_URL.test(issue.url) ||
    issue.url !==
      `https://github.com/${GOVERNANCE_SOURCE_REPOSITORY}/issues/${issue.number}` ||
    issue.repository !== GOVERNANCE_SOURCE_REPOSITORY
  )
    throw new Error(`invalid bounded GitHub fact for issue #${issue.number}`);
  timestamp(issue.updatedAt, `#${issue.number}.updatedAt`);
  if (issue.kind && !kinds.has(issue.kind))
    throw new Error(`issue #${issue.number} has unsupported Issue Type`);
  if (issue.kind && issue.projectStatus == null)
    throw new Error(`typed issue #${issue.number} lacks Project status`);
  if (issue.projectStatus != null && !statuses.has(issue.projectStatus))
    throw new Error(`issue #${issue.number} has unsupported Project status`);
  if (issue.decisionState != null && !decisionStates.has(issue.decisionState))
    throw new Error(`issue #${issue.number} has unsupported Decision state`);
  if (issue.kind === "Decision" && issue.decisionState == null)
    throw new Error(`Decision #${issue.number} lacks Decision state`);
  if (issue.marker) {
    const marker = issue.marker as Record<string, unknown>;
    const allowed = new Set([
      "kind", "strategy_revision", "goal_id", "milestone_id", "kpi_ids",
      "guardrail_ids", "placement_decision", "approval_keys", "approved_by",
      "decision_state", "decision_key", "strategic_placement",
    ]);
    for (const key of Object.keys(marker))
      if (!allowed.has(key))
        throw new Error(`issue #${issue.number} marker has unknown field`);
    for (const key of ["strategy_revision", "goal_id", "milestone_id", "approved_by", "decision_state", "decision_key", "strategic_placement"])
      if (marker[key] != null && (typeof marker[key] !== "string" || !marker[key]?.trim()))
        throw new Error(`issue #${issue.number} marker ${key} is malformed`);
    if (marker.placement_decision != null && (!Number.isInteger(marker.placement_decision) || (marker.placement_decision as number) < 1))
      throw new Error(`issue #${issue.number} marker placement_decision is malformed`);
    for (const key of ["kpi_ids", "guardrail_ids", "approval_keys"])
      if (marker[key] != null && (!Array.isArray(marker[key]) || marker[key].some((entry) => typeof entry !== "string" || !entry.trim())))
        throw new Error(`issue #${issue.number} marker ${key} is malformed`);
  }
  if (issue.marker?.decision_key && issue.kind !== "Decision")
    throw new Error(
      `issue #${issue.number} marker is inconsistent with native type`,
    );
  if (issue.marker?.kind && issue.marker.kind !== issue.kind)
    throw new Error(`issue #${issue.number} marker kind is inconsistent with native type`);
  for (const list of [issue.marker?.kpi_ids, issue.marker?.guardrail_ids, issue.marker?.approval_keys])
    if (list && new Set(list).size !== list.length)
      throw new Error(`issue #${issue.number} governance marker contains duplicates`);
  const dependencyNumbers = (issue.dependencies ?? []).map((d) => d.number);
  if (new Set(dependencyNumbers).size !== dependencyNumbers.length)
    throw new Error(`issue #${issue.number} has duplicate dependencies`);
  for (const d of issue.dependencies ?? [])
    if (
      d.repository !== GOVERNANCE_SOURCE_REPOSITORY ||
      !Number.isInteger(d.number)
    )
      throw new Error(
        `issue #${issue.number} has external or ambiguous dependency`,
      );
  for (const login of issue.assigneeLogins ?? [])
    if (typeof login !== "string" || !LOGIN.test(login))
      throw new Error(`issue #${issue.number} has invalid assignee login`);
  for (const pr of issue.pullRequests ?? [])
    if (!PR_URL.test(pr.url) || !PR_STATES.has(pr.state))
      throw new Error(`issue #${issue.number} has invalid pull request reference`);
}
function validateLegacyExclusions(
  exclusions: LegacyExclusion[],
  byNumber: Map<number, GithubIssueFact>,
) {
  const seen = new Set<number>();
  return exclusions.map((item) => {
    if (seen.has(item.number)) throw new Error("duplicate legacy exclusion");
    seen.add(item.number);
    const issue = byNumber.get(item.number);
    if (
      !issue ||
      (item.reason === "legacy_missing_issue_type" ? issue.kind : !issue.kind || (issue.kind !== "Ticket" && issue.kind !== "Bug") || item.nativeKind !== issue.kind) ||
      item.state !== "CLOSED" ||
      item.projectStatus !== "Done" ||
      (item.reason !== "legacy_missing_issue_type" && item.reason !== "legacy_non_product_change_parent") ||
      issue.state !== "CLOSED" ||
      issue.projectStatus !== "Done" ||
      issue.parentNumber !== item.parentNumber ||
      item.title !== issue.title ||
      item.url !== issue.url ||
      !ISSUE_URL.test(item.url)
    )
      throw new Error(`legacy exclusion #${item.number} is not safe`);
    const parent = byNumber.get(item.parentNumber);
    if (
      (item.reason === "legacy_missing_issue_type" && (parent ? parent.kind : issue.parentKind) !== "Product Change") ||
      (item.reason === "legacy_non_product_change_parent" && (!parent || parent.kind === "Product Change" || parent.state !== "CLOSED")) ||
      item.parentNumber === item.number ||
      (issue.marker &&
        Object.entries(issue.marker).some(
          ([key, value]) =>
            key !== "kind" &&
            value != null &&
            (!Array.isArray(value) || value.length),
        ))
    )
      throw new Error(
        `legacy exclusion #${item.number} is not a closed child without governance fields`,
      );
    return {
      number: item.number,
      title: string(item.title, "legacy title"),
      url: item.url,
      state: "CLOSED" as const,
      projectStatus: "Done" as const,
      parentNumber: item.parentNumber,
      reason: item.reason,
      ...(item.nativeKind ? { nativeKind: item.nativeKind } : {}),
    };
  });
}
function safeIssue(
  issue: GithubIssueFact,
  placement: SafeGovernanceIssue["placement"],
): SafeGovernanceIssue {
  return {
    number: issue.number,
    title: issue.title.trim(),
    url: issue.url,
    kind: issue.kind!,
    state: issue.state,
    projectStatus: issue.projectStatus as ProjectStatus,
    decisionState: (issue.decisionState ?? null) as DecisionState,
    updatedAt: timestamp(issue.updatedAt, `#${issue.number}.updatedAt`),
    assigneeLogins: [...(issue.assigneeLogins ?? [])].sort(),
    parentNumber: issue.parentNumber ?? null,
    dependencyNumbers: [
      ...(issue.dependencies ?? []).map((x) => x.number),
    ].sort((a, b) => a - b),
    pullRequests: [...(issue.pullRequests ?? [])]
      .map((x) => ({
        url: string(x.url, "pull request url"),
        state: string(x.state, "pull request state"),
      }))
      .sort((a, b) => a.url.localeCompare(b.url)),
    placement,
  };
}
