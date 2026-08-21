import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  redirect: vi.fn(),
  requirePortalAccess: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/access-control", () => ({
  requirePortalAccess: mocks.requirePortalAccess,
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}))

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}))

import { declineMyOpportunity } from "@/lib/actions/repreneur-opportunity-responses"

const EMPTY_ACTION_STATE = { status: "idle", message: "" } as const
const MATCH_ID = "match-001"
const OPPORTUNITY_ID = "opportunity-001"
const REPRENEUR_ID = "repreneur-001"

function declineFormData(reason?: string, rationale?: string) {
  const formData = new FormData()
  if (reason) formData.append("decline_reason_categories", reason)
  if (rationale !== undefined) formData.set("decline_reason_text", rationale)
  return formData
}

function mockMatchResponse(
  status: "proposed" | "interested" | "declined" = "proposed",
  opportunityStatus: "active" | "paused" | "closed" | "archived" = "active",
) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { id: MATCH_ID, opportunity_id: OPPORTUNITY_ID, status, opportunity: { status: opportunityStatus } },
    error: null,
  })
  const selectForRepreneur = vi.fn(() => ({ maybeSingle }))
  const selectForMatch = vi.fn(() => ({ eq: selectForRepreneur }))
  const select = vi.fn(() => ({ eq: selectForMatch }))
  const updateForRepreneur = vi.fn().mockResolvedValue({ error: null })
  const updateForMatch = vi.fn(() => ({ eq: updateForRepreneur }))
  const update = vi.fn(() => ({ eq: updateForMatch }))

  let fromCall = 0
  const from = vi.fn(() => {
    fromCall += 1
    return fromCall === 1 ? { select } : { update }
  })

  mocks.createAdminClient.mockReturnValue({ from })

  return {
    from,
    selectForMatch,
    selectForRepreneur,
    update,
    updateForMatch,
    updateForRepreneur,
  }
}

describe("repreneur opportunity decline response", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requirePortalAccess.mockResolvedValue({ repreneurId: REPRENEUR_ID })
  })

  it.each([undefined, "", " \n\t "])("rejects an empty or whitespace-only rationale", async (rationale) => {
    const { update } = mockMatchResponse()

    const result = await declineMyOpportunity(
      MATCH_ID,
      EMPTY_ACTION_STATE,
      declineFormData("geography", rationale),
    )

    expect(result).toEqual({
      status: "error",
      message: "Add a written rationale before marking this opportunity as not a fit.",
    })
    expect(update).not.toHaveBeenCalled()
  })

  it("rejects a rationale without an existing structured decline reason", async () => {
    const { update } = mockMatchResponse()

    const result = await declineMyOpportunity(
      MATCH_ID,
      EMPTY_ACTION_STATE,
      declineFormData(undefined, "The location is outside our target area."),
    )

    expect(result).toEqual({
      status: "error",
      message: "Choose at least one reason before marking this opportunity as not a fit.",
    })
    expect(update).not.toHaveBeenCalled()
  })

  it("persists a normal structured reason and a trimmed rationale", async () => {
    const { selectForMatch, selectForRepreneur, update, updateForMatch, updateForRepreneur } = mockMatchResponse()

    await declineMyOpportunity(
      MATCH_ID,
      EMPTY_ACTION_STATE,
      declineFormData("geography", "  The location is outside our target area.  "),
    )

    expect(selectForMatch).toHaveBeenCalledWith("id", MATCH_ID)
    expect(selectForRepreneur).toHaveBeenCalledWith("repreneur_id", REPRENEUR_ID)
    expect(update).toHaveBeenCalledWith({
      status: "declined",
      decline_reason_categories: ["geography"],
      decline_reason_text: "The location is outside our target area.",
      reviewed_by: null,
      reviewed_at: null,
    })
    expect(updateForMatch).toHaveBeenCalledWith("id", MATCH_ID)
    expect(updateForRepreneur).toHaveBeenCalledWith("repreneur_id", REPRENEUR_ID)
    expect(mocks.redirect).toHaveBeenCalledWith("/portal/deals")
  })

  it("persists Other with its required rationale", async () => {
    const { update } = mockMatchResponse()

    await declineMyOpportunity(
      MATCH_ID,
      EMPTY_ACTION_STATE,
      declineFormData("other", "The timeline is not viable this quarter."),
    )

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: "declined",
      decline_reason_categories: ["other"],
      decline_reason_text: "The timeline is not viable this quarter.",
    }))
  })

  it("rejects a foreign match without attempting an update", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const selectForRepreneur = vi.fn(() => ({ maybeSingle }))
    const selectForMatch = vi.fn(() => ({ eq: selectForRepreneur }))
    const select = vi.fn(() => ({ eq: selectForMatch }))
    const update = vi.fn()
    const from = vi.fn(() => ({ select, update }))
    mocks.createAdminClient.mockReturnValue({ from })

    const result = await declineMyOpportunity(
      MATCH_ID,
      EMPTY_ACTION_STATE,
      declineFormData("sector", "This sector is outside our current thesis."),
    )

    expect(result).toEqual({
      status: "error",
      message: "This opportunity is no longer available for your response.",
    })
    expect(selectForMatch).toHaveBeenCalledWith("id", MATCH_ID)
    expect(selectForRepreneur).toHaveBeenCalledWith("repreneur_id", REPRENEUR_ID)
    expect(update).not.toHaveBeenCalled()
  })

  it.each(["paused", "closed", "archived"] as const)("does not accept a late response after the opportunity is %s", async (opportunityStatus) => {
    const { update } = mockMatchResponse("proposed", opportunityStatus)

    const result = await declineMyOpportunity(
      MATCH_ID,
      EMPTY_ACTION_STATE,
      declineFormData("sector", "The opportunity is no longer current."),
    )

    expect(result).toEqual({
      status: "error",
      message: "This opportunity is no longer available for your response.",
    })
    expect(update).not.toHaveBeenCalled()
  })

  it("does not create a database client without a linked repreneur role", async () => {
    mocks.requirePortalAccess.mockResolvedValue({ repreneurId: null })
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)

    const result = await declineMyOpportunity(
      MATCH_ID,
      EMPTY_ACTION_STATE,
      declineFormData("business_model", "The business model does not match our search."),
    )

    expect(result).toEqual({
      status: "error",
      message: "We could not save your response right now. Please try again.",
    })
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
