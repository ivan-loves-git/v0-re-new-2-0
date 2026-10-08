import { MA_TEMPLATE_DEFAULT_BODIES } from "@/lib/email/templates"
import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: m.rpc, from: m.from }),
}))

import { runOpportunityFreshnessDrafts } from "@/lib/opportunity-freshness-drafts"

const contactA = "18700000-0000-4000-8000-000000000001"
const contactB = "18700000-0000-4000-8000-000000000002"
function member(contactId: string, id: string, reference: string) {
  return {
    contact_id: contactId,
    contact_name: "Marie Source",
    opportunity_id: id,
    reference,
    title:
      id == "a" ? "Projet Orion" : id == "b" ? "Projet Atlas" : "Projet Vega",
    revenue_meur: id == "a" ? 3.2 : null,
    copy_contract: "recognizable-v1",
    firm_name: "Atlas",
    recipient_email: "same@example.test",
    episode_key: "initial",
    basis: "older_inventory_no_confirmation",
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.OPPORTUNITY_FRESHNESS_GENERATION_ENABLED
  m.from.mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({
          data: {
            subject: "Statut du process pour {opportunityTitle}",
            body_markdown:
              MA_TEMPLATE_DEFAULT_BODIES.ma_opportunity_validity_check,
            body_editable: true,
            is_active: false,
          },
          error: null,
        }),
      }),
    }),
  })
  m.rpc.mockImplementation(async (name, args) => {
    if (name === "opportunity_freshness_due_contacts")
      return {
        data: [{ contact_id: contactA }, { contact_id: contactB }],
        error: null,
      }
    if (name === "opportunity_freshness_candidates")
      return {
        data:
          args.p_contact_id === contactA
            ? [member(contactA, "a", "A-01"), member(contactA, "b", "B-02")]
            : [member(contactB, "c", "C-03")],
        error: null,
      }
    return { data: "review-id", error: null }
  })
})

describe("scheduled freshness drafting", () => {
  it("prepares unsent exact-contact groups even while the staff-send template is inactive", async () => {
    const result = await runOpportunityFreshnessDrafts()
    expect(result.prepared).toBe(2)
    const prepared = m.rpc.mock.calls.filter(
      ([name]) => name === "opportunity_freshness_prepare",
    )
    expect(prepared).toHaveLength(2)
    expect(
      prepared[0][1].p_members.map(
        (row: { opportunity_id: string }) => row.opportunity_id,
      ),
    ).toEqual(["a", "b"])
    expect(
      prepared[1][1].p_members.map(
        (row: { opportunity_id: string }) => row.opportunity_id,
      ),
    ).toEqual(["c"])
    expect(prepared[0][1].p_subject).toBe(
      "Statut des process pour les opportunités suivantes",
    )
    expect(prepared[0][1].p_body).toContain(
      "- Projet Orion (CA : 3,2 M€)\n- Projet Atlas",
    )
    expect(prepared[0][1].p_body).not.toMatch(/A-01|B-02|CA non renseigné/)
    expect(prepared[1][1].p_subject).toBe("Statut du process pour Projet Vega")
  })

  it("can stop new generation without deleting any queue history", async () => {
    process.env.OPPORTUNITY_FRESHNESS_GENERATION_ENABLED = "false"
    expect(await runOpportunityFreshnessDrafts()).toEqual({
      prepared: 0,
      disabled: true,
    })
    expect(m.rpc).not.toHaveBeenCalled()
  })
})
