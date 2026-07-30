import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { isStaffRecommended } from "@/lib/utils/repreneur-deal-discovery"

const root = process.cwd()
const listSource = fs.readFileSync(
  path.join(root, "components/opportunities/repreneur-opportunity-list.tsx"),
  "utf8",
)
const detailSource = fs.readFileSync(
  path.join(root, "components/opportunities/repreneur-opportunity-detail.tsx"),
  "utf8",
)
const querySource = fs.readFileSync(
  path.join(root, "lib/actions/repreneur-opportunities.ts"),
  "utf8",
)
const migrationSource = fs.readFileSync(
  path.join(root, "scripts/084_express_opportunity_interest.sql"),
  "utf8",
)

describe("repreneur opportunity interest matrix", () => {
  it("offers the self-discovered action for unassigned cards and locked cards even when a current match exists", () => {
    expect(listSource).toContain("{lockedForAnotherRepreneur || !opportunity.match_id ? (")
    expect(listSource).toContain("lockedForAnotherRepreneur={lockedForAnotherRepreneur}")
    expect(detailSource).toContain("{lockedForAnotherRepreneur || canExpressUnassignedInterest ? (")
    expect(querySource).toContain("is_locked_for_other_repreneur: isLockedForOtherRepreneur(")
  })

  it("keeps staff-proposed and declined responses on their existing match action, while interested and active-pursuit matches do not become new cards", () => {
    expect(detailSource).toContain('canRespond(opportunity.match_status)')
    expect(detailSource).toContain('opportunity.match_status === "interested" ? "Interest sent" : "I\'m interested"')
    expect(detailSource).toContain('opportunity.match_status === "active_pursuit"')
    expect(listSource).toContain("!opportunity.match_id")
  })

  it("keeps accepted staff proposals recommended but never labels a self-signalled interest as selected by Re-New", () => {
    expect(isStaffRecommended({ is_staff_recommended: false } as never)).toBe(false)
    expect(isStaffRecommended({ is_staff_recommended: true } as never)).toBe(true)
    expect(querySource).toContain("is_staff_recommended: !opportunity.interest_expressed_at")
  })

  it("enforces active and visible eligibility atomically without creating pursuit or queue state", () => {
    expect(migrationSource).toContain("status = 'active'")
    expect(migrationSource).toContain("repreneur_exposure <> 'staff_only'")
    expect(migrationSource).toContain("FOR UPDATE")
    expect(migrationSource).toContain("status = 'active_pursuit'")
    expect(migrationSource).toContain("v_match.status = 'active_pursuit'")
    expect(migrationSource).toContain("v_match.status = 'interested'")
    expect(migrationSource).not.toContain("position_in_queue")
    expect(migrationSource).not.toContain("waitlist")
  })
})
