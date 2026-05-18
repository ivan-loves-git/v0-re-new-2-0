import Link from "next/link"
import { CalendarDays, CheckCircle2, Download, FileText, Gauge, MapPin, ShieldCheck, XCircle, Users } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { declineMyOpportunity, markMyOpportunityInterested } from "@/lib/actions/repreneur-opportunities"
import {
  canDownloadOpportunityDocuments,
  getOpportunityMatchRecommendationLabel,
  getOpportunityMatchStatusLabel,
  getOpportunityNdaStatusLabel,
  getOpportunityPursuitStageLabel,
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

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "-"
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function canRespond(status: RepreneurOpportunityExposure["match_status"]) {
  return status === "proposed" || status === "interested" || status === "declined"
}

export function RepreneurOpportunityDetail({ opportunity }: RepreneurOpportunityDetailProps) {
  const interestAction = markMyOpportunityInterested.bind(null, opportunity.match_id)
  const declineAction = declineMyOpportunity.bind(null, opportunity.match_id)
  const documentsAllowed = canDownloadOpportunityDocuments(opportunity.nda_status ?? "not_required")

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{getOpportunityMatchStatusLabel(opportunity.match_status)}</Badge>
          {opportunity.match_status === "active_pursuit" && (
            <Badge variant="outline">{getOpportunityNdaStatusLabel(opportunity.nda_status ?? "not_required")}</Badge>
          )}
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

      <Card>
        <CardHeader>
          <CardTitle>Your response</CardTitle>
          <CardDescription>Tell Re-New whether this opportunity should be explored further.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {opportunity.match_status === "interested" && (
            <Alert>
              <CheckCircle2 />
              <AlertTitle>Interest sent</AlertTitle>
              <AlertDescription>Re-New can now review this signal and decide the next step.</AlertDescription>
            </Alert>
          )}

          {opportunity.match_status === "declined" && (
            <Alert>
              <XCircle />
              <AlertTitle>Marked as not a fit</AlertTitle>
              <AlertDescription>This response is visible to Re-New for review.</AlertDescription>
            </Alert>
          )}

          {opportunity.match_status === "active_pursuit" && (
            <Alert>
              <CheckCircle2 />
              <AlertTitle>Active pursuit</AlertTitle>
              <AlertDescription>
                Re-New has validated this opportunity as an active pursuit.
                {opportunity.pursuit_stage ? ` Current stage: ${getOpportunityPursuitStageLabel(opportunity.pursuit_stage)}.` : ""}
              </AlertDescription>
            </Alert>
          )}

          {canRespond(opportunity.match_status) && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <form action={interestAction}>
                <Button type="submit" disabled={opportunity.match_status === "interested"}>
                  <CheckCircle2 data-icon="inline-start" />
                  {opportunity.match_status === "interested" ? "Interest sent" : "I'm interested"}
                </Button>
              </form>
              <form action={declineAction}>
                <Button type="submit" variant="outline" disabled={opportunity.match_status === "declined"}>
                  <XCircle data-icon="inline-start" />
                  {opportunity.match_status === "declined" ? "Not a fit sent" : "Not a fit"}
                </Button>
              </form>
            </div>
          )}
        </CardContent>
      </Card>

      {opportunity.match_status === "active_pursuit" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5" />
              Documents
            </CardTitle>
            <CardDescription>NDA status: {getOpportunityNdaStatusLabel(opportunity.nda_status ?? "not_required")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {!documentsAllowed && (
              <Alert>
                <FileText />
                <AlertTitle>Documents locked</AlertTitle>
                <AlertDescription>Re-New will open document downloads once the NDA status is signed or waived.</AlertDescription>
              </Alert>
            )}

            {documentsAllowed && opportunity.visible_documents.length === 0 && (
              <p className="text-sm text-muted-foreground">No approved documents are available yet.</p>
            )}

            {documentsAllowed &&
              opportunity.visible_documents.map((document) => (
                <div key={document.id} className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{document.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {document.document_type.replaceAll("_", " ")} · {formatBytes(document.size_bytes)}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/portal/deals/${opportunity.match_id}/documents/${document.id}`}>
                      <Download data-icon="inline-start" />
                      Download
                    </Link>
                  </Button>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

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
            <CardDescription>
              {getOpportunityMatchRecommendationLabel(opportunity.platform_recommendation)} - rule-based V2 guidance that
              Re-New may refine with human review.
            </CardDescription>
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
