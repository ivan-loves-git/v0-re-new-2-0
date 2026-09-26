/** Withdrawn is retained for history, never an actionable review response. */
export function isPendingOpportunityResponse(response: { status: string; reviewed_at?: string | null }) {
  return response.status !== "withdrawn" && !response.reviewed_at
}
