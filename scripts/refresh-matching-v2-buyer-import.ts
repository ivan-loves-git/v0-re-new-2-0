#!/usr/bin/env npx tsx
/**
 * Controlled post-import refresh for Matching v2 buyer theses.
 *
 * Run after scripts/20260823_matching_v2_buyer_thesis_import.sql and before UAT.
 * Default is dry-run: it validates the exact 21-client cohort and reports the
 * stored match rows that the canonical application scorer would refresh.
 *
 * Apply (server environment only; secrets remain in environment variables):
 *   MATCHING_V2_IMPORT_CONFIRMED=true npx tsx scripts/refresh-matching-v2-buyer-import.ts --apply
 */

import { writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import { refreshStoredRepreneurMatchesWithClient } from "../lib/repreneur-match-refresh-core"

const EXPECTED_REPRENEUR_IDS = [
  "d482c003-e94b-4d28-8e82-0cfee49b73c4", "5f4c9e8c-f97d-499f-b98e-15ca20024a52",
  "e663a03b-e50f-436d-89b2-64a8145917bd", "0222ed0f-5f63-45d7-87b0-e6d405bbebe7",
  "e1b03a23-0ebd-46c8-b6b0-fb87d1a2ceef", "c6b7a6ef-4532-422e-b0fc-2300c359f88f",
  "3befdd37-1e19-4c8b-805d-fe37f5497557", "196667bd-1ba6-43da-a7de-0a11e9588eb0",
  "d4386948-5480-4bf1-aeea-9c6438929c3f", "4020a404-715a-4d6e-989c-afa70a4d8cef",
  "197dc075-2508-4b2f-b4f7-97bb0da5f9eb", "9f7b912f-6f1d-492c-b62d-428249d2515a",
  "49d2c041-97e3-4c96-8b15-3a9e8b67f21f", "2146f156-08dd-4aeb-8e00-cdf87dc86045",
  "a698237d-7ea8-4992-a033-8781a5ac370e", "e7f80557-f7af-45ed-9654-980fdcbbe508",
  "e35d3dbf-79d4-4bb2-bc27-fd7865bc06a4", "c6b4eab6-45f6-4dcb-b653-391ad48fa6c9",
  "54d49a82-7fca-4771-a0a8-39bc8d6253b7", "8a849298-4743-4e47-bbc5-0c554346879c",
  "5d9859d7-eb62-4bed-8ef9-d97a1b674364",
] as const

const OFFER_NAMES = new Set(["Deal Flow - Paid", "End-to-end support"])

function parseArguments(args: string[]) {
  const apply = args.includes("--apply")
  const reportIndex = args.indexOf("--report")
  const reportPath = reportIndex >= 0 ? args[reportIndex + 1] : undefined
  if (reportIndex >= 0 && (!reportPath || reportPath.startsWith("--"))) throw new Error("--report requires a file path.")
  if (args.some((arg) => !["--apply", "--report", reportPath].includes(arg))) throw new Error("Usage: refresh-matching-v2-buyer-import.ts [--apply] [--report path]")
  return { apply, reportPath }
}

function sameIds(actual: string[]) {
  const expected = new Set(EXPECTED_REPRENEUR_IDS)
  return actual.length === expected.size && actual.every((id) => expected.has(id))
}

function createCliServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function assertExactEligibleCohort() {
  const supabase = createCliServiceClient()
  const { data: profiles, error: profilesError } = await supabase
    .from("repreneurs")
    .select("id, lifecycle_status")
    .in("id", EXPECTED_REPRENEUR_IDS)
  if (profilesError) throw new Error(profilesError.message)
  if ((profiles ?? []).length !== EXPECTED_REPRENEUR_IDS.length || (profiles ?? []).some((profile) => profile.lifecycle_status !== "client")) {
    throw new Error("Matching v2 refresh cohort profile mismatch.")
  }

  const { data: assignments, error: assignmentsError } = await supabase
    .from("repreneur_offers")
    .select("repreneur_id, status, offer:offers(name)")
    .in("repreneur_id", EXPECTED_REPRENEUR_IDS)
    .eq("status", "accepted")
  if (assignmentsError) throw new Error(assignmentsError.message)
  const eligible = new Set<string>()
  for (const assignment of assignments ?? []) {
    const offer = Array.isArray(assignment.offer) ? assignment.offer[0] : assignment.offer
    if (offer && OFFER_NAMES.has(offer.name)) eligible.add(assignment.repreneur_id)
  }
  if (!sameIds([...eligible])) throw new Error("Matching v2 refresh offer cohort mismatch.")

  const { count, error: countError } = await supabase
    .from("opportunity_matches")
    .select("id", { count: "exact", head: true })
    .in("repreneur_id", EXPECTED_REPRENEUR_IDS)
  if (countError) throw new Error(countError.message)
  return { repreneurIds: [...EXPECTED_REPRENEUR_IDS], storedMatchRows: count ?? 0 }
}

async function main() {
  const { apply, reportPath } = parseArguments(process.argv.slice(2))
  if (apply && process.env.MATCHING_V2_IMPORT_CONFIRMED !== "true") {
    throw new Error("Set MATCHING_V2_IMPORT_CONFIRMED=true before using --apply.")
  }

  const cohort = await assertExactEligibleCohort()
  const refreshes = apply
    ? await Promise.allSettled(cohort.repreneurIds.map((id) => refreshStoredRepreneurMatchesWithClient(createCliServiceClient(), id)))
    : []
  const failures = refreshes.flatMap((result, index) => result.status === "rejected"
    ? [{ repreneurId: cohort.repreneurIds[index], message: result.reason instanceof Error ? result.reason.message : "refresh failed" }]
    : [])
  const completed = refreshes.flatMap((result) => result.status === "fulfilled" ? [result.value] : [])
  const report = {
    operation: "matching-v2-buyer-import-refresh",
    mode: apply ? "apply" : "dry-run",
    repreneurCount: cohort.repreneurIds.length,
    storedMatchRows: cohort.storedMatchRows,
    refreshedRows: completed.reduce((sum, result) => sum + result.refreshedRows, 0),
    skippedMissingOpportunityRows: completed.reduce((sum, result) => sum + result.skippedMissingOpportunityRows, 0),
    failedMatchRows: completed.flatMap((result) => result.failedMatchRows),
    refreshes: completed,
    failures,
  }
  const applyFailed = apply && (
    failures.length > 0
    || report.failedMatchRows.length > 0
    || report.skippedMissingOpportunityRows > 0
    || report.refreshedRows + report.skippedMissingOpportunityRows + report.failedMatchRows.length !== report.storedMatchRows
  )
  if (reportPath) await writeFile(resolve(reportPath), `${JSON.stringify(report, null, 2)}\n`, "utf8")
  console.log(JSON.stringify(report, null, 2))
  if (applyFailed) throw new Error("Matching v2 refresh processed-match count mismatch; use the report to retry the listed repreneurs.")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Matching v2 refresh failed.")
  process.exit(1)
})
