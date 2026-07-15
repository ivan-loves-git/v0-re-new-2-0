import Link from "next/link"
import { ArrowRight, BriefcaseBusiness, MapPin } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  getOpportunityMatchRecommendationLabel,
  getOpportunityMatchStatusLabel,
  getOpportunityNdaStatusLabel,
  getOpportunityPursuitStageLabel,
  type RepreneurDealFlowOpportunity,
  type RepreneurOpportunityExposure,
  type RepreneurOpportunityProfile,
} from "@/lib/types/opportunity"

type RepreneurOpportunityListItem = RepreneurOpportunityExposure | RepreneurDealFlowOpportunity

interface RepreneurOpportunityListProps {
  repreneur: RepreneurOpportunityProfile | null
  opportunities: RepreneurOpportunityListItem[]
  detailHrefForOpportunity?: (opportunity: RepreneurOpportunityListItem) => string | null
  detailLabel?: string
  emptyDescription?: string
}

function opportunityTitle(opportunity: RepreneurOpportunityListItem) {
  return opportunity.public_title || opportunity.sector || "Opportunity"
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
}

export function RepreneurOpportunityList({
  repreneur,
  opportunities,
  detailHrefForOpportunity,
  detailLabel = "View detail",
  emptyDescription,
}: RepreneurOpportunityListProps) {
  if (!repreneur) {
    return (
      <Alert>
        <BriefcaseBusiness />
        <AlertTitle>No linked repreneur profile</AlertTitle>
        <AlertDescription>No opportunity data is available for this login.</AlertDescription>
      </Alert>
    )
  }

  if (opportunities.length === 0) {
    return (
      <Alert>
        <BriefcaseBusiness />
        <AlertTitle>No opportunities available</AlertTitle>
        <AlertDescription>
          {emptyDescription ?? `There are no opportunities for ${repreneur.first_name} at the moment.`}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="grid gap-3">
      {opportunities.map((opportunity) => {
        const relevanceGrade =
          "relevance_grade" in opportunity ? opportunity.relevance_grade : opportunity.platform_recommendation
        const isStaffRecommended =
          "is_staff_recommended" in opportunity ? opportunity.is_staff_recommended : true
        const detailHref =
          detailHrefForOpportunity?.(opportunity) ??
          (opportunity.match_id ? `/portal/deals/${opportunity.match_id}` : null)

        return (
          <Card key={opportunity.match_id ?? opportunity.opportunity_id} className="gap-0 py-0 md:grid md:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]">
            <CardHeader className="gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {opportunity.match_status && <Badge variant="outline">{getOpportunityMatchStatusLabel(opportunity.match_status)}</Badge>}
                {opportunity.pursuit_stage && <Badge variant="outline">{getOpportunityPursuitStageLabel(opportunity.pursuit_stage)}</Badge>}
                {opportunity.match_status === "active_pursuit" && (
                  <Badge variant="outline">{getOpportunityNdaStatusLabel(opportunity.nda_status ?? "not_required")}</Badge>
                )}
                {isStaffRecommended && <Badge variant="secondary">Selected by Re-New</Badge>}
                <Badge variant="outline">Relevance: {getOpportunityMatchRecommendationLabel(relevanceGrade)}</Badge>
              </div>
              <div className="flex flex-col gap-1">
                <CardTitle>{opportunityTitle(opportunity)}</CardTitle>
                <CardDescription className="inline-flex items-center gap-1">
                  <MapPin className="size-4" />
                  {opportunity.location ?? "Location to confirm"} · {formatDate(opportunity.date_added)}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col justify-between gap-4 border-t py-5 md:border-l md:border-t-0">
              <p className="line-clamp-3 text-sm text-muted-foreground">
                {opportunity.teaser_summary || "Anonymized opportunity details are being prepared."}
              </p>
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Revenue</span>
                  <span className="font-medium">{opportunity.revenue_meur ?? "-"} M EUR</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">EBITDA</span>
                  <span className="font-medium">{opportunity.ebitda_keur ?? "-"} K EUR</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Team</span>
                  <span className="font-medium">{opportunity.headcount_range ?? opportunity.headcount ?? "-"}</span>
                </div>
              </div>
              {detailHref && (
                <Button asChild variant="outline" className="w-fit">
                  <Link href={detailHref}>
                    {detailLabel}
                    <ArrowRight data-icon="inline-end" />
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
