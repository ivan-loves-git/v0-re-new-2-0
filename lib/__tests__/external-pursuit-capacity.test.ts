import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/access-control", () => ({ requireStaffAccess: mocks.requireStaffAccess }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))

import {
  confirmExternalPursuitCurrent,
  getExternalPursuitCapacitySnapshot,
} from "@/lib/actions/external-pursuit-capacity"

const source = (path: string) => readFileSync(`${process.cwd()}/${path}`, "utf8")
const migration = source("scripts/099_external_pursuit_capacity_freshness.sql")
const rehearsal = source("scripts/rehearse-external-pursuit-capacity.sql")
const workspace = source("components/pursuits/external-pursuit-capacity-workspace.tsx")
const navigation = source("components/app-sidebar.tsx")
const contract = source("docs/data-models/external-pursuit-data-model-v1.md")
const maContract = source("docs/data-models/ma-advisory-data-model-v1.md")
const telemetry = source("lib/telemetry/privacy.ts")

describe("W-110 External Pursuit capacity", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ user: { id: "staff-1" } })
    mocks.rpc.mockResolvedValue({ data: { as_of_paris_date: "2026-05-01", open_capacity: {}, open_dossiers: [], linked_dossiers: [] }, error: null })
  })

  it("uses staff access and a server-side capacity RPC", async () => {
    await expect(getExternalPursuitCapacitySnapshot()).resolves.toMatchObject({ as_of_paris_date: "2026-05-01" })
    expect(mocks.requireStaffAccess).toHaveBeenCalledOnce()
    expect(mocks.rpc).toHaveBeenCalledWith("external_pursuit_capacity_for_staff", { p_actor_user_id: "staff-1" })
  })

  it("confirms freshness only through an explicit staff action", async () => {
    await expect(confirmExternalPursuitCurrent("00000000-0000-4000-8000-000000011100", "confirmation-key")).resolves.toEqual({ success: true, message: "Current status confirmed." })
    expect(mocks.rpc).toHaveBeenCalledWith("confirm_external_pursuit_current", {
      p_dossier_id: "00000000-0000-4000-8000-000000011100",
      p_actor_user_id: "staff-1",
      p_idempotency_key: "confirmation-key",
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/opportunities/pursuits/capacity")
  })

  it("enforces the Paris boundary, due-today rule, staff-only role and excluded linked bucket in SQL", () => {
    expect(migration).toContain("AT TIME ZONE 'Europe/Paris'")
    expect(migration).toContain("<= 30 THEN 'fresh'")
    expect(migration).toContain("WHEN dossier.due_at < paris_today THEN 'overdue'")
    expect(migration).toContain("WHEN dossier.due_at = paris_today THEN 'today'")
    expect(migration).toContain("dossier.stage NOT IN ('completed', 'dropped_archived')")
    expect(migration).toContain("conversion.external_pursuit_id IS NULL")
    expect(migration).toContain("actor_role <> 'staff'")
    expect(migration).toContain("event.metadata->>'confirmation' = 'current'")
    expect(migration).toContain("'External Pursuit confirmation idempotency conflict.'")
    expect(rehearsal).toContain("w110_freshness_boundary_failed")
    expect(rehearsal).toContain("w110_due_boundary_failed")
    expect(rehearsal).toContain("w110_owner_capacity_read_was_allowed")
  })

  it("keeps this out of analytics content and describes the boundary in both contracts", () => {
    expect(navigation).toContain("/opportunities/pursuits/capacity")
    expect(workspace).toContain("Confirm current")
    expect(workspace).not.toContain("captureWaveEvent")
    expect(telemetry).toContain('"pursuits", "capacity"')
    expect(contract).toContain("W-110 capacity is a staff-only read model")
    expect(contract).toContain("due today, not overdue")
    expect(maContract).toContain("W-110's staff-only External Pursuit capacity/freshness view")
  })
})
