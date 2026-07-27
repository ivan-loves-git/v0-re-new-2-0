"use server"

import { revalidatePath } from "next/cache"
import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"

export type MaInteractionChannel =
  | "call"
  | "email"
  | "meeting"
  | "document"
  | "other"
export type MaInteractionDirection = "inbound" | "outbound"

export interface MaRelationshipContactOption {
  id: string
  label: string
  email: string | null
}

export interface MaRelationshipOfficeOption {
  id: string
  firmName: string
  officeName: string
  label: string
  contacts: MaRelationshipContactOption[]
}

export interface MaRelationshipOpportunityOption {
  id: string
  officeId: string
  label: string
  status: string
}

export interface MaRelationshipTimelineItem {
  id: string
  officeId: string
  officeLabel: string
  affiliationId: string | null
  contactLabel: string | null
  contactEmail: string | null
  opportunityId: string | null
  opportunityLabel: string | null
  channel: MaInteractionChannel
  direction: MaInteractionDirection | null
  occurredAt: string
  title: string | null
  summary: string | null
  outcome: string | null
  nextAction: string | null
  nextActionDueAt: string | null
  deliveryStatus: "pending" | "sent" | "failed" | null
  recipientEmail: string | null
  deliveryError: string | null
  ownerStaffUserId: string
  ownerVerificationState: "provisional" | "verified"
  ownerVerifiedAt: string | null
  createdAt: string
}

export interface MaRelationshipWorkspace {
  currentUserId: string
  offices: MaRelationshipOfficeOption[]
  opportunities: MaRelationshipOpportunityOption[]
  interactions: MaRelationshipTimelineItem[]
}

export interface CreateMaRelationshipInteractionInput {
  officeId: string
  affiliationId?: string | null
  opportunityId?: string | null
  channel: MaInteractionChannel
  direction?: MaInteractionDirection | null
  occurredAt: string
  title?: string | null
  summary: string
  outcome?: string | null
  nextAction?: string | null
  nextActionDueAt?: string | null
  recipientEmailSnapshot?: string | null
}

export interface MaRelationshipActionResult {
  success: boolean
  message: string
}

type Relation<T> = T | T[] | null | undefined

interface OfficeRow {
  id: string
  name: string
  firm?: Relation<{ id: string; name: string }>
}

interface AffiliationRow {
  id: string
  office_id: string
  is_active: boolean
  ended_at: string | null
  contact?: Relation<{
    id: string
    display_name: string | null
    email: string | null
  }>
}

interface OpportunityRow {
  id: string
  reference: string
  public_title: string | null
  activity: string | null
  source_office_id: string | null
  status: string
}

interface InteractionRow {
  id: string
  office_id: string
  affiliation_id: string | null
  opportunity_id: string | null
  channel: MaInteractionChannel
  direction: MaInteractionDirection | null
  occurred_at: string
  title: string | null
  summary: string | null
  outcome: string | null
  next_action: string | null
  next_action_due_at: string | null
  delivery_status: "pending" | "sent" | "failed" | null
  recipient_email_snapshot: string | null
  delivery_error: string | null
  owner_staff_user_id: string
  owner_verification_state: "provisional" | "verified"
  owner_verified_at: string | null
  created_at: string
  office?: Relation<OfficeRow>
  affiliation?: Relation<AffiliationRow>
  opportunity?: Relation<OpportunityRow>
}

function one<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
}

function optionalString(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function opportunityLabel(row: OpportunityRow) {
  return [row.reference, row.public_title ?? row.activity]
    .filter(Boolean)
    .join(" · ")
}

function contactLabel(
  contact: { display_name: string | null; email: string | null } | null,
) {
  return contact?.display_name || contact?.email || "Unnamed contact"
}

function interactionTimelineItem(
  row: InteractionRow,
): MaRelationshipTimelineItem {
  const office = one(row.office)
  const firm = one(office?.firm)
  const affiliation = one(row.affiliation)
  const contact = one(affiliation?.contact)
  const opportunity = one(row.opportunity)
  return {
    id: row.id,
    officeId: row.office_id,
    officeLabel:
      [firm?.name, office?.name].filter(Boolean).join(" · ") ||
      "Unknown office",
    affiliationId: row.affiliation_id,
    contactLabel: contact ? contactLabel(contact) : null,
    contactEmail: contact?.email ?? null,
    opportunityId: row.opportunity_id,
    opportunityLabel: opportunity ? opportunityLabel(opportunity) : null,
    channel: row.channel,
    direction: row.direction,
    occurredAt: row.occurred_at,
    title: row.title,
    summary: row.summary,
    outcome: row.outcome,
    nextAction: row.next_action,
    nextActionDueAt: row.next_action_due_at,
    deliveryStatus: row.delivery_status,
    recipientEmail: row.recipient_email_snapshot,
    deliveryError: row.delivery_error,
    ownerStaffUserId: row.owner_staff_user_id,
    ownerVerificationState: row.owner_verification_state,
    ownerVerifiedAt: row.owner_verified_at,
    createdAt: row.created_at,
  }
}

export async function listMaRelationshipTimeline(options?: {
  officeId?: string | null
  affiliationId?: string | null
  opportunityId?: string | null
  limit?: number
}): Promise<MaRelationshipTimelineItem[]> {
  await requireStaffAccess()
  const supabase = createAdminClient()
  let query = supabase
    .from("ma_interactions")
    .select(
      `id, office_id, affiliation_id, opportunity_id, channel, direction, occurred_at,
       title, summary, outcome, next_action, next_action_due_at, delivery_status,
       recipient_email_snapshot, delivery_error, owner_staff_user_id,
       owner_verification_state, owner_verified_at, created_at,
       office:ma_offices(id, name, firm:ma_firms(id, name)),
       affiliation:ma_contact_office_affiliations(id, office_id, contact:ma_contacts(id, display_name, email)),
       opportunity:opportunities(id, reference, public_title, activity, source_office_id, status)`,
    )
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(options?.limit ?? 250)

  if (options?.officeId) query = query.eq("office_id", options.officeId)
  if (options?.affiliationId)
    query = query.eq("affiliation_id", options.affiliationId)
  if (options?.opportunityId)
    query = query.eq("opportunity_id", options.opportunityId)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as InteractionRow[]).map(
    interactionTimelineItem,
  )
}

export async function getMaRelationshipWorkspace(): Promise<MaRelationshipWorkspace> {
  const { user } = await requireStaffAccess()
  const supabase = createAdminClient()
  const [officeResult, affiliationResult, opportunityResult, interactions] =
    await Promise.all([
      supabase
        .from("ma_offices")
        .select("id, name, firm:ma_firms(id, name)")
        .order("name"),
      supabase
        .from("ma_contact_office_affiliations")
        .select(
          "id, office_id, is_active, ended_at, contact:ma_contacts(id, display_name, email)",
        )
        .eq("is_active", true)
        .is("ended_at", null),
      supabase
        .from("opportunities")
        .select(
          "id, reference, public_title, activity, source_office_id, status",
        )
        .not("source_office_id", "is", null)
        .order("updated_at", { ascending: false }),
      listMaRelationshipTimeline(),
    ])

  if (officeResult.error) throw new Error(officeResult.error.message)
  if (affiliationResult.error) throw new Error(affiliationResult.error.message)
  if (opportunityResult.error) throw new Error(opportunityResult.error.message)

  const contactsByOffice = new Map<string, MaRelationshipContactOption[]>()
  for (const relation of (affiliationResult.data ??
    []) as unknown as AffiliationRow[]) {
    const contact = one(relation.contact)
    const contacts = contactsByOffice.get(relation.office_id) ?? []
    contacts.push({
      id: relation.id,
      label: contactLabel(contact),
      email: contact?.email ?? null,
    })
    contactsByOffice.set(relation.office_id, contacts)
  }

  const offices = ((officeResult.data ?? []) as unknown as OfficeRow[])
    .map((office) => {
      const firm = one(office.firm)
      return {
        id: office.id,
        firmName: firm?.name ?? "Unknown firm",
        officeName: office.name,
        label: [firm?.name, office.name].filter(Boolean).join(" · "),
        contacts: (contactsByOffice.get(office.id) ?? []).sort((left, right) =>
          left.label.localeCompare(right.label),
        ),
      }
    })
    .sort((left, right) => left.label.localeCompare(right.label))

  const opportunities = (
    (opportunityResult.data ?? []) as unknown as OpportunityRow[]
  )
    .filter((opportunity) => Boolean(opportunity.source_office_id))
    .map((opportunity) => ({
      id: opportunity.id,
      officeId: opportunity.source_office_id!,
      label: opportunityLabel(opportunity),
      status: opportunity.status,
    }))

  return { currentUserId: user.id, offices, opportunities, interactions }
}

function normaliseCreateError(message: string): string {
  if (message.includes("ma_relationship_interaction_requires_direction")) {
    return "Choose whether this call or email was inbound or outbound."
  }
  if (
    message.includes(
      "ma_relationship_interaction_affiliation_must_match_active_office",
    )
  ) {
    return "Choose an active contact at the selected office."
  }
  if (
    message.includes(
      "ma_relationship_interaction_opportunity_must_match_office",
    )
  ) {
    return "The selected opportunity belongs to another office."
  }
  if (
    message.includes(
      "ma_relationship_interaction_requires_complete_staff_evidence",
    )
  ) {
    return "Office, date and a short summary are required."
  }
  return "The interaction could not be recorded. Refresh the page and try again."
}

export async function createMaRelationshipInteraction(
  input: CreateMaRelationshipInteractionInput,
): Promise<MaRelationshipActionResult> {
  const { user } = await requireStaffAccess()
  if (!input.officeId || !optionalString(input.summary) || !input.occurredAt) {
    return {
      success: false,
      message: "Office, date and a short summary are required.",
    }
  }

  const occurredAt = new Date(input.occurredAt)
  if (Number.isNaN(occurredAt.getTime())) {
    return {
      success: false,
      message: "Choose a valid interaction date and time.",
    }
  }
  const nextActionDueAt = input.nextActionDueAt
    ? new Date(input.nextActionDueAt)
    : null
  if (nextActionDueAt && Number.isNaN(nextActionDueAt.getTime())) {
    return {
      success: false,
      message: "Choose a valid next-action date and time.",
    }
  }
  if (
    input.channel === "email" &&
    input.direction === "outbound" &&
    !optionalString(input.recipientEmailSnapshot ?? null)
  ) {
    return {
      success: false,
      message: "An outbound email record needs the recipient email.",
    }
  }

  const supabase = createAdminClient()
  const { error } = await supabase.rpc("create_ma_relationship_interaction", {
    p_office_id: input.officeId,
    p_affiliation_id: optionalString(input.affiliationId ?? null),
    p_opportunity_id: optionalString(input.opportunityId ?? null),
    p_channel: input.channel,
    p_direction: optionalString(input.direction ?? null),
    p_occurred_at: occurredAt.toISOString(),
    p_title: optionalString(input.title ?? null),
    p_summary: optionalString(input.summary),
    p_outcome: optionalString(input.outcome ?? null),
    p_next_action: optionalString(input.nextAction ?? null),
    p_next_action_due_at: nextActionDueAt?.toISOString() ?? null,
    p_recipient_email_snapshot: optionalString(
      input.recipientEmailSnapshot ?? null,
    ),
    p_actor: user.id,
  })

  if (error)
    return { success: false, message: normaliseCreateError(error.message) }

  revalidatePath("/opportunities/ma")
  revalidatePath("/opportunities")
  if (input.opportunityId)
    revalidatePath(`/opportunities/${input.opportunityId}`)
  return { success: true, message: "Relationship activity recorded." }
}

export async function verifyMaRelationshipInteractionOwner(
  interactionId: string,
): Promise<MaRelationshipActionResult> {
  const { user } = await requireStaffAccess()
  const supabase = createAdminClient()
  const { error } = await supabase.rpc("verify_ma_interaction_owner", {
    p_interaction_id: interactionId,
    p_actor: user.id,
  })
  if (error) {
    return {
      success: false,
      message: error.message.includes("ma_interaction_owner_must_verify_self")
        ? "Only the assigned owner can verify this migrated interaction."
        : "This owner verification could not be recorded.",
    }
  }
  revalidatePath("/opportunities/ma")
  return { success: true, message: "Owner verification recorded." }
}
