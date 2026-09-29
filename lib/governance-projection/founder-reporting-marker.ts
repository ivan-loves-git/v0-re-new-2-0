import { createHash } from "node:crypto";
import { parseDocument } from "yaml";
import { z } from "zod";

import { stableJson, type FounderReportingSource } from "@/lib/governance-projection/model";

const timestamp = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/).refine(
  (value) => !Number.isNaN(new Date(value).valueOf()) && new Date(value).toISOString() === value,
);
const commentUrl = (issueNumber: number) => z.string().regex(
  new RegExp(`^https://github\\.com/re-new-team/renew-governance/issues/${issueNumber}#issuecomment-[1-9]\\d*$`),
);
const verifiedRelease = (issueNumber: number) => z.object({
  state: z.literal("verified"),
  commit: z.string().regex(/^[0-9a-f]{40}$/),
  released_at: timestamp,
  verified_at: timestamp,
  proof_url: commentUrl(issueNumber),
}).strict().refine((value) => value.verified_at >= value.released_at, "verification precedes release");
const summary = (issueNumber: number) => z.object({
  text: z.string().trim().min(1).max(240).refine(
    (value) => !/[\r\n\x00-\x1f\x7f]/.test(value) && !/https?:\/\/|\b\S+@\S+\b/i.test(value),
    "summary must be one plain, link-free line",
  ),
  approval_url: commentUrl(issueNumber),
}).strict();

/** Parses a separate, private GitHub issue-body marker; no body prose escapes this seam. */
export function parseFounderReportingMarker(
  body: string | null | undefined,
  issueNumber: number,
): FounderReportingSource | undefined {
  const source = body ?? "";
  const openers = [...source.matchAll(/<!--\s*renew-founder-reporting\b/g)];
  if (openers.length > 1) throw new Error(`Product Change #${issueNumber} has multiple founder reporting blocks`);
  if (!openers.length) return undefined;
  const block = /^<!--[ \t]*renew-founder-reporting[ \t]*\r?\n([\s\S]*?)-->/.exec(source.slice(openers[0].index));
  if (!block) throw new Error(`Product Change #${issueNumber} has malformed founder reporting block`);
  const document = parseDocument(block[1], { uniqueKeys: true });
  if (document.errors.length) throw new Error(`Product Change #${issueNumber} has invalid founder reporting YAML`);
  const raw = document.toJS();
  const schema = z.object({
    schema: z.literal(1),
    disposition: z.enum(["cancelled", "superseded"]).optional(),
    release: z.union([
      z.object({ state: z.literal("not_released") }).strict(),
      verifiedRelease(issueNumber),
    ]).optional(),
    summary: summary(issueNumber).optional(),
  }).strict();
  const result = schema.safeParse(raw);
  if (!result.success) throw new Error(`Product Change #${issueNumber} has invalid founder reporting fields`);
  if (result.data.summary && result.data.release?.state !== "verified")
    throw new Error(`Product Change #${issueNumber} has a summary without verified release`);
  const { disposition, release, summary: approvedSummary } = result.data;
  const safe = {
    ...(disposition ? { disposition } : {}),
    ...(release ? { release: release.state === "not_released" ? { state: "not_released" as const } : {
      state: "verified" as const,
      commit: release.commit,
      releasedAt: release.released_at,
      verifiedAt: release.verified_at,
      proofUrl: release.proof_url,
    } } : {}),
    ...(approvedSummary ? { summary: { text: approvedSummary.text, approvalUrl: approvedSummary.approval_url } } : {}),
  };
  return {
    ...safe,
    evidenceRevision: createHash("sha256").update(stableJson(safe)).digest("hex"),
  };
}
