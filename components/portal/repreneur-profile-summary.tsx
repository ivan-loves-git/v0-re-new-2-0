"use client"

import { PortalNavigationLink as Link } from "@/components/portal/portal-navigation-link"
import type { ReactNode } from "react"
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
import type { RepreneurDealFlowOpportunity, RepreneurOpportunityExposure } from "@/lib/types/opportunity"
import { getEbitdaMarginPercentage } from "@/lib/utils/repreneur-deal-discovery"
import { displayRepreneurOpportunityGeography } from "@/lib/utils/repreneur-opportunity-geography"
import { useUiCopy, useUiLanguage } from "@/components/i18n/ui-text"
import { sectorUiLabel, geographyUiLabel, milestoneUiLabel } from "@/lib/i18n/canonical-labels"
import { displayLocale } from "@/lib/i18n/ui-language"
import { uiCopy, uiCopyWith } from "@/lib/i18n/ui-copy"
import type { Language } from "@/lib/i18n/translations"

interface RepreneurProfileSummaryProps {
  repreneur: PortalRepreneurProfile | null
  opportunities: RepreneurOpportunityListItem[]
  dealsHref?: string
  detailHrefByOpportunityId?: Record<string, string>
  mode?: "owner" | "staff-preview"
  /** #190 binds an attributed staff action here; never fall back to a my-profile action. */
  staffTargetThesisAction?: ReactNode
  staffDocumentAssistanceAction?: ReactNode
}

type RepreneurOpportunityListItem = RepreneurOpportunityExposure | RepreneurDealFlowOpportunity

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

function combineValues(values: string[], language: Language, label: (value: string) => string) {
  const displayValues = values.filter(Boolean).map(label)
  return displayValues.length > 0 ? Array.from(new Set(displayValues)).join(", ") : uiCopy(language, "To refine")
}

function formatNumber(value: number, language: Language) {
  return new Intl.NumberFormat(displayLocale(language), { maximumFractionDigits: 1 }).format(value)
}

function formatRange(minimum: number | null, maximum: number | null, suffix: string, language: Language) {
  if (minimum === null && maximum === null) return uiCopy(language, "To refine")
  const unit = suffix === "people" ? uiCopy(language, "people") : suffix
  if (minimum === null) return uiCopyWith(language, "Up to {value} {unit}", { value: formatNumber(maximum!, language), unit })
  if (maximum === null) return uiCopyWith(language, "From {value} {unit}", { value: formatNumber(minimum, language), unit })
  return uiCopyWith(language, "{minimum}–{maximum} {unit}", { minimum: formatNumber(minimum, language), maximum: formatNumber(maximum, language), unit })
}

function thesisFields(repreneur: PortalRepreneurProfile, language: Language) {
  const investmentCapacity = repreneur.q16_equity ?? repreneur.q14_investment_capacity ?? repreneur.investment_capacity
  const dealSizeLabel = (value: string) => language === "fr"
    ? ({ "1-3M": "1–3 M€", "3-5M": "3–5 M€", ">5M": "Plus de 5 M€" }[value] ?? value)
    : DEAL_SIZE_LABELS[value] ?? value
  const dealSize = combineValues(repreneur.q14_deal_size, language, dealSizeLabel)
  const sectorLabel = (value: string) => language === "fr"
    ? ({ all: "Tous les secteurs", retail: "Commerce et distribution", industry: "Industrie", services: "Services", construction: "Construction", healthcare: "Santé", tech: "Tech et numérique", environment: "Environnement", hospitality: "Hôtellerie et restauration", transport: "Transport et logistique", other: "Autre" }[value] ?? sectorUiLabel(value, language))
    : SECTOR_LABELS[value] ?? sectorUiLabel(value, language)
  const geographyLabel = (value: string) => language === "en"
    ? GEOGRAPHY_LABELS[value] ?? geographyUiLabel(value, language)
    : geographyUiLabel(value, language)
  const equityLabel = (value: string) => language === "fr"
    ? ({ tbd: "Moins de 150 K€", "151-250": "151–250 K€", "251-350": "251–350 K€", "351-450": "351–450 K€", ">450": "Plus de 450 K€" }[value] ?? value)
    : EQUITY_LABELS[value] ?? value

  return [
    { label: uiCopy(language, "Sectors"), value: combineValues([...repreneur.q13_target_sectors_v2, ...repreneur.sector_preferences], language, sectorLabel) },
    { label: uiCopy(language, "Geography"), value: combineValues([...repreneur.q12_geo_zones, ...repreneur.target_location], language, geographyLabel) },
    { label: uiCopy(language, "Deal size"), value: dealSize !== uiCopy(language, "To refine") ? dealSize : repreneur.target_acquisition_size
      ? dealSizeLabel(repreneur.target_acquisition_size) : uiCopy(language, "To refine") },
    { label: uiCopy(language, "Investment capacity"), value: investmentCapacity ? equityLabel(investmentCapacity) : uiCopy(language, "To refine") },
    { label: uiCopy(language, "Revenue range"), value: formatRange(repreneur.target_revenue_min_meur, repreneur.target_revenue_max_meur, "M EUR", language) },
    { label: uiCopy(language, "EBITDA range"), value: formatRange(repreneur.target_ebitda_min_keur, repreneur.target_ebitda_max_keur, "k EUR", language) },
    { label: uiCopy(language, "Minimum EBITDA margin"), value: repreneur.target_ebitda_margin_min_pct === null ? uiCopy(language, "To refine") : `${formatNumber(repreneur.target_ebitda_margin_min_pct, language)}%` },
    { label: uiCopy(language, "Staff-size range"), value: formatRange(repreneur.target_staff_size_min, repreneur.target_staff_size_max, "people", language) },
  ]
}

function opportunityTitle(opportunity: RepreneurOpportunityListItem, language: Language) {
  return opportunity.public_title || uiCopy(language, "Confidential acquisition opportunity")
}

function formatOpportunityMetric(value: number | null | undefined, suffix: string, language: Language) {
  if (value === null || value === undefined) return "—"
  return `${formatNumber(value, language)} ${suffix}`
}

function formatOpportunityMargin(opportunity: RepreneurOpportunityListItem, language: Language) {
  const margin = getEbitdaMarginPercentage(opportunity)
  return margin === null ? "—" : `${formatNumber(margin, language)}%`
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
  opportunities: RepreneurOpportunityListItem[]
  emptyMessage: string
  detailHrefForOpportunity: (opportunity: RepreneurOpportunityListItem) => string
}) {
  const u = useUiCopy()
  const language = useUiLanguage()
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
            const title = opportunityTitle(opportunity, language)

            return (
              <li key={opportunity.match_id} className="flex flex-col gap-4 py-4 text-sm">
                <div className="flex flex-col gap-2">
                  <h4 className="font-medium">{title}</h4>
                  <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
                    <div className="flex flex-col gap-1">
                      <WaveMicroLabel asChild><dt>{u("Geography")}</dt></WaveMicroLabel>
                      <dd className="text-foreground">{displayRepreneurOpportunityGeography(opportunity.location)}</dd>
                    </div>
                    <div className="flex flex-col gap-1">
                      <WaveMicroLabel asChild><dt>{u("Sector")}</dt></WaveMicroLabel>
                      <dd className="text-foreground">{opportunity.sector || opportunity.activity ? sectorUiLabel(opportunity.sector ?? opportunity.activity ?? "", language) : u("Sector to confirm")}</dd>
                    </div>
                    <div className="flex flex-col gap-1">
                      <WaveMicroLabel asChild><dt>{u("Date added")}</dt></WaveMicroLabel>
                      <dd className="text-foreground">{(language === "fr" ? opportunity.date_added_display : opportunity.date_added_display_en ?? opportunity.date_added_display) ?? "-"}</dd>
                    </div>
                  </dl>
                  <p className="line-clamp-2 text-muted-foreground">
                    {opportunity.teaser_summary || u("Anonymized opportunity details are being prepared.")}
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="flex flex-col gap-1">
                    <WaveMicroLabel asChild><dt>{u("Revenue")}</dt></WaveMicroLabel>
                    <dd className="font-medium">{formatOpportunityMetric(opportunity.revenue_meur, "M EUR", language)}</dd>
                  </div>
                  <div className="flex flex-col gap-1">
                    <WaveMicroLabel asChild><dt>{u("EBITDA")}</dt></WaveMicroLabel>
                    <dd className="font-medium">{formatOpportunityMetric(opportunity.ebitda_keur, "K EUR", language)}</dd>
                  </div>
                  <div className="flex flex-col gap-1">
                    <WaveMicroLabel asChild><dt>{u("EBITDA margin")}</dt></WaveMicroLabel>
                    <dd className="font-medium">{formatOpportunityMargin(opportunity, language)}</dd>
                  </div>
                  <div className="flex flex-col gap-1">
                    <WaveMicroLabel asChild><dt>{u("Employees")}</dt></WaveMicroLabel>
                    <dd className="font-medium">{opportunity.headcount_range ?? opportunity.headcount ?? "—"}</dd>
                  </div>
                </dl>
                <Link
                  href={detailHrefForOpportunity(opportunity)}
                  className="inline-flex w-fit items-center gap-1 font-medium text-primary hover:underline"
                  aria-label={u("View details for {title}", { title })}
                >
                  {u("View detail")}
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
  detailHrefByOpportunityId,
  mode = "owner",
  staffTargetThesisAction,
  staffDocumentAssistanceAction,
}: RepreneurProfileSummaryProps) {
  const u = useUiCopy()
  const language = useUiLanguage()
  if (!repreneur) {
    return (
      <Alert>
        <Target />
        <AlertTitle>{u(mode === "staff-preview" ? "Selected repreneur profile unavailable" : "No linked repreneur profile")}</AlertTitle>
        <AlertDescription>
          {mode === "staff-preview"
            ? u("The selected repreneur's profile could not be loaded. Choose another repreneur or check this profile with the Re-New team.")
            : u("This login is not connected to a repreneur profile yet. Ask the Re-New team to link your email before using the portal.")}
        </AlertDescription>
      </Alert>
    )
  }

  const completedMilestones = MILESTONES.filter(
    (milestone) => repreneur[`ms_${milestone.key}`] === true
  )
  const proposedDeals = opportunities.filter((opportunity) => opportunity.match_status === "proposed")
  const pursuedDeals = opportunities.filter((opportunity) => opportunity.match_status === "active_pursuit")
  const staffPreview = mode === "staff-preview"
  const opportunityDetailHref = (opportunity: RepreneurOpportunityListItem) =>
    detailHrefByOpportunityId?.[opportunity.match_id ?? opportunity.opportunity_id]
      ?? (opportunity.match_id ? `/portal/deals/${opportunity.match_id}` : dealsHref)

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm text-muted-foreground">{u(staffPreview ? "Selected repreneur's Re-New profile" : "Your Re-New profile")}</p>
        <h1 className="text-2xl font-semibold tracking-normal">{repreneur.first_name} {repreneur.last_name}</h1>
      </header>

      <Card id="target-thesis">
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <Target data-icon="inline-start" />
            {u("Target thesis")}
          </CardTitle>
          <CardDescription>{u(staffPreview
            ? "Acquisition criteria Re-New uses to surface relevant opportunities."
            : "Keep the acquisition criteria Re-New uses to surface relevant opportunities current.")}</CardDescription>
          {staffPreview
            ? staffTargetThesisAction ? <CardAction>{staffTargetThesisAction}</CardAction> : null
            : <CardAction><RepreneurTargetThesisEditor repreneur={repreneur} /></CardAction>}
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
            {thesisFields(repreneur, language).map((field) => (
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
          <CardTitle>{u(staffPreview ? "Supporting items" : "Your supporting items")}</CardTitle>
          <CardDescription>
            {u(staffPreview
              ? "Personal declarations belong to the repreneur. Staff can review them here but cannot certify on their behalf."
              : "Add or certify information for Re-New to review. These declarations never change readiness milestones.")}
          </CardDescription>
        </CardHeader>
        {staffPreview && staffDocumentAssistanceAction ? <CardContent>{staffDocumentAssistanceAction}</CardContent> : null}
        <CardContent>
          <RepreneurProfileContributions repreneur={repreneur} readOnly={staffPreview} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{u("Readiness milestones")}</CardTitle>
          <CardDescription>{u("Managed and updated by Re-New. This view is read-only.")}</CardDescription>
        </CardHeader>
        <CardContent>
          {completedMilestones.length === 0 ? (
            <p className="text-sm text-muted-foreground">{u("No readiness milestones have been marked complete yet.")}</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {completedMilestones.map((milestone) => (
                <div key={milestone.key} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <CheckCircle2 className="text-primary" />
                  <span>{milestoneUiLabel(milestone.key, milestone.label, language)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{u(staffPreview ? "Selected repreneur's deals" : "Your deals")}</CardTitle>
          <CardDescription>{u(staffPreview ? "Opportunities Re-New has made available to this repreneur." : "Opportunities Re-New has made available to you.")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <DealGroup
            title={u("Proposed deals")}
            description={u("Available for your review in the Deals area.")}
            opportunities={proposedDeals}
            emptyMessage={u("No proposed deals are available at the moment.")}
            detailHrefForOpportunity={opportunityDetailHref}
          />
          <DealGroup
            title={u("Pursued deals")}
            description={u("Validated by Re-New as active pursuits.")}
            opportunities={pursuedDeals}
            emptyMessage={u("No active pursuits are recorded at the moment.")}
            detailHrefForOpportunity={opportunityDetailHref}
          />
          <Link href={dealsHref} className="w-fit text-sm font-medium text-primary hover:underline">
            {u("Open all deals")}
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
