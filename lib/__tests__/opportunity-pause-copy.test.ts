import { describe, expect, it } from "vitest"
import { render } from "@react-email/render"
import { PAUSE_EMAIL_BODY, PAUSE_EMAIL_SUBJECT, pauseNotificationPayload, PUBLIC_PAUSE_REASONS, renderOpportunityPauseCopy } from "@/lib/email/opportunity-pause-copy"
import { OpportunityPausedEmail } from "@/lib/email/templates/opportunity-paused"
import { OPPORTUNITY_PAUSE_REASON_OPTIONS } from "@/lib/opportunity-outcome-reasons"

const payload = {
  notificationId: "26000000-0000-4000-8000-000000000001", pauseId: "26000000-0000-4000-8000-000000000002",
  matchId: "26000000-0000-4000-8000-000000000003", repreneurId: "26000000-0000-4000-8000-000000000004",
  recipientEmail: "buyer@example.test", firstName: "Camille", publicTitle: "Atelier <fictif>",
  subject: PAUSE_EMAIL_SUBJECT, body: PAUSE_EMAIL_BODY,
}

describe("public opportunity pause email", () => {
  it.each(OPPORTUNITY_PAUSE_REASON_OPTIONS)("discloses only the selected $value reason", async ({ value }) => {
    const parsed = pauseNotificationPayload.parse({ ...payload, reason: value, reason_note: "PRIVATE STAFF NOTE", internal_notes: "PRIVATE SOURCE" })
    const copy = renderOpportunityPauseCopy(parsed)
    const text = await render(OpportunityPausedEmail(copy), { plainText: true })
    expect(text).toContain(PUBLIC_PAUSE_REASONS[value])
    expect(text).toContain("Camille")
    expect(text).toContain(payload.publicTitle)
    expect(text).not.toMatch(/PRIVATE STAFF NOTE|PRIVATE SOURCE|reason_note|WAVE|Re-New - FR/)
  })

  it("retains the actual reason when staff edit the introductory prose", async () => {
    const copy = renderOpportunityPauseCopy(pauseNotificationPayload.parse({ ...payload, reason: "other", body: "Bonjour {firstName},\n\nVoici une mise à jour." }))
    const text = await render(OpportunityPausedEmail(copy), { plainText: true })
    expect(text).toContain("Voici une mise à jour.")
    expect(text).toContain("Autre motif de suspension")
    expect(text).toContain("historique")
  })

  it("rejects an unknown or free-text reason rather than publishing it", () => {
    expect(pauseNotificationPayload.safeParse({ ...payload, reason: "PRIVATE STAFF NOTE" }).success).toBe(false)
  })
})
