import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requirePortalAccess: vi.fn(),
  requireStaffAccess: vi.fn(),
  verifyStaffPortalSelection: vi.fn(),
  createAdminClient: vi.fn(),
  readPortalDealActionIndicators: vi.fn(),
  readPortalCurrentPursuit: vi.fn(),
  listMyRepreneurOpportunities: vi.fn(),
  listStaffPortalPreviewOwnedOpportunities: vi.fn(),
}))

vi.mock("@/lib/access-control", () => ({
  requirePortalAccess: mocks.requirePortalAccess,
  requireStaffAccess: mocks.requireStaffAccess,
}))
vi.mock("@/lib/staff-portal-selection", () => ({ verifyStaffPortalSelection: mocks.verifyStaffPortalSelection }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock("@/lib/data/current-pursuit", () => ({
  readPortalDealActionIndicators: mocks.readPortalDealActionIndicators,
  readPortalCurrentPursuit: mocks.readPortalCurrentPursuit,
}))
vi.mock("@/lib/actions/repreneur-opportunities", () => ({
  listMyRepreneurOpportunities: mocks.listMyRepreneurOpportunities,
}))
vi.mock("@/lib/actions/repreneur-portal-preview", () => ({
  listStaffPortalPreviewOwnedOpportunities: mocks.listStaffPortalPreviewOwnedOpportunities,
}))

import { readPortalNextActions } from "@/lib/data/portal-next-actions"

const ownerId = "00000000-0000-4000-8000-000000000001"
const otherId = "00000000-0000-4000-8000-000000000002"
const matchId = "00000000-0000-4000-8000-000000000003"
const workspaceId = "00000000-0000-4000-8000-000000000004"
const generation = "00000000-0000-4000-8000-000000000005"

const safeSource = {
  repreneur: { id: ownerId, is_demo: false, first_name: "Test", last_name: "Owner", email: "test@example.test" },
  opportunities: [
    { match_id: matchId, match_status: "active_pursuit", public_title: "Public title",
      interest_expressed_at: null, recommendation_expires_at: null, interest_rejected: false },
  ],
}

function externalQuery(data: unknown = []) {
  const filters: Array<[string, unknown]> = []
  let selected = ""
  const result = { data, error: null }
  const builder: Record<string, unknown> & PromiseLike<typeof result> = {
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject) },
  }
  builder.select = vi.fn((columns: string) => { selected = columns; return builder })
  builder.eq = vi.fn((column: string, value: unknown) => { filters.push([column, value]); return builder })
  return { builder, filters, get selected() { return selected } }
}

describe("Ticket #132 current-owner read boundary", () => {
  let query: ReturnType<typeof externalQuery>
  beforeEach(() => {
    vi.clearAllMocks()
    query = externalQuery()
    mocks.requirePortalAccess.mockResolvedValue({ role: "repreneur", repreneurId: ownerId })
    mocks.requireStaffAccess.mockResolvedValue({ role: "staff", user: { id: "staff-actor" } })
    mocks.verifyStaffPortalSelection.mockResolvedValue({ workspaceId, generation, ownerId, staffUserId: "staff-actor" })
    mocks.readPortalDealActionIndicators.mockResolvedValue({})
    mocks.readPortalCurrentPursuit.mockResolvedValue(null)
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => query.builder) })
    mocks.listMyRepreneurOpportunities.mockResolvedValue(safeSource)
    mocks.listStaffPortalPreviewOwnedOpportunities.mockResolvedValue(safeSource)
  })

  it("authorizes the owner before constructing a service client", async () => {
    mocks.requirePortalAccess.mockRejectedValue(new Error("owner denied"))
    await expect(readPortalNextActions({ kind: "portal" }, safeSource as never)).rejects.toThrow("owner denied")
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("fails closed on absent or mismatched staff selection before any owner data read", async () => {
    mocks.verifyStaffPortalSelection.mockResolvedValue(null)
    const result = await readPortalNextActions({ kind: "staff-preview", repreneurId: ownerId,
      selectionToken: "stale" }, safeSource as never)
    expect(result).toBeNull()
    expect(mocks.verifyStaffPortalSelection).toHaveBeenCalledWith("stale", ownerId, "staff-actor")
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
    expect(mocks.readPortalCurrentPursuit).not.toHaveBeenCalled()
  })

  it("rejects another source owner and an unclassified namespace", async () => {
    const otherOwner = { ...safeSource, repreneur: { ...safeSource.repreneur, id: otherId } }
    const other = await readPortalNextActions({ kind: "portal" }, otherOwner as never)
    expect(other?.state).toBe("unavailable")
    const unknownNamespace = { ...safeSource, repreneur: { ...safeSource.repreneur, is_demo: null } }
    const unknown = await readPortalNextActions({ kind: "portal" }, unknownNamespace as never)
    expect(unknown?.state).toBe("unavailable")
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("uses only the selected owner query and serializes no source or private note data", async () => {
    query = externalQuery([{ id: "dossier-1", title: "My dossier", next_action: "Call back",
      responsible_party: "owner", due_at: null, stage: "identified", deletion_status: "active",
      staff_internal_notes: "PRIVATE STAFF NOTE" }])
    mocks.readPortalCurrentPursuit.mockResolvedValue({ action: null, signedCopyState: "validated",
      confidentialGrant: { informationMemoDocumentId: "memo-1", source: { firmName: "PRIVATE SOURCE" } } })
    const result = await readPortalNextActions({ kind: "portal" }, safeSource as never)
    expect(result?.state).toBe("ready")
    expect(query.selected).toBe("id,title,next_action,responsible_party,due_at,stage,deletion_status")
    expect(query.filters).toEqual([["owner_repreneur_id", ownerId], ["deletion_status", "active"]])
    expect(mocks.readPortalCurrentPursuit).toHaveBeenCalledWith({ matchId, viewer: { kind: "portal" } })
    expect(result?.resources[0].href).toBe(`/portal/deals/${matchId}/documents/memo-1`)
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE SOURCE|PRIVATE STAFF NOTE|test@example\.test|staff-actor/)
  })

  it("uses page-issued selected-owner generation for preview resource links", async () => {
    mocks.readPortalCurrentPursuit.mockResolvedValue({ action: "sign_nda", signedCopyState: "not_submitted",
      confidentialGrant: null })
    const result = await readPortalNextActions({ kind: "staff-preview", repreneurId: ownerId,
      selectionToken: "current" }, safeSource as never)
    expect(result?.yourActions).toHaveLength(1)
    expect(result?.resources[0].href).toContain(`selectionGeneration=${generation}`)
    expect(result?.resources[0].href).toContain(`workspaceId=${workspaceId}`)
    expect(result?.yourActions[0].href).toContain(`repreneurId=${ownerId}`)
    expect(result?.yourActions[0].href).not.toContain("/portal/deals/")
  })

  it("reuses same-request owner-safe board and indicator inputs while retaining cross-space actions", async () => {
    const source = { ...safeSource, opportunities: [{ match_id: matchId, match_status: "proposed",
      public_title: "Recommendation", recommendation_expires_at: null }] }
    const external = [{ id: "external-1", ownerRepreneurId: ownerId, deletionStatus: "active",
      title: "Owner dossier", nextAction: "Call adviser", responsibleParty: "owner", dueAt: null,
      stage: "identified", sharedNotes: "PRIVATE NOTES", contacts: [{ name: "PRIVATE CONTACT" }] }]
    const result = await readPortalNextActions({ kind: "portal" }, source as never,
      { indicators: { [matchId]: "respond" }, external: external as never })
    expect(result?.yourActions.map((action) => action.title)).toEqual(expect.arrayContaining(["Recommendation", "Owner dossier"]))
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
    expect(mocks.readPortalDealActionIndicators).not.toHaveBeenCalled()
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE NOTES|PRIVATE CONTACT/)
  })

  it("rejects a reused External board belonging to another owner", async () => {
    const result = await readPortalNextActions({ kind: "portal" }, safeSource as never, {
      external: [{ ownerRepreneurId: otherId, deletionStatus: "active" }] as never,
    })
    expect(result?.state).toBe("unavailable")
  })

})
