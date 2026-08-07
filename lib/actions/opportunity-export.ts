"use server"

import { requireStaffAccess } from "@/lib/access-control"
import { listOpportunityWorkSurfaceRecords } from "@/lib/actions/opportunities"
import {
  toOpportunityExportRows,
  type OpportunityExportRow,
} from "@/lib/utils/opportunity-export"

/**
 * Returns the staff-only opportunity export at the moment a staff member asks
 * for it. This is deliberately a Server Action, not an API route or portal
 * projection, because it includes internal notes and source-contact context.
 */
export async function listOpportunityExportRows(): Promise<OpportunityExportRow[]> {
  await requireStaffAccess()
  const opportunities = await listOpportunityWorkSurfaceRecords({
    includeSourceReview: false,
  })
  return toOpportunityExportRows(opportunities)
}
