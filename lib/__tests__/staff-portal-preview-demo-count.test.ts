import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  requireStaffAccess: vi.fn(),
}))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/access-control", () => ({
  requireStaffAccess: mocks.requireStaffAccess,
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mocks.from }),
}))
vi.mock("@/lib/data/locked-opportunity-interest-state", () => ({
  listLockedOpportunityInterestStateByMatch: vi.fn(async () => new Map()),
}))

import { listStaffPortalPreviewOptions } from "@/lib/actions/repreneur-portal-preview"

function query(result: { data: unknown; error: null }) {
  const builder: Record<string, unknown> & PromiseLike<typeof result> = {
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject)
    },
  }
  for (const method of ["select", "eq", "in", "order"] as const) {
    builder[method] = vi.fn(() => builder)
  }
  return builder
}

describe("Staff Portal Preview DEMO counts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ role: "staff" })
    mocks.from.mockImplementation((table: string) => {
      if (table === "repreneurs") return query({
        data: [{
          id: "repreneur-1",
          first_name: "QA",
          last_name: "Repreneur",
          email: "qa@example.invalid",
          lifecycle_status: "active",
          is_demo: false,
        }],
        error: null,
      })
      if (table === "app_user_roles") return query({ data: [], error: null })
      if (table === "opportunity_matches") return query({
        data: [
          { repreneur_id: "repreneur-1", opportunity: { is_demo: false, status: "active" }, repreneur: { is_demo: false } },
          { repreneur_id: "repreneur-1", opportunity: { is_demo: true, status: "active" }, repreneur: { is_demo: false } },
          { repreneur_id: "repreneur-1", opportunity: { is_demo: false, status: "paused" }, repreneur: { is_demo: false } },
        ],
        error: null,
      })
      throw new Error(`Unexpected table: ${table}`)
    })
  })

  it("counts only active opportunities in the selected repreneur's namespace", async () => {
    const [option] = await listStaffPortalPreviewOptions()

    expect(option.visibleOpportunityCount).toBe(1)
    expect(mocks.requireStaffAccess).toHaveBeenCalledOnce()
  })
})
