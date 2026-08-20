import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it, vi } from "vitest"
import { __hydratedNowTest } from "@/hooks/use-hydrated-now"

const root = resolve(process.cwd())

function source(path: string) {
  return readFileSync(resolve(root, path), "utf8")
}

describe("client relative-time hydration", () => {
  it("withholds a moving clock until after hydration", () => {
    const hook = source("hooks/use-hydrated-now.ts")

    expect(hook).toContain("useSyncExternalStore")
    expect(hook).toContain("hydratedNow = Date.now()")
    expect(hook).toContain("return null")
  })

  it("keeps one reference instant for all client subscriptions", () => {
    __hydratedNowTest.reset()
    expect(__hydratedNowTest.getServerSnapshot()).toBeNull()
    expect(__hydratedNowTest.getSnapshot()).toBeNull()

    let notifications = 0
    const unsubscribe = __hydratedNowTest.subscribe(() => { notifications += 1 })
    const firstClientInstant = __hydratedNowTest.getSnapshot()
    const secondUnsubscribe = __hydratedNowTest.subscribe(() => { notifications += 1 })

    expect(firstClientInstant).toEqual(expect.any(Number))
    expect(__hydratedNowTest.getSnapshot()).toBe(firstClientInstant)
    expect(notifications).toBe(2)
    unsubscribe()
    secondUnsubscribe()
  })

  it("refreshes the shared reference instant while a page remains open", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-21T08:00:00.000Z"))
    __hydratedNowTest.reset()

    const unsubscribe = __hydratedNowTest.subscribe(() => undefined)
    const firstInstant = __hydratedNowTest.getSnapshot()
    vi.setSystemTime(new Date("2026-08-21T08:01:00.000Z"))
    vi.advanceTimersByTime(60_000)

    expect(__hydratedNowTest.getSnapshot()).not.toBe(firstInstant)
    unsubscribe()
    __hydratedNowTest.reset()
    vi.useRealTimers()
  })

  it("does not evaluate moving relative labels or date filters in the initial render", () => {
    const relativeTimeSurfaces = [
      "components/pipeline/repreneur-card.tsx",
      "components/pipeline/static-pipeline-board.tsx",
      "components/dashboard/global-activity-stream.tsx",
      "components/dashboard/recently-added-repreneurs.tsx",
      "components/repreneurs/repreneur-explore-table.tsx",
      "components/opportunities/opportunity-work-surface-table.tsx",
      "components/pipeline/kanban-board.tsx",
      "components/dashboard/top-tier1-repreneurs.tsx",
      "components/dashboard/activity-heatmap.tsx",
      "components/repreneurs/activity-history.tsx",
      "components/repreneurs/repreneur-table.tsx",
      "components/app-sidebar.tsx",
    ]

    for (const path of relativeTimeSurfaces) {
      const file = source(path)
      expect(file, path).toContain("useHydratedNow")
      expect(file, path).not.toMatch(/Date\.now\(\)/)
      expect(file, path).not.toContain("formatDistanceToNow(")
    }
  })

  it("sets dashboard chart defaults only in an effect", () => {
    const chart = source("components/dashboard/enhanced-chart.tsx")

    expect(chart).toContain("const now = useHydratedNow()")
    expect(chart).toContain("now === null ? null")
    expect(chart).not.toContain("useState<Date>(endOfWeek(new Date()")
  })
})
