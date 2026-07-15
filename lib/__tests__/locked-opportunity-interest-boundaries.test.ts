import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const root = process.cwd()
const actionSource = fs.readFileSync(
  path.join(root, "lib/actions/locked-opportunity-interest.ts"),
  "utf8",
)
const migrationSource = fs.readFileSync(
  path.join(root, "scripts/067_locked_opportunity_interest.sql"),
  "utf8",
)

describe("locked opportunity interest boundaries", () => {
  it("authorizes the portal session before creating a service-role data store", () => {
    expect(actionSource.indexOf("const access = await requirePortalAccess()")).toBeLessThan(
      actionSource.indexOf("createLockedOpportunityInterestStore()"),
    )
    expect(actionSource).toContain("repreneurId: access.repreneurId")
    expect(actionSource).not.toContain('formData.get("repreneur_id")')
  })

  it("keeps eligibility and idempotency inside one database transaction", () => {
    expect(migrationSource).toContain("status = 'active'")
    expect(migrationSource).toContain("repreneur_exposure <> 'staff_only'")
    expect(migrationSource).toContain("status = 'active_pursuit'")
    expect(migrationSource).toContain("repreneur_id <> p_repreneur_id")
    expect(migrationSource).toContain("FOR UPDATE")
    expect(migrationSource).toContain("interest_notification_sent_at")
    expect(migrationSource).toContain("TO service_role")
    expect(migrationSource).toContain("FROM PUBLIC, anon, authenticated")
  })

  it("does not introduce queue, ranking, timer, or reassignment behavior", () => {
    expect(migrationSource).not.toContain("position_in_queue")
    expect(migrationSource).not.toContain("rank_value")
    expect(migrationSource).not.toContain("expires_at")
  })
})
