"use client"

import { useEffect, useState, type ReactNode } from "react"
import { RepreneurPersonalReviewControl } from "@/components/opportunities/repreneur-personal-review"
import { CalendarDays, CheckCircle2, Download, FileText, MapPin, ShieldCheck, XCircle, Users } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LockedOpportunityInterestAction } from "@/components/opportunities/locked-opportunity-interest-action"
import { InterestWithdrawalControl } from "@/components/opportunities/interest-withdrawal-control"
import { RepreneurNdaSignatureUpload } from "@/components/opportunities/repreneur-nda-signature-upload"
import { RepreneurOpportunityDeclineAction } from "@/components/opportunities/repreneur-opportunity-decline-action"
import { markMyOpportunityInterested } from "@/lib/actions/repreneur-opportunity-responses"
import { withdrawMyOpportunityInterest } from "@/lib/actions/interest-withdrawal"
import type { PortalCurrentPursuit } from "@/lib/data/current-pursuit"
import type { RepreneurDealFlowOpportunity, RepreneurOpportunityExposure } from "@/lib/types/opportunity"
import { declineReasonUiLabel, matchStatusUiLabel, pursuitStageUiLabel } from "@/lib/i18n/deal-labels"
import { useUiCopy, useUiLanguage } from "@/components/i18n/ui-text"
import { uiCopy } from "@/lib/i18n/ui-copy"
import { displayLocale } from "@/lib/i18n/ui-language"
import type { Language } from "@/lib/i18n/translations"
import { getEbitdaMarginPercentage, isStaffRecommended } from "@/lib/utils/repreneur-deal-discovery"
import { displayRepreneurOpportunityGeography } from "@/lib/utils/repreneur-opportunity-geography"
import { isRecommendationResponseOpen } from "@/lib/opportunity-recommendation-window"

type RepreneurOpportunityDetailItem = RepreneurOpportunityExposure | RepreneurDealFlowOpportunity

interface RepreneurOpportunityDetailProps {
  opportunity: RepreneurOpportunityDetailItem
  readOnly?: boolean
  withdrawalPaused?: boolean
  journey?: PortalCurrentPursuit | null
  documentHrefs?: { ndaTemplate?: string; informationMemorandum?: string }
  /** #190 supplies attributed staff controls without using owner-session actions. */
  staffAssistanceControls?: ReactNode
  staffDocumentAssistanceControls?: ReactNode
}

function opportunityTitle(opportunity: RepreneurOpportunityDetailItem, language: Language) {
  return opportunity.public_title || uiCopy(language, "Confidential acquisition opportunity")
}

function formatNumber(value: number | null | undefined, suffix: string, language: Language) {
  if (value === null || value === undefined) return "-"
  return `${new Intl.NumberFormat(displayLocale(language), { maximumFractionDigits: 1 }).format(value)} ${suffix}`
}

function formatEbitdaMargin(opportunity: RepreneurOpportunityDetailItem, language: Language) {
  const margin = getEbitdaMarginPercentage(opportunity)
  if (margin === null) return "—"
  return `${new Intl.NumberFormat(displayLocale(language), { maximumFractionDigits: 1 }).format(margin)}%`
}

function formatRecommendationDeadline(expiresAt: string | null | undefined, language: Language) {
  if (!expiresAt) return null
  const value = new Date(expiresAt)
  if (Number.isNaN(value.getTime())) return null
  return new Intl.DateTimeFormat(displayLocale(language), { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris", timeZoneName: "short" }).format(value)
}

function canRespond(status: RepreneurOpportunityDetailItem["match_status"]) {
  return status === "proposed" || status === "interested" || status === "declined" || status === "dropped"
}

export function RepreneurOpportunityDetail({
  opportunity,
  readOnly = false,
  withdrawalPaused = false,
  journey,
  documentHrefs,
  staffAssistanceControls,
  staffDocumentAssistanceControls,
}: RepreneurOpportunityDetailProps) {
  const language = useUiLanguage()
  const copy = useUiCopy()
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
  const responsePending = opportunity.match_status !== "interested" && opportunity.match_status !== "active_pursuit" && opportunity.match_status !== "withdrawn"
  const responseExpired = responsePending && !isRecommendationResponseOpen(opportunity.recommendation_expires_at)
  const responseDeadline = formatRecommendationDeadline(opportunity.recommendation_expires_at, language)
  const ndaTemplateHref = readOnly
    ? documentHrefs?.ndaTemplate
    : `/portal/deals/${opportunity.match_id}/nda-template`
  const informationMemorandumHref = readOnly
    ? documentHrefs?.informationMemorandum
    : journey?.confidentialGrant
      ? `/portal/deals/${opportunity.match_id}/documents/${journey.confidentialGrant.informationMemoDocumentId}`
      : undefined

  return (
    <div className="flex flex-col gap-6">
      <header className="relative flex flex-col gap-3 border-b pb-5">
        <span aria-hidden="true" className="absolute -bottom-px left-0 h-0.5 w-12 bg-primary" />
        <div className="flex flex-wrap items-center gap-2">
          {opportunity.match_status ? (
            <Badge variant="outline">{opportunity.match_status === "interested" ? opportunity.interest_rejected ? copy("Interest not selected by Re-New") : copy("Interest sent, awaiting Re-New validation") : matchStatusUiLabel(opportunity.match_status, language)}</Badge>
          ) : null}
          {lockedForAnotherRepreneur ? <Badge variant="outline">{copy("Someone is already positioned")}</Badge> : null}
          {opportunity.match_status === "active_pursuit" && <Badge variant="outline">{copy("Confidential journey")}</Badge>}
          {opportunity.match_status === "active_pursuit" && opportunity.pursuit_stage && <Badge variant="outline">{pursuitStageUiLabel(opportunity.pursuit_stage, language)}</Badge>}
          {opportunity.pursuit_stage_provenance === "staff_confirmed_history" && <Badge variant="outline">{copy("Stage confirmed by Re-New")}</Badge>}
          {isStaffRecommended(opportunity) && !opportunity.interest_rejected
            && opportunity.match_status !== "declined" && opportunity.match_status !== "dropped" && opportunity.match_status !== "withdrawn"
            ? <Badge variant="secondary">{copy("Selected by Re-New")}</Badge> : null}
          {responseExpired ? <Badge variant="outline">{copy("Response window expired")}</Badge> : null}
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.025em]">{opportunityTitle(opportunity, language)}</h1>
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-4" />
              {displayRepreneurOpportunityGeography(opportunity.location, language)}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-4" />
              {copy("Added {date}", { date: language === "en" ? opportunity.date_added_display_en ?? opportunity.date_added_display ?? "-" : opportunity.date_added_display ?? "-" })}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-4" />
              {copy("{count} people", { count: opportunity.headcount_range ?? opportunity.headcount ?? "-" })}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{opportunity.sector ?? opportunity.activity ?? copy("Sector to confirm")}</span>
            {responsePending && responseDeadline ? <span>{copy(responseExpired ? "Response window expired: {date}" : "Respond by: {date}", { date: responseDeadline })}</span> : null}
          </div>
          {opportunity.pursuit_stage_provenance === "staff_confirmed_history" ? <p className="mt-2 text-xs text-muted-foreground">{copy("This progress was confirmed by Re-New from the existing process. Document checks and access remain separate.")}</p> : null}
        </div>
      </header>

      {(opportunity.match_status || canExpressUnassignedInterest) ? <Card>
        <CardHeader>
          <CardTitle>{copy(canExpressUnassignedInterest ? "Express interest" : readOnly ? "Response" : "Your response")}</CardTitle>
          <CardDescription>
            {readOnly
              ? copy("Current repreneur-facing status for this opportunity.")
              : copy("Tell Re-New whether this opportunity should be explored further.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {opportunity.match_status === "interested" && !opportunity.interest_rejected && !lockedForAnotherRepreneur && (
            <Alert>
              <CheckCircle2 />
              <AlertTitle>{copy("Interest sent")}</AlertTitle>
              <AlertDescription>{copy("Re-New can now review this signal and decide the next step.")}</AlertDescription>
            </Alert>
          )}

          {opportunity.match_status === "interested" && opportunity.interest_rejected && (
            <Alert>
              <XCircle />
              <AlertTitle>{copy("Interest not selected")}</AlertTitle>
              <AlertDescription>{copy("Re-New will not continue with this opportunity for now. Your account and access to other opportunities are unchanged. Contact Re-New if you would like to discuss next steps.")}</AlertDescription>
            </Alert>
          )}

          {opportunity.match_status === "withdrawn" && (
            <Alert>
              <XCircle />
              <AlertTitle>{copy("Interest withdrawn")}</AlertTitle>
              <AlertDescription>{copy("This request is no longer awaiting Re-New validation. If this opportunity remains eligible, you can express a fresh interest; earlier emails and history remain recorded.")}</AlertDescription>
            </Alert>
          )}

          {!readOnly && !withdrawalPaused && opportunity.match_status === "interested" && !opportunity.interest_rejected
            && opportunity.match_id && opportunity.interest_expressed_at && (
            <InterestWithdrawalControl onConfirm={(reason) => withdrawMyOpportunityInterest(
              opportunity.match_id!, opportunity.opportunity_id, opportunity.interest_expressed_at!, opportunity.updated_at, reason,
            )} />
          )}

          {opportunity.match_status === "dropped" && !lockedForAnotherRepreneur && (
            <Alert>
              <XCircle />
              <AlertTitle>{copy("Pursuit dropped")}</AlertTitle>
              <AlertDescription>{copy("This retained history has no confidential access. You can safely ask Re-New to reconsider the opportunity.")}</AlertDescription>
            </Alert>
          )}

          {opportunity.match_status === "declined" && !lockedForAnotherRepreneur && (
            <Alert>
              <XCircle />
              <AlertTitle>{copy("Marked as not a fit")}</AlertTitle>
              <AlertDescription>
                {copy("This response is visible to Re-New for review.")}
                {opportunity.decline_reason_categories && opportunity.decline_reason_categories.length > 0 ? (
                  <>
                    {" "}
                    {copy("Reasons: {reasons}.", { reasons: opportunity.decline_reason_categories
                      .map((reason) => declineReasonUiLabel(reason, language))
                      .join(", ") })}
                  </>
                ) : null}
              </AlertDescription>
            </Alert>
          )}

          {opportunity.match_status === "active_pursuit" && (
            <Alert>
              <CheckCircle2 />
              <AlertTitle>{copy("Active pursuit")}</AlertTitle>
              <AlertDescription>{copy("Re-New has validated this opportunity as an active pursuit. The next available action is shown in the documents area below.")}</AlertDescription>
            </Alert>
          )}

          {(lockedForAnotherRepreneur || canExpressUnassignedInterest || opportunity.match_status === "withdrawn") && (!readOnly || !staffAssistanceControls) ? (
            <LockedOpportunityInterestAction
              opportunityId={opportunity.opportunity_id}
              interestRecorded={opportunity.match_status !== "withdrawn" && Boolean(opportunity.interest_expressed_at)}
              notificationSent={opportunity.match_status !== "withdrawn" && Boolean(opportunity.interest_notification_sent_at)}
              lockedForAnotherRepreneur={lockedForAnotherRepreneur}
              readOnly={readOnly}
              recommendationExpiresAt={opportunity.match_status === "withdrawn" ? null : opportunity.recommendation_expires_at}
              withdrawnExpectation={opportunity.match_status === "withdrawn" && opportunity.interest_expressed_at
                ? { interestAt: opportunity.interest_expressed_at, updatedAt: opportunity.updated_at } : undefined}
            />
          ) : null}

          {readOnly && staffAssistanceControls}
          {readOnly && !staffAssistanceControls && !lockedForAnotherRepreneur && canRespond(opportunity.match_status) && (
            <Alert>
              <ShieldCheck />
              <AlertTitle>{copy("Staff assistance")}</AlertTitle>
              <AlertDescription>{copy("Personal review markers stay with the repreneur. Attributed staff response controls are provided through the assistance workflow.")}</AlertDescription>
            </Alert>
          )}

          {!readOnly && !lockedForAnotherRepreneur && !opportunity.interest_rejected && interestAction && canRespond(opportunity.match_status) && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <form action={interestAction} data-wave-action="express_interest" data-wave-workflow="portal_deals">
                <Button type="submit" disabled={opportunity.match_status === "interested" || responseExpired}>
                  <CheckCircle2 data-icon="inline-start" />
                  {copy(opportunity.match_status === "interested" ? "Interest sent" : responseExpired ? "Response window expired" : opportunity.match_status === "declined" || opportunity.match_status === "dropped" ? "Review and reconsider" : "I'm interested")}
                </Button>
              </form>
            </div>
          )}

          {!readOnly && !lockedForAnotherRepreneur && !opportunity.interest_rejected && opportunity.match_id && opportunity.match_status !== "declined" && opportunity.match_status !== "dropped" && canRespond(opportunity.match_status) && (
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
              {copy("Documents")}
            </CardTitle>
            <CardDescription>{copy("Each document is released only through the canonical confidentiality journey.")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {!memoAvailable && (
              <Alert>
                <FileText />
                <AlertTitle>{copy(journey?.gate1Passed ? "Information memorandum locked" : "Confidential documents locked")}</AlertTitle>
                <AlertDescription>
                  {!journey?.enabled
                    ? copy("The confidential journey is not enabled for this opportunity. Re-New will tell you when the next action is available.")
                    : journey.revoked
                      ? copy("Confidential access has been revoked for this pursuit.")
                      : journey.ndaReadyNotified
                        ? copy("Your NDA is ready. Upload your signed copy for Re-New review. The Information Memorandum remains locked until the signed NDA handoff and staff approval are complete.")
                        : copy("Re-New is preparing your NDA. We will notify you when it is ready to download and sign.")}
                </AlertDescription>
              </Alert>
            )}

            {journey?.enabled && journey.ndaReadyNotified && !journey.revoked ? <>
              <div className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{copy("NDA template")}</p><p className="text-xs text-muted-foreground">{copy("Use this exact validated template for your signed copy.")}</p></div>{ndaTemplateHref ? <Button asChild variant="outline" size="sm"><a href={ndaTemplateHref}><Download data-icon="inline-start" />{copy("Download template")}</a></Button> : null}</div>
              {readOnly ? staffDocumentAssistanceControls : null}
              {!journey.gate2Passed && !readOnly && opportunity.match_id ? <RepreneurNdaSignatureUpload matchId={opportunity.match_id} /> : null}
            </> : null}

            {memoAvailable && journey?.confidentialGrant ? <>
              <div className="rounded-md border p-3">
                <p className="font-medium">{copy("Disclosed source")}</p>
                <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs text-muted-foreground">{copy("Firm and office")}</dt><dd>{journey.confidentialGrant.source.firmName} · {journey.confidentialGrant.source.officeName}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">{copy(journey.confidentialGrant.source.contactNames.length === 1 ? "Named contact" : "Named contacts")}</dt><dd>{journey.confidentialGrant.source.contactNames.join(", ")}</dd></div>
                </dl>
              </div>
              <div className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{copy("Information memorandum (IM)")}</p><p className="text-xs text-muted-foreground">{copy("This exact IM was explicitly granted to this pursuit.")}</p></div>{informationMemorandumHref ? <Button asChild variant="outline" size="sm"><a href={informationMemorandumHref}><Download data-icon="inline-start" />{copy("Download IM")}</a></Button> : null}</div>
            </> : null}
          </CardContent>
        </Card>
      )}

      <div className="grid overflow-hidden rounded-lg border bg-card sm:grid-cols-2 md:grid-cols-4">
        <Card className="rounded-none border-0 border-b py-4 md:border-b-0 md:border-r">
          <CardHeader className="pb-2">
            <CardDescription>{copy("Revenue")}</CardDescription>
            <CardTitle>{formatNumber(opportunity.revenue_meur, "M EUR", language)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="rounded-none border-0 border-b py-4 sm:border-l md:border-b-0 md:border-l-0 md:border-r">
          <CardHeader className="pb-2">
            <CardDescription>{copy("EBITDA")}</CardDescription>
            <CardTitle>{formatNumber(opportunity.ebitda_keur, "K EUR", language)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="rounded-none border-0 border-b py-4 md:border-b-0 md:border-r">
          <CardHeader className="pb-2">
            <CardDescription>{copy("EBITDA margin")}</CardDescription>
            <CardTitle>{formatEbitdaMargin(opportunity, language)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="rounded-none border-0 py-4 sm:border-l md:border-l-0">
          <CardHeader className="pb-2">
            <CardDescription>{copy("Team")}</CardDescription>
            <CardTitle>{opportunity.headcount_range ?? opportunity.headcount ?? "-"}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{copy("Opportunity")}</CardTitle>
          <CardDescription>{[opportunity.sector, opportunity.activity].filter(Boolean).join(" / ") || copy("Sector to confirm")}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm leading-6">
            {opportunity.teaser_summary || copy("Anonymized opportunity details are being prepared.")}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
