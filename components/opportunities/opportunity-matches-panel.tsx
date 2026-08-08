"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AlertCircle, CheckCircle2, CircleSlash2, Info, RotateCcw, Save, Trash2, UsersRound } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StaffRepreneurCombobox } from "@/components/repreneurs/staff-repreneur-combobox"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  FieldError as ValidationFieldError,
  FormFieldLabel,
  ValidationSummary,
  fieldErrorProps,
  focusValidationSummary,
} from "@/components/forms/validation-feedback"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  dropOpportunityPursuit,
  removeOpportunityMatch,
  reopenDroppedOpportunityMatch,
  saveOpportunityMatch,
  validateOpportunityPursuit,
} from "@/lib/actions/opportunity-matches"
import {
  OPPORTUNITY_MATCH_RECOMMENDATION_OPTIONS,
  OPPORTUNITY_MATCH_STATUS_OPTIONS,
  getOpportunityMatchRecommendationLabel,
  getOpportunityMatchStatusLabel,
  type OpportunityMatch,
  type OpportunityMatchCandidate,
  type OpportunityMatchRecommendation,
} from "@/lib/types/opportunity"

const STAFF_EDITABLE_STATUS_OPTIONS = OPPORTUNITY_MATCH_STATUS_OPTIONS.filter((option) => option.value !== "active_pursuit")
const REPRENEUR_EXPOSURE_STATUSES = new Set(["proposed", "interested"])

interface OpportunityMatchesPanelProps {
  opportunityId: string
  matches: OpportunityMatch[]
  candidates: OpportunityMatchCandidate[]
}

type FeedbackMessage = {
  type: "success" | "error"
  title: string
  description: string
}

type FieldErrors = Record<string, string>

interface FieldInfoProps {
  label: string
  description: string
  example: string
}

function repreneurName(repreneur: OpportunityMatchCandidate | null | undefined) {
  if (!repreneur) return "Unknown repreneur"
  return [repreneur.first_name, repreneur.last_name].filter(Boolean).join(" ") || repreneur.email
}

function recommendationVariant(recommendation: OpportunityMatchRecommendation): "default" | "destructive" | "secondary" | "outline" {
  if (recommendation === "strong_fit") return "default"
  if (recommendation === "not_fit") return "destructive"
  if (recommendation === "possible_fit") return "secondary"
  return "outline"
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return "The action could not be completed. Please try again."
}

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function validateSaveForm(formData: FormData, activeMatch: OpportunityMatch | null): FieldErrors {
  const errors: FieldErrors = {}
  const repreneurId = readFormString(formData, "repreneur_id")
  const status = readFormString(formData, "status") || "proposed"

  if (!repreneurId) {
    errors.repreneur_id = "Select the repreneur this recommendation is for."
  }

  if (activeMatch && REPRENEUR_EXPOSURE_STATUSES.has(status)) {
    errors.status = "This opportunity already has an active pursuit. Save as Draft or Shortlisted, or drop the active pursuit first."
  }

  return errors
}

function FieldInfo({ label, description, example }: FieldInfoProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-5 rounded-full text-muted-foreground"
          aria-label={`About ${label}`}
        >
          <Info data-icon="inline-start" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-80 bg-popover text-popover-foreground shadow-md">
        <span className="flex flex-col gap-1">
          <span className="font-medium">{description}</span>
          <span className="text-muted-foreground">Example: {example}</span>
        </span>
      </TooltipContent>
    </Tooltip>
  )
}

export function OpportunityMatchesPanel({ opportunityId, matches, candidates }: OpportunityMatchesPanelProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const validationSummaryRef = useRef<HTMLDivElement>(null)
  const [selectedRepreneurId, setSelectedRepreneurId] = useState("")
  const activeMatch = matches.find((match) => match.status === "active_pursuit") ?? null
  const selectedCandidate = candidates.find((candidate) => candidate.id === selectedRepreneurId)
  const savedRepreneurIds = new Set(matches.map((match) => match.repreneur_id))
  const topCandidateSuggestions = [...candidates]
    .filter((candidate) => !savedRepreneurIds.has(candidate.id))
    .sort((left, right) => (right.platform_score ?? -1) - (left.platform_score ?? -1))
    .slice(0, 5)

  useEffect(() => {
    if (Object.keys(fieldErrors).length > 0) focusValidationSummary(validationSummaryRef)
  }, [fieldErrors])

  function handleRepreneurChange(value: string) {
    setSelectedRepreneurId(value)
    clearFieldError("repreneur_id")
  }

  function clearFieldError(field: string) {
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
    setFeedback((current) => (current?.type === "error" ? null : current))
  }

  function showFeedback(message: FeedbackMessage) {
    if (message.type === "success") {
      setFeedback(null)
      toast.success(message.title, { description: message.description })
      return
    }

    setFeedback(message)
    toast.error(message.title, { description: message.description })
  }

  async function handleSave(formData: FormData) {
    const validationErrors = validateSaveForm(formData, activeMatch)
    setFieldErrors(validationErrors)
    setFeedback(null)

    if (Object.keys(validationErrors).length > 0) {
      showFeedback({
        type: "error",
        title: "Check the recommendation",
        description: "Fix the highlighted fields before saving.",
      })
      return
    }

    setIsSaving(true)
    try {
      const result = await saveOpportunityMatch(formData)
      if (!result.ok) {
        setFieldErrors(result.field ? { [result.field]: result.message } : { form: result.message })
        showFeedback({
          type: "error",
          title: "Recommendation not saved",
          description: result.message,
        })
        return
      }

      setFieldErrors({})
      showFeedback({
        type: "success",
        title: "Recommendation saved",
        description: "The match record was updated without changing any active pursuit lock.",
      })
    } catch (error) {
      showFeedback({
        type: "error",
        title: "Recommendation not saved",
        description: getErrorMessage(error),
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRemove(matchId: string) {
    setPendingActionId(matchId)
    setFeedback(null)
    try {
      await removeOpportunityMatch(matchId, opportunityId)
      showFeedback({
        type: "success",
        title: "Recommendation removed",
        description: "The match was removed from this opportunity.",
      })
    } catch (error) {
      showFeedback({
        type: "error",
        title: "Recommendation not removed",
        description: getErrorMessage(error),
      })
    } finally {
      setPendingActionId(null)
    }
  }

  async function handleValidate(matchId: string) {
    setPendingActionId(matchId)
    setFeedback(null)
    try {
      await validateOpportunityPursuit(matchId, opportunityId)
      showFeedback({
        type: "success",
        title: "Pursuit validated",
        description: "This repreneur is now the active pursuit for the opportunity.",
      })
    } catch (error) {
      showFeedback({
        type: "error",
        title: "Pursuit not validated",
        description: getErrorMessage(error),
      })
    } finally {
      setPendingActionId(null)
    }
  }

  async function handleDrop(matchId: string) {
    setPendingActionId(matchId)
    setFeedback(null)
    try {
      await dropOpportunityPursuit(matchId, opportunityId)
      showFeedback({
        type: "success",
        title: "Pursuit dropped",
        description: "The opportunity is unlocked for another interested repreneur.",
      })
    } catch (error) {
      showFeedback({
        type: "error",
        title: "Pursuit not dropped",
        description: getErrorMessage(error),
      })
    } finally {
      setPendingActionId(null)
    }
  }

  async function handleReopen(matchId: string) {
    setPendingActionId(matchId)
    setFeedback(null)
    try {
      await reopenDroppedOpportunityMatch(matchId, opportunityId)
      showFeedback({
        type: "success",
        title: "Recommendation reopened",
        description: "The dropped pursuit was moved back to Interested.",
      })
    } catch (error) {
      showFeedback({
        type: "error",
        title: "Recommendation not reopened",
        description: getErrorMessage(error),
      })
    } finally {
      setPendingActionId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersRound data-icon="inline-start" />
            Add recommendation
          </CardTitle>
          <CardDescription>
            Store a match. New assignments default to Proposed so they appear in the repreneur portal; Draft and
            Shortlisted remain available for internal-only staging.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {topCandidateSuggestions.length > 0 ? (
            <div className="rounded-md border border-dashed p-3">
              <div className="mb-3 flex flex-col gap-1">
                <p className="text-sm font-medium">Top platform suggestions</p>
                <p className="text-xs text-muted-foreground">Use one to prefill the recommendation form, then choose the staff status and notes.</p>
              </div>
              <div className="grid gap-2 lg:grid-cols-2">
                {topCandidateSuggestions.map((candidate) => (
                  <div key={candidate.id} className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{repreneurName(candidate)}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{candidate.platform_score ?? "-"}/100</span>
                        {candidate.platform_recommendation ? (
                          <span>{getOpportunityMatchRecommendationLabel(candidate.platform_recommendation)}</span>
                        ) : null}
                      </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => handleRepreneurChange(candidate.id)}>
                      Use
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <form id="opportunity-match-form" action={handleSave} noValidate className="flex flex-col gap-5">
            <input type="hidden" name="opportunity_id" value={opportunityId} />
            <ValidationSummary
              ref={validationSummaryRef}
              errors={fieldErrors}
              labels={{ repreneur_id: "Repreneur", status: "Match status" }}
            />
            {feedback ? (
              <Alert
                role={feedback.type === "success" ? "status" : "alert"}
                variant={feedback.type === "error" ? "destructive" : "default"}
                className={
                  feedback.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-950 shadow-sm [&>svg]:text-emerald-600 *:data-[slot=alert-description]:text-emerald-800"
                    : undefined
                }
              >
                {feedback.type === "error" ? <AlertCircle /> : <CheckCircle2 />}
                <AlertTitle>{feedback.title}</AlertTitle>
                <AlertDescription>{feedback.description}</AlertDescription>
              </Alert>
            ) : null}
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-2">
                <FormFieldLabel htmlFor="repreneur_id" requirement="required">
                  Repreneur
                  <FieldInfo
                    label="Repreneur"
                    description="The person who may receive this opportunity."
                    example="Ivan Demo Repreneur - myworkmail4@gmail.com."
                  />
                </FormFieldLabel>
                <StaffRepreneurCombobox
                  id="repreneur_id"
                  name="repreneur_id"
                  options={candidates}
                  value={selectedRepreneurId}
                  onValueChange={handleRepreneurChange}
                  placeholder={candidates.length === 0 ? "No repreneurs available" : "Choose a repreneur, e.g. Ivan Demo Repreneur"}
                  disabled={candidates.length === 0}
                  {...fieldErrorProps("repreneur_id", fieldErrors.repreneur_id)}
                />
                <ValidationFieldError id="repreneur_id" message={fieldErrors.repreneur_id} />
              </div>
              <div className="flex flex-col gap-2">
                <FormFieldLabel htmlFor="match_status" requirement="required">
                  Match status
                  <FieldInfo
                    label="Match status"
                    description="Proposed appears in the repreneur portal. Draft and Shortlisted stay internal. Interested records the repreneur flow. Active pursuit is only created with Validate."
                    example="Use Shortlisted while staff is still discussing; use Proposed when it should reach the repreneur portal."
                  />
                </FormFieldLabel>
                <Select name="status" defaultValue="proposed" onValueChange={() => clearFieldError("status")}>
                  <SelectTrigger id="match_status" className="w-full" {...fieldErrorProps("match_status", fieldErrors.status)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {STAFF_EDITABLE_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <ValidationFieldError id="match_status" message={fieldErrors.status} />
              </div>
              <div className="flex flex-col gap-2">
                <FormFieldLabel htmlFor="platform_recommendation_preview" requirement="optional">
                  Platform recommendation
                  <FieldInfo
                    label="Platform recommendation"
                    description="Automatic, rule-based guidance calculated from the selected repreneur and this opportunity."
                    example="Possible fit, 72/100, with sector and geography aligned but missing deal-size proof."
                  />
                </FormFieldLabel>
                <div id="platform_recommendation_preview" className="min-h-[58px] rounded-md border bg-muted/40 px-3 py-2">
                  {selectedCandidate?.platform_recommendation ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={recommendationVariant(selectedCandidate.platform_recommendation)}>
                          {getOpportunityMatchRecommendationLabel(selectedCandidate.platform_recommendation)}
                        </Badge>
                        <span className="text-sm font-medium tabular-nums">
                          {selectedCandidate.platform_score ?? "-"}
                          <span className="text-xs text-muted-foreground">/100</span>
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                        {(selectedCandidate.platform_reasons ?? []).slice(0, 3).map((reason) => (
                          <span key={reason}>{reason}</span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Select a repreneur to preview the automatic V2 score.</p>
                  )}
                </div>
                <Button asChild variant="link" size="sm" className="h-auto w-fit px-0 py-0 text-xs">
                  <Link href="/guide/guidelines#platform-match-score">View scoring guideline</Link>
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                <FormFieldLabel htmlFor="human_recommendation" requirement="optional">
                  Human recommendation
                  <FieldInfo
                    label="Human recommendation"
                    description="Staff confirmation, override, or caution after human review."
                    example="Strong fit after Bertrand confirms strategic relevance."
                  />
                </FormFieldLabel>
                <Select name="human_recommendation" defaultValue="not_evaluated">
                  <SelectTrigger id="human_recommendation" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {OPPORTUNITY_MATCH_RECOMMENDATION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground lg:col-span-2">
                <div className="flex flex-col gap-1">
                  <p className="font-medium text-foreground">Platform score is automatic and visible</p>
                  <p>
                    On save, Wave stores this platform recommendation, score, and rationale. Staff can add or override
                    context in the human recommendation beside it.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-2">
                <FormFieldLabel htmlFor="human_notes" requirement="optional">
                  Human notes
                  <FieldInfo
                    label="Human notes"
                    description="Internal staff rationale, caveats, or next-step context."
                    example="Wait for updated teaser before proposing; Bertrand wants seller access confirmed."
                  />
                </FormFieldLabel>
                <Textarea
                  id="human_notes"
                  name="human_notes"
                  rows={4}
                  placeholder="Wait for updated teaser before proposing; Bertrand wants seller access confirmed."
                />
              </div>
            </div>
            <Button type="submit" disabled={isSaving || candidates.length === 0} className="w-fit">
              <Save data-icon="inline-start" />
              {isSaving ? "Saving..." : "Save recommendation"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recommendations</CardTitle>
          <CardDescription>Structured matching records and staff-controlled pursuit validation.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {activeMatch ? (
            <Alert>
              <CheckCircle2 />
              <AlertTitle>Active pursuit locked</AlertTitle>
              <AlertDescription>
                {repreneurName(activeMatch.repreneur)} is the active pursuit for this opportunity. Drop that pursuit before validating another repreneur.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <UsersRound />
              <AlertTitle>Open for validation</AlertTitle>
              <AlertDescription>Any interested repreneur can be validated into the active pursuit.</AlertDescription>
            </Alert>
          )}
          <div className="overflow-x-auto rounded-md border">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Repreneur</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Human</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Reasons</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No recommendations saved yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  matches.map((match) => {
                    const isLockedByAnother = Boolean(activeMatch && activeMatch.id !== match.id)
                    const canValidate = match.status === "interested" && !isLockedByAnother
                    const isPending = pendingActionId === match.id

                    return (
                      <TableRow key={match.id}>
                        <TableCell>
                          <div className="font-medium">{repreneurName(match.repreneur)}</div>
                          <div className="text-xs text-muted-foreground">{match.repreneur?.email ?? "-"}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{getOpportunityMatchStatusLabel(match.status)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={recommendationVariant(match.platform_recommendation)}>
                            {getOpportunityMatchRecommendationLabel(match.platform_recommendation)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={recommendationVariant(match.human_recommendation)}>
                            {getOpportunityMatchRecommendationLabel(match.human_recommendation)}
                          </Badge>
                        </TableCell>
                        <TableCell>{match.platform_score ?? "-"}</TableCell>
                        <TableCell>
                          <div className="flex max-w-sm flex-col gap-1 text-xs">
                            {match.platform_reasons.length === 0 ? (
                              <span className="text-muted-foreground">-</span>
                            ) : (
                              match.platform_reasons.map((reason) => <span key={reason}>{reason}</span>)
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {canValidate && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isPending}
                                onClick={() => void handleValidate(match.id)}
                              >
                                <CheckCircle2 data-icon="inline-start" />
                                Validate
                              </Button>
                            )}

                            {match.status === "interested" && isLockedByAnother && (
                              <Badge variant="secondary">Locked</Badge>
                            )}

                            {match.status === "active_pursuit" && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button type="button" variant="outline" size="sm" disabled={isPending}>
                                    <CircleSlash2 data-icon="inline-start" />
                                    Drop
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Drop active pursuit?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will unlock the opportunity so another interested repreneur can be validated.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => void handleDrop(match.id)}>Drop pursuit</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}

                            {match.status === "dropped" && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isPending}
                                onClick={() => void handleReopen(match.id)}
                              >
                                <RotateCcw data-icon="inline-start" />
                                Reopen
                              </Button>
                            )}

                            {match.status !== "active_pursuit" && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="Remove recommendation"
                                disabled={isPending}
                                onClick={() => void handleRemove(match.id)}
                              >
                                <Trash2 data-icon="inline-start" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
