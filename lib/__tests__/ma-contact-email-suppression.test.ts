import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  maContactEmailPurposeForTemplate,
  suppressionBlocksMaTemplate,
} from "@/lib/ma-contact-email-policy"

const root = process.cwd()

function source(relativePath: string) {
  return readFileSync(`${root}/${relativePath}`, "utf8")
}

describe("W-072 purpose-aware M&A contact email suppression", () => {
  const migration = source("scripts/083_ma_contact_email_suppression.sql")
  const workflowAction = source("lib/actions/ma-workflows.ts")
  const workflowPanel = source(
    "components/opportunities/opportunity-ma-workflow-panel.tsx",
  )
  const relationships = source("lib/actions/ma-relationships.ts")
  const relationshipWorkspace = source(
    "components/opportunities/ma-relationship-workspace.tsx",
  )
  const policyAction = source("lib/actions/ma-contact-email-policy.ts")
  const policyAuthorization = source(
    "lib/email/ma-contact-email-authorization.ts",
  )
  const genericEmailBoundary = source("lib/email/send-email.ts")
  const emailActions = source("lib/actions/emails.ts")
  const wavySendRoute = source("app/api/wavy/send/route.ts")
  const route = source(
    "app/api/opportunities/[id]/ma-workflow/send/route.ts",
  )
  const contract = source("docs/data-models/ma-advisory-data-model-v1.md")

  it("backfills exactly the 18 retained W-010 warnings without replacing the notes", () => {
    expect(migration).toContain("flagged_count <> 18")
    expect(migration).toContain("distinct_flagged_count <> 18")
    expect(migration).toContain(
      "Email suppressed in the W-010 source snapshot;%",
    )
    expect(migration).toContain("w010_import_backfill")
    expect(migration).toContain("campaign_email_suppressed = TRUE")
    expect(migration).not.toMatch(/internal_notes\s*=/)
    expect(migration).toContain(
      "idx_ma_contact_email_policy_events_source",
    )
  })

  it("keeps suppression on the canonical person with immutable staff evidence", () => {
    expect(migration).toContain(
      "ALTER TABLE public.ma_contacts",
    )
    expect(migration).toContain(
      "campaign_email_suppression_reason TEXT",
    )
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS public.ma_contact_email_policy_events",
    )
    expect(migration).toContain(
      "ma_contact_email_policy_events_are_immutable",
    )
    expect(migration).toContain(
      "ma_contact_campaign_email_suppression_requires_service",
    )
    expect(migration).toContain(
      "set_ma_contact_campaign_email_suppression",
    )
    expect(migration).toContain("previous_suppressed")
    expect(migration).toContain("resulting_suppressed")
    expect(policyAction).toContain("await requireStaffAccess()")
    expect(policyAction).toContain("p_actor: user.id")
    expect(policyAction).toContain("reason.length < 5")
    expect(policyAction).not.toContain('.from("ma_contacts").update')
  })

  it("uses a closed purpose vocabulary with only the linked NDA exception", () => {
    for (const purpose of [
      "campaign",
      "general_relationship",
      "opportunity_general",
      "opportunity_nda_request",
    ]) {
      expect(migration).toContain(`'${purpose}'`)
    }
    expect(migration).toContain(
      "CREATE TYPE public.ma_contact_email_purpose AS ENUM",
    )
    expect(migration).toContain(
      "RETURN p_purpose =\n    'opportunity_nda_request'",
    )
    expect(migration).toContain("link.is_active")
    expect(migration).toContain("affiliation.is_active")
    expect(migration).toContain(
      "allowlisted_operational_send",
    )
    expect(migration).toContain("operation_key")
    expect(policyAuthorization).toContain(
      '"authorize_ma_contact_email_send"',
    )
    expect(migration).toContain(
      "ma_contact_email_address_is_suppressed",
    )
    expect(route).not.toContain("purpose")
  })

  it("maps current workflow templates without a generic bypass", () => {
    expect(
      maContactEmailPurposeForTemplate("ma_nda_info_memo_request"),
    ).toBe("opportunity_nda_request")
    expect(
      maContactEmailPurposeForTemplate("ma_process_follow_up"),
    ).toBe("opportunity_general")
    expect(
      suppressionBlocksMaTemplate(true, "ma_process_follow_up"),
    ).toBe(true)
    expect(
      suppressionBlocksMaTemplate(true, "ma_nda_info_memo_request"),
    ).toBe(false)
    expect(
      suppressionBlocksMaTemplate(false, "ma_process_follow_up"),
    ).toBe(false)
  })

  it("checks the canonical person at the final source-email boundary", () => {
    const sendStart = workflowAction.indexOf(
      "export async function sendMaSourceWorkflowEmailPayload",
    )
    const action = workflowAction.slice(sendStart)
    const reserve = action.indexOf('.rpc("reserve_ma_source_email_send"')
    const context = action.indexOf("await loadOpportunityContext")
    const refresh = action.indexOf('.rpc("refresh_ma_source_email_send"')
    const authorize = action.indexOf("await authorizeMaContactEmailSend")
    const begin = action.indexOf('"begin_ma_interaction_email_send"')
    const provider = action.indexOf("await sendIntermediaryEmail")

    expect(sendStart).toBeGreaterThan(-1)
    expect(reserve).toBeGreaterThan(-1)
    expect(context).toBeGreaterThan(reserve)
    expect(refresh).toBeGreaterThan(context)
    expect(authorize).toBeGreaterThan(refresh)
    expect(begin).toBeGreaterThan(authorize)
    expect(provider).toBeGreaterThan(begin)
    expect(action).toContain("contactId: recipient.contactId")
    expect(action).toContain(
      "purpose: maContactEmailPurposeForTemplate(templateKey)",
    )
    expect(action).toContain("operationKey: clientOperationKey")
    expect(migration).toContain(
      "ma_contact_campaign_email_suppression_change_blocked_during_send",
    )
    const genericProvider = genericEmailBoundary.indexOf(
      "await resend.emails.send",
    )
    const genericPolicy = genericEmailBoundary.indexOf(
      "await isMaContactEmailAddressSuppressed",
    )
    expect(genericPolicy).toBeGreaterThan(-1)
    expect(genericPolicy).toBeLessThan(genericProvider)
    expect(genericEmailBoundary).toContain("[to, ...(bcc ?? [])]")
    const manualRecipients = emailActions.slice(
      emailActions.indexOf(
        "export async function getRepreneursForManualSend",
      ),
      emailActions.indexOf(
        "export async function sendManualEmail",
      ),
    )
    const templateSettings = emailActions.slice(
      emailActions.indexOf("export async function getTemplateSettings"),
      emailActions.indexOf("export async function toggleTemplateEnabled"),
    )
    expect(templateSettings).not.toContain(
      "getSuppressedMaContactEmailAddresses",
    )
    expect(manualRecipients).toContain(
      "getSuppressedMaContactEmailAddresses()",
    )
    expect(manualRecipients).toContain(
      "const normalizedEmail = repreneur.email?.trim().toLowerCase()",
    )
    expect(manualRecipients).toContain(
      "!suppressedEmails.has(normalizedEmail)",
    )
    const addressPolicy = migration.slice(
      migration.indexOf(
        "CREATE OR REPLACE FUNCTION public.ma_contact_email_address_is_suppressed",
      ),
      migration.indexOf(
        "CREATE OR REPLACE FUNCTION public.authorize_ma_contact_email_send",
      ),
    )
    expect(addressPolicy).not.toContain("contact.status = 'active'")
    expect(wavySendRoute).toContain("status: 410")
    expect(wavySendRoute).not.toContain("resend.emails.send")
  })

  it("shows staff the policy in both recipient selection and the canonical directory", () => {
    expect(workflowAction).toContain("campaign_email_suppressed")
    expect(workflowAction).toContain("campaign_email_suppression_reason")
    expect(workflowPanel).toContain(
      "Campaign email blocked for this contact",
    )
    expect(workflowPanel).toContain("suppressionBlocksMaTemplate")
    expect(workflowPanel).toContain(
      "WAVE will verify the active opportunity link",
    )
    expect(relationships).toContain("campaignEmailSuppressed")
    expect(relationshipWorkspace).toContain(
      "Manage email policy",
    )
    expect(relationshipWorkspace).toContain(
      "Every change is retained with your identity, time and reason.",
    )
    expect(relationshipWorkspace).toContain(
      "setMaContactCampaignEmailSuppression",
    )
  })

  it("keeps policy evidence and services away from browser roles", () => {
    expect(migration).toContain(
      "ALTER TABLE public.ma_contact_email_policy_events FORCE ROW LEVEL SECURITY",
    )
    expect(migration).toMatch(
      /REVOKE ALL ON TABLE public\.ma_contact_email_policy_events[\s\S]*FROM PUBLIC, anon, authenticated, service_role;/,
    )
    expect(migration).toContain(
      "GRANT SELECT ON TABLE public.ma_contact_email_policy_events TO service_role;",
    )
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION\n  public.authorize_ma_contact_email_send",
    )
    expect(migration).not.toMatch(
      /GRANT (SELECT|EXECUTE)[\s\S]{0,180}TO (anon|authenticated)/,
    )
  })

  it("keeps the live release and its synthetic-only proof in the canonical contract", () => {
    expect(contract).toContain(
      "Migration 083 is the live W-072 implementation.",
    )
    expect(contract).toContain(
      "W-072 live and production-verified on 2026-07-30",
    )
    expect(contract).toContain("dpl_3oLejSgvXARqTRpsCucHF6ks1xKd")
    expect(contract).toContain("`10.4845fe4`")
    const rehearsal = source(
      "scripts/rehearse-ma-contact-email-suppression.sql",
    )
    const runner = source(
      "scripts/rehearse-ma-contact-email-suppression.sh",
    )
    expect(rehearsal).toContain("W-072 disposable rehearsal passed")
    expect(rehearsal).toContain(
      "w072_fixture_exception_audit_not_idempotent",
    )
    expect(rehearsal).toContain(
      "w072_fixture_concurrent_policy_change_succeeded",
    )
    expect(rehearsal).toContain(
      "w072_fixture_inactive_direct_address_bypass_allowed",
    )
    expect(rehearsal).toContain(
      "w072_fixture_short_policy_reason_succeeded",
    )
    expect(runner).toContain("/private/tmp/renew-w072-postgres")
    expect(runner).toContain("false:1")
    expect(runner).not.toContain(".env")
  })
})
