"use server"

import { revalidatePath } from "next/cache"
import { requireStaffAccess } from "@/lib/access-control"
import { withStaffSourceReviewState } from "@/lib/data/provisional-source-review"
import { readMaRelationshipLedger } from "@/lib/data/ma-relationship-ledger"
import type { MaRelationshipActivityProvenance } from "@/lib/ma-relationship-activity-provenance"
import { isValidMaRelationshipEmail } from "@/lib/ma-relationship-validation"
import { buildMaRelationshipIndicators } from "@/lib/ma-relationship-statistics"
import { createAdminClient } from "@/lib/supabase/admin"
import type { OpportunityWithSource } from "@/lib/types/opportunity"

export type MaInteractionChannel =
  | "call"
  | "email"
  | "meeting"
  | "document"
  | "other"
export type MaInteractionDirection = "inbound" | "outbound"

export interface MaRelationshipOfficeContactOption {
  id: string
  affiliationId: string
  label: string
  email: string | null
  campaignEmailSuppressed: boolean
  campaignEmailSuppressionReason: string | null
}

export interface MaRelationshipContactFilterOption {
  id: string
  label: string
  email: string | null
  firstName: string | null
  lastName: string | null
  phone: string | null
  linkedinUrl: string | null
  internalNotes: string | null
  officeIds: string[]
  affiliations: Array<{
    id: string
    officeId: string
    officeLabel: string
    jobTitle: string | null
    isActive: boolean
  }>
  linkedOpportunities: Array<{
    id: string
    affiliationId: string
    label: string
    status: string
    isPrimary: boolean
  }>
  campaignEmailSuppressed: boolean
  campaignEmailSuppressionReason: string | null
}

export interface MaRelationshipOfficeOption {
  id: string
  firmId: string
  firmName: string
  firmStatus: "prospect" | "active" | "archived"
  status: "active" | "archived"
  officeName: string
  label: string
  contacts: MaRelationshipOfficeContactOption[]
  indicators: {
    activeContactCount: number
    sourcedOpportunityCount: number
    openOpportunityCount: number
    candidateStaleCount: number
    latestKnownAt: string | null
    latestKnownAtPrecision: "day" | "month" | null
  }
}

export interface MaRelationshipFirmOption {
  id: string
  name: string
  status: "prospect" | "active" | "archived"
  indicators: {
    officeCount: number
    activeContactCount: number
    sourcedOpportunityCount: number
    openOpportunityCount: number
    candidateStaleCount: number
    latestKnownAt: string | null
    latestKnownAtPrecision: "day" | "month" | null
  }
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
  contactId: string | null
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
  activityProvenance: MaRelationshipActivityProvenance
  providerIdempotencyKey: string | null
  providerMessageId: string | null
  deliveryFinalizedAt: string | null
  sentAt: string | null
  recipientEmail: string | null
  deliveryError: string | null
  ownerStaffUserId: string
  ownerVerificationState: "provisional" | "verified"
  ownerVerifiedAt: string | null
  createdAt: string
}

export interface MaRelationshipWorkspace {
  currentUserId: string
  firms: MaRelationshipFirmOption[]
  offices: MaRelationshipOfficeOption[]
  contacts: MaRelationshipContactFilterOption[]
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
  status: "active" | "archived"
  firm?: Relation<{
    id: string
    name: string
    status: "prospect" | "active" | "archived"
  }>
}

interface OpportunityContactRow {
  opportunity_id: string
  affiliation_id: string
  is_primary: boolean
}

function one<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
}

function optionalString(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function listMaRelationshipTimeline(options?: {
  officeId?: string | null
  affiliationId?: string | null
  opportunityId?: string | null
  limit?: number
}): Promise<MaRelationshipTimelineItem[]> {
  await requireStaffAccess()
  const ledger = await readMaRelationshipLedger({
    purpose: "timeline",
    officeId: options?.officeId,
    affiliationId: options?.affiliationId,
    opportunityId: options?.opportunityId,
    interactionLimit: options?.limit ?? 250,
  })
  return ledger.activities
}

export async function getMaRelationshipWorkspace(): Promise<MaRelationshipWorkspace> {
  const { user } = await requireStaffAccess()
  const supabase = createAdminClient()
  const officeResult = await supabase
    .from("ma_offices")
    .select("id, name, status, firm:ma_firms(id, name, status)")
    .order("name")

  if (officeResult.error) throw new Error(officeResult.error.message)
  const officeRows = (officeResult.data ?? []) as unknown as OfficeRow[]
  const ledger = await readMaRelationshipLedger({
    purpose: "global",
    officeIds: officeRows.map((office) => office.id),
  })
  const officeFirmIds = new Map(
    officeRows.flatMap((office) => {
      const firm = one(office.firm)
      return firm ? [[office.id, firm.id] as const] : []
    }),
  )
  const statistics = buildMaRelationshipIndicators(
    officeRows.map((office) => ({
      id: office.id,
      firmId: officeFirmIds.get(office.id) ?? null,
    })),
    ledger.affiliations.map((affiliation) => ({
      officeId: affiliation.officeId,
      contactId: affiliation.contactId,
      isActive: affiliation.isActive,
      endedAt: affiliation.endedAt,
      contactStatus: affiliation.contactStatus,
    })),
    ledger.opportunities.map((opportunity) => ({
      id: opportunity.id,
      officeId: opportunity.officeId,
      status: opportunity.status,
      dateAdded: opportunity.dateAdded,
      dateAddedPrecision: opportunity.dateAddedPrecision,
    })),
    ledger.activePursuitOpportunityIds,
  )
  const opportunityContactResult = await supabase
    .from("opportunity_ma_contacts")
    .select("opportunity_id, affiliation_id, is_primary")
    .eq("is_active", true)

  if (opportunityContactResult.error)
    throw new Error(opportunityContactResult.error.message)
  const activeOpportunityContactRows = (opportunityContactResult.data ??
    []) as OpportunityContactRow[]
  const ledgerOpportunityById = new Map(
    ledger.opportunities.map((opportunity) => [opportunity.id, opportunity]),
  )

  const contactsByOffice = new Map<
    string,
    MaRelationshipOfficeContactOption[]
  >()
  const contactsById = new Map<string, MaRelationshipContactFilterOption>()
  for (const relation of ledger.affiliations) {
    if (
      !relation.isActive ||
      relation.endedAt ||
      relation.contactStatus !== "active"
    )
      continue
    const contacts = contactsByOffice.get(relation.officeId) ?? []
    contacts.push({
      id: relation.contactId,
      affiliationId: relation.id,
      label: relation.contactLabel,
      email: relation.contactEmail,
      campaignEmailSuppressed: relation.campaignEmailSuppressed,
      campaignEmailSuppressionReason: relation.campaignEmailSuppressionReason,
    })
    contactsByOffice.set(relation.officeId, contacts)
    const existing = contactsById.get(relation.contactId)
    contactsById.set(relation.contactId, {
      id: relation.contactId,
      label: relation.contactLabel,
      email: relation.contactEmail,
      firstName: relation.contactFirstName,
      lastName: relation.contactLastName,
      phone: relation.contactPhone,
      linkedinUrl: relation.contactLinkedinUrl,
      internalNotes: relation.contactInternalNotes,
      officeIds: existing
        ? [...new Set([...existing.officeIds, relation.officeId])]
        : [relation.officeId],
      affiliations: [
        ...(existing?.affiliations ?? []),
        {
          id: relation.id,
          officeId: relation.officeId,
          officeLabel: "",
          jobTitle: relation.jobTitle,
          isActive: relation.isActive && !relation.endedAt,
        },
      ],
      linkedOpportunities: existing?.linkedOpportunities ?? [],
      campaignEmailSuppressed: relation.campaignEmailSuppressed,
      campaignEmailSuppressionReason: relation.campaignEmailSuppressionReason,
    })
  }

  const contactIdByAffiliationId = new Map(
    ledger.affiliations.map((affiliation) => [
      affiliation.id,
      affiliation.contactId,
    ]),
  )
  for (const link of activeOpportunityContactRows) {
    const contactId = contactIdByAffiliationId.get(link.affiliation_id)
    const contact = contactId ? contactsById.get(contactId) : null
    const opportunity = ledgerOpportunityById.get(link.opportunity_id)
    if (!contact || !opportunity) continue
    contact.linkedOpportunities.push({
      id: opportunity.id,
      affiliationId: link.affiliation_id,
      label: opportunity.label,
      status: opportunity.status,
      isPrimary: link.is_primary,
    })
  }

  const offices = officeRows
    .map((office) => {
      const firm = one(office.firm)
      const firmId = firm?.id ?? `unknown-firm:${office.id}`
      return {
        id: office.id,
        firmId,
        firmName: firm?.name ?? "Unknown firm",
        firmStatus: firm?.status ?? "archived",
        status: office.status,
        officeName: office.name,
        label: [firm?.name, office.name].filter(Boolean).join(" · "),
        contacts: (contactsByOffice.get(office.id) ?? []).sort((left, right) =>
          left.label.localeCompare(right.label),
        ),
        indicators: statistics.byOfficeId.get(office.id) ?? {
          activeContactCount: 0,
          sourcedOpportunityCount: 0,
          openOpportunityCount: 0,
          candidateStaleCount: 0,
          latestKnownAt: null,
          latestKnownAtPrecision: null,
        },
      }
    })
    .sort((left, right) => left.label.localeCompare(right.label))

  const firms = [
    ...new Map(
      officeRows.flatMap((office) => {
        const firm = one(office.firm)
        return firm ? [[firm.id, firm] as const] : []
      }),
    ),
  ]
    .map(([id, firm]) => ({
      id,
      name: firm.name,
      status: firm.status,
      indicators: statistics.byFirmId.get(id) ?? {
        officeCount: offices.filter((office) => office.firmId === id).length,
        activeContactCount: 0,
        sourcedOpportunityCount: 0,
        openOpportunityCount: 0,
        candidateStaleCount: 0,
        latestKnownAt: null,
        latestKnownAtPrecision: null,
      },
    }))
    .sort((left, right) => left.name.localeCompare(right.name))

  const opportunitiesWithReview = await withStaffSourceReviewState(
    supabase,
    ledger.opportunities.map((opportunity) => ({
      id: opportunity.id,
      source_office_id: opportunity.officeId,
      status: opportunity.status,
    })) as OpportunityWithSource[],
  )
  const opportunities = opportunitiesWithReview
    .filter((opportunity) => Boolean(opportunity.source_office_id))
    .filter((opportunity) => !opportunity.source_review_required)
    .map((opportunity) => ({
      id: opportunity.id,
      officeId: opportunity.source_office_id!,
      label: ledgerOpportunityById.get(opportunity.id)?.label ?? "",
      status: opportunity.status,
    }))

  const officeLabels = new Map(
    offices.map((office) => [office.id, office.label]),
  )
  const contacts = [...contactsById.values()]
    .map((contact) => ({
      ...contact,
      affiliations: contact.affiliations.map((affiliation) => ({
        ...affiliation,
        officeLabel: officeLabels.get(affiliation.officeId) ?? "Unknown office",
      })),
      linkedOpportunities: [...contact.linkedOpportunities].sort(
        (left, right) => left.label.localeCompare(right.label),
      ),
    }))
    .sort((left, right) => left.label.localeCompare(right.label))

  return {
    currentUserId: user.id,
    firms,
    offices,
    contacts,
    opportunities,
    interactions: ledger.activities,
  }
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
      "ma_provisional_source_review_blocks_relationship_interaction",
    )
  ) {
    return "Resolve this opportunity's source review before linking permanent relationship history."
  }
  if (
    message.includes(
      "ma_relationship_interaction_outbound_email_requires_valid_recipient",
    )
  ) {
    return "Enter a valid recipient email address for an outbound email record."
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
  if (
    input.channel === "email" &&
    input.direction === "outbound" &&
    !isValidMaRelationshipEmail(
      optionalString(input.recipientEmailSnapshot ?? null) ?? "",
    )
  ) {
    return {
      success: false,
      message:
        "Enter a valid recipient email address for an outbound email record.",
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
