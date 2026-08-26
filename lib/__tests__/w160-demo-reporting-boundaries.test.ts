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

    expect(opportunityKpis).toContain("opportunity.is_demo")
    expect(opportunityKpis).toContain("repreneur?.is_demo")
    expect(opportunityDashboard).toContain("opportunity.is_demo")
    expect(opportunityDashboard).toContain("repreneur.is_demo")
    expect(freshness).toContain('.eq("is_demo", false)')
    expect(freshness).toContain("repreneur:repreneurs!inner(is_demo)")
    expect(portfolio).toContain('.eq("is_demo", false)')
    expect(analytics).toContain("demoRepreneurIds")
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
})
