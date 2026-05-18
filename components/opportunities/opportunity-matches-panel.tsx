"use client"

import { useState } from "react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
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
  const status = readFormString(formData, "status") || "draft"
  const score = readFormString(formData, "platform_score")

  if (!repreneurId) {
    errors.repreneur_id = "Select the repreneur this recommendation is for."
  }

  if (activeMatch && REPRENEUR_EXPOSURE_STATUSES.has(status)) {
    errors.status = "This opportunity already has an active pursuit. Save as Draft or Shortlisted, or drop the active pursuit first."
  }

  if (score) {
    const parsed = Number(score.replace(",", "."))
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      errors.platform_score = "Use a number from 0 to 100, for example 78."
    }
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

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-destructive">{message}</p>
}

export function OpportunityMatchesPanel({ opportunityId, matches, candidates }: OpportunityMatchesPanelProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const activeMatch = matches.find((match) => match.status === "active_pursuit") ?? null

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
    setFeedback(message)

    if (message.type === "success") {
      toast.success(message.title, { description: message.description })
      return
    }

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
        setFieldErrors(result.field ? { [result.field]: result.message } : {})
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
          <CardDescription>Store platform guidance and optional human review before showing anything to a repreneur.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSave} noValidate className="flex flex-col gap-5">
            <input type="hidden" name="opportunity_id" value={opportunityId} />
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
                <Label htmlFor="repreneur_id">
                  Repreneur
                  <FieldInfo
                    label="Repreneur"
                    description="The person who may receive this opportunity."
                    example="Ivan Demo Repreneur - myworkmail4@gmail.com."
                  />
                </Label>
                <Select name="repreneur_id" disabled={candidates.length === 0} onValueChange={() => clearFieldError("repreneur_id")}>
                  <SelectTrigger id="repreneur_id" className="w-full" aria-invalid={Boolean(fieldErrors.repreneur_id)}>
                    <SelectValue placeholder={candidates.length === 0 ? "No repreneurs available" : "Choose a repreneur, e.g. Ivan Demo Repreneur"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {candidates.map((candidate) => (
                        <SelectItem key={candidate.id} value={candidate.id}>
                          {repreneurName(candidate)} - {candidate.email}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldError message={fieldErrors.repreneur_id} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="match_status">
                  Match status
                  <FieldInfo
                    label="Match status"
                    description="Draft and Shortlisted stay internal. Proposed and Interested expose or record repreneur flow. Active pursuit is only created with Validate."
                    example="Use Shortlisted while staff is still discussing; use Proposed when it should reach the repreneur portal."
                  />
                </Label>
                <Select name="status" defaultValue="draft" onValueChange={() => clearFieldError("status")}>
                  <SelectTrigger id="match_status" className="w-full" aria-invalid={Boolean(fieldErrors.status)}>
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
                <FieldError message={fieldErrors.status} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="platform_recommendation">
                  Platform recommendation
                  <FieldInfo
                    label="Platform recommendation"
                    description="Structured guidance from the platform before human review."
                    example="Possible fit when sector and readiness are aligned but proof is incomplete."
                  />
                </Label>
                <Select name="platform_recommendation" defaultValue="not_evaluated">
                  <SelectTrigger id="platform_recommendation" className="w-full">
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
              <div className="flex flex-col gap-2">
                <Label htmlFor="platform_score">
                  Platform score
                  <FieldInfo
                    label="Platform score"
                    description="A 0-100 confidence score for the platform recommendation."
                    example="78 means a good but not fully confirmed match."
                  />
                </Label>
                <Input
                  id="platform_score"
                  name="platform_score"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Example: 78"
                  aria-invalid={Boolean(fieldErrors.platform_score)}
                  onChange={() => clearFieldError("platform_score")}
                />
                <FieldError message={fieldErrors.platform_score} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="human_recommendation">
                  Human recommendation
                  <FieldInfo
                    label="Human recommendation"
                    description="Staff confirmation, override, or caution after human review."
                    example="Strong fit after Bertrand confirms strategic relevance."
                  />
                </Label>
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
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="platform_reasons">
                  Platform reasons
                  <FieldInfo
                    label="Platform reasons"
                    description="One reason per line, saved as structured rationale."
                    example="Sector matches operator background; EBITDA is within target range."
                  />
                </Label>
                <Textarea
                  id="platform_reasons"
                  name="platform_reasons"
                  rows={4}
                  placeholder={"Sector matches operator background\nEBITDA is within target range"}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="human_notes">
                  Human notes
                  <FieldInfo
                    label="Human notes"
                    description="Internal staff rationale, caveats, or next-step context."
                    example="Wait for updated teaser before proposing; Bertrand wants seller access confirmed."
                  />
                </Label>
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
