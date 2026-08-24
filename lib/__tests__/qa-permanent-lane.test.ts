import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"
import {
  assertAuthorizedCandidate,
  assertCandidatePointer,
  assertDeployedQaContract,
  buildQaContract,
  stableQaOrigin,
} from "@/lib/qa/permanent-contract.mjs"
import { assertQaMailEnvelope, qaMailPolicyFromEnv } from "@/lib/email/qa-mail-policy"
import { buildFixtureManifest } from "@/lib/qa/phase-b.mjs"
import { acquireQaLease, loadAdmittedQaContract } from "@/lib/qa/lease-contract.mjs"
import { assertMatchingStructureFingerprint, fingerprintStructureRows } from "@/lib/qa/structure-fingerprint.mjs"
import { assertNoTopLevelTransactionControl } from "@/lib/qa/sql-safety.mjs"

const QA_REF = "ypzrsrykirpqerfpozdm"
const SHA = "a".repeat(40)
const FINGERPRINT = "b".repeat(64)

function jobEnvKeys(workflow: string, jobName: string) {
  const block = jobBlock(workflow, jobName)
  return [...block.matchAll(/^\s+[A-Z0-9_]+:/gm)].map((match) => match[0].trim().replace(":", ""))
}

function jobBlock(workflow: string, jobName: string) {
  const jobStart = workflow.indexOf(`  ${jobName}:`)
  expect(jobStart).toBeGreaterThanOrEqual(0)
  const nextJob = workflow.slice(jobStart + 1).search(/\n  [a-z0-9-]+:/)
  return nextJob === -1 ? workflow.slice(jobStart) : workflow.slice(jobStart, jobStart + 1 + nextJob)
}

describe("permanent QA lane contract", () => {
  it("pins the integrated W-147/W-148 fingerprint and six schema inputs", () => {
    const contract = JSON.parse(readFileSync(`${process.cwd()}/supabase/qa-contract.json`, "utf8"))

    expect(contract).toEqual({
      version: "772-p0-security-v1",
      structureFingerprint: "9337cb02089112c90af6785863ccfcb603e84de911fcb590c705d4b80de73d62",
      files: [
        { path: "supabase/schema/771_extensions.sql", sha256: "755e4469be6630f4a5d274f503a00a17521606a4b36ae6f2f277a005465e68e9" },
        { path: "supabase/schema/qa_control.sql", sha256: "ee0e0136976c0408a4f1d95fe8f071c994e4667824c79804a8b7f3a9da71040e" },
        { path: "supabase/schema/permanent_qa_rebuild.sql", sha256: "20565af77093399b6b8ebc7e27ebc78e778faf9df802b702b7d86eea9f323291" },
        { path: "supabase/schema/771_public_schema.sql", sha256: "593d9d2b813c9047568dd5d863e2d4644a18493cff0e63142518fcfeb554788b" },
        { path: "supabase/schema/772_w147_auth_data_api.sql", sha256: "538fdb23f2a5a8d2be5881a56fa89d3a0eeb32996bb4e7a328c8349574f49029" },
        { path: "supabase/schema/771_test_storage.sql", sha256: "ecd41fd86c5566f77fadc53998ff7fdca12a4e81d9142ca07cfc1db620bf545f" },
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
      actor: "ivan-loves-git",
      runAttempt: "1",
      actorPermission: "write",
      candidateBranch: "codex/release-a",
      candidateSha: SHA,
      pull: { base: { ref: "main" }, head: { ref: "codex/release-a", sha: SHA, repo: { full_name: "ivan-loves-git/v0-re-new-2-0" } }, draft: false },
      verifyCheck: { name: "Verify", conclusion: "success", head_sha: SHA },
    }
    expect(assertAuthorizedCandidate(input)).toEqual({ candidateBranch: input.candidateBranch, candidateSha: SHA })
    expect(() => assertAuthorizedCandidate({ ...input, controllerRef: "refs/heads/codex/release-a" })).toThrow("QA candidate failed: controller")
    expect(() => assertAuthorizedCandidate({ ...input, actor: "another-writer" })).toThrow("QA candidate failed: ivan-authorization")
    expect(() => assertAuthorizedCandidate({ ...input, runAttempt: "2" })).toThrow("QA candidate failed: fresh-dispatch-required")
    expect(() => assertAuthorizedCandidate({ ...input, actorPermission: "read" })).toThrow("QA candidate failed: actor-permission")
    expect(() => assertAuthorizedCandidate({ ...input, pull: { ...input.pull, draft: true } })).toThrow("QA candidate failed: pull-request")
    expect(() => assertAuthorizedCandidate({ ...input, verifyCheck: { ...input.verifyCheck, conclusion: "failure" } })).toThrow("QA candidate failed: verify-check")
  })

  it("admits Tier 3 candidates only through Ivan's manual workflow dispatch", () => {
    const golden = readFileSync(`${process.cwd()}/.github/workflows/golden-journeys.yml`, "utf8")
    const concurrency = golden.split("\njobs:", 1)[0]
    expect(golden).not.toContain("repository_dispatch:")
    expect(golden).toContain("workflow_dispatch:")
    expect(golden).not.toContain("workflow_run:")
    expect(golden).toContain("QA_CANDIDATE_BRANCH: ${{ inputs.candidate_branch }}")
    expect(golden).toContain("QA_EXPECTED_SHA: ${{ inputs.candidate_sha }}")
    expect(readFileSync(`${process.cwd()}/lib/qa/permanent-contract.mjs`, "utf8")).toContain('TIER_3_AUTHORIZER = "ivan-loves-git"')
    const validator = readFileSync(`${process.cwd()}/scripts/qa/validate-candidate.mjs`, "utf8")
    expect(validator).toContain("actor,\n    runAttempt: process.env.GITHUB_RUN_ATTEMPT,")
    for (const job of ["schema-sync", "golden", "finalize"]) {
      expect(jobBlock(golden, job)).toContain("github.run_attempt == '1'")
    }
    expect(concurrency).toContain("group: renew-permanent-qa")
    expect(concurrency).toContain("cancel-in-progress: false")
    expect(concurrency).not.toContain("cancel-in-progress: true")
  })

  it("never grants contents write and never moves a qa pointer", () => {
    const workflow = readFileSync(`${process.cwd()}/.github/workflows/golden-journeys.yml`, "utf8")
    expect(workflow).not.toContain("contents: write")
    expect(workflow).toContain("contents: read")
    expect(workflow).not.toContain("Move permanent qa pointer")
    expect(workflow).not.toContain("refs/heads/qa")
    expect(workflow).not.toContain("force-with-lease")
    expect(workflow).not.toContain(":refs/heads/qa")
  })

  it("keeps daily health manually runnable, read-only for schema, and alias-SHA first", () => {
    const workflow = readFileSync(`${process.cwd()}/.github/workflows/qa-daily-health.yml`, "utf8")
    expect(workflow).toContain("workflow_dispatch:")
    expect(workflow).not.toContain("qa:schema:sync")
    expect(workflow).not.toContain("git/ref/heads/qa")
    expect(workflow).toContain("resolve-alias-sha.mjs")
    expect(workflow).toContain("Resolve expected SHA from stable alias")
    expect(workflow).not.toContain("QA_VERCEL_TOKEN")
    const resolveStart = workflow.indexOf("resolve-sha:")
    const healthStart = workflow.indexOf("  health:")
    expect(resolveStart).toBeGreaterThanOrEqual(0)
    expect(healthStart).toBeGreaterThan(resolveStart)
    expect(jobEnvKeys(workflow, "resolve-sha")).toContain("VERCEL_AUTOMATION_BYPASS_SECRET")
    expect(jobEnvKeys(workflow, "resolve-sha")).toContain("GH_TOKEN")
    expect(jobEnvKeys(workflow, "resolve-sha")).not.toContain("GITHUB_TOKEN")
    expect(jobEnvKeys(workflow, "resolve-sha")).not.toContain("DATABASE_URL")
    const resolveShaBlock = workflow.slice(resolveStart, healthStart)
    expect(resolveShaBlock).toMatch(/GH_TOKEN:\s*\$\{\{\s*github\.token\s*\}\}/)
    expect(resolveShaBlock).toContain("gh api repos/$GITHUB_REPOSITORY/branches/main")
    expect(jobEnvKeys(workflow, "health")).toContain("DATABASE_URL")
    expect(jobEnvKeys(workflow, "health")).not.toContain("QA_VERCEL_TOKEN")
  })

  it("keeps candidate and run data out of long-lived secrets", () => {
    const workflow = readFileSync(`${process.cwd()}/.github/workflows/golden-journeys.yml`, "utf8")
    const sanitizer = readFileSync(`${process.cwd()}/scripts/qa/sanitize-phase-b-artifacts.mjs`, "utf8")
    expect(workflow).not.toContain("github.event.client_payload")
    expect(workflow).toContain("inputs.candidate_sha")
    expect(workflow).toContain("inputs.candidate_branch")
    expect(workflow).not.toContain("secrets.QA_BROWSER_BASE_URL")
    expect(workflow).not.toContain("secrets.QA_VALIDATION_ORIGIN")
    expect(workflow).not.toContain("secrets.QA_RUN_ID")
    expect(workflow).not.toContain("secrets.QA_FIXTURE_PREFIX")
    expect(workflow).toContain("checks: write")
    expect(workflow).toContain("QA_VERIFY_RUN_ID")
    expect(workflow).not.toContain("health-created-at")
    expect(workflow).toContain("Check out authorized candidate contract as data")
    expect(workflow).toContain("Validate candidate database contract admission")
    expect(workflow).toContain("QA_CONTRACT_SHA256")
    expect(workflow).toContain("QA_SCHEMA_REVIEWED")
    expect(workflow).toContain("QA_SCHEMA_REVIEW_VERSION")
    expect(workflow).toContain("QA_CANDIDATE_ROOT: .")
    expect(workflow).toContain("Check out exact authorized candidate")
    expect(sanitizer.match(/secretEnvironmentName = \/(.*)\//)?.[1]).not.toContain("QA_SUPABASE_PROJECT_REF")
  })

  it("binds the live lease to the admitted candidate contract after a reviewed schema transition", () => {
    const lease = readFileSync(`${process.cwd()}/scripts/qa/lease-phase-b.mjs`, "utf8")
    expect(lease).toContain("loadAdmittedQaContract()")
    expect(lease).toContain("acquireQaLease(database")
    expect(lease).not.toContain('resolve(process.cwd(), "supabase/qa-contract.json")')
    expect(lease).not.toContain('message.startsWith("QA lease contract failed:")')
  })

  it("passes the admitted candidate fingerprint to the lease acquisition query", async () => {
    const root = mkdtempSync(join(tmpdir(), "renew-qa-lease-contract-"))
    const admittedRoot = join(root, ".qa-candidate", "supabase")
    const trustedFingerprint = "c".repeat(64)
    const admittedFingerprint = "d".repeat(64)
    try {
      mkdirSync(join(root, "supabase"), { recursive: true })
      mkdirSync(admittedRoot, { recursive: true })
      writeFileSync(join(root, "supabase", "qa-contract.json"), JSON.stringify({ structureFingerprint: trustedFingerprint }))
      writeFileSync(join(admittedRoot, "qa-contract.json"), JSON.stringify({ structureFingerprint: admittedFingerprint }))

      const contract = await loadAdmittedQaContract({
        workingDirectory: root,
        candidateRoot: ".qa-candidate",
      })
      const database = {
        query: vi.fn().mockResolvedValue({ rows: [{ result: { status: "acquired" } }] }),
      }
      const runId = "32625688380-1"
      const owner = "qa-owner-000000000000000000000000"

      await expect(acquireQaLease(database, {
        runId,
        owner,
        candidateSha: SHA,
        structureFingerprint: contract.structureFingerprint,
      })).resolves.toEqual({ status: "acquired" })
      expect(database.query).toHaveBeenCalledWith(
        expect.stringContaining("qa_control.acquire_lease"),
        [runId, owner, SHA, admittedFingerprint, 900],
      )
      expect(database.query).not.toHaveBeenCalledWith(expect.anything(), expect.arrayContaining([trustedFingerprint]))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("rejects a canonical candidate root outside the workspace before any database query", async () => {
    const workspace = mkdtempSync(join(tmpdir(), "renew-qa-lease-workspace-"))
    const outside = mkdtempSync(join(tmpdir(), "renew-qa-lease-outside-"))
    try {
      mkdirSync(join(outside, "supabase"), { recursive: true })
      writeFileSync(join(outside, "supabase", "qa-contract.json"), JSON.stringify({ structureFingerprint: FINGERPRINT }))
      symlinkSync(outside, join(workspace, ".qa-candidate"))

      await expect(loadAdmittedQaContract({
        workingDirectory: workspace,
        candidateRoot: ".qa-candidate",
      })).rejects.toThrow("QA lease contract failed: candidate-root")

      const result = spawnSync(process.execPath, [join(process.cwd(), "scripts/qa/lease-phase-b.mjs"), "acquire"], {
        cwd: workspace,
        encoding: "utf8",
        env: {
          NODE_ENV: "test",
          QA_CANDIDATE_ROOT: ".qa-candidate",
          QA_EXPECTED_SHA: SHA,
          QA_LEASE_OWNER: "qa-owner-000000000000000000000000",
          QA_RUN_ID: "32625688380-1",
        },
      })
      expect(result.status).toBe(1)
      expect(result.stdout).toBe("")
      expect(result.stderr.trim()).toBe("QA lease contract failed: candidate-root")
    } finally {
      rmSync(workspace, { recursive: true, force: true })
      rmSync(outside, { recursive: true, force: true })
    }
  })

  it("rejects a contract path that escapes the admitted candidate through a nested symlink", async () => {
    const workspace = mkdtempSync(join(tmpdir(), "renew-qa-lease-nested-workspace-"))
    const outside = mkdtempSync(join(tmpdir(), "renew-qa-lease-nested-outside-"))
    const candidate = join(workspace, ".qa-candidate")
    try {
      mkdirSync(candidate, { recursive: true })
      mkdirSync(join(outside, "supabase"), { recursive: true })
      writeFileSync(join(outside, "supabase", "qa-contract.json"), JSON.stringify({ structureFingerprint: FINGERPRINT }))
      symlinkSync(join(outside, "supabase"), join(candidate, "supabase"))

      await expect(loadAdmittedQaContract({
        workingDirectory: workspace,
        candidateRoot: ".qa-candidate",
      })).rejects.toThrow("QA lease contract failed: contract")
    } finally {
      rmSync(workspace, { recursive: true, force: true })
      rmSync(outside, { recursive: true, force: true })
    }
  })

  it.each([
    "0".repeat(64),
    "A".repeat(64),
    "b".repeat(63),
    "not-a-sha-256",
    [FINGERPRINT],
  ])("rejects invalid admitted fingerprint %s before any database query", async (structureFingerprint) => {
    const workspace = mkdtempSync(join(tmpdir(), "renew-qa-lease-invalid-contract-"))
    const candidate = join(workspace, ".qa-candidate", "supabase")
    try {
      mkdirSync(candidate, { recursive: true })
      writeFileSync(join(candidate, "qa-contract.json"), JSON.stringify({ structureFingerprint }))

      await expect(loadAdmittedQaContract({
        workingDirectory: workspace,
        candidateRoot: ".qa-candidate",
      })).rejects.toThrow("QA lease contract failed: contract")
    } finally {
      rmSync(workspace, { recursive: true, force: true })
    }
  })

  it("validates lease identity before loading the admitted contract", () => {
    const result = spawnSync(process.execPath, [join(process.cwd(), "scripts/qa/lease-phase-b.mjs"), "acquire"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        NODE_ENV: "test",
        QA_CANDIDATE_ROOT: "missing-candidate-root",
        QA_EXPECTED_SHA: SHA,
        QA_LEASE_OWNER: "invalid",
        QA_RUN_ID: "32625688380-1",
      },
    })

    expect(result.status).toBe(1)
    expect(result.stdout).toBe("")
    expect(result.stderr.trim()).toBe("QA lease failed: owner")
  })

  it.each([undefined, ""])("fails closed when the candidate root is %s", (candidateRoot) => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      QA_EXPECTED_SHA: SHA,
      QA_LEASE_OWNER: "qa-owner-000000000000000000000000",
      QA_RUN_ID: "32625688380-1",
    }
    if (candidateRoot !== undefined) Object.assign(env, { QA_CANDIDATE_ROOT: candidateRoot })

    const result = spawnSync(process.execPath, [join(process.cwd(), "scripts/qa/lease-phase-b.mjs"), "acquire"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env,
    })

    expect(result.status).toBe(1)
    expect(result.stdout).toBe("")
    expect(result.stderr.trim()).toBe("QA lease contract failed: candidate-root")
  })

  it("reports an invalid admitted contract inside the safe boundary before database access", () => {
    const workspace = mkdtempSync(join(tmpdir(), "renew-qa-lease-cli-contract-"))
    const candidate = join(workspace, ".qa-candidate", "supabase")
    try {
      mkdirSync(candidate, { recursive: true })
      writeFileSync(join(candidate, "qa-contract.json"), JSON.stringify({ structureFingerprint: "0".repeat(64) }))
      const result = spawnSync(process.execPath, [join(process.cwd(), "scripts/qa/lease-phase-b.mjs"), "acquire"], {
        cwd: workspace,
        encoding: "utf8",
        env: {
          NODE_ENV: "test",
          QA_CANDIDATE_ROOT: ".qa-candidate",
          QA_EXPECTED_SHA: SHA,
          QA_LEASE_OWNER: "qa-owner-000000000000000000000000",
          QA_RUN_ID: "32625688380-1",
        },
      })

      expect(result.status).toBe(1)
      expect(result.stdout).toBe("")
      expect(result.stderr.trim()).toBe("QA lease contract failed: contract")
    } finally {
      rmSync(workspace, { recursive: true, force: true })
    }
  })

  it("uses owner-gated exact-candidate admission without a daily-health or provider-deploy gate", () => {
    const workflow = readFileSync(`${process.cwd()}/.github/workflows/golden-journeys.yml`, "utf8")
    const validator = readFileSync(`${process.cwd()}/scripts/qa/validate-candidate.mjs`, "utf8")

    expect(validator).toContain("const admission = await validateCandidateContractAdmission")
    expect(validator).toContain('reviewed_schema_transition=${admission.admission === "reviewed-schema-change"}')
    expect(workflow).toContain("reviewed_schema_transition: ${{ steps.candidate.outputs.reviewed_schema_transition }}")
    expect(workflow).not.toContain("Require current-main health")
    expect(workflow).not.toContain("deploy-qa:")
    expect(workflow).not.toContain("QA_VERCEL_TOKEN")
    for (const requiredStep of [
      "Synchronize only the empty approved QA branch",
      "Acquire or safely recover database lease",
      "Require empty baseline after recovery",
      "Run P1-P3 in Chromium",
      "Read back exact persisted acceptance state",
      "Cleanup exact manifest and label-owned fixtures",
      "Sanitize runner artifacts",
    ]) {
      expect(workflow.indexOf(requiredStep)).toBeGreaterThanOrEqual(0)
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

  it("normalizes the catalog search path inside the fingerprint statement", () => {
    const source = readFileSync(`${process.cwd()}/lib/qa/structure-fingerprint.mjs`, "utf8")

    expect(source).toContain("set_config('search_path', 'pg_catalog, public, qa_control, extensions', true)")
    expect(source.match(/FROM fingerprint_settings/g)).toHaveLength(10)
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
  })

  it("keeps runtime QA on exact artifacts and user journeys instead of a provider-rendered checksum", () => {
    const evidence = readFileSync(`${process.cwd()}/scripts/qa/collect-live-evidence.mjs`, "utf8")
    const sync = readFileSync(`${process.cwd()}/scripts/qa/sync-permanent-schema.mjs`, "utf8")

    expect(evidence).toContain("liveStructureFingerprint: null")
    expect(evidence).not.toContain("computeLiveStructureFingerprint")
    expect(evidence).not.toContain("assertMatchingStructureFingerprint")
    expect(sync).not.toContain("computeLiveStructureFingerprint")
    expect(sync).toContain('verifiedBy: "artifact-ledger"')
    expect(sync).toContain("await assertAppliedLedger(database, contract)")
    expect(sync).toContain("await assertContractState(database, contract)")
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

  it("keeps schema synchronization separate and transactional before runner-hosted browser fixtures", () => {
    const workflow = readFileSync(`${process.cwd()}/.github/workflows/golden-journeys.yml`, "utf8")
    const sync = readFileSync(`${process.cwd()}/scripts/qa/sync-permanent-schema.mjs`, "utf8")
    expect(workflow.indexOf("schema-sync:")).toBeLessThan(workflow.indexOf("golden:"))
    expect(workflow).toContain("needs: [lane, schema-sync]")
    expect(sync).toContain("--single-transaction")
    expect(readFileSync(`${process.cwd()}/supabase/schema/permanent_qa_rebuild.sql`, "utf8")).toContain("DROP SCHEMA public CASCADE")
    expect(sync).toContain("ON_ERROR_STOP")
    expect(sync).toContain("blocked_reason")
    expect(sync).toContain("contractStateMatches")
    expect(sync).not.toContain("qa-branch.json")
    expect(sync).not.toContain("validateBranchReconstructionEvidence")
    expect(sync).toContain("contract.files.map")
    expect(sync).not.toContain("const REBUILD_FILES")
    expect(sync).toContain("assertAppliedLedger")
    expect(sync).toContain("verifiedBy: \"artifact-ledger\"")
    expect(sync).toContain("DELETE FROM qa_control.applied_files")
    expect(sync).toContain("psql-meta-command")
    expect(sync).not.toContain("...process.env")
    expect(readFileSync(`${process.cwd()}/scripts/qa/sanitize-phase-b-artifacts.mjs`, "utf8")).toContain("generatedCredentials")
    expect(readFileSync(`${process.cwd()}/scripts/qa/sanitize-phase-b-artifacts.mjs`, "utf8")).toContain("playwright-results.json")
    expect(readFileSync(`${process.cwd()}/scripts/qa/sanitize-phase-b-artifacts.mjs`, "utf8")).toContain("playwrightJsonReportRetained: false")
    expect(readFileSync(`${process.cwd()}/scripts/qa/sanitize-phase-b-artifacts.mjs`, "utf8")).toContain('playwrightJsonReportRemovalReason: "privacy"')
    expect(readFileSync(`${process.cwd()}/scripts/qa/sanitize-phase-b-artifacts.mjs`, "utf8")).toContain("reportUnsafeTextResidue")
    expect(readFileSync(`${process.cwd()}/scripts/qa/sanitize-phase-b-artifacts.mjs`, "utf8")).toContain('code: "unsafe-text-residue"')
    expect(readFileSync(`${process.cwd()}/scripts/qa/sanitize-phase-b-artifacts.mjs`, "utf8")).toContain("safeRelativeRunPath")
    const sanitizerSource = readFileSync(`${process.cwd()}/scripts/qa/sanitize-phase-b-artifacts.mjs`, "utf8")
    expect(sanitizerSource).toContain(
      "const forbiddenTraceResidue = /(?:https?:\\/\\/[^\\s\"']*\\?|\\b(?:cookie|set-cookie|authorization|password|passwd|token|storage.?state|connection(?:string|uri)|bearer\\s+|postgres(?:ql)?:\\/\\/))/i",
    )
    expect(sanitizerSource).not.toContain("hasForbiddenResidue")
    expect(sanitizerSource).toContain("forbiddenTraceResidue.test(")
    expect(sanitizerSource).toContain('pattern: /\\btoken/i')
    expect(sanitizerSource).not.toContain('pattern: /\\btoken\\b/i')
    expect(sanitizerSource).toContain('pattern: /\\b(?:password|passwd)/i')
    expect(sanitizerSource).not.toContain('pattern: /\\b(?:password|passwd)\\b/i')
    expect(sanitizerSource).toContain('pattern: /\\bpostgres(?:ql)?:\\/\\//i')
    expect(sanitizerSource).not.toContain('pattern: /postgres(?:ql)?:\\/\\//i')

    expect(readFileSync(`${process.cwd()}/scripts/qa/seed-phase-b-fixtures.mjs`, "utf8")).not.toContain("repairedIntegrityDefinition")
    const deployedPreflight = readFileSync(`${process.cwd()}/scripts/qa/verify-deployed-contract.mjs`, "utf8")
    expect(deployedPreflight).toContain("${origin}/auth/login")
    expect(deployedPreflight).not.toContain("${origin}/intake-v2")
  })

  it("documents exact-runner QA and keeps provider deployment health in the background", () => {
    const operations = readFileSync(`${process.cwd()}/docs/operations/permanent-qa-lane.md`, "utf8")
    expect(operations).toContain("functional exact-candidate QA is runner-hosted")
    expect(operations).toContain("loopback HTTPS")
    expect(operations).toContain("no production credentials, Vercel deployment token, public URL")
    expect(operations).toContain("not Vercel deployment or production proof")
    expect(operations).toContain("exact versioned SQL-file checksums and the applied-file ledger")
    expect(operations).toContain("latest-pending supersession")
    expect(operations).toContain("checked-in configuration, not live provider authority")
    expect(operations).toContain("required evidence only for an exact Tier 3 candidate explicitly authorized by Ivan")
    expect(operations).toContain("not candidate admission or Tier 3 product QA")
    expect(operations).not.toContain("QA_VERCEL_TOKEN")
    expect(operations).not.toContain("workflow_run admission")
  })

  it("documents proportional QA without making the protected lane a universal merge check", () => {
    const protocol = readFileSync(`${process.cwd()}/docs/TESTING_RELEASE_PROTOCOL.md`, "utf8")
    const agents = readFileSync(`${process.cwd()}/AGENTS.md`, "utf8")

    expect(protocol).toContain("`Verify` is the universal automated check for runtime code")
    expect(protocol).toContain("use it only for Tier 3")
    expect(protocol).toContain("Tier 2 uses its relevant exact-candidate journey")
    expect(protocol).toContain("A Tier 3 candidate must not merge until its exact-candidate protected P1-P3 check succeeds")
    expect(protocol).toContain("A second same-SHA failure in an eligible transient category stops the release")
    expect(agents).toContain("branch protection requires `Verify` universally")
    expect(agents).toContain("records the QA tier and a one-sentence reason")
  })

  it("runs the exact admitted candidate privately on the GitHub runner without provider deployment credentials", () => {
    const workflow = readFileSync(`${process.cwd()}/.github/workflows/golden-journeys.yml`, "utf8")
    const evidence = readFileSync(`${process.cwd()}/scripts/qa/collect-live-evidence.mjs`, "utf8")
    const schemaStart = workflow.indexOf("schema-sync:")
    const goldenStart = workflow.indexOf("golden:")
    expect(schemaStart).toBeGreaterThan(workflow.indexOf("lane:"))
    expect(goldenStart).toBeGreaterThan(schemaStart)
    expect(workflow).not.toContain("deploy-admitted-candidate.mjs")
    expect(workflow).not.toContain("QA_VERCEL_TOKEN")
    expect(workflow).not.toContain("provider-evidence.json")
    expect(workflow).toContain("QA_EXECUTION_MODE: github-runner")
    expect(workflow).toContain("https://127.0.0.1:3443")
    expect(workflow).toContain("Start loopback-only HTTPS candidate runtime")
    expect(workflow).toContain("loopback-https-proxy.mjs")
    const readinessProbe = workflow.split("\n").find((line) => line.includes('served_sha="$(curl'))
    expect(readinessProbe).toContain("|| true)")
    expect(workflow).toContain("Stop and remove private loopback runtime")
    expect(evidence).toContain("github-runner")
    expect(evidence).toContain('const deployment = executionMode === "vercel" ? await deploymentEvidence(expectedSha, protection) : null')
  })

  it("proves ordinary feature pushes cannot invoke validation deployment", () => {
    const workflow = readFileSync(`${process.cwd()}/.github/workflows/golden-journeys.yml`, "utf8")
    const onBlock = workflow.split("\njobs:", 1)[0]
    expect(onBlock).not.toContain("push:")
    expect(onBlock).not.toContain("pull_request:")
    expect(onBlock).not.toContain("workflow_run:")
    expect(onBlock).not.toContain("repository_dispatch:")
    expect(onBlock).toContain("workflow_dispatch:")
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
