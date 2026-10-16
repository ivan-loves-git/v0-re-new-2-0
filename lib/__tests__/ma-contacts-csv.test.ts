import { describe, expect, it } from "vitest"
import type { MaRelationshipWorkspace } from "@/lib/actions/ma-relationships"
import { buildMaContactsCsv } from "@/lib/ma-contacts-csv"

type Contact = MaRelationshipWorkspace["contacts"][number]

function contact(overrides: Partial<Contact>): Contact {
  return {
    id: "c1",
    label: "Anne Dupont",
    email: "anne@example.com",
    firstName: "Anne",
    lastName: "Dupont",
    phone: null,
    linkedinUrl: null,
    internalNotes: null,
    officeIds: [],
    affiliations: [],
    linkedOpportunities: [],
    campaignEmailSuppressed: false,
    campaignEmailSuppressionReason: null,
    ...overrides,
  }
}

const offices = [
  { id: "o-old", firmName: "Old Firm", officeName: "Lyon" },
  { id: "o-cur", firmName: "Cabinet, Martin", officeName: "Paris" },
]

describe("M&A contacts CSV export", () => {
  it("exports name, email, current office and firm, and email policy", () => {
    const csv = buildMaContactsCsv(
      [
        contact({
          affiliations: [
            { id: "a1", officeId: "o-old", officeLabel: "", jobTitle: null, isActive: false },
            { id: "a2", officeId: "o-cur", officeLabel: "", jobTitle: null, isActive: true },
          ],
        }),
        contact({
          id: "c2",
          firstName: "=cmd",
          lastName: null,
          email: null,
          campaignEmailSuppressed: true,
          campaignEmailSuppressionReason: "Asked to stop",
        }),
      ],
      offices,
    )

    expect(csv.split("\r\n")).toEqual([
      "first_name,last_name,email,office,firm,email_policy,email_policy_reason",
      'Anne,Dupont,anne@example.com,Paris,"Cabinet, Martin",Allowed,',
      "'=cmd,,,,,Blocked,Asked to stop",
    ])
  })
})
