import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  isOpportunityClosureReason,
  OPPORTUNITY_CLOSURE_REASON_OPTIONS,
} from "@/lib/types/opportunity"

const platformRoot = process.cwd()

function source(relativePath: string) {
  return readFileSync(`${platformRoot}/${relativePath}`, "utf8")
}

function functionSource(relativePath: string, functionName: string) {
  const fileSource = source(relativePath)
  const start = fileSource.indexOf(`export async function ${functionName}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextExport = fileSource.indexOf("\nexport async function", start + 1)
  return fileSource.slice(
    start,
    nextExport === -1 ? fileSource.length : nextExport,
  )
}

describe("opportunity closure history", () => {
  it("accepts only the required canonical closure reasons", () => {
    expect(
      OPPORTUNITY_CLOSURE_REASON_OPTIONS.map((option) => option.value),
    ).toEqual([
      "stale",
      "sold",
      "signed_repreneur",
      "withdrawn_seller",
      "duplicate",
      "dd_disqualified",
    ])

    expect(isOpportunityClosureReason("stale")).toBe(true)
    expect(isOpportunityClosureReason("unknown")).toBe(false)
    expect(isOpportunityClosureReason("")).toBe(false)
    expect(isOpportunityClosureReason(null)).toBe(false)
  })

  it("requires a valid reason and prevents the generic edit action from closing records", () => {
    const closeAction = functionSource(
      "lib/actions/opportunities.ts",
      "closeOpportunity",
    )
    const updateAction = functionSource(
      "lib/actions/opportunities.ts",
      "updateOpportunity",
    )
    const intakeActions = source("lib/actions/opportunity-intake.ts")
    const controls = source(
      "components/opportunities/opportunity-closure-controls.tsx",
    )

    expect(closeAction).toContain("isOpportunityClosureReason(reason)")
    expect(closeAction).toContain("close_opportunity_with_reason")
    expect(updateAction).toContain("updateOpportunityIntake")
    expect(intakeActions).toMatch(/"draft",\s*"active",\s*"paused"/)
    expect(intakeActions).toContain(
      "opportunity_office_context_supports_draft_active_or_paused_only",
    )
    expect(controls).toContain(
      "disabled={!selectedClosureReason || isSubmitting}",
    )
  })

  it("keeps closure rows immutable and disables the old source-only reopen path", () => {
    const migration = source("scripts/069_opportunity_closure_history.sql")
    const reopenAction = functionSource(
      "lib/actions/opportunities.ts",
      "reopenOpportunity",
    )

    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS public.opportunity_closure_history",
    )
    expect(migration).toContain("ON DELETE RESTRICT")
    expect(migration).toContain(
      "BEFORE UPDATE OR DELETE ON public.opportunity_closure_history",
    )
    expect(migration).toContain("opportunity_closure_history_is_immutable")
    expect(reopenAction).toContain("temporarily unavailable")
    expect(reopenAction).toContain("legacy source-only path")
    expect(reopenAction).not.toContain('status: "active"')
    expect(reopenAction).not.toContain("opportunity_closure_history")
  })

  it("keeps closure history actions behind staff authorization", () => {
    for (const functionName of [
      "getOpportunityClosureHistory",
      "closeOpportunity",
      "reopenOpportunity",
    ]) {
      const action = functionSource(
        "lib/actions/opportunities.ts",
        functionName,
      )
      expect(action.indexOf("requireStaffAccess")).toBeGreaterThanOrEqual(0)
      const clientIndex = action.indexOf("createAdminClient")
      if (clientIndex >= 0) {
        expect(action.indexOf("requireStaffAccess")).toBeLessThan(clientIndex)
      }
    }
  })
})
