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
  it("records the Matching 2.0 release candidate", () => {
    expect(roadmap).toContain('version: "0.9.55"')
    expect(roadmap).toContain("Client fit now uses the acquisition thesis")
    expect(roadmap).toContain("Incomplete information stays visible")
    expect(roadmap).toContain("The first calibration is intentionally provisional")
  })

  it("records deterministic production rendering and signed email callbacks", () => {
    expect(roadmap).toContain('version: "0.9.54"')
    expect(roadmap).toContain(
      "Operational dates no longer change while a page hydrates",
    )
    expect(roadmap).toContain(
      "Production email outcomes now reach the verified callback",
    )
  })

  it("records the zero-gap production hardening continuation", () => {
    expect(roadmap).toContain('version: "0.9.53"')
    expect(roadmap).toContain(
      "The staff follow-up queue now scales as one protected database operation",
    )
    expect(roadmap).toContain(
      "Private file failures stay private and non-cacheable",
    )
    expect(roadmap).toContain(
      "Legacy test-data tools are unavailable in production",
    )
    expect(roadmap).toContain(
      "Recommendation saves always return a clear outcome",
    )
    expect(roadmap).toContain(
      "The displayed build number identifies the real release",
    )
  })

  it("records the production counter-validation corrections", () => {
    expect(roadmap).toContain('version: "0.9.52"')
    expect(roadmap).toContain(
      "Every private file request is authorised when it is opened",
    )
    expect(roadmap).toContain(
      "Staff opportunity and leadership actions preserve the intended data",
    )
    expect(roadmap).toContain("Access and follow-up failures are clearer")
    expect(roadmap).toContain(
      "Email outcomes use the provider’s current signed callback",
    )
  })

  it("records clearer protected-opportunity cards without claiming a behavior change", () => {
    expect(roadmap).toContain('version: "0.9.51"')
    expect(roadmap).toContain("Locked opportunity details remain readable")
    expect(roadmap).toContain("Read-only opportunity links use plain language")
    expect(roadmap).toContain("staff wording and every destination remain unchanged")
  })

  it("groups External Pursuit conversion, capacity, and M2.1 technical closure", () => {
    expect(roadmap).toContain('version: "0.9.50"')
    expect(roadmap).toContain("Staff can convert one qualified dossier into one controlled Re-New draft")
    expect(roadmap).toContain("Conversion never copies private dossier content")
    expect(roadmap).toContain("Capacity is based on explicit confirmation rather than inferred activity")
    expect(roadmap).toContain("M2.1 technical scope is complete; real use still has to prove its value")
  })

  it("groups the controlled External Pursuit workspace release", () => {
    expect(roadmap).toContain('version: "0.9.49"')
    expect(roadmap).toContain("One board keeps external and Re-New work understandable")
    expect(roadmap).toContain("Follow-up remains an accountable shared record")
    expect(roadmap).toContain("Private external files stay outside opportunity documents")
    expect(roadmap).toContain("External work stays out of Re-New reporting and matching")
  })

  it("records the protected External Pursuit foundation without claiming the workspace", () => {
    expect(roadmap).toContain('version: "0.9.48"')
    expect(roadmap).toContain("External pursuits remain separate from Re-New opportunities")
    expect(roadmap).toContain("Every dossier has one owner and a clear staff boundary")
    expect(roadmap).toContain("Deletion removes the dossier content without erasing accountability")
    expect(roadmap).toContain("The visible External Pursuit workspace comes next")
  })

  it("records the controlled-opening technical-readiness release", () => {
    expect(roadmap).toContain('version: "0.9.47"')
    expect(roadmap).toContain("Staff and repreneurs now maintain one acquisition project")
    expect(roadmap).toContain("Automatic discovery waits for enough matching information")
    expect(roadmap).toContain("The controlled opening can be measured without copying client data")
    expect(roadmap).toContain("M2 completion still requires real repreneur evidence")
  })

  it("records the WAVE motion-system release", () => {
    expect(roadmap).toContain('version: "0.9.46"')
    expect(roadmap).toContain("WAVE now responds with one quiet motion system")
    expect(roadmap).toContain("Dashboard charts, keyboard navigation and repeated labels no longer delay routine work.")
    expect(roadmap).toContain("Controls share one restrained timing and easing system while unnecessary property animation is removed.")
    expect(roadmap).toContain("Reduced-motion users keep useful color and opacity feedback without movement.")
  })

  it("records the simplified staff M&A office experience", () => {
    expect(roadmap).toContain('version: "0.9.44"')
    expect(roadmap).toContain("Office contacts now show their email address")
    expect(roadmap).toContain("Each M&A page now has one navigation system")
  })

  it("records the staff M&A workspace release", () => {
    expect(roadmap).toContain('version: "0.9.43"')
    expect(roadmap).toContain(
      "Activity now distinguishes manual records from system-recorded delivery",
    )
    expect(roadmap).toContain(
      "Each operating office has one staff workspace",
    )
    expect(roadmap).toContain(
      "Firm workspaces combine offices without changing ownership",
    )
  })

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
    expect(roadmapStatus).toContain('new Date("2026-08-23")')
    expect(roadmap).toContain("current production build")
    expect(roadmap).not.toContain("current June V2 build")
  })
})
