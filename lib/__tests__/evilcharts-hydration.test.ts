import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const root = resolve(process.cwd())

function source(path: string) {
  return readFileSync(resolve(root, path), "utf8")
}

describe("EvilCharts hydration-safe intros", () => {
  const charts = [
    "components/evilcharts/charts/bar-chart.tsx",
    "components/evilcharts/charts/composed-chart.tsx",
  ]

  it("keeps server and first client render static, then starts a fresh intro after mount", () => {
    for (const path of charts) {
      const chart = source(path)

      expect(chart, path).toContain('useState<number | null>(null)')
      expect(chart, path).toContain('useEffect(() => {')
      expect(chart, path).toContain('setIntroStartedAt(Date.now())')
      expect(chart, path).toMatch(/if \(introStartedAt === null\) return null/)
      expect(chart, path).not.toContain('useState(() => Date.now())')
    }
  })

  it("does not introduce other direct initial-render nondeterminism in EvilCharts", () => {
    const files = [
      "components/evilcharts/charts/bar-chart.tsx",
      "components/evilcharts/charts/composed-chart.tsx",
      "components/evilcharts/ui/tooltip.tsx",
    ]

    for (const path of files) {
      const chart = source(path)
      expect(chart, path).not.toMatch(/Math\.random\(/)
      expect(chart, path).not.toMatch(/toLocaleString\((?!"en-GB")/)
    }
  })
})
