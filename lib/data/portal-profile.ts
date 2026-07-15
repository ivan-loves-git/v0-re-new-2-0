import type { MilestoneKey } from "@/lib/types/repreneur"

export const PORTAL_MILESTONE_COLUMNS = [
  "ms_decision_to_pursue",
  "ms_availability_confirmed",
  "ms_target_profile_sheet",
  "ms_pitch_plan",
  "ms_equity_range",
  "ms_deal_breakers",
  "ms_leadership_assessment_passed",
  "ms_advisory_team_identified",
  "ms_intermediary_meeting",
  "ms_seller_meeting",
  "ms_loi_issued",
  "ms_due_diligence",
  "ms_negotiation",
  "ms_financing_validated",
  "ms_closing",
  "ms_plan_100_days",
  "ms_plan_3_years",
] as const

type PortalMilestoneColumn = (typeof PORTAL_MILESTONE_COLUMNS)[number]

export type PortalRepreneurProfile = {
  id: string
  first_name: string
  last_name: string
  q13_target_sectors_v2: string[]
  sector_preferences: string[]
  q12_geo_zones: string[]
  target_location: string[]
  q14_deal_size: string[]
  target_acquisition_size: string | null
  q16_equity: string | null
  q14_investment_capacity: string | null
  investment_capacity: string | null
  target_revenue_min_meur: number | null
  target_revenue_max_meur: number | null
  target_ebitda_margin_min_pct: number | null
  target_staff_size_min: number | null
  target_staff_size_max: number | null
} & Partial<Record<PortalMilestoneColumn | `ms_${MilestoneKey}`, boolean>>

export const PORTAL_REPRENEUR_PROFILE_SELECT = [
  "id",
  "first_name",
  "last_name",
  "q13_target_sectors_v2",
  "sector_preferences",
  "q12_geo_zones",
  "target_location",
  "q14_deal_size",
  "target_acquisition_size",
  "q16_equity",
  "q14_investment_capacity",
  "investment_capacity",
  "target_revenue_min_meur",
  "target_revenue_max_meur",
  "target_ebitda_margin_min_pct",
  "target_staff_size_min",
  "target_staff_size_max",
  ...PORTAL_MILESTONE_COLUMNS,
].join(", ")

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim())
    : []
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

export function normalizePortalRepreneurProfile(row: unknown): PortalRepreneurProfile | null {
  if (!isRecord(row)) return null

  const id = readString(row.id)
  if (!id) return null

  const milestones = Object.fromEntries(
    PORTAL_MILESTONE_COLUMNS.map((column) => [column, row[column] === true])
  ) as Partial<Record<PortalMilestoneColumn, boolean>>

  return {
    id,
    first_name: readString(row.first_name) ?? "",
    last_name: readString(row.last_name) ?? "",
    q13_target_sectors_v2: readStringArray(row.q13_target_sectors_v2),
    sector_preferences: readStringArray(row.sector_preferences),
    q12_geo_zones: readStringArray(row.q12_geo_zones),
    target_location: readStringArray(row.target_location),
    q14_deal_size: readStringArray(row.q14_deal_size),
    target_acquisition_size: readString(row.target_acquisition_size),
    q16_equity: readString(row.q16_equity),
    q14_investment_capacity: readString(row.q14_investment_capacity),
    investment_capacity: readString(row.investment_capacity),
    target_revenue_min_meur: readNumber(row.target_revenue_min_meur),
    target_revenue_max_meur: readNumber(row.target_revenue_max_meur),
    target_ebitda_margin_min_pct: readNumber(row.target_ebitda_margin_min_pct),
    target_staff_size_min: readNumber(row.target_staff_size_min),
    target_staff_size_max: readNumber(row.target_staff_size_max),
    ...milestones,
  }
}
