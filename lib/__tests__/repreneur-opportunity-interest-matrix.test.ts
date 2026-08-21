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
  path.join(root, "scripts/111_staff_only_exact_match_interest.sql"),
  "utf8",
)

describe("repreneur opportunity interest matrix", () => {
  it("offers the self-discovered action for unassigned cards and locked cards even when a current match exists", () => {
    expect(listSource).toContain("{lockedForAnotherRepreneur || !opportunity.match_id ? (")
    expect(listSource).toContain("lockedForAnotherRepreneur={lockedForAnotherRepreneur}")
    expect(detailSource).toContain("{lockedForAnotherRepreneur || canExpressUnassignedInterest ? (")
    expect(querySource).toContain("is_locked_for_other_repreneur: isLockedForOtherRepreneur(")
  })

  it("bounds only the locked desktop action track so deal facts remain readable", () => {
    expect(listSource).toContain('lockedForAnotherRepreneur')
    expect(listSource).toContain('lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]')
    expect(listSource).toContain('lg:grid-cols-[minmax(0,1fr)_auto]')
    expect(listSource).toContain('className="flex min-w-0 flex-col gap-3 lg:items-end"')
    expect(listSource).toContain("opportunityTitle(opportunity)")
    expect(listSource).toContain("displayRepreneurOpportunityGeography(opportunity.location)")
    expect(listSource).toContain("Added {opportunity.date_added_display ?? \"-\"}")
    expect(listSource).toContain("formatNumber(opportunity.revenue_meur")
    expect(listSource).toContain("formatNumber(opportunity.ebitda_keur")
    expect(listSource).toContain("formatEbitdaMargin(opportunity)")
    expect(listSource).toContain("opportunity.reference")
    expect(listSource).toContain("opportunity.sector ?? opportunity.activity")
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

  it("allows only the exact portal-visible match to express interest on a staff-only opportunity", () => {
    expect(migrationSource).toContain("status = 'active'")
    expect(migrationSource).toContain("v_opportunity.repreneur_exposure = 'staff_only'")
    expect(migrationSource).toContain("v_match.status NOT IN ('proposed', 'interested', 'declined', 'active_pursuit')")
    expect(migrationSource).toContain("NOT v_has_match")
    expect(migrationSource).toContain("FOR UPDATE")
    expect(migrationSource).toContain("status = 'active_pursuit'")
    expect(migrationSource).toContain("v_match.status = 'active_pursuit'")
    expect(migrationSource).toContain("v_match.status = 'interested'")
    expect(migrationSource).toContain("v_match.nda_status = 'signed'")
    expect(migrationSource).toContain("v_match.nda_signed_at IS NULL")
    expect(migrationSource).toContain("v_match.nda_status = 'waived'")
    expect(migrationSource).toContain("v_match.nda_waived_at IS NULL")
    expect(migrationSource).toContain("BTRIM(v_match.nda_waived_by)")
    expect(migrationSource).not.toContain("position_in_queue")
    expect(migrationSource).not.toContain("waitlist")
  })
})
