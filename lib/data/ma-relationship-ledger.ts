import "server-only"

import {
  activityProvenance,
  type MaRelationshipActivityProvenance,
} from "@/lib/ma-relationship-activity-provenance"
import { createAdminClient } from "@/lib/supabase/admin"
import type { OpportunityStatus } from "@/lib/types/opportunity"

export type Relation<T> = T | T[] | null | undefined

export function oneMaRelationshipRecord<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
}

export interface MaRelationshipLedgerAffiliation {
  id: string
  officeId: string
  contactId: string
  contactLabel: string
  contactEmail: string | null
  contactStatus: "active" | "archived"
  campaignEmailSuppressed: boolean
  campaignEmailSuppressionReason: string | null
  jobTitle: string | null
  isActive: boolean
  endedAt: string | null
}

export interface MaRelationshipLedgerOpportunity {
  id: string
  officeId: string
  reference: string
  label: string
  status: OpportunityStatus
  dateAdded: string | null
  dateAddedPrecision: "day" | "month" | null
}

export interface MaRelationshipLedgerActivity {
  id: string
  officeId: string
  officeLabel: string
  affiliationId: string | null
  contactId: string | null
  contactLabel: string | null
  contactEmail: string | null
  opportunityId: string | null
  opportunityLabel: string | null
  channel: "call" | "email" | "meeting" | "document" | "other"
  direction: "inbound" | "outbound" | null
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

export interface MaRelationshipLedger {
  affiliations: MaRelationshipLedgerAffiliation[]
  opportunities: MaRelationshipLedgerOpportunity[]
  activities: MaRelationshipLedgerActivity[]
  affiliationsByOffice: Map<string, MaRelationshipLedgerAffiliation[]>
  opportunitiesByOffice: Map<string, MaRelationshipLedgerOpportunity[]>
  activitiesByOffice: Map<string, MaRelationshipLedgerActivity[]>
  activePursuitOpportunityIds: Set<string>
}

interface OfficeRelationRow {
  id: string
  name: string
  firm?: Relation<{ name: string }>
}

interface ContactRelationRow {
  id: string
  display_name: string | null
  email: string | null
  status: "active" | "archived"
  campaign_email_suppressed?: boolean | null
  campaign_email_suppression_reason?: string | null
}

interface AffiliationRow {
  id: string
  office_id: string
  job_title: string | null
  is_active: boolean
  ended_at: string | null
  contact?: Relation<ContactRelationRow>
}

interface OpportunityRow {
  id: string
  reference: string
  public_title: string | null
  activity: string | null
  source_office_id: string | null
  status: OpportunityStatus
  date_added: string | null
  date_added_precision: "day" | "month" | null
}

interface InteractionRow {
  id: string
  office_id: string
  affiliation_id?: string | null
  opportunity_id?: string | null
  channel: MaRelationshipLedgerActivity["channel"]
  direction?: MaRelationshipLedgerActivity["direction"]
  occurred_at: string
  title: string | null
  summary?: string | null
  outcome?: string | null
  next_action?: string | null
  next_action_due_at?: string | null
  delivery_status: MaRelationshipLedgerActivity["deliveryStatus"]
  provider_idempotency_key: string | null
  provider_message_id: string | null
  delivery_finalized_at: string | null
  sent_at: string | null
  recipient_email_snapshot?: string | null
  delivery_error?: string | null
  owner_staff_user_id?: string
  owner_verification_state?: MaRelationshipLedgerActivity["ownerVerificationState"]
  owner_verified_at?: string | null
  created_at?: string
  office?: Relation<OfficeRelationRow>
  affiliation?: Relation<AffiliationRow>
  opportunity?: Relation<OpportunityRow>
}

export function maRelationshipContactLabel(
  contact: Pick<ContactRelationRow, "display_name" | "email"> | null,
) {
  return contact?.display_name || contact?.email || "Unnamed contact"
}

export function maRelationshipOpportunityLabel(
  row: Pick<OpportunityRow, "reference" | "public_title" | "activity">,
) {
  return [row.reference, row.public_title ?? row.activity]
    .filter(Boolean)
    .join(" · ")
}

export function normalizeMaRelationshipActivity(
  row: InteractionRow,
): MaRelationshipLedgerActivity {
  const office = oneMaRelationshipRecord(row.office)
  const firm = oneMaRelationshipRecord(office?.firm)
  const affiliation = oneMaRelationshipRecord(row.affiliation)
  const contact = oneMaRelationshipRecord(affiliation?.contact)
  const opportunity = oneMaRelationshipRecord(row.opportunity)
  return {
    id: row.id,
    officeId: row.office_id,
    officeLabel:
      [firm?.name, office?.name].filter(Boolean).join(" · ") ||
      "Unknown office",
    affiliationId: row.affiliation_id ?? null,
    contactId: contact?.id ?? null,
    contactLabel: contact ? maRelationshipContactLabel(contact) : null,
    contactEmail: contact?.email ?? null,
    opportunityId: row.opportunity_id ?? null,
    opportunityLabel: opportunity
      ? maRelationshipOpportunityLabel(opportunity)
      : null,
    channel: row.channel,
    direction: row.direction ?? null,
    occurredAt: row.occurred_at,
    title: row.title,
    summary: row.summary ?? null,
    outcome: row.outcome ?? null,
    nextAction: row.next_action ?? null,
    nextActionDueAt: row.next_action_due_at ?? null,
    deliveryStatus: row.delivery_status,
    activityProvenance: activityProvenance({
      deliveryStatus: row.delivery_status,
      providerIdempotencyKey: row.provider_idempotency_key,
      providerMessageId: row.provider_message_id,
      deliveryFinalizedAt: row.delivery_finalized_at,
      sentAt: row.sent_at,
    }),
    providerIdempotencyKey: row.provider_idempotency_key,
    providerMessageId: row.provider_message_id,
    deliveryFinalizedAt: row.delivery_finalized_at,
    sentAt: row.sent_at,
    recipientEmail: row.recipient_email_snapshot ?? null,
    deliveryError: row.delivery_error ?? null,
    ownerStaffUserId: row.owner_staff_user_id ?? "",
    ownerVerificationState: row.owner_verification_state ?? "verified",
    ownerVerifiedAt: row.owner_verified_at ?? null,
    createdAt: row.created_at ?? row.occurred_at,
  }
}

export function compareMaRelationshipActivityDescending(
  left: Pick<MaRelationshipLedgerActivity, "occurredAt" | "id">,
  right: Pick<MaRelationshipLedgerActivity, "occurredAt" | "id">,
) {
  return (
    right.occurredAt.localeCompare(left.occurredAt) ||
    right.id.localeCompare(left.id)
  )
}

type MaRelationshipLedgerReadOptions =
  | {
      purpose: "global"
      officeIds: string[]
    }
  | {
      purpose: "detail"
      officeIds: string[]
    }
  | {
      purpose: "timeline"
      officeId?: string | null
      affiliationId?: string | null
      opportunityId?: string | null
      interactionLimit: number
    }

function emptyMaRelationshipLedger(
  activities: MaRelationshipLedgerActivity[] = [],
): MaRelationshipLedger {
  const activitiesByOffice = new Map<string, MaRelationshipLedgerActivity[]>()
  for (const activity of activities) {
    const officeActivities = activitiesByOffice.get(activity.officeId) ?? []
    officeActivities.push(activity)
    activitiesByOffice.set(activity.officeId, officeActivities)
  }
  return {
    affiliations: [],
    opportunities: [],
    activities,
    affiliationsByOffice: new Map(),
    opportunitiesByOffice: new Map(),
    activitiesByOffice,
    activePursuitOpportunityIds: new Set(),
  }
}

/**
 * The canonical staff-only read model for the office-owned M&A relationship
 * chain. It deliberately retains the concrete Supabase adapter: this seam is
 * between staff projections and one set-based ledger read, not a fake port.
 */
export async function readMaRelationshipLedger(
  options: MaRelationshipLedgerReadOptions,
): Promise<MaRelationshipLedger> {
  const purpose = options.purpose
  const officeIds = [
    ...new Set(
      purpose === "timeline"
        ? options.officeId
          ? [options.officeId]
          : []
        : options.officeIds,
    ),
  ]
  if (purpose !== "timeline" && !officeIds.length) {
    return emptyMaRelationshipLedger()
  }

  const supabase = createAdminClient()
  const activityColumns: string =
    purpose === "detail"
      ? `id, office_id, opportunity_id, channel, title, occurred_at, delivery_status,
         provider_idempotency_key, provider_message_id, delivery_finalized_at, sent_at,
         opportunity:opportunities(reference, public_title, activity)`
      : `id, office_id, affiliation_id, opportunity_id, channel, direction, occurred_at,
         title, summary, outcome, next_action, next_action_due_at, delivery_status,
         provider_idempotency_key, provider_message_id, delivery_finalized_at, sent_at,
         recipient_email_snapshot, delivery_error, owner_staff_user_id,
         owner_verification_state, owner_verified_at, created_at,
         office:ma_offices(id, name, firm:ma_firms(name)),
         affiliation:ma_contact_office_affiliations(id, office_id, contact:ma_contacts(id, display_name, email)),
         opportunity:opportunities(id, reference, public_title, activity)`
  let interactionsQuery = supabase
    .from("ma_interactions")
    .select(activityColumns)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
  if (officeIds.length)
    interactionsQuery = interactionsQuery.in("office_id", officeIds)
  if (purpose === "timeline" && options.affiliationId) {
    interactionsQuery = interactionsQuery.eq(
      "affiliation_id",
      options.affiliationId,
    )
  }
  if (purpose === "timeline" && options.opportunityId) {
    interactionsQuery = interactionsQuery.eq(
      "opportunity_id",
      options.opportunityId,
    )
  }
  const interactionLimit =
    purpose === "detail"
      ? null
      : purpose === "global"
        ? 250
        : options.interactionLimit
  if (interactionLimit !== null) {
    interactionsQuery = interactionsQuery.limit(interactionLimit)
  }

  if (purpose === "timeline") {
    const { data, error } = await interactionsQuery
    if (error) throw new Error(error.message)
    return emptyMaRelationshipLedger(
      ((data ?? []) as unknown as InteractionRow[]).map(
        normalizeMaRelationshipActivity,
      ),
    )
  }

  const opportunitiesQuery = supabase
    .from("opportunities")
    .select(
      "id, reference, public_title, activity, status, date_added, date_added_precision, source_office_id",
    )
    .in("source_office_id", officeIds)
  const [
    affiliationsResult,
    opportunitiesResult,
    interactionsResult,
    pursuitsResult,
  ] = await Promise.all([
    supabase
      .from("ma_contact_office_affiliations")
      .select(
        "id, office_id, job_title, is_active, ended_at, contact:ma_contacts(id, display_name, email, status, campaign_email_suppressed, campaign_email_suppression_reason)",
      )
      .in("office_id", officeIds)
      .order("is_active", { ascending: false }),
    purpose === "global"
      ? opportunitiesQuery.order("updated_at", { ascending: false })
      : opportunitiesQuery.order("date_added", {
          ascending: false,
          nullsFirst: false,
        }),
    interactionsQuery,
    supabase
      .from("opportunity_matches")
      .select(
        "opportunity_id, opportunity:opportunities!inner(source_office_id)",
      )
      .eq("status", "active_pursuit")
      .in("opportunity.source_office_id", officeIds),
  ])

  for (const result of [
    affiliationsResult,
    opportunitiesResult,
    interactionsResult,
    pursuitsResult,
  ]) {
    if (result.error) throw new Error(result.error.message)
  }

  const affiliationsByOffice = new Map<
    string,
    MaRelationshipLedgerAffiliation[]
  >()
  const affiliations: MaRelationshipLedgerAffiliation[] = []
  for (const row of (affiliationsResult.data ??
    []) as unknown as AffiliationRow[]) {
    const contact = oneMaRelationshipRecord(row.contact)
    if (!contact) continue
    const officeAffiliations = affiliationsByOffice.get(row.office_id) ?? []
    const affiliation = {
      id: row.id,
      officeId: row.office_id,
      contactId: contact.id,
      contactLabel: maRelationshipContactLabel(contact),
      contactEmail: contact.email,
      contactStatus: contact.status,
      campaignEmailSuppressed: Boolean(contact.campaign_email_suppressed),
      campaignEmailSuppressionReason:
        contact.campaign_email_suppression_reason ?? null,
      jobTitle: row.job_title,
      isActive: row.is_active,
      endedAt: row.ended_at,
    }
    affiliations.push(affiliation)
    officeAffiliations.push(affiliation)
    affiliationsByOffice.set(row.office_id, officeAffiliations)
  }

  const opportunitiesByOffice = new Map<
    string,
    MaRelationshipLedgerOpportunity[]
  >()
  const opportunities: MaRelationshipLedgerOpportunity[] = []
  for (const row of (opportunitiesResult.data ??
    []) as unknown as OpportunityRow[]) {
    if (!row.source_office_id) continue
    const officeOpportunities =
      opportunitiesByOffice.get(row.source_office_id) ?? []
    const opportunity = {
      id: row.id,
      officeId: row.source_office_id,
      reference: row.reference,
      label: maRelationshipOpportunityLabel(row),
      status: row.status,
      dateAdded: row.date_added,
      dateAddedPrecision: row.date_added_precision,
    }
    opportunities.push(opportunity)
    officeOpportunities.push(opportunity)
    opportunitiesByOffice.set(row.source_office_id, officeOpportunities)
  }

  const activitiesByOffice = new Map<string, MaRelationshipLedgerActivity[]>()
  const activities: MaRelationshipLedgerActivity[] = []
  for (const row of (interactionsResult.data ??
    []) as unknown as InteractionRow[]) {
    const activity = normalizeMaRelationshipActivity(row)
    activities.push(activity)
    const officeActivities = activitiesByOffice.get(activity.officeId) ?? []
    officeActivities.push(activity)
    activitiesByOffice.set(activity.officeId, officeActivities)
  }

  return {
    affiliations,
    opportunities,
    activities,
    affiliationsByOffice,
    opportunitiesByOffice,
    activitiesByOffice,
    activePursuitOpportunityIds: new Set(
      (pursuitsResult.data ?? [])
        .map((row) => row.opportunity_id)
        .filter((id): id is string => Boolean(id)),
    ),
  }
}
