import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const source = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8")

describe("W-160 production reporting boundary", () => {
  it("keeps the real/demo repreneur and real/demo opportunity matrix out of staff KPIs and queues", () => {
    const opportunityKpis = source("lib/actions/opportunity-analytics.ts")
    const opportunityDashboard = source("app/(dashboard)/dashboard_op/page.tsx")
    const freshness = source("lib/actions/opportunity-freshness.ts")
    const portfolio = source("lib/actions/client-pursuit-portfolio.ts")
    const analytics = source("lib/actions/analytics.ts")
    const pipeline = source("app/(dashboard)/pipeline/page.tsx")
    const journey = source("app/(dashboard)/journey/page.tsx")
    const pursuitBoard = source("lib/actions/external-pursuit-board.ts")
    const externalPursuits = source("lib/actions/external-pursuits.ts")
    const relationshipLedger = source("lib/data/ma-relationship-ledger.ts")
    const repreneurActions = source("lib/actions/repreneurs.ts")

    expect(opportunityKpis).toContain("opportunity.is_demo")
    expect(opportunityKpis).toContain("repreneur?.is_demo")
    expect(opportunityDashboard).toContain("opportunity.is_demo")
    expect(opportunityDashboard).toContain("repreneur.is_demo")
    expect(opportunityDashboard).toContain(
      "const productionOpportunities = opportunities.filter((opportunity) => !opportunity.is_demo)",
    )
    expect(opportunityDashboard).toContain(
      "const recentOpportunities = productionOpportunities.slice(0, 6)",
    )
    expect(opportunityDashboard).toContain(
      "const openOpportunities = productionOpportunities.filter(",
    )
    expect(freshness).toContain('.eq("is_demo", false)')
    expect(freshness).toContain("repreneur:repreneurs!inner(is_demo)")
    expect(portfolio).toContain('.eq("is_demo", false)')
    expect(analytics).toContain("demoRepreneurIds")
    expect(pipeline).toContain("!repreneur.is_demo")
    expect(journey).toContain('.eq("is_demo", false)')
    expect(pursuitBoard).toContain("!opportunity.is_demo")
    expect(pursuitBoard).toContain("!match.repreneur?.is_demo")
    expect(externalPursuits).toContain('.eq("is_demo", false)')
    expect(relationshipLedger).toContain('.eq("opportunity.is_demo", false)')
    expect(relationshipLedger).toContain('.eq("repreneur.is_demo", false)')
    expect(repreneurActions).toContain("demo_classification_updated_at")
    expect(repreneurActions).toContain("demo_classification_updated_by")
  })

  it("keeps DEMO records out of stored automatic score refreshes", () => {
    const refresh = source("lib/repreneur-match-refresh-core.ts")
    expect(refresh).toContain("if ((repreneur as RepreneurMatchRecord).is_demo)")
    expect(refresh).toContain("if (!opportunity || opportunity.is_demo)")
  })

  it("keeps document and NDA-related production counts coupled to the classified opportunity or match", () => {
    const opportunityKpis = source("lib/actions/opportunity-analytics.ts")
    const dashboard = source("app/(dashboard)/dashboard_op/page.tsx")
    expect(opportunityKpis).toContain("documents.filter")
    expect(opportunityKpis).toContain("!opportunity?.is_demo && !repreneur?.is_demo")
    expect(dashboard).toContain("nda_status")
    expect(dashboard).toContain('.eq("opportunity.is_demo", false)')
    expect(dashboard).toContain('.eq("repreneur.is_demo", false)')
  })

  it("retains the separate historical import boundary and never derives DEMO from a name or email", () => {
    const migration = source("supabase/migrations/20260826170000_w160_demo_repreneur_reporting.sql")
    expect(migration).toContain("w160_demo_repreneur_manifest")
    expect(migration).not.toMatch(/where.*(email|first_name|last_name).*demo/i)
    expect(migration).toContain("w160_demo_repreneur_identity_mismatch")
  })

  it("makes the database authority reject DEMO repreneurs across each portal mutation or confidential read", () => {
    const migration = source("supabase/migrations/20260826170000_w160_demo_repreneur_reporting.sql")
    expect(migration).toContain("w160_require_non_demo_repreneur")
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.express_opportunity_interest")
    expect(migration).toContain("'proposed','interested','declined','dropped','active_pursuit'")
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.update_repreneur_opportunity_response")
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.journey_submit_repreneur_signed_copy")
    expect(migration).toContain("JOIN public.repreneurs r ON r.id=m.repreneur_id AND r.is_demo=FALSE")
  })
})
