"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { CircleX, History } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  FieldError,
  FormFieldLabel,
  ValidationSummary,
  fieldErrorProps,
  focusValidationSummary,
  type FieldErrors,
} from "@/components/forms/validation-feedback"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getOpportunityClosureReasonLabel,
  OPPORTUNITY_CLOSURE_REASON_OPTIONS,
  type OpportunityActionResult,
  type OpportunityClosureHistoryEntry,
  type OpportunityClosureReason,
  type OpportunityStatus,
} from "@/lib/types/opportunity"
import { formatDisplayDateTime } from "@/lib/utils/display-date-time"

interface OpportunityClosureControlsProps {
  opportunityStatus: OpportunityStatus
  sourceReviewRequired: boolean
  closureHistory: OpportunityClosureHistoryEntry[]
  closeAction: (
    reason: OpportunityClosureReason,
  ) => Promise<OpportunityActionResult>
}

function formatClosureTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Unknown date"
  return formatDisplayDateTime(value, "fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function OpportunityClosureControls({
  opportunityStatus,
  sourceReviewRequired,
  closureHistory,
  closeAction,
}: OpportunityClosureControlsProps) {
  const router = useRouter()
  const [selectedReason, setSelectedReason] = useState<
    OpportunityClosureReason | ""
  >("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const summaryRef = useRef<HTMLDivElement>(null)
  const isClosed = opportunityStatus === "closed"
  const isHistorical = isClosed || opportunityStatus === "archived"

  async function runAction(action: () => Promise<OpportunityActionResult>) {
    setIsSubmitting(true)
    try {
      const result = await action()
      if (!result.success) {
        setFieldErrors({ form: result.message })
        focusValidationSummary(summaryRef)
        toast.error(result.message)
        return
      }

      toast.success(result.message)
      setSelectedReason("")
      setFieldErrors({})
      router.refresh()
    } catch (error) {
      console.error("Opportunity closure update failed")
      const message = error instanceof Error ? error.message : "Opportunity closure could not be updated."
      setFieldErrors({ form: message })
      focusValidationSummary(summaryRef)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="flex items-center gap-2">
          <CircleX className="size-5" />
          {isHistorical ? "Historical opportunity" : "Close opportunity"}
        </CardTitle>
        <CardDescription>
          {isHistorical
            ? "Reopening is unavailable until a dedicated canonical office and primary-contact workflow is released."
            : sourceReviewRequired
              ? "Source review is required before this opportunity can be closed."
              : "A required canonical reason creates an immutable internal closure record."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 py-5">
        {isHistorical ? (
          <p className="text-sm text-muted-foreground">
            The recorded source and closure context is retained as history and
            cannot be changed from this screen.
          </p>
        ) : sourceReviewRequired ? (
          <p className="text-sm text-amber-700">
            Close is unavailable until the provisional source is corrected in the source-review banner above.
          </p>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-2">
              <ValidationSummary ref={summaryRef} errors={fieldErrors} labels={{ reason: "Closure reason", form: "Closure" }} />
              <FormFieldLabel htmlFor="opportunity-closure-reason" requirement="required">Closure reason</FormFieldLabel>
              <Select
                value={selectedReason}
                onValueChange={(value) => { setSelectedReason(value as OpportunityClosureReason); setFieldErrors({}) }}
              >
                <SelectTrigger id="opportunity-closure-reason" {...fieldErrorProps("opportunity-closure-reason", fieldErrors.reason)}>
                  <SelectValue placeholder="Choose a closure reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {OPPORTUNITY_CLOSURE_REASON_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldError id="opportunity-closure-reason" message={fieldErrors.reason} />
            </div>
            <Button
              type="button"
              variant="destructive"
              onClick={() =>
                runAction(() =>
                  closeAction(selectedReason as OpportunityClosureReason),
                )
              }
              disabled={!selectedReason || isSubmitting}
            >
              <CircleX data-icon="inline-start" />
              {isSubmitting ? "Closing..." : "Close opportunity"}
            </Button>
          </div>
        )}

        {closureHistory.length > 0 ? (
          <section
            className="space-y-3"
            aria-labelledby="closure-history-title"
          >
            <div className="flex items-center gap-2">
              <History className="size-4 text-muted-foreground" />
              <h3
                id="closure-history-title"
                className="text-sm font-medium text-foreground"
              >
                Closure history
              </h3>
            </div>
            <div className="divide-y rounded-md border">
              {closureHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="font-medium text-foreground">
                    {getOpportunityClosureReasonLabel(entry.reason)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatClosureTimestamp(entry.closed_at)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </CardContent>
    </Card>
  )
}
