import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const component = readFileSync(
  join(process.cwd(), "components/opportunities/repreneur-opportunity-list.tsx"),
  "utf8",
)

describe("repreneur Deal Flow discovery controls", () => {
  it("keeps taxonomy filters single-select and exposes usable numeric range controls", () => {
    expect(component).toContain('key: "geography"')
    expect(component).toContain("opportunity.geography_node_id")
    expect(component).toContain('key: "sector"')
    expect(component).toContain("opportunity.canonical_sector")
    expect(component).toContain('aria-label="Minimum revenue"')
    expect(component).toContain('aria-label="Maximum revenue"')
    expect(component).toContain('aria-label="Minimum EBITDA margin"')
    expect(component).toContain('aria-label="Minimum employees"')
    expect(component).toContain('aria-label="Maximum employees"')
    expect(component).toContain("Search title, teaser")
  })
})
