import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const platformRoot = process.cwd()

function source(relativePath: string) {
  return readFileSync(`${platformRoot}/${relativePath}`, "utf8")
}

describe("multi-contact M&A migration", () => {
  it("creates canonical contact and opportunity-link tables with one primary recipient", () => {
    const migration = source("scripts/072_enable_multiple_ma_source_contacts.sql")

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.ma_source_contacts")
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.opportunity_source_contacts")
    expect(migration).toContain("FOREIGN KEY (contact_id, source_id)")
    expect(migration).toContain("REFERENCES public.ma_source_contacts(id, source_id)")
    expect(migration).toContain("idx_opportunity_source_contacts_primary")
    expect(migration).toContain("WHERE is_primary")
  })

  it("backfills legacy contact values and links existing opportunities idempotently", () => {
    const migration = source("scripts/072_enable_multiple_ma_source_contacts.sql")

    expect(migration).toContain("legacy_source_id")
    expect(migration).toContain("idx_ma_source_contacts_legacy_source_id")
    expect(migration).toContain(
      "ON CONFLICT (legacy_source_id) WHERE legacy_source_id IS NOT NULL DO NOTHING",
    )
    expect(migration).toContain("NULLIF(BTRIM(s.contact_name), '')")
    expect(migration).toContain("INSERT INTO public.opportunity_source_contacts")
    expect(migration).toContain("first_backfilled_contact")
    expect(migration).toContain("AND NOT EXISTS")
  })

  it("preserves existing firm identities while carrying interaction recipient snapshots forward", () => {
    const migration = source("scripts/072_enable_multiple_ma_source_contacts.sql")

    expect(migration).not.toContain("DELETE FROM public.ma_sources")
    expect(migration).not.toContain("UPDATE public.opportunities o\nSET source_id")
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS contact_id")
    expect(migration).toContain("recipient_email remains the immutable outbound recipient snapshot")
  })

  it("keeps firm-level legacy contact fields out of current staff and portal reads", () => {
    const opportunityActions = source("lib/actions/opportunities.ts")
    const workflowActions = source("lib/actions/ma-workflows.ts")
    const snapshots = source("lib/data/dashboard-snapshots.ts")
    const portalActions = source("lib/actions/repreneur-opportunities.ts")
    const portalTypes = source("lib/types/opportunity.ts").slice(
      source("lib/types/opportunity.ts").indexOf("export interface RepreneurOpportunityExposure"),
    )

    for (const implementation of [opportunityActions, workflowActions, snapshots]) {
      expect(implementation).not.toMatch(/ma_sources\([^)]*contact_(name|email|phone)/)
      expect(implementation).not.toContain("source?.contact_")
    }
    expect(portalActions).not.toContain("ma_source_contacts")
    expect(portalActions).not.toContain("opportunity_source_contacts")
    expect(portalTypes).not.toContain("source_contacts")
  })

  it("lets staff choose an existing firm and its contacts while creating an opportunity", () => {
    const newOpportunityPage = source("app/(dashboard)/opportunities/new/page.tsx")
    const opportunityForm = source("components/opportunities/opportunity-form.tsx")

    expect(newOpportunityPage).toContain("listMaSourceDirectory")
    expect(newOpportunityPage).toContain("sourceOptions={sourceOptions}")
    expect(opportunityForm).toContain("Existing M&A firm")
    expect(opportunityForm).toContain("Choose a known firm to select its existing contacts")
    expect(opportunityForm).toContain('name="source_contact_ids"')
    expect(opportunityForm).toContain("value={selectedSourceId}")
  })

  it("makes the workflow recipient an opportunity-linked contact and logs its id", () => {
    const workflowActions = source("lib/actions/ma-workflows.ts")
    const workflowPanel = source("components/opportunities/opportunity-ma-workflow-panel.tsx")
    const route = source("app/api/opportunities/[id]/ma-workflow/send/route.ts")

    expect(workflowActions).toContain("contacts.find((contact) => contact.id === contactId)")
    expect(workflowActions).toContain("Choose a contact linked to this opportunity")
    expect(workflowActions).toContain("contact_id: recipient.id")
    expect(workflowPanel).toContain("ma_recipient")
    expect(workflowPanel).toContain('contactId: formData.get("contact_id")')
    expect(route).toContain("contactId")
  })
})
