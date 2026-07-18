"use client"

import { useActionState } from "react"
import { CheckCircle2, LockKeyhole, MailWarning } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { expressLockedOpportunityInterestAction } from "@/lib/actions/locked-opportunity-interest"

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
  readOnly?: boolean
}

export function LockedOpportunityInterestAction({
  opportunityId,
  interestRecorded,
  notificationSent,
  readOnly = false,
}: LockedOpportunityInterestActionProps) {
  const [state, formAction, pending] = useActionState(
    expressLockedOpportunityInterestAction,
    INITIAL_LOCKED_OPPORTUNITY_INTEREST_STATE,
  )
  const recorded = interestRecorded || state.recorded
  const confirmed = notificationSent || state.status === "success"

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
      <Alert>
        <LockKeyhole />
        <AlertTitle>Someone is already positioned</AlertTitle>
        <AlertDescription>
          Re-New works with one candidate at a time on each opportunity. You can still express interest, and the team will follow up directly without changing the current pursuit.
        </AlertDescription>
      </Alert>

      {readOnly ? (
        <p className="text-sm text-muted-foreground">
          In the live portal, the repreneur can express interest from here. The action is disabled in staff preview.
        </p>
      ) : (
        <>
          {state.status === "error" ? (
            <Alert variant={state.recorded ? "default" : "destructive"}>
              <MailWarning />
              <AlertTitle>{state.recorded ? "Interest recorded" : "Interest not sent"}</AlertTitle>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}

          <form action={formAction}>
            <input type="hidden" name="opportunity_id" value={opportunityId} />
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : <CheckCircle2 data-icon="inline-start" />}
              {pending
                ? "Sending interest..."
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
