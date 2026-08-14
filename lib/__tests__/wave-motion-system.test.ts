import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const root = process.cwd()
const source = (path: string) => readFileSync(`${root}/${path}`, "utf8")

describe("WAVE motion system", () => {
  it("defines the shared tokens and preserves reduced-motion feedback", () => {
    const css = source("app/globals.css")
    for (const token of ["--ease-wave-out: cubic-bezier(0.23, 1, 0.32, 1)", "--ease-wave-in-out: cubic-bezier(0.77, 0, 0.175, 1)", "--ease-wave-drawer: cubic-bezier(0.32, 0.72, 0, 1)", "--duration-wave-instant: 0ms", "--duration-wave-press: 160ms", "--duration-wave-fast: 180ms", "--duration-wave-standard: 220ms", "--duration-wave-drawer: 280ms"]) expect(css).toContain(token)
    expect(css).not.toContain("transition-duration: 0.01ms")
    expect(css).toContain(".wave-trigger-overlay")
    expect(css).toContain(".wave-expandable-motion")
    expect(css).toContain("@keyframes wave-success-confirm")
  })

  it("keeps operational content immediate and high-frequency controls scoped", () => {
    const charts = source("components/wave/charts/index.tsx")
    expect(charts).toContain("radarProps={{ isAnimationActive: false }}")
    expect(charts).toContain("pieProps={{ isAnimationActive: false }}")
    expect(source("components/ui/tooltip.tsx")).not.toMatch(/animate-(in|out)|zoom-|slide-in|fade-(in|out)/)
    const sidebar = source("components/ui/sidebar.tsx")
    expect(sidebar).not.toContain("transition-[width]")
    expect(sidebar).not.toContain("transition-[left,right,width]")
    expect(sidebar).toContain("transition-colors duration-wave-fast")
  })

  it("uses scoped, interruptible motion primitives", () => {
    for (const path of ["components/ui/popover.tsx", "components/ui/select.tsx", "components/ui/dropdown-menu.tsx"]) {
      const primitive = source(path)
      expect(primitive).toContain("wave-trigger-overlay")
      expect(primitive).not.toMatch(/animate-in|animate-out|zoom-|slide-in|fade-(in|out)/)
    }
    const accordion = source("components/ui/accordion.tsx")
    expect(accordion).toContain("wave-expandable-motion")
    expect(accordion).not.toContain("animate-accordion")
    expect(accordion).not.toContain("transition-all")
    expect(source("components/ui/progress.tsx")).toContain("transition-transform duration-wave-standard ease-wave-out motion-reduce:transition-none")
    expect(source("components/ui/button.tsx")).toContain("active:scale-[.97] motion-reduce:active:scale-100")
  })

  it("keeps strategy changes composited and success confirmation narrowly scoped", () => {
    const explorer = source("components/strategy/strategy-explorer.tsx")
    const revenue = source("components/strategy/revenue-journey.tsx")
    expect(explorer).not.toContain("requestAnimationFrame")
    expect(revenue).not.toContain("transition-all")
    expect(revenue).not.toContain("duration-500")
    expect(revenue).toContain("transition-transform duration-wave-standard ease-wave-out motion-reduce:transition-none")
    expect(source("app/intake-v2/success/page.tsx")).toContain("wave-success-confirm")
    expect(source("app/assessment/[token]/success/page.tsx")).toContain("wave-success-confirm")
    expect(source("app/assessment/[token]/assessment-page-client.tsx")).not.toContain("wave-success-confirm")
  })
})
