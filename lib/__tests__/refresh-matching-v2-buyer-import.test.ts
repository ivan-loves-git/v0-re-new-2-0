import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const script = readFileSync(resolve(process.cwd(), "scripts/refresh-matching-v2-buyer-import.ts"), "utf8")
const core = readFileSync(resolve(process.cwd(), "lib/repreneur-match-refresh-core.ts"), "utf8")

describe("Matching v2 post-import stored-match refresh", () => {
  it("uses the canonical refresh function for the exact 21-client cohort", () => {
    expect(script).toContain("refreshStoredRepreneurMatchesWithClient")
    expect(script).toContain("EXPECTED_REPRENEUR_IDS")
    expect(script).toContain("repreneurCount: cohort.repreneurIds.length")
    expect(script).toContain("Matching v2 refresh offer cohort mismatch.")
  })

  it("keeps the CLI scorer core independent from Next server runtime imports", () => {
    expect(core).toContain("refreshStoredRepreneurMatchesWithClient")
    expect(core).not.toContain('from "next/')
    expect(core).not.toContain('from "@/lib/env"')
  })

  it("is dry-run by default and requires an explicit server-side confirmation to mutate snapshots", () => {
    expect(script).toContain('args.includes("--apply")')
    expect(script).toContain('process.env.MATCHING_V2_IMPORT_CONFIRMED !== "true"')
    expect(script).toContain('mode: apply ? "apply" : "dry-run"')
  })

  it("reports processing counts without changing human workflow fields", () => {
    expect(script).toContain("refreshedRows")
    expect(script).toContain("skippedMissingOpportunityRows")
    expect(script).toContain("failedMatchRows")
    expect(script).toContain("processed-match count mismatch")
    expect(script).not.toContain(".update({ status")
    expect(script).not.toContain(".update({ recommendation")
  })
})
