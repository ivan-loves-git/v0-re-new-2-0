import { execFileSync, spawnSync } from "node:child_process"
import { copyFileSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { afterEach, describe, expect, it } from "vitest"

const roots: string[] = []
const sanitizer = join(process.cwd(), "scripts/qa/sanitize-phase-b-artifacts.mjs")
const generatedTraceFixture = join(process.cwd(), "lib/__tests__/fixtures/playwright-generated-trace")

function temporaryRunDirectory() {
  const root = mkdtempSync(join(tmpdir(), "renew-trace-sanitize-"))
  roots.push(root)
  const runDirectory = join(root, ".qa-run")
  mkdirSync(runDirectory)
  return { root, runDirectory }
}

function writeTraceArchive(root: string, runDirectory: string, lines: unknown[]) {
  const sourceDirectory = join(root, "source")
  mkdirSync(sourceDirectory)
  writeFileSync(
    join(sourceDirectory, "trace.trace"),
    `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`,
  )
  const archive = join(runDirectory, "trace.zip")
  execFileSync("zip", ["-q", archive, "trace.trace"], { cwd: sourceDirectory })
  return archive
}

function writeMultiTraceArchive(
  root: string,
  runDirectory: string,
  members: Array<{ path: string; lines: unknown[] }>,
) {
  const sourceDirectory = join(root, "multi-source")
  mkdirSync(sourceDirectory)
  for (const member of members) {
    const memberPath = join(sourceDirectory, member.path)
    mkdirSync(join(memberPath, ".."), { recursive: true })
    writeFileSync(
      memberPath,
      `${member.lines.map((line) => typeof line === "string" ? line : JSON.stringify(line)).join("\n")}\n`,
    )
  }
  const archive = join(runDirectory, "multi-trace.zip")
  execFileSync("zip", ["-q", archive, ...members.map((member) => member.path)], {
    cwd: sourceDirectory,
  })
  return archive
}

function runSanitizer(
  runDirectory: string,
  extraEnvironment: Record<string, string | undefined> = {},
) {
  return spawnSync(process.execPath, [sanitizer], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      QA_RUN_DIR: runDirectory,
      QA_CREDENTIALS_FILE: join(runDirectory, "credentials.json"),
      QA_FIXTURE_MANIFEST_FILE: join(runDirectory, "manifest.json"),
      QA_PREFLIGHT_EVIDENCE_FILE: join(runDirectory, "live-preflight.json"),
      QA_CASE_RESULT_FILE: join(runDirectory, "case-result.json"),
      QA_RUNTIME_FIXTURES_FILE: join(runDirectory, "runtime-fixtures.json"),
      ...extraEnvironment,
    },
  })
}

function parseUnsafeTextResidueDiagnostic(stderr: string) {
  const line = stderr
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("{") && entry.includes('"unsafe-text-residue"'))
  expect(line).toBeTruthy()
  return JSON.parse(line!)
}

function expectSafeUnsafeTextResidueDiagnostic(
  result: ReturnType<typeof runSanitizer>,
  expected: { file: string, rule: string },
  forbiddenSnippets: string[],
) {
  expect(result.status).not.toBe(0)
  expect(result.stderr).toContain("Artifact sanitization failed: unsafe-text-residue")
  const diagnostic = parseUnsafeTextResidueDiagnostic(result.stderr)
  expect(diagnostic).toEqual({
    ok: false,
    code: "unsafe-text-residue",
    file: expected.file,
    rule: expected.rule,
  })
  for (const snippet of forbiddenSnippets) {
    expect(result.stderr).not.toContain(snippet)
    expect(result.stdout).not.toContain(snippet)
  }
}

function findTraceArchive(directory: string): string | undefined {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      const nested = findTraceArchive(path)
      if (nested) return nested
    } else if (entry.name === "trace.zip") {
      return path
    }
  }
  return undefined
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe("sanitized Playwright trace evidence", () => {
  it("retains deterministic segment and action order for a multi-member trace archive", () => {
    const { root, runDirectory } = temporaryRunDirectory()
    const archive = writeMultiTraceArchive(root, runDirectory, [
      {
        path: "context-b/trace.trace",
        lines: [
          { type: "before", callId: "b-1", startTime: 30, apiName: "page.fill", params: { value: "private" } },
          { type: "after", callId: "b-1", endTime: 35 },
        ],
      },
      {
        path: "context-a/trace.trace",
        lines: [
          { type: "before", callId: "a-1", startTime: 10, apiName: "page.goto", params: { url: "https://secret.invalid/?token=private" } },
          { type: "after", callId: "a-1", endTime: 15 },
          { type: "before", callId: "a-2", startTime: 20, apiName: "locator.click" },
          { type: "after", callId: "a-2", endTime: 25 },
        ],
      },
    ])

    const result = runSanitizer(runDirectory)

    expect(result.status, result.stderr).toBe(0)
    expect(() => readFileSync(archive)).toThrow()
    const actionsText = readFileSync(join(runDirectory, "sanitized-trace-actions.json"), "utf8")
    expect(actionsText).not.toMatch(/private|secret\.invalid|params|url|token/i)
    const evidence = JSON.parse(actionsText)
    expect(evidence.schemaVersion).toBe(2)
    expect(evidence.traces[0].traceId).toBe("trace-001")
    expect(evidence.traces[0].segments.map((segment: { segmentId: string }) => segment.segmentId)).toEqual([
      "trace-001-segment-001",
      "trace-001-segment-002",
    ])
    expect(evidence.traces[0].segments.map((segment: { actions: Array<{ action: string }> }) => (
      segment.actions.map((action) => action.action)
    ))).toEqual([["page.fill"], ["page.goto", "locator.click"]])
  })

  it("sanitizes an actual Playwright 1.62 multi-context retry trace", () => {
    const { root, runDirectory } = temporaryRunDirectory()
    const generatedOutput = join(root, "playwright-output")
    const playwrightResult = spawnSync(
      process.platform === "win32" ? "pnpm.cmd" : "pnpm",
      ["exec", "playwright", "test", "--config", join(generatedTraceFixture, "playwright.config.ts")],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: { ...process.env, PW_TRACE_FIXTURE_OUTPUT: generatedOutput },
      },
    )
    expect(playwrightResult.status).toBe(1)
    const generatedArchive = findTraceArchive(generatedOutput)
    expect(generatedArchive).toBeDefined()
    const members = execFileSync("unzip", ["-Z1", generatedArchive!], { encoding: "utf8" })
      .split(/\r?\n/)
      .filter((entry) => entry.endsWith("trace.trace"))
    expect(members).toEqual(["1-trace.trace", "0-trace.trace"])

    const archive = join(runDirectory, "playwright-1.62-trace.zip")
    copyFileSync(generatedArchive!, archive)
    const result = runSanitizer(runDirectory)

    expect(result.status, result.stderr).toBe(0)
    expect(() => readFileSync(archive)).toThrow()
    const actionsText = readFileSync(join(runDirectory, "sanitized-trace-actions.json"), "utf8")
    expect(actionsText).not.toMatch(/https?:|cookie|header|network|storage.?state|params|payload|button/i)
    const evidence = JSON.parse(actionsText)
    expect(evidence.schemaVersion).toBe(2)
    expect(evidence.traces).toHaveLength(1)
    expect(evidence.traces[0].segments).toHaveLength(2)
    expect(evidence.traces[0].segments.every((segment: { actions: unknown[] }) => segment.actions.length > 0)).toBe(true)
  }, 30_000)

  it("retains safe action order while excluding secrets, cookies, URLs, params, and network data", () => {
    const { root, runDirectory } = temporaryRunDirectory()
    const secret = "runner-secret-value-123"
    const generatedPassword = "ephemeral-browser-password-456"
    const qaRecipient = "private-recipient@example.test"
    const shortToken = "tok"
    writeFileSync(
      join(runDirectory, "case-result.json"),
      `${JSON.stringify({ ok: false, recipient: qaRecipient, credential: shortToken, generatedPassword })}\n`,
    )
    writeFileSync(join(runDirectory, "credentials.json"), `${JSON.stringify({ password: generatedPassword })}\n`)
    const archive = writeTraceArchive(root, runDirectory, [
      {
        type: "before",
        callId: "call@1",
        startTime: 10,
        class: "Frame",
        method: "goto",
        params: { url: `https://preview.example.test/path?token=${secret}` },
      },
      {
        type: "resource-snapshot",
        snapshot: {
          request: { headers: [{ name: "cookie", value: `session=${secret}` }] },
          response: { content: { text: `network-body-${secret}` } },
        },
      },
      { type: "after", callId: "call@1", endTime: 25 },
      {
        type: "before",
        callId: "call@2",
        startTime: 30,
        apiName: "locator.click",
        params: { selector: "internal:text=Password", value: secret },
      },
      {
        type: "after",
        callId: "call@2",
        endTime: 42,
        error: {
          name: "TimeoutError",
          message: `Timed out at https://preview.example.test/private?cookie=${secret}; password=${secret}`,
        },
      },
      {
        type: "before",
        callId: "call@3",
        startTime: 50,
        apiName: "expect.toHaveText",
      },
      {
        type: "after",
        callId: "call@3",
        endTime: 60,
        error: {
          name: "Error",
          message: 'Expected "Ivan Person" at https://preview.example.test/private but received "private value" from #customer-email',
        },
      },
    ])

    const result = runSanitizer(runDirectory, {
      QA_EMAIL_RECIPIENT: qaRecipient,
      TOKEN: shortToken,
      VERCEL_AUTOMATION_BYPASS_SECRET: secret,
    })

    expect(result.status, result.stderr).toBe(0)
    expect(() => readFileSync(archive)).toThrow()

    const actionsText = readFileSync(
      join(runDirectory, "sanitized-trace-actions.json"),
      "utf8",
    )
    expect(actionsText).not.toContain(secret)
    expect(actionsText).not.toMatch(/cookie|password|network-body|preview\.example|private value|Ivan Person|customer-email|params|selector/i)
    expect(readFileSync(join(runDirectory, "case-result.json"), "utf8")).toContain("[REDACTED]")
    expect(readFileSync(join(runDirectory, "case-result.json"), "utf8")).not.toContain(qaRecipient)
    expect(readFileSync(join(runDirectory, "case-result.json"), "utf8")).not.toContain(shortToken)
    expect(readFileSync(join(runDirectory, "case-result.json"), "utf8")).not.toContain(generatedPassword)
    expect(() => readFileSync(join(runDirectory, "credentials.json"))).toThrow()

    const evidence = JSON.parse(actionsText)
    expect(evidence).toEqual({
      schemaVersion: 2,
      traces: [
        {
          traceId: "trace-001",
          segments: [{
            segmentId: "trace-001-segment-001",
            actions: [
            {
              order: 1,
              action: "Frame.goto",
              startTimeMs: 10,
              endTimeMs: 25,
              durationMs: 15,
            },
            {
              order: 2,
              action: "locator.click",
              startTimeMs: 30,
              endTimeMs: 42,
              durationMs: 12,
              error: {
                category: "SensitiveDataRedacted",
                message: "[REDACTED sensitive error]",
              },
            },
            {
              order: 3,
              action: "expect.toHaveText",
              startTimeMs: 50,
              endTimeMs: 60,
              durationMs: 10,
              error: {
                category: "ActionError",
                message: "Action failed",
              },
            },
            ],
          }],
        },
      ],
    })

    expect(JSON.parse(readFileSync(join(runDirectory, "sanitized-traces.json"), "utf8"))).toMatchObject({
      rawTraceArchivesRemoved: 1,
      sanitizedActionTracesRetained: 1,
      sanitizedActionSegmentsRetained: 1,
      sanitizedActionTraceFile: "sanitized-trace-actions.json",
      networkPayloadsRetained: false,
      sessionStateRetained: false,
    })
  })

  it("fails closed, deletes raw archives, and retains no action evidence when extraction fails", () => {
    const { runDirectory } = temporaryRunDirectory()
    const archive = join(runDirectory, "trace.zip")
    writeFileSync(archive, "not-a-zip")

    const result = runSanitizer(runDirectory)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain("Artifact sanitization failed: trace-extraction")
    expect(() => readFileSync(archive)).toThrow()
    expect(() => readFileSync(join(runDirectory, "sanitized-trace-actions.json"))).toThrow()
    expect(() => readFileSync(join(runDirectory, "sanitized-traces.json"))).toThrow()
  })

  it("fails closed without partial evidence when any trace member is malformed", () => {
    const { root, runDirectory } = temporaryRunDirectory()
    const archive = writeMultiTraceArchive(root, runDirectory, [
      {
        path: "valid/trace.trace",
        lines: [
          { type: "before", callId: "valid-1", startTime: 10, apiName: "page.goto" },
          { type: "after", callId: "valid-1", endTime: 15 },
        ],
      },
      {
        path: "malformed/trace.trace",
        lines: [{ type: "before", callId: "dangling-1", startTime: 20, apiName: "locator.click" }],
      },
    ])

    const result = runSanitizer(runDirectory)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain("Artifact sanitization failed: trace-extraction")
    expect(() => readFileSync(archive)).toThrow()
    expect(() => readFileSync(join(runDirectory, "sanitized-trace-actions.json"))).toThrow()
    expect(() => readFileSync(join(runDirectory, "sanitized-traces.json"))).toThrow()
  })

  it("fails closed rather than silently discarding an unsafe trace member name", () => {
    const { root, runDirectory } = temporaryRunDirectory()
    const archive = writeMultiTraceArchive(root, runDirectory, [
      {
        path: "trace.trace",
        lines: [
          { type: "before", callId: "valid-1", startTime: 10, apiName: "page.goto" },
          { type: "after", callId: "valid-1", endTime: 15 },
        ],
      },
      {
        path: "unexpected-trace.trace",
        lines: [
          { type: "before", callId: "unsafe-1", startTime: 20, apiName: "locator.click" },
          { type: "after", callId: "unsafe-1", endTime: 25 },
        ],
      },
    ])

    const result = runSanitizer(runDirectory)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain("Artifact sanitization failed: trace-extraction")
    expect(() => readFileSync(archive)).toThrow()
    expect(() => readFileSync(join(runDirectory, "sanitized-trace-actions.json"))).toThrow()
    expect(() => readFileSync(join(runDirectory, "sanitized-traces.json"))).toThrow()
  })

  it("fails closed and removes text containing unknown credential-shaped residue", () => {
    const { runDirectory } = temporaryRunDirectory()
    const unsafeFile = join(runDirectory, "future-failure.txt")
    const unsafeContent = "request failed with Authorization: Bearer future-unknown-credential\n"
    writeFileSync(unsafeFile, unsafeContent)

    const result = runSanitizer(runDirectory)

    expectSafeUnsafeTextResidueDiagnostic(
      result,
      { file: "future-failure.txt", rule: "authorization" },
      ["future-unknown-credential", "Authorization: Bearer", unsafeContent.trim()],
    )
    expect(() => readFileSync(unsafeFile)).toThrow()
  })

  it("removes the complete Playwright HTML report before residue scanning", () => {
    const { runDirectory } = temporaryRunDirectory()
    const reportDirectory = join(runDirectory, "playwright-report")
    mkdirSync(join(reportDirectory, "assets"), { recursive: true })
    writeFileSync(
      join(reportDirectory, "index.html"),
      '<a href="https://preview.example.test/private?token=embedded">report</a>',
    )
    writeFileSync(
      join(reportDirectory, "assets", "metadata.txt"),
      "cookie=session-value; Authorization: Bearer embedded-value\n",
    )
    writeFileSync(join(runDirectory, "case-result.json"), '{"ok":true}\n')

    const result = runSanitizer(runDirectory)

    expect(result.status, result.stderr).toBe(0)
    expect(() => readdirSync(reportDirectory)).toThrow()
    expect(readFileSync(join(runDirectory, "case-result.json"), "utf8")).toBe('{"ok":true}\n')
    expect(JSON.parse(readFileSync(join(runDirectory, "sanitized-traces.json"), "utf8"))).toMatchObject({
      htmlReportRetained: false,
      htmlReportRemovalReason: "privacy",
      playwrightJsonReportRetained: false,
      playwrightJsonReportRemovalReason: "privacy",
    })
  })

  it("deletes raw playwright-results.json containing github.token while keeping curated case-result", () => {
    const { runDirectory } = temporaryRunDirectory()
    const resultsFile = join(runDirectory, "playwright-results.json")
    const caseResult = '{"ok":true,"cases":{"planned":3,"passed":3}}\n'
    writeFileSync(
      resultsFile,
      `${JSON.stringify({
        config: { workers: 1 },
        suites: [{
          title: "Golden journeys",
          specs: [{
            title: "P3",
            tests: [{
              results: [{
                status: "passed",
                stdout: [{ text: "workflow body referenced github.token during publish notes" }],
              }],
            }],
          }],
        }],
      }, null, 2)}\n`,
    )
    writeFileSync(join(runDirectory, "case-result.json"), caseResult)
    writeFileSync(join(runDirectory, "cleanup-readback.json"), '{"databaseResidue":0,"authResidue":0,"storageResidue":0}\n')
    writeFileSync(join(runDirectory, "live-preflight.json"), '{"ok":true,"customerRows":0}\n')

    const result = runSanitizer(runDirectory)

    expect(result.status, result.stderr).toBe(0)
    expect(() => readFileSync(resultsFile)).toThrow()
    expect(readFileSync(join(runDirectory, "case-result.json"), "utf8")).toBe(caseResult)
    expect(readFileSync(join(runDirectory, "cleanup-readback.json"), "utf8")).toContain('"databaseResidue":0')
    expect(readFileSync(join(runDirectory, "live-preflight.json"), "utf8")).toContain('"customerRows":0')
    expect(JSON.parse(readFileSync(join(runDirectory, "sanitized-traces.json"), "utf8"))).toMatchObject({
      playwrightJsonReportRetained: false,
      playwrightJsonReportRemovalReason: "privacy",
      htmlReportRetained: false,
      htmlReportRemovalReason: "privacy",
    })
    expect(JSON.parse(readFileSync(join(runDirectory, "sanitized-trace-actions.json"), "utf8"))).toEqual({
      schemaVersion: 2,
      traces: [],
    })
  })

  it("fails closed when github.token appears in any other retained JSON", () => {
    const { runDirectory } = temporaryRunDirectory()
    const retainedFile = join(runDirectory, "case-result.json")
    const unsafeContent = '{"ok":false,"note":"commit body mentioned github.token"}\n'
    writeFileSync(retainedFile, unsafeContent)

    const result = runSanitizer(runDirectory)

    expectSafeUnsafeTextResidueDiagnostic(
      result,
      { file: "case-result.json", rule: "token" },
      ["github.token", unsafeContent.trim()],
    )
    expect(() => readFileSync(retainedFile)).toThrow()
  })

  it.each([
    ["tokenized", "token"],
    ["passworded", "password"],
    ["authorizationx", "authorization"],
    ["cookiecutter", "cookie"],
  ] as const)("fails closed when original-prefix residue %s appears in retained JSON", (prefixMatch, rule) => {
    const { runDirectory } = temporaryRunDirectory()
    const retainedFile = join(runDirectory, "case-result.json")
    const unsafeContent = `{"ok":false,"note":"retained evidence contained ${prefixMatch}"}\n`
    writeFileSync(retainedFile, unsafeContent)

    const result = runSanitizer(runDirectory)

    expectSafeUnsafeTextResidueDiagnostic(
      result,
      { file: "case-result.json", rule },
      [prefixMatch, unsafeContent.trim()],
    )
    expect(() => readFileSync(retainedFile)).toThrow()
  })

  it("reports the authoritative residue category when non-boundary mypostgres:// is also present", () => {
    const { runDirectory } = temporaryRunDirectory()
    const retainedFile = join(runDirectory, "case-result.json")
    const unsafeContent =
      '{"ok":false,"note":"mypostgres://shadow-host/db alongside github.token must not steal category"}\n'
    writeFileSync(retainedFile, unsafeContent)

    const result = runSanitizer(runDirectory)

    expectSafeUnsafeTextResidueDiagnostic(
      result,
      { file: "case-result.json", rule: "token" },
      ["mypostgres://", "github.token", "postgres-uri", unsafeContent.trim()],
    )
    expect(() => readFileSync(retainedFile)).toThrow()
  })

  it.each([
    ["json", "url-query"],
    ["txt", "url-query"],
  ] as const)("still rejects unsafe residue in retained %s evidence", (extension, rule) => {
    const { runDirectory } = temporaryRunDirectory()
    const unsafeFile = join(runDirectory, `retained-evidence.${extension}`)
    const unsafeContent = "request failed at https://preview.example.test/private?token=embedded\n"
    writeFileSync(unsafeFile, unsafeContent)

    const result = runSanitizer(runDirectory)

    expectSafeUnsafeTextResidueDiagnostic(
      result,
      { file: `retained-evidence.${extension}`, rule },
      ["preview.example.test", "token=embedded", unsafeContent.trim()],
    )
    expect(() => readFileSync(unsafeFile)).toThrow()
  })

  it("keeps successful runs valid when no Playwright trace exists", () => {
    const { runDirectory } = temporaryRunDirectory()
    writeFileSync(join(runDirectory, "case-result.json"), '{"ok":true}\n')

    const result = runSanitizer(runDirectory)

    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(readFileSync(join(runDirectory, "sanitized-trace-actions.json"), "utf8"))).toEqual({
      schemaVersion: 2,
      traces: [],
    })
    expect(JSON.parse(readFileSync(join(runDirectory, "sanitized-traces.json"), "utf8"))).toMatchObject({
      rawTraceArchivesRemoved: 0,
      sanitizedActionTracesRetained: 0,
      sanitizedActionSegmentsRetained: 0,
    })
  })
})
