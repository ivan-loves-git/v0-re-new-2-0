/**
 * Manual operator command. Run from a credentialed Codex shell:
 *   pnpm governance:refresh                    # fetch + validate only
 *   pnpm governance:refresh -- --apply --confirm <revision>:<digest>
 * No browser/runtime WAVE process calls GitHub; this is the only collector.
 */
import { execFileSync } from "node:child_process";
import { parse } from "yaml";
import { createClient } from "@supabase/supabase-js";
import { refreshGovernanceProjection } from "@/lib/governance-projection/refresh";
import {
  type LegacyExclusion,
  type GithubIssueFact,
  type GovernanceSourceModel,
} from "@/lib/governance-projection/model";

const repo = "re-new-team/renew-governance";
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const valueAfter = (flag: string) => args[args.indexOf(flag) + 1];

function gh(args: string[]) {
  return execFileSync("gh", args, { encoding: "utf8" });
}
function marker(body: string | null | undefined) {
  const yaml = body?.match(/<!--\s*renew-governance\s*\n([\s\S]*?)-->/)?.[1];
  if (!yaml) return undefined;
  const raw = parse(yaml);
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("governance marker must be an object");
  const values = raw as Record<string, unknown>;
  const allowed = new Set(["schema", "kind", "correlation_id", "pdr_reference", "pdr_work_card_id", "pdr_strategic_item_id", "publication", "bootstrap", "strategy_revision", "goal_id", "milestone_id", "kpi_ids", "guardrail_ids", "placement_decision", "approval_keys", "approved_by", "decision_state", "decision_key", "strategic_placement"]);
  if (values.schema !== 1) throw new Error("governance marker schema must equal 1");
  for (const key of Object.keys(values)) if (!allowed.has(key)) throw new Error(`unknown governance marker field: ${key}`);
  const text = (key: string) => {
    const value = values[key];
    if (value == null) return undefined;
    if (typeof value !== "string" || !value.trim()) throw new Error(`governance marker ${key} must be a non-empty string`);
    return value.trim();
  };
  const ids = (key: string) => {
    const value = values[key];
    if (value == null) return undefined;
    if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || !entry.trim())) throw new Error(`governance marker ${key} must be a string array`);
    if (new Set(value).size !== value.length) throw new Error(`governance marker ${key} contains duplicates`);
    return value.map((entry) => entry.trim());
  };
  const issueNumber = (key: string) => {
    const value = values[key];
    if (value == null) return undefined;
    if (typeof value !== "string" || !/^#[1-9]\d*$/.test(value)) throw new Error(`governance marker ${key} must be an exact issue reference`);
    return Number(value.slice(1));
  };
  return {
    kind: ({ decision: "Decision", "product-change": "Product Change", ticket: "Ticket", bug: "Bug" } as const)[text("kind") ?? ""],
    strategy_revision: text("strategy_revision"), goal_id: text("goal_id"), milestone_id: text("milestone_id"),
    kpi_ids: ids("kpi_ids"), guardrail_ids: ids("guardrail_ids"), placement_decision: issueNumber("placement_decision"),
    approval_keys: ids("approval_keys"), approved_by: text("approved_by"), decision_state: text("decision_state"),
    decision_key: text("decision_key"), strategic_placement: text("strategic_placement"),
  };
}

function collect(): GovernanceSourceModel {
  const sourceCommit = gh([
    "api",
    `repos/${repo}/commits/main`,
    "--jq",
    ".sha",
  ]).trim();
  const registry = parse(
    gh([
      "api",
      `repos/${repo}/contents/strategy/registry.yaml?ref=${sourceCommit}`,
      "-H",
      "Accept: application/vnd.github.raw+json",
    ]),
  ) as Record<string, unknown>;
  const items: Record<string, unknown>[] = [];
  let cursor: string | null = null;
  do {
    const query = `query($cursor:String) { organization(login:"re-new-team") { projectV2(number:1) { items(first:100, after:$cursor) { nodes { content { ... on Issue { number title url state updatedAt body repository{nameWithOwner} issueType{name} parent{number issueType{name}} assignees(first:20){nodes{login} pageInfo{hasNextPage}} blockedBy(first:100){nodes{number repository{nameWithOwner}} pageInfo{hasNextPage}} closedByPullRequestsReferences(first:100){nodes{url state} pageInfo{hasNextPage}} } } fieldValues(first:50){nodes{... on ProjectV2ItemFieldSingleSelectValue{name field{... on ProjectV2SingleSelectField{name}}}} pageInfo{hasNextPage}} } pageInfo{hasNextPage endCursor} } } } }`;
    const response = JSON.parse(
      gh([
        "api",
        "graphql",
        "-f",
        `query=${query}`,
        "-f",
        `cursor=${cursor ?? ""}`,
      ]),
    ) as {
      data?: {
        organization?: {
          projectV2?: {
            items?: {
              nodes?: Record<string, unknown>[];
              pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
            };
          };
        };
      };
      errors?: unknown;
    };
    const page = response.data?.organization?.projectV2?.items;
    if (
      response.errors ||
      !page?.nodes ||
      page.nodes.some(
        (item) =>
          ["assignees", "blockedBy", "closedByPullRequestsReferences"].some(
            (field) =>
              Boolean(
                (
                  item.content as Record<
                    string,
                    Record<string, { pageInfo?: { hasNextPage?: boolean } }>
                  > | null
                )?.[field]?.pageInfo?.hasNextPage,
              ),
          ) ||
          Boolean(
            (
              item.fieldValues as {
                pageInfo?: { hasNextPage?: boolean };
              } | null
            )?.pageInfo?.hasNextPage,
          ),
      )
    )
      throw new Error("GitHub GraphQL governance collection is incomplete");
    items.push(...page.nodes);
    cursor = page.pageInfo?.hasNextPage
      ? (page.pageInfo.endCursor ?? null)
      : null;
    if (page.pageInfo?.hasNextPage && !cursor)
      throw new Error("GitHub GraphQL governance pagination is incomplete");
  } while (cursor);
  const legacyExclusions: LegacyExclusion[] = [];
  const issues: GithubIssueFact[] = items.flatMap((item) => {
    const issue = item.content as Record<string, unknown> | null;
    if (
      !issue ||
      (issue.repository as { nameWithOwner?: string }).nameWithOwner !== repo
    )
      throw new Error("Project contains a non-governance issue");
    const kind = (issue.issueType as { name?: string } | null)?.name;
    const fields =
      (item.fieldValues as { nodes?: Record<string, unknown>[] })?.nodes ?? [];
    const field = (name: string) =>
      fields.find(
        (value) => (value.field as { name?: string } | null)?.name === name,
      )?.name as string | undefined;
    const parent = issue.parent as {
      number?: number;
      issueType?: { name?: string } | null;
    } | null;
    if (
      kind !== "Product Change" &&
      kind !== "Decision" &&
      kind !== "Ticket" &&
      kind !== "Bug"
    ) {
      const parsedMarker = marker(
        typeof issue.body === "string" ? issue.body : null,
      );
      if (
        issue.state !== "CLOSED" ||
        field("Status") !== "Done" ||
        !parent?.number ||
        (parsedMarker &&
          Object.values(parsedMarker).some(
            (value) => value != null && (!Array.isArray(value) || value.length),
          ))
      )
        throw new Error(`issue #${issue.number} has unknown native Issue Type`);
      legacyExclusions.push({
        number: Number(issue.number),
        title: String(issue.title),
        url: String(issue.url),
        state: "CLOSED",
        projectStatus: "Done",
        parentNumber: parent.number,
        reason: "legacy_missing_issue_type",
      });
      return [
        {
          number: Number(issue.number),
          title: String(issue.title),
          url: String(issue.url),
          repository: (issue.repository as { nameWithOwner?: string })
            .nameWithOwner,
          state: "CLOSED" as const,
          projectStatus: "Done",
          updatedAt: String(issue.updatedAt),
          parentNumber: parent.number,
          parentKind: parent.issueType?.name as GithubIssueFact["parentKind"],
          marker: parsedMarker,
        },
      ];
    }
    return [
      {
        number: Number(issue.number),
        title: String(issue.title),
        url: String(issue.url),
        repository: (issue.repository as { nameWithOwner?: string })
          .nameWithOwner,
        kind,
        state: issue.state === "CLOSED" ? "CLOSED" : "OPEN",
        projectStatus: field("Status") ?? null,
        decisionState: field("Decision state") ?? null,
        updatedAt: String(issue.updatedAt),
        assigneeLogins: (
          (issue.assignees as { nodes?: { login: string }[] })?.nodes ?? []
        ).map((entry) => entry.login),
        parentNumber: parent?.number ?? null,
        parentKind: parent?.issueType?.name as GithubIssueFact["parentKind"],
        dependencies: (
          (
            issue.blockedBy as {
              nodes?: {
                number: number;
                repository?: { nameWithOwner?: string };
              }[];
            }
          )?.nodes ?? []
        ).map((entry) => ({
          number: entry.number,
          repository: entry.repository?.nameWithOwner ?? "",
        })),
        pullRequests: (
          (
            issue.closedByPullRequestsReferences as {
              nodes?: { url: string; state: string }[];
            }
          )?.nodes ?? []
        ).map((entry) => ({ url: entry.url, state: entry.state })),
        marker: marker(typeof issue.body === "string" ? issue.body : null),
      },
    ];
  });
  const snapshotAt = new Date().toISOString();
  const byNumber = new Map(issues.map((entry) => [entry.number, entry]));
  for (const entry of issues) {
    const parent = entry.parentNumber ? byNumber.get(entry.parentNumber) : undefined;
    if ((entry.kind === "Ticket" || entry.kind === "Bug") && entry.state === "CLOSED" && entry.projectStatus === "Done" && parent && parent.kind !== "Product Change" && parent.state === "CLOSED" && !entry.marker) {
      legacyExclusions.push({ number: entry.number, title: entry.title, url: entry.url, state: "CLOSED", projectStatus: "Done", parentNumber: entry.parentNumber, reason: "legacy_non_product_change_parent", nativeKind: entry.kind });
    }
  }
  return {
    sourceCommit,
    retrievedAt: snapshotAt,
    snapshotAt,
    registry,
    issues,
    legacyExclusions,
  };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const client = apply && url && key ? createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) : null;
  const requireClient = () => {
    if (!client) throw new Error("credentialed operator environment is required");
    return client;
  };
  const receipt = await refreshGovernanceProjection({
    collect: async () => collect(),
    currentDigest: async () => {
      const { data, error } = await requireClient().from("wave_governance_projection_current").select("snapshot_digest").eq("projection_key", "current").maybeSingle();
      if (error) throw new Error("cannot read current snapshot");
      return data?.snapshot_digest ?? "";
    },
    apply: async ({ projection, digest, canonicalText, expectedDigest }) => {
      const { data, error } = await requireClient().rpc("apply_wave_governance_snapshot", {
        p_source_commit: projection.sourceCommit, p_registry_revision: projection.registryRevision,
        p_retrieved_at: projection.retrievedAt, p_snapshot_at: projection.snapshotAt,
        p_payload: projection, p_validation: { result: "valid", schema_version: projection.schemaVersion },
        p_canonical_text: canonicalText, p_snapshot_digest: digest,
        p_expected_current_digest: expectedDigest, p_actor: "codex-manual-governance-refresh",
      });
      if (error || !data) throw new Error("snapshot apply failed");
      return { digest, applied: Boolean(data) };
    },
    readback: async () => {
      const { data, error } = await requireClient().from("wave_governance_projection_current").select("snapshot_digest").eq("projection_key", "current").single();
      if (error || !data?.snapshot_digest) throw new Error("snapshot readback failed");
      return data.snapshot_digest;
    },
  }, { apply, confirm: valueAfter("--confirm") });
  console.log(
    JSON.stringify(
      {
        ...receipt,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
