"use client"

import { useRef, useState } from "react"
import { FormFieldLabel } from "@/components/forms/validation-feedback"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  OPPORTUNITY_PURSUIT_DROP_REASON_GROUPS,
  getOpportunityPursuitDropReasonLabel,
  validateOpportunityPursuitDropInput,
  type OpportunityPursuitDropInput,
  type OpportunityPursuitDropReason,
} from "@/lib/opportunity-outcome-reasons"

function emptyDecision(): OpportunityPursuitDropInput {
  return { primaryReason: "", secondaryReasons: [], note: "" }
}

/** A failed submission retains its exact decision and retry key. */
export function usePursuitDropForm() {
  const [value, setValue] = useState<OpportunityPursuitDropInput>(emptyDecision)
  const retryKey = useRef<string | null>(null)
  function onChange(next: OpportunityPursuitDropInput) {
    retryKey.current = null
    setValue(next)
  }
  function getIdempotencyKey() {
    retryKey.current ??= crypto.randomUUID()
    return retryKey.current
  }
  return {
    value,
    onChange,
    reset: () => onChange(emptyDecision()),
    getIdempotencyKey,
    canSubmit: validateOpportunityPursuitDropInput(value.primaryReason, value.secondaryReasons, value.note).success,
  }
}

export function PursuitDropReasonFields({ id, value, onChange, disabled = false }: {
  id: string
  value: OpportunityPursuitDropInput
  onChange: (value: OpportunityPursuitDropInput) => void
  disabled?: boolean
}) {
  const undisclosed = value.primaryReason === "reason_not_disclosed"
  const explanationRequired = value.primaryReason === "other" || value.secondaryReasons.includes("other")
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">Staff only</Badge>
        <span>Reasons and notes stay in the staff history.</span>
      </div>
      <div className="space-y-2">
        <FormFieldLabel htmlFor={`${id}-primary`} requirement="required">Main reason</FormFieldLabel>
        <Select disabled={disabled} value={value.primaryReason} onValueChange={(reason: OpportunityPursuitDropReason) => onChange({
          ...value,
          primaryReason: reason,
          secondaryReasons: reason === "reason_not_disclosed" ? [] : value.secondaryReasons.filter((secondary) => secondary !== reason),
        })}>
          <SelectTrigger id={`${id}-primary`} className="h-auto min-h-9 w-full whitespace-normal text-left"><SelectValue placeholder="Choose why this pursuit is ending" /></SelectTrigger>
          <SelectContent>
            {OPPORTUNITY_PURSUIT_DROP_REASON_GROUPS.map((group) => <SelectGroup key={group.label}>
              <SelectLabel>{group.label}</SelectLabel>
              {group.reasons.map((reason) => <SelectItem key={reason.value} value={reason.value} className="whitespace-normal">{reason.label}</SelectItem>)}
            </SelectGroup>)}
          </SelectContent>
        </Select>
        {value.primaryReason === "path_stopped_seller_advisor" ? <p className="text-xs text-muted-foreground">The seller or advisor stopped this buyer’s path. The opportunity stays open.</p> : null}
      </div>
      {undisclosed ? <p className="text-sm text-muted-foreground">Reason not disclosed is used alone, without secondary reasons.</p> : <details className="rounded-md border p-3">
        <summary className="cursor-pointer text-sm font-medium">Secondary reasons (optional){value.secondaryReasons.length ? ` · ${value.secondaryReasons.length} selected` : ""}</summary>
        <div className="mt-4 max-h-72 space-y-4 overflow-y-auto pr-1">
          {OPPORTUNITY_PURSUIT_DROP_REASON_GROUPS.map((group) => {
            const reasons = group.reasons.filter((reason) => reason.value !== value.primaryReason && reason.value !== "reason_not_disclosed")
            return reasons.length ? <fieldset key={group.label} className="space-y-2">
              <legend className="mb-2 text-xs font-medium text-muted-foreground">{group.label}</legend>
              {reasons.map((reason) => <div key={reason.value} className="flex items-start gap-2">
                <Checkbox id={`${id}-${reason.value}`} disabled={disabled} checked={value.secondaryReasons.includes(reason.value)} onCheckedChange={(checked) => onChange({ ...value, secondaryReasons: checked === true ? [...value.secondaryReasons, reason.value] : value.secondaryReasons.filter((secondary) => secondary !== reason.value) })} />
                <Label htmlFor={`${id}-${reason.value}`} className="text-sm leading-5">{reason.label}</Label>
              </div>)}
            </fieldset> : null
          })}
        </div>
      </details>}
      <div className="space-y-2">
        <FormFieldLabel htmlFor={`${id}-note`} requirement={explanationRequired ? "required" : "optional"}>Context note</FormFieldLabel>
        <Textarea id={`${id}-note`} disabled={disabled} maxLength={4000} value={value.note} onChange={(event) => onChange({ ...value, note: event.target.value })} placeholder={explanationRequired ? "Briefly explain Other before confirming." : "Add useful context for the staff (optional)."} />
        {explanationRequired ? <p className="text-xs text-muted-foreground">Other needs an explanation, even as a secondary reason.</p> : null}
      </div>
      {value.primaryReason ? <div className="space-y-1 rounded-md bg-muted p-3 text-sm" aria-live="polite">
        <p className="font-medium">Drop this pursuit only</p>
        <p>Main: {getOpportunityPursuitDropReasonLabel(value.primaryReason)}</p>
        {value.secondaryReasons.length ? <p>Secondary: {value.secondaryReasons.map(getOpportunityPursuitDropReasonLabel).join("; ")}</p> : null}
        <p className="text-xs text-muted-foreground">The opportunity’s status stays unchanged. This pursuit’s confidential access is revoked.</p>
      </div> : null}
    </div>
  )
}
