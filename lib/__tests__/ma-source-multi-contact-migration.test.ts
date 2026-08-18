import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const platformRoot = process.cwd()

function source(relativePath: string) {
  return readFileSync(`${platformRoot}/${relativePath}`, "utf8")
}

describe("canonical multi-contact M&A intake", () => {
  it("keeps the legacy contact migration as historical compatibility evidence", () => {
    const migration = source(
      "scripts/072_enable_multiple_ma_source_contacts.sql",
    )

    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS public.ma_source_contacts",
    )
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS public.opportunity_source_contacts",
    )
    expect(migration).toContain(
      "recipient_email remains the immutable outbound recipient snapshot",
    )
  })

  it("uses the office and affiliation RPCs for new staff source context", () => {
    const actions = source("lib/actions/opportunity-intake.ts")
    const form = source("components/opportunities/opportunity-source-context.tsx")

    expect(actions).toContain("create_opportunity_with_office_context")
    expect(actions).toContain("save_opportunity_office_context")
    expect(actions).toContain("create_ma_firm_with_default_office")
    expect(actions).toContain("create_or_affiliate_ma_contact")
    expect(form).toContain('name="source_office_id"')
    expect(form).toContain('name="affiliation_ids"')
    expect(form).toContain('name="primary_affiliation_id"')
    expect(form).toContain("Add office contact")
  })

  it("does not make repreneur exposure or origin a form-controlled intake field", () => {
    const form = source("components/opportunities/opportunity-form.tsx")
    const actions = source("lib/actions/opportunity-intake.ts")

    expect(form).not.toContain('name="repreneur_exposure"')
    expect(form).not.toContain('name="origin_channel"')
    expect(actions).toContain("p_opportunity_fields")
    expect(actions).not.toContain("p_repreneur_exposure")
    expect(actions).not.toContain("p_origin_channel")
  })

  it("retires legacy directory mutation routes while retaining staff directory navigation", () => {
    const sidebar = source("components/app-sidebar.tsx")
    const legacyActions = source("lib/actions/ma-sources.ts")
    const firmRoute = source("app/(dashboard)/opportunities/ma/firms/page.tsx")
    const contactRoute = source(
      "app/(dashboard)/opportunities/ma/contacts/page.tsx",
    )

    expect(sidebar).toContain('href: "/opportunities/ma/firms"')
    expect(sidebar).toContain('href: "/opportunities/ma/contacts"')
    expect(legacyActions).toContain("Legacy M&A directory editing is retired")
    expect(legacyActions).not.toContain("move_ma_source_contact")
    expect(firmRoute).toContain("getMaRelationshipWorkspace")
    expect(firmRoute).toContain('initialView="firms"')
    expect(contactRoute).toContain("getMaRelationshipWorkspace")
    expect(contactRoute).toContain('initialView="contacts"')
    expect(firmRoute).not.toContain("redirect(")
    expect(contactRoute).not.toContain("redirect(")
  })

  it("uses canonical contacts and interaction persistence for workflow email evidence", () => {
    const workflowActions = source("lib/actions/ma-workflows.ts")

    expect(workflowActions).toContain("office_contacts:opportunity_ma_contacts")
    expect(workflowActions).toContain("source_office:ma_offices")
    expect(workflowActions).toContain("affiliationId: relation.affiliation_id")
    expect(workflowActions).toContain("p_recipient_email: recipientEmail")
    expect(workflowActions).toContain("recipient_email_snapshot")
    expect(workflowActions).toContain("begin_ma_interaction_email_send")
    expect(workflowActions).not.toContain(
      '.from("ma_source_interactions").insert',
    )
  })
})
