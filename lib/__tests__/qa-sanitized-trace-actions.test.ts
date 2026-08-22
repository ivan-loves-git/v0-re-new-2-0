import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { afterEach, describe, expect, it } from "vitest"

const roots: string[] = []
const sanitizer = join(process.cwd(), "scripts/qa/sanitize-phase-b-artifacts.mjs")

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

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe("sanitized Playwright trace evidence", () => {
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
      schemaVersion: 1,
      traces: [
        {
          traceId: "trace-001",
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
        },
      ],
    })

    expect(JSON.parse(readFileSync(join(runDirectory, "sanitized-traces.json"), "utf8"))).toMatchObject({
      rawTraceArchivesRemoved: 1,
      sanitizedActionTracesRetained: 1,
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

  it("fails closed and removes text containing unknown credential-shaped residue", () => {
    const { runDirectory } = temporaryRunDirectory()
    const unsafeFile = join(runDirectory, "future-failure.txt")
    writeFileSync(unsafeFile, "request failed with Authorization: Bearer future-unknown-credential\n")

    const result = runSanitizer(runDirectory)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain("Artifact sanitization failed: unsafe-text-residue")
    expect(() => readFileSync(unsafeFile)).toThrow()
  })

  it("keeps successful runs valid when no Playwright trace exists", () => {
    const { runDirectory } = temporaryRunDirectory()
    writeFileSync(join(runDirectory, "case-result.json"), '{"ok":true}\n')

    const result = runSanitizer(runDirectory)

    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(readFileSync(join(runDirectory, "sanitized-trace-actions.json"), "utf8"))).toEqual({
      schemaVersion: 1,
      traces: [],
    })
    expect(JSON.parse(readFileSync(join(runDirectory, "sanitized-traces.json"), "utf8"))).toMatchObject({
      rawTraceArchivesRemoved: 0,
      sanitizedActionTracesRetained: 0,
    })
  })
})
