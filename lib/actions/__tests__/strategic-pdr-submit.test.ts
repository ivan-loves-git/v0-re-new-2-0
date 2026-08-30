import { describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ inserted: [] as Array<{ table: string; value: unknown }>, uploads: [] as string[], removed: [] as string[], access: { user: { id: "staff-1", name: "Staff" }, role: "staff" } }))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: vi.fn(async () => state.access) }))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: (table: string) => ({
      insert: (value: unknown) => {
        state.inserted.push({ table, value })
        return table === "pdr_proposals"
          ? { select: () => ({ single: async () => ({ data: { id: "123e4567-e89b-42d3-a456-426614174000" }, error: null }) }) }
          : { error: null }
      },
    }),
    storage: { from: () => ({ upload: async (path: string) => { state.uploads.push(path); return { error: null } }, remove: async (paths: string[]) => { state.removed.push(...paths); return { error: null } } }) },
  })),
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`) } }))

import { submitStrategicPdrRequest } from "@/lib/actions/strategic-pdr"

describe("Strategic PDR submission", () => {
  it("uses session identity and saves a private attachment record through the canonical history table", async () => {
    state.inserted.length = 0; state.uploads.length = 0
    const form = new FormData(); form.set("title", "Test request"); form.set("original_text", "A sufficiently detailed staff intake request.")
    form.append("attachments", new File(["private"], "brief.pdf", { type: "application/pdf" }))
    await expect(submitStrategicPdrRequest(form)).rejects.toThrow("redirect:/strategic-pdr/requests/123e4567-e89b-42d3-a456-426614174000")
    expect(state.uploads).toHaveLength(1)
    expect(state.inserted.find((entry) => entry.table === "pdr_proposals")?.value).toMatchObject({ intake_provenance: "wave_staff_v1" })
    expect(state.inserted.find((entry) => entry.table === "wave_pdr_history_attachments")?.value).toMatchObject({ proposal_id: "123e4567-e89b-42d3-a456-426614174000", uploaded_by_user_id: "staff-1" })
  })
})
