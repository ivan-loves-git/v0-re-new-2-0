import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { filterMaRelationshipTimeline } from "@/lib/ma-relationship-filters"
import { isValidMaRelationshipEmail } from "@/lib/ma-relationship-validation"
import type { MaRelationshipTimelineItem } from "@/lib/actions/ma-relationships"

const root = process.cwd()

function source(relativePath: string) {
  return readFileSync(`${root}/${relativePath}`, "utf8")
}

describe("W-066 staff relationship workspace", () => {
  const migration = source("scripts/081_ma_relationship_workspace.sql")
  const actions = source("lib/actions/ma-relationships.ts")
  const workspace = source(
    "components/opportunities/ma-relationship-workspace.tsx",
  )
  const page = source("app/(dashboard)/opportunities/ma/page.tsx")
  const workflow = source("lib/actions/ma-workflows.ts")
  const contract = source("docs/data-models/ma-advisory-data-model-v1.md")
  const rehearsal = source("scripts/rehearse-ma-relationship-workspace.sql")
  const verifier = source("scripts/verify-ma-data-model-schema.sql")

  it("replaces the legacy redirect with one staff-only relationship workspace", () => {
    expect(page).toContain("getMaRelationshipWorkspace")
    expect(page).toContain("MaRelationshipWorkspace")
    expect(page).not.toContain("redirect(")
    expect(workspace).toContain("One chronological M&A relationship record")
    expect(workspace).toContain("relationship-office-filter")
    expect(workspace).toContain("relationship-contact-filter")
    expect(workspace).toContain("relationship-opportunity-filter")
    expect(workspace).toContain("Record activity")
  })

  it("captures all approved activity types without sending email or adding editing", () => {
    for (const channel of ["call", "email", "meeting", "document", "other"]) {
      expect(actions).toContain(`| "${channel}"`)
      expect(workspace).toContain(`value: "${channel}"`)
    }
    expect(workspace).toContain("Recording an email here")
    expect(workspace).not.toContain("sendMaSourceWorkflowEmail")
    expect(workspace).not.toContain("Edit activity")
    expect(workspace).not.toContain("Upload attachment")
  })

  it("uses only staff-gated service actions and preserves W-062 delivery controls", () => {
    expect(actions).toContain("await requireStaffAccess()")
    expect(actions).toContain('"create_ma_relationship_interaction"')
    expect(actions).toContain('"verify_ma_interaction_owner"')
    expect(actions).not.toContain('.from("ma_interactions").insert')
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.create_ma_relationship_interaction",
    )
    expect(migration).toContain(
      "ma_relationship_interaction_affiliation_must_match_active_office",
    )
    expect(migration).toContain(
      "ma_relationship_interaction_opportunity_must_match_office",
    )
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.create_ma_relationship_interaction",
    )
    expect(migration).toContain("delivery_status IS NULL")
    expect(migration).toContain("provider_idempotency_key")
    expect(migration).toContain(
      "ma_relationship_interaction_outbound_email_requires_recipient",
    )
    expect(migration).toContain(
      "ma_relationship_interaction_outbound_email_requires_valid_recipient",
    )
    expect(migration).toContain(
      "ma_provisional_source_review_blocks_relationship_interaction",
    )
    expect(migration).toContain("normalized_recipient_email := NULL")
    expect(verifier).toContain("service_can_create_relationship_interaction")
    expect(rehearsal).toContain(
      "w066_preopportunity_relationship_capture_missing",
    )
    expect(rehearsal).toContain("w066_manual_email_evidence_boundary_missing")
    expect(rehearsal).toContain(
      "w066_outbound_email_recipient_snapshot_missing",
    )
    expect(rehearsal).toContain(
      "w066_outbound_email_recipient_rejection_missing",
    )
    expect(rehearsal).toContain(
      "w066_outbound_email_invalid_recipient_rejection_missing",
    )
    expect(rehearsal).toContain(
      "w066_acme_linked_interaction_rejection_missing",
    )
    expect(rehearsal).toContain("w066_acme_resolution_remains_possible_missing")
    expect(rehearsal).toContain(
      "w066_canonical_contact_multi_affiliation_fixture_missing",
    )
    expect(rehearsal).toContain(
      "w066_cross_office_affiliation_rejection_missing",
    )
    expect(rehearsal).toContain("w066_clean_rerun_changed_relationship_history")
    expect(workspace).toContain("Verify mine")
    expect(workspace).toContain(
      "interaction.ownerStaffUserId === workspace.currentUserId",
    )
  })

  it("keeps opportunity history on the same canonical interaction ledger", () => {
    expect(workflow).toContain('.from("ma_interactions")')
    expect(workflow).toContain('.eq("opportunity_id", opportunityId)')
    expect(workflow).not.toContain('.from("ma_source_interactions")')
    expect(contract).toContain("create_ma_relationship_interaction")
    expect(contract).toContain("A manually recorded email is evidence")
    expect(contract).toContain("W-066 implementation candidate")
  })

  it("filters one canonical contact across affiliations while composing office", () => {
    const interactions = [
      { id: "paris", officeId: "paris", contactId: "contact-1" },
      { id: "lyon", officeId: "lyon", contactId: "contact-1" },
      { id: "other", officeId: "paris", contactId: "contact-2" },
    ] as MaRelationshipTimelineItem[]

    expect(
      filterMaRelationshipTimeline(interactions, {
        contactId: "contact-1",
      }).map((interaction) => interaction.id),
    ).toEqual(["paris", "lyon"])
    expect(
      filterMaRelationshipTimeline(interactions, {
        contactId: "contact-1",
        officeId: "lyon",
      }).map((interaction) => interaction.id),
    ).toEqual(["lyon"])
  })

  it("rejects malformed manual outbound recipient evidence before the RPC", () => {
    expect(isValidMaRelationshipEmail("recipient@example.test")).toBe(true)
    expect(isValidMaRelationshipEmail("not-an-email")).toBe(false)
  })
})
