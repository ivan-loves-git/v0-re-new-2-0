import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

function source(relativePath: string) {
  return readFileSync(`${process.cwd()}/${relativePath}`, "utf8")
}

describe("cutover rehearsal operational entrypoints", () => {
  it("does not present the synthetic rehearsal as an operational import action", () => {
    for (const page of [
      "app/(dashboard)/opportunities/page.tsx",
      "app/(dashboard)/opportunities/find/page.tsx",
      "app/(dashboard)/opportunities/groups/page.tsx",
    ]) {
      expect(source(page)).not.toContain('href="/opportunities/import"')
    }
  })

  it("keeps the staff-only synthetic route available for controlled QA", () => {
    const route = source("app/(dashboard)/opportunities/import/page.tsx")
    expect(route).toContain("requireStaffAccess")
    expect(route).toContain("getSyntheticMaCutoverRehearsal")
  })
})
