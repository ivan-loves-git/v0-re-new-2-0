import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { formatPursuitDateTime } from "@/lib/utils/pursuit-date-time"

describe("pursuit evidence date rendering", () => {
  it("renders a canonical France time identically regardless of the server or browser host timezone", () => {
    expect(formatPursuitDateTime("2026-08-20T22:12:00.000Z")).toBe("21 août 2026, 00:12")
  })

  it("uses the canonical formatter for every server-rendered pursuit timestamp", () => {
    const panel = readFileSync("components/opportunities/opportunity-pursuit-panel.tsx", "utf8")
    const artifacts = readFileSync("components/opportunities/opportunity-nda-artifact-manager.tsx", "utf8")

    expect(panel).toContain('import { formatPursuitDateTime } from "@/lib/utils/pursuit-date-time"')
    expect(panel).toContain("formatPursuitDateTime(step.recordedAt)")
    expect(panel).toContain("formatPursuitDateTime(entry.recorded_at)")
    expect(artifacts).toContain('import { formatPursuitDateTime } from "@/lib/utils/pursuit-date-time"')
    expect(artifacts).toContain("formatPursuitDateTime(artifact.recorded_at)")
  })
})
