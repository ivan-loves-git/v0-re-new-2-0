import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  listOpportunityWorkSurfaceRecords: vi.fn(),
  listMyRepreneurOpportunities: vi.fn(),
  requireStaffAccess: vi.fn(),
}))

vi.mock("@/lib/actions/opportunities", () => ({
  listOpportunityWorkSurfaceRecords: mocks.listOpportunityWorkSurfaceRecords,
}))
vi.mock("@/lib/actions/repreneur-opportunities", () => ({
  listMyRepreneurOpportunities: mocks.listMyRepreneurOpportunities,
}))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: mocks.requireStaffAccess }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))

import { listStaffReNewPursuitBoard } from "@/lib/actions/external-pursuit-board"

describe("staff canonical pursuit board projection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("keeps only the genuinely terminal match when a closed opportunity has proposed and declined siblings", async () => {
    mocks.listOpportunityWorkSurfaceRecords.mockResolvedValue([{
      id: "opportunity-1",
      reference: "RE-001",
      public_title: "Canonical target",
      status: "closed",
      matches: [
        { id: "completed-match", status: "completed", pursuit_stage: "closed", updated_at: "2026-08-16T10:00:00Z", repreneur: { first_name: "Ada", last_name: "Owner" } },
        { id: "proposed-sibling", status: "proposed", pursuit_stage: null, updated_at: "2026-08-16T09:00:00Z", repreneur: { first_name: "Pat", last_name: "Proposed" } },
        { id: "declined-sibling", status: "declined", pursuit_stage: null, updated_at: "2026-08-16T08:00:00Z", repreneur: { first_name: "Dee", last_name: "Declined" } },
      ],
    }])

    await expect(listStaffReNewPursuitBoard()).resolves.toEqual([expect.objectContaining({
      id: "completed-match",
      stage: "completed",
      canonicalJourney: "closed",
      href: "/opportunities/opportunity-1",
    })])
  })
})
