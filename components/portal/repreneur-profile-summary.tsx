import Link from "next/link"
import { ArrowRight, CheckCircle2, Target } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  RepreneurProfileContributions,
  RepreneurTargetThesisEditor,
} from "@/components/portal/repreneur-target-thesis-editor"
import { WaveMicroLabel } from "@/components/wave/visual-foundations"
import { MILESTONES } from "@/lib/constants/tier-config"
import type { PortalRepreneurProfile } from "@/lib/data/portal-profile"
import type { RepreneurOpportunityExposure } from "@/lib/types/opportunity"
import { getEbitdaMarginPercentage } from "@/lib/utils/repreneur-deal-discovery"
import { displayRepreneurOpportunityGeography } from "@/lib/utils/repreneur-opportunity-geography"

interface RepreneurProfileSummaryProps {
  repreneur: PortalRepreneurProfile | null
  opportunities: RepreneurOpportunityExposure[]
  dealsHref?: string
  detailHrefForOpportunity?: (opportunity: RepreneurOpportunityExposure) => string
}

const SECTOR_LABELS: Record<string, string> = {
  all: "All sectors",
  retail: "Retail & distribution",
  industry: "Industry",
  services: "Services",
  construction: "Construction",
  healthcare: "Healthcare",
  tech: "Tech & digital",
  environment: "Environment",
  hospitality: "Hospitality & restaurants",
  transport: "Transport & logistics",
  other: "Other",
}

const GEOGRAPHY_LABELS: Record<string, string> = {
  "all-france": "All France",
  "auvergne-rhone-alpes": "Auvergne-Rhône-Alpes",
  "bourgogne-franche-comte": "Bourgogne-Franche-Comté",
  bretagne: "Brittany",
  "centre-val-de-loire": "Centre-Val de Loire",
  corse: "Corsica",
  "dom-tom": "French overseas territories",
  "grand-est": "Grand Est",
  "hauts-de-france": "Hauts-de-France",
  "ile-de-france": "Île-de-France",
  normandie: "Normandy",
  "nouvelle-aquitaine": "Nouvelle-Aquitaine",
  occitanie: "Occitanie",
  "pays-de-la-loire": "Pays de la Loire",
  paca: "Provence-Alpes-Côte d’Azur",
}

const DEAL_SIZE_LABELS: Record<string, string> = {
  "1-3M": "€1–3M",
  "3-5M": "€3–5M",
  ">5M": "Over €5M",
}

const EQUITY_LABELS: Record<string, string> = {
  tbd: "Under €150K",
  "151-250": "€151–250K",
  "251-350": "€251–350K",
  "351-450": "€351–450K",
  ">450": "Over €450K",
}

function displayValue(value: string | null | undefined, labels: Record<string, string> = {}) {
  if (!value) return "To refine"
  return labels[value] ?? value
}

function combineValues(values: string[], labels: Record<string, string>) {
  const displayValues = values.map((value) => displayValue(value, labels)).filter((value) => value !== "To refine")
  return displayValues.length > 0 ? Array.from(new Set(displayValues)).join(", ") : "To refine"
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value)
}

function formatRange(minimum: number | null, maximum: number | null, suffix: string) {
  if (minimum === null && maximum === null) return "To refine"
  if (minimum === null) return `Up to ${formatNumber(maximum!)} ${suffix}`
  if (maximum === null) return `From ${formatNumber(minimum)} ${suffix}`
  return `${formatNumber(minimum)}–${formatNumber(maximum)} ${suffix}`
}

function thesisFields(repreneur: PortalRepreneurProfile) {
  const investmentCapacity = repreneur.q16_equity ?? repreneur.q14_investment_capacity ?? repreneur.investment_capacity
  const dealSize = combineValues(repreneur.q14_deal_size, DEAL_SIZE_LABELS)

  return [
    { label: "Sectors", value: combineValues([...repreneur.q13_target_sectors_v2, ...repreneur.sector_preferences], SECTOR_LABELS) },
    { label: "Geography", value: combineValues([...repreneur.q12_geo_zones, ...repreneur.target_location], GEOGRAPHY_LABELS) },
    { label: "Deal size", value: dealSize !== "To refine" ? dealSize : displayValue(repreneur.target_acquisition_size) },
    { label: "Investment capacity", value: displayValue(investmentCapacity, EQUITY_LABELS) },
    { label: "Revenue range", value: formatRange(repreneur.target_revenue_min_meur, repreneur.target_revenue_max_meur, "M EUR") },
    { label: "Minimum EBITDA margin", value: repreneur.target_ebitda_margin_min_pct === null ? "To refine" : `${formatNumber(repreneur.target_ebitda_margin_min_pct)}%` },
    { label: "Staff-size range", value: formatRange(repreneur.target_staff_size_min, repreneur.target_staff_size_max, "people") },
  ]
}

function opportunityTitle(opportunity: RepreneurOpportunityExposure) {
  return opportunity.public_title || opportunity.sector || "Opportunity"
}

function formatOpportunityMetric(value: number | null | undefined, suffix: string) {
  if (value === null || value === undefined) return "—"
  return `${formatNumber(value)} ${suffix}`
}

function formatOpportunityMargin(opportunity: RepreneurOpportunityExposure) {
  const margin = getEbitdaMarginPercentage(opportunity)
  return margin === null ? "—" : `${formatNumber(margin)}%`
}

function DealGroup({
  title,
  description,
  opportunities,
  emptyMessage,
  detailHrefForOpportunity,
}: {
  title: string
  description: string
  opportunities: RepreneurOpportunityExposure[]
  emptyMessage: string
  detailHrefForOpportunity: (opportunity: RepreneurOpportunityExposure) => string
}) {
  return (
    <section aria-labelledby={`${title.toLowerCase().replaceAll(" ", "-")}-heading`} className="flex flex-col gap-3">
      <div>
        <h3 id={`${title.toLowerCase().replaceAll(" ", "-")}-heading`} className="font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {opportunities.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="divide-y border-y">
          {opportunities.map((opportunity) => {
            const title = opportunityTitle(opportunity)

            return (
              <li key={opportunity.match_id} className="flex flex-col gap-4 py-4 text-sm">
                <div className="flex flex-col gap-2">
                  <h4 className="font-medium">{title}</h4>
                  <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex flex-col gap-1">
                      <WaveMicroLabel asChild><dt>Re-New ref</dt></WaveMicroLabel>
                      <dd className="font-mono text-foreground">{opportunity.reference}</dd>
                    </div>
                    <div className="flex flex-col gap-1">
                      <WaveMicroLabel asChild><dt>Geography</dt></WaveMicroLabel>
                      <dd className="text-foreground">{displayRepreneurOpportunityGeography(opportunity.location)}</dd>
                    </div>
                    <div className="flex flex-col gap-1">
                      <WaveMicroLabel asChild><dt>Sector</dt></WaveMicroLabel>
                      <dd className="text-foreground">{opportunity.sector ?? opportunity.activity ?? "Sector to confirm"}</dd>
                    </div>
                    <div className="flex flex-col gap-1">
                      <WaveMicroLabel asChild><dt>Date added</dt></WaveMicroLabel>
                      <dd className="text-foreground">{opportunity.date_added_display ?? "-"}</dd>
                    </div>
                  </dl>
                  <p className="line-clamp-2 text-muted-foreground">
                    {opportunity.teaser_summary || "Anonymized opportunity details are being prepared."}
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="flex flex-col gap-1">
                    <WaveMicroLabel asChild><dt>Revenue</dt></WaveMicroLabel>
                    <dd className="font-medium">{formatOpportunityMetric(opportunity.revenue_meur, "M EUR")}</dd>
                  </div>
                  <div className="flex flex-col gap-1">
                    <WaveMicroLabel asChild><dt>EBITDA</dt></WaveMicroLabel>
                    <dd className="font-medium">{formatOpportunityMetric(opportunity.ebitda_keur, "K EUR")}</dd>
                  </div>
                  <div className="flex flex-col gap-1">
                    <WaveMicroLabel asChild><dt>EBITDA margin</dt></WaveMicroLabel>
                    <dd className="font-medium">{formatOpportunityMargin(opportunity)}</dd>
                  </div>
                  <div className="flex flex-col gap-1">
                    <WaveMicroLabel asChild><dt>Employees</dt></WaveMicroLabel>
                    <dd className="font-medium">{opportunity.headcount_range ?? opportunity.headcount ?? "—"}</dd>
                  </div>
                </dl>
                <Link
                  href={detailHrefForOpportunity(opportunity)}
                  className="inline-flex w-fit items-center gap-1 font-medium text-primary hover:underline"
                  aria-label={`View details for ${title}`}
                >
                  View detail
                  <ArrowRight className="size-4" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function RepreneurProfileSummary({
  repreneur,
  opportunities,
  dealsHref = "/portal/deals",
  detailHrefForOpportunity,
}: RepreneurProfileSummaryProps) {
  if (!repreneur) {
    return (
      <Alert>
        <Target />
        <AlertTitle>No linked repreneur profile</AlertTitle>
        <AlertDescription>
          This login is not connected to a repreneur profile yet. Ask the Re-New team to link your email before using the portal.
        </AlertDescription>
      </Alert>
    )
  }

  const completedMilestones = MILESTONES.filter(
    (milestone) => repreneur[`ms_${milestone.key}`] === true
  )
  const proposedDeals = opportunities.filter((opportunity) => opportunity.match_status === "proposed")
  const pursuedDeals = opportunities.filter((opportunity) => opportunity.match_status === "active_pursuit")
  const opportunityDetailHref = (opportunity: RepreneurOpportunityExposure) =>
    detailHrefForOpportunity?.(opportunity) ?? `/portal/deals/${opportunity.match_id}`

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm text-muted-foreground">Your Re-New profile</p>
        <h1 className="text-2xl font-semibold tracking-normal">{repreneur.first_name} {repreneur.last_name}</h1>
      </header>

      <Card id="target-thesis">
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <Target data-icon="inline-start" />
            Target thesis
          </CardTitle>
          <CardDescription>Keep the acquisition criteria Re-New uses to surface relevant opportunities current.</CardDescription>
          <CardAction>
            <RepreneurTargetThesisEditor repreneur={repreneur} />
          </CardAction>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
            {thesisFields(repreneur).map((field) => (
              <div key={field.label} className="flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">{field.label}</dt>
                <dd className="text-sm font-medium">{field.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your supporting items</CardTitle>
          <CardDescription>
            Add or certify information for Re-New to review. These declarations never change readiness milestones.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RepreneurProfileContributions repreneur={repreneur} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Readiness milestones</CardTitle>
          <CardDescription>Managed and updated by Re-New. This view is read-only.</CardDescription>
        </CardHeader>
        <CardContent>
          {completedMilestones.length === 0 ? (
            <p className="text-sm text-muted-foreground">No readiness milestones have been marked complete yet.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {completedMilestones.map((milestone) => (
                <div key={milestone.key} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <CheckCircle2 className="text-primary" />
                  <span>{milestone.label}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your deals</CardTitle>
          <CardDescription>Opportunities Re-New has made available to you.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <DealGroup
            title="Proposed deals"
            description="Available for your review in the Deals area."
            opportunities={proposedDeals}
            emptyMessage="No proposed deals are available at the moment."
            detailHrefForOpportunity={opportunityDetailHref}
          />
          <DealGroup
            title="Pursued deals"
            description="Validated by Re-New as active pursuits."
            opportunities={pursuedDeals}
            emptyMessage="No active pursuits are recorded at the moment."
            detailHrefForOpportunity={opportunityDetailHref}
          />
          <Link href={dealsHref} className="w-fit text-sm font-medium text-primary hover:underline">
            Open all deals
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
