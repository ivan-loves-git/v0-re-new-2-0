import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  assertAuthorizedCandidate,
  assertCandidatePointer,
  assertDeployedQaContract,
  buildQaContract,
  stableQaOrigin,
} from "@/lib/qa/permanent-contract.mjs"
import { assertQaMailEnvelope, qaMailPolicyFromEnv } from "@/lib/email/qa-mail-policy"
import { buildFixtureManifest } from "@/lib/qa/phase-b.mjs"
import { assertMatchingStructureFingerprint, fingerprintStructureRows } from "@/lib/qa/structure-fingerprint.mjs"
import { assertNoTopLevelTransactionControl } from "@/lib/qa/sql-safety.mjs"

const QA_REF = "ypzrsrykirpqerfpozdm"
const SHA = "a".repeat(40)
const FINGERPRINT = "b".repeat(64)

type GoldenWorkflowEvent =
  | { name: "repository_dispatch"; runId: number }
  | { name: "workflow_run"; runId: number; conclusion: string; provenance: string }
  | { name: string; runId: number }

function expectedGoldenConcurrencyGroup(event: GoldenWorkflowEvent) {
  const isLaneCandidate = event.name === "repository_dispatch" || (
    event.name === "workflow_run" &&
    "conclusion" in event &&
    event.conclusion === "success" &&
    event.provenance === "pull_request"
  )
  return isLaneCandidate ? "renew-permanent-qa" : `renew-permanent-qa-ignored-${event.runId}`
}

describe("permanent QA lane contract", () => {
  it("pins the provisional v3 fingerprint and five immutable schema inputs", () => {
    const contract = JSON.parse(readFileSync(`${process.cwd()}/supabase/qa-contract.json`, "utf8"))

    expect(contract).toEqual({
      version: "771-permanent-qa-v3-health-recovery-retry-20260823",
      structureFingerprint: "37d01bc56c45aa8fe754893427feacb9da300e62449d34f85e331710eca33f24",
      files: [
        { path: "supabase/schema/771_extensions.sql", sha256: "755e4469be6630f4a5d274f503a00a17521606a4b36ae6f2f277a005465e68e9" },
        { path: "supabase/schema/qa_control.sql", sha256: "ee0e0136976c0408a4f1d95fe8f071c994e4667824c79804a8b7f3a9da71040e" },
        { path: "supabase/schema/permanent_qa_rebuild.sql", sha256: "20565af77093399b6b8ebc7e27ebc78e778faf9df802b702b7d86eea9f323291" },
        { path: "supabase/schema/771_public_schema.sql", sha256: "593d9d2b813c9047568dd5d863e2d4644a18493cff0e63142518fcfeb554788b" },
        { path: "supabase/schema/771_test_storage.sql", sha256: "55a91d3c3db75e6ea9d0d55f3d0165bb087e83451174147c58a7c951dc91e8b4" },
      ],
    })
  })

  it("accepts only the stable protected qa alias and exact deployed identity", () => {
    const origin = stableQaOrigin()
    expect(origin).toBe("https://renew-overnight-validation-git-59fa20-myworkmail4-pngs-projects.vercel.app")
    const expected = buildQaContract({ projectRef: QA_REF, candidateSha: SHA, structureFingerprint: FINGERPRINT })
    const actual = { ...expected, origin, apiRef: QA_REF, databaseRef: QA_REF, storageRef: QA_REF, mailPolicy: "allowlist", mailTransport: "simulated" }
    expect(assertDeployedQaContract(expected, actual)).toEqual(actual)
    for (const mutation of [
      { origin: "https://renew-overnight-validation-git-qa-myworkmail4-pngs-projects.vercel.app" },
      { origin: "https://app.re-new.team" },
      { origin: "https://unrelated.vercel.app" },
      { projectRef: "iiuqcdnmxhtyispnykgf" },
      { candidateSha: "c".repeat(40) },
      { validationProject: "v0-re-new-2-0" },
      { structureFingerprint: "d".repeat(64) },
      { databaseRef: "c".repeat(20) },
      { mailPolicy: "off" },
      { mailTransport: "provider" },
    ]) {
      expect(() => assertDeployedQaContract(expected, { ...actual, ...mutation })).toThrow(/QA contract failed:/)
    }
  })

  it("accepts a same-repository branch only when its head is the exact candidate", () => {
    expect(assertCandidatePointer({
      repository: "ivan-loves-git/v0-re-new-2-0",
      candidateBranch: "codex/release-a",
      candidateSha: SHA,
      branchHeadSha: SHA,
    })).toEqual({ candidateBranch: "codex/release-a", candidateSha: SHA })
    expect(() => assertCandidatePointer({ repository: "foreign/repo", candidateBranch: "codex/release-a", candidateSha: SHA, branchHeadSha: SHA })).toThrow("QA candidate failed: repository")
    expect(() => assertCandidatePointer({ repository: "ivan-loves-git/v0-re-new-2-0", candidateBranch: "qa", candidateSha: SHA, branchHeadSha: SHA })).toThrow("QA candidate failed: branch")
    expect(() => assertCandidatePointer({ repository: "ivan-loves-git/v0-re-new-2-0", candidateBranch: "codex/release-a", candidateSha: SHA, branchHeadSha: "c".repeat(40) })).toThrow("QA candidate failed: sha")
  })

  it("requires a trusted main controller, authorized actor, exact PR and green Verify", () => {
    const input = {
      controllerRef: "refs/heads/main",
      controllerSha: "c".repeat(40),
      mainSha: "c".repeat(40),
      actorPermission: "write",
      candidateBranch: "codex/release-a",
      candidateSha: SHA,
      pull: { base: { ref: "main" }, head: { ref: "codex/release-a", sha: SHA, repo: { full_name: "ivan-loves-git/v0-re-new-2-0" } }, draft: false },
      verifyCheck: { name: "Verify", conclusion: "success", head_sha: SHA },
    }
    expect(assertAuthorizedCandidate(input)).toEqual({ candidateBranch: input.candidateBranch, candidateSha: SHA })
    expect(() => assertAuthorizedCandidate({ ...input, controllerRef: "refs/heads/codex/release-a" })).toThrow("QA candidate failed: controller")
    expect(() => assertAuthorizedCandidate({ ...input, actorPermission: "read" })).toThrow("QA candidate failed: actor-permission")
    expect(() => assertAuthorizedCandidate({ ...input, pull: { ...input.pull, draft: true } })).toThrow("QA candidate failed: pull-request")
    expect(() => assertAuthorizedCandidate({ ...input, verifyCheck: { ...input.verifyCheck, conclusion: "failure" } })).toThrow("QA candidate failed: verify-check")
  })

  it("shares the non-cancelling lane only with valid candidates and daily health", () => {
    const golden = readFileSync(`${process.cwd()}/.github/workflows/golden-journeys.yml`, "utf8")
    const health = readFileSync(`${process.cwd()}/.github/workflows/qa-daily-health.yml`, "utf8")
    const concurrency = golden.split("\njobs:", 1)[0]

    expect(concurrency).toContain("github.event_name == 'repository_dispatch'")
    expect(concurrency).toContain("github.event_name == 'workflow_run'")
    expect(concurrency).toContain("github.event.workflow_run.conclusion == 'success'")
    expect(concurrency).toContain("github.event.workflow_run.event == 'pull_request'")
    expect(concurrency).toContain("format('renew-permanent-qa-ignored-{0}', github.run_id)")
    expect(concurrency).toContain("cancel-in-progress: false")
    expect(concurrency).not.toContain("cancel-in-progress: true")
    expect(health).toContain("group: renew-permanent-qa")
    expect(health).toContain("cancel-in-progress: false")
    expect(health).not.toContain("cancel-in-progress: true")

    expect(expectedGoldenConcurrencyGroup({ name: "workflow_run", runId: 101, conclusion: "success", provenance: "pull_request" })).toBe("renew-permanent-qa")
    expect(expectedGoldenConcurrencyGroup({ name: "repository_dispatch", runId: 102 })).toBe("renew-permanent-qa")
  })

  it("isolates every irrelevant workflow event by run identity", () => {
    const validPendingGroup = expectedGoldenConcurrencyGroup({ name: "workflow_run", runId: 201, conclusion: "success", provenance: "pull_request" })
    const irrelevantEvents: GoldenWorkflowEvent[] = [
      { name: "workflow_run", runId: 202, conclusion: "success", provenance: "push" },
      { name: "workflow_run", runId: 203, conclusion: "failure", provenance: "pull_request" },
      { name: "workflow_run", runId: 204, conclusion: "skipped", provenance: "pull_request" },
      { name: "ignored_event", runId: 205 },
    ]
    const irrelevantGroups = irrelevantEvents.map(expectedGoldenConcurrencyGroup)

    expect(validPendingGroup).toBe("renew-permanent-qa")
    expect(irrelevantGroups).toEqual([
      "renew-permanent-qa-ignored-202",
      "renew-permanent-qa-ignored-203",
      "renew-permanent-qa-ignored-204",
      "renew-permanent-qa-ignored-205",
    ])
    expect(new Set(irrelevantGroups).size).toBe(irrelevantGroups.length)
    expect(irrelevantGroups).not.toContain(validPendingGroup)
  })

  it("keeps daily health manually runnable, read-only for schema, and identity-first", () => {
    const workflow = readFileSync(`${process.cwd()}/.github/workflows/qa-daily-health.yml`, "utf8")
    expect(workflow).toContain("workflow_dispatch:")
    expect(workflow).not.toContain("qa:schema:sync")
    const deployedIdentity = workflow.indexOf("qa:deployed-contract:verify")
    const liveEvidence = workflow.indexOf("qa:evidence:collect")
    const lease = workflow.indexOf("qa:lease:acquire")
    expect(deployedIdentity).toBeGreaterThanOrEqual(0)
    expect(liveEvidence).toBeGreaterThan(deployedIdentity)
    expect(lease).toBeGreaterThan(liveEvidence)
    expect(workflow).toContain("steps.empty.outcome == 'success'")
    expect(workflow).toContain("steps.heartbeat.outcome == 'success'")
  })

  it("keeps candidate and run data out of long-lived secrets", () => {
    const workflow = readFileSync(`${process.cwd()}/.github/workflows/golden-journeys.yml`, "utf8")
    const sanitizer = readFileSync(`${process.cwd()}/scripts/qa/sanitize-phase-b-artifacts.mjs`, "utf8")
    expect(workflow).toContain("github.event.client_payload.candidate_sha")
    expect(workflow).toContain("github.event.client_payload.candidate_branch")
    expect(workflow).toContain("workflow_run:")
    expect(workflow).toContain("repository_dispatch:")
    expect(workflow).not.toContain("secrets.QA_BROWSER_BASE_URL")
    expect(workflow).not.toContain("secrets.QA_VALIDATION_ORIGIN")
    expect(workflow).not.toContain("secrets.QA_RUN_ID")
    expect(workflow).not.toContain("secrets.QA_FIXTURE_PREFIX")
    expect(workflow).toContain("checks: write")
    expect(workflow).toContain("contents: write")
    expect(workflow).toContain("QA_VERIFY_RUN_ID")
    expect(workflow).not.toContain('latest != "none"')
    expect(workflow).toContain("health-created-at")
    expect(workflow).toContain("health_branch")
    expect(workflow).toContain("health_sha")
    expect(workflow).toContain("Check out authorized candidate contract as data")
    expect(workflow).toContain("Validate candidate database contract admission")
    expect(workflow).toContain("QA_CONTRACT_SHA256")
    expect(workflow).toContain("QA_SCHEMA_REVIEWED")
    expect(workflow).toContain("QA_SCHEMA_REVIEW_VERSION")
    expect(workflow).toContain("QA_CANDIDATE_ROOT: .qa-candidate")
    expect(workflow).toContain("Check out trusted QA controller and journeys")
    expect(sanitizer.match(/secretEnvironmentName = \/(.*)\//)?.[1]).not.toContain("QA_SUPABASE_PROJECT_REF")
  })

  it("keeps failed health blocking except after exact reviewed-transition admission", () => {
    const workflow = readFileSync(`${process.cwd()}/.github/workflows/golden-journeys.yml`, "utf8")
    const validator = readFileSync(`${process.cwd()}/scripts/qa/validate-candidate.mjs`, "utf8")
    const healthStart = workflow.indexOf("Require current-main health or reviewed transition recovery")
    const pointerStart = workflow.indexOf("Move permanent qa pointer with lease-safe force")
    const healthStep = workflow.slice(healthStart, pointerStart)

    expect(validator).toContain("const admission = await validateCandidateContractAdmission")
    expect(validator).toContain('reviewed_schema_transition=${admission.admission === "reviewed-schema-change"}')
    expect(workflow).toContain("reviewed_schema_transition: ${{ steps.candidate.outputs.reviewed_schema_transition }}")
    expect(healthStart).toBeGreaterThan(workflow.indexOf("Validate candidate database contract admission"))
    expect(pointerStart).toBeGreaterThan(healthStart)
    expect(healthStep).toContain("health_sha")
    expect(healthStep).toContain('if [ "$health_ok" = "true" ]; then')
    expect(healthStep).toContain('if [ "$QA_REVIEWED_SCHEMA_TRANSITION" != "true" ]; then')
    expect(healthStep).toContain("Reviewed schema transition recovery path used; this does not bypass product tests.")
    expect(workflow.indexOf("schema-sync:")).toBeGreaterThan(pointerStart)
    for (const requiredStep of [
      "Verify deployed application identities before database mutation",
      "Synchronize only the empty approved QA branch",
      "Acquire or safely recover database lease",
      "Require empty baseline after recovery",
      "Run P1-P3 in protected Chromium",
      "Read back exact persisted acceptance state",
      "Cleanup exact manifest and label-owned fixtures",
      "Sanitize runner artifacts",
    ]) {
      expect(workflow.indexOf(requiredStep)).toBeGreaterThan(pointerStart)
    }
    expect(workflow).toContain("QA_CHECK_CONCLUSION: ${{ needs.schema-sync.result == 'success' && needs.golden.result == 'success' && 'success' || 'failure' }}")
  })

  it("keeps live cleanup rehearsal out of ordinary candidate runs", () => {
    const workflow = readFileSync(`${process.cwd()}/.github/workflows/golden-journeys.yml`, "utf8")
    expect(workflow).not.toContain("qa:fixture:manifest-rehearsal")
    expect(workflow).not.toContain("qa:fixture:rehearse-cleanup")
  })

  it("moves unavoidable fixed and singleton fixtures into exact snapshot ownership", () => {
    const manifest = buildFixtureManifest("32530000000-1")
    expect(manifest.databaseRows.some((row: { table: string }) => row.table === "wave_journey_settings")).toBe(false)
    expect(manifest.databaseRows.some((row: { table: string }) => row.table === "ma_provisional_source_contexts")).toBe(false)
    expect(manifest.singletonSnapshots).toEqual([
      { table: "ma_provisional_source_contexts", key: "acme_co_paris" },
      { table: "wave_journey_settings", key: "true" },
      { table: "email_daily_counts", key: "run-date" },
      { table: "rateLimit", key: "all-rows" },
    ])
  })

  it("refuses fixture mutation unless every temporarily disabled trigger starts enabled", () => {
    const common = readFileSync(`${process.cwd()}/scripts/qa/phase-b-common.mjs`, "utf8")
    const seed = readFileSync(`${process.cwd()}/scripts/qa/seed-phase-b-fixtures.mjs`, "utf8")
    const cleanup = readFileSync(`${process.cwd()}/scripts/qa/cleanup-phase-b.mjs`, "utf8")
    expect(common).toContain("assertQaMutationTriggersEnabled")
    expect(common).toContain('result.rows[0].tgenabled !== "O"')
    expect(common).toContain("opportunity_pursuit_evidence_immutable")
    expect(seed.indexOf("assertQaMutationTriggersEnabled(database)")).toBeLessThan(seed.indexOf('database.query("BEGIN")'))
    expect(cleanup.indexOf("assertQaMutationTriggersEnabled(database)")).toBeLessThan(cleanup.indexOf('storage.from("cvs").remove'))
  })

  it("enforces QA mail recipient and sender allowlists before provider delivery", () => {
    const policy = { mode: "allowlist" as const, recipients: ["delivered@resend.dev"], senders: ["onboarding@resend.dev"] }
    expect(assertQaMailEnvelope({ from: "Re-New <onboarding@resend.dev>", to: ["delivered@resend.dev"] }, policy)).toEqual({ recipients: ["delivered@resend.dev"], sender: "onboarding@resend.dev" })
    expect(() => assertQaMailEnvelope({ from: "Re-New <notifications@news.re-new.team>", to: ["delivered@resend.dev"] }, policy)).toThrow("QA mail policy failed: sender")
    expect(() => assertQaMailEnvelope({ from: "Re-New <onboarding@resend.dev>", to: ["customer@example.com"] }, policy)).toThrow("QA mail policy failed: recipient")
    expect(() => assertQaMailEnvelope({ from: "Re-New <onboarding@resend.dev>", to: ["delivered@resend.dev"], bcc: ["staff@re-new.team"] }, policy)).toThrow("QA mail policy failed: recipient")
    expect(assertQaMailEnvelope({ from: "Re-New <onboarding@resend.dev>", to: ["delivered+test-gh-123-1@resend.dev"] }, policy).recipients).toEqual(["delivered+test-gh-123-1@resend.dev"])
    expect(qaMailPolicyFromEnv({ QA_MAIL_MODE: "allowlist", QA_EMAIL_RECIPIENT: "delivered@resend.dev", QA_EMAIL_FROM: "onboarding@resend.dev", RESEND_FROM_EMAIL: "notifications@news.re-new.team" })).toEqual(policy)
    expect(qaMailPolicyFromEnv({ QA_MAIL_MODE: "allowlist", QA_EMAIL_RECIPIENT: "delivered@resend.dev", RESEND_FROM_EMAIL: "notifications@news.re-new.team" }).senders).toEqual([])
    expect(qaMailPolicyFromEnv({ QA_MAIL_MODE: "allowlist", QA_EMAIL_RECIPIENT: "delivered@resend.dev", QA_EMAIL_FROM: "notifications@news.re-new.team" }).senders).toEqual([])
  })

  it("keeps deployed application mail paths behind the QA-aware adapter", () => {
    const auth = readFileSync(`${process.cwd()}/lib/auth.ts`, "utf8")
    const generic = readFileSync(`${process.cwd()}/lib/email/send-email.ts`, "utf8")
    expect(auth).toContain('from "@/lib/email/resend-client"')
    expect(generic).toContain('from "./resend-client"')
    expect(auth).not.toContain('from "resend"')
    expect(generic).not.toContain('from "resend"')
  })

  it("fingerprints live catalog definitions deterministically and detects drift", () => {
    const rows = [
      { kind: "column", identity: "public.alpha.1:id", definition: "uuid|true|" },
      { kind: "function", identity: "public.create_alpha()", definition: "SELECT 1" },
    ]
    expect(fingerprintStructureRows(rows)).toBe(fingerprintStructureRows([...rows].reverse()))
    expect(fingerprintStructureRows(rows)).not.toBe(fingerprintStructureRows([{ ...rows[0], definition: "text|true|" }, rows[1]]))
  })

  it("canonicalizes ACL and policy-role members in PostgreSQL C order", () => {
    const source = readFileSync(`${process.cwd()}/lib/qa/structure-fingerprint.mjs`, "utf8")

    expect(source).not.toContain("relacl::text")
    expect(source).not.toContain("proacl::text")
    expect(source).not.toContain("roles::text")
    expect(source.match(/COLLATE "C"/g)).toHaveLength(3)
    expect(source.match(/jsonb_agg/g)).toHaveLength(3)
    expect(source).toContain("CASE WHEN c.relacl IS NULL THEN 'null'")
    expect(source).toContain("CASE WHEN p.proacl IS NULL THEN 'null'")
    expect(source).toContain("CASE WHEN roles IS NULL THEN 'null'")
  })

  it("uses a locale-independent comparator for quoted mixed-case identities", () => {
    const rows = [
      { kind: "policy", identity: 'public."Alpha":StaffOnly', definition: 'PERMISSIVE|["Staff","analyst"]|SELECT|true|' },
      { kind: "relation", identity: 'public."alpha"', definition: 'r|true|false|["Staff=arwdDxt/owner"]' },
      { kind: "function", identity: 'public."Äudit"()', definition: 'SELECT 1|["owner=X/owner"]' },
    ]
    const originalLocaleCompare = String.prototype.localeCompare
    String.prototype.localeCompare = () => {
      throw new Error("localeCompare must not be called")
    }

    try {
      expect(fingerprintStructureRows(rows)).toBe(fingerprintStructureRows([...rows].reverse()))
    } finally {
      String.prototype.localeCompare = originalLocaleCompare
    }

    const source = readFileSync(`${process.cwd()}/lib/qa/structure-fingerprint.mjs`, "utf8")
    expect(source).not.toContain("localeCompare")
  })

  it("remains sensitive to privilege and policy-definition changes", () => {
    const baseline = [
      { kind: "relation", identity: "public.deals", definition: 'r|true|false|["staff=arwdDxt/owner"]' },
      { kind: "policy", identity: "public.deals:staff_read", definition: 'PERMISSIVE|["staff"]|SELECT|is_staff()|' },
    ]

    expect(fingerprintStructureRows(baseline)).not.toBe(fingerprintStructureRows([
      { ...baseline[0], definition: 'r|true|false|["staff=r/owner"]' },
      baseline[1],
    ]))
    expect(fingerprintStructureRows(baseline)).not.toBe(fingerprintStructureRows([
      baseline[0],
      { ...baseline[1], definition: 'PERMISSIVE|["staff"]|SELECT|is_admin()|' },
    ]))
  })

  it("reports only expected and actual SHA-256 values on a live mismatch", () => {
    const expected = "a".repeat(64)
    const actual = "b".repeat(64)
    const diagnostics: string[] = []

    expect(() => assertMatchingStructureFingerprint(expected, actual, (message) => diagnostics.push(message))).toThrow("Live QA evidence failed: structure-fingerprint")
    expect(diagnostics).toEqual([JSON.stringify({ expectedStructureFingerprint: expected, actualStructureFingerprint: actual })])
    expect(Object.keys(JSON.parse(diagnostics[0]))).toEqual(["expectedStructureFingerprint", "actualStructureFingerprint"])
    expect(readFileSync(`${process.cwd()}/scripts/qa/collect-live-evidence.mjs`, "utf8")).toContain(
      "assertMatchingStructureFingerprint(contract.structureFingerprint, liveStructureFingerprint)",
    )
  })

  it("defines a database-owned lease, persisted manifest, recovery and blocked schema state", () => {
    const ddl = readFileSync(`${process.cwd()}/supabase/schema/qa_control.sql`, "utf8")
    expect(ddl).toContain("CREATE SCHEMA IF NOT EXISTS qa_control")
    expect(ddl).toContain("pg_advisory_xact_lock")
    expect(ddl).toContain("owner_hash")
    expect(ddl).toContain("candidate_sha")
    expect(ddl).toContain("structure_fingerprint")
    expect(ddl).toContain("manifest jsonb")
    expect(ddl).toContain("heartbeat_at")
    expect(ddl).toContain("expires_at")
    expect(ddl).toContain("recovery_owner_hash")
    expect(ddl).toContain("blocked_reason")
    expect(ddl).toContain("qa_control.applied_files")
    expect(ddl).toContain("ALTER TABLE qa_control.schema_state ENABLE ROW LEVEL SECURITY")
    expect(ddl).toContain("ALTER TABLE qa_control.applied_files ENABLE ROW LEVEL SECURITY")
    expect(ddl).toContain("ALTER TABLE qa_control.lease ENABLE ROW LEVEL SECURITY")
    expect(ddl).toContain("qa-lease-owner-mismatch")
    expect(ddl).toContain("qa-recovery-owner-mismatch")
    expect(ddl).toContain("qa-recovery-not-expired")
    expect(ddl.trimStart()).not.toMatch(/^BEGIN;/)
    expect(ddl.trimEnd()).not.toMatch(/COMMIT;$/)
    expect(readFileSync(`${process.cwd()}/scripts/qa/cleanup-phase-b.mjs`, "utf8")).toContain("server-manifest-mismatch")
    expect(readFileSync(`${process.cwd()}/scripts/qa/lease-phase-b.mjs`, "utf8")).toContain("buildFixtureManifest(stale.runId)")
  })

  it("keeps expired-manifest recovery idempotent after cleanup has already committed", () => {
    const cleanup = readFileSync(`${process.cwd()}/scripts/qa/cleanup-phase-b.mjs`, "utf8")
    expect(cleanup).not.toContain("p1-ledger-mismatch")
    expect(cleanup).not.toContain("p2-ledger-mismatch")
    expect(cleanup).not.toContain("opportunity-ledger-mismatch")
    expect(cleanup).not.toContain("match-ledger-mismatch")
    expect(cleanup).not.toContain("evidence-ledger-mismatch")
    expect(cleanup).toContain("server-manifest-mismatch")
    expect(cleanup).toContain("repreneur-scope")
    expect(cleanup).toContain("opportunity-scope")
  })

  it("keeps schema synchronization separate and transactional before browser fixtures", () => {
    const workflow = readFileSync(`${process.cwd()}/.github/workflows/golden-journeys.yml`, "utf8")
    const sync = readFileSync(`${process.cwd()}/scripts/qa/sync-permanent-schema.mjs`, "utf8")
    expect(workflow.indexOf("schema-sync:")).toBeLessThan(workflow.indexOf("golden:"))
    expect(workflow).toContain("needs: [lane, schema-sync]")
    expect(workflow.indexOf("Verify deployed application identities before database mutation")).toBeLessThan(workflow.indexOf("Synchronize only the empty approved QA branch"))
    expect(sync).toContain("--single-transaction")
    expect(readFileSync(`${process.cwd()}/supabase/schema/permanent_qa_rebuild.sql`, "utf8")).toContain("DROP SCHEMA public CASCADE")
    expect(sync).toContain("ON_ERROR_STOP")
    expect(sync).toContain("blocked_reason")
    expect(sync).toContain("structure fingerprint")
    expect(sync).not.toContain("qa-branch.json")
    expect(sync).not.toContain("validateBranchReconstructionEvidence")
    expect(sync).toContain("contract.files.map")
    expect(sync).not.toContain("const REBUILD_FILES")
    expect(sync).toContain("assertAppliedLedger")
    expect(sync).toContain("replaceMatchingStructureLedger")
    expect(sync).toContain("DELETE FROM qa_control.applied_files")
    expect(sync).toContain("psql-meta-command")
    expect(sync).not.toContain("...process.env")
    expect(readFileSync(`${process.cwd()}/scripts/qa/sanitize-phase-b-artifacts.mjs`, "utf8")).toContain("generatedCredentials")
    expect(readFileSync(`${process.cwd()}/scripts/qa/seed-phase-b-fixtures.mjs`, "utf8")).not.toContain("repairedIntegrityDefinition")
    const deployedPreflight = readFileSync(`${process.cwd()}/scripts/qa/verify-deployed-contract.mjs`, "utf8")
    expect(deployedPreflight).toContain("${origin}/auth/login")
    expect(deployedPreflight).not.toContain("${origin}/intake-v2")
  })

  it("documents latest-pending supersession and independent provider evidence boundaries", () => {
    const operations = readFileSync(`${process.cwd()}/docs/operations/permanent-qa-lane.md`, "utf8")
    expect(operations).toContain("The v3 structure fingerprint")
    expect(operations).toContain("two independent clean-room reconstructions using the trusted Node algorithm")
    expect(operations).toContain("Only an exact reviewed schema transition may recover from an old-contract daily-health deadlock")
    expect(operations).toContain("does not bypass provider identity, empty-branch and lease checks, schema synchronization, post-sync fingerprint equality, P1–P3, sanitization, cleanup or final check evaluation")
    expect(operations).toContain("latest-pending supersession")
    expect(operations).toContain("A running, B pending, C supersedes B")
    expect(operations).toContain("superseded B remains blocked")
    expect(operations).not.toContain("unlimited non-cancelling queue")
    expect(operations).toContain("checked-in configuration, not live provider authority")
    expect(operations).toContain("Persistence, parent, with-data and branch-count")
    expect(operations).toContain("generic Vercel Marketplace integration is not approved")
    expect(operations).toContain("cancelled before project connection")
    expect(operations).toContain("1Password-based one-time transfer")
  })

  it("rejects candidate transaction control without confusing function bodies or comments", () => {
    expect(() => assertNoTopLevelTransactionControl("CREATE TABLE public.safe(id uuid);")).not.toThrow()
    expect(() => assertNoTopLevelTransactionControl("CREATE FUNCTION public.safe() RETURNS void LANGUAGE plpgsql AS $$ BEGIN NULL; END $$;")).not.toThrow()
    expect(() => assertNoTopLevelTransactionControl("-- COMMIT must remain inert\nSELECT 'ROLLBACK';")).not.toThrow()
    for (const sql of ["BEGIN; SELECT 1;", "COMMIT;", "ROLLBACK;", "START TRANSACTION;", "SAVEPOINT unsafe;"]) {
      expect(() => assertNoTopLevelTransactionControl(sql)).toThrow("QA SQL safety failed: transaction-control")
    }
  })
})
