import { parse } from "yaml";

import { type GithubMarker } from "@/lib/governance-projection/model";

const allowedFields = new Set([
  "schema", "kind", "correlation_id", "pdr_reference", "pdr_work_card_id",
  "pdr_strategic_item_id", "publication", "bootstrap", "strategy_revision",
  "goal_id", "milestone_id", "kpi_ids", "guardrail_ids", "placement_decision",
  "approval_keys", "approved_by", "decision_state", "decision_key",
  "strategic_placement",
]);

/** Parses only the bounded metadata block used by the GitHub collector. */
export function parseGovernanceMarker(body: string | null | undefined): GithubMarker | undefined {
  const yaml = body?.match(/<!--\s*renew-governance\s*\n([\s\S]*?)-->/)?.[1];
  if (!yaml) return undefined;
  const raw = parse(yaml);
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("governance marker must be an object");
  const values = raw as Record<string, unknown>;
  if (values.schema !== 1) throw new Error("governance marker schema must equal 1");
  for (const key of Object.keys(values))
    if (!allowedFields.has(key)) throw new Error(`unknown governance marker field: ${key}`);
  const text = (key: string) => {
    const value = values[key];
    if (value == null) return undefined;
    if (typeof value !== "string" || !value.trim())
      throw new Error(`governance marker ${key} must be a non-empty string`);
    return value.trim();
  };
  const ids = (key: string) => {
    const value = values[key];
    if (value == null) return undefined;
    if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || !entry.trim()))
      throw new Error(`governance marker ${key} must be a string array`);
    const result = value.map((entry) => entry.trim());
    if (new Set(result).size !== result.length)
      throw new Error(`governance marker ${key} contains duplicates`);
    return result;
  };
  const issueNumber = (key: string) => {
    // YAML interprets an unquoted # as a comment. Read the source line so the
    // documented, live `placement_decision: #36` spelling remains supported.
    const value = values[key] ?? yaml.match(new RegExp(`^${key}:\\s*(#[1-9]\\d*)\\s*$`, "m"))?.[1];
    if (value == null) return undefined;
    if (typeof value !== "string" || !/^#[1-9]\d*$/.test(value))
      throw new Error(`governance marker ${key} must be an exact issue reference`);
    return Number(value.slice(1));
  };
  const kindText = text("kind");
  const kind = ({ decision: "Decision", "product-change": "Product Change", ticket: "Ticket", bug: "Bug" } as const)[kindText ?? ""];
  if (kindText && !kind) throw new Error("governance marker kind is unsupported");
  const uuid = (key: string) => {
    const value = text(key);
    if (value && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
      throw new Error(`governance marker ${key} must be a UUID`);
  };
  const pdrRef = text("pdr_reference");
  if (pdrRef && !/^W-\d{3}$/.test(pdrRef)) throw new Error("governance marker pdr_reference must be a work-card reference");
  uuid("pdr_work_card_id"); uuid("pdr_strategic_item_id");
  const publication = text("publication");
  if (publication && publication !== "manual" && publication !== "direct-github") throw new Error("governance marker publication is unsupported");
  const bootstrap = text("bootstrap");
  if (bootstrap && bootstrap !== "manual") throw new Error("governance marker bootstrap is unsupported");
  return {
    kind, strategy_revision: text("strategy_revision"), goal_id: text("goal_id"), milestone_id: text("milestone_id"),
    kpi_ids: ids("kpi_ids"), guardrail_ids: ids("guardrail_ids"), placement_decision: issueNumber("placement_decision"),
    approval_keys: ids("approval_keys"), approved_by: text("approved_by"), decision_state: text("decision_state"),
    decision_key: text("decision_key"), strategic_placement: text("strategic_placement"),
  };
}
