"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { CircleAlert, XCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { declineMyOpportunity } from "@/lib/actions/repreneur-opportunity-responses"
import {
  OPPORTUNITY_DECLINE_REASON_OPTIONS,
  type OpportunityDeclineReasonCategory,
} from "@/lib/types/opportunity"

interface RepreneurOpportunityDeclineActionProps {
  matchId: string
  initialReasons: OpportunityDeclineReasonCategory[]
  initialDetails: string
}

type RepreneurOpportunityDeclineActionState =
  | { status: "idle"; message: "" }
  | { status: "error"; message: string }

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
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedReasons, setSelectedReasons] = useState(() => new Set(initialReasons))
  const [details, setDetails] = useState(initialDetails)
  const firstReasonRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const restoreTriggerFocusRef = useRef(false)
  const canSubmit = selectedReasons.size > 0 && details.trim().length > 0
  const disclosureId = `decline-feedback-${matchId}`

  useEffect(() => {
    if (isExpanded) firstReasonRef.current?.focus()
    if (!isExpanded && restoreTriggerFocusRef.current) {
      restoreTriggerFocusRef.current = false
      triggerRef.current?.focus()
    }
  }, [isExpanded])

  function closeDisclosure() {
    restoreTriggerFocusRef.current = true
    setIsExpanded(false)
  }

  function setReason(reason: OpportunityDeclineReasonCategory, checked: boolean) {
    setSelectedReasons((current) => {
      const next = new Set(current)
      if (checked) next.add(reason)
      else next.delete(reason)
      return next
    })
  }

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        aria-expanded={isExpanded}
        aria-controls={disclosureId}
        onClick={() => setIsExpanded((expanded) => !expanded)}
        disabled={pending}
      >
        <XCircle data-icon="inline-start" />
        Not a fit
      </Button>
      {isExpanded ? (
        <div id={disclosureId} className="mt-3">
          <form action={formAction} className="rounded-lg border p-4" data-wave-action="decline" data-wave-workflow="portal_deals">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">Tell Re-New why this is not a fit</p>
          <p className="text-sm text-muted-foreground">
            Select at least one reason and add a brief rationale so Re-New can improve future recommendations.
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
                ref={option === OPPORTUNITY_DECLINE_REASON_OPTIONS[0] ? firstReasonRef : undefined}
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
          <span className="font-medium">Why is this not a fit? (required)</span>
          <textarea
            name="decline_reason_text"
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            required
            rows={3}
            className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Briefly explain why this opportunity is not a fit."
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={closeDisclosure} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="outline" disabled={!canSubmit || pending}>
            {pending ? <Spinner data-icon="inline-start" /> : <XCircle data-icon="inline-start" />}
            {pending ? "Saving response..." : "Confirm not a fit"}
          </Button>
        </div>
      </div>
          </form>
        </div>
      ) : null}
    </>
  )
}
