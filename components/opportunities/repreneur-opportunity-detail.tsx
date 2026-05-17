import { CalendarDays, Gauge, MapPin, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  getOpportunityMatchRecommendationLabel,
  getOpportunityMatchStatusLabel,
  type RepreneurOpportunityExposure,
} from "@/lib/types/opportunity"

interface RepreneurOpportunityDetailProps {
  opportunity: RepreneurOpportunityExposure
}

function opportunityTitle(opportunity: RepreneurOpportunityExposure) {
  return opportunity.public_title || opportunity.sector || "Opportunity"
}

function formatNumber(value: number | null | undefined, suffix: string) {
  if (value === null || value === undefined) return "-"
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value)} ${suffix}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
}

export function RepreneurOpportunityDetail({ opportunity }: RepreneurOpportunityDetailProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{getOpportunityMatchStatusLabel(opportunity.match_status)}</Badge>
          <Badge variant="secondary">{getOpportunityMatchRecommendationLabel(opportunity.human_recommendation)}</Badge>
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">{opportunityTitle(opportunity)}</h1>
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-4" />
              {opportunity.location ?? "Location to confirm"}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-4" />
              {formatDate(opportunity.date_added)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-4" />
              {opportunity.headcount ?? "-"} people
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Revenue</CardDescription>
            <CardTitle>{formatNumber(opportunity.revenue_meur, "M EUR")}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>EBITDA</CardDescription>
            <CardTitle>{formatNumber(opportunity.ebitda_keur, "K EUR")}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Platform score</CardDescription>
            <CardTitle className="inline-flex items-center gap-2">
              <Gauge className="size-5" />
              {opportunity.platform_score ?? "-"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Opportunity</CardTitle>
            <CardDescription>{[opportunity.sector, opportunity.activity].filter(Boolean).join(" / ") || "Sector to confirm"}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-6">
              {opportunity.anonymized_description || "Anonymized opportunity details are being prepared."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fit Signals</CardTitle>
            <CardDescription>{getOpportunityMatchRecommendationLabel(opportunity.platform_recommendation)}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {opportunity.platform_reasons.length === 0 ? (
              <span className="text-muted-foreground">No structured signals recorded yet.</span>
            ) : (
              opportunity.platform_reasons.map((reason) => (
                <div key={reason} className="rounded-md border px-3 py-2">
                  {reason}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
