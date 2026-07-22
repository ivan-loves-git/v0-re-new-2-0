import Link from "next/link"
import { CalendarDays, CheckCircle2, Download, FileText, MapPin, ShieldCheck, XCircle, Users } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LockedOpportunityInterestAction } from "@/components/opportunities/locked-opportunity-interest-action"
import { RepreneurOpportunityDeclineAction } from "@/components/opportunities/repreneur-opportunity-decline-action"
import { markMyOpportunityInterested } from "@/lib/actions/repreneur-opportunity-responses"
import {
  getOpportunityMatchStatusLabel,
  getOpportunityNdaStatusLabel,
  getOpportunityPursuitStageLabel,
  OPPORTUNITY_DECLINE_REASON_OPTIONS,
  type RepreneurDealFlowOpportunity,
  type RepreneurOpportunityDocument,
  type RepreneurOpportunityExposure,
} from "@/lib/types/opportunity"
import { getEbitdaMarginPercentage, isStaffRecommended } from "@/lib/utils/repreneur-deal-discovery"

type RepreneurOpportunityDetailItem = RepreneurOpportunityExposure | RepreneurDealFlowOpportunity

interface RepreneurOpportunityDetailProps {
  opportunity: RepreneurOpportunityDetailItem
  readOnly?: boolean
  documentHrefForDocument?: (document: RepreneurOpportunityDocument) => string | null
}

function opportunityTitle(opportunity: RepreneurOpportunityDetailItem) {
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

function formatEbitdaMargin(opportunity: RepreneurOpportunityDetailItem) {
  const margin = getEbitdaMarginPercentage(opportunity)
  if (margin === null) return "—"
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(margin)}%`
}

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "-"
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function canRespond(status: RepreneurOpportunityDetailItem["match_status"]) {
  return status === "proposed" || status === "interested" || status === "declined"
}

export function RepreneurOpportunityDetail({
  opportunity,
  readOnly = false,
  documentHrefForDocument,
}: RepreneurOpportunityDetailProps) {
  const interestAction = opportunity.match_id
    ? markMyOpportunityInterested.bind(null, opportunity.match_id)
    : null
  const memoAvailable = opportunity.visible_documents.length > 0
  const selectedDeclineReasons = new Set(opportunity.decline_reason_categories ?? [])
  const lockedForAnotherRepreneur = Boolean(opportunity.is_locked_for_other_repreneur)

  return (
    <div className="flex flex-col gap-6">
      <header className="relative flex flex-col gap-3 border-b pb-5">
        <span aria-hidden="true" className="absolute -bottom-px left-0 h-0.5 w-12 bg-primary" />
        <div className="flex flex-wrap items-center gap-2">
          {opportunity.match_status ? (
            <Badge variant="outline">{getOpportunityMatchStatusLabel(opportunity.match_status)}</Badge>
          ) : null}
          {lockedForAnotherRepreneur ? <Badge variant="outline">Someone is already positioned</Badge> : null}
          {opportunity.match_status === "active_pursuit" && (
            <Badge variant="outline">{getOpportunityNdaStatusLabel(opportunity.nda_status ?? "not_required")}</Badge>
          )}
          {isStaffRecommended(opportunity) ? <Badge variant="secondary">Selected by Re-New</Badge> : null}
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.025em]">{opportunityTitle(opportunity)}</h1>
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-4" />
              {opportunity.location ?? "Location to confirm"}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-4" />
              Added {formatDate(opportunity.date_added)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-4" />
              {opportunity.headcount_range ?? opportunity.headcount ?? "-"} people
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Re-New ref <span className="font-mono text-foreground">{opportunity.reference}</span></span>
            <span>{opportunity.sector ?? opportunity.activity ?? "Sector to confirm"}</span>
          </div>
        </div>
      </header>

      {opportunity.match_status ? <Card>
        <CardHeader>
          <CardTitle>{readOnly ? "Response" : "Your response"}</CardTitle>
          <CardDescription>
            {readOnly
              ? "Current repreneur-facing status for this opportunity."
              : "Tell Re-New whether this opportunity should be explored further."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {opportunity.match_status === "interested" && !lockedForAnotherRepreneur && (
            <Alert>
              <CheckCircle2 />
              <AlertTitle>Interest sent</AlertTitle>
              <AlertDescription>Re-New can now review this signal and decide the next step.</AlertDescription>
            </Alert>
          )}

          {opportunity.match_status === "declined" && !lockedForAnotherRepreneur && (
            <Alert>
              <XCircle />
              <AlertTitle>Marked as not a fit</AlertTitle>
              <AlertDescription>
                This response is visible to Re-New for review.
                {opportunity.decline_reason_categories && opportunity.decline_reason_categories.length > 0 ? (
                  <>
                    {" "}
                    Reasons:{" "}
                    {opportunity.decline_reason_categories
                      .map((reason) => OPPORTUNITY_DECLINE_REASON_OPTIONS.find((option) => option.value === reason)?.label ?? reason)
                      .join(", ")}
                    .
                  </>
                ) : null}
              </AlertDescription>
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

          {lockedForAnotherRepreneur ? (
            <LockedOpportunityInterestAction
              opportunityId={opportunity.opportunity_id}
              interestRecorded={Boolean(opportunity.interest_expressed_at)}
              notificationSent={Boolean(opportunity.interest_notification_sent_at)}
              readOnly={readOnly}
            />
          ) : null}

          {readOnly && !lockedForAnotherRepreneur && canRespond(opportunity.match_status) && (
            <Alert>
              <ShieldCheck />
              <AlertTitle>Staff preview</AlertTitle>
              <AlertDescription>Response buttons are disabled in preview.</AlertDescription>
            </Alert>
          )}

          {!readOnly && !lockedForAnotherRepreneur && interestAction && canRespond(opportunity.match_status) && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <form action={interestAction}>
                <Button type="submit" disabled={opportunity.match_status === "interested"}>
                  <CheckCircle2 data-icon="inline-start" />
                  {opportunity.match_status === "interested" ? "Interest sent" : "I'm interested"}
                </Button>
              </form>
            </div>
          )}

          {!readOnly && !lockedForAnotherRepreneur && opportunity.match_id && opportunity.match_status !== "declined" && canRespond(opportunity.match_status) && (
            <RepreneurOpportunityDeclineAction
              matchId={opportunity.match_id}
              initialReasons={Array.from(selectedDeclineReasons)}
              initialDetails={opportunity.decline_reason_text ?? ""}
            />
          )}
        </CardContent>
      </Card> : null}

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
            {!memoAvailable && (
              <Alert>
                <FileText />
                <AlertTitle>Memo locked</AlertTitle>
                <AlertDescription>
                  Re-New will make the info memo available after the NDA evidence and document approval are recorded.
                </AlertDescription>
              </Alert>
            )}

            {memoAvailable &&
              opportunity.visible_documents.map((document) => {
                const documentHref =
                  documentHrefForDocument?.(document) ??
                  `/portal/deals/${opportunity.match_id}/documents/${document.id}`

                return (
                  <div key={document.id} className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{document.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {document.document_type.replaceAll("_", " ")} · {formatBytes(document.size_bytes)}
                      </p>
                    </div>
                    {documentHref ? (
                      <Button asChild variant="outline" size="sm">
                        <Link href={documentHref}>
                          <Download data-icon="inline-start" />
                          Download
                        </Link>
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" disabled>
                        <Download data-icon="inline-start" />
                        Download
                      </Button>
                    )}
                  </div>
                )
              })}
          </CardContent>
        </Card>
      )}

      <div className="grid overflow-hidden rounded-lg border bg-card sm:grid-cols-2 md:grid-cols-4">
        <Card className="rounded-none border-0 border-b py-4 md:border-b-0 md:border-r">
          <CardHeader className="pb-2">
            <CardDescription>Revenue</CardDescription>
            <CardTitle>{formatNumber(opportunity.revenue_meur, "M EUR")}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="rounded-none border-0 border-b py-4 sm:border-l md:border-b-0 md:border-l-0 md:border-r">
          <CardHeader className="pb-2">
            <CardDescription>EBITDA</CardDescription>
            <CardTitle>{formatNumber(opportunity.ebitda_keur, "K EUR")}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="rounded-none border-0 border-b py-4 md:border-b-0 md:border-r">
          <CardHeader className="pb-2">
            <CardDescription>EBITDA margin</CardDescription>
            <CardTitle>{formatEbitdaMargin(opportunity)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="rounded-none border-0 py-4 sm:border-l md:border-l-0">
          <CardHeader className="pb-2">
            <CardDescription>Team</CardDescription>
            <CardTitle>{opportunity.headcount_range ?? opportunity.headcount ?? "-"}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Opportunity</CardTitle>
          <CardDescription>{[opportunity.sector, opportunity.activity].filter(Boolean).join(" / ") || "Sector to confirm"}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm leading-6">
            {opportunity.teaser_summary || "Anonymized opportunity details are being prepared."}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
