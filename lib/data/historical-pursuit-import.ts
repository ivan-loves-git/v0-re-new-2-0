import "server-only"

import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"

export interface StaffHistoricalPursuitImportRow {
  sourceRow: number
  offerLabel: string | null
  opportunityReference: string | null
  completedStages: string[]
  notApplicableStages: string[]
  lastReportedStage: string
  rawDropReason: string | null
  reviewFlags: string[]
  linkedMatchId: string | null
  appliedOutcome: string
}

/** Staff-only profile-history projection. It is deliberately never called by portal readers. */
export async function listStaffHistoricalPursuitImportRows(repreneurId: string): Promise<StaffHistoricalPursuitImportRow[]> {
  await requireStaffAccess()
  const { data, error } = await (createAdminClient() as any)
    .from("historical_pursuit_import_rows")
    .select("source_row, source_offer_label, source_opportunity_reference, completed_source_stages, not_applicable_source_stages, last_reported_source_stage, raw_drop_reason, review_flags, match_id, apply_outcome")
    .eq("repreneur_id", repreneurId)
    .order("source_row", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    sourceRow: row.source_row, offerLabel: row.source_offer_label, opportunityReference: row.source_opportunity_reference,
    completedStages: row.completed_source_stages ?? [], notApplicableStages: row.not_applicable_source_stages ?? [],
    lastReportedStage: row.last_reported_source_stage, rawDropReason: row.raw_drop_reason,
    reviewFlags: row.review_flags ?? [], linkedMatchId: row.match_id, appliedOutcome: row.apply_outcome,
  }))
}
