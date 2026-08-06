import {
  getOpportunityStatusLabel,
  type OpportunityWorkSurfaceRecord,
} from "@/lib/types/opportunity"
import {
  deriveOpportunityJourney,
  getOpportunityJourneyLabel,
} from "@/lib/utils/opportunity-journey"

export const OPPORTUNITY_EXPORT_HEADERS = [
  "ref_mandat",
  "pipeline_status",
  "journey_stage",
  "date_added",
  "sector",
  "region",
  "revenue_eur_m",
  "ebitda_eur_k",
  "calculated_margin",
  "headcount",
  "anonymized_description",
  "source_firm_contact",
  "internal_notes",
  "tags",
] as const

export type OpportunityExportRow = Record<
  (typeof OPPORTUNITY_EXPORT_HEADERS)[number],
  string
>

function valueOrEmpty(value: string | number | null | undefined) {
  return value === null || value === undefined ? "" : String(value)
}

function sourceFirmAndContact(opportunity: OpportunityWorkSurfaceRecord) {
  const firm =
    opportunity.source_office?.firm?.name ??
    opportunity.source?.firm_name ??
    opportunity.source_label ??
    ""
  const primaryContact = opportunity.office_contacts?.find(
    (contact) => contact.is_active && contact.is_primary,
  )
  const contact =
    primaryContact?.contact_name_snapshot ??
    primaryContact?.affiliation?.contact?.display_name ??
    ""

  return [firm, contact].filter(Boolean).join(" · ")
}

function formatSourceDate(opportunity: OpportunityWorkSurfaceRecord) {
  if (!opportunity.date_added) return ""
  return opportunity.date_added_precision === "month"
    ? opportunity.date_added.slice(0, 7)
    : opportunity.date_added.slice(0, 10)
}

function formatMargin(
  revenueMeur: number | null | undefined,
  ebitdaKeur: number | null | undefined,
) {
  if (!revenueMeur || ebitdaKeur === null || ebitdaKeur === undefined) {
    return ""
  }
  const percent = (ebitdaKeur / (revenueMeur * 1000)) * 100
  return `${Number(percent.toFixed(2))}%`
}

export function toOpportunityExportRows(
  opportunities: OpportunityWorkSurfaceRecord[],
): OpportunityExportRow[] {
  return opportunities.map((opportunity) => ({
    ref_mandat: opportunity.reference,
    pipeline_status: getOpportunityStatusLabel(opportunity.status),
    journey_stage: getOpportunityJourneyLabel(deriveOpportunityJourney(opportunity)),
    date_added: formatSourceDate(opportunity),
    sector: valueOrEmpty(opportunity.sector),
    region: valueOrEmpty(opportunity.location),
    revenue_eur_m: valueOrEmpty(opportunity.revenue_meur),
    ebitda_eur_k: valueOrEmpty(opportunity.ebitda_keur),
    calculated_margin: formatMargin(opportunity.revenue_meur, opportunity.ebitda_keur),
    headcount: valueOrEmpty(opportunity.headcount ?? opportunity.headcount_range),
    anonymized_description: valueOrEmpty(opportunity.teaser_summary),
    source_firm_contact: sourceFirmAndContact(opportunity),
    internal_notes: valueOrEmpty(opportunity.internal_notes),
    // Tags are intentionally blank until an approved tags model exists.
    tags: "",
  }))
}

function escapeCsvCell(value: string) {
  // Spreadsheet applications treat leading formula characters as executable.
  const formulaSafeValue = /^\s*[=+\-@]/.test(value) ? `'${value}` : value
  return /[",\n\r]/.test(formulaSafeValue)
    ? `"${formulaSafeValue.replace(/"/g, '""')}"`
    : formulaSafeValue
}

export function opportunityExportRowsToCsv(rows: OpportunityExportRow[]) {
  return [
    OPPORTUNITY_EXPORT_HEADERS.join(","),
    ...rows.map((row) =>
      OPPORTUNITY_EXPORT_HEADERS.map((header) => escapeCsvCell(row[header])).join(","),
    ),
  ].join("\n")
}
