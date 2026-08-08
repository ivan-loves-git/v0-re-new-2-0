import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const root = process.cwd()

function source(relativePath: string) {
  return readFileSync(`${root}/${relativePath}`, "utf8")
}

describe("W-083 read-only indicator detail routes", () => {
  const firmRoute = source(
    "app/(dashboard)/opportunities/ma/firms/[firmId]/page.tsx",
  )
  const officeRoute = source(
    "app/(dashboard)/opportunities/ma/offices/[officeId]/page.tsx",
  )
  const detail = source(
    "components/opportunities/ma-relationship-indicator-detail.tsx",
  )
  const loader = source("lib/actions/ma-relationships.ts")

  it("resolves real canonical firms and offices through the staff-gated loader", () => {
    expect(firmRoute).toContain("getMaRelationshipWorkspace")
    expect(officeRoute).toContain("getMaRelationshipWorkspace")
    expect(firmRoute).toContain("if (!firm) notFound()")
    expect(officeRoute).toContain("if (!office) notFound()")
    expect(loader).toContain("await requireStaffAccess()")
  })

  it("keeps firm and office navigation separate from row expansion", () => {
    expect(detail).toContain("Back to firms")
    expect(detail).toContain("Open office")
    expect(detail).toContain("Relationship indicators")
    expect(detail).toContain("Candidate-stale")
    expect(detail).toContain('timeZone: "Europe/Paris"')
  })

  it("does not release the W-086 or W-087 mutation workspace", () => {
    expect(detail).toContain("Read-only relationship indicators")
    expect(detail).not.toContain("Add contact")
    expect(detail).not.toContain("Add office")
    expect(detail).not.toContain("Edit notes")
    expect(detail).not.toContain("internal_notes")
    expect(detail).not.toContain("create_or_affiliate_ma_contact")
  })
})
