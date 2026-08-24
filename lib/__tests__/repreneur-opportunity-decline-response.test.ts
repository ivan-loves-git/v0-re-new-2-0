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
  isDemo = false,
) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { id: MATCH_ID, opportunity_id: OPPORTUNITY_ID, status, opportunity: { status: opportunityStatus, is_demo: isDemo } },
    error: null,
  })
  const selectForDemo = vi.fn(() => ({ maybeSingle }))
  const selectForRepreneur = vi.fn(() => ({ eq: selectForDemo }))
  const selectForMatch = vi.fn(() => ({ eq: selectForRepreneur }))
  const select = vi.fn(() => ({ eq: selectForMatch }))
  const from = vi.fn(() => ({ select }))
  const rpc = vi.fn().mockResolvedValue({
    data: [{ match_id: MATCH_ID, opportunity_id: OPPORTUNITY_ID, status }],
    error: null,
  })

  mocks.createAdminClient.mockReturnValue({ from, rpc })

  return {
    from,
    selectForMatch,
    selectForRepreneur,
    rpc,
  }
}

describe("repreneur opportunity decline response", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requirePortalAccess.mockResolvedValue({ repreneurId: REPRENEUR_ID })
  })

  it.each([undefined, "", " \n\t "])("rejects an empty or whitespace-only rationale", async (rationale) => {
    const { rpc } = mockMatchResponse()

    const result = await declineMyOpportunity(
      MATCH_ID,
      EMPTY_ACTION_STATE,
      declineFormData("geography", rationale),
    )

    expect(result).toEqual({
      status: "error",
      message: "Add a written rationale before marking this opportunity as not a fit.",
    })
    expect(rpc).not.toHaveBeenCalled()
  })

  it("rejects a rationale without an existing structured decline reason", async () => {
    const { rpc } = mockMatchResponse()

    const result = await declineMyOpportunity(
      MATCH_ID,
      EMPTY_ACTION_STATE,
      declineFormData(undefined, "The location is outside our target area."),
    )

    expect(result).toEqual({
      status: "error",
      message: "Choose at least one reason before marking this opportunity as not a fit.",
    })
    expect(rpc).not.toHaveBeenCalled()
  })

  it("persists a normal structured reason and a trimmed rationale", async () => {
    const { selectForMatch, selectForRepreneur, rpc } = mockMatchResponse()

    await declineMyOpportunity(
      MATCH_ID,
      EMPTY_ACTION_STATE,
      declineFormData("geography", "  The location is outside our target area.  "),
    )

    expect(selectForMatch).toHaveBeenCalledWith("id", MATCH_ID)
    expect(selectForRepreneur).toHaveBeenCalledWith("repreneur_id", REPRENEUR_ID)
    expect(rpc).toHaveBeenCalledWith("update_repreneur_opportunity_response", {
      p_match_id: MATCH_ID,
      p_repreneur_id: REPRENEUR_ID,
      p_status: "declined",
      p_decline_reason_categories: ["geography"],
      p_decline_reason_text: "The location is outside our target area.",
    })
    expect(mocks.redirect).toHaveBeenCalledWith("/portal/deals")
  })

  it("persists Other with its required rationale", async () => {
    const { rpc } = mockMatchResponse()

    await declineMyOpportunity(
      MATCH_ID,
      EMPTY_ACTION_STATE,
      declineFormData("other", "The timeline is not viable this quarter."),
    )

    expect(rpc).toHaveBeenCalledWith("update_repreneur_opportunity_response", expect.objectContaining({
      p_status: "declined",
      p_decline_reason_categories: ["other"],
      p_decline_reason_text: "The timeline is not viable this quarter.",
    }))
  })

  it("rejects a foreign match without attempting an update", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const selectForDemo = vi.fn(() => ({ maybeSingle }))
    const selectForRepreneur = vi.fn(() => ({ eq: selectForDemo }))
    const selectForMatch = vi.fn(() => ({ eq: selectForRepreneur }))
    const select = vi.fn(() => ({ eq: selectForMatch }))
    const rpc = vi.fn()
    const from = vi.fn(() => ({ select }))
    mocks.createAdminClient.mockReturnValue({ from, rpc })

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
    expect(rpc).not.toHaveBeenCalled()
  })

  it.each(["paused", "closed", "archived"] as const)("does not accept a late response after the opportunity is %s", async (opportunityStatus) => {
    const { rpc } = mockMatchResponse("proposed", opportunityStatus)

    const result = await declineMyOpportunity(
      MATCH_ID,
      EMPTY_ACTION_STATE,
      declineFormData("sector", "The opportunity is no longer current."),
    )

    expect(result).toEqual({
      status: "error",
      message: "This opportunity is no longer available for your response.",
    })
    expect(rpc).not.toHaveBeenCalled()
  })

  it("does not accept a response for a DEMO-classified opportunity", async () => {
    const { rpc } = mockMatchResponse("proposed", "active", true)

    const result = await declineMyOpportunity(
      MATCH_ID,
      EMPTY_ACTION_STATE,
      declineFormData("sector", "This opportunity is reserved for staff QA."),
    )

    expect(result).toEqual({
      status: "error",
      message: "This opportunity is no longer available for your response.",
    })
    expect(rpc).not.toHaveBeenCalled()
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
