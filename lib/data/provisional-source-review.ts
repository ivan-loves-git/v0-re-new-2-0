import { createAdminClient } from "@/lib/supabase/admin";
import type { OpportunityWithSource } from "@/lib/types/opportunity";

/**
 * Projects the W-064 review predicate to staff records in bounded queries.
 * The provisional context and append-only evidence never leave this server
 * helper; callers receive only the computed boolean.
 */
export async function withStaffSourceReviewState(
  supabase: ReturnType<typeof createAdminClient>,
  opportunities: OpportunityWithSource[],
): Promise<OpportunityWithSource[]> {
  if (opportunities.length === 0) return opportunities;

  const { data: context, error: contextError } = await supabase
    .from("ma_provisional_source_contexts")
    .select("office_id")
    .eq("context_key", "acme_co_paris")
    .maybeSingle();
  if (contextError) throw new Error(contextError.message);
  if (!context?.office_id) {
    throw new Error("The provisional source review context is unavailable.");
  }

  const opportunityIds = opportunities.map((opportunity) => opportunity.id);
  const { data: assignments, error: assignmentsError } = await supabase
    .from("ma_provisional_source_review_events")
    .select("id, opportunity_id")
    .eq("event_kind", "assigned")
    .eq("provisional_office_id", context.office_id)
    .in("opportunity_id", opportunityIds);
  if (assignmentsError) throw new Error(assignmentsError.message);

  const assignmentIds = (assignments ?? []).map((assignment) => assignment.id);
  const resolvedAssignmentIds = new Set<string>();
  if (assignmentIds.length > 0) {
    const { data: resolutions, error: resolutionsError } = await supabase
      .from("ma_provisional_source_review_events")
      .select("related_assignment_id")
      .eq("event_kind", "resolved")
      .in("related_assignment_id", assignmentIds);
    if (resolutionsError) throw new Error(resolutionsError.message);
    for (const resolution of resolutions ?? []) {
      if (resolution.related_assignment_id) {
        resolvedAssignmentIds.add(resolution.related_assignment_id);
      }
    }
  }

  const unresolvedOpportunityIds = new Set(
    (assignments ?? [])
      .filter((assignment) => !resolvedAssignmentIds.has(assignment.id))
      .map((assignment) => assignment.opportunity_id),
  );
  return opportunities.map((opportunity) => ({
    ...opportunity,
    source_review_required:
      opportunity.source_office_id === context.office_id ||
      unresolvedOpportunityIds.has(opportunity.id),
  }));
}
