import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const platformRoot = process.cwd()

function source(relativePath: string) {
  return readFileSync(`${platformRoot}/${relativePath}`, "utf8")
}

describe("repreneur opportunity not-a-fit response", () => {
  it("returns recoverable action state for validation and mutation errors", () => {
    const action = source("lib/actions/repreneur-opportunities.ts")
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
    expect(declineForm).toContain("selectedReasons.size > 0")
    expect(declineForm).toContain('selectedReasons.has("other")')
    expect(declineForm).toContain("required={otherSelected}")
    expect(declineForm).toContain('disabled={!canSubmit || pending}')
    expect(declineForm).toContain("Response not saved")
  })

  it("keeps the decline control scoped to an owned opportunity match", () => {
    const action = source("lib/actions/repreneur-opportunities.ts")
    const detail = source("components/opportunities/repreneur-opportunity-detail.tsx")

    expect(action).toContain('.eq("id", matchId)')
    expect(action).toContain('.eq("repreneur_id", access.repreneurId)')
    expect(detail).toContain("opportunity.match_id &&")
    expect(detail).toContain("matchId={opportunity.match_id}")
    expect(detail).not.toContain("declineMyOpportunity.bind")
  })
})
