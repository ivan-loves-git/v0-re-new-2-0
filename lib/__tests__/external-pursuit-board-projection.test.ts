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
      is_demo: false,
      reference: "RE-001",
      public_title: "Canonical target",
      status: "closed",
      matches: [
        { id: "completed-match", status: "completed", pursuit_stage: "closed", updated_at: "2026-08-16T10:00:00Z", repreneur: { first_name: "Ada", last_name: "Owner", is_demo: false } },
        { id: "proposed-sibling", status: "proposed", pursuit_stage: null, updated_at: "2026-08-16T09:00:00Z", repreneur: { first_name: "Pat", last_name: "Proposed" } },
        { id: "declined-sibling", status: "declined", pursuit_stage: null, updated_at: "2026-08-16T08:00:00Z", repreneur: { first_name: "Dee", last_name: "Declined" } },
        { id: "demo-owner", status: "active_pursuit", pursuit_stage: "interest", updated_at: "2026-08-16T11:00:00Z", repreneur: { first_name: "Demo", last_name: "Owner", is_demo: true } },
      ],
    }, {
      id: "demo-opportunity",
      is_demo: true,
      reference: "TEST-001",
      public_title: "Demo target",
      status: "active",
      matches: [{ id: "demo-match", status: "active_pursuit", pursuit_stage: "interest", updated_at: "2026-08-16T12:00:00Z", repreneur: { first_name: "Real", last_name: "Owner", is_demo: false } }],
    }])

    await expect(listStaffReNewPursuitBoard()).resolves.toEqual([expect.objectContaining({
      id: "completed-match",
      stage: "completed",
      canonicalJourney: "closed",
      href: "/opportunities/opportunity-1",
    })])
  })
})
