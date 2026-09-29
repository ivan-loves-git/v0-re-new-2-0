import { beforeEach, describe, expect, it, vi } from "vitest"
import { render } from "@react-email/render"
import { WelcomeEmail } from "@/lib/email/templates/welcome"
import { BookingReminderEmail } from "@/lib/email/templates/booking-reminder"
import { resolveTemplateSubject } from "@/lib/email/template-default-subjects"
import type { IntakeV2FormData } from "@/lib/types/intake-v2"

const m = vi.hoisted(() => ({
  send: vi.fn(), template: { subject: "Bienvenue chez Re-New!", body_markdown: null as string | null, body_editable: true },
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/data/dashboard-snapshots", () => ({ revalidateRepreneurDashboardTags: vi.fn() }))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: vi.fn() }))
vi.mock("@/lib/email", () => ({ sendEmail: m.send }))
vi.mock("@/lib/utils/scoring-v2", () => ({ calculateDualScore: () => ({ who: { score: 50 }, when: { score: 50 }, flags: { flags: [] }, recommendation: "interview" }) }))
vi.mock("@/lib/repreneur-target-thesis", () => ({ validateIntakeTargetThesis: () => null }))
vi.mock("@/lib/utils/opportunity-sector", () => ({ canonicalSectorSelections: () => ["Industrie"] }))
vi.mock("@/lib/private-upload-server", () => ({ claimPrivateIntakeUploads: vi.fn(), parsePrivateIntakeUploadHandle: () => null }))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const query = {
        select: () => query, eq: () => query, insert: () => query, update: () => query,
        single: async () => ({ data: table === "email_templates" ? m.template : { id: "synthetic-buyer", first_name: "Camille", last_name: "Test", email: "camille@example.invalid", lifecycle_status: "lead" }, error: null }),
        maybeSingle: async () => ({ data: null, error: null }),
      }
      return query
    },
  }),
}))

import { submitIntakeV2 } from "@/lib/actions/intake-v2"
import { getRenderedTemplate, sendManualEmail } from "@/lib/actions/emails"
import { rejectRepreneur } from "@/lib/actions/repreneurs"

const repreneur = { id: "synthetic-buyer", firstName: "Camille", lastName: "Test", email: "camille@example.invalid" }
const form = { first_name: "Camille", last_name: "Test", email: repreneur.email, phone: "0000000000", q13_target_sectors_v2: ["Industrie"], marketing_consent: false } as IntakeV2FormData

beforeEach(() => {
  vi.clearAllMocks()
  m.send.mockResolvedValue({ success: true })
  m.template.subject = "Bienvenue chez Re-New!"
  m.template.body_markdown = null
  m.template.body_editable = true
})

describe("catalogue content on actual registration and preview paths", () => {
  it("sends the registration confirmation using the existing welcome delivery key", async () => {
    expect((await submitIntakeV2(form)).success).toBe(true)
    expect(m.send).toHaveBeenCalledOnce()
    const sent = m.send.mock.calls[0][0]
    expect(sent.templateKey).toBe("welcome")
    expect(sent.subject).toBe("Votre inscription Re-New est confirmée")
    const text = await render(sent.react, { plainText: true })
    expect(text).toContain("Votre inscription Re-New est maintenant complète.")
    expect(text).toContain("Nous vous contacterons très prochainement pour fixer un rendez-vous")
    expect(text).not.toContain("24 à 48h")
    expect(text).not.toContain("Découvrir Re-New")
    const preview = await getRenderedTemplate("welcome")
    expect(preview.subject).toBe(sent.subject)
    expect(preview.html).toContain("Votre inscription Re-New est maintenant complète.")
  })

  it("preserves staff-written subject and body in both registration and preview", async () => {
    m.template.subject = "Le message personnalisé de notre équipe"
    m.template.body_markdown = "Bonjour {firstName},\n\nVoici notre texte personnalisé."
    await submitIntakeV2(form)
    const sent = m.send.mock.calls[0][0]
    expect(sent.subject).toBe(m.template.subject)
    const text = await render(sent.react, { plainText: true })
    expect(text).toContain("Bonjour Camille")
    expect(text).toContain("Voici notre texte personnalisé.")
    expect(text).not.toContain("Notre équipe va maintenant examiner votre dossier")
    const preview = await getRenderedTemplate("welcome")
    expect(preview.subject).toBe(sent.subject)
    expect(preview.bodyMarkdown).toBe(m.template.body_markdown)
    expect(preview.html).toContain("Voici notre texte personnalisé.")
  })

  it("does not claim registration completion in the legacy first-contact variant", async () => {
    const text = await render(WelcomeEmail({ repreneur, registrationComplete: false }), { plainText: true })
    expect(text).toContain("Bienvenue Camille")
    expect(text).not.toContain("Votre inscription Re-New est maintenant complète.")
  })

  it("preserves thank-you custom content in preview and the actual manual send", async () => {
    m.template.subject = "Notre confirmation personnalisée"
    m.template.body_markdown = "Bonjour {firstName},\n\nMerci pour notre échange personnalisé."
    const preview = await getRenderedTemplate("thank_you")
    await sendManualEmail("synthetic-buyer", "thank_you")
    const sent = m.send.mock.calls[0][0]
    expect(sent.templateKey).toBe("thank_you")
    expect(sent.subject).toBe(preview.subject)
    expect(preview.html).toContain("Merci pour notre échange personnalisé.")
    const text = await render(sent.react, { plainText: true })
    expect(text).toContain("Merci pour notre échange personnalisé.")
    expect(text).not.toContain("Notre équipe va maintenant examiner votre dossier")
  })

  it.each([
    ["Mise à jour concernant votre candidature Re-New", "Suite à la revue de votre dossier repreneur"],
    ["Notre réponse personnalisée", "Notre réponse personnalisée"],
  ])("uses the resolved subject on the actual staff rejection action (%s)", async (stored, expected) => {
    m.template.subject = stored
    await rejectRepreneur("synthetic-buyer")
    expect(m.send).toHaveBeenCalledOnce()
    expect(m.send.mock.calls[0][0]).toMatchObject({ templateKey: "rejection", subject: expected, to: "camille@example.invalid" })
  })

  it("uses the catalogue booking button with the existing Calendly destination", async () => {
    const html = await render(BookingReminderEmail({ repreneur }))
    expect(html).toMatch(/href="https:\/\/calendly.com\/bertrand-re-new\/30min"[^>]*>Réserver mon entretien<\/a>/)
    const custom = await render(BookingReminderEmail({ repreneur, bodyOverride: "Notre invitation personnalisée" }), { plainText: true })
    expect(custom).toContain("Notre invitation personnalisée")
    expect(custom).not.toContain("Nous n'avons pas encore de créneau")
  })
})

describe("catalogue subjects without resetting staff settings", () => {
  it.each([
    ["rejection", "Mise à jour concernant votre candidature Re-New", "Suite à la revue de votre dossier repreneur"],
    ["thank_you", "Thank you for completing your Re-New profile", "Votre inscription Re-New est confirmée"],
    ["booking_reminder", "Planifiez votre entretien Re-New", "Réservez votre entretien avec Re-New"],
    ["interview_reminder", "Rappel de votre entretien Re-New", "Rappel — votre entretien avec Re-New"],
  ] as const)("replaces the exact shipped %s subject, preserving custom text", (key, old, expected) => {
    expect(resolveTemplateSubject(key, old)).toBe(expected)
    expect(resolveTemplateSubject(key, null)).toBe(expected)
    expect(resolveTemplateSubject(key, "Notre objet personnalisé")).toBe("Notre objet personnalisé")
    expect(resolveTemplateSubject(key, expected)).toBe(expected)
  })
})
