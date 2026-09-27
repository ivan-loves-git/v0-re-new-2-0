import "server-only"
import { createHash } from "node:crypto"

import { createAdminClient } from "@/lib/supabase/admin"
import { renderGroupedFreshnessCopy } from "@/lib/opportunity-freshness-copy"

export interface FreshnessCandidate {
  opportunity_id: string
  reference: string
  title: string
  source_office_id: string
  office_name: string
  firm_name: string
  contact_link_id: string
  affiliation_id: string
  contact_id: string
  contact_name: string
  recipient_email: string
  date_added: string | null
  date_added_precision: "day" | "month" | null
  confirmation_id: string | null
  confirmation_at: string | null
  episode_key: string
  basis: "confirmed_open" | "recorded_source_day" | "older_inventory_no_confirmation"
}

/** Cron may only prepare unsent rows. The database re-derives the complete
 * contact group under a per-contact transaction lock before inserting it. */
export async function runOpportunityFreshnessDrafts(maxContacts = 30) {
  if (process.env.OPPORTUNITY_FRESHNESS_GENERATION_ENABLED === "false") {
    return { prepared: 0, disabled: true }
  }
  const db = createAdminClient()
  const { data: contacts, error: contactsError } = await db.rpc("opportunity_freshness_due_contacts", {
    p_limit: Math.max(1, Math.min(maxContacts, 100)),
  })
  if (contactsError) throw new Error("The freshness cohort could not be verified.")
  if (!contacts?.length) return { prepared: 0, disabled: false }
  const { data: template, error: templateError } = await db.from("email_templates")
    .select("subject,body_markdown,body_editable").eq("template_key", "ma_opportunity_validity_check").maybeSingle()
  if (templateError || !template?.subject || !template.body_markdown) {
    throw new Error("The validity-check catalogue copy is missing; no drafts were created.")
  }
  // Hash the very same catalogue row used to render the frozen copy. A
  // concurrent template edit then leaves an old version that send will veto.
  const templateVersion = createHash("sha256")
    .update(JSON.stringify([template.subject, template.body_markdown, template.body_editable])).digest("hex")
  let prepared = 0
  for (const contact of contacts) {
    const { data: current, error: currentError } = await db.rpc("opportunity_freshness_candidates", {
      p_contact_id: contact.contact_id, p_exclude_recorded: true,
    })
    if (currentError) throw new Error("The freshness contact group could not be verified.")
    const members = (current ?? []) as FreshnessCandidate[]
    if (!members.length) continue
    members.sort((a, b) => a.opportunity_id.localeCompare(b.opportunity_id))
    const rendered = renderGroupedFreshnessCopy({
      subject: template.subject, body: template.body_markdown,
      contactName: members[0].contact_name,
      members: members.map((member) => ({
        opportunityId: member.opportunity_id, reference: member.reference,
        title: member.title, firmName: member.firm_name,
      })),
    })
    const { error } = await db.rpc("opportunity_freshness_prepare", {
      p_contact_id: contact.contact_id, p_members: members,
      p_subject: rendered.subject, p_body: rendered.body,
      p_template_version: templateVersion,
    })
    // A concurrent generator may have won the contact lock. Its immutable
    // episode rows are the desired outcome; do not overwrite staff copy.
    if (error?.message?.includes("freshness_members_changed_before_preparation") ||
        error?.message?.includes("opportunity_freshness_members_opportunity_id_episode_key_key")) continue
    if (error) throw new Error("A grouped freshness draft could not be saved safely.")
    prepared += 1
  }
  return { prepared, disabled: false }
}
