import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ client: vi.fn(), staff: vi.fn(), ledger: vi.fn(), sourceReview: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.client }))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: mocks.staff }))
vi.mock("@/lib/data/ma-relationship-ledger", () => ({ readMaRelationshipLedger: mocks.ledger }))
vi.mock("@/lib/data/provisional-source-review", () => ({ withStaffSourceReviewState: mocks.sourceReview }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import { getMaRelationshipWorkspace } from "@/lib/actions/ma-relationships"

describe("staff Activity office projection (#150)", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.staff.mockResolvedValue({ user: { id: "staff" } })
    mocks.ledger.mockResolvedValue({ affiliations: [], opportunities: [], activities: [], activePursuitOpportunityIds: new Set() })
    mocks.sourceReview.mockResolvedValue([])
  })

  function client(context: { data: { office_id: string } | null; error: { message: string } | null }) {
    const contextKey = vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue(context) }))
    const rows = [
      { id: "canonical-provisional", name: "Operational office", status: "active", firm: { id: "firm-a", name: "Renamed firm", status: "active" } },
      { id: "unrelated-lookalike", name: "Acme Paris", status: "active", firm: { id: "firm-b", name: "Acme Co.", status: "active" } },
    ]
    const from = vi.fn((table: string) => {
      if (table === "ma_offices") return { select: () => ({ order: vi.fn().mockResolvedValue({ data: rows, error: null }) }) }
      if (table === "ma_provisional_source_contexts") return { select: () => ({ eq: contextKey }) }
      if (table === "opportunity_ma_contacts") return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) }
      throw new Error(`Unexpected table ${table}`)
    })
    mocks.client.mockReturnValue({ from })
    return { contextKey }
  }

  it("uses the canonical context office ID, even if its names change", async () => {
    const { contextKey } = client({ data: { office_id: "canonical-provisional" }, error: null })
    const workspace = await getMaRelationshipWorkspace()
    expect(contextKey).toHaveBeenCalledWith("context_key", "acme_co_paris")
    expect(workspace.offices.find((office) => office.id === "canonical-provisional")?.isProvisionalSource).toBe(true)
    expect(workspace.offices.find((office) => office.id === "unrelated-lookalike")?.isProvisionalSource).toBe(false)
    expect(workspace.offices.find((office) => office.id === "canonical-provisional")?.officeName).toBe("Operational office")
  })

  it("does not silently treat missing canonical context as ordinary source identity", async () => {
    client({ data: null, error: null })
    await expect(getMaRelationshipWorkspace()).rejects.toThrow("provisional source review context is unavailable")
  })

  it("retains staff access enforcement before reading source context", async () => {
    mocks.staff.mockRejectedValue(new Error("Access denied"))
    await expect(getMaRelationshipWorkspace()).rejects.toThrow("Access denied")
    expect(mocks.client).not.toHaveBeenCalled()
  })
})
