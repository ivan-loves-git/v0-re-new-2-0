import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const platformRoot = process.cwd()

function source(relativePath: string) {
  return readFileSync(`${platformRoot}/${relativePath}`, "utf8")
}

describe("repreneur opportunity not-a-fit response", () => {
  it("returns recoverable action state for validation and mutation errors", () => {
    const action = source("lib/actions/repreneur-opportunity-responses.ts")
    const declineAction = action.slice(action.indexOf("export async function declineMyOpportunity"))

    expect(declineAction).toContain("_previousState: RepreneurOpportunityDeclineActionState")
    expect(declineAction).toContain('status: "error"')
    expect(declineAction).toContain("error instanceof RepreneurOpportunityResponseError")
    expect(declineAction).toContain("We could not save your response right now. Please try again.")
    expect(declineAction.indexOf("redirect(\"/portal/deals\")")).toBeGreaterThan(declineAction.indexOf("} catch (error)"))
  })

  it("prevents incomplete decline submissions and shows inline action feedback", () => {
    const declineForm = source("components/opportunities/repreneur-opportunity-decline-action.tsx")

    expect(declineForm).toContain("useActionState(")
    expect(declineForm).toContain("selectedReasons.size > 0 && details.trim().length > 0")
    expect(declineForm).toContain("Why is this not a fit? (required)")
    expect(declineForm).toContain("required\n            rows={3}")
    expect(declineForm).not.toContain("required={otherSelected}")
    expect(declineForm).toContain('disabled={!canSubmit || pending}')
    expect(declineForm).toContain("Response not saved")
    expect(declineForm).toContain("aria-expanded={isExpanded}")
    expect(declineForm).toContain("aria-controls={disclosureId}")
    expect(declineForm).toContain("const disclosureId = `decline-feedback-${matchId}`")
    expect(declineForm).toContain("{isExpanded ? (")
    expect(declineForm).not.toContain("Collapsible")
    expect(declineForm).toContain("firstReasonRef.current?.focus()")
    expect(declineForm).toContain("triggerRef.current?.focus()")
    expect(declineForm).toContain("Confirm not a fit")
    expect(declineForm).toContain("Cancel")
  })

  it("keeps interested primary and defers decline reasons until the secondary action is chosen", () => {
    const detail = source("components/opportunities/repreneur-opportunity-detail.tsx")
    const declineForm = source("components/opportunities/repreneur-opportunity-decline-action.tsx")

    expect(detail.indexOf("I'm interested")).toBeLessThan(
      detail.indexOf("<RepreneurOpportunityDeclineAction"),
    )
    expect(declineForm.indexOf("aria-controls={disclosureId}")).toBeLessThan(declineForm.indexOf("<fieldset"))
  })

  it("keeps the decline control scoped to an owned opportunity match", () => {
    const action = source("lib/actions/repreneur-opportunity-responses.ts")
    const detail = source("components/opportunities/repreneur-opportunity-detail.tsx")

    expect(action).toContain('.eq("id", matchId)')
    expect(action).toContain('.eq("repreneur_id", access.repreneurId)')
    expect(detail).toContain("opportunity.match_id &&")
    expect(detail).toContain("matchId={opportunity.match_id}")
    expect(detail).not.toContain("declineMyOpportunity.bind")
  })

  it("clears decline categories with an empty array for the interested response", () => {
    const action = source("lib/actions/repreneur-opportunity-responses.ts")

    expect(action).toContain(
      'p_decline_reason_categories: status === "declined" ? declineReasonCategories : [],',
    )
    expect(action).not.toContain(
      'p_decline_reason_categories: status === "declined" ? declineReasonCategories : null,',
    )
  })

  it("uses the atomic server-side response gate", () => {
    const action = source("lib/actions/repreneur-opportunity-responses.ts")

    expect(action).toContain('"update_repreneur_opportunity_response"')
    expect(action).toContain('.eq("opportunity.is_demo", false)')
    expect(action).not.toContain('.from("opportunity_matches")\n    .update(')
  })

  it("reconsiders declined and dropped records through the idempotent interest boundary only", () => {
    const action = source("lib/actions/repreneur-opportunity-responses.ts")

    expect(action).toContain('match.status === "declined" || match.status === "dropped"')
    expect(action).toContain('"express_opportunity_interest"')
    expect(action).toContain("reopens a pursuit")
  })

  it("keeps client-invoked response actions in a dedicated async-only server module", () => {
    const action = source("lib/actions/repreneur-opportunity-responses.ts")
    const readModel = source("lib/actions/repreneur-opportunities.ts")

    expect(action.startsWith('"use server"')).toBe(true)
    expect(action.match(/^export /gm)).toHaveLength(2)
    expect(action).toContain("export async function markMyOpportunityInterested")
    expect(action).toContain("export async function declineMyOpportunity")
    expect(readModel.startsWith('import "server-only"')).toBe(true)
    expect(readModel).not.toContain('"use server"')
  })
})
