"use client"

import { useActionState, useState } from "react"
import { CircleAlert, XCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  declineMyOpportunity,
  type RepreneurOpportunityDeclineActionState,
} from "@/lib/actions/repreneur-opportunities"
import {
  OPPORTUNITY_DECLINE_REASON_OPTIONS,
  type OpportunityDeclineReasonCategory,
} from "@/lib/types/opportunity"

interface RepreneurOpportunityDeclineActionProps {
  matchId: string
  initialReasons: OpportunityDeclineReasonCategory[]
  initialDetails: string
}

const INITIAL_REPRENEUR_OPPORTUNITY_DECLINE_STATE: RepreneurOpportunityDeclineActionState = {
  status: "idle",
  message: "",
}

export function RepreneurOpportunityDeclineAction({
  matchId,
  initialReasons,
  initialDetails,
}: RepreneurOpportunityDeclineActionProps) {
  const [state, formAction, pending] = useActionState(
    declineMyOpportunity.bind(null, matchId),
    INITIAL_REPRENEUR_OPPORTUNITY_DECLINE_STATE,
  )
  const [selectedReasons, setSelectedReasons] = useState(() => new Set(initialReasons))
  const [details, setDetails] = useState(initialDetails)
  const otherSelected = selectedReasons.has("other")
  const canSubmit = selectedReasons.size > 0 && (!otherSelected || details.trim().length > 0)

  function setReason(reason: OpportunityDeclineReasonCategory, checked: boolean) {
    setSelectedReasons((current) => {
      const next = new Set(current)
      if (checked) next.add(reason)
      else next.delete(reason)
      return next
    })
  }

  return (
    <form action={formAction} className="rounded-md border p-4">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm font-medium">Not a fit?</p>
          <p className="text-sm text-muted-foreground">
            Select at least one reason so Re-New can improve future recommendations.
          </p>
        </div>

        {state.status === "error" ? (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>Response not saved</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">Reasons this opportunity is not a fit</legend>
          {OPPORTUNITY_DECLINE_REASON_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="decline_reason_categories"
                value={option.value}
                checked={selectedReasons.has(option.value)}
                onChange={(event) => setReason(option.value, event.target.checked)}
                className="mt-1 size-4 rounded border-border"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>

        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium">{otherSelected ? "Details (required for Other)" : "Details if useful"}</span>
          <textarea
            name="decline_reason_text"
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            required={otherSelected}
            rows={3}
            className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Add context if you selected Other or want to clarify the reason."
          />
        </label>

        <Button type="submit" variant="outline" className="w-fit" disabled={!canSubmit || pending}>
          {pending ? <Spinner data-icon="inline-start" /> : <XCircle data-icon="inline-start" />}
          {pending ? "Saving response..." : "Not a fit"}
        </Button>
      </div>
    </form>
  )
}
