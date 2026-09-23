"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { recordStaffPortalOpportunityResponse, type StaffOpportunityResponseInput } from "@/lib/actions/staff-portal-assistance"
import { isRecommendationResponseOpen } from "@/lib/opportunity-recommendation-window"
import { OPPORTUNITY_DECLINE_REASON_OPTIONS, type OpportunityDeclineReasonCategory } from "@/lib/types/opportunity"

type Props = Omit<StaffOpportunityResponseInput, "response" | "declineReasonCategories" | "declineReasonText" | "operationKey"> & {
  selectionToken: string
  repreneurName: string
  opportunityTitle: string
  matchStatus: string | null
  interestRejected: boolean
  recommendationExpiresAt: string | null | undefined
}

export function StaffOpportunityResponseControls(props: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirmed, setConfirmed] = useState(false)
  const [reasons, setReasons] = useState<OpportunityDeclineReasonCategory[]>([])
  const [reasonText, setReasonText] = useState("")
  const retry = useRef<{ fingerprint: string; key: string } | null>(null)
  const eligible = !props.interestRejected
    && (!props.matchId || ["proposed", "interested", "declined", "dropped"].includes(props.matchStatus ?? ""))
  const interestOpen = props.matchStatus === "interested"
    || isRecommendationResponseOpen(props.recommendationExpiresAt)
  const canInterest = eligible && props.matchStatus !== "interested" && interestOpen
  const canDecline = eligible && Boolean(props.matchId)
    && ["proposed", "interested"].includes(props.matchStatus ?? "")

  function submit(response: "interested" | "declined") {
    const draft = {
      repreneurId: props.repreneurId,
      selectionToken: props.selectionToken,
      opportunityId: props.opportunityId,
      matchId: props.matchId,
      expectedOpportunityUpdatedAt: props.expectedOpportunityUpdatedAt,
      expectedMatchUpdatedAt: props.expectedMatchUpdatedAt,
      expectedInterestAt: props.expectedInterestAt,
      response,
      declineReasonCategories: response === "declined" ? reasons : [],
      declineReasonText: response === "declined" ? reasonText.trim() : null,
    }
    const fingerprint = JSON.stringify(draft)
    if (retry.current?.fingerprint !== fingerprint) retry.current = { fingerprint, key: crypto.randomUUID() }
    const input: StaffOpportunityResponseInput = { ...draft, operationKey: retry.current.key }
    startTransition(async () => {
      try {
        await recordStaffPortalOpportunityResponse(input)
        toast.success(`Recorded by Re-New staff for ${props.repreneurName}.`)
        retry.current = null
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "The staff response could not be saved.")
      }
    })
  }

  if (!canInterest && !canDecline) return null
  return <div className="space-y-3 rounded-md border p-4" data-wave-workflow="staff_portal_assistance">
    <p className="text-sm font-medium">Re-New staff response for {props.repreneurName}</p>
    <p className="text-xs text-muted-foreground">Deal: {props.opportunityTitle}. This action records your staff identity; it does not sign in as the repreneur or mark their personal review.</p>
    {canDecline ? <div className="space-y-2">
      <p className="text-sm">Reasons for declining</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {OPPORTUNITY_DECLINE_REASON_OPTIONS.map((option) => <label key={option.value} className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={reasons.includes(option.value)} onChange={(event) => setReasons((current) => event.target.checked ? [...current, option.value] : current.filter((item) => item !== option.value))} />
          {option.label}
        </label>)}
      </div>
      <Label htmlFor="staff-decline-rationale">Rationale for Re-New</Label>
      <textarea id="staff-decline-rationale" className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" maxLength={2000} value={reasonText} onChange={(event) => setReasonText(event.target.value)} />
    </div> : null}
    <label className="flex items-start gap-2 text-sm">
      <Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(value === true)} />
      I am acting as Re-New staff on behalf of {props.repreneurName}; this is my independent staff decision.
    </label>
    <div className="flex flex-wrap gap-2">
      {canInterest ? <Button type="button" disabled={!confirmed || pending} onClick={() => submit("interested")}>{pending ? "Saving…" : props.matchStatus === "declined" || props.matchStatus === "dropped" ? "Reconsider interest" : "Record interest"}</Button> : null}
      {canDecline ? <Button type="button" variant="outline" disabled={!confirmed || pending || reasons.length === 0 || !reasonText.trim()} onClick={() => submit("declined")}>Record not a fit</Button> : null}
    </div>
  </div>
}
