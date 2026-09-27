import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { OpportunityDemoControl } from "@/components/opportunities/opportunity-demo-control"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const platformRoot = process.cwd()

function functionSource(functionName: string) {
  const source = readFileSync(
    `${platformRoot}/lib/actions/opportunities.ts`,
    "utf8",
  )
  const start = source.indexOf(`export async function ${functionName}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextExport = source.indexOf("\nexport async function", start + 1)
  return source.slice(start, nextExport === -1 ? source.length : nextExport)
}

describe("staff DEMO opportunity classification", () => {
  it("keeps classification staff-only and changes no lifecycle or visibility fields", () => {
    const action = functionSource("setOpportunityDemoClassification")

    expect(action.indexOf("requireStaffAccess")).toBeGreaterThanOrEqual(0)
    expect(action.indexOf("requireStaffAccess")).toBeLessThan(
      action.indexOf("createAdminClient"),
    )
    expect(action).toContain('.rpc("set_zero_match_demo_classification"')
    expect(action).toContain('p_entity_type: "opportunity"')
    expect(action).toContain("p_actor: user.id")
    expect(action).not.toContain("repreneur_exposure")
    expect(action).not.toContain("status:")
    expect(action).toContain('revalidatePath("/portal")')
    expect(action).toContain('revalidatePath("/portal/deals")')
    expect(action).toContain('revalidatePath("/portal/profile")')
    expect(action).toContain('revalidatePath("/portal/pursuits")')
    expect(action).toContain('revalidatePath("/portal-preview")')
  })

  it("makes the staff control explicit about the re-exposure risk", () => {
    const control = readFileSync(
      `${platformRoot}/components/opportunities/opportunity-demo-control.tsx`,
      "utf8",
    )

    expect(control).toContain("AlertDialog")
    expect(control).toContain("REAL Deal Flow and production reporting")
    expect(control).toContain("DEMO-only Deal Flow")
    expect(control).toContain("DemoClassificationLockNotice")
    expect(control).toContain("Mark DEMO")
    expect(control).toContain("Remove DEMO")
  })

  it.each([
    [true, "DEMO"],
    [false, "REAL"],
  ])("shows the current %s classification with an enabled explanation trigger when matched", (isDemo, label) => {
    const html = renderToStaticMarkup(createElement(OpportunityDemoControl, {
      isDemo,
      action: vi.fn(),
      controlState: {
        lockReason: "matched",
        updatedAt: null,
        updatedByLabel: null,
      },
    }))

    expect(html).toContain(label)
    expect(html).toContain('aria-label="Why is the Demo / Real setting locked?"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain(' disabled=""')
    expect(html).not.toContain("Mark DEMO")
    expect(html).not.toContain("Remove DEMO")
  })

  it("keeps the unmatched reclassification action and confirmation path", () => {
    const html = renderToStaticMarkup(createElement(OpportunityDemoControl, {
      isDemo: false,
      action: vi.fn(),
      controlState: {
        lockReason: null,
        updatedAt: null,
        updatedByLabel: null,
      },
    }))

    expect(html).toContain("Mark DEMO")
    expect(html).not.toContain("Demo / Real setting locked")
  })
})
