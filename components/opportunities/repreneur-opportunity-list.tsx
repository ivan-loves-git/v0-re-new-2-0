import Link from "next/link"
import { ArrowRight, BriefcaseBusiness, MapPin } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  getOpportunityMatchRecommendationLabel,
  getOpportunityMatchStatusLabel,
  type RepreneurOpportunityExposure,
  type RepreneurOpportunityProfile,
} from "@/lib/types/opportunity"

interface RepreneurOpportunityListProps {
  repreneur: RepreneurOpportunityProfile | null
  opportunities: RepreneurOpportunityExposure[]
}

function opportunityTitle(opportunity: RepreneurOpportunityExposure) {
  return opportunity.public_title || opportunity.sector || "Opportunity"
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
}

export function RepreneurOpportunityList({ repreneur, opportunities }: RepreneurOpportunityListProps) {
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
        <AlertDescription>There are no proposed opportunities for {repreneur.first_name} at the moment.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {opportunities.map((opportunity) => (
        <Card key={opportunity.match_id}>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{getOpportunityMatchStatusLabel(opportunity.match_status)}</Badge>
              <Badge variant="secondary">{getOpportunityMatchRecommendationLabel(opportunity.human_recommendation)}</Badge>
            </div>
            <div className="flex flex-col gap-1">
              <CardTitle>{opportunityTitle(opportunity)}</CardTitle>
              <CardDescription className="inline-flex items-center gap-1">
                <MapPin className="size-4" />
                {opportunity.location ?? "Location to confirm"} · {formatDate(opportunity.date_added)}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="line-clamp-3 text-sm text-muted-foreground">
              {opportunity.anonymized_description || "Anonymized opportunity details are being prepared."}
            </p>
            <div className="grid grid-cols-3 gap-3 text-sm">
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
                <span className="font-medium">{opportunity.headcount ?? "-"}</span>
              </div>
            </div>
            <Button asChild variant="outline" className="w-fit">
              <Link href={`/portal/deals/${opportunity.match_id}`}>
                View detail
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
