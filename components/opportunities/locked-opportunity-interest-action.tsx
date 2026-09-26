"use client"

import { useActionState } from "react"
import { CheckCircle2, LockKeyhole, MailWarning } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { expressOpportunityInterestAction } from "@/lib/actions/locked-opportunity-interest"
import { isRecommendationResponseOpen } from "@/lib/opportunity-recommendation-window"

type LockedOpportunityInterestActionState =
  | { status: "idle"; message: ""; recorded: false }
  | { status: "success"; message: string; recorded: true }
  | { status: "error"; message: string; recorded: boolean }

const INITIAL_LOCKED_OPPORTUNITY_INTEREST_STATE: LockedOpportunityInterestActionState = {
  status: "idle",
  message: "",
  recorded: false,
}

interface LockedOpportunityInterestActionProps {
  opportunityId: string
  interestRecorded: boolean
  notificationSent: boolean
  lockedForAnotherRepreneur?: boolean
  readOnly?: boolean
  recommendationExpiresAt?: string | null
  withdrawnExpectation?: { interestAt: string; updatedAt: string }
}

export function LockedOpportunityInterestAction({
  opportunityId,
  interestRecorded,
  notificationSent,
  lockedForAnotherRepreneur = false,
  readOnly = false,
  recommendationExpiresAt,
  withdrawnExpectation,
}: LockedOpportunityInterestActionProps) {
  const [state, formAction, pending] = useActionState(
    expressOpportunityInterestAction,
    INITIAL_LOCKED_OPPORTUNITY_INTEREST_STATE,
  )
  const recorded = interestRecorded || state.recorded
  const confirmed = notificationSent || state.status === "success"
  const responseExpired = !recorded && !isRecommendationResponseOpen(recommendationExpiresAt)

  if (confirmed) {
    return (
      <Alert>
        <CheckCircle2 />
        <AlertTitle>Interest received</AlertTitle>
        <AlertDescription>
          {state.status === "success"
            ? state.message
            : "Thank you. Re-New has your interest and will follow up with you directly."}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {lockedForAnotherRepreneur ? (
        <Alert>
          <LockKeyhole />
          <AlertTitle>Someone is already positioned</AlertTitle>
          <AlertDescription>
            Re-New works with one candidate at a time on each opportunity. You can still express interest, and the team will follow up directly without changing the current pursuit.
          </AlertDescription>
        </Alert>
      ) : null}

      {readOnly ? (
        <p className="text-sm text-muted-foreground">
          In the live portal, the repreneur can express interest from here. The action is disabled in staff preview.
        </p>
      ) : (
        <>
          {responseExpired ? (
            <Alert>
              <LockKeyhole />
              <AlertTitle>Recommendation response window expired</AlertTitle>
              <AlertDescription>Re-New can renew this recommendation if it remains appropriate. No interest signal can be sent from this page.</AlertDescription>
            </Alert>
          ) : null}
          {state.status === "error" ? (
            <Alert variant={state.recorded ? "default" : "destructive"}>
              <MailWarning />
              <AlertTitle>{state.recorded ? "Interest recorded" : "Interest not sent"}</AlertTitle>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}

          <form action={formAction} data-wave-action="express_interest" data-wave-workflow="portal_deals">
            <input type="hidden" name="opportunity_id" value={opportunityId} />
            {withdrawnExpectation && <>
              <input type="hidden" name="withdrawn_interest_at" value={withdrawnExpectation.interestAt} />
              <input type="hidden" name="withdrawn_updated_at" value={withdrawnExpectation.updatedAt} />
            </>}
            <Button type="submit" disabled={pending || responseExpired}>
              {pending ? <Spinner data-icon="inline-start" /> : <CheckCircle2 data-icon="inline-start" />}
              {pending
                ? "Sending interest..."
                : responseExpired
                  ? "Response window expired"
                  : recorded
                  ? "Retry email alert"
                  : "Express interest"}
            </Button>
          </form>
        </>
      )}
    </div>
  )
}
