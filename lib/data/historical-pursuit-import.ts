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
  sourceTerminal: boolean
  reviewFlags: string[]
  appliedOutcome: string
}

/** Staff-only profile-history projection. It is deliberately never called by portal readers. */
export async function listStaffHistoricalPursuitImportRows(repreneurId: string): Promise<StaffHistoricalPursuitImportRow[]> {
  await requireStaffAccess()
  type CandidateRow = { source_row: number; source_offer_label: string | null; source_opportunity_reference: string | null; completed_source_stages: string[] | null; not_applicable_source_stages: string[] | null; last_reported_source_stage: string; raw_drop_reason: string | null; source_terminal: boolean; review_flags: string[] | null; apply_outcome: string }
  type CandidateRpc = { rpc: (name: "historical_pursuit_import_rows_for_staff", args: { p_repreneur_id: string }) => Promise<{ data: CandidateRow[] | null; error: { message: string } | null }> }
  const { data, error } = await (createAdminClient() as unknown as CandidateRpc)
    .rpc("historical_pursuit_import_rows_for_staff", { p_repreneur_id: repreneurId })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    sourceRow: row.source_row, offerLabel: row.source_offer_label, opportunityReference: row.source_opportunity_reference,
    completedStages: row.completed_source_stages ?? [], notApplicableStages: row.not_applicable_source_stages ?? [],
    lastReportedStage: row.last_reported_source_stage, rawDropReason: row.raw_drop_reason,
    sourceTerminal: row.source_terminal, reviewFlags: row.review_flags ?? [], appliedOutcome: row.apply_outcome,
  }))
}
