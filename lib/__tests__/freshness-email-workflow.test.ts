import { beforeEach, describe, expect, it, vi } from "vitest"
import type { StaffEmailReview } from "@/lib/actions/staff-email-review"

const db = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), send: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => db }))
vi.mock("@/lib/access-control", () => ({
  requireStaffAccess: async () => ({ user: { id: "staff-1" } }),
}))
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
  revalidateTag: vi.fn(),
}))
vi.mock("@/lib/email/resend-client", () => ({
  resend: { emails: { send: db.send } },
  FROM_EMAIL: "noreply@example.test",
  FROM_NAME: "Re-New",
}))

import { runOpportunityFreshnessDrafts } from "@/lib/opportunity-freshness-drafts"
import { sendOpportunityFreshnessReview } from "@/lib/opportunity-freshness-send"
import { getRenderedTemplate } from "@/lib/actions/emails"
import { MA_TEMPLATE_DEFAULT_BODIES } from "@/lib/email/templates"

let candidates: Array<Record<string, unknown>>
let saved: StaffEmailReview
const template = {
  template_key: "ma_opportunity_validity_check",
  is_active: true,
  body_editable: true,
  subject: "Statut du process pour {opportunityTitle}",
  body_markdown: MA_TEMPLATE_DEFAULT_BODIES.ma_opportunity_validity_check,
}

beforeEach(() => {
  vi.clearAllMocks()
  candidates = [
    {
      opportunity_id: "a",
      contact_id: "c",
      contact_name: "Camille",
      reference: "A-01",
      title: "Projet Orion",
      revenue_meur: 3.2,
      firm_name: "Cabinet Atlantique M&A",
      copy_contract: "recognizable-v1",
    },
  ]
  db.from.mockImplementation((table: string) => {
    const q: Record<string, unknown> = {}
    for (const name of ["select", "eq", "order", "limit"]) q[name] = () => q
    q.single = q.maybeSingle = async () => ({
      data: table === "email_templates" ? template : saved,
      error: null,
    })
    return q
  })
  db.rpc.mockImplementation(
    async (name: string, args: Record<string, unknown>) => {
      if (name === "opportunity_freshness_due_contacts")
        return { data: [{ contact_id: "c" }], error: null }
      if (name === "opportunity_freshness_candidates")
        return { data: candidates, error: null }
      if (name === "opportunity_freshness_prepare") {
        saved = {
          id: "26300000-0000-4000-8000-000000000001",
          version: 1,
          source_kind: "freshness",
          namespace: "REAL",
          state: "pending",
          subject: args.p_subject,
          body_text: args.p_body,
          recipient_email: "source@example.test",
          template_version: args.p_template_version,
        } as StaffEmailReview
        return { data: saved.id, error: null }
      }
      return {
        data: name === "opportunity_freshness_reserve" ? "token" : false,
        error: null,
      }
    },
  )
  db.send.mockResolvedValue({
    data: { id: "accepted-synthetic" },
    error: null,
  })
})

describe("freshness staff/provider workflow", () => {
  it("previews the exact simple payload generated and sent for one recognizable project", async () => {
    await runOpportunityFreshnessDrafts()
    const preview = await getRenderedTemplate("ma_opportunity_validity_check")
    await sendOpportunityFreshnessReview(saved, 1, "staff-1", undefined, true, true)
    const request = db.send.mock.calls[0][0]
    expect(request.subject).toBe(
      "Statut du process pour Projet Orion (CA : 3,2 M€)",
    )
    expect(request.text).toBe(
      "Bonjour Camille,\n\nNous nous permettons de vous contacter au sujet de l’opportunité en objet.\n\nLe process est-il toujours ouvert ? Étudiez-vous encore de nouveaux profils de repreneurs ?\n\nMerci pour votre retour,\nL’équipe Re-New",
    )
    expect(preview.subject).toBe(request.subject)
    expect(preview.html).toBe(request.html)
    expect(request.html).not.toContain("<img")
    expect(JSON.stringify(request)).not.toContain("A-01")
    expect(db.send).toHaveBeenCalledTimes(1)
  })
  it("keeps one provider payload for several projects with known, missing and zero revenue", async () => {
    candidates.push({ ...candidates[0], opportunity_id: "b", reference: "B-02", title: "Projet Atlas", revenue_meur: null },
      { ...candidates[0], opportunity_id: "c", reference: "C-03", title: "Projet Zéro", revenue_meur: 0 })
    await runOpportunityFreshnessDrafts()
    await sendOpportunityFreshnessReview(saved, 1, "staff-1", undefined, true, true)
    const request = db.send.mock.calls[0][0]
    expect(request.subject).toBe("Statut des process pour les opportunités suivantes")
    expect(request.text).toContain("- Projet Orion (CA : 3,2 M€)\n- Projet Atlas\n- Projet Zéro (CA : 0 M€)")
    expect(request.text).toContain("Les process sont-ils toujours ouverts ?")
    expect(request.text).not.toMatch(/A-01|B-02|C-03|CA non renseigné/)
    expect(db.send).toHaveBeenCalledTimes(1)
    const preview = await getRenderedTemplate("ma_opportunity_validity_check", "multiple")
    expect(preview.sourceSubject).toBe("Statut du process pour {opportunityTitle}")
    expect(preview.subject).toBe(request.subject)
    expect(preview.html).toContain("Projet Atlas")
    expect(preview.html).not.toContain("<img")
  })

  it("requires the staff confirmation of recognizable titles and neutral copy before any first send", async () => {
    await runOpportunityFreshnessDrafts()
    await expect(sendOpportunityFreshnessReview(saved, 1, "staff-1", undefined, true)).rejects.toThrow("recognizable")
    expect(db.send).not.toHaveBeenCalled()
    await sendOpportunityFreshnessReview(saved, 1, "staff-1", undefined, true, true)
    expect(db.rpc).toHaveBeenCalledWith("opportunity_freshness_acknowledge_copy", {
      p_review_id: saved.id, p_version: 1, p_actor: "staff-1",
    })
    expect(db.send).toHaveBeenCalledTimes(1)
  })

})
