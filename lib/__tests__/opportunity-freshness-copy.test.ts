import { describe, expect, it } from "vitest"
import { renderGroupedFreshnessCopy } from "@/lib/opportunity-freshness-copy"

describe("grouped freshness copy", () => {
  const members = [
    { opportunityId: "a", reference: "A-01", title: "Alpine", firmName: "Firm A" },
    { opportunityId: "b", reference: "B-02", title: "Bay", firmName: "Firm B" },
  ]

  it("uses the existing catalogue copy and names every exact member deterministically", () => {
    const result = renderGroupedFreshnessCopy({
      subject: "Vérification {opportunityTitle}",
      body: "Bonjour {firstName},\n\nPouvez-vous confirmer {opportunityTitle} ?",
      contactName: "Marie Dubois", members,
    })
    expect(result.subject).toBe("Vérification A-01 — Alpine; B-02 — Bay")
    expect(result.body).toContain("Bonjour Marie,")
    expect(result.body).toContain("A-01 — Alpine; B-02 — Bay")
  })

  it("appends the exact members when customized copy removed the placeholder", () => {
    const result = renderGroupedFreshnessCopy({ subject: "Bonjour", body: "Votre avis ?", contactName: "Marie", members })
    expect(result.body).toContain("- A-01 — Alpine\n- B-02 — Bay")
  })

  it("refuses empty membership", () => {
    expect(() => renderGroupedFreshnessCopy({ subject: "Test", body: "Body", contactName: "Marie", members: [] })).toThrow()
  })
})
