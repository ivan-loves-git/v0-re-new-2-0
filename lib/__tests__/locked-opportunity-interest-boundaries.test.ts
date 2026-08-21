import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const root = process.cwd()
const actionSource = fs.readFileSync(
  path.join(root, "lib/actions/locked-opportunity-interest.ts"),
  "utf8",
)
const migrationSource = fs.readFileSync(
  path.join(root, "scripts/111_staff_only_exact_match_interest.sql"),
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

  it("exports only the async action from its use-server module", () => {
    expect(actionSource.startsWith('"use server"')).toBe(true)
    expect(actionSource.match(/^export /gm)).toHaveLength(1)
    expect(actionSource).toContain("export async function expressOpportunityInterestAction")
    expect(actionSource).not.toContain("export const INITIAL_LOCKED_OPPORTUNITY_INTEREST_STATE")
  })

  it("keeps eligibility and idempotency inside one database transaction", () => {
    expect(migrationSource).toContain("status = 'active'")
    expect(migrationSource).toContain("v_opportunity.repreneur_exposure = 'staff_only'")
    expect(migrationSource).toContain("v_match.status NOT IN ('proposed', 'interested', 'declined', 'active_pursuit')")
    expect(migrationSource).toContain("NOT v_has_match")
    expect(migrationSource).toContain("status = 'active_pursuit'")
    expect(migrationSource).toContain("v_match.status = 'active_pursuit'")
    expect(migrationSource).toContain("FOR UPDATE")
    expect(migrationSource).toContain("interest_notification_sent_at")
    expect(migrationSource).toContain("TO service_role")
    expect(migrationSource).toContain("FROM PUBLIC, anon, authenticated")
    expect(migrationSource).toContain("v_has_match")
    expect(migrationSource).toContain("interest_expressed_at IS NULL")
    expect(migrationSource).toContain("v_match.nda_status = 'signed'")
    expect(migrationSource).toContain("v_match.nda_signed_at IS NULL")
    expect(migrationSource).toContain("v_match.nda_status = 'waived'")
    expect(migrationSource).toContain("v_match.nda_waived_at IS NULL")
    expect(migrationSource).toContain("BTRIM(v_match.nda_waived_by)")
  })

  it("does not introduce queue, ranking, timer, or reassignment behavior", () => {
    expect(migrationSource).not.toContain("position_in_queue")
    expect(migrationSource).not.toContain("rank_value")
    expect(migrationSource).not.toContain("expires_at")
  })
})
