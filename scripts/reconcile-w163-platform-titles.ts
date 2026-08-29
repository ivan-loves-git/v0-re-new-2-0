#!/usr/bin/env tsx

import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import pg from "pg"
import {
  createW163PrivateDryRunReceipt,
  reconcileReviewedPlatformTitles,
  validateW163PrivateDryRunReceipt,
  type ReviewedPlatformTitle,
} from "@/lib/w163-title-reconciliation"

const EXPECTED_SHA256 = "ed3265fdae420ea8f2d5cb6876720e90a6be565cca654e6c42ad6d5d99c5eb20"
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(scriptDirectory, "..")
const args = process.argv.slice(2)
const apply = args.includes("--apply")

function optionValue(option: string): string | undefined {
  const index = args.indexOf(option)
  return index >= 0 ? args[index + 1] : undefined
}

const workbookPath = args.find((argument, index) => {
  if (argument.startsWith("--")) return false
  return !["--receipt", "--confirm-digest"].includes(args[index - 1] ?? "")
})
const receiptPath = optionValue("--receipt")
const confirmDigest = optionValue("--confirm-digest")

function fail(message: string): never {
  console.error(`W-163 reconciliation failed: ${message}`)
  process.exit(1)
}

function assertPrivateExternalPath(value: string | undefined, label: string): string {
  if (!value || !path.isAbsolute(value)) {
    fail(`a private absolute ${label} path outside this repository is required`)
  }
  const resolved = path.resolve(value)
  const relative = path.relative(repositoryRoot, resolved)
  if (!relative || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    fail(`the private ${label} path must remain outside this repository`)
  }
  return resolved
}

if (!workbookPath || !receiptPath || (apply && confirmDigest !== EXPECTED_SHA256)) {
  fail("provide a workbook path and private --receipt path; apply also requires --confirm-digest with the approved digest")
}

const privateWorkbookPath = assertPrivateExternalPath(workbookPath, "workbook")
const privateReceiptPath = assertPrivateExternalPath(receiptPath, "--receipt")

function parseWorkbookThroughPrivateHandoff(): ReviewedPlatformTitle[] {
  const privateHandoffDirectory = mkdtempSync(path.join(os.tmpdir(), "w163-title-handoff-"))
  const privateHandoffPath = path.join(privateHandoffDirectory, "reviewed-titles.json")
  try {
    const parser = spawnSync("python3", [
      path.join(scriptDirectory, "parse-w163-platform-title-workbook.py"),
      privateWorkbookPath,
      "--private-output",
      privateHandoffPath,
    ], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    })
    if (parser.status !== 0) {
      throw new Error(parser.stderr || "workbook parser failed")
    }
    try {
      return JSON.parse(readFileSync(privateHandoffPath, "utf8")) as ReviewedPlatformTitle[]
    } catch {
      throw new Error("workbook parser private handoff was invalid")
    }
  } finally {
    rmSync(privateHandoffDirectory, { recursive: true, force: true })
  }
}

const reviewedTitles = parseWorkbookThroughPrivateHandoff()

let suppliedReceipt: unknown
if (apply) {
  try {
    suppliedReceipt = JSON.parse(readFileSync(privateReceiptPath, "utf8")) as unknown
  } catch {
    fail("a readable private dry-run receipt is required before apply")
  }
}

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL
if (!connectionString) {
  fail("DIRECT_URL or DATABASE_URL is required")
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })

async function main() {
  try {
    await client.connect()
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE")
    const current = await client.query(
      "SELECT id::text AS id, reference, public_title AS \"publicTitle\", is_demo AS \"isDemo\" FROM public.opportunities WHERE reference = ANY($1::text[]) FOR UPDATE",
      [reviewedTitles.map((item) => item.reference)],
    )
    const reconciliation = reconcileReviewedPlatformTitles(reviewedTitles, current.rows)
    const receipt = createW163PrivateDryRunReceipt(EXPECTED_SHA256, reviewedTitles, current.rows)
    const { summary } = reconciliation
    if (summary.blockers > 0 || summary.conflicts > 0) {
      throw new Error("reviewed references cannot be reconciled uniquely and safely")
    }

    if (apply) {
      // The serializable read locks every resolved target, including no-ops, before receipt validation.
      // Validation intentionally follows that live read and precedes every UPDATE.
      validateW163PrivateDryRunReceipt(suppliedReceipt, receipt)
      for (const outcome of reconciliation.outcomes) {
        if (outcome.kind !== "guarded_update") continue
        const updated = await client.query(
          "UPDATE public.opportunities SET public_title = $1 WHERE id = $2::uuid AND reference = $3 AND is_demo = false AND public_title IS NOT DISTINCT FROM $4 RETURNING id",
          [outcome.nextPublicTitle, outcome.id, outcome.reference, outcome.expectedPublicTitle],
        )
        if (updated.rowCount !== 1) {
          throw new Error("live title drift detected; no changes were committed")
        }
      }
      await client.query("COMMIT")
    } else {
      await client.query("ROLLBACK")
      // The receipt is external and aggregate-only; `wx` prevents replacing a prior preflight.
      writeFileSync(privateReceiptPath, `${JSON.stringify(receipt)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 })
    }

    console.log(JSON.stringify({
      mode: apply ? "apply" : "dry_run",
      sourceDigest: EXPECTED_SHA256,
      ...receipt.aggregate,
    }))
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined)
    console.error(`W-163 reconciliation failed: ${error instanceof Error ? error.message : "unexpected failure"}`)
    process.exitCode = 1
  } finally {
    await client.end().catch(() => undefined)
  }
}

main().catch(() => {
  console.error("W-163 reconciliation failed: unexpected runtime failure")
  process.exitCode = 1
})
