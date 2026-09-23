import { beforeEach, describe, expect, it, vi } from "vitest"
import type { EmailTemplateKey } from "@/lib/types/email"

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  from: vi.fn(),
  sendEmail: vi.fn(),
  template: {
    subject: "Un sujet privé de test — {opportunityTitle}",
    body_markdown: "Bonjour {firstName},\n\nVotre message personnalisé pour {opportunityTitle}.",
    body_editable: true,
  },
}))

vi.mock("@/lib/access-control", () => ({ requireStaffAccess: mocks.requireStaffAccess }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: mocks.from }) }))
vi.mock("@/lib/email", () => ({ sendEmail: mocks.sendEmail }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import { getRenderedTemplate } from "@/lib/actions/emails"

const notificationKeys = [
  "memo_feedback_reminder",
  "recommendation_response_reminder",
  "recommendation_unanswered_staff_alert",
  "interest_outcome_validated",
  "interest_outcome_rejected",
  "proposed_opportunity_response_staff",
] as const satisfies readonly EmailTemplateKey[]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireStaffAccess.mockResolvedValue({ role: "staff" })
  mocks.template.subject = "Un sujet privé de test — {opportunityTitle}"
  mocks.template.body_markdown = "Bonjour {firstName},\n\nVotre message personnalisé pour {opportunityTitle}."
  mocks.template.body_editable = true
  mocks.from.mockImplementation((table: string) => {
    if (table !== "email_templates") throw new Error(`Unexpected table: ${table}`)
    const query = {
      select: () => query,
      eq: () => query,
      single: async () => ({
        data: mocks.template,
        error: null,
      }),
    }
    return query
  })
})

describe("staff Templates preview renders real notification email HTML", () => {
  it.each(notificationKeys)("previews %s with safe sample data and saved custom copy", async (key) => {
    const preview = await getRenderedTemplate(key)

    expect(mocks.requireStaffAccess).toHaveBeenCalledOnce()
    expect(preview.subject).toBe("Un sujet privé de test — {opportunityTitle}")
    expect(preview.bodyEditable).toBe(true)
    expect(preview.bodyMarkdown).toContain("Votre message personnalisé")
    expect(preview.html).toContain("Un sujet privé de test — Opportunité fictive")
    expect(preview.html).toContain("Bonjour Sophie")
    expect(preview.html).toContain("Votre message personnalisé pour Opportunité fictive")
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it("previews the memo reminder with its default subject and body if the stored copy is blank", async () => {
    mocks.template.subject = ""
    mocks.template.body_markdown = ""

    const preview = await getRenderedTemplate("memo_feedback_reminder")

    expect(preview.subject).toBe("Un retour sur votre mémorandum — {opportunityTitle}")
    expect(preview.bodyMarkdown).toContain("Après votre accès au mémorandum")
    expect(preview.html).toContain("Un retour sur votre mémorandum — Opportunité fictive")
    expect(preview.html).toContain("Après votre accès au mémorandum de Opportunité fictive")
    expect(preview.html).not.toContain("{opportunityTitle}")
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it.each([
    ["recommendation_response_reminder", "Votre recommandation — {opportunityTitle}", "Vous pouvez encore consulter"],
    ["recommendation_unanswered_staff_alert", "Recommandation sans réponse — {opportunityTitle}", "a atteint sa fin de réponse"],
  ] as const)("previews default copy for %s without sending", async (key, subject, excerpt) => {
    mocks.template.subject = ""
    mocks.template.body_markdown = ""

    const preview = await getRenderedTemplate(key)

    expect(preview.subject).toBe(subject)
    expect(preview.bodyMarkdown).toContain(excerpt)
    expect(preview.html).toContain(subject.replace("{opportunityTitle}", "Opportunité fictive"))
    expect(preview.html).not.toContain("{opportunityTitle}")
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })
})
