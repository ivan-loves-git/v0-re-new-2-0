"use server"

import { revalidatePath } from "next/cache"
import { requireStaffAccess } from "@/lib/access-control"
import { revalidateOpportunityDashboardTags } from "@/lib/data/dashboard-snapshots"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  normalizeOpportunityRows,
  summarizeOpportunityImport,
  type OpportunityImportRawRow,
  type OpportunityImportResult,
  type OpportunityImportSummary,
} from "@/lib/utils/opportunity-import"

export interface OpportunityImportPreview {
  results: OpportunityImportResult[]
  summary: OpportunityImportSummary
}

export interface OpportunityImportCommitSummary {
  created: number
  skipped: number
  blocked: number
  warnings: number
}

const MAX_OPPORTUNITY_IMPORT_ROWS = 500

function parseRows(formData: FormData): OpportunityImportRawRow[] {
  const rowsJson = formData.get("rows_json")
  if (typeof rowsJson !== "string" || rowsJson.trim().length === 0) {
    throw new Error("Rows JSON is required")
  }

  const parsed = JSON.parse(rowsJson)
  if (!Array.isArray(parsed)) {
    throw new Error("Rows JSON must be an array")
  }

  if (parsed.length > MAX_OPPORTUNITY_IMPORT_ROWS) {
    throw new Error(
      `Opportunity imports are limited to ${MAX_OPPORTUNITY_IMPORT_ROWS} rows`,
    )
  }

  return parsed as OpportunityImportRawRow[]
}

export async function previewOpportunityImport(
  formData: FormData,
): Promise<OpportunityImportPreview> {
  await requireStaffAccess()
  const rows = parseRows(formData)
  const results = normalizeOpportunityRows(rows)

  return {
    results,
    summary: summarizeOpportunityImport(results),
  }
}

export async function commitOpportunityImport(
  formData: FormData,
): Promise<OpportunityImportCommitSummary> {
  const { user } = await requireStaffAccess()
  const rows = parseRows(formData)
  const selectedJson = formData.get("approved_indexes")
  const parsedIndexes =
    typeof selectedJson === "string" && selectedJson
      ? JSON.parse(selectedJson)
      : rows.map((_, index) => index)
  if (
    !Array.isArray(parsedIndexes) ||
    parsedIndexes.some(
      (value) => !Number.isInteger(value) || value < 0 || value >= rows.length,
    )
  ) {
    throw new Error("Approved indexes must reference imported rows")
  }
  const approvedIndexes = new Set(parsedIndexes as number[])

  const results = normalizeOpportunityRows(rows)
  const approved = results.filter((result) =>
    approvedIndexes.has(result.rowIndex),
  )
  const creatable = approved.filter((result) => result.isValid)
  const blocked = approved.length - creatable.length
  const supabase = createAdminClient()

  if (creatable.length > 0) {
    const { error } = await supabase.from("opportunities").insert(
      creatable.map((result) => ({
        ...result.draft,
        created_by: user.id,
      })),
    )

    if (error) throw new Error(error.message)
  }

  revalidatePath("/opportunities")
  revalidateOpportunityDashboardTags()

  return {
    created: creatable.length,
    skipped: results.length - approved.length,
    blocked,
    warnings: creatable.filter((result) =>
      result.diagnostics.some(
        (diagnostic) => diagnostic.severity === "warning",
      ),
    ).length,
  }
}
