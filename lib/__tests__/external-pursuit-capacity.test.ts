import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  getCurrentUserAccess: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/access-control", () => ({
  getCurrentUserAccess: mocks.getCurrentUserAccess,
  requireStaffAccess: mocks.requireStaffAccess,
}))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))

import {
  confirmExternalPursuitCurrent,
  getExternalPursuitCapacitySnapshot,
} from "@/lib/actions/external-pursuit-capacity"
import {
  beginExternalPursuitConfirmation,
  EMPTY_EXTERNAL_PURSUIT_CONFIRMATION_STATE,
  settleExternalPursuitConfirmation,
} from "@/lib/utils/external-pursuit-confirmation"

const source = (path: string) => readFileSync(`${process.cwd()}/${path}`, "utf8")
const migration = source("scripts/099_external_pursuit_capacity_freshness.sql")
const rehearsal = source("scripts/rehearse-external-pursuit-capacity.sql")
const workspace = source("components/pursuits/external-pursuit-capacity-workspace.tsx")
const ownerConfirmation = source("components/pursuits/external-pursuit-confirm-current-button.tsx")
const board = source("components/pursuits/external-pursuit-board.tsx")
const capacityAction = source("lib/actions/external-pursuit-capacity.ts")
const navigation = source("components/app-sidebar.tsx")
const contract = source("docs/data-models/external-pursuit-data-model-v1.md")
const maContract = source("docs/data-models/ma-advisory-data-model-v1.md")
const telemetry = source("lib/telemetry/privacy.ts")
const opportunityAnalytics = source("lib/actions/opportunity-analytics.ts")
const opportunityExport = source("lib/actions/opportunity-export.ts")
const opportunityRecords = source("lib/actions/opportunities.ts")

describe("W-110 External Pursuit capacity", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ user: { id: "staff-1" } })
    mocks.getCurrentUserAccess.mockResolvedValue({ user: { id: "staff-1" }, role: "staff", repreneurId: null })
    mocks.rpc.mockResolvedValue({ data: { as_of_paris_date: "2026-05-01", as_of_paris_timestamp: "2026-05-01T00:30:00+02:00", open_capacity: {}, open_dossiers: [], linked_dossiers: [] }, error: null, status: 204 })
  })

  it("uses staff access and a server-side capacity RPC", async () => {
    await expect(getExternalPursuitCapacitySnapshot()).resolves.toMatchObject({ as_of_paris_date: "2026-05-01" })
    expect(mocks.requireStaffAccess).toHaveBeenCalledOnce()
    expect(mocks.rpc).toHaveBeenCalledWith("external_pursuit_capacity_for_staff", { p_actor_user_id: "staff-1" })
  })

  it("confirms freshness for authorised staff with an explicit client retry key", async () => {
    await expect(confirmExternalPursuitCurrent("00000000-0000-4000-8000-000000011100", "confirmation-key")).resolves.toEqual({ success: true, outcome: "confirmed", message: "Current status confirmed." })
    expect(mocks.getCurrentUserAccess).toHaveBeenCalledOnce()
    expect(mocks.rpc).toHaveBeenCalledWith("confirm_external_pursuit_current", {
      p_dossier_id: "00000000-0000-4000-8000-000000011100",
      p_actor_user_id: "staff-1",
      p_idempotency_key: "confirmation-key",
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/opportunities/pursuits/capacity")
  })

  it("passes an owner identity to the database, where owner-self authorization is enforced", async () => {
    mocks.getCurrentUserAccess.mockResolvedValue({
      user: { id: "owner-1" },
      role: "repreneur",
      repreneurId: "00000000-0000-4000-8000-000000011100",
    })
    await expect(confirmExternalPursuitCurrent("00000000-0000-4000-8000-000000011100", "owner-key")).resolves.toMatchObject({ success: true, outcome: "confirmed" })
    expect(mocks.rpc).toHaveBeenCalledWith("confirm_external_pursuit_current", expect.objectContaining({ p_actor_user_id: "owner-1" }))
  })

  it("only unlocks on allowlisted domain rejections and retains exact retry state for uncertain receipts", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: new Error("External Pursuit access denied."), status: 400 })
    await expect(confirmExternalPursuitCurrent("00000000-0000-4000-8000-000000011100", "rejected-key")).resolves.toMatchObject({ success: false, outcome: "rejected" })

    mocks.rpc.mockResolvedValueOnce({ data: null, error: new Error("External Pursuit is not open capacity."), status: 409 })
    await expect(confirmExternalPursuitCurrent("00000000-0000-4000-8000-000000011100", "closed-key")).resolves.toMatchObject({ success: false, outcome: "rejected" })

    mocks.rpc.mockResolvedValueOnce({ data: null, error: new Error("fetch failed"), status: 0 })
    await expect(confirmExternalPursuitCurrent("00000000-0000-4000-8000-000000011100", "status-zero-key")).resolves.toMatchObject({ success: false, outcome: "ambiguous" })

    mocks.rpc.mockResolvedValueOnce({ data: null, error: new Error("Bad Gateway"), status: 502 })
    await expect(confirmExternalPursuitCurrent("00000000-0000-4000-8000-000000011100", "gateway-key")).resolves.toMatchObject({ success: false, outcome: "ambiguous" })

    mocks.rpc.mockResolvedValueOnce({ data: null, error: new Error("Gateway Timeout"), status: 504 })
    await expect(confirmExternalPursuitCurrent("00000000-0000-4000-8000-000000011100", "timeout-key")).resolves.toMatchObject({ success: false, outcome: "ambiguous" })

    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "PGRST301 upstream response was incomplete" }, status: 500 })
    await expect(confirmExternalPursuitCurrent("00000000-0000-4000-8000-000000011100", "postgrest-key")).resolves.toMatchObject({ success: false, outcome: "ambiguous" })

    mocks.rpc.mockResolvedValueOnce({ data: null, error: null })
    await expect(confirmExternalPursuitCurrent("00000000-0000-4000-8000-000000011100", "missing-receipt-key")).resolves.toMatchObject({ success: false, outcome: "ambiguous" })

    mocks.rpc.mockRejectedValueOnce(Object.assign(new Error("network"), { status: 0 }))
    await expect(confirmExternalPursuitCurrent("00000000-0000-4000-8000-000000011100", "ambiguous-key")).resolves.toMatchObject({ success: false, outcome: "ambiguous" })
  })

  it("retains one frozen dossier/key snapshot for ambiguous retries and unlocks rejection", () => {
    const first = beginExternalPursuitConfirmation(
      EMPTY_EXTERNAL_PURSUIT_CONFIRMATION_STATE,
      "dossier-a",
      () => "client-key-1",
    )
    expect(first.started).toBe(true)
    if (!first.started) throw new Error("expected confirmation start")
    expect(Object.isFrozen(first.attempt)).toBe(true)

    const ambiguous = settleExternalPursuitConfirmation(first.state, "ambiguous")
    const retry = beginExternalPursuitConfirmation(ambiguous, "dossier-a", () => "client-key-2")
    expect(retry.started).toBe(true)
    if (!retry.started) throw new Error("expected confirmation retry")
    expect(retry.attempt).toBe(first.attempt)
    expect(retry.attempt.idempotencyKey).toBe("client-key-1")
    expect(beginExternalPursuitConfirmation(ambiguous, "dossier-b", () => "other-key").started).toBe(false)

    const rejected = settleExternalPursuitConfirmation(retry.state, "rejected")
    expect(rejected).toEqual({ pending: null, inFlight: false })
    expect(beginExternalPursuitConfirmation(rejected, "dossier-b", () => "new-key").started).toBe(true)
  })

  it("enforces Paris boundaries, full distributions, role boundaries and the excluded linked bucket in SQL", () => {
    expect(migration).toContain("AT TIME ZONE 'Europe/Paris'")
    expect(migration).toContain("<= 30 THEN 'fresh'")
    expect(migration).toContain("WHEN dossier.due_at < paris_today THEN 'overdue'")
    expect(migration).toContain("WHEN dossier.due_at = paris_today THEN 'today'")
    expect(migration).toContain("dossier.stage NOT IN ('completed', 'dropped_archived')")
    expect(migration).toContain("conversion.external_pursuit_id IS NULL")
    expect(migration).toContain("'is_open_capacity', p.deletion_status = 'active'")
    expect(migration).toContain("assert_external_pursuit_access(p_dossier_id, actor, FALSE)")
    expect(migration).toContain("hashtextextended(p_dossier_id::TEXT, 0)")
    expect(migration).toContain("event.metadata->>'confirmation' = 'current'")
    expect(migration).toContain("'as_of_paris_timestamp', paris_timestamp")
    expect(migration).toContain("'dropped_archived', (SELECT count(*) FROM open_dossiers")
    expect(migration).toContain("WHEN dossier.last_confirmed_at IS NULL THEN 'unknown'")
    expect(migration).toContain("'External Pursuit confirmation idempotency conflict.'")
    expect(rehearsal).toContain("w110_freshness_boundary_failed")
    expect(rehearsal).toContain("w110_due_boundary_failed")
    expect(rehearsal).toContain("w110_owner_capacity_read_was_allowed")
    expect(rehearsal).toContain("w110_other_owner_confirmation_was_allowed")
    expect(rehearsal).toContain("w110_linked_owner_confirmation_visible")
    expect(rehearsal).toContain("w110_open_owner_confirmation_hidden")
    expect(rehearsal).toContain("w110_normal_edit_confirmed_freshness")
    expect(rehearsal).toContain("w110_standard_opportunity_boundary_changed")
  })

  it("keeps standard inventory, source/conversion KPIs and export readers independent", () => {
    for (const standardReader of [opportunityAnalytics, opportunityExport, opportunityRecords]) {
      expect(standardReader).not.toContain("external_pursuit_capacity")
      expect(standardReader).not.toContain("external_pursuits")
    }
  })

  it("classifies only privacy-safe external-pursuit telemetry and describes both contracts", () => {
    expect(navigation).toContain("/opportunities/pursuits/capacity")
    expect(workspace).toContain("Confirm current")
    expect(workspace).toContain('data-wave-workflow="external_pursuit"')
    expect(workspace).toContain("catch {")
    expect(workspace).toContain("finally {")
    expect(ownerConfirmation).toContain("beginExternalPursuitConfirmation")
    expect(ownerConfirmation).toContain("Retry confirmation")
    expect(ownerConfirmation).toContain("onOperationLockChange")
    expect(board).toContain("managerCanConfirm")
    expect(board).toContain("managing.isOpenCapacity")
    expect(board).toContain("<ExternalPursuitConfirmCurrentButton")
    expect(capacityAction).toContain("status === 0")
    expect(workspace).not.toContain("captureWaveEvent")
    expect(telemetry).toContain('"pursuits", "capacity"')
    expect(telemetry).toContain('return "external_pursuit"')
    expect(contract).toContain("W-110 capacity is a staff-only read model")
    expect(contract).toContain("due today, not overdue")
    expect(contract).toContain("owner on their own dossier")
    expect(maContract).toContain("W-110's staff-only External Pursuit capacity/freshness view")
  })
})
