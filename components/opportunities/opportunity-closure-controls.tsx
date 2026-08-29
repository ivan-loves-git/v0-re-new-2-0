"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { CirclePause, CircleX, History } from "lucide-react"
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
  getOpportunityPauseReasonLabel,
  OPPORTUNITY_CLOSURE_REASON_OPTIONS,
  OPPORTUNITY_PAUSE_REASON_OPTIONS,
  type OpportunityActionResult,
  type OpportunityClosureHistoryEntry,
  type OpportunityClosureReason,
  type OpportunityPauseHistoryEntry,
  type OpportunityPauseReason,
  type OpportunityStatus,
} from "@/lib/types/opportunity"
import { formatDisplayDateTime } from "@/lib/utils/display-date-time"

interface OpportunityClosureControlsProps {
  opportunityStatus: OpportunityStatus
  sourceReviewRequired: boolean
  closureHistory: OpportunityClosureHistoryEntry[]
  pauseHistory: OpportunityPauseHistoryEntry[]
  closeAction: (
    reason: OpportunityClosureReason,
  ) => Promise<OpportunityActionResult>
  pauseAction: (
    reason: OpportunityPauseReason,
  ) => Promise<OpportunityActionResult>
}

function formatLifecycleTimestamp(value: string) {
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
  pauseHistory,
  closeAction,
  pauseAction,
}: OpportunityClosureControlsProps) {
  const router = useRouter()
  const [selectedClosureReason, setSelectedClosureReason] = useState<
    OpportunityClosureReason | ""
  >("")
  const [selectedPauseReason, setSelectedPauseReason] = useState<
    OpportunityPauseReason | ""
  >("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const summaryRef = useRef<HTMLDivElement>(null)
  const isHistorical =
    opportunityStatus === "closed" || opportunityStatus === "archived"

  async function runAction(action: () => Promise<OpportunityActionResult>) {
    setIsSubmitting(true)
    try {
      const result = await action()
      if (!result.success) {
        setFieldErrors(result.fieldErrors ?? { form: result.message })
        focusValidationSummary(summaryRef)
        toast.error(result.message)
        return
      }

      toast.success(result.message)
      setSelectedClosureReason("")
      setSelectedPauseReason("")
      setFieldErrors({})
      router.refresh()
    } catch (error) {
      console.error("Opportunity lifecycle update failed")
      const message =
        error instanceof Error
          ? error.message
          : "Opportunity lifecycle could not be updated."
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
          {isHistorical ? (
            <History className="size-5" />
          ) : (
            <CirclePause className="size-5" />
          )}
          Opportunity lifecycle
        </CardTitle>
        <CardDescription>
          {isHistorical
            ? "This opportunity is retained as history."
            : "Pause is temporary. Closure is a permanent outcome for the whole deal."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 py-5">
        <ValidationSummary
          ref={summaryRef}
          errors={fieldErrors}
          labels={{
            reason: "Closure reason",
            closure_reason: "Closure reason",
            pause_reason: "Pause reason",
            form: "Opportunity lifecycle",
          }}
        />

        {isHistorical ? (
          <p className="text-sm text-muted-foreground">
            The recorded source and lifecycle context cannot be changed from
            this screen. Reopening remains a separate controlled workflow.
          </p>
        ) : (
          <>
            <section className="space-y-3" aria-labelledby="pause-opportunity-title">
              <div>
                <h3 id="pause-opportunity-title" className="font-medium">
                  Pause opportunity
                </h3>
                <p className="text-sm text-muted-foreground">
                  Use this when the cabinet temporarily stops the deal. It does
                  not close the opportunity or end one repreneur pursuit.
                </p>
              </div>
              {opportunityStatus === "active" ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1 space-y-2">
                    <FormFieldLabel
                      htmlFor="opportunity-pause-reason"
                      requirement="required"
                    >
                      Pause reason
                    </FormFieldLabel>
                    <Select
                      value={selectedPauseReason}
                      onValueChange={(value) => {
                        setSelectedPauseReason(value as OpportunityPauseReason)
                        setFieldErrors({})
                      }}
                    >
                      <SelectTrigger
                        id="opportunity-pause-reason"
                        {...fieldErrorProps(
                          "opportunity-pause-reason",
                          fieldErrors.pause_reason,
                        )}
                      >
                        <SelectValue placeholder="Choose a pause reason" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {OPPORTUNITY_PAUSE_REASON_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldError
                      id="opportunity-pause-reason"
                      message={fieldErrors.pause_reason}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!selectedPauseReason || isSubmitting}
                    onClick={() =>
                      runAction(() =>
                        pauseAction(selectedPauseReason as OpportunityPauseReason),
                      )
                    }
                  >
                    <CirclePause data-icon="inline-start" />
                    {isSubmitting ? "Pausing..." : "Pause opportunity"}
                  </Button>
                </div>
              ) : opportunityStatus === "paused" ? (
                <p className="text-sm text-amber-700">
                  This opportunity is paused. Use Edit to return it to Active
                  when the cabinet resumes the deal.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Activate this opportunity before pausing it.
                </p>
              )}
            </section>

            <section
              className="space-y-3 border-t pt-5"
              aria-labelledby="close-opportunity-title"
            >
              <div>
                <h3 id="close-opportunity-title" className="font-medium">
                  Close opportunity permanently
                </h3>
                <p className="text-sm text-muted-foreground">
                  Choose deal-wide due diligence only when the deal is
                  unsuitable for every repreneur. To end one pursuit, use its
                  Drop control instead.
                </p>
              </div>
              {sourceReviewRequired ? (
                <p className="text-sm text-amber-700">
                  Close is unavailable until the provisional source is corrected.
                </p>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1 space-y-2">
                    <FormFieldLabel
                      htmlFor="opportunity-closure-reason"
                      requirement="required"
                    >
                      Permanent closure reason
                    </FormFieldLabel>
                    <Select
                      value={selectedClosureReason}
                      onValueChange={(value) => {
                        setSelectedClosureReason(value as OpportunityClosureReason)
                        setFieldErrors({})
                      }}
                    >
                      <SelectTrigger
                        id="opportunity-closure-reason"
                        {...fieldErrorProps(
                          "opportunity-closure-reason",
                          fieldErrors.closure_reason,
                        )}
                      >
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
                    <FieldError
                      id="opportunity-closure-reason"
                      message={fieldErrors.closure_reason}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={!selectedClosureReason || isSubmitting}
                    onClick={() =>
                      runAction(() =>
                        closeAction(
                          selectedClosureReason as OpportunityClosureReason,
                        ),
                      )
                    }
                  >
                    <CircleX data-icon="inline-start" />
                    {isSubmitting ? "Closing..." : "Close permanently"}
                  </Button>
                </div>
              )}
            </section>
          </>
        )}

        {pauseHistory.length > 0 ? (
          <section className="space-y-3" aria-labelledby="pause-history-title">
            <div className="flex items-center gap-2">
              <History className="size-4 text-muted-foreground" />
              <h3 id="pause-history-title" className="text-sm font-medium">
                Pause history
              </h3>
            </div>
            <div className="divide-y rounded-md border">
              {pauseHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="font-medium text-foreground">
                    {getOpportunityPauseReasonLabel(entry.reason)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatLifecycleTimestamp(entry.paused_at)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {closureHistory.length > 0 ? (
          <section className="space-y-3" aria-labelledby="closure-history-title">
            <div className="flex items-center gap-2">
              <History className="size-4 text-muted-foreground" />
              <h3 id="closure-history-title" className="text-sm font-medium">
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
                    {formatLifecycleTimestamp(entry.closed_at)}
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
