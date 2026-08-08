import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { filterMaRelationshipTimeline } from "@/lib/ma-relationship-filters"
import { isValidMaRelationshipEmail } from "@/lib/ma-relationship-validation"
import {
  activityProvenance,
  hasConfirmedProviderDelivery,
} from "@/lib/ma-relationship-activity-provenance"
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

  it("keeps legacy relationship links as safe aliases for the staff workspace", () => {
    expect(page).toContain("redirect(")
    expect(page).toContain('view === "firms" || view === "contacts"')
    expect(page).toContain("`/opportunities/ma/${destination}`")
    expect(workspace).toContain("One chronological M&A relationship record")
    expect(workspace).toContain('idPrefix="desktop"')
    expect(workspace).toContain('idPrefix="mobile"')
    expect(workspace).toContain("relationship-${idPrefix}-office-filter")
    expect(workspace).toContain("relationship-${idPrefix}-contact-filter")
    expect(workspace).toContain("relationship-${idPrefix}-opportunity-filter")
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
    expect(migration).toContain(
      "Source assignment and resolution take the opportunity row first",
    )
    expect(migration).toContain(
      "WHERE opportunity.id = p_opportunity_id\n    FOR UPDATE",
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
    expect(rehearsal).toContain("w066_pause_after_relationship_lock")
    const raceRunner = source("scripts/rehearse-ma-relationship-workspace.sh")
    expect(raceRunner).toContain("W-066 two-session source-change races passed")
    expect(raceRunner).toContain(
      "ma_interaction_history_blocks_source_office_change",
    )
    expect(raceRunner).toContain(
      "ma_relationship_interaction_opportunity_must_match_office",
    )
    expect(rehearsal).toContain(
      "w066_cross_office_affiliation_rejection_missing",
    )
    expect(rehearsal).toContain("w066_clean_rerun_changed_relationship_history")
    expect(workspace).toContain("Verify mine")
    expect(workspace).toMatch(
      /interaction\.ownerStaffUserId\s*===\s*workspace\.currentUserId/,
    )
  })

  it("keeps canonical directories reachable and makes mobile timeline-first", () => {
    expect(workspace).toContain('value="timeline"')
    expect(workspace).toContain('value="firms"')
    expect(workspace).toContain('value="contacts"')
    expect(workspace).toContain("value={activeView}")
    expect(workspace).toContain("onValueChange={selectView}")
    expect(workspace).toContain("router.replace(")
    expect(workspace).toContain('"/opportunities/ma/activity"')
    expect(workspace).toContain("`/opportunities/ma/${nextView}`")
    expect(workspace).toContain("RelationshipFirmsDirectory")
    expect(workspace).toContain("RelationshipContactsDirectory")
    expect(workspace).toContain("workspace.offices")
    expect(workspace).toContain("workspace.contacts")
    expect(workspace).toContain("Search firms or offices")
    expect(workspace).toContain("Search contacts, email or office")
    expect(workspace).toContain("byFirm")
    expect(workspace).toContain("officeLabels")
    expect(workspace).toContain("All filters")
    expect(workspace).toContain("All offices, contacts and opportunities")
    expect(workspace).toContain("order-2 md:order-1")
    expect(workspace).toContain("order-1 md:order-2")
  })

  it("progressively discloses optional activity fields without changing recording semantics", () => {
    expect(workspace).toContain("Optional details")
    expect(workspace).toContain("optionalFieldsOpen")
    expect(workspace).toContain("max-h-[90vh]")
    expect(workspace).toContain("overflow-y-auto")
    expect(workspace).toContain("border-t bg-background")
    expect(workspace).toContain("createMaRelationshipInteraction(input)")
    expect(workspace).toContain("Owner to verify")
    expect(workspace).toContain("text-warning")
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

  it("labels manual activity separately from persisted provider delivery", () => {
    const manualOutboundEmail = {
      deliveryStatus: null,
      providerIdempotencyKey: null,
      providerMessageId: null,
      deliveryFinalizedAt: null,
      sentAt: null,
    } as const
    expect(activityProvenance(manualOutboundEmail)).toBe("manual")
    expect(hasConfirmedProviderDelivery(manualOutboundEmail)).toBe(false)

    const sentByProvider = {
      deliveryStatus: "sent",
      providerIdempotencyKey: "provider-key",
      providerMessageId: "provider-message",
      deliveryFinalizedAt: "2026-08-08T09:00:00.000Z",
      sentAt: "2026-08-08T09:00:00.000Z",
    } as const
    expect(activityProvenance(sentByProvider)).toBe("system-recorded")
    expect(hasConfirmedProviderDelivery(sentByProvider)).toBe(true)
  })

  it("keeps labels tied to the canonical ledger and does not treat manual email as sent", () => {
    expect(actions).toContain("provider_idempotency_key")
    expect(actions).toContain("activityProvenance")
    expect(workspace).toContain("Add activity")
    expect(workspace).toContain("Manual")
    expect(workspace).toContain("System-recorded")
    expect(workspace).toContain("No provider delivery evidence recorded")
    expect(workspace).toContain("delivery unconfirmed")
    expect(workspace).not.toContain("sendMaSourceWorkflowEmail")
  })
})
