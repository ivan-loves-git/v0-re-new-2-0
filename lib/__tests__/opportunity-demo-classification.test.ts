import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

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
    expect(action).toContain(".update({ is_demo: isDemo })")
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
    expect(control).toContain("eligible for repreneur access again")
    expect(control).toContain("Mark DEMO")
    expect(control).toContain("Remove DEMO")
  })
})
