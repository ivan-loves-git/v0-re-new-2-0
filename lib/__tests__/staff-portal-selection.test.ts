import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ row: {
  selected_repreneur_id: "10000000-0000-4000-8000-000000000001",
  generation: "10000000-0000-4000-8000-000000000004",
  staff_user_id: "staff-a",
} }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/env", () => ({ env: { BETTER_AUTH_SECRET: "synthetic-test-secret" } }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mocks.row, error: null }) }) }) }),
}) }))

import {
  currentStaffPortalSelectionToken,
  issueStaffPortalSelection,
  parseStaffPortalSelection,
  verifyStaffPortalSelection,
} from "@/lib/staff-portal-selection"

const ownerA = "10000000-0000-4000-8000-000000000001"
const ownerB = "10000000-0000-4000-8000-000000000002"
const workspaceId = "10000000-0000-4000-8000-000000000003"
const generationA = "10000000-0000-4000-8000-000000000004"
const generationB = "10000000-0000-4000-8000-000000000005"

describe("staff Portal workspace capability", () => {
  beforeEach(() => {
    mocks.row.selected_repreneur_id = ownerA
    mocks.row.generation = generationA
    mocks.row.staff_user_id = "staff-a"
  })

  it("revokes an otherwise valid A token when its workspace selects B", async () => {
    const tokenA = issueStaffPortalSelection(ownerA, "staff-a", workspaceId, generationA)
    expect(await verifyStaffPortalSelection(tokenA, ownerA, "staff-a")).toMatchObject({ workspaceId, generation: generationA })
    expect(parseStaffPortalSelection(tokenA, ownerA, "staff-b")).toBeNull()
    mocks.row.selected_repreneur_id = ownerB
    mocks.row.generation = generationB
    expect(await verifyStaffPortalSelection(tokenA, ownerA, "staff-a")).toBeNull()
    expect(await currentStaffPortalSelectionToken(workspaceId, ownerA, "staff-a")).toBeNull()
    const tokenB = await currentStaffPortalSelectionToken(workspaceId, ownerB, "staff-a")
    expect(tokenB && await verifyStaffPortalSelection(tokenB, ownerB, "staff-a"))
      .toMatchObject({ ownerId: ownerB, generation: generationB })
  })
})
