import Link from "next/link"
import { BriefcaseBusiness, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  getOpportunityMatchRecommendationLabel,
  getOpportunityMatchStatusLabel,
  getOpportunityPursuitStageLabel,
  type OpportunityMatchRecommendation,
  type RepreneurOpportunityMatch,
} from "@/lib/types/opportunity"

interface RepreneurOpportunityMatchesCardProps {
  matches: RepreneurOpportunityMatch[]
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

export function RepreneurOpportunityMatchesCard({ matches }: RepreneurOpportunityMatchesCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <BriefcaseBusiness className="size-5" />
          Opportunity Matches
        </CardTitle>
        <CardDescription>Deals connected to this repreneur through matching or pursuit review.</CardDescription>
      </CardHeader>
      <CardContent>
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
