"use client"

import { useEffect, useState } from "react"
import { RepreneurPersonalReviewControl } from "@/components/opportunities/repreneur-personal-review"
import { CalendarDays, CheckCircle2, Download, FileText, MapPin, ShieldCheck, XCircle, Users } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LockedOpportunityInterestAction } from "@/components/opportunities/locked-opportunity-interest-action"
import { RepreneurNdaSignatureUpload } from "@/components/opportunities/repreneur-nda-signature-upload"
import { RepreneurOpportunityDeclineAction } from "@/components/opportunities/repreneur-opportunity-decline-action"
import { markMyOpportunityInterested } from "@/lib/actions/repreneur-opportunity-responses"
import type { PortalCurrentPursuit } from "@/lib/data/current-pursuit"
import {
  getOpportunityMatchStatusLabel,
  getOpportunityPursuitStageLabel,
  OPPORTUNITY_DECLINE_REASON_OPTIONS,
  type RepreneurDealFlowOpportunity,
  type RepreneurOpportunityExposure,
} from "@/lib/types/opportunity"
import { getEbitdaMarginPercentage, isStaffRecommended } from "@/lib/utils/repreneur-deal-discovery"
import { displayRepreneurOpportunityGeography } from "@/lib/utils/repreneur-opportunity-geography"
import { isRecommendationResponseOpen } from "@/lib/opportunity-recommendation-window"

type RepreneurOpportunityDetailItem = RepreneurOpportunityExposure | RepreneurDealFlowOpportunity

interface RepreneurOpportunityDetailProps {
  opportunity: RepreneurOpportunityDetailItem
  readOnly?: boolean
  journey?: PortalCurrentPursuit | null
}

function opportunityTitle(opportunity: RepreneurOpportunityDetailItem) {
  return opportunity.public_title || "Confidential acquisition opportunity"
}

function formatNumber(value: number | null | undefined, suffix: string) {
  if (value === null || value === undefined) return "-"
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value)} ${suffix}`
}

function formatEbitdaMargin(opportunity: RepreneurOpportunityDetailItem) {
  const margin = getEbitdaMarginPercentage(opportunity)
  if (margin === null) return "—"
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(margin)}%`
}

function formatRecommendationDeadline(expiresAt: string | null | undefined) {
  if (!expiresAt) return null
  const value = new Date(expiresAt)
  if (Number.isNaN(value.getTime())) return null
  return new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris", timeZoneName: "short" }).format(value)
}

function canRespond(status: RepreneurOpportunityDetailItem["match_status"]) {
  return status === "proposed" || status === "interested" || status === "declined" || status === "dropped"
}

export function RepreneurOpportunityDetail({
  opportunity,
  readOnly = false,
  journey,
}: RepreneurOpportunityDetailProps) {
  const [, setResponseClock] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => setResponseClock((value) => value + 1), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  const interestAction = opportunity.match_id
    ? markMyOpportunityInterested.bind(null, opportunity.match_id)
    : null
  const memoAvailable = Boolean(journey?.confidentialGrant && !journey.revoked)
  const selectedDeclineReasons = new Set(opportunity.decline_reason_categories ?? [])
  const lockedForAnotherRepreneur = Boolean(opportunity.is_locked_for_other_repreneur)
  const canExpressUnassignedInterest = !opportunity.match_id
  const responsePending = opportunity.match_status !== "interested" && opportunity.match_status !== "active_pursuit"
  const responseExpired = responsePending && !isRecommendationResponseOpen(opportunity.recommendation_expires_at)
  const responseDeadline = formatRecommendationDeadline(opportunity.recommendation_expires_at)

  return (
    <div className="flex flex-col gap-6">
      <header className="relative flex flex-col gap-3 border-b pb-5">
        <span aria-hidden="true" className="absolute -bottom-px left-0 h-0.5 w-12 bg-primary" />
        <div className="flex flex-wrap items-center gap-2">
          {opportunity.match_status ? (
            <Badge variant="outline">{opportunity.match_status === "interested" ? "Interest sent, awaiting Re-New validation" : getOpportunityMatchStatusLabel(opportunity.match_status)}</Badge>
          ) : null}
          {lockedForAnotherRepreneur ? <Badge variant="outline">Someone is already positioned</Badge> : null}
          {opportunity.match_status === "active_pursuit" && <Badge variant="outline">Confidential journey</Badge>}
          {opportunity.match_status === "active_pursuit" && opportunity.pursuit_stage && <Badge variant="outline">{getOpportunityPursuitStageLabel(opportunity.pursuit_stage)}</Badge>}
          {opportunity.pursuit_stage_provenance === "staff_confirmed_history" && <Badge variant="outline">Stage confirmed by Re-New</Badge>}
          {isStaffRecommended(opportunity) ? <Badge variant="secondary">Selected by Re-New</Badge> : null}
          {responseExpired ? <Badge variant="outline">Response window expired</Badge> : null}
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.025em]">{opportunityTitle(opportunity)}</h1>
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-4" />
              {displayRepreneurOpportunityGeography(opportunity.location)}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-4" />
              Added {opportunity.date_added_display ?? "-"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-4" />
              {opportunity.headcount_range ?? opportunity.headcount ?? "-"} people
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{opportunity.sector ?? opportunity.activity ?? "Sector to confirm"}</span>
            {responsePending && responseDeadline ? <span>{responseExpired ? "Response window expired" : "Respond by"}: {responseDeadline}</span> : null}
          </div>
          {opportunity.pursuit_stage_provenance === "staff_confirmed_history" ? <p className="mt-2 text-xs text-muted-foreground">This progress was confirmed by Re-New from the existing process. Document checks and access remain separate.</p> : null}
        </div>
      </header>

      {(opportunity.match_status || canExpressUnassignedInterest) ? <Card>
        <CardHeader>
          <CardTitle>{canExpressUnassignedInterest ? "Express interest" : readOnly ? "Response" : "Your response"}</CardTitle>
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

          {opportunity.match_status === "dropped" && !lockedForAnotherRepreneur && (
            <Alert>
              <XCircle />
              <AlertTitle>Pursuit dropped</AlertTitle>
              <AlertDescription>This retained history has no confidential access. You can safely ask Re-New to reconsider the opportunity.</AlertDescription>
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
              <AlertDescription>Re-New has validated this opportunity as an active pursuit. The next available action is shown in the documents area below.</AlertDescription>
            </Alert>
          )}

          {lockedForAnotherRepreneur || canExpressUnassignedInterest ? (
            <LockedOpportunityInterestAction
              opportunityId={opportunity.opportunity_id}
              interestRecorded={Boolean(opportunity.interest_expressed_at)}
              notificationSent={Boolean(opportunity.interest_notification_sent_at)}
              lockedForAnotherRepreneur={lockedForAnotherRepreneur}
              readOnly={readOnly}
              recommendationExpiresAt={opportunity.recommendation_expires_at}
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
              <form action={interestAction} data-wave-action="express_interest" data-wave-workflow="portal_deals">
                <Button type="submit" disabled={opportunity.match_status === "interested" || responseExpired}>
                  <CheckCircle2 data-icon="inline-start" />
                  {opportunity.match_status === "interested" ? "Interest sent" : responseExpired ? "Response window expired" : opportunity.match_status === "declined" || opportunity.match_status === "dropped" ? "Review and reconsider" : "I'm interested"}
                </Button>
              </form>
            </div>
          )}

          {!readOnly && !lockedForAnotherRepreneur && opportunity.match_id && opportunity.match_status !== "declined" && opportunity.match_status !== "dropped" && canRespond(opportunity.match_status) && (
            <RepreneurOpportunityDeclineAction
              matchId={opportunity.match_id}
              initialReasons={Array.from(selectedDeclineReasons)}
              initialDetails={opportunity.decline_reason_text ?? ""}
            />
          )}
          {!readOnly ? <RepreneurPersonalReviewControl
            key={opportunity.opportunity_id}
            opportunityId={opportunity.opportunity_id}
            initialState={opportunity.personal_review}
            detail
            affectsOrder={opportunity.match_status !== "interested" && opportunity.match_status !== "active_pursuit" && opportunity.match_status !== "declined" && opportunity.match_status !== "dropped"}
          /> : null}
        </CardContent>
      </Card> : null}

      {opportunity.match_status === "active_pursuit" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5" />
              Documents
            </CardTitle>
            <CardDescription>Each document is released only through the canonical confidentiality journey.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {!memoAvailable && (
              <Alert>
                <FileText />
                <AlertTitle>{journey?.gate1Passed ? "Information memorandum locked" : "Confidential documents locked"}</AlertTitle>
                <AlertDescription>
                  {!journey?.enabled
                    ? "The confidential journey is not enabled for this opportunity. Re-New will tell you when the next action is available."
                    : journey.revoked
                      ? "Confidential access has been revoked for this pursuit."
                      : journey.ndaReadyNotified
                        ? "Your NDA is ready. Upload your signed copy for Re-New review. The Information Memorandum remains locked until the signed NDA handoff and staff approval are complete."
                        : "Re-New is preparing your NDA. We will notify you when it is ready to download and sign."}
                </AlertDescription>
              </Alert>
            )}

            {journey?.enabled && journey.ndaReadyNotified && !journey.revoked ? <>
              <div className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">NDA template</p><p className="text-xs text-muted-foreground">Use this exact validated template for your signed copy.</p></div><Button asChild variant="outline" size="sm"><a href={`/portal/deals/${opportunity.match_id}/nda-template`}><Download data-icon="inline-start" />Download template</a></Button></div>
              {!journey.gate2Passed && !readOnly && opportunity.match_id ? <RepreneurNdaSignatureUpload matchId={opportunity.match_id} /> : null}
            </> : null}

            {memoAvailable && journey?.confidentialGrant ? <>
              <div className="rounded-md border p-3">
                <p className="font-medium">Disclosed source</p>
                <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs text-muted-foreground">Firm and office</dt><dd>{journey.confidentialGrant.source.firmName} · {journey.confidentialGrant.source.officeName}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Named contact{journey.confidentialGrant.source.contactNames.length === 1 ? "" : "s"}</dt><dd>{journey.confidentialGrant.source.contactNames.join(", ")}</dd></div>
                </dl>
              </div>
              <div className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">Information memorandum (IM)</p><p className="text-xs text-muted-foreground">This exact IM was explicitly granted to this pursuit.</p></div><Button asChild variant="outline" size="sm"><a href={`/portal/deals/${opportunity.match_id}/documents/${journey.confidentialGrant.informationMemoDocumentId}`}><Download data-icon="inline-start" />Download IM</a></Button></div>
            </> : null}
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
