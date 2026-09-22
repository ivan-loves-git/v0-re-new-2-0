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

import { listPortalReNewPursuitBoard, listStaffReNewPursuitBoard, listStaffReNewPursuitBoards } from "@/lib/actions/external-pursuit-board"

describe("staff canonical pursuit board projection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("retains closed siblings in their honest staff views and excludes DEMO pairs", async () => {
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

    const { macro: records, externalContext } = await listStaffReNewPursuitBoards()
    expect(records).toEqual([expect.objectContaining({
      id: "completed-match",
      stage: "completed",
      view: "completed",
      href: "/opportunities/opportunity-1",
    }), expect.objectContaining({ id: "proposed-sibling", stage: "proposed", view: "inactive" }), expect.objectContaining({ id: "declined-sibling", stage: "declined", view: "dropped" })])
    expect(records.every((record) => !("updatedAt" in record))).toBe(true)
    expect(externalContext).toEqual([expect.objectContaining({ id: "completed-match", canonicalJourney: "closed", stage: "completed" })])
    await expect(listStaffReNewPursuitBoard()).resolves.toEqual(externalContext)
  })

  it("preserves confirmed history without projecting raw evidence or deriving milestone dates", async () => {
    mocks.listOpportunityWorkSurfaceRecords.mockResolvedValue([{
      id: "alfa", status: "paused", is_demo: false, public_title: "Company Alfa", reference: "RE-001",
      matches: [{ id: "sofia-alfa", status: "active_pursuit", pursuit_stage: "qa_with_ma_firm", pursuit_stage_provenance: "staff_confirmed_history", pursuit_stage_notes: "Private source", updated_at: "2026-09-20", repreneur: { first_name: "Sofia", last_name: "Example", is_demo: false } }],
    }])
    const { macro: records, externalContext } = await listStaffReNewPursuitBoards()
    expect(records).toEqual([{ id: "sofia-alfa", title: "Company Alfa", ownerName: "Sofia Example", href: "/opportunities/alfa", stage: "qa_with_ma_firm", column: null, view: "inactive", context: "Opportunity paused", stageProvenance: "staff_confirmed_history" }])
    expect(externalContext).toEqual([])
  })

  it("propagates staff access denial from the canonical reader", async () => {
    mocks.listOpportunityWorkSurfaceRecords.mockRejectedValue(new Error("Staff access required"))
    await expect(listStaffReNewPursuitBoards()).rejects.toThrow("Staff access required")
  })

  it("leaves the authorized portal projection on its existing External macro categories", async () => {
    mocks.listMyRepreneurOpportunities.mockResolvedValue({ opportunities: [
      { match_id: "portal-qa", public_title: "Company Alfa", updated_at: "2026-09-20", match_status: "active_pursuit", pursuit_stage: "qa_with_ma_firm", pursuit_stage_provenance: "staff_confirmed_history" },
      { match_id: "declined", public_title: "Company Beta", match_status: "declined" },
    ] })
    await expect(listPortalReNewPursuitBoard()).resolves.toEqual([expect.objectContaining({ id: "portal-qa", stage: "meetings", canonicalJourney: "qa_with_ma_firm", stageProvenance: "staff_confirmed_history", href: "/portal/deals/portal-qa" })])
  })
})
