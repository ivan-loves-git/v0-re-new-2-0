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
  it("groups canonical interaction persistence and the staff Relationships workspace", () => {
    expect(roadmap).toContain('version: "0.9.32"')
    expect(roadmap).toContain(
      "One timeline follows the relationship, not only the opportunity",
    )
    expect(roadmap).toContain(
      "Existing intermediary emails kept their original evidence",
    )
    expect(roadmap).toContain(
      "New activity can be recorded without accidentally sending anything",
    )
    expect(roadmap).toContain(
      "Source corrections and relationship history cannot contradict each other",
    )
  })

  it("groups the provisional-source foundation and staff review workflow", () => {
    expect(roadmap).toContain('version: "0.9.31"')
    expect(roadmap).toContain(
      "Staff can see and correct every provisional source",
    )
    expect(roadmap).toContain(
      "Corrections preserve immutable evidence",
    )
    expect(roadmap).toContain(
      "Provisional context stays outside the repreneur portal",
    )
  })

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
    expect(roadmapStatus).toContain('new Date("2026-07-27")')
  })
})
