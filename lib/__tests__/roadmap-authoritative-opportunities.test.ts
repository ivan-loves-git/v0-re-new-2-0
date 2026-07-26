import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const roadmap = readFileSync(
  `${process.cwd()}/components/guide/development-roadmap.tsx`,
  "utf8",
)
const roadmapStatus = readFileSync(
  `${process.cwd()}/lib/data/roadmap-status.ts`,
  "utf8",
)

describe("authoritative opportunity roadmap entry", () => {
  it("records the office-first intake outcome without claiming a workbook cutover", () => {
    expect(roadmap).toContain('version: "0.9.30"')
    expect(roadmap).toContain(
      "Several contacts can stay attached to one opportunity",
    )
    expect(roadmap).toContain("No real workbook has been imported")
    expect(roadmap).toContain(
      "Excel remains authoritative until the separately approved switch",
    )
  })

  it("marks the release date as the latest roadmap update", () => {
    expect(roadmapStatus).toContain('new Date("2026-07-26")')
  })
})
