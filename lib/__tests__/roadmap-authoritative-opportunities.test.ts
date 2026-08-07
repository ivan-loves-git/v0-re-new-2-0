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
  it("records the released opportunity-to-memo journey", () => {
    expect(roadmap).toContain('version: "0.9.39"')
    expect(roadmap).toContain(
      "One journey now connects opportunity creation to the confidential memo",
    )
    expect(roadmap).toContain(
      "Every pursuit earns confidential access independently",
    )
    expect(roadmap).toContain(
      "Signing and intermediary communication remain manual",
    )
  })

  it("records the staff-controlled WAVE AI drafting release", () => {
    expect(roadmap).toContain('version: "0.9.37"')
    expect(roadmap).toContain(
      "Staff can create a draft from current WAVE context",
    )
    expect(roadmap).toContain(
      "Every AI result remains under staff control",
    )
    expect(roadmap).toContain(
      "AI use, reliability and estimated cost are now visible",
    )
  })

  it("records the purpose-aware M&A email suppression milestone", () => {
    expect(roadmap).toContain('version: "0.9.35"')
    expect(roadmap).toContain(
      "A do-not-email decision now follows the person",
    )
    expect(roadmap).toContain(
      "Deal-specific NDA work keeps one controlled exception",
    )
    expect(roadmap).toContain(
      "Every preference change remains accountable",
    )
  })

  it("records the released cross-surface usability milestone", () => {
    expect(roadmap).toContain('version: "0.9.34"')
    expect(roadmap).toContain(
      "Relationships now brings the directory and timeline together",
    )
    expect(roadmap).toContain(
      "Repreneurs can compare more opportunities at a glance",
    )
    expect(roadmap).toContain(
      "Portal decisions and document gates explain the next step",
    )
    expect(roadmap).toContain(
      "Inactive NDA evidence no longer looks actionable",
    )
  })

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
    expect(roadmapStatus).toContain('new Date("2026-08-08")')
  })
})
