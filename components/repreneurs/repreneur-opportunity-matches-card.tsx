"use client"

import Link from "next/link"
import { useRef, useState } from "react"
import { BriefcaseBusiness, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { saveOpportunityMatch } from "@/lib/actions/opportunity-matches"
import {
  FieldError,
  FormFieldLabel,
  ValidationSummary,
  fieldErrorProps,
  focusValidationSummary,
  type FieldErrors,
} from "@/components/forms/validation-feedback"
import {
  getOpportunityMatchRecommendationLabel,
  getOpportunityMatchStatusLabel,
  getOpportunityPursuitStageLabel,
  type OpportunityMatchRecommendation,
  type RepreneurOpportunityMatch,
  type RepreneurOpportunityCandidate,
} from "@/lib/types/opportunity"

interface RepreneurOpportunityMatchesCardProps {
  repreneurId: string
  matches: RepreneurOpportunityMatch[]
  candidates: RepreneurOpportunityCandidate[]
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not updated"
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}

function recommendationVariant(
  recommendation: OpportunityMatchRecommendation,
): "default" | "destructive" | "secondary" | "outline" {
  if (recommendation === "strong_fit") return "default"
  if (recommendation === "possible_fit") return "secondary"
  if (recommendation === "not_fit") return "destructive"
  return "outline"
}

function scoreLabel(score: number | null | undefined) {
  if (typeof score !== "number") return "No score"
  return `${score}%`
}

function opportunityTitle(match: RepreneurOpportunityMatch) {
  return match.opportunity?.public_title || match.opportunity?.activity || "Untitled opportunity"
}

export function RepreneurOpportunityMatchesCard({ repreneurId, matches, candidates }: RepreneurOpportunityMatchesCardProps) {
  const [recommendationErrors, setRecommendationErrors] = useState<FieldErrors>({})
  const [recommendationError, setRecommendationError] = useState<string>()
  const [recommendationSuccess, setRecommendationSuccess] = useState<string>()
  const [isSaving, setIsSaving] = useState(false)
  const recommendationSummaryRef = useRef<HTMLDivElement>(null)

  async function recommendOpportunity(formData: FormData) {
    if (!String(formData.get("opportunity_id") ?? "").trim()) {
      setRecommendationErrors({ opportunity_id: "Select an opportunity to recommend." })
      setRecommendationError(undefined)
      setRecommendationSuccess(undefined)
      focusValidationSummary(recommendationSummaryRef)
      return
    }

    setRecommendationErrors({})
    setRecommendationError(undefined)
    setRecommendationSuccess(undefined)
    setIsSaving(true)
    try {
      const result = await saveOpportunityMatch(formData)
      if (!result.ok) {
        if (result.field === "opportunity_id") {
          setRecommendationErrors({ opportunity_id: result.message })
          focusValidationSummary(recommendationSummaryRef)
        }
        setRecommendationError(result.message)
        return
      }

      setRecommendationSuccess("Recommendation saved.")
    } catch (error) {
      console.error("Opportunity recommendation failed")
      setRecommendationError(error instanceof Error ? error.message : "We could not save this recommendation. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <BriefcaseBusiness className="size-5" />
          Opportunity Matches
        </CardTitle>
        <CardDescription>Deals connected to this repreneur through matching or pursuit review.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {candidates.length > 0 && (
          <form action={recommendOpportunity} className="rounded-md border p-4">
            <input type="hidden" name="repreneur_id" value={repreneurId} />
            <input type="hidden" name="status" value="proposed" />
            <input type="hidden" name="human_recommendation" value="possible_fit" />
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <label className="flex flex-col gap-2 text-sm">
                <FormFieldLabel htmlFor="opportunity_id" requirement="required">Recommend an opportunity</FormFieldLabel>
                <select
                  id="opportunity_id"
                  name="opportunity_id"
                  required
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  {...fieldErrorProps("opportunity_id", recommendationErrors.opportunity_id)}
                  onChange={() => {
                    setRecommendationErrors({})
                    setRecommendationError(undefined)
                    setRecommendationSuccess(undefined)
                  }}
                >
                  <option value="">Select opportunity...</option>
                  {candidates.slice(0, 50).map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.reference} - {candidate.public_title || candidate.activity || candidate.sector || "Untitled"} ({candidate.platform_score}%)
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Push to portal"}
              </Button>
            </div>
            <ValidationSummary
              ref={recommendationSummaryRef}
              className="mt-3"
              errors={recommendationErrors}
              labels={{ opportunity_id: "Opportunity" }}
            />
            <FieldError className="mt-2" id="opportunity_id" message={recommendationErrors.opportunity_id} />
            {recommendationError ? <p role="alert" className="mt-2 text-sm text-destructive">{recommendationError}</p> : null}
            {recommendationSuccess ? <p role="status" className="mt-2 text-sm text-emerald-700">{recommendationSuccess}</p> : null}
            <p className="mt-2 text-xs text-muted-foreground">
              New recommendations are saved as Proposed, so they appear in the repreneur portal when the opportunity is repreneur-visible.
            </p>
          </form>
        )}
        {matches.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            No opportunity matches are connected to this repreneur yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Opportunity</TableHead>
                  <TableHead>Fit</TableHead>
                  <TableHead>Human view</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map((match) => (
                  <TableRow key={match.id}>
                    <TableCell className="min-w-64">
                      <div className="space-y-1">
                        <div className="font-medium">{opportunityTitle(match)}</div>
                        <div className="text-xs text-muted-foreground">
                          {[match.opportunity?.reference, match.opportunity?.sector, match.opportunity?.location]
                            .filter(Boolean)
                            .join(" · ") || "No reference details"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={recommendationVariant(match.platform_recommendation)}>
                          {getOpportunityMatchRecommendationLabel(match.platform_recommendation)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{scoreLabel(match.platform_score)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={recommendationVariant(match.human_recommendation)}>
                        {getOpportunityMatchRecommendationLabel(match.human_recommendation)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getOpportunityMatchStatusLabel(match.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {match.pursuit_stage ? getOpportunityPursuitStageLabel(match.pursuit_stage) : "No pursuit"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(match.updated_at)}</TableCell>
                    <TableCell className="text-right">
                      {match.opportunity?.id ? (
                        <Button asChild variant="ghost" size="icon-sm" aria-label="Open opportunity">
                          <Link href={`/opportunities/${match.opportunity.id}`}>
                            <ExternalLink data-icon="standalone" />
                          </Link>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Missing</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
