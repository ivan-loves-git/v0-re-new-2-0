"use server"

import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import type { OpportunityStatus } from "@/lib/types/opportunity"

const STALE_OPPORTUNITY_DAYS = 90

const OPEN_OPPORTUNITY_STATUSES: OpportunityStatus[] = ["active", "paused", "draft"]

export interface OpportunityFreshnessReminder {
  id: string
  reference: string
  publicTitle: string | null
  sourceLabel: string | null
  location: string | null
  sector: string | null
  status: OpportunityStatus
  dateAdded: string | null
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
  location: string | null
  sector: string | null
  status: OpportunityStatus
  date_added: string | null
  created_at: string
}

function parseDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function daysSince(date: Date, now: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86_400_000))
}

function formatExactDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(date)
}

export async function getOpportunityFreshnessData(): Promise<OpportunityFreshnessData> {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const [opportunitiesResult, activePursuitsResult] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, reference, public_title, source_label, location, sector, status, date_added, created_at")
      .in("status", OPEN_OPPORTUNITY_STATUSES)
      .order("date_added", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("opportunity_matches")
      .select("opportunity_id")
      .eq("status", "active_pursuit"),
  ])

  if (opportunitiesResult.error) throw new Error(opportunitiesResult.error.message)
  if (activePursuitsResult.error) throw new Error(activePursuitsResult.error.message)

  const now = new Date()
  const activePursuitOpportunityIds = new Set(
    (activePursuitsResult.data ?? [])
      .map((match) => match.opportunity_id)
      .filter((id): id is string => Boolean(id))
  )

  const rows = (opportunitiesResult.data ?? []) as OpportunityFreshnessRow[]
  const reminders = rows
    .map((opportunity) => {
      const date = parseDate(opportunity.date_added)
      const daysOpen = date ? daysSince(date, now) : null

      return {
        id: opportunity.id,
        reference: opportunity.reference,
        publicTitle: opportunity.public_title,
        sourceLabel: opportunity.source_label,
        location: opportunity.location,
        sector: opportunity.sector,
        status: opportunity.status,
        dateAdded: opportunity.date_added,
        exactDateAdded: date ? formatExactDate(date) : null,
        monthAdded: date ? formatMonth(date) : null,
        daysOpen,
      }
    })
    .filter((opportunity) => {
      if (opportunity.daysOpen === null) return false
      if (opportunity.daysOpen < STALE_OPPORTUNITY_DAYS) return false
      return !activePursuitOpportunityIds.has(opportunity.id)
    })
    .sort((a, b) => (b.daysOpen ?? 0) - (a.daysOpen ?? 0))

  const datedOpenDays = rows
    .map((opportunity) => parseDate(opportunity.date_added))
    .filter((date): date is Date => Boolean(date))
    .map((date) => daysSince(date, now))

  return {
    staleThresholdDays: STALE_OPPORTUNITY_DAYS,
    staleTotal: reminders.length,
    staleOpportunities: reminders.slice(0, 12),
    openWithoutDate: rows.filter((opportunity) => !parseDate(opportunity.date_added)).length,
    oldestOpenDays: datedOpenDays.length > 0 ? Math.max(...datedOpenDays) : null,
  }
}
