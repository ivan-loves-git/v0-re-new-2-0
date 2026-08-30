import { describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  conditions: [] as Array<[string, ...unknown[]]>,
  rows: [] as Array<{ id: string }>,
}))

vi.mock("@/lib/access-control", () => ({ requireStaffAccess: vi.fn(async () => ({ user: { id: "ivan-user" }, role: "staff" })) }))
vi.mock("@/lib/pdr/intake-server", () => ({
  canDispositionPdr: vi.fn(async () => true),
  assertPdrAttachment: vi.fn(),
  pdrAttachmentPath: vi.fn(),
  PDR_ATTACHMENT_BUCKET: "pdr-intake-attachments",
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => {
    const query = {
      eq: (field: string, value: unknown) => { state.conditions.push(["eq", field, value]); return query },
      not: (field: string, operator: string, value: unknown) => { state.conditions.push(["not", field, operator, value]); return query },
      is: (field: string, value: unknown) => { state.conditions.push(["is", field, value]); return query },
      select: async () => ({ data: state.rows, error: null }),
    }
    return { from: () => ({ update: () => query }) }
  }),
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))

import { dispositionStrategicPdrRequest } from "@/lib/actions/strategic-pdr"

const form = () => {
  const data = new FormData()
  data.set("request_id", "123e4567-e89b-42d3-a456-426614174000")
  data.set("disposition", "approved")
  return data
}

describe("Strategic PDR disposition action", () => {
  it("enforces the new-WAVE draft contract in the database mutation", async () => {
    state.conditions.length = 0
    state.rows = []
    await expect(dispositionStrategicPdrRequest(form())).rejects.toThrow("The request was not found or was already disposed.")
    expect(state.conditions).toEqual(expect.arrayContaining([
      ["eq", "status", "draft"],
      ["eq", "requester_actor", "Staff"],
      ["not", "requester_user_id", "is", null],
      ["eq", "intake_provenance", "wave_staff_v1"],
      ["is", "disposition_kind", null],
    ]))
  })

  it("allows the guarded update only when the eligible row is returned", async () => {
    state.conditions.length = 0
    state.rows = [{ id: "123e4567-e89b-42d3-a456-426614174000" }]
    await expect(dispositionStrategicPdrRequest(form())).resolves.toBeUndefined()
  })
})
