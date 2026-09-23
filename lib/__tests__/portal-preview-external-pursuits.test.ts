import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  from: vi.fn(),
}))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: mocks.requireStaffAccess }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: mocks.from }) }))

import { listStaffPortalPreviewExternalPursuits } from "@/lib/actions/repreneur-portal-preview"

const ownerId = "00000000-0000-4000-8000-000000000001"
const dossierId = "00000000-0000-4000-8000-000000000002"

function query(rows: unknown[]) {
  const builder: Record<string, unknown> & PromiseLike<{ data: unknown[]; error: null }> = {
    then(resolve, reject) {
      return Promise.resolve({ data: rows, error: null }).then(resolve, reject)
    },
  }
  for (const method of ["select", "eq", "in", "order"] as const) builder[method] = vi.fn(() => builder)
  builder.maybeSingle = vi.fn(async () => ({ data: rows[0] ?? null, error: null }))
  return builder
}

describe("staff selected-owner External Pursuit preview", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ role: "staff", user: { id: "staff-1" } })
  })

  it("reads only the selected owner's active dossiers and projects owner-safe fields", async () => {
    const owner = query([{ id: ownerId, first_name: "Ada", last_name: "Owner", is_demo: true }])
    const dossiers = query([{
      id: dossierId, owner_repreneur_id: ownerId, title: "Independent search", stage: "identified",
      availability: "available", deletion_status: "active", external_url: null,
      target_company: "Example", source_channel: "Direct", revenue_meur: 2,
      ebitda_keur: 300, headcount: 12, next_action: "Call owner", responsible_party: "staff",
      due_at: "2026-10-01", updated_at: "2026-09-23T10:00:00Z",
      staff_internal_notes: "must never leave server",
    }])
    const notes = query([{ external_pursuit_id: dossierId, shared_notes: "Shared context" }])
    const contacts = query([{ id: "contact-1", external_pursuit_id: dossierId, name: "Contact", organisation: null, role_title: null, email: null, phone: null }])
    const conversions = query([])
    mocks.from.mockImplementation((table: string) => {
      if (table === "repreneurs") return owner
      if (table === "external_pursuits") return dossiers
      if (table === "external_pursuit_notes") return notes
      if (table === "external_pursuit_contacts") return contacts
      if (table === "external_pursuit_opportunity_conversions") return conversions
      throw new Error(`Unexpected table ${table}`)
    })

    const records = await listStaffPortalPreviewExternalPursuits(ownerId)

    expect(dossiers.eq).toHaveBeenCalledWith("owner_repreneur_id", ownerId)
    expect(dossiers.eq).toHaveBeenCalledWith("deletion_status", "active")
    expect(records).toEqual([expect.objectContaining({
      id: dossierId, ownerRepreneurId: ownerId, title: "Independent search",
      sharedNotes: "Shared context", contacts: [expect.objectContaining({ name: "Contact" })],
    })])
    expect(JSON.stringify(records)).not.toContain("staff_internal_notes")
    expect(JSON.stringify(records)).not.toContain("must never leave server")
  })

  it("fails closed on invalid or missing selected owner", async () => {
    await expect(listStaffPortalPreviewExternalPursuits("bad-id")).resolves.toEqual([])
    expect(mocks.from).not.toHaveBeenCalled()

    mocks.from.mockImplementation(() => query([]))
    await expect(listStaffPortalPreviewExternalPursuits(ownerId)).resolves.toEqual([])
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })

  it("rejects a mismatched dossier even if a database response ignores the owner filter", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === "repreneurs") return query([{ id: ownerId, is_demo: false }])
      if (table === "external_pursuits") return query([{
        id: dossierId, owner_repreneur_id: "00000000-0000-4000-8000-000000000099",
        deletion_status: "active",
      }])
      throw new Error(`Unexpected table ${table}`)
    })

    await expect(listStaffPortalPreviewExternalPursuits(ownerId)).rejects.toThrow("Selected-owner dossier mismatch")
    expect(mocks.from).toHaveBeenCalledTimes(2)
  })
})
