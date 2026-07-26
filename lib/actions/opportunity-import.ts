"use server"

import { requireStaffAccess } from "@/lib/access-control"
import {
  directOpportunityImportDisabled,
  OPPORTUNITY_DIRECT_IMPORT_DISABLED,
} from "@/lib/utils/opportunity-import"

export { OPPORTUNITY_DIRECT_IMPORT_DISABLED }

/**
 * Kept as a guarded compatibility boundary for stale callers. It deliberately
 * performs no parsing, preview, database access or mutation.
 */
export async function previewOpportunityImport(formData: FormData): Promise<never> {
  void formData
  await requireStaffAccess()
  return directOpportunityImportDisabled()
}

/**
 * Kept as a guarded compatibility boundary for stale callers. The eventual
 * cutover activation is intentionally not exposed as a server action.
 */
export async function commitOpportunityImport(formData: FormData): Promise<never> {
  void formData
  await requireStaffAccess()
  return directOpportunityImportDisabled()
}
