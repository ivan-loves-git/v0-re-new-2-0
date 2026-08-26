"use server"

import { requireStaffAccess } from "@/lib/access-control"
import {
  CANDIDATE_STALE_OPPORTUNITY_STATUSES,
  STALE_OPPORTUNITY_DAYS,
  isCandidateStaleOpportunity,
  opportunityDaysOpen,
  parseOpportunityDate,
} from "@/lib/opportunity-freshness-policy"
import { createAdminClient } from "@/lib/supabase/admin"
import type { OpportunityStatus } from "@/lib/types/opportunity"
import { formatOpportunitySourceDate } from "@/lib/utils/opportunity-source-date"

export interface OpportunityFreshnessReminder {
  id: string
  reference: string
  publicTitle: string | null
  sourceContextLabel: string | null
  location: string | null
  sector: string | null
  status: OpportunityStatus
  dateAdded: string | null
  dateAddedPrecision: "day" | "month" | null
  exactDateAdded: string | null
  monthAdded: string | null
  daysOpen: number | null
}

export interface OpportunityFreshnessData {
  staleThresholdDays: number
  staleTotal: number
  staleOpportunities: OpportunityFreshnessReminder[]
  openWithoutDate: number
  oldestOpenDays: number | null
}

interface OpportunityFreshnessRow {
  id: string
  reference: string
  public_title: string | null
  source_label: string | null
  source_office:
    | {
        name: string | null
        firm: { name: string | null } | Array<{ name: string | null }> | null
      }
    | Array<{
        name: string | null
        firm: { name: string | null } | Array<{ name: string | null }> | null
      }>
    | null
  location: string | null
  sector: string | null
  status: OpportunityStatus
  is_demo: boolean
  date_added: string | null
  date_added_precision: "day" | "month" | null
  created_at: string
}

function formatExactDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
}

function nonEmpty(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed || null
}

function sourceContextLabel(opportunity: OpportunityFreshnessRow) {
  const office = firstRelation(opportunity.source_office)
  const firm = firstRelation(office?.firm)
  const firmName = nonEmpty(firm?.name)
  const officeName = nonEmpty(office?.name)

  if (firmName && officeName && firmName !== officeName) {
    return `${firmName} · ${officeName}`
  }

  return firmName ?? officeName ?? nonEmpty(opportunity.source_label)
}

export async function getOpportunityFreshnessData(): Promise<OpportunityFreshnessData> {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const [opportunitiesResult, activePursuitsResult] = await Promise.all([
    supabase
      .from("opportunities")
      .select(
        "id, reference, public_title, source_label, location, sector, status, is_demo, date_added, date_added_precision, created_at, source_office:ma_offices(name, firm:ma_firms(name))",
      )
      .in("status", [...CANDIDATE_STALE_OPPORTUNITY_STATUSES])
      .eq("is_demo", false)
      .order("date_added", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("opportunity_matches")
      .select("opportunity_id, repreneur:repreneurs!inner(is_demo)")
      .eq("status", "active_pursuit"),
  ])

  if (opportunitiesResult.error)
    throw new Error(opportunitiesResult.error.message)
  if (activePursuitsResult.error)
    throw new Error(activePursuitsResult.error.message)

  const now = new Date()
  const activePursuitOpportunityIds = new Set(
    (activePursuitsResult.data ?? [])
      .filter((match) => {
        const repreneur = Array.isArray(match.repreneur)
          ? match.repreneur[0]
          : match.repreneur
        return !repreneur?.is_demo
      })
      .map((match) => match.opportunity_id)
      .filter((id): id is string => Boolean(id)),
  )

  const rows = (opportunitiesResult.data ?? []) as OpportunityFreshnessRow[]
  const reminders = rows
    .map((opportunity) => {
      const date = parseOpportunityDate(
        opportunity.date_added,
        opportunity.date_added_precision,
      )
      const daysOpen = opportunityDaysOpen(
        opportunity.date_added,
        now,
        opportunity.date_added_precision,
      )

      return {
        id: opportunity.id,
        reference: opportunity.reference,
        publicTitle: opportunity.public_title,
        sourceContextLabel: sourceContextLabel(opportunity),
        location: opportunity.location,
        sector: opportunity.sector,
        status: opportunity.status,
        dateAdded: opportunity.date_added,
        dateAddedPrecision: opportunity.date_added_precision,
        exactDateAdded:
          date && opportunity.date_added_precision !== "month"
            ? formatExactDate(date)
            : null,
        monthAdded: opportunity.date_added
          ? formatOpportunitySourceDate(
              opportunity.date_added,
              "month",
              { fallback: "" },
            )
          : null,
        daysOpen,
      }
    })
    .filter((opportunity) =>
      isCandidateStaleOpportunity(
        {
          id: opportunity.id,
          status: opportunity.status,
          dateAdded: opportunity.dateAdded,
          dateAddedPrecision: opportunity.dateAddedPrecision,
        },
        activePursuitOpportunityIds,
        now,
      ),
    )
    .sort((a, b) => (b.daysOpen ?? 0) - (a.daysOpen ?? 0))

  const datedOpenDays = rows
    .map((opportunity) =>
      opportunityDaysOpen(
        opportunity.date_added,
        now,
        opportunity.date_added_precision,
      ),
    )
    .filter((daysOpen): daysOpen is number => daysOpen !== null)

  return {
    staleThresholdDays: STALE_OPPORTUNITY_DAYS,
    staleTotal: reminders.length,
    staleOpportunities: reminders.slice(0, 12),
    openWithoutDate: rows.filter(
      (opportunity) =>
        !opportunity.date_added ||
        Number.isNaN(new Date(`${opportunity.date_added.slice(0, 10)}T00:00:00Z`).getTime()),
    ).length,
    oldestOpenDays:
      datedOpenDays.length > 0 ? Math.max(...datedOpenDays) : null,
  }
}
