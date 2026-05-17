"use client"

import { useState } from "react"
import { CheckCircle2, CircleSlash2, RotateCcw, Save, Trash2, UsersRound } from "lucide-react"
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

interface OpportunityMatchesPanelProps {
  opportunityId: string
  matches: OpportunityMatch[]
  candidates: OpportunityMatchCandidate[]
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

export function OpportunityMatchesPanel({ opportunityId, matches, candidates }: OpportunityMatchesPanelProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)
  const activeMatch = matches.find((match) => match.status === "active_pursuit") ?? null

  async function handleSave(formData: FormData) {
    setIsSaving(true)
    try {
      await saveOpportunityMatch(formData)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRemove(matchId: string) {
    await removeOpportunityMatch(matchId, opportunityId)
  }

  async function handleValidate(matchId: string) {
    setPendingActionId(matchId)
    try {
      await validateOpportunityPursuit(matchId, opportunityId)
    } finally {
      setPendingActionId(null)
    }
  }

  async function handleDrop(matchId: string) {
    setPendingActionId(matchId)
    try {
      await dropOpportunityPursuit(matchId, opportunityId)
    } finally {
      setPendingActionId(null)
    }
  }

  async function handleReopen(matchId: string) {
    setPendingActionId(matchId)
    try {
      await reopenDroppedOpportunityMatch(matchId, opportunityId)
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
          <form action={handleSave} className="flex flex-col gap-5">
            <input type="hidden" name="opportunity_id" value={opportunityId} />
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="repreneur_id">Repreneur</Label>
                <Select name="repreneur_id" disabled={candidates.length === 0}>
                  <SelectTrigger id="repreneur_id" className="w-full">
                    <SelectValue placeholder={candidates.length === 0 ? "No repreneurs available" : "Select repreneur"} />
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
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="match_status">Match status</Label>
                <Select name="status" defaultValue="draft">
                  <SelectTrigger id="match_status" className="w-full">
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
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="platform_recommendation">Platform recommendation</Label>
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
                <Label htmlFor="platform_score">Platform score</Label>
                <Input id="platform_score" name="platform_score" type="number" min="0" max="100" placeholder="0-100" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="human_recommendation">Human recommendation</Label>
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
                <Label htmlFor="platform_reasons">Platform reasons</Label>
                <Textarea id="platform_reasons" name="platform_reasons" rows={4} placeholder="One reason per line" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="human_notes">Human notes</Label>
                <Textarea id="human_notes" name="human_notes" rows={4} placeholder="Optional staff context or override rationale" />
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
          <div className="overflow-hidden rounded-md border">
            <Table>
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
