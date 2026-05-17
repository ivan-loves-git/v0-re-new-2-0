import Link from "next/link"
import { CheckCircle2, ExternalLink, Inbox, LockKeyhole, ShieldCheck } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { OpportunityReviewSubmitButton } from "@/components/opportunities/opportunity-review-submit-button"
import { markOpportunityMatchReviewed, validateOpportunityPursuit } from "@/lib/actions/opportunity-matches"
import {
  getOpportunityMatchRecommendationLabel,
  getOpportunityMatchStatusLabel,
  type OpportunityMatchResponse,
} from "@/lib/types/opportunity"

interface OpportunityResponseReviewTableProps {
  responses: OpportunityMatchResponse[]
}

function repreneurName(response: OpportunityMatchResponse) {
  const repreneur = response.repreneur
  if (!repreneur) return "Unknown repreneur"
  return [repreneur.first_name, repreneur.last_name].filter(Boolean).join(" ") || repreneur.email
}

function opportunityTitle(response: OpportunityMatchResponse) {
  const opportunity = response.opportunity
  if (!opportunity) return "Unknown opportunity"
  return opportunity.public_title || opportunity.sector || opportunity.reference
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function responseVariant(status: OpportunityMatchResponse["status"]): "default" | "secondary" {
  return status === "interested" ? "default" : "secondary"
}

export function OpportunityResponseReviewTable({ responses }: OpportunityResponseReviewTableProps) {
  const pendingCount = responses.filter((response) => !response.reviewed_at).length

  if (responses.length === 0) {
    return (
      <Alert>
        <Inbox />
        <AlertTitle>No responses to review</AlertTitle>
        <AlertDescription>Repreneur interest and not-a-fit responses will appear here.</AlertDescription>
      </Alert>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Response Queue</CardTitle>
        <CardDescription>
          {pendingCount === 0 ? "All responses have been reviewed." : `${pendingCount} response(s) need staff review.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border">
          <Table className="min-w-[960px]">
            <TableHeader>
              <TableRow>
                <TableHead>Response</TableHead>
                <TableHead>Opportunity</TableHead>
                <TableHead>Repreneur</TableHead>
                <TableHead>Recommendation</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Review</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {responses.map((response) => {
                const reviewAction = markOpportunityMatchReviewed.bind(null, response.id, response.opportunity_id)
                const validateAction = validateOpportunityPursuit.bind(null, response.id, response.opportunity_id)
                const activeLock = Boolean(response.active_pursuit_match_id)
                return (
                  <TableRow key={response.id}>
                    <TableCell>
                      <div className="flex flex-col gap-2">
                        <Badge variant={responseVariant(response.status)} className="w-fit">
                          {getOpportunityMatchStatusLabel(response.status)}
                        </Badge>
                        {!response.reviewed_at && (
                          <Badge variant="outline" className="w-fit">
                            New response
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Link href={`/opportunities/${response.opportunity_id}`} className="font-medium hover:underline">
                          {opportunityTitle(response)}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          {response.opportunity?.reference ?? "-"} · {response.opportunity?.location ?? "Location to confirm"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Link href={`/repreneurs/${response.repreneur_id}`} className="font-medium hover:underline">
                          {repreneurName(response)}
                        </Link>
                        <span className="text-xs text-muted-foreground">{response.repreneur?.email ?? "-"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span>{getOpportunityMatchRecommendationLabel(response.human_recommendation)}</span>
                        <span className="text-xs text-muted-foreground">
                          Platform: {getOpportunityMatchRecommendationLabel(response.platform_recommendation)}
                          {response.platform_score !== null && response.platform_score !== undefined ? ` · ${response.platform_score}` : ""}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{formatDateTime(response.updated_at)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-2">
                        {response.status === "interested" && activeLock && (
                          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                            <LockKeyhole className="size-4" />
                            Locked by {response.active_pursuit_repreneur_name ?? response.active_pursuit_repreneur_email ?? "active pursuit"}
                          </div>
                        )}

                        {response.status === "interested" && !activeLock && (
                          <form action={validateAction}>
                            <OpportunityReviewSubmitButton size="sm" label="Validate pursuit" pendingLabel="Validating...">
                              <ShieldCheck data-icon="inline-start" />
                            </OpportunityReviewSubmitButton>
                          </form>
                        )}

                        {response.reviewed_at ? (
                          <span className="text-sm text-muted-foreground">Reviewed {formatDateTime(response.reviewed_at)}</span>
                        ) : (
                          <form action={reviewAction}>
                            <OpportunityReviewSubmitButton
                              variant="outline"
                              size="sm"
                              label="Mark reviewed"
                              pendingLabel="Marking..."
                            >
                              <CheckCircle2 data-icon="inline-start" />
                            </OpportunityReviewSubmitButton>
                          </form>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="icon" aria-label="Open opportunity">
                        <Link href={`/opportunities/${response.opportunity_id}`}>
                          <ExternalLink data-icon="inline-start" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
